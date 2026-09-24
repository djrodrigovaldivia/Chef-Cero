import React, { useState } from 'react';
import { Play, Pause, X, RotateCcw, Bell, ChevronUp, ChevronDown, Flame } from 'lucide-react';
import { ActiveTimer } from '../types';

interface FloatingTimerIslandProps {
  activeTimers: ActiveTimer[];
  onTogglePause: (timerId: string) => void;
  onRemoveTimer: (timerId: string) => void;
  onResetTimer: (timerId: string) => void;
}

export const FloatingTimerIsland: React.FC<FloatingTimerIslandProps> = ({
  activeTimers,
  onTogglePause,
  onRemoveTimer,
  onResetTimer,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  // Si no hay temporizadores activos, no renderizar nada
  if (!activeTimers || activeTimers.length === 0) return null;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const hasExpiredTimer = activeTimers.some((t) => t.remainingSeconds <= 0);

  return (
    <div className="fixed top-20 left-1/2 -translate-x-1/2 z-40 max-w-md w-[92%] sm:w-auto animate-fade-in pointer-events-auto">
      <div
        className={`bg-stone-900/95 backdrop-blur-md text-white rounded-2xl shadow-2xl border transition-all duration-300 ${
          hasExpiredTimer
            ? 'border-rose-500 ring-4 ring-rose-500/40 animate-pulse'
            : 'border-stone-700 ring-1 ring-stone-800'
        }`}
      >
        {/* Cabecera compacta o modo colapsado */}
        <div
          onClick={() => setIsExpanded(!isExpanded)}
          className="px-3.5 py-2.5 flex items-center justify-between gap-3 cursor-pointer select-none"
        >
          <div className="flex items-center gap-2 truncate">
            <div
              className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-bold ${
                hasExpiredTimer
                  ? 'bg-rose-600 text-white animate-bounce'
                  : 'bg-amber-500 text-stone-950'
              }`}
            >
              <Bell className="w-3.5 h-3.5" />
            </div>

            <div className="flex items-center gap-2 truncate">
              {activeTimers.slice(0, 2).map((t) => (
                <div key={t.id} className="flex items-center gap-1.5 text-xs truncate">
                  <span className="font-semibold text-stone-300 truncate max-w-[90px]">
                    {t.label}:
                  </span>
                  <span
                    className={`font-mono font-black ${
                      t.remainingSeconds <= 0
                        ? 'text-rose-400 animate-pulse'
                        : 'text-amber-400'
                    }`}
                  >
                    {t.remainingSeconds <= 0 ? '¡Listo!' : formatTime(t.remainingSeconds)}
                  </span>
                </div>
              ))}
              {activeTimers.length > 2 && (
                <span className="text-[10px] text-stone-400 font-bold">
                  +{activeTimers.length - 2}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-stone-400 text-xs shrink-0 pl-2">
            <span className="text-[10px] hidden sm:inline font-medium">
              {isExpanded ? 'Ocultar' : 'Ver todo'}
            </span>
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </div>

        {/* Vista Desplegada con Control de Cada Temporizador */}
        {isExpanded && (
          <div className="p-3 pt-0 border-t border-stone-800 space-y-2 mt-1 max-h-60 overflow-y-auto">
            {activeTimers.map((timer) => {
              const progressPct = Math.max(
                0,
                Math.min(100, (timer.remainingSeconds / (timer.totalSeconds || 1)) * 100)
              );
              return (
                <div
                  key={timer.id}
                  className="bg-stone-800/80 p-2.5 rounded-xl border border-stone-700/80 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="truncate flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-stone-200 truncate">{timer.label}</span>
                      <span
                        className={`font-mono font-black text-sm ${
                          timer.remainingSeconds <= 0 ? 'text-rose-400' : 'text-amber-400'
                        }`}
                      >
                        {formatTime(timer.remainingSeconds)}
                      </span>
                    </div>

                    {/* Barra de progreso */}
                    <div className="w-full bg-stone-700 h-1.5 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-500 rounded-full ${
                          timer.remainingSeconds <= 0 ? 'bg-rose-500' : 'bg-amber-400'
                        }`}
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onTogglePause(timer.id);
                      }}
                      className="p-1.5 bg-stone-700 hover:bg-stone-600 rounded-lg text-stone-200 transition"
                      title={timer.isRunning ? 'Pausar' : 'Reanudar'}
                    >
                      {timer.isRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onResetTimer(timer.id);
                      }}
                      className="p-1.5 bg-stone-700 hover:bg-stone-600 rounded-lg text-stone-300 transition"
                      title="Reiniciar"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveTimer(timer.id);
                      }}
                      className="p-1.5 bg-stone-700 hover:bg-rose-900/60 text-stone-400 hover:text-rose-300 rounded-lg transition"
                      title="Eliminar"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
