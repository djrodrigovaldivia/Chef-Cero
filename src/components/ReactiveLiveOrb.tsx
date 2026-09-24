import React, { useEffect, useRef, useState } from 'react';
import { Sparkles, Mic, Volume2, ShieldCheck, Zap, Activity } from 'lucide-react';
import { VoiceConnectionState, NetworkQuality } from '../hooks/useVoiceConnection';

interface ReactiveLiveOrbProps {
  isLiveActive: boolean;
  connectionState: VoiceConnectionState;
  inputAnalyser: AnalyserNode | null;
  outputAnalyser: AnalyserNode | null;
  isNoiseGateActive: boolean;
  isGatePassingVoice: boolean;
  networkLatency: number | null;
  networkQuality: NetworkQuality;
  onBargeIn?: () => void;
  latestChefText?: string;
  latestUserText?: string;
}

export const ReactiveLiveOrb: React.FC<ReactiveLiveOrbProps> = ({
  isLiveActive,
  connectionState,
  inputAnalyser,
  outputAnalyser,
  isNoiseGateActive,
  isGatePassingVoice,
  networkLatency,
  networkQuality,
  onBargeIn,
  latestChefText,
  latestUserText,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const [orbScale, setOrbScale] = useState<number>(1);
  const [activeEnergy, setActiveEnergy] = useState<number>(0);

  useEffect(() => {
    if (!isLiveActive || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const inputData = new Uint8Array(128);
    const outputData = new Uint8Array(128);

    let phase = 0;

    const render = () => {
      phase += 0.04;
      const width = canvas.width;
      const height = canvas.height;
      const centerX = width / 2;
      const centerY = height / 2;
      const baseRadius = Math.min(width, height) * 0.28;

      ctx.clearRect(0, 0, width, height);

      // Obtener datos espectrales según quién esté produciendo sonido
      let energy = 0;
      const isChefSpeaking = connectionState === 'speaking' && outputAnalyser !== null;

      if (isChefSpeaking && outputAnalyser) {
        outputAnalyser.getByteFrequencyData(outputData);
        let sum = 0;
        for (let i = 0; i < outputData.length; i++) sum += outputData[i];
        energy = sum / (outputData.length * 255);
      } else if (inputAnalyser && isGatePassingVoice) {
        inputAnalyser.getByteFrequencyData(inputData);
        let sum = 0;
        for (let i = 0; i < inputData.length; i++) sum += inputData[i];
        energy = sum / (inputData.length * 255);
      }

      setActiveEnergy(energy);
      const targetScale = 1 + energy * 0.35;
      setOrbScale((prev) => prev * 0.8 + targetScale * 0.2);

      // Colores de la paleta acústica:
      // Chef hablando: Azul Zafiro / Cian / Esmeralda
      // Usuario hablando: Ámbar cálido / Oro / Naranja
      // Ruido filtrado / Reposo: Púrpura suave / Rosa atenuado
      let colorCenter = 'rgba(244, 63, 94, 0.4)';
      let colorMid = 'rgba(225, 29, 72, 0.2)';
      let colorEdge = 'rgba(159, 18, 57, 0.05)';
      let strokeColor = 'rgba(251, 113, 133, 0.8)';

      if (isChefSpeaking) {
        colorCenter = 'rgba(14, 165, 233, 0.55)';
        colorMid = 'rgba(56, 189, 248, 0.3)';
        colorEdge = 'rgba(2, 132, 199, 0.05)';
        strokeColor = 'rgba(125, 211, 252, 0.9)';
      } else if (isGatePassingVoice) {
        colorCenter = 'rgba(245, 158, 11, 0.6)';
        colorMid = 'rgba(251, 191, 36, 0.35)';
        colorEdge = 'rgba(217, 119, 6, 0.05)';
        strokeColor = 'rgba(253, 230, 138, 0.95)';
      }

      // 1. Resplandor radial exterior
      const gradient = ctx.createRadialGradient(
        centerX,
        centerY,
        baseRadius * 0.2,
        centerX,
        centerY,
        baseRadius * (1.5 + energy * 0.8)
      );
      gradient.addColorStop(0, colorCenter);
      gradient.addColorStop(0.5, colorMid);
      gradient.addColorStop(1, colorEdge);

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(centerX, centerY, baseRadius * (1.5 + energy * 0.8), 0, Math.PI * 2);
      ctx.fill();

      // 2. Anillo orbital reactivo con deformación armónica
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 2.5;
      ctx.beginPath();

      const points = 36;
      for (let i = 0; i <= points; i++) {
        const angle = (i / points) * Math.PI * 2;
        const wave = Math.sin(angle * 4 + phase) * (8 + energy * 25) + Math.cos(angle * 3 - phase) * (4 + energy * 12);
        const r = baseRadius + wave;
        const x = centerX + Math.cos(angle) * r;
        const y = centerY + Math.sin(angle) * r;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.closePath();
      ctx.stroke();

      // 3. Núcleo central luminoso
      ctx.fillStyle = isChefSpeaking ? '#38bdf8' : isGatePassingVoice ? '#f59e0b' : '#f43f5e';
      ctx.shadowBlur = 15;
      ctx.shadowColor = strokeColor;
      ctx.beginPath();
      ctx.arc(centerX, centerY, baseRadius * 0.45 * (1 + energy * 0.2), 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      animFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [isLiveActive, connectionState, inputAnalyser, outputAnalyser, isGatePassingVoice]);

  if (!isLiveActive) return null;

  const isChefSpeaking = connectionState === 'speaking';
  const isUserSpeaking = isGatePassingVoice;

  return (
    <div className="bg-gradient-to-b from-stone-950 via-stone-900 to-stone-950 text-white p-4 sm:p-5 border-b border-stone-800 shadow-2xl relative overflow-hidden">
      {/* Fondo con brillo ambiental */}
      <div className="absolute inset-0 bg-radial from-rose-950/20 via-transparent to-transparent pointer-events-none" />

      {/* Barra superior de métricas acústicas en tiempo real */}
      <div className="flex items-center justify-between gap-2 mb-3 relative z-10 text-xs">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
          </span>
          <span className="font-extrabold uppercase tracking-wider text-[11px] text-rose-300 flex items-center gap-1.5">
            <span>Gemini 3.8 Live API</span>
            <span className="bg-rose-900/70 border border-rose-600/50 text-rose-200 px-1.5 py-0.2 rounded text-[9px]">
              Full-Duplex
            </span>
          </span>
        </div>

        {/* Indicadores de DSP y Calidad de Red */}
        <div className="flex items-center gap-1.5">
          {isNoiseGateActive && (
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 border transition ${
                isGatePassingVoice
                  ? 'bg-amber-950/80 text-amber-300 border-amber-500/60'
                  : 'bg-emerald-950/80 text-emerald-300 border-emerald-500/60'
              }`}
              title={
                isGatePassingVoice
                  ? 'Micrófono abierto: transmitiendo tu voz a Gemini'
                  : 'Filtro de cocina activo: atenuando sartenes, campana y ruidos de fondo'
              }
            >
              <ShieldCheck className="w-3 h-3 text-emerald-400" />
              <span className="hidden sm:inline">
                {isGatePassingVoice ? 'Voz Detectada' : 'Filtro Cocina Activo'}
              </span>
              <span className="sm:hidden">
                {isGatePassingVoice ? 'Voz' : 'Filtro'}
              </span>
            </span>
          )}

          {networkLatency !== null && (
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold flex items-center gap-1 border ${
                networkQuality === 'excelente'
                  ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/50'
                  : networkQuality === 'buena'
                  ? 'bg-green-950/80 text-green-300 border-green-500/50'
                  : networkQuality === 'moderada'
                  ? 'bg-amber-950/80 text-amber-300 border-amber-500/50'
                  : 'bg-rose-950/80 text-rose-300 border-rose-500/50'
              }`}
              title={`Latencia RTT: ${networkLatency}ms`}
            >
              <Activity className="w-3 h-3 opacity-80" />
              <span>{networkLatency} ms</span>
            </span>
          )}
        </div>
      </div>

      {/* Contenedor Central del Orbe Reactivo con Canvas */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6 my-2 relative z-10">
        <div
          onClick={() => {
            if (isChefSpeaking) {
              onBargeIn?.();
              try {
                if (typeof navigator !== 'undefined' && navigator.vibrate) {
                  navigator.vibrate([30]);
                }
              } catch (_) {}
            }
          }}
          role="button"
          tabIndex={0}
          title={isChefSpeaking ? 'Toca para interrumpir al Chef (Barge-in instantáneo)' : 'Orbe reactivo en tiempo real'}
          className="relative w-36 h-36 sm:w-40 sm:h-40 flex items-center justify-center cursor-pointer select-none group"
        >
          <canvas
            ref={canvasRef}
            width={180}
            height={180}
            className="w-full h-full pointer-events-none drop-shadow-xl"
          />

          {/* Ícono central flotante según estado */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            {isChefSpeaking ? (
              <div className="flex flex-col items-center text-cyan-200 animate-pulse">
                <Volume2 className="w-7 h-7 mb-0.5" />
                <span className="text-[9px] font-black uppercase tracking-wider bg-black/40 px-1.5 py-0.5 rounded backdrop-blur-xs">
                  Chef Hablando
                </span>
              </div>
            ) : isUserSpeaking ? (
              <div className="flex flex-col items-center text-amber-300 animate-bounce">
                <Mic className="w-7 h-7 mb-0.5" />
                <span className="text-[9px] font-black uppercase tracking-wider bg-black/40 px-1.5 py-0.5 rounded backdrop-blur-xs">
                  Escuchándote
                </span>
              </div>
            ) : (
              <div className="flex flex-col items-center text-rose-300 opacity-90">
                <Sparkles className="w-6 h-6 mb-0.5 animate-spin-slow" />
                <span className="text-[9px] font-black uppercase tracking-wider bg-black/40 px-1.5 py-0.5 rounded backdrop-blur-xs">
                  En espera
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Panel HUD de Transcripción y Subtítulos Live a Distancia (Legible en Cocina) */}
        <div className="flex-1 max-w-md w-full bg-stone-900/90 rounded-2xl p-3.5 border border-stone-800 shadow-inner flex flex-col justify-between min-h-[110px]">
          <div>
            <div className="flex items-center justify-between text-[10px] font-bold text-stone-400 mb-1.5 uppercase tracking-wide">
              <span>Subtítulos en vivo (Manos Libres)</span>
              {isChefSpeaking && (
                <button
                  onClick={onBargeIn}
                  className="text-amber-400 hover:text-amber-300 flex items-center gap-1 bg-amber-950/60 px-2 py-0.5 rounded-md border border-amber-600/40"
                >
                  <Zap className="w-3 h-3" />
                  <span>Interrumpir</span>
                </button>
              )}
            </div>

            {latestChefText ? (
              <p className="text-base sm:text-lg font-bold text-white leading-snug line-clamp-3">
                "{latestChefText}"
              </p>
            ) : latestUserText ? (
              <p className="text-sm sm:text-base font-semibold text-amber-300 leading-snug line-clamp-3 italic">
                Tú: "{latestUserText}"
              </p>
            ) : (
              <p className="text-xs text-stone-400 italic leading-relaxed">
                El Chef está listo. Pregúntale sobre el fuego, sal, textura o tiempos de tu cocción actual sin tocar ningún botón.
              </p>
            )}
          </div>

          <div className="mt-2 pt-2 border-t border-stone-800/80 flex items-center justify-between text-[10px] text-stone-400">
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
              Buffer Circular: Cero latencia GC
            </span>
            <span className="italic">
              {isChefSpeaking ? 'Toca el orbe para hablar' : 'Habla con naturalidad'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
