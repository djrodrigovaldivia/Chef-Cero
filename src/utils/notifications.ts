/**
 * Utilidades para la gestión de Notificaciones del navegador en Chef Cero.
 * Permite solicitar permisos al usuario y emitir alertas personalizadas
 * tanto en primer plano como en segundo plano (pestaña minimizada o inactiva).
 */

export interface CustomNotificationOptions extends NotificationOptions {
  onClickUrl?: string;
  vibrate?: number | number[];
}

/**
 * Comprueba si el navegador actual soporta la API de Notificaciones del sistema.
 */
export function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

/**
 * Detecta si la aplicación se está ejecutando dentro de un iframe (como el preview de desarrollo)
 */
export function isRunningInIframe(): boolean {
  try {
    return typeof window !== 'undefined' && window.self !== window.top;
  } catch {
    return true;
  }
}

/**
 * Obtiene el estado actual de los permisos de notificación.
 */
export function getNotificationPermissionStatus(): NotificationPermission | 'unsupported' {
  if (!isNotificationSupported()) {
    return 'unsupported';
  }
  return Notification.permission;
}

/**
 * Solicita los permisos necesarios de notificación al navegador mediante Notification.requestPermission().
 * Retorna el estado resultante ('granted', 'denied', 'default' o 'unsupported').
 */
export async function requestNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (!isNotificationSupported()) {
    console.warn('Chef Cero: Este navegador no tiene soporte para la API de Notificaciones.');
    return 'unsupported';
  }

  // Si ya está concedido o denegado, retornamos el estado actual directamente
  if (Notification.permission === 'granted' || Notification.permission === 'denied') {
    return Notification.permission;
  }

  try {
    const permission = await Notification.requestPermission();
    return permission;
  } catch (err) {
    console.error('Chef Cero: Error al solicitar permisos mediante Notification.requestPermission():', err);
    return Notification.permission;
  }
}

/**
 * Envía una alerta de notificación personalizada al usuario.
 * Prioriza el uso de ServiceWorkerRegistration.showNotification() para garantizar
 * la entrega incluso si la pestaña está en segundo plano o minimizada, con fallback
 * a la instancia directa de Notification.
 *
 * @param title Título principal de la alerta (ej. "¡Tiempo cumplido!")
 * @param options Opciones de configuración (cuerpo, icono, vibración, interacción requerida, etc.)
 */
export async function sendCustomNotification(
  title: string,
  options?: CustomNotificationOptions
): Promise<boolean> {
  if (!isNotificationSupported()) {
    return false;
  }

  // Si el permiso no está otorgado, no podemos enviar la notificación
  if (Notification.permission !== 'granted') {
    return false;
  }

  const defaultOptions: CustomNotificationOptions = {
    icon: '/icon.svg',
    badge: '/icon.svg',
    requireInteraction: true, // Mantiene la notificación visible hasta que el usuario interactúe
    tag: `chef-alert-${Date.now()}`,
    vibrate: [200, 100, 200, 100, 300], // Patrón de vibración táctil en dispositivos móviles
    ...options,
  };

  try {
    // 1. Intentar mediante el Service Worker activo (óptimo para alertas en segundo plano)
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.ready;
        if (registration && typeof registration.showNotification === 'function') {
          await registration.showNotification(title, defaultOptions as any);
          return true;
        }
      } catch (swErr) {
        console.warn('Chef Cero: No se pudo usar Service Worker para notificación, probando fallback nativo:', swErr);
      }
    }

    // 2. Fallback a la API de Notification directa del navegador
    const notification = new Notification(title, defaultOptions as NotificationOptions);

    notification.onclick = () => {
      window.focus();
      notification.close();
      if (options?.onClickUrl && typeof window !== 'undefined') {
        window.location.href = options.onClickUrl;
      }
    };

    return true;
  } catch (err) {
    console.error('Chef Cero: Error al enviar notificación personalizada:', err);
    return false;
  }
}

/**
 * Alerta especializada de "¡Tiempo cumplido!" para temporizadores de cocina.
 * Diseñada para alertar al usuario inmediatamente cuando concluye un paso o temporizador,
 * garantizando el aviso incluso con la aplicación en segundo plano.
 *
 * @param timerLabel Nombre de la tarea o paso (ej. "Dorar cebolla", "Hervir pasta")
 * @param recipeTitle Título de la receta en curso
 */
export async function sendTimerAlertNotification(
  timerLabel: string,
  recipeTitle?: string
): Promise<boolean> {
  const title = '¡Tiempo cumplido!';
  const body = recipeTitle
    ? `El temporizador para "${timerLabel}" (${recipeTitle}) ha finalizado. ¡Revisa tu cocina y apaga o baja el fuego!`
    : `El temporizador para "${timerLabel}" ha finalizado. ¡Revisa tu sartén u olla ahora!`;

  return sendCustomNotification(title, {
    body,
    icon: '/icon.svg',
    badge: '/icon.svg',
    tag: `timer-done-${timerLabel.toLowerCase().replace(/\s+/g, '-')}`,
    requireInteraction: true,
    data: {
      url: '/',
      timerLabel,
      recipeTitle,
      timestamp: Date.now(),
    },
  });
}
