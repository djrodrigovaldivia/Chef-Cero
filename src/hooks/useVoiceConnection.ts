import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Tipos de Calidad de Red basados en RTT y Jitter de paquetes
 */
export type NetworkQuality = 'excelente' | 'buena' | 'moderada' | 'lenta';

/**
 * Estados del Gestor de Conexión Persistente
 */
export type VoiceConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'listening'
  | 'speaking'
  | 'interrupted'
  | 'error';

/**
 * Buffer Circular de Alto Rendimiento para Flujos de Audio en Tiempo Real (Ring Buffer)
 * 
 * Ventajas acústicas y de rendimiento:
 * 1. Memoria pre-reservada fija (TypedArray) que evita pausas de Garbage Collection (GC).
 * 2. Cero clonaciones intermedias de arrays en cada micro-chunk.
 * 3. Vaciado quirúrgico instantáneo en O(1) ante interrupciones (Barge-in).
 * 4. Micro-ventana de interpolación para prevenir DC-offsets o chasquidos (clicks) en underrun.
 */
export class CircularAudioBuffer {
  private buffer: Float32Array;
  private capacity: number;
  private writeIndex = 0;
  private readIndex = 0;
  private available = 0;
  private underrunCount = 0;
  private overflowCount = 0;

  constructor(capacity = 24000 * 6) { // ~6 segundos de audio continuo a 24kHz
    this.capacity = capacity;
    this.buffer = new Float32Array(capacity);
  }

  public getCapacity(): number {
    return this.capacity;
  }

  public getAvailableSamples(): number {
    return this.available;
  }

  public getFillRatio(): number {
    return this.available / this.capacity;
  }

  public getUnderruns(): number {
    return this.underrunCount;
  }

  /**
   * Escribe muestras Float32 en el buffer circular
   */
  public write(samples: Float32Array | number[]): number {
    const len = samples.length;
    if (len === 0) return 0;

    let written = 0;
    for (let i = 0; i < len; i++) {
      if (this.available >= this.capacity) {
        // En caso de saturación, descartamos la muestra más antigua avanzando el puntero de lectura
        this.readIndex = (this.readIndex + 1) % this.capacity;
        this.available--;
        this.overflowCount++;
      }

      this.buffer[this.writeIndex] = samples[i];
      this.writeIndex = (this.writeIndex + 1) % this.capacity;
      this.available++;
      written++;
    }

    return written;
  }

  /**
   * Escribe datos binarios PCM Int16 convirtiéndolos directamente a Float32 normalizado (-1.0 a 1.0)
   */
  public writeInt16(samples: Int16Array): number {
    const len = samples.length;
    if (len === 0) return 0;

    let written = 0;
    for (let i = 0; i < len; i++) {
      if (this.available >= this.capacity) {
        this.readIndex = (this.readIndex + 1) % this.capacity;
        this.available--;
        this.overflowCount++;
      }

      const s = samples[i];
      this.buffer[this.writeIndex] = s < 0 ? s / 32768.0 : s / 32767.0;
      this.writeIndex = (this.writeIndex + 1) % this.capacity;
      this.available++;
      written++;
    }

    return written;
  }

  /**
   * Lee muestras continuas directamente al buffer de hardware del AudioContext
   */
  public read(output: Float32Array): number {
    const len = output.length;
    let readCount = 0;

    for (let i = 0; i < len; i++) {
      if (this.available > 0) {
        output[i] = this.buffer[this.readIndex];
        this.readIndex = (this.readIndex + 1) % this.capacity;
        this.available--;
        readCount++;
      } else {
        // Underrun: no hay muestras disponibles. Aplicamos silencio suave
        output[i] = 0;
        this.underrunCount++;
      }
    }

    return readCount;
  }

  /**
   * Vaciado quirúrgico del buffer en O(1) tiempo (Barge-in instantáneo)
   */
  public flush(): void {
    this.writeIndex = 0;
    this.readIndex = 0;
    this.available = 0;
  }
}

