/**
 * ============================================================================
 * CHEF CERO - ARQUITECTURA DE CLIENTE PARA STREAMING Y AUDIO BUFFER
 * ============================================================================
 * Maneja el flujo entrante de micro-chunks de audio en tiempo real sin cortes,
 * evitando caídas de buffer (buffer underrun) y chasquidos acústicos (clicks).
 * 
 * Estrategia de Audio Web API de Grado de Producción:
 * 1. Cola de reproducción con temporización absoluta programada en `audioCtx.currentTime`.
 * 2. Crossfade lineal / Hanning de 4 a 8 milisegundos en los bordes de cada chunk para
 *    eliminar discontinuidades de fase (evita el "pop" o "click").
 * 3. Jitter Buffer Adaptativo: acumula un pequeño margen inicial (30 a 60ms) antes de
 *    disparar la salida para absorber fluctuaciones de red.
 * 4. Vaciado instantáneo seguro ante interrupciones de usuario (Barge-in / Cancelación).
 */

export interface AudioStreamPlayerOptions {
  sampleRate?: number;
  initialJitterBufferMs?: number; // Tiempo a acumular antes de la primera reproducción
  crossfadeMs?: number;           // Ventana anti-click en milisegundos
  onPlaybackStateChange?: (isPlaying: boolean) => void;
  onBufferUnderrun?: () => void;
}

export class StreamingAudioPlayer {
  private audioCtx: AudioContext | null = null;
  private sampleRate: number;
  private initialJitterBufferMs: number;
  private crossfadeMs: number;
  private nextScheduledTime = 0;
  private isPlaying = false;
  private activeSources: Set<AudioBufferSourceNode> = new Set();
  private gainNode: GainNode | null = null;
  private onPlaybackStateChange?: (isPlaying: boolean) => void;
  private onBufferUnderrun?: () => void;
  private pendingChunks: Float32Array[] = [];
  private accumulatedPendingDuration = 0;
  private isBuffering = true;
  private playbackCheckInterval: any = null;

  constructor(options: AudioStreamPlayerOptions = {}) {
    this.sampleRate = options.sampleRate || 24000;
    this.initialJitterBufferMs = options.initialJitterBufferMs ?? 40;
    this.crossfadeMs = options.crossfadeMs ?? 5;
    this.onPlaybackStateChange = options.onPlaybackStateChange;
    this.onBufferUnderrun = options.onBufferUnderrun;
  }

  private ensureAudioContext(): AudioContext {
    if (!this.audioCtx || this.audioCtx.state === 'closed') {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      this.audioCtx = new AudioContextClass({
        sampleRate: this.sampleRate,
        latencyHint: 'interactive',
      });
      this.gainNode = this.audioCtx.createGain();
      this.gainNode.gain.setValueAtTime(1.0, this.audioCtx.currentTime);
      this.gainNode.connect(this.audioCtx.destination);
    }

    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch((e) => console.warn('AudioContext resume warning:', e));
    }

