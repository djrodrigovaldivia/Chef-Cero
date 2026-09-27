import React, { useEffect } from 'react';
import {
  X, ChevronLeft, ChevronRight, Clock, Flame, ShieldAlert,
  Volume2, VolumeX, Mic, MicOff, CheckCircle2, RotateCcw, AlertCircle
} from 'lucide-react';
import { Recipe, RecipeStep, ActiveTimer } from '../types';
import { InteractiveInstructionText } from './InteractiveInstructionText';
import { speakSpanishText } from '../utils/audioAlert';

interface ImmersiveCookModeModalProps {
  recipe: Recipe;
  currentStepIndex: number;
  totalSteps: number;
  currentStep: RecipeStep;
  activeTimers: ActiveTimer[];
  isHandsFreeActive: boolean;
  isSilent: boolean;
  onNextStep: () => void;
  onPrevStep: () => void;
  onClose: () => void;
  onStartTimer: (seconds: number, label: string, stepIndex?: number) => void;
  onToggleHandsFree: () => void;
  onToggleSilent: () => void;
  onOpenEmergency: () => void;
}

/**
 * Modo Cocina Inmersivo a Pantalla Completa inspirado en "Cook Mode" de NYT Cooking.
 * Máxima legibilidad a distancia (60-100 cm), controles táctiles masivos y cero distracciones.
 */
