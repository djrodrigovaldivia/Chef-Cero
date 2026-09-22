// Cliente de Notificaciones Web Push y Service Worker para Chef Cero

let cachedRegistration: ServiceWorkerRegistration | null = null;
let cachedSubscription: PushSubscription | null = null;

/**
 * Convierte clave pública VAPID en base64 a formato binario Uint8Array para el navegador
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Verifica si el navegador soporta notificaciones y Service Workers
 */
export function isPushSupported(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

/**
 * Obtiene el estado actual del permiso de notificaciones
 */
export function getNotificationPermission(): 'granted' | 'denied' | 'default' | 'unsupported' {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission;
}

export interface NotificationPermissionResult {
  supported: boolean;
  permission: NotificationPermission | 'unsupported';
  granted: boolean;
  prompted: boolean;
  message: string;
}

/**
 * Función utilitaria para solicitar permisos de notificación al navegador.
 * Maneja navegadores no compatibles, permisos previamente concedidos o bloqueados,
 * y despliega el diálogo nativo cuando está en estado 'default'.
 * También inicializa el Service Worker y el registro Push si se aprueba.
 */
export async function requestNotificationPermission(): Promise<NotificationPermissionResult> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return {
      supported: false,
      permission: 'unsupported',
      granted: false,
      prompted: false,
      message: 'Este navegador no tiene soporte para notificaciones del sistema.',
    };
  }

  const initialPermission = Notification.permission;

  // Si ya estaba previamente concedido
  if (initialPermission === 'granted') {
    try {
      await registerChefServiceWorker();
      await requestPushPermissionAndSubscribe();
    } catch {}
    return {
      supported: true,
      permission: 'granted',
      granted: true,
      prompted: false,
      message: 'Notificaciones activas. Recibirás avisos sonoros y en pantalla.',
    };
  }

  // Si fue denegado expresamente en la configuración del navegador
  if (initialPermission === 'denied') {
    return {
      supported: true,
      permission: 'denied',
      granted: false,
      prompted: false,
      message: 'Las notificaciones están bloqueadas en tu navegador. Puedes habilitarlas en el candado de la URL.',
    };
  }

  // Si está en 'default', desplegamos la solicitud nativa del navegador
  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      try {
        await registerChefServiceWorker();
        // Inicializar suscripción Web Push en segundo plano
        await requestPushPermissionAndSubscribe();
      } catch (e) {
        console.warn('Chef Cero: Error al preparar suscripción push:', e);
      }
      return {
        supported: true,
        permission: 'granted',
        granted: true,
        prompted: true,
        message: '¡Permiso de notificaciones concedido! Recibirás alertas incluso fuera de la pestaña activa.',
      };
    } else {
      return {
        supported: true,
        permission,
        granted: false,
        prompted: true,
        message:
          permission === 'denied'
            ? 'Notificaciones bloqueadas por el usuario. Te alertaremos mientras la pestaña siga abierta.'
            : 'Permiso pospuesto. Te avisaremos con sonido mientras la pestaña permanezca abierta.',
      };
    }
  } catch (err: any) {
    console.error('Chef Cero: Error solicitando permisos de notificación:', err);
    return {
      supported: true,
      permission: Notification.permission,
      granted: Notification.permission === 'granted',
      prompted: true,
      message: 'No se pudo completar la solicitud de permisos de notificación.',
    };
  }
}

/**
 * Función utilitaria que integra una comprobación de permisos al iniciar un temporizador.
 * Verifica si el usuario tiene alertas habilitadas para garantizar que las reciba fuera de la pestaña.
 * Si aún no ha decidido ('default'), solicita el permiso en ese instante clave.
 */
