import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, AlertTriangle, Flame, X, Sparkles, Mic, CheckCircle2, 
  Droplets, UtensilsCrossed, ArrowRight, HeartPulse, Check, RefreshCw
} from 'lucide-react';
import { speakSpanishText, stopSpeaking } from '../utils/audioAlert';

interface CookingEmergencyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onResumeCooking?: () => void;
  onOpenVoiceAssistant?: () => void;
}

type QuickDiagnosticType = 'quemado' | 'salado' | 'seco' | null;

export const CookingEmergencyModal: React.FC<CookingEmergencyModalProps> = ({
  isOpen,
  onClose,
  onResumeCooking,
  onOpenVoiceAssistant,
}) => {
  const [activeDiagnostic, setActiveDiagnostic] = useState<QuickDiagnosticType>('quemado');

  // 1. Locución concisa de choque automático al abrir (máximo 1 frase contundente)
  useEffect(() => {
    if (isOpen) {
      stopSpeaking();
      speakSpanishText('Sartén fuera del fuego ahora mismo. No raspes el fondo de la olla.');
    }
  }, [isOpen]);

  // 2. Control de voz manos libres para salir diciendo "Continuar" o "Reanudar" o tecla Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleResume();
      }
    };

    const handleVoiceResume = (e: any) => {
      const action = e.detail?.action;
      if (action === 'resume' || action === 'continue' || action === 'next') {
        handleResume();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('chef-cero-step-cmd', handleVoiceResume);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('chef-cero-step-cmd', handleVoiceResume);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleResume = () => {
    stopSpeaking();
    if (onResumeCooking) {
      onResumeCooking();
    } else {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-stone-950/90 backdrop-blur-md animate-fade-in">
      <div
        id="cooking-emergency-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="emergency-modal-title"
        className="bg-stone-900 text-stone-100 rounded-3xl shadow-2xl max-w-2xl w-full max-h-[94vh] flex flex-col overflow-hidden border-2 border-red-500/90 ring-4 ring-red-950/50"
      >
        {/* HEADER DE ALTA VISIBILIDAD */}
        <div className="bg-gradient-to-r from-red-700 via-red-600 to-amber-700 text-white px-5 py-3.5 flex items-center justify-between gap-3 shadow-md shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center text-white shrink-0 animate-pulse">
              <ShieldAlert className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] sm:text-xs uppercase tracking-widest font-black bg-black/30 text-amber-200 px-2 py-0.5 rounded-full">
                  ⚠️ Protocolo de Choque S.O.S.
                </span>
                <span className="text-[11px] text-red-100 font-medium hidden sm:inline">
                  Temporizadores pausados en 0 ms
                </span>
              </div>
              <h2 id="emergency-modal-title" className="text-base sm:text-lg font-black font-serif tracking-tight text-white">
                Rescate en Caliente: Cero Pánico
              </h2>
            </div>
          </div>

          <button
            onClick={handleResume}
            className="w-9 h-9 rounded-full bg-black/30 hover:bg-black/50 text-white flex items-center justify-center transition cursor-pointer"
            aria-label="Cerrar y continuar cocinando"
          >
            <X className="w-5 h-5 stroke-[2.5]" />
          </button>
        </div>

        {/* CUERPO PRINCIPAL DEL MODAL */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          
          {/* SECCIÓN 1: PROTOCOLO DE RESCATE EN 3 PASOS DE CHOQUE */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-wider font-extrabold text-amber-400 font-serif flex items-center gap-1.5">
                <HeartPulse className="w-3.5 h-3.5 text-red-400" />
                <span>3 Acciones Inmediatas (Léelas a 1 metro de distancia):</span>
              </span>
              <span className="text-[10px] text-stone-400 font-mono">Paso 1 ➔ Paso 2 ➔ Paso 3</span>
            </div>

            <div className="grid grid-cols-1 gap-2.5">
              
              {/* PASO 1: Inmediato */}
              <div className="p-3.5 rounded-2xl bg-gradient-to-r from-red-950/80 to-stone-900 border border-red-500/80 flex items-start gap-3 shadow-sm">
                <div className="w-8 h-8 rounded-xl bg-red-600 text-white flex items-center justify-center font-black text-base shrink-0 shadow-md">
                  1
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-xs sm:text-sm font-black text-red-200 uppercase tracking-wide">
                    ¡Saca la sartén del fuego ya!
                  </h3>
                  <p className="text-xs text-stone-200 font-medium leading-relaxed mt-0.5">
                    Muévela a una hornalla apagada o sobre una tabla de madera. <strong>Apaga la perilla de gas de inmediato.</strong>
                  </p>
                </div>
              </div>

              {/* PASO 2: Regla de Oro Crítica */}
              <div className="p-3.5 rounded-2xl bg-gradient-to-r from-amber-950/80 to-stone-900 border-2 border-amber-500/90 flex items-start gap-3 shadow-md">
                <div className="w-8 h-8 rounded-xl bg-amber-500 text-stone-950 flex items-center justify-center font-black text-base shrink-0 shadow-md">
                  2
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs sm:text-sm font-black text-amber-300 uppercase tracking-wide">
                      Regla de Oro: No raspes el fondo
                    </span>
                    <span className="text-[10px] bg-red-600 text-white px-1.5 py-0.2 rounded font-bold uppercase">
                      Crítico
                    </span>
                  </div>
                  <p className="text-xs text-stone-200 font-medium leading-relaxed mt-0.5">
                    Jamás pases la cuchara por el fondo tostado. Rasparlo desprende carbón y amargura que arruinarán el 90% de la comida que aún está rica arriba.
                  </p>
                </div>
              </div>

              {/* PASO 3: Trasvase & Enfriamiento */}
              <div className="p-3.5 rounded-2xl bg-gradient-to-r from-blue-950/70 to-stone-900 border border-blue-500/70 flex items-start gap-3 shadow-sm">
                <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black text-base shrink-0 shadow-md">
                  3
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-xs sm:text-sm font-black text-blue-200 uppercase tracking-wide">
                    Cambia de olla y frena el hervor
                  </h3>
                  <p className="text-xs text-stone-200 font-medium leading-relaxed mt-0.5">
                    Traspasa solo la capa superior sana a una olla limpia. Agrega <strong>2 cucharadas de agua tibia, caldo o chorrito de leche</strong> para frenar el calor residual violento.
                  </p>
                </div>
              </div>

            </div>
          </div>

          {/* SECCIÓN 2: BOTONES DE DIAGNÓSTICO RÁPIDO A 1 TOQUE */}
          <div className="pt-1 space-y-2">
            <span className="text-[11px] uppercase tracking-wider font-extrabold text-stone-300 font-serif block">
              💡 Diagnóstico Rápido: ¿Cuál es el problema exacto?
            </span>

            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setActiveDiagnostic('quemado')}
                className={`p-2.5 rounded-2xl border text-center transition cursor-pointer flex flex-col items-center gap-1 active:scale-97 ${
                  activeDiagnostic === 'quemado'
                    ? 'bg-amber-500/20 border-amber-400 text-amber-200 ring-2 ring-amber-400/40 font-bold'
                    : 'bg-stone-800/80 border-stone-700 text-stone-300 hover:bg-stone-800 font-medium'
                }`}
              >
                <span className="text-lg">🔥</span>
                <span className="text-xs leading-tight">Sabor a quemado</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveDiagnostic('salado')}
                className={`p-2.5 rounded-2xl border text-center transition cursor-pointer flex flex-col items-center gap-1 active:scale-97 ${
                  activeDiagnostic === 'salado'
                    ? 'bg-blue-500/20 border-blue-400 text-blue-200 ring-2 ring-blue-400/40 font-bold'
                    : 'bg-stone-800/80 border-stone-700 text-stone-300 hover:bg-stone-800 font-medium'
                }`}
              >
                <span className="text-lg">🧂</span>
                <span className="text-xs leading-tight">Se pasó de sal</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveDiagnostic('seco')}
                className={`p-2.5 rounded-2xl border text-center transition cursor-pointer flex flex-col items-center gap-1 active:scale-97 ${
                  activeDiagnostic === 'seco'
                    ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200 ring-2 ring-emerald-400/40 font-bold'
                    : 'bg-stone-800/80 border-stone-700 text-stone-300 hover:bg-stone-800 font-medium'
                }`}
              >
                <span className="text-lg">💧</span>
                <span className="text-xs leading-tight">Se secó el guiso</span>
              </button>
            </div>

            {/* TARJETA DE SOLUCIÓN EXPRÉS SEGÚN DIAGNÓSTICO */}
            <div className="p-3.5 rounded-2xl bg-stone-800/90 border border-stone-700 text-xs text-stone-200 animate-fade-in shadow-inner">
              {activeDiagnostic === 'quemado' && (
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-amber-300 text-xs">
                    <span>✨ Tip de Chef contra el sabor a tostado:</span>
                  </div>
                  <p className="leading-relaxed text-stone-300">
                    Añade una <strong>pizca de azúcar (1/4 de cucharadita)</strong>, <strong>unas gotas de limón fresco</strong> o introduce <strong>una rodaja gruesa de papa cruda</strong> en el guiso durante 5 minutos para que actúe como esponja absorbiendo el olor antes de servir.
                  </p>
                </div>
              )}

              {activeDiagnostic === 'salado' && (
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-blue-300 text-xs">
                    <span>✨ Tip de Chef para rescatar exceso de sal:</span>
                  </div>
                  <p className="leading-relaxed text-stone-300">
                    Pela <strong>media papa cruda</strong> y córtala en cubos grandes dentro de la olla: el almidón absorberá la salinidad sobrante mientras hierve 6 minutos. Si es salsa, añade 3 cucharadas de crema, leche o agua tibia sin salar.
                  </p>
                </div>
              )}

              {activeDiagnostic === 'seco' && (
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-emerald-300 text-xs">
                    <span>✨ Tip de Chef si se evaporó el caldo:</span>
                  </div>
                  <p className="leading-relaxed text-stone-300">
                    Vierte <strong>agua hirviendo o caldo caliente poco a poco</strong> (1/4 de taza a la vez), <strong>nunca agua fría de golpe</strong> porque rompería la cocción de las verduras o endurecería la carne. Tapa y cocina a FUEGO MÍNIMO.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* ASISTENTE DE VOZ SECUNDARIO (SI DESEA CONVERSAR) */}
          {onOpenVoiceAssistant && (
            <div className="pt-1">
              <button
                type="button"
                onClick={() => {
                  stopSpeaking();
                  onOpenVoiceAssistant();
                }}
                className="w-full py-2.5 px-4 bg-stone-800 hover:bg-stone-750 text-stone-300 hover:text-white rounded-2xl text-xs font-semibold flex items-center justify-center gap-2 border border-stone-700 transition cursor-pointer"
              >
                <Mic className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                <span>¿Dudas extra? Consulta por voz con Chef Cero</span>
              </button>
            </div>
          )}

        </div>

        {/* FOOTER DE SALIDA RÁPIDA: "RESPIRAR Y REANUDAR" */}
        <div className="bg-stone-950 p-4 border-t border-stone-800 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="text-[11px] text-stone-400 flex items-center gap-1.5 text-center sm:text-left">
            <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>Respira: el 95% de los incidentes en sartén se salvan a tiempo.</span>
          </div>

          <button
            type="button"
            onClick={handleResume}
            className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg transition active:scale-97 cursor-pointer"
          >
            <Check className="w-4 h-4 stroke-[3]" />
            <span>✓ Respirar y Reanudar Cocina</span>
          </button>
        </div>

      </div>
    </div>
  );
};
