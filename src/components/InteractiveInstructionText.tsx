import React from 'react';
import { Clock, Play, Check } from 'lucide-react';
import { ActiveTimer } from '../types';

interface InteractiveInstructionTextProps {
  text: string;
  stepNumber: number;
  activeTimers: ActiveTimer[];
  onStartTimer: (seconds: number, label: string, stepIndex?: number) => void;
  className?: string;
}

/**
 * Parsea el texto del paso y convierte menciones de tiempo
 * (ej: "4 minutos", "10 min", "45 segundos") en botones interactivos de 1 toque (estilo Kitchen Stories).
 */
export const InteractiveInstructionText: React.FC<InteractiveInstructionTextProps> = ({
  text,
  stepNumber,
  activeTimers,
  onStartTimer,
  className = '',
}) => {
  // Regex para detectar patrones de tiempo: ej: "4 minutos", "2 a 3 minutos", "30 segundos", "1 hora"
  const timeRegex = /(\b\d+(?:\s*(?:a|-)\s*\d+)?\s*(?:minutos|minuto|min|segundos|segundo|seg|horas|hora|h)\b)/gi;

  const parts = text.split(timeRegex);

  const parseSeconds = (timeStr: string): number => {
    const clean = timeStr.toLowerCase().trim();
    // Extraer el número más alto si hay rango (ej: "2 a 3 minutos" -> 3)
    const numbers = clean.match(/\d+/g);
    if (!numbers) return 0;
    const value = parseInt(numbers[numbers.length - 1], 10);

    if (clean.includes('hora') || clean.includes('h')) {
      return value * 3600;
    }
    if (clean.includes('seg')) {
      return value;
    }
    // Por defecto minutos
    return value * 60;
  };

  return (
    <p className={`leading-relaxed text-stone-900 ${className}`}>
      {parts.map((part, index) => {
        const isTimeMatch = timeRegex.test(part);
        // Reset regex index because of /g flag
        timeRegex.lastIndex = 0;

        if (isTimeMatch) {
          const seconds = parseSeconds(part);
          const timerLabel = `Paso ${stepNumber} (${part.trim()})`;
          const activeTimer = activeTimers.find(
            (t) => t.stepIndex === stepNumber || t.label.includes(part.trim())
          );
          const isRunning = activeTimer && activeTimer.remainingSeconds > 0;
          const isDone = activeTimer && activeTimer.remainingSeconds <= 0;

          return (
            <button
              key={index}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (!isRunning && seconds > 0) {
                  onStartTimer(seconds, timerLabel, stepNumber);
                }
              }}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 mx-1 rounded-lg text-xs font-black transition-all cursor-pointer shadow-2xs align-baseline ${
                isRunning
                  ? 'bg-amber-500 text-stone-950 ring-2 ring-amber-400 animate-pulse'
                  : isDone
                  ? 'bg-emerald-600 text-white'
                  : 'bg-amber-100 hover:bg-amber-200 text-amber-950 border border-amber-300 hover:scale-105 active:scale-95'
              }`}
              title={
                isRunning
                  ? `Temporizador activo: restan ${Math.ceil(activeTimer.remainingSeconds / 60)} min`
                  : isDone
                  ? '¡Tiempo completado para este paso!'
                  : `1 Clic: Iniciar temporizador de ${part.trim()}`
              }
            >
              {isRunning ? (
                <>
                  <Clock className="w-3.5 h-3.5 animate-spin" />
                  <span>⏱️ {Math.ceil(activeTimer.remainingSeconds / 60)} min</span>
                </>
              ) : isDone ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>✓ Listo</span>
                </>
              ) : (
                <>
                  <Play className="w-3 h-3 text-amber-800 fill-amber-800" />
                  <span className="underline decoration-amber-400 decoration-2 underline-offset-2">
                    {part.trim()}
                  </span>
                </>
              )}
            </button>
          );
        }

        return <span key={index}>{part}</span>;
      })}
    </p>
  );
};
