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
        analyser.getByteFrequencyData(dataArray as any);

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
      aria-label="Asistente de voz manos libres"
      className="fixed bottom-20 left-4 md:bottom-6 md:left-6 z-30 transition-all duration-300"
    >
      <button
        onClick={onOpenVoice}
        aria-label="Hablar con Chef Cero por voz"
        title={
          isMicActive
            ? 'Micrófono escuchando tu voz. Toca para abrir el panel de cocina.'
            : 'Chef Cero: Toca para consultar por voz o resolver dudas.'
        }
        className={`group relative flex items-center justify-center w-12 h-12 md:w-14 md:h-14 rounded-full shadow-2xl transition-all duration-300 cursor-pointer backdrop-blur-md active:scale-95 ${
          isMicActive
            ? 'bg-amber-500 text-stone-950 border-2 border-white ring-4 ring-amber-400/50 shadow-amber-500/40 animate-pulse scale-105'
            : 'bg-stone-900/95 hover:bg-stone-900 text-amber-400 border border-stone-700/80 hover:border-amber-400/60 ring-2 ring-stone-800'
        }`}
      >
        {/* Glow dinámico de fondo cuando hay energía en el micrófono */}
        {isMicActive && (
          <div
            className="absolute inset-0 rounded-full bg-gradient-to-r from-amber-500/30 via-orange-500/30 to-amber-500/30 blur-md pointer-events-none transition-opacity duration-200"
            style={{ opacity: Math.max(0.4, audioEnergy * 2) }}
          />
        )}

        {/* Ícono de Micrófono */}
        <div className="relative flex items-center justify-center">
          <Mic className={`w-5 h-5 md:w-6 md:h-6 ${isMicActive ? 'text-stone-950 animate-pulse' : 'text-amber-400 group-hover:scale-110 transition-transform'}`} />

          {/* Anillo de ping cuando está activo */}
          {isMicActive && (
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-90"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-400 border border-stone-900"></span>
            </span>
          )}
        </div>
      </button>
    </aside>
  );
};
