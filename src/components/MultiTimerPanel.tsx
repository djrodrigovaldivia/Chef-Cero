import React, { useState, useEffect } from 'react';
import { ParallelTimer } from '../types';
import { Play, Pause, RotateCcw, Plus, Trash2, Bell, Flame, ChevronDown, ChevronUp } from 'lucide-react';

interface MultiTimerPanelProps {
  initialTimers?: { label: string; seconds: number; color?: string; station?: ParallelTimer['associatedStation'] }[];
  onTimerComplete?: (timerLabel: string) => void;
}

export const MultiTimerPanel: React.FC<MultiTimerPanelProps> = ({
  onTimerComplete,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [timers, setTimers] = useState<ParallelTimer[]>([
    {
      id: 'timer-hornalla-1',
      label: 'Hornalla Principal',
      totalSeconds: 300,
      remainingSeconds: 300,
      isRunning: false,
      color: '#f59e0b',
      associatedStation: 'fuegos',
    },
    {
      id: 'timer-pasta-arroz',
      label: 'Agua / Pasta / Arroz',
      totalSeconds: 600,
      remainingSeconds: 600,
      isRunning: false,
      color: '#3b82f6',
      associatedStation: 'pasta_arroz',
    },
  ]);

  const [newTimerLabel, setNewTimerLabel] = useState('');
  const [newTimerMinutes, setNewTimerMinutes] = useState('5');

  // Intervalo global de precisión para todos los temporizadores activos
  useEffect(() => {
    const hasRunning = timers.some((t) => t.isRunning);
    if (!hasRunning) return;

    const interval = setInterval(() => {
      setTimers((prev) =>
        prev.map((timer) => {
          if (!timer.isRunning) return timer;
          if (timer.remainingSeconds <= 1) {
            // Sonar alarma / aviso
            try {
              const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
              const osc = audioCtx.createOscillator();
              const gain = audioCtx.createGain();
              osc.type = 'sine';
              osc.frequency.setValueAtTime(880, audioCtx.currentTime); // La5
              gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
              osc.connect(gain);
              gain.connect(audioCtx.destination);
              osc.start();
              osc.stop(audioCtx.currentTime + 0.8);
            } catch (e) {
              console.warn('AudioContext alert failed:', e);
            }

            if (onTimerComplete && !timer.soundTriggered) {
              onTimerComplete(timer.label);
            }

            return {
              ...timer,
              remainingSeconds: 0,
              isRunning: false,
              soundTriggered: true,
            };
          }
          return {
            ...timer,
            remainingSeconds: timer.remainingSeconds - 1,
          };
        })
      );
    }, 1000);

    return () => clearInterval(interval);
  }, [timers, onTimerComplete]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const toggleTimer = (id: string) => {
    setTimers((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t;
        if (t.remainingSeconds === 0) {
          return { ...t, remainingSeconds: t.totalSeconds, isRunning: true, soundTriggered: false };
        }
        return { ...t, isRunning: !t.isRunning };
      })
    );
  };

  const resetTimer = (id: string) => {
    setTimers((prev) =>
      prev.map((t) => (t.id === id ? { ...t, remainingSeconds: t.totalSeconds, isRunning: false, soundTriggered: false } : t))
    );
  };

  const addSeconds = (id: string, secs: number) => {
    setTimers((prev) =>
      prev.map((t) =>
        t.id === id
          ? {
              ...t,
              remainingSeconds: Math.max(0, t.remainingSeconds + secs),
              totalSeconds: Math.max(t.totalSeconds, t.remainingSeconds + secs),
            }
          : t
      )
    );
  };

  const deleteTimer = (id: string) => {
    setTimers((prev) => prev.filter((t) => t.id !== id));
  };

  const handleCreateCustomTimer = (e: React.FormEvent) => {
    e.preventDefault();
    const mins = parseFloat(newTimerMinutes);
    if (isNaN(mins) || mins <= 0) return;
    const secs = Math.round(mins * 60);
    const newTimer: ParallelTimer = {
      id: 'custom-' + Date.now(),
      label: newTimerLabel.trim() || `Alarma ${timers.length + 1}`,
      totalSeconds: secs,
      remainingSeconds: secs,
      isRunning: true,
      color: '#10b981',
      associatedStation: 'fuegos',
    };
    setTimers((prev) => [...prev, newTimer]);
    setNewTimerLabel('');
    setNewTimerMinutes('5');
  };

  const runningCount = timers.filter((t) => t.isRunning).length;

  return (
    <div className="bg-stone-900 text-stone-100 rounded-2xl border border-stone-700/80 shadow-lg overflow-hidden transition-all duration-300">
      {/* Header colapsable */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-3.5 sm:p-4 bg-gradient-to-r from-stone-900 via-stone-850 to-stone-900 flex items-center justify-between gap-3 text-left cursor-pointer hover:bg-stone-800/80 transition"
      >
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <Flame className="w-5 h-5 text-amber-400" />
            {runningCount > 0 && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-rose-500 rounded-full animate-ping" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-xs sm:text-sm text-stone-100 font-mono tracking-tight">
                Estación Multitarea: Temporizadores Simultáneos
              </span>
              <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold px-2 py-0.2 rounded-full font-mono">
                {timers.length} activos
              </span>
            </div>
            <p className="text-[11px] text-stone-400 mt-0.5 hidden sm:block">
              Controla pasta hirviendo, sofrito en sartén y horno a la vez sin quemar nada.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {runningCount > 0 && (
            <span className="text-xs bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-lg font-bold flex items-center gap-1 font-mono">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              {runningCount} corriendo
            </span>
          )}
          {isExpanded ? <ChevronUp className="w-4 h-4 text-stone-400" /> : <ChevronDown className="w-4 h-4 text-stone-400" />}
        </div>
      </button>

      {/* Vista Rápida compacta cuando está contraído */}
      {!isExpanded && timers.length > 0 && (
        <div className="px-3.5 pb-3 pt-1 flex items-center gap-2 overflow-x-auto border-t border-stone-800/80 scrollbar-none">
          {timers.map((timer) => (
            <div
              key={timer.id}
              onClick={() => toggleTimer(timer.id)}
              className={`px-3 py-1.5 rounded-xl border text-xs font-mono font-bold flex items-center gap-2 cursor-pointer transition whitespace-nowrap ${
                timer.isRunning
                  ? 'bg-amber-500/10 border-amber-500 text-amber-300 shadow-xs'
                  : timer.remainingSeconds === 0
                  ? 'bg-rose-500/20 border-rose-500 text-rose-300 animate-pulse'
                  : 'bg-stone-800/70 border-stone-700 text-stone-300 hover:border-stone-600'
              }`}
            >
              <span className="truncate max-w-[120px]">{timer.label}:</span>
              <span className="text-sm font-black">{formatTime(timer.remainingSeconds)}</span>
              {timer.isRunning ? <Pause className="w-3 h-3 text-amber-400" /> : <Play className="w-3 h-3 text-stone-400" />}
            </div>
          ))}
        </div>
      )}

      {/* Contenido Completo Expandido */}
      {isExpanded && (
        <div className="p-3.5 sm:p-5 border-t border-stone-800 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {timers.map((timer) => {
              const progress = timer.totalSeconds > 0
                ? ((timer.totalSeconds - timer.remainingSeconds) / timer.totalSeconds) * 100
                : 0;

              return (
                <div
                  key={timer.id}
                  className={`p-3.5 rounded-2xl border transition relative overflow-hidden flex flex-col justify-between ${
                    timer.remainingSeconds === 0
                      ? 'bg-rose-950/40 border-rose-500 shadow-md ring-1 ring-rose-500/50'
                      : timer.isRunning
                      ? 'bg-stone-800/90 border-amber-500/60 shadow-md'
                      : 'bg-stone-800/50 border-stone-700/80'
                  }`}
                >
                  {/* Barra de progreso de fondo */}
                  <div
                    className="absolute bottom-0 left-0 top-0 bg-white/5 pointer-events-none transition-all duration-1000"
                    style={{ width: `${progress}%` }}
                  />

                  <div className="flex items-center justify-between gap-2 mb-2 relative z-10">
                    <span className="font-bold text-xs text-stone-200 truncate flex items-center gap-1.5">
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: timer.color || '#f59e0b' }}
                      />
                      {timer.label}
                    </span>
                    <button
                      onClick={() => deleteTimer(timer.id)}
                      className="p-1 hover:bg-stone-700 text-stone-400 hover:text-rose-400 rounded-lg transition"
                      title="Eliminar este temporizador"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="text-3xl font-black font-mono tracking-tight text-white mb-3 relative z-10">
                    {formatTime(timer.remainingSeconds)}
                    {timer.remainingSeconds === 0 && (
                      <span className="text-xs font-bold text-rose-400 ml-2 animate-bounce inline-flex items-center gap-1">
                        <Bell className="w-3.5 h-3.5" /> ¡LISTO!
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 relative z-10">
                    <button
                      onClick={() => toggleTimer(timer.id)}
                      className={`flex-1 py-1.5 px-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer ${
                        timer.isRunning
                          ? 'bg-amber-500 hover:bg-amber-600 text-stone-950 font-black'
                          : 'bg-stone-700 hover:bg-stone-600 text-white'
                      }`}
                    >
                      {timer.isRunning ? (
                        <>
                          <Pause className="w-3.5 h-3.5" /> Pausar
                        </>
                      ) : (
                        <>
                          <Play className="w-3.5 h-3.5" /> Iniciar
                        </>
                      )}
                    </button>

                    <button
                      onClick={() => resetTimer(timer.id)}
                      className="p-2 rounded-xl bg-stone-700/80 hover:bg-stone-600 text-stone-300 hover:text-white transition cursor-pointer"
                      title="Reiniciar a tiempo base"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => addSeconds(timer.id, 60)}
                      className="px-2 py-1.5 rounded-xl bg-stone-700/80 hover:bg-stone-600 text-stone-300 font-mono text-xs font-bold transition cursor-pointer"
                      title="Sumar 1 minuto"
                    >
                      +1m
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Formulario para agregar nuevo temporizador multitarea */}
          <form
            onSubmit={handleCreateCustomTimer}
            className="pt-3 border-t border-stone-800 flex flex-col sm:flex-row items-center gap-2"
          >
            <input
              type="text"
              value={newTimerLabel}
              onChange={(e) => setNewTimerLabel(e.target.value)}
              placeholder="Nombre del proceso (ej: Reducción de vino, Reposo carne...)"
              className="flex-1 w-full bg-stone-800 border border-stone-700 px-3 py-2 rounded-xl text-xs text-white placeholder:text-stone-500 focus:outline-none focus:border-amber-400 font-medium"
            />
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <input
                type="number"
                min="0.5"
                max="180"
                step="0.5"
                value={newTimerMinutes}
                onChange={(e) => setNewTimerMinutes(e.target.value)}
                placeholder="Minutos"
                className="w-20 bg-stone-800 border border-stone-700 px-2.5 py-2 rounded-xl text-xs text-white text-center font-mono font-bold focus:outline-none focus:border-amber-400"
              />
              <span className="text-xs text-stone-400 font-medium shrink-0">min</span>

              <button
                type="submit"
                className="px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-stone-950 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition cursor-pointer shrink-0 ml-auto"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Crear Alarma</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