    return this.audioCtx;
  }

  /**
   * Recibe un chunk en PCM Int16 binario (usado habitualmente por WebSockets/gRPC de Gemini Live)
   */
  public enqueueInt16Chunk(rawPcm: Int16Array | ArrayBuffer): void {
    const int16 = rawPcm instanceof Int16Array ? rawPcm : new Int16Array(rawPcm);
    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) {
      float32[i] = int16[i] / 32768.0;
    }
    this.enqueueFloat32Chunk(float32);
  }

  /**
   * Recibe un chunk en base64 de audio PCM Int16 crudo
   */
  public enqueueBase64Pcm(base64: string): void {
    try {
      const binaryString = window.atob(base64);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      this.enqueueInt16Chunk(bytes.buffer);
    } catch (err) {
      console.warn('Chef Cero: Error parseando base64 PCM stream:', err);
    }
  }

  /**
   * Recibe un chunk normalizado en Float32Array (-1.0 a 1.0)
   */
  public enqueueFloat32Chunk(samples: Float32Array): void {
    if (!samples || samples.length === 0) return;

    const ctx = this.ensureAudioContext();
    const chunkDurationMs = (samples.length / this.sampleRate) * 1000;

    // Si estamos en fase de absorción de jitter inicial
    if (this.isBuffering) {
      this.pendingChunks.push(samples);
      this.accumulatedPendingDuration += chunkDurationMs;

      if (this.accumulatedPendingDuration >= this.initialJitterBufferMs) {
        this.flushPendingBuffer();
      }
      return;
    }

    this.scheduleBufferDirect(ctx, samples);
  }

  private flushPendingBuffer(): void {
    if (this.pendingChunks.length === 0) return;
    const ctx = this.ensureAudioContext();

    // Concatenar todos los chunks acumulados durante el jitter buffer
    const totalLength = this.pendingChunks.reduce((acc, c) => acc + c.length, 0);
    const combined = new Float32Array(totalLength);
    let offset = 0;
    for (const chunk of this.pendingChunks) {
      combined.set(chunk, offset);
      offset += chunk.length;
    }

    this.pendingChunks = [];
    this.accumulatedPendingDuration = 0;
    this.isBuffering = false;

    this.scheduleBufferDirect(ctx, combined);
  }

  /**
   * Programa el buffer con suavizado en los bordes (anti-click) y alineación temporal absoluta
   */
  private scheduleBufferDirect(ctx: AudioContext, samples: Float32Array): void {
    const audioBuffer = ctx.createBuffer(1, samples.length, this.sampleRate);
    const channelData = audioBuffer.getChannelData(0);
    channelData.set(samples);

    // Aplicar micro-fade en el inicio y final para suprimir chasquidos
    this.applyAntiClickSmoothing(channelData);

    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.gainNode || ctx.destination);

    const currentTime = ctx.currentTime;
    // Si el tiempo proyectado ya pasó, hubo un underrun -> reprogramamos inmediatamente
    if (this.nextScheduledTime < currentTime) {
      if (this.isPlaying && this.nextScheduledTime > 0) {
        this.onBufferUnderrun?.();
      }
      this.nextScheduledTime = currentTime + 0.005; // 5ms de headroom para el scheduler
    }

    const startTime = this.nextScheduledTime;
    const duration = audioBuffer.duration;
    this.nextScheduledTime = startTime + duration;

    source.start(startTime);
    this.activeSources.add(source);

    if (!this.isPlaying) {
      this.isPlaying = true;
      this.onPlaybackStateChange?.(true);
      this.startPlaybackMonitor();
    }

    source.onended = () => {
      this.activeSources.delete(source);
      if (this.activeSources.size === 0 && ctx.currentTime >= this.nextScheduledTime - 0.02) {
        this.isPlaying = false;
        this.isBuffering = true;
        this.nextScheduledTime = 0;
        this.onPlaybackStateChange?.(false);
      }
    };
  }

  /**
   * Suaviza los primeros y últimos N samples con una rampa exponencial/cosenoidal (anti-click)
   */
  private applyAntiClickSmoothing(data: Float32Array): void {
    const fadeSamples = Math.min(Math.floor((this.crossfadeMs / 1000) * this.sampleRate), Math.floor(data.length / 4));
    if (fadeSamples <= 0) return;

    for (let i = 0; i < fadeSamples; i++) {
      const factor = 0.5 * (1 - Math.cos((Math.PI * i) / fadeSamples));
      data[i] *= factor;
      data[data.length - 1 - i] *= factor;
    }
  }

  private startPlaybackMonitor(): void {
    if (this.playbackCheckInterval) clearInterval(this.playbackCheckInterval);
    this.playbackCheckInterval = setInterval(() => {
      if (!this.audioCtx) return;
      if (this.activeSources.size === 0 && this.audioCtx.currentTime >= this.nextScheduledTime) {
        if (this.isPlaying) {
          this.isPlaying = false;
          this.isBuffering = true;
          this.nextScheduledTime = 0;
          this.onPlaybackStateChange?.(false);
        }
        clearInterval(this.playbackCheckInterval);
        this.playbackCheckInterval = null;
      }
    }, 100);
  }

  /**
   * Interrupción inmediata (Barge-in): detiene todas las fuentes activas y purga el buffer en O(1)
   */
  public stopAndClear(): void {
    this.pendingChunks = [];
    this.accumulatedPendingDuration = 0;
    this.isBuffering = true;
    this.nextScheduledTime = 0;

    for (const source of this.activeSources) {
      try {
        source.stop(0);
        source.disconnect();
      } catch (_) {}
    }
    this.activeSources.clear();

    if (this.isPlaying) {
      this.isPlaying = false;
      this.onPlaybackStateChange?.(false);
    }
    if (this.playbackCheckInterval) {
      clearInterval(this.playbackCheckInterval);
      this.playbackCheckInterval = null;
    }
  }

  public getPlaybackState(): { isPlaying: boolean; bufferedSources: number; currentTime: number } {
    return {
      isPlaying: this.isPlaying,
      bufferedSources: this.activeSources.size,
      currentTime: this.audioCtx?.currentTime || 0,
    };
  }

  public close(): void {
    this.stopAndClear();
    if (this.audioCtx && this.audioCtx.state !== 'closed') {
      this.audioCtx.close().catch(() => {});
      this.audioCtx = null;
    }
  }
}
