/**
 * Utilidad para gestionar la Screen Wake Lock API.
 * Evita que la pantalla del móvil, tablet u ordenador se apague o bloquee
 * mientras el usuario está cocinando con las manos ocupadas o sucias.
 */

let wakeLockSentinel: any = null;

/**
 * Comprueba si el navegador actual soporta la Screen Wake Lock API.
 */
export function isWakeLockSupported(): boolean {
  return typeof navigator !== 'undefined' && 'wakeLock' in navigator;
}

/**
 * Solicita mantener la pantalla encendida.
 */
export async function requestScreenWakeLock(): Promise<boolean> {
  if (!isWakeLockSupported()) {
    return false;
  }

  try {
    if (wakeLockSentinel && !wakeLockSentinel.released) {
      return true;
    }

    wakeLockSentinel = await (navigator as any).wakeLock.request('screen');

    wakeLockSentinel.addEventListener('release', () => {
      wakeLockSentinel = null;
    });

    return true;
  } catch (err) {
    console.warn('Chef Cero: No se pudo activar Screen Wake Lock:', err);
    wakeLockSentinel = null;
    return false;
  }
}

/**
 * Libera el bloqueo de pantalla permitiendo que el dispositivo vuelva a su configuración de reposo habitual.
 */
export async function releaseScreenWakeLock(): Promise<void> {
  if (wakeLockSentinel && !wakeLockSentinel.released) {
    try {
      await wakeLockSentinel.release();
    } catch {}
    wakeLockSentinel = null;
  }
}

/**
 * Hook de React para mantener la pantalla encendida automáticamente mientras un componente esté montado o una condición sea verdadera.
 */
export function setupWakeLockAutoRefresh(isActive: boolean, onStatusChange?: (locked: boolean) => void) {
  if (!isWakeLockSupported() || !isActive) {
    releaseScreenWakeLock();
    if (onStatusChange) onStatusChange(false);
    return () => {};
  }

  requestScreenWakeLock().then((acquired) => {
    if (onStatusChange) onStatusChange(acquired);
  });

  // Si el usuario cambia de pestaña y regresa, los navegadores liberan el Wake Lock automáticamente.
  // Este listener lo re-adquiere al volver a la pestaña si la cocción sigue activa.
  const handleVisibilityChange = async () => {
    if (document.visibilityState === 'visible' && isActive) {
      const reacquired = await requestScreenWakeLock();
      if (onStatusChange) onStatusChange(reacquired);
    }
  };

  document.addEventListener('visibilitychange', handleVisibilityChange);

  return () => {
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    releaseScreenWakeLock();
    if (onStatusChange) onStatusChange(false);
  };
}