export async function checkNotificationPermissionOnTimerStart(
  timerLabel?: string
): Promise<{
  granted: boolean;
  canAlertInBackground: boolean;
  permission: NotificationPermission | 'unsupported';
  feedbackNotice: {
    type: 'success' | 'warning' | 'info';
    title: string;
    message: string;
  };
}> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return {
      granted: false,
      canAlertInBackground: false,
      permission: 'unsupported',
      feedbackNotice: {
        type: 'warning',
        title: 'Navegador sin notificaciones push',
        message: 'Mantén esta pestaña activa para escuchar la campana sonora cuando el temporizador termine.',
      },
    };
  }

  const current = Notification.permission;

  if (current === 'granted') {
    return {
      granted: true,
      canAlertInBackground: true,
      permission: 'granted',
      feedbackNotice: {
        type: 'success',
        title: 'Alerta en segundo plano activa',
        message: timerLabel
          ? `Te avisaremos puntualmente cuando "${timerLabel}" esté listo, incluso si cambias de pestaña o minimizas el navegador.`
          : 'Te avisaremos cuando el temporizador termine aunque estés en otra pestaña.',
      },
    };
  }

  if (current === 'default') {
    // Solicitamos permiso automáticamente para no desatender la cocina
    const result = await requestNotificationPermission();
    if (result.granted) {
      return {
        granted: true,
        canAlertInBackground: true,
        permission: 'granted',
        feedbackNotice: {
          type: 'success',
          title: '¡Notificaciones activadas!',
          message: `Recibirás la alerta de "${timerLabel || 'tu comida'}" incluso si cierras o minimizas esta pestaña.`,
        },
      };
    } else {
      return {
        granted: false,
        canAlertInBackground: false,
        permission: result.permission,
        feedbackNotice: {
          type: 'warning',
          title: 'Notificaciones no activadas',
          message: 'Sin permiso de notificaciones, mantén la pestaña visible para no perderte la alarma sonora.',
        },
      };
    }
  }

  // Si está denegado ('denied')
  return {
    granted: false,
    canAlertInBackground: false,
    permission: 'denied',
    feedbackNotice: {
      type: 'warning',
      title: 'Notificaciones bloqueadas',
      message: 'Las alertas del sistema están desactivadas en tu navegador. Mantén la pestaña abierta y el volumen alto.',
    },
  };
}

/**
 * Registra o recupera el Service Worker de Chef Cero (/sw.js)
 */
export async function registerChefServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!isPushSupported()) return null;

  try {
    if (cachedRegistration) {
      return cachedRegistration;
    }

    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    cachedRegistration = reg;
    return reg;
  } catch (err) {
    console.warn('Chef Cero: Error registrando Service Worker:', err);
    return null;
  }
}

/**
 * Solicita permiso al usuario y registra la subscripción Web Push en el servidor
 */
export async function requestPushPermissionAndSubscribe(): Promise<{
  granted: boolean;
  subscription?: PushSubscription;
  error?: string;
}> {
  if (!isPushSupported()) {
    return {
      granted: false,
      error: 'Tu navegador actual no tiene soporte para Notificaciones Web Push.',
    };
  }

  try {
    // 1. Solicitar permiso explícito al usuario
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return {
        granted: false,
        error: permission === 'denied' 
          ? 'Has bloqueado las notificaciones. Habilítalas en el candado de la barra de direcciones.' 
          : 'Permiso de notificaciones no concedido.',
      };
    }

    // 2. Asegurar Service Worker activo
    const reg = await registerChefServiceWorker();
    if (!reg) {
      return { granted: true, error: 'Service Worker no disponible temporalmente.' };
    }

    // Esperar a que el SW esté completamente listo
    const readyReg = await navigator.serviceWorker.ready;

    // 3. Obtener la clave pública VAPID del servidor
    const res = await fetch('/api/notifications/vapid-public-key');
    if (!res.ok) {
      throw new Error('No se pudo obtener la clave VAPID del servidor');
    }
    const { publicKey } = await res.json();
    if (!publicKey) {
      throw new Error('Clave pública VAPID no configurada en el servidor');
    }

    const applicationServerKey = urlBase64ToUint8Array(publicKey);

    // 4. Comprobar si ya existe una subscripción activa en este navegador
    let subscription = await readyReg.pushManager.getSubscription();

    // 5. Si ya existe, verificar si la clave de servidor coincide; si cambió, renovarla
    if (subscription) {
      try {
        const rawKey = subscription.options?.applicationServerKey;
        if (rawKey) {
          const currentKeyArray = new Uint8Array(rawKey);
          let match = currentKeyArray.length === applicationServerKey.length;
          if (match) {
            for (let i = 0; match && i < applicationServerKey.length; i++) {
              if (currentKeyArray[i] !== applicationServerKey[i]) {
                match = false;
                break;
              }
            }
          }
          if (!match) {
            console.log('Chef Cero: Clave VAPID desactualizada en suscripción previa. Renovando suscripción...');
            await subscription.unsubscribe();
            subscription = null;
          }
        }
      } catch (checkErr) {
        console.warn('Chef Cero: Error comprobando clave de suscripción previa:', checkErr);
      }
    }

    // 6. Si no existe o fue invalidada, crear una nueva subscripción
    if (!subscription) {
      subscription = await readyReg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey as any,
      });
    }

    cachedSubscription = subscription;

    // 7. Registrar la subscripción en el servidor de Chef Cero
    await fetch('/api/notifications/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscription }),
    });

    return { granted: true, subscription };
  } catch (err: any) {
    console.error('Chef Cero: Error en subscripción push:', err);
    return {
      granted: Notification.permission === 'granted',
      error: err?.message || 'Error al suscribirse al servicio push',
    };
  }
}

