// Chef Cero - Service Worker Ligero para Modo Offline, PWA y Temporizadores en Segundo Plano
const CACHE_NAME = 'chef-cero-v3';

// Recursos estáticos básicos que se precachean en la instalación
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon.svg',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
  '/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('[Chef Cero SW] Error precacheando assets base:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
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

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') {
    return;
  }

  const url = new URL(event.request.url);

  // Ignorar protocolos externos o extensiones del navegador
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return;
  }

  // 1. ENDPOINTS DINÁMICOS & IA (/api/*): Network-First estricto, nunca cachear peticiones a Gemini
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request).catch(() => {
        return new Response(
          JSON.stringify({
            offline: true,
            error: 'Sin conexión a internet. La guía local de recetas, los temporizadores y el diccionario culinario siguen disponibles.',
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

  // 2. NAVEGACIÓN PRINCIPAL (HTML / Refresh de página): Network-First con Fallback a Caché
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          return caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) return cachedResponse;
            return caches.match('/index.html').then((indexCached) => {
              return indexCached || caches.match('/');
            });
          });
        })
    );
    return;
  }

  // 3. ASSETS ESTÁTICOS (JS, CSS, Fuentes, Iconos, Imágenes): Stale-While-Revalidate
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
          if (event.request.destination === 'image') {
            return caches.match('/icon.svg');
          }
          return null;
        });

      return cachedResponse || fetchPromise.then((networkRes) => {
        return networkRes || new Response('Recurso no disponible sin conexión', { status: 503 });
      });
    })
  );
});

// Soporte de Notificaciones Web Push y Temporizadores en Segundo Plano
self.addEventListener('push', (event) => {
  let notificationData = {
    title: '⏰ ¡Tiempo cumplido en Chef Cero!',
    body: 'Un temporizador de cocina ha finalizado. ¡Revisa tu fuego!',
    icon: '/pwa-192x192.png',
    badge: '/icon.svg',
    tag: 'chef-cero-timer',
    data: { url: '/' },
  };

  if (event.data) {
    try {
      notificationData = { ...notificationData, ...event.data.json() };
    } catch {
      notificationData.body = event.data.text() || notificationData.body;
    }
  }

  event.waitUntil(
    self.registration.showNotification(notificationData.title, {
      body: notificationData.body,
      icon: notificationData.icon || '/pwa-192x192.png',
      badge: notificationData.badge || '/icon.svg',
      vibrate: [300, 100, 300, 100, 300],
      tag: notificationData.tag || 'chef-cero-timer',
      renotify: true,
      requireInteraction: true,
      data: notificationData.data || { url: '/' },
      actions: [
        { action: 'open_cooking', title: '🍳 Ir a la Cocina' },
        { action: 'dismiss', title: 'Entendido' },
      ],
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'dismiss') return;

  const targetUrl = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

self.addEventListener('message', (event) => {
  if (!event.data) return;
  const { type, payload } = event.data;

  if (type === 'SHOW_NOTIFICATION') {
    const { title, body, tag, data } = payload || {};
    self.registration.showNotification(title || '⏰ ¡Tiempo cumplido en Chef Cero!', {
      body: body || 'El temporizador ha terminado.',
      icon: '/pwa-192x192.png',
      badge: '/icon.svg',
      tag: tag || 'timer-alert',
      vibrate: [300, 100, 300, 100, 300],
      requireInteraction: true,
      data: data || { url: '/' },
    });
  }

  if (type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
