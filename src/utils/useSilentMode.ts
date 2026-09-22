import { useState, useEffect } from 'react';
import { getSilentMode, setSilentMode, subscribeToSilentMode } from './audioAlert';

/**
 * Hook para sincronizar el estado del Modo Silencioso en toda la aplicación.
 * Permite cambiar entre modo con voz normal y modo silencioso con subtítulos accesibles.
 */
export function useSilentMode() {
  const [isSilent, setIsSilent] = useState<boolean>(() => getSilentMode());

  useEffect(() => {
    const unsubscribe = subscribeToSilentMode((active) => {
      setIsSilent(active);
    });
    return unsubscribe;
  }, []);

  const toggleSilentMode = () => {
    setSilentMode(!isSilent);
  };

  return {
    isSilent,
    setSilentMode,
    toggleSilentMode,
  };
}
