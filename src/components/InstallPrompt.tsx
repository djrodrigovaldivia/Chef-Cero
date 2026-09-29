import React, { useState, useEffect } from 'react';
import { Smartphone, Download, X, Share, PlusSquare, Check } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Detectar si ya corre como app instalada (standalone)
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    
    setIsInstalled(isStandalone);

    // Detectar dispositivos iOS (Safari en iPhone/iPad no emite beforeinstallprompt)
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIOSDevice = /iphone|ipad|ipod/.test(userAgent) && !isStandalone;
    setIsIOS(isIOSDevice);

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const install = async () => {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
      setDeferredPrompt(null);
      return true;
    }
    return false;
  };

  return {
    isInstallable: !!deferredPrompt,
    isInstalled,
    isIOS,
    install,
  };
}

export const InstallPrompt: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSModal, setShowIOSModal] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // Si ya está instalada o el usuario descartó el banner en esta sesión, no mostramos banner flotante
  if (isInstalled) {
    return null;
  }

  return (
    <>
      {/* Banner flotante discreto en esquina inferior (móvil y desktop) */}
      {!dismissed && (isInstallable || isIOS) && (
        <div className="fixed bottom-20 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-md z-40 bg-stone-900/95 text-white p-3.5 rounded-2xl shadow-2xl border border-stone-800 backdrop-blur-md animate-fade-in flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-orange-600 flex items-center justify-center shrink-0 shadow-inner">
              <Smartphone className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-white truncate">
                Instalar Chef Cero en tu teléfono
              </p>
              <p className="text-[11px] text-stone-400 truncate">
                Pantalla completa, offline y sin barra del navegador
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isInstallable ? (
              <button
                onClick={install}
                className="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-xl transition shadow flex items-center gap-1.5 cursor-pointer active:scale-95"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Instalar</span>
              </button>
            ) : isIOS ? (
              <button
                onClick={() => setShowIOSModal(true)}
                className="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-xl transition shadow flex items-center gap-1.5 cursor-pointer active:scale-95"
              >
                <span>Ver cómo</span>
              </button>
            ) : null}

            <button
              onClick={() => setDismissed(true)}
              className="p-1 text-stone-400 hover:text-white rounded-lg hover:bg-stone-800 transition cursor-pointer"
              title="Cerrar aviso"
              aria-label="Cerrar aviso"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Modal Guiado para instalación en iOS Safari */}
      {showIOSModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={() => setShowIOSModal(false)}
        >
          <div
            className="w-full max-w-sm rounded-3xl bg-stone-900 border border-stone-800 text-white p-6 shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowIOSModal(false)}
              className="absolute top-4 right-4 p-1.5 text-stone-400 hover:text-white rounded-full bg-stone-800/80 transition"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="w-12 h-12 rounded-2xl bg-orange-500/20 text-orange-400 flex items-center justify-center mx-auto mb-3">
              <Smartphone className="w-6 h-6" />
            </div>

            <h3 className="text-center text-base font-bold text-white">
              Instalar en tu iPhone o iPad
            </h3>
            <p className="text-center text-xs text-stone-400 mt-1 mb-4">
              Disfruta de Chef Cero a pantalla completa y sin interrupciones en la cocina.
            </p>

            <div className="space-y-3 bg-stone-950/60 p-4 rounded-2xl border border-stone-800/60 text-xs text-stone-300">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-orange-500/30 text-orange-400 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                  1
                </div>
                <div>
                  Toca el botón <strong className="text-white">Compartir</strong> en la barra inferior de Safari:
                  <div className="inline-flex items-center gap-1 bg-stone-800 px-2 py-0.5 rounded text-[11px] text-orange-300 ml-1">
                    <Share className="w-3 h-3" /> Compartir
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-orange-500/30 text-orange-400 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                  2
                </div>
                <div>
                  Desliza hacia abajo y pulsa <strong className="text-white">Agregar a pantalla de inicio</strong>:
                  <div className="inline-flex items-center gap-1 bg-stone-800 px-2 py-0.5 rounded text-[11px] text-orange-300 ml-1">
                    <PlusSquare className="w-3 h-3" /> Agregar al inicio
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-orange-500/30 text-orange-400 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                  3
                </div>
                <div>
                  Toca <strong className="text-white">Agregar</strong> en la esquina superior derecha. ¡Listo!
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowIOSModal(false)}
              className="mt-5 w-full py-2.5 bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs rounded-xl shadow transition"
            >
              ¡Entendido, volver a la cocina!
            </button>
          </div>
        </div>
      )}
    </>
  );
};

// Botón sutil para el footer o panel de configuración
export const FooterInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSModal, setShowIOSModal] = useState(false);

  if (isInstalled) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-emerald-600 font-medium bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
        <Check className="w-3.5 h-3.5" /> App Instalada
      </span>
    );
  }

  if (!isInstallable && !isIOS) {
    return null;
  }

  return (
    <>
      <button
        onClick={isInstallable ? install : () => setShowIOSModal(true)}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-orange-700 hover:text-orange-800 bg-orange-100 hover:bg-orange-200 px-3 py-1.5 rounded-full transition shadow-sm cursor-pointer active:scale-95"
      >
        <Smartphone className="w-3.5 h-3.5 text-orange-600" />
        <span>📲 Instalar Chef Cero en tu teléfono</span>
      </button>

      {showIOSModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 text-left"
          onClick={() => setShowIOSModal(false)}
        >
          <div
            className="w-full max-w-sm rounded-3xl bg-stone-900 border border-stone-800 text-white p-6 shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowIOSModal(false)}
              className="absolute top-4 right-4 p-1.5 text-stone-400 hover:text-white rounded-full bg-stone-800/80 transition"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="text-base font-bold text-white mb-2">Instalar en iPhone / iPad</h3>
            <p className="text-xs text-stone-300 mb-4">
              En Safari, presiona el botón <Share className="w-3 h-3 inline mx-1 text-orange-400" /> <strong>Compartir</strong> y luego selecciona <strong className="text-white">Agregar a pantalla de inicio</strong>.
            </p>
            <button
              onClick={() => setShowIOSModal(false)}
              className="w-full py-2 bg-stone-800 hover:bg-stone-700 text-white text-xs font-bold rounded-xl"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </>
  );
};
