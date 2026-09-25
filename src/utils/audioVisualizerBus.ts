/**
 * Audio Visualizer Stream Bus (Singleton)
 * 
 * Gestiona de forma centralizada y segura el stream de micrófono activo
 * y un AnalyserNode local de bajo consumo para visualizadores visuales de audio (Waveforms).
 * 
 * Principios:
 * 1. Cero costo de tokens / Cero llamadas a API: todo ocurre en el procesador Web Audio nativo.
 * 2. Un único AudioContext compartido para evitar sobrecarga o límites de contextos del navegador.
 * 3. Notificación a suscriptores cuando el micrófono se activa o desactiva.
 */

type StreamStateListener = (active: boolean, analyser: AnalyserNode | null) => void;

class AudioVisualizerBus {
  private static instance: AudioVisualizerBus;
  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private activeStream: MediaStream | null = null;
  private isListening = false;
  private isSpeaking = false;
  private listeners: Set<StreamStateListener> = new Set();
  private ownStream: MediaStream | null = null;

  private constructor() {}

  public static getInstance(): AudioVisualizerBus {
    if (!AudioVisualizerBus.instance) {
      AudioVisualizerBus.instance = new AudioVisualizerBus();
    }
    return AudioVisualizerBus.instance;
  }

  private getAudioContext(): AudioContext {
    if (!this.audioCtx || this.audioCtx.state === 'closed') {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.audioCtx = new AudioCtx({ latencyHint: 'interactive' });
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
    return this.audioCtx;
  }

  /**
   * Conectar un stream existente (por ejemplo, desde VoiceAssistantModal o GeminiLiveClient)
   */
  public attachStream(stream: MediaStream) {
    try {
      this.activeStream = stream;
      const ctx = this.getAudioContext();

      if (this.sourceNode) {
        try {
          this.sourceNode.disconnect();
        } catch (_) {}
      }

      this.sourceNode = ctx.createMediaStreamSource(stream);
      if (!this.analyser) {
        this.analyser = ctx.createAnalyser();
        this.analyser.fftSize = 64; // Bajo costo, ideal para barras de waveform fluidas (32 bins)
        this.analyser.smoothingTimeConstant = 0.75;
      }

      this.sourceNode.connect(this.analyser);
      this.isListening = true;
      this.notify();
    } catch (err) {
      console.warn('AudioVisualizerBus: Error conectando stream:', err);
    }
  }

  /**
   * Solicitar activación directa del micrófono si no hay un stream adjunto
   */
  public async requestMicStream(): Promise<boolean> {
    if (this.activeStream && this.activeStream.active) {
      this.isListening = true;
      this.notify();
      return true;
    }

    try {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        return false;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: false,
          autoGainControl: true,
        },
      });

      this.ownStream = stream;
      this.attachStream(stream);
      return true;
    } catch (err) {
      console.warn('AudioVisualizerBus: No se pudo obtener acceso al micrófono:', err);
      return false;
    }
  }

  /**
   * Notificar que el asistente está escuchando activamente
   */
  public setListening(listening: boolean) {
    this.isListening = listening;
    if (!listening && this.ownStream) {
      // Detener tracks si los abrió el propio bus
      this.ownStream.getTracks().forEach((t) => t.stop());
      this.ownStream = null;
    }
    this.notify();
  }

  public setSpeaking(speaking: boolean) {
    this.isSpeaking = speaking;
    this.notify();
  }

  public getIsListening(): boolean {
    return this.isListening;
  }

  public getIsSpeaking(): boolean {
    return this.isSpeaking;
  }

  public getAnalyser(): AnalyserNode | null {
    return this.analyser;
  }

  public detach() {
    this.isListening = false;
    if (this.sourceNode) {
      try {
        this.sourceNode.disconnect();
      } catch (_) {}
      this.sourceNode = null;
    }
    if (this.ownStream) {
      this.ownStream.getTracks().forEach((t) => t.stop());
      this.ownStream = null;
    }
    this.activeStream = null;
    this.notify();
  }

  public subscribe(listener: StreamStateListener): () => void {
    this.listeners.add(listener);
    listener(this.isListening, this.analyser);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    this.listeners.forEach((fn) => {
      try {
        fn(this.isListening, this.analyser);
      } catch (e) {
        console.warn('AudioVisualizerBus: error en listener:', e);
      }
    });
  }
}

export const audioVisualizerBus = AudioVisualizerBus.getInstance();
