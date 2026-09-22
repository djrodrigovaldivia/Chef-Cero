// Chef Cero - Service Worker para Notificaciones Web Push, Caché Offline y Temporizadores en Segundo Plano

const CACHE_NAME = 'chef-cero-cache-v2';

// Recursos esenciales que se precachean en la instalación inicial
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon.svg',
];

self.addEventListener('install', (event) => {
  // Precachear recursos estáticos esenciales y activar inmediatamente
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('Chef Cero: Error precacheando recursos básicos:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  // Eliminar cachés antiguas y tomar control inmediato de clientes
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            return caches.delete(name);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Estrategia de Caché Inteligente para peticiones de red
self.addEventListener('fetch', (event) => {
  // Solo interceptamos peticiones GET
  if (event.request.method !== 'GET') {
    return;
  }

  const url = new URL(event.request.url);

  // Ignorar protocolos no soportados como chrome-extension://
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return;
  }

  // 1. Peticiones a la API (/api/*): Network-First con respuesta JSON elegante en caso de offline
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request).catch(() => {
        return new Response(
          JSON.stringify({
            offline: true,
            error: 'Sin conexión a internet. La guía local de recetas, los temporizadores y el diccionario siguen funcionando.',
          }),
          {
            status: 503,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      })
    );
    return;
  }

  // 2. Peticiones de navegación (cargar la página o refrescar): Network-First con fallback a caché
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
              cache.put('/', networkResponse.clone());
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // Si el usuario pierde conexión mientras cocina y refresca la pantalla
          return caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) return cachedResponse;
            return caches.match('/index.html').then((indexCached) => {
              if (indexCached) return indexCached;
              return caches.match('/');
            });
          });
        })
    );
    return;
  }

  // 3. Recursos estáticos (scripts JS, CSS, fuentes de Google, SVG, imágenes): Stale-While-Revalidate / Cache-First
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (
            networkResponse &&
            (networkResponse.status === 200 || networkResponse.type === 'opaque')
          ) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // Fallback en caso de fallo de imagen
          if (event.request.destination === 'image') {
            return caches.match('/icon.svg');
          }
          return null;
        });

      // Si existe en caché, servirlo de inmediato para que la app responda al instante offline
      if (cachedResponse) {
        return cachedResponse;
      }

      // Si no estaba en caché, esperar la respuesta de red
      return fetchPromise.then((networkRes) => {
        if (networkRes) return networkRes;
        return new Response('Recurso no disponible sin conexión', { status: 503 });
      });
    })
  );
});

// Manejo de eventos Push del servidor
self.addEventListener('push', (event) => {
  let notificationData = {
    title: '⏰ ¡Tiempo cumplido en Chef Cero!',
    body: 'Un temporizador de cocina ha finalizado. ¡Revisa tu sartén u olla!',
    icon: '/icon.svg',
    badge: '/icon.svg',
    tag: 'chef-cero-timer',
    data: { url: '/' },
  };

  if (event.data) {
    try {
      const parsed = event.data.json();
      notificationData = {
        ...notificationData,
        ...parsed,
      };
    } catch (e) {
      notificationData.body = event.data.text() || notificationData.body;
    }
  }

  const options = {
    body: notificationData.body,
    icon: notificationData.icon || '/icon.svg',
    badge: notificationData.badge || '/icon.svg',
    vibrate: [300, 100, 300, 100, 300],
    tag: notificationData.tag || 'chef-cero-timer',
    renotify: true,
    requireInteraction: true,
    data: notificationData.data || { url: '/' },
    actions: [
      {
        action: 'open_cooking',
        title: '🍳 Ir a la Cocina',
      },
      {
        action: 'dismiss',
        title: 'Entendido',
      },
    ],
  };

  event.waitUntil(
    self.registration.showNotification(notificationData.title, options)
  );
});

// Manejo de clics en la notificación
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  const targetUrl = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Si ya hay una pestaña abierta de Chef Cero, enfocarla
      for (const client of clientList) {
        if ('focus' in client) {
          return client.focus();
        }
      }
      // Si no hay ninguna pestaña abierta, abrir una nueva
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

// Mensajería entre la aplicación cliente y el Service Worker
self.addEventListener('message', (event) => {
  if (!event.data) return;

  const { type, payload } = event.data;

  if (type === 'SHOW_NOTIFICATION') {
    const { title, body, tag, data } = payload || {};
    self.registration.showNotification(title || '⏰ ¡Tiempo cumplido en Chef Cero!', {
      body: body || 'El temporizador ha terminado.',
      icon: '/icon.svg',
      badge: '/icon.svg',
      tag: tag || 'timer-alert',
      vibrate: [300, 100, 300, 100, 300],
      requireInteraction: true,
      data: data || { url: '/' },
    });
  }

  if (type === 'PING') {
    event.source?.postMessage({ type: 'PONG', timestamp: Date.now() });
  }
});
