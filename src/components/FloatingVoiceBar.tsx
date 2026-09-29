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
      className="fixed bottom-5 right-4 sm:right-6 z-30 transition-all duration-300"
    >
      <button
        onClick={onOpenVoice}
        aria-label="Hablar con Chef Cero por voz"
        title="Consultar por voz al Chef Cero"
        className={`group relative flex items-center gap-2 px-3.5 py-2 rounded-full shadow-md transition-all duration-300 cursor-pointer backdrop-blur-md active:scale-95 border ${
          isMicActive
            ? 'bg-amber-500 text-stone-950 border-amber-300 ring-4 ring-amber-300/40 animate-pulse'
            : 'bg-white/95 hover:bg-white text-stone-800 border-stone-200/90 hover:border-amber-400 hover:shadow-lg'
        }`}
      >
        <div className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors ${
          isMicActive ? 'bg-stone-950 text-white' : 'bg-amber-100 text-amber-900 group-hover:bg-amber-500 group-hover:text-stone-950'
        }`}>
          <Mic className="w-3.5 h-3.5" />
        </div>
        <span className="text-xs font-bold hidden sm:inline text-stone-700 group-hover:text-stone-950">
          {isMicActive ? 'Escuchando...' : 'Chef por Voz'}
        </span>
        {isMicActive && (
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
          </span>
        )}
      </button>
    </aside>
  );
};
