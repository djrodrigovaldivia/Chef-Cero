import React, { useState, useEffect, useRef } from 'react';
import { VolumeX, Volume2, X, RotateCcw, MessageSquare, ShieldAlert, Sparkles, ChefHat } from 'lucide-react';
import { SubtitleItem, subscribeToSubtitles, clearActiveSubtitle, speakSpanishText } from '../utils/audioAlert';
import { useSilentMode } from '../utils/useSilentMode';

export const AccessibleSubtitles: React.FC = () => {
  const [subtitle, setSubtitle] = useState<SubtitleItem | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [fontSize, setFontSize] = useState<'normal' | 'large'>('normal');
  const { isSilent, toggleSilentMode } = useSilentMode();
  const pauseRef = useRef(isPaused);
  pauseRef.current = isPaused;

  useEffect(() => {
    const unsubscribe = subscribeToSubtitles((newSubtitle) => {
      setSubtitle(newSubtitle);
    });
    return unsubscribe;
  }, []);

  if (!subtitle) {
    return null;
  }

  const isEmergency = subtitle.isEmergency;

  const handleReplay = () => {
    // Si no está en silencio, reproducir por voz; si está en silencio, renovar el tiempo del subtítulo
    speakSpanishText(subtitle.text, {
      speaker: subtitle.speaker,
      badge: isSilent ? 'Repetición en Silencio' : 'Repitiendo voz',
      isEmergency: subtitle.isEmergency,
    });
  };

  return (
    <aside
      id="accessible-subtitles-bar"
      role="region"
      aria-label="Subtítulos e instrucciones en pantalla"
      className="fixed bottom-20 sm:bottom-6 left-3 right-3 sm:left-1/2 sm:-translate-x-1/2 sm:max-w-2xl z-40 animate-fade-in"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div
        className={`relative overflow-hidden rounded-2xl shadow-2xl border backdrop-blur-md transition-all ${
          isEmergency
            ? 'bg-red-950/95 border-red-500/80 text-white ring-2 ring-red-400/40'
            : 'bg-stone-950/95 border-stone-700/80 text-stone-100 ring-2 ring-amber-400/20'
        }`}
      >
        {/* Header del Subtítulo */}
        <div className="px-4 py-2.5 bg-white/5 border-b border-white/10 flex items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <div
              className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${
                isEmergency
                  ? 'bg-red-600 text-white'
                  : 'bg-amber-500 text-stone-950 font-bold'
              }`}
            >
              {isEmergency ? (
                <ShieldAlert className="w-3.5 h-3.5" />
              ) : (
                <ChefHat className="w-3.5 h-3.5" />
              )}
            </div>

            <span className="font-extrabold tracking-wide uppercase text-[11px] text-amber-300">
              {subtitle.speaker}
            </span>

            {subtitle.badge && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/10 text-stone-300 border border-white/10">
                {subtitle.badge}
              </span>
            )}

            {isSilent && (
              <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-400/20 text-amber-300 border border-amber-400/30">
                <VolumeX className="w-2.5 h-2.5" />
                <span>Modo Silencioso</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-1 text-stone-400">
            {/* Alternar tamaño de letra para accesibilidad visual */}
            <button
              onClick={() => setFontSize(fontSize === 'normal' ? 'large' : 'normal')}
              className="px-2 py-1 rounded-md hover:bg-white/10 text-stone-300 text-[10px] font-bold transition"
              title="Cambiar tamaño de texto del subtítulo"
              aria-label="Cambiar tamaño del texto"
            >
              {fontSize === 'normal' ? 'A+' : 'A-'}
            </button>

            {/* Alternador rápido de modo silencioso */}
            <button
              onClick={toggleSilentMode}
              className={`p-1.5 rounded-md hover:bg-white/10 transition ${
                isSilent ? 'text-amber-400' : 'text-stone-400'
              }`}
              title={isSilent ? 'Modo Silencioso activo (toca para activar voz)' : 'Voz activa (toca para silenciar)'}
              aria-label={isSilent ? 'Activar voz' : 'Activar modo silencioso'}
            >
              {isSilent ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
            </button>

            {/* Repetir lectura */}
            <button
              onClick={handleReplay}
              className="p-1.5 rounded-md hover:bg-white/10 text-stone-300 hover:text-white transition"
              title="Volver a leer / reiniciar subtítulo"
              aria-label="Repetir instrucción"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>

            {/* Cerrar subtítulo */}
            <button
              onClick={clearActiveSubtitle}
              className="p-1.5 rounded-md hover:bg-white/10 text-stone-400 hover:text-white transition ml-1"
              aria-label="Cerrar subtítulos"
              title="Cerrar subtítulo"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Cuerpo del Subtítulo (Accesible para lectores de pantalla) */}
        <div
          className="p-4"
          role="status"
          aria-live={isEmergency ? 'assertive' : 'polite'}
        >
          <p
            className={`font-medium tracking-normal text-stone-100 ${
              fontSize === 'large'
                ? 'text-base sm:text-lg leading-relaxed'
                : 'text-sm sm:text-base leading-snug'
            }`}
          >
            {subtitle.text}
          </p>
        </div>

        {/* Barra de progreso de lectura (se pausa si el cursor está encima para lectura tranquila) */}
        <div className="w-full h-1 bg-white/10 overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${
              isEmergency ? 'bg-red-400' : 'bg-amber-400'
            }`}
            style={{
              width: isPaused ? '100%' : '100%',
              animation: isPaused
                ? 'none'
                : `shrinkWidth ${subtitle.durationMs}ms linear forwards`,
            }}
          />
        </div>
      </div>

      <style>{`
        @keyframes shrinkWidth {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
    </aside>
  );
};