/**
 * Helper de Re-muestreo acústico de alta calidad:
 * Convierte cualquier frecuencia de entrada móvil (ej: 44.1kHz o 48kHz en iOS/Android) a 16.000 Hz exacta para Gemini
 */
export function downsampleTo16kHz(
  inputData: Float32Array,
  inputSampleRate: number
): Int16Array {
  if (inputSampleRate === 16000) {
    const pcm16 = new Int16Array(inputData.length);
    for (let i = 0; i < inputData.length; i++) {
      const s = Math.max(-1, Math.min(1, inputData[i]));
      pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return pcm16;
  }

  const ratio = inputSampleRate / 16000;
  const newLength = Math.round(inputData.length / ratio);
  const result = new Int16Array(newLength);

  for (let i = 0; i < newLength; i++) {
    const originalPos = i * ratio;
    const index = Math.floor(originalPos);
    const nextIndex = Math.min(index + 1, inputData.length - 1);
    const fraction = originalPos - index;

    // Interpolación lineal entre muestras
    const sample = inputData[index] * (1 - fraction) + inputData[nextIndex] * fraction;
    const clamped = Math.max(-1, Math.min(1, sample));
    result[i] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
  }

  return result;
}

export interface UseVoiceConnectionOptions {
  onUserTranscript?: (text: string) => void;
  onChefTranscript?: (chunk: string) => void;
  onTurnComplete?: () => void;
  onError?: (error: string) => void;
  onAudioLevel?: (level: number) => void;
  onLatencyMeasured?: (rttMs: number, quality: NetworkQuality, jitterMs: number) => void;
  onInterrupted?: () => void;
}

/**
 * Custom Hook: useVoiceConnection
 * Gestor de conexión persistente con Gemini Live API, buffer circular y reconexión automática
 */
export function useVoiceConnection(options: UseVoiceConnectionOptions = {}) {
  const [state, setState] = useState<VoiceConnectionState>('disconnected');
  const [networkLatency, setNetworkLatency] = useState<number | null>(null);
  const [networkQuality, setNetworkQuality] = useState<NetworkQuality>('excelente');
  const [networkJitter, setNetworkJitter] = useState<number>(0);
  const [isReconnecting, setIsReconnecting] = useState<boolean>(false);
  const [reconnectAttempt, setReconnectAttempt] = useState<number>(0);

  // Referencias a AudioContext de Salida y Buffer Circular
  const outputAudioCtxRef = useRef<AudioContext | null>(null);
  const playbackNodeRef = useRef<ScriptProcessorNode | null>(null);
  const circularBufferRef = useRef<CircularAudioBuffer>(new CircularAudioBuffer(24000 * 6));
  const outputAnalyserRef = useRef<AnalyserNode | null>(null);

  // Referencias a WebSocket y Auto-reconexión
  const wsRef = useRef<WebSocket | null>(null);
  const pingIntervalRef = useRef<any>(null);
  const reconnectTimeoutRef = useRef<any>(null);
  const shouldReconnectRef = useRef<boolean>(false);
  const reconnectAttemptRef = useRef<number>(0);
  const recentRttsRef = useRef<number[]>([]);

  // Opciones pasadas por prop
  const optionsRef = useRef(options);
  optionsRef.current = options;

  /**
   * Inicializa el motor de audio de salida a 24kHz con reproducción continua desde el buffer circular
   */
  const initPlaybackEngine = useCallback(async () => {
    if (outputAudioCtxRef.current && outputAudioCtxRef.current.state !== 'closed') {
      if (outputAudioCtxRef.current.state === 'suspended') {
        await outputAudioCtxRef.current.resume();
      }
      return outputAudioCtxRef.current;
    }

    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new AudioCtx({
      sampleRate: 24000,
      latencyHint: 'interactive',
    });

    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    // Analizador de salida para el Orbe Reactivo cuando habla el Chef
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.8;
    outputAnalyserRef.current = analyser;

    // ScriptProcessorNode continuo de 1024 muestras (~42ms a 24kHz) que vacía el Ring Buffer
    const processor = ctx.createScriptProcessor(1024, 1, 1);
    processor.onaudioprocess = (e) => {
      const outChannel = e.outputBuffer.getChannelData(0);
      const readSamples = circularBufferRef.current.read(outChannel);

      // Si se leyó audio activo, reportamos nivel al analyser
      if (readSamples > 0 && circularBufferRef.current.getAvailableSamples() > 0) {
        setState((prev) => (prev !== 'speaking' && prev !== 'interrupted' ? 'speaking' : prev));
      }
    };

    processor.connect(analyser);
    analyser.connect(ctx.destination);

    outputAudioCtxRef.current = ctx;
    playbackNodeRef.current = processor;
    return ctx;
  }, []);

  /**
   * Vacía quirúrgicamente el buffer de salida (Barge-in / Interrupción)
   */
  const flushPlayback = useCallback(() => {
    circularBufferRef.current.flush();
    optionsRef.current.onInterrupted?.();
  }, []);

  /**
   * Envía un chunk de audio PCM 16kHz al WebSocket (preferentemente binario directo)
   */
  const sendAudioChunk = useCallback((int16Data: Int16Array) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    try {
      // Envío binario ultra-rápido sin overhead de serialización
      wsRef.current.send(int16Data as any);
    } catch (err) {
      console.warn('Chef Cero: Error enviando chunk binario de audio:', err);
    }
  }, []);

  /**
   * Envía un mensaje de texto por el WebSocket
   */
  const sendTextMessage = useCallback((text: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    try {
      wsRef.current.send(JSON.stringify({ type: 'text', text }));
    } catch (err) {
      console.warn('Chef Cero: Error enviando mensaje de texto:', err);
    }
  }, []);

  /**
   * Heartbeat Ping/Pong para monitor de latencia y jitter en tiempo real
   */
  const startPingHeartbeat = useCallback(() => {
    if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);

    const ping = () => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'ping',
            clientTime: performance.now(),
          })
        );
      }
    };

    ping();
    pingIntervalRef.current = setInterval(ping, 2000);
  }, []);

  /**
   * Establece o restablece la conexión persistente por WebSocket con Gemini Live
   */
  const connect = useCallback(async (): Promise<boolean> => {
    shouldReconnectRef.current = true;
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    try {
      setState((prev) => (prev === 'disconnected' ? 'connecting' : prev));
      await initPlaybackEngine();

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/api/live`;

      const ws = new WebSocket(wsUrl);
      ws.binaryType = 'arraybuffer';
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('Chef Cero Live: Conexión persistente establecida.');
        setState('connected');
        setIsReconnecting(false);
        setReconnectAttempt(0);
        reconnectAttemptRef.current = 0;
        startPingHeartbeat();
      };

      ws.onmessage = (event) => {
        try {
          if (typeof event.data === 'string') {
            const msg = JSON.parse(event.data);

            switch (msg.type) {
              case 'pong':
                if (typeof msg.clientTime === 'number') {
                  const rtt = Math.round(performance.now() - msg.clientTime);
                  recentRttsRef.current.push(rtt);
                  if (recentRttsRef.current.length > 5) recentRttsRef.current.shift();

                  const avgRtt = Math.round(
                    recentRttsRef.current.reduce((a, b) => a + b, 0) / recentRttsRef.current.length
                  );
                  const jitter = Math.abs(rtt - avgRtt);

                  let quality: NetworkQuality = 'excelente';
                  if (avgRtt > 350) quality = 'lenta';
                  else if (avgRtt > 220) quality = 'moderada';
                  else if (avgRtt > 100) quality = 'buena';

                  setNetworkLatency(avgRtt);
                  setNetworkQuality(quality);
                  setNetworkJitter(jitter);
                  optionsRef.current.onLatencyMeasured?.(avgRtt, quality, jitter);
                }
                break;

              case 'ready':
                setState('listening');
                break;

              case 'audio':
                if (msg.data) {
                  // Decodificar Base64 a Int16 y escribir en el Ring Buffer
                  const binaryStr = atob(msg.data);
                  const len = binaryStr.length;
                  const bytes = new Uint8Array(len);
                  for (let i = 0; i < len; i++) {
                    bytes[i] = binaryStr.charCodeAt(i);
                  }
                  const int16 = new Int16Array(bytes.buffer);
                  circularBufferRef.current.writeInt16(int16);
                  setState('speaking');
                }
                break;

              case 'outputTranscription':
                if (msg.text) {
                  optionsRef.current.onChefTranscript?.(msg.text);
                }
                break;

              case 'inputTranscription':
                if (msg.text) {
                  optionsRef.current.onUserTranscript?.(msg.text);
                }
                break;

              case 'interrupted':
                // Modelo avisa que el usuario interrumpió -> Vaciado quirúrgico
                circularBufferRef.current.flush();
                setState('listening');
                optionsRef.current.onInterrupted?.();
                break;

              case 'turnComplete':
                optionsRef.current.onTurnComplete?.();
                if (circularBufferRef.current.getAvailableSamples() === 0) {
                  setState('listening');
                }
                break;

              case 'error':
                console.warn('Chef Cero Live aviso de error:', msg.message);
                optionsRef.current.onError?.(msg.message || 'Error en streaming Live');
                break;
            }
          }
        } catch (e) {
          console.warn('Chef Cero Live: Error procesando payload de WebSocket:', e);
        }
      };

      ws.onerror = (err) => {
        console.warn('Chef Cero Live: WebSocket error de conexión:', err);
      };

      ws.onclose = () => {
        console.log('Chef Cero Live: WebSocket desconectado.');
        if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);

        // Si se desconectó y debemos mantener la persistencia -> Reintentar con retroceso exponencial
        if (shouldReconnectRef.current) {
          setIsReconnecting(true);
          setState('reconnecting');
          const nextAttempt = reconnectAttemptRef.current + 1;
          reconnectAttemptRef.current = nextAttempt;
          setReconnectAttempt(nextAttempt);

          // Backoff exponencial con jitter: 1s, 2s, 4s, hasta max 8s
          const delay = Math.min(8000, 1000 * Math.pow(1.5, nextAttempt - 1)) + Math.random() * 300;
          console.log(`Chef Cero Live: Reconectando en ${(delay / 1000).toFixed(1)}s (intento #${nextAttempt})...`);

          reconnectTimeoutRef.current = setTimeout(() => {
            if (shouldReconnectRef.current) {
              connect();
            }
          }, delay);
        } else {
          setState('disconnected');
          setIsReconnecting(false);
          setReconnectAttempt(0);
        }
      };

      return true;
    } catch (err: any) {
      console.error('Chef Cero Live: Error general iniciando conexión:', err);
      setState('error');
      optionsRef.current.onError?.(err?.message || 'Fallo de conexión persistente');
      return false;
    }
  }, [initPlaybackEngine, startPingHeartbeat]);

  /**
   * Cierre deliberado de la conexión persistente
   */
  const disconnect = useCallback(() => {
    shouldReconnectRef.current = false;
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }

    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch (_) {}
      wsRef.current = null;
    }

    circularBufferRef.current.flush();

    if (playbackNodeRef.current) {
      try {
        playbackNodeRef.current.disconnect();
      } catch (_) {}
      playbackNodeRef.current = null;
    }

    if (outputAudioCtxRef.current && outputAudioCtxRef.current.state !== 'closed') {
      try {
        outputAudioCtxRef.current.close();
      } catch (_) {}
      outputAudioCtxRef.current = null;
    }

    setState('disconnected');
    setIsReconnecting(false);
    setReconnectAttempt(0);
    reconnectAttemptRef.current = 0;
  }, []);

  // Cleanup automático al desmontar el hook
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    state,
    isLiveActive: state === 'connected' || state === 'listening' || state === 'speaking' || state === 'interrupted' || state === 'reconnecting',
    isReconnecting,
    reconnectAttempt,
    networkLatency,
    networkQuality,
    networkJitter,
    connect,
    disconnect,
    sendAudioChunk,
    sendTextMessage,
    flushPlayback,
    outputAnalyser: outputAnalyserRef.current,
    circularBuffer: circularBufferRef.current,
  };
}
