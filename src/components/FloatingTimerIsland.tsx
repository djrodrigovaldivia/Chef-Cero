import React, { useState } from 'react';
import { Play, Pause, X, RotateCcw, Bell, ChevronUp, ChevronDown, Flame, VolumeX, AlertTriangle } from 'lucide-react';
import { ActiveTimer } from '../types';

interface FloatingTimerIslandProps {
  activeTimers: ActiveTimer[];
  onTogglePause: (timerId: string) => void;
  onRemoveTimer: (timerId: string) => void;
  onResetTimer: (timerId: string) => void;
  onStopAlarm?: () => void;
  isAlarmPlaying?: boolean;
}

export const FloatingTimerIsland: React.FC<FloatingTimerIslandProps> = ({
  activeTimers,
  onTogglePause,
  onRemoveTimer,
  onResetTimer,
  onStopAlarm,
  isAlarmPlaying = false,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  // Si no hay temporizadores activos ni alarma sonando, no renderizar nada
  if (!activeTimers || activeTimers.length === 0) return null;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const hasExpiredTimer = activeTimers.some((t) => t.remainingSeconds <= 0) || isAlarmPlaying;
  const expiredTimer = activeTimers.find((t) => t.remainingSeconds <= 0);
  const hasThirtySecWarning = !hasExpiredTimer && activeTimers.some((t) => t.remainingSeconds > 0 && t.remainingSeconds <= 30 && t.isRunning);

  return (
    <div className="fixed top-16 sm:top-20 left-1/2 -translate-x-1/2 z-50 max-w-md w-[94%] sm:w-auto animate-fade-in pointer-events-auto shadow-2xl">
      <div
        className={`backdrop-blur-md rounded-2xl border transition-all duration-300 ${
          hasExpiredTimer
            ? 'bg-rose-950/95 text-white border-rose-500 ring-4 ring-rose-500/50 shadow-rose-900/60'
            : hasThirtySecWarning
            ? 'bg-amber-950/95 text-amber-100 border-amber-400 ring-4 ring-amber-400/50 animate-pulse'
            : 'bg-stone-900/95 text-white border-stone-700 ring-1 ring-stone-800'
        }`}
      >
        {/* Banner de ALARMA INSISTENTE ACTIVA si hay un temporizador en 00:00 */}
        {hasExpiredTimer && (
          <div className="bg-rose-600 px-4 py-2.5 rounded-t-2xl flex items-center justify-between gap-3 text-white animate-pulse">
            <div className="flex items-center gap-2 min-w-0">
              <AlertTriangle className="w-5 h-5 shrink-0 animate-bounce" />
              <div className="truncate">
                <span className="text-xs font-black uppercase tracking-wider block">¡TIEMPO CUMPLIDO!</span>
                <span className="text-[11px] text-rose-100 truncate block">
                  {expiredTimer ? `${expiredTimer.label} listo en la hornalla` : 'Retira tu sartén del fuego'}
                </span>
              </div>
            </div>

            {onStopAlarm && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onStopAlarm();
                }}
                className="px-3.5 py-1.5 bg-white hover:bg-rose-50 text-rose-700 text-xs font-black rounded-xl shadow-lg flex items-center gap-1.5 transition active:scale-95 cursor-pointer shrink-0"
              >
                <VolumeX className="w-4 h-4 stroke-[3]" />
                <span>DETENER ALARMA</span>
              </button>
            )}
          </div>
        )}

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
                  : hasThirtySecWarning
                  ? 'bg-amber-400 text-stone-950 animate-ping'
                  : 'bg-amber-500 text-stone-950'
              }`}
            >
              <Bell className="w-3.5 h-3.5" />
            </div>

            <div className="flex items-center gap-2 truncate">
              {hasThirtySecWarning && (
                <span className="text-[11px] bg-amber-400 text-stone-950 font-black px-2 py-0.5 rounded-md uppercase tracking-wider shrink-0">
                  ⚠️ Faltan 30s
                </span>
              )}
              {activeTimers.slice(0, 2).map((t) => (
                <div key={t.id} className="flex items-center gap-1.5 text-xs truncate">
                  <span className="font-semibold text-stone-300 truncate max-w-[90px]">
                    {t.label}:
                  </span>
                  <span
                    className={`font-mono font-black ${
                      t.remainingSeconds <= 0
                        ? 'text-rose-400 animate-pulse text-sm'
                        : 'text-amber-400 text-sm'
                    }`}
                  >
                    {t.remainingSeconds <= 0 ? '00:00' : formatTime(t.remainingSeconds)}
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
          <div className="p-3 pt-0 border-t border-stone-800 space-y-2 mt-1 max-h-64 overflow-y-auto">
            {activeTimers.map((timer) => {
              const progressPct = Math.max(
                0,
                Math.min(100, (timer.remainingSeconds / (timer.totalSeconds || 1)) * 100)
              );
              return (
                <div
                  key={timer.id}
                  className={`p-2.5 rounded-xl border flex items-center justify-between gap-3 text-xs ${
                    timer.remainingSeconds <= 0
                      ? 'bg-rose-950/70 border-rose-500 text-white'
                      : 'bg-stone-800/80 border-stone-700/80'
                  }`}
                >
                  <div className="truncate flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-stone-200 truncate">{timer.label}</span>
                      <span
                        className={`font-mono font-black text-sm ${
                          timer.remainingSeconds <= 0 ? 'text-rose-400 animate-pulse' : 'text-amber-400'
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
                    {timer.remainingSeconds > 0 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onTogglePause(timer.id);
                        }}
                        className="p-1.5 bg-stone-700 hover:bg-stone-600 rounded-lg text-stone-200 transition cursor-pointer"
                        title={timer.isRunning ? 'Pausar' : 'Reanudar'}
                      >
                        {timer.isRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                      </button>
                    )}

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onResetTimer(timer.id);
                      }}
                      className="p-1.5 bg-stone-700 hover:bg-stone-600 rounded-lg text-stone-300 transition cursor-pointer"
                      title="Reiniciar"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveTimer(timer.id);
                      }}
                      className="p-1.5 bg-stone-700 hover:bg-rose-900/60 text-stone-400 hover:text-rose-300 rounded-lg transition cursor-pointer"
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
