import { useState, useEffect, useCallback, useRef } from 'react';

export interface UseWakeLockResult {
  isSupported: boolean;
  isActive: boolean;
  request: () => Promise<boolean>;
  release: () => Promise<void>;
  toggle: () => Promise<void>;
}

/**
 * Hook de React para la Screen Wake Lock API.
 * Mantiene la pantalla encendida automáticamente mientras cocinas
 * y se recupera de forma transparente cuando el usuario vuelve a enfocar la pestaña.
 */
export function useWakeLock(autoRequest: boolean = true): UseWakeLockResult {
  const [isSupported, setIsSupported] = useState<boolean>(false);
  const [isActive, setIsActive] = useState<boolean>(false);
  const sentinelRef = useRef<any>(null);
  const requestedRef = useRef<boolean>(autoRequest);

  useEffect(() => {
    setIsSupported(typeof navigator !== 'undefined' && 'wakeLock' in navigator);
  }, []);

  const request = useCallback(async (): Promise<boolean> => {
    if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) {
      return false;
    }

    try {
      if (sentinelRef.current && !sentinelRef.current.released) {
        setIsActive(true);
        return true;
      }

      const sentinel = await (navigator as any).wakeLock.request('screen');
      sentinelRef.current = sentinel;
      setIsActive(true);

      sentinel.addEventListener('release', () => {
        // Puede ser liberado por cambio de pestaña o bloqueo del sistema
        if (sentinelRef.current === sentinel) {
          sentinelRef.current = null;
          setIsActive(false);
        }
      });

      return true;
    } catch (err) {
      console.warn('Chef Cero: No se pudo obtener Screen Wake Lock:', err);
      sentinelRef.current = null;
      setIsActive(false);
      return false;
    }
  }, []);

  const release = useCallback(async (): Promise<void> => {
    if (sentinelRef.current && !sentinelRef.current.released) {
      try {
        await sentinelRef.current.release();
      } catch {}
    }
    sentinelRef.current = null;
    setIsActive(false);
  }, []);

  const toggle = useCallback(async (): Promise<void> => {
    if (isActive) {
      requestedRef.current = false;
      await release();
    } else {
      requestedRef.current = true;
      await request();
    }
  }, [isActive, request, release]);

  // Manejo de autoRequest y visibilitychange
  useEffect(() => {
    requestedRef.current = autoRequest;
    if (autoRequest) {
      request();
    } else {
      release();
    }

    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && requestedRef.current) {
        await request();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      release();
    };
  }, [autoRequest, request, release]);

  return {
    isSupported,
    isActive,
    request,
    release,
    toggle,
  };
}
