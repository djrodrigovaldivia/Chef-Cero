import React, { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Sparkles, Volume2 } from 'lucide-react';
import { audioVisualizerBus } from '../utils/audioVisualizerBus';

interface FloatingVoiceBarProps {
  onOpenVoice: () => void;
  isVoiceOpen?: boolean;
}

export const FloatingVoiceBar: React.FC<FloatingVoiceBarProps> = ({
  onOpenVoice,
  isVoiceOpen = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isMicActive, setIsMicActive] = useState<boolean>(false);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const [audioEnergy, setAudioEnergy] = useState<number>(0);
  const animFrameRef = useRef<number | null>(null);

  // Suscribirse a cambios en el bus de audio del micrófono
  useEffect(() => {
    const unsubscribe = audioVisualizerBus.subscribe((listening, activeAnalyser) => {
      setIsMicActive(listening);
      setAnalyser(activeAnalyser);
    });

    // Escuchar eventos globales de estado del asistente de voz
    const handleVoiceState = (e: any) => {
      if (e.detail) {
        if (typeof e.detail.isListening === 'boolean') {
          setIsMicActive(e.detail.isListening);
          audioVisualizerBus.setListening(e.detail.isListening);
        }
      }
    };

    window.addEventListener('chef-cero-voice-state', handleVoiceState);

    return () => {
      unsubscribe();
      window.removeEventListener('chef-cero-voice-state', handleVoiceState);
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, []);

  // Animación del renderizado de la forma de onda en canvas a 60fps usando Web Audio API local
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let dataArray: Uint8Array;
    if (analyser) {
      const bufferLength = analyser.frequencyBinCount;
      dataArray = new Uint8Array(bufferLength);
    } else {
      dataArray = new Uint8Array(32);
    }

    const BAR_COUNT = 9; // 9 barras estilizadas de waveform
    const heights = new Array(BAR_COUNT).fill(4);

    const render = () => {
      animFrameRef.current = requestAnimationFrame(render);

      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      let currentAvg = 0;

      if (analyser && isMicActive) {
        analyser.getByteFrequencyData(dataArray);

        // Tomar muestras en el rango de frecuencias de voz humana (bins 2 a 18)
        let sum = 0;
        const binStep = Math.max(1, Math.floor(dataArray.length / (BAR_COUNT * 1.5)));
        for (let i = 0; i < BAR_COUNT; i++) {
          const val = dataArray[i * binStep] || 0;
          sum += val;
          // Normalizar y suavizar altura
          const targetH = Math.max(4, (val / 255) * (height - 4));
          heights[i] += (targetH - heights[i]) * 0.35; // Suavizado lerp
        }
        currentAvg = sum / BAR_COUNT;
        setAudioEnergy(currentAvg / 255);
      } else if (isMicActive) {
        // Si el micrófono está activo pero el stream de Web Audio aún está enlazándose, ligera pulsación de espera
        const time = Date.now() * 0.005;
        for (let i = 0; i < BAR_COUNT; i++) {
          const wave = Math.sin(time + i * 0.6) * 0.5 + 0.5;
          const targetH = 4 + wave * 10;
          heights[i] += (targetH - heights[i]) * 0.2;
        }
      } else {
        // En reposo: barras en estado mínimo elegante
        for (let i = 0; i < BAR_COUNT; i++) {
          heights[i] += (3 - heights[i]) * 0.15;
        }
        setAudioEnergy(0);
      }

      // Dibujar las barras simétricas de la forma de onda
      const barWidth = 3;
      const gap = 3;
      const totalWidth = BAR_COUNT * barWidth + (BAR_COUNT - 1) * gap;
      const startX = (width - totalWidth) / 2;

      for (let i = 0; i < BAR_COUNT; i++) {
        const x = startX + i * (barWidth + gap);
        const h = Math.max(3, heights[i]);
        const y = (height - h) / 2;

        // Gradiente cálido de ámbar a coral según la intensidad de la voz
        const gradient = ctx.createLinearGradient(0, y, 0, y + h);
        if (isMicActive) {
          gradient.addColorStop(0, '#f59e0b'); // amber-500
          gradient.addColorStop(0.5, '#fbbf24'); // amber-400
          gradient.addColorStop(1, '#f97316'); // orange-500
        } else {
          gradient.addColorStop(0, '#78716c'); // stone-500
          gradient.addColorStop(1, '#57534e'); // stone-600
        }

        ctx.fillStyle = gradient;
        ctx.beginPath();
        // Esquinas redondeadas para las barras de audio
        const radius = barWidth / 2;
        ctx.roundRect(x, y, barWidth, h, radius);
        ctx.fill();
      }
    };

    render();

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [analyser, isMicActive]);

  return (
    <aside
      id="floating-voice-bar"
      aria-label="Asistente de voz manos libres con forma de onda en tiempo real"
      className="fixed bottom-5 right-5 z-30 transition-all duration-300"
    >
      <button
        onClick={onOpenVoice}
        title={
          isMicActive
            ? 'Micrófono escuchando tu voz en tiempo real. Toca para abrir el panel de cocina.'
            : 'Chef Cero: Toca para consultar con manos libres o resolver dudas.'
        }
        className={`group relative flex items-center gap-3 px-4 py-3 bg-stone-900/95 hover:bg-stone-900 text-white rounded-full shadow-2xl border transition-all duration-300 cursor-pointer backdrop-blur-md ${
          isMicActive
            ? 'border-amber-400/80 ring-4 ring-amber-500/40 shadow-amber-900/30 scale-105'
            : 'border-stone-700/80 hover:border-stone-600 hover:scale-105 ring-2 ring-stone-800'
        }`}
      >
        {/* Glow dinámico de fondo cuando hay energía en el micrófono */}
        {isMicActive && (
          <div
            className="absolute inset-0 rounded-full bg-gradient-to-r from-amber-500/20 via-orange-500/20 to-amber-500/20 blur-md pointer-events-none transition-opacity duration-200"
            style={{ opacity: Math.max(0.3, audioEnergy * 1.5) }}
          />
        )}

        {/* Ícono de Micrófono con Indicador de Estado */}
        <div
          className={`relative w-9 h-9 rounded-full flex items-center justify-center text-stone-950 font-bold transition-all duration-300 ${
            isMicActive
              ? 'bg-gradient-to-tr from-amber-500 to-amber-300 shadow-md ring-2 ring-white/60'
              : 'bg-amber-500 group-hover:scale-105'
          }`}
        >
          {isMicActive ? (
            <Mic className="w-4 h-4 text-stone-950 animate-pulse" />
          ) : (
            <Mic className="w-4 h-4 text-stone-950" />
          )}

          {/* Anillo de ping sutil cuando está activo */}
          {isMicActive && (
            <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500 border border-stone-900"></span>
            </span>
          )}
        </div>

        {/* Visualizador de Forma de Onda en Tiempo Real (Real-Time Waveform) */}
        <div className="flex flex-col items-start pr-1">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold text-amber-300 uppercase tracking-wider">
              {isMicActive ? 'Escuchando Voz' : 'Chef Cero en Vivo'}
            </span>
            {isMicActive ? (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            ) : (
              <Sparkles className="w-3 h-3 text-amber-400" />
            )}
          </div>

          <div className="flex items-center gap-2 mt-0.5">
            {/* Canvas de la onda acústica real */}
            <div
              className={`h-5 px-1.5 py-0.5 rounded-md flex items-center justify-center transition-colors ${
                isMicActive ? 'bg-stone-950/80 border border-amber-500/30' : 'bg-stone-800/40'
              }`}
            >
              <canvas
                ref={canvasRef}
                width={56}
                height={18}
                className="block"
                aria-hidden="true"
              />
            </div>

            <span className="text-xs font-semibold text-stone-200 truncate max-w-[130px] sm:max-w-[170px]">
              {isMicActive
                ? audioEnergy > 0.08
                  ? 'Recibiendo audio...'
                  : 'Habla cuando quieras...'
                : '¿Dudas o humo? Toca'}
            </span>
          </div>
        </div>
      </button>
    </aside>
  );
};