/**
 * Obtiene la subscripción Push actual (si ya fue creada)
 */
export async function getActivePushSubscription(): Promise<PushSubscription | null> {
  if (cachedSubscription) return cachedSubscription;
  if (!isPushSupported()) return null;

  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      cachedSubscription = sub;
      return sub;
    }

    // Si el usuario ya tiene permisos otorgados, sincronizar suscripción
    if (Notification.permission === 'granted') {
      const res = await requestPushPermissionAndSubscribe();
      return res.subscription || null;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Programa una alerta push en el servidor para que se dispare cuando termine el temporizador,
 * incluso si la pestaña está en segundo plano o el dispositivo en reposo.
 */
export async function scheduleServerPushNotification(
  timerId: string,
  label: string,
  seconds: number,
  recipeTitle?: string
): Promise<boolean> {
  try {
    const subscription = await getActivePushSubscription();

    const response = await fetch('/api/notifications/schedule-timer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        timerId,
        label,
        seconds,
        recipeTitle,
        subscription,
      }),
    });

    return response.ok;
  } catch (err) {
    console.warn('Chef Cero: No se pudo programar push en servidor, fallback local activo:', err);
    return false;
  }
}

/**
 * Cancela una alerta push en el servidor si el temporizador es pausado o eliminado
 */
export async function cancelServerPushNotification(timerId: string): Promise<boolean> {
  try {
    const response = await fetch('/api/notifications/cancel-timer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ timerId }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Envía una notificación de prueba para que el usuario valide inmediatamente el sonido y la alerta push
 */
export async function sendTestPushNotification(): Promise<{ success: boolean; message: string }> {
  try {
    const subscription = await getActivePushSubscription();
    
    // Si no hay subscripción de red, probamos con notificación local a través del Service Worker
    if (!subscription) {
      if (Notification.permission === 'granted') {
        await showLocalNotification(
          '🔔 Notificación de Prueba (Local)',
          'Chef Cero te avisará aquí puntualmente cuando tus comidas terminen.'
        );
        return {
          success: true,
          message: 'Notificación de prueba emitida directamente en tu pantalla.',
        };
      }
      return {
        success: false,
        message: 'Por favor concede permiso de notificaciones primero.',
      };
    }

    const response = await fetch('/api/notifications/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscription }),
    });

    const data = await response.json();
    return {
      success: response.ok,
      message: data.message || data.error || 'Prueba enviada',
    };
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || 'Error de conexión enviando notificación de prueba',
    };
  }
}

/**
 * Emite una notificación del sistema mediante Service Worker (o Notification API directa).
 * Se ejecuta al instante en el cliente garantizando alerta inmediata.
 */
export async function showLocalNotification(
  title: string,
  body: string,
  tag: string = 'chef-cero-timer'
): Promise<void> {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.ready;
      if (reg && 'showNotification' in reg) {
        await reg.showNotification(title, {
          body,
          icon: '/icon.svg',
          badge: '/icon.svg',
          tag,
          renotify: true,
          vibrate: [300, 100, 300, 100, 300],
          data: { url: '/' },
        } as any);
        return;
      }
    }

    // Fallback estándar si SW no está listo
    new Notification(title, {
      body,
      icon: '/icon.svg',
      tag,
    });
  } catch (err) {
    console.warn('Chef Cero: Error mostrando notificación local:', err);
  }
}
