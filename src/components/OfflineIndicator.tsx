import React, { useState, useEffect } from 'react';
import { WifiOff, Wifi, CheckCircle2, ShieldCheck } from 'lucide-react';
import { useOnlineStatus } from '../utils/useOnlineStatus';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();
  const [wasOffline, setWasOffline] = useState(false);
  const [showRestoredNotice, setShowRestoredNotice] = useState(false);

  useEffect(() => {
    if (!isOnline) {
      setWasOffline(true);
      setShowRestoredNotice(false);
    } else if (wasOffline) {
      setShowRestoredNotice(true);
      const timer = setTimeout(() => {
        setShowRestoredNotice(false);
        setWasOffline(false);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [isOnline, wasOffline]);

  // Si se restableció la conexión
  if (showRestoredNotice) {
    return (
      <aside
        aria-label="Aviso de conexión restablecida"
        className="fixed bottom-4 right-4 z-50 animate-bounce bg-emerald-600 text-white px-4 py-2.5 rounded-2xl shadow-xl flex items-center gap-2.5 text-xs font-bold border border-emerald-400"
      >
        <Wifi className="w-4 h-4 text-emerald-100" />
        <span>Conexión restablecida. Sincronización activa.</span>
        <CheckCircle2 className="w-4 h-4 text-emerald-200" />
      </aside>
    );
  }

  // Si está sin conexión
  if (!isOnline) {
    return (
      <aside
        aria-label="Aviso de modo sin conexión"
        className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-md z-50 bg-stone-900/95 backdrop-blur-md text-white p-3.5 rounded-2xl shadow-2xl border border-stone-700 animate-fade-in flex items-start gap-3"
      >
        <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
          <WifiOff className="w-4 h-4" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-extrabold text-amber-400 uppercase tracking-wide">
              Modo Sin Conexión Activo
            </span>
            <span className="px-1.5 py-0.2 rounded-full bg-stone-800 text-[10px] text-stone-300 font-semibold border border-stone-700">
              Caché Service Worker
            </span>
          </div>
          <p className="text-[11px] text-stone-300 mt-0.5 leading-snug">
            Tranquilidad: puedes seguir tu receta paso a paso, usar los temporizadores y ver el radar sensorial con normalidad.
          </p>
        </div>
      </aside>
    );
  }

  return null;
};