export const ImmersiveCookModeModal: React.FC<ImmersiveCookModeModalProps> = ({
  recipe,
  currentStepIndex,
  totalSteps,
  currentStep,
  activeTimers,
  isHandsFreeActive,
  isSilent,
  onNextStep,
  onPrevStep,
  onClose,
  onStartTimer,
  onToggleHandsFree,
  onToggleSilent,
  onOpenEmergency,
}) => {
  // Manejo de teclas de flechas (Izquierda = Anterior, Derecha = Siguiente, Esc = Salir)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' && currentStepIndex < totalSteps - 1) {
        onNextStep();
      } else if (e.key === 'ArrowLeft' && currentStepIndex > 0) {
        onPrevStep();
      } else if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentStepIndex, totalSteps, onNextStep, onPrevStep, onClose]);

  const progressPercent = Math.round(((currentStepIndex + 1) / totalSteps) * 100);

  const activeStepTimer = activeTimers.find(
    (t) => t.stepIndex === currentStep.stepNumber || t.label.includes(`Paso ${currentStep.stepNumber}`)
  );

  return (
    <div className="fixed inset-0 z-50 bg-stone-950 text-stone-100 flex flex-col justify-between select-none animate-fade-in">
      {/* 1. Barra Superior Compacta con Progreso y Salida */}
      <div className="px-4 py-3 sm:px-8 border-b border-stone-800 bg-stone-900/90 backdrop-blur-md flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 transition"
            title="Salir de pantalla completa (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="truncate">
            <h2 className="text-xs sm:text-sm font-bold text-stone-200 truncate font-serif">
              {recipe.title}
            </h2>
            <div className="text-[11px] text-amber-400 font-semibold flex items-center gap-2">
              <span>Paso {currentStepIndex + 1} de {totalSteps}</span>
              <span className="text-stone-600">·</span>
              <span>{progressPercent}% completado</span>
            </div>
          </div>
        </div>

        {/* Controles de Voz & Emergencia */}
        <div className="flex items-center gap-2">
          {/* Manos Libres */}
          <button
            onClick={onToggleHandsFree}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition ${
              isHandsFreeActive
                ? 'bg-amber-500 text-stone-950 ring-2 ring-amber-300 animate-pulse'
                : 'bg-stone-800 hover:bg-stone-700 text-stone-300'
            }`}
          >
            {isHandsFreeActive ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
            <span className="hidden sm:inline">Manos Libres</span>
          </button>

          {/* S.O.S. */}
          <button
            onClick={onOpenEmergency}
            className="px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-black text-xs flex items-center gap-1.5 transition shadow-md"
          >
            <ShieldAlert className="w-4 h-4 animate-bounce" />
            <span>S.O.S.</span>
          </button>
        </div>
      </div>

      {/* Barra de Progreso Superior */}
      <div className="w-full bg-stone-800 h-1.5">
        <div
          className="bg-amber-500 h-full transition-all duration-300 ease-out"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* 2. Cuerpo Central: Tipografía Gigante para leer desde 1 metro de distancia */}
      <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-12 md:px-20 max-w-4xl mx-auto w-full flex flex-col justify-center space-y-6">
        {/* Nivel de Fuego y Título del Paso */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="px-3.5 py-1.5 rounded-full bg-stone-800 border border-stone-700 text-xs font-bold flex items-center gap-2 text-stone-300">
            <Flame
              className={`w-4 h-4 ${
                currentStep.heatLevel === 'alto'
                  ? 'text-red-500'
                  : currentStep.heatLevel === 'medio'
                  ? 'text-amber-500'
                  : currentStep.heatLevel === 'bajo'
                  ? 'text-blue-400'
                  : 'text-stone-400'
              }`}
            />
            <span className="capitalize">Fuego {currentStep.heatLevel || 'adecuado'}</span>
          </div>

          {currentStep.timerSeconds && currentStep.timerSeconds > 0 && (
            <div className="px-3.5 py-1.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-xs font-bold text-amber-300 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-amber-400" />
              <span>{Math.ceil(currentStep.timerSeconds / 60)} min sugeridos</span>
            </div>
          )}

          {/* Botón de lectura de voz */}
          <button
            onClick={() =>
              speakSpanishText(currentStep.instruction, {
                speaker: 'Chef Cero',
                badge: `Paso ${currentStep.stepNumber}`,
              })
            }
            className="px-3 py-1.5 rounded-full bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-semibold flex items-center gap-1.5 transition ml-auto"
          >
            <Volume2 className="w-4 h-4 text-amber-400" />
            <span>Escuchar Paso</span>
          </button>
        </div>

        {/* Título del paso */}
        <h3 className="text-xl sm:text-2xl font-bold text-stone-300 font-serif">
          {currentStep.title}
        </h3>

        {/* INSTRUCCIÓN PRINCIPAL GIGANTE Y ULTRA-LEGIBLE */}
        <div className="bg-stone-900/90 border border-stone-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-4">
          <InteractiveInstructionText
            text={currentStep.instruction}
            stepNumber={currentStep.stepNumber}
            activeTimers={activeTimers}
            onStartTimer={onStartTimer}
            className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-white leading-snug tracking-tight"
          />

          {/* Temporizador Activo Gigante si está corriendo */}
          {activeStepTimer && (
            <div className="mt-4 p-4 rounded-2xl bg-amber-500/20 border border-amber-500/50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Clock className="w-6 h-6 text-amber-400 animate-spin" />
                <div>
                  <span className="text-xs text-stone-400 block font-bold">Temporizador en curso:</span>
                  <span className="text-2xl font-mono font-black text-amber-300">
                    {Math.floor(activeStepTimer.remainingSeconds / 60)}:
                    {(activeStepTimer.remainingSeconds % 60).toString().padStart(2, '0')}
                  </span>
                </div>
              </div>
              <button
                onClick={() => onStartTimer(activeStepTimer.remainingSeconds + 60, activeStepTimer.label, activeStepTimer.stepIndex)}
                className="px-3 py-1.5 rounded-xl bg-amber-500 text-stone-950 font-bold text-xs hover:bg-amber-400"
              >
                +1 min
              </button>
            </div>
          )}
        </div>

        {/* Tip rápido de mentor */}
        {currentStep.tip && (
          <div className="p-4 rounded-2xl bg-stone-900 border border-stone-800 text-sm text-stone-300 flex items-start gap-3">
            <span className="text-lg">💡</span>
            <p className="leading-relaxed">
              <strong className="text-amber-400">Consejo del Chef: </strong>
              {currentStep.tip}
            </p>
          </div>
        )}
      </div>

      {/* 3. Barra Inferior Masiva de Navegación (Fácil de pulsar con codo o nudillos) */}
      <div className="p-4 sm:p-6 border-t border-stone-800 bg-stone-900/90 backdrop-blur-md">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
          <button
            onClick={onPrevStep}
            disabled={currentStepIndex === 0}
            className="h-16 sm:h-18 px-6 sm:px-8 rounded-2xl bg-stone-800 hover:bg-stone-700 disabled:opacity-30 disabled:pointer-events-none text-white font-black text-base sm:text-lg flex items-center gap-3 transition shadow-lg flex-1 justify-center cursor-pointer"
          >
            <ChevronLeft className="w-6 h-6" />
            <span>Paso Anterior</span>
          </button>

          <button
            onClick={onNextStep}
            className={`h-16 sm:h-18 px-6 sm:px-8 rounded-2xl font-black text-base sm:text-lg flex items-center gap-3 transition shadow-xl flex-2 justify-center cursor-pointer ${
              currentStepIndex === totalSteps - 1
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white ring-4 ring-emerald-500/30'
                : 'bg-amber-500 hover:bg-amber-400 text-stone-950 ring-4 ring-amber-400/20'
            }`}
          >
            <span>
              {currentStepIndex === totalSteps - 1 ? '¡Completar y Servir!' : 'Siguiente Paso'}
            </span>
            {currentStepIndex === totalSteps - 1 ? (
              <CheckCircle2 className="w-6 h-6" />
            ) : (
              <ChevronRight className="w-6 h-6" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
