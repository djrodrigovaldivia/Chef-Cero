/**
 * Cliente para Gemini 3.8 Live API (Streaming Bidireccional de Audio en Tiempo Real)
 * - Captura micrófono a 16kHz PCM Little-Endian
 * - Reproduce respuestas del Chef en audio a 24kHz sin cortes con programación temporal precisa
 * - Soporta interrupciones naturales del usuario en tiempo real (Barge-in)
 * - Transcripción en vivo que se añade directamente al chat
 */

export type LiveClientState =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'listening'
  | 'speaking'
  | 'interrupted'
  | 'error'
  | 'disconnected';

export interface GeminiLiveOptions {
  onStateChange?: (state: LiveClientState) => void;
  onUserTranscript?: (text: string) => void;
  onChefTranscript?: (chunk: string) => void;
  onTurnComplete?: () => void;
  onError?: (errMessage: string) => void;
  onAudioLevel?: (level: number) => void;
}

export class GeminiLiveClient {
  private ws: WebSocket | null = null;
  private inputAudioCtx: AudioContext | null = null;
  private outputAudioCtx: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private scriptProcessor: ScriptProcessorNode | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private nextStartTime = 0;
  private activeSources: AudioBufferSourceNode[] = [];
  private state: LiveClientState = 'idle';
  private options: GeminiLiveOptions;
  private isMuted = false;

  constructor(options: GeminiLiveOptions) {
    this.options = options;
  }

  public getState(): LiveClientState {
    return this.state;
  }

  private setState(newState: LiveClientState) {
    this.state = newState;
    this.options.onStateChange?.(newState);
  }

  /**
   * Conecta al endpoint WebSocket de Gemini 3.8 Live API y activa micrófono
   */
  public async connect(): Promise<boolean> {
    try {
      this.setState('connecting');

      // 1. Obtener acceso al micrófono con cancelación de eco y ruido de cocina
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        },
      });

      // 2. Conectar WebSocket a /api/live
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/api/live`;
      this.ws = new WebSocket(wsUrl);

      // 3. Inicializar AudioContexts
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.inputAudioCtx = new AudioCtx({ sampleRate: 16000 });
      this.outputAudioCtx = new AudioCtx({ sampleRate: 24000 });

      if (this.outputAudioCtx.state === 'suspended') {
        await this.outputAudioCtx.resume();
      }

      this.ws.onopen = () => {
        console.log('Chef Cero Live: WebSocket abierto con Gemini 3.8 Live');
        this.setState('connected');
        this.startMicrophoneCapture();
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          this.handleServerMessage(msg);
        } catch (e) {
          console.warn('Chef Cero Live: Mensaje no-JSON recibido:', e);
        }
      };

      this.ws.onerror = (err) => {
        console.warn('Chef Cero Live: Error en WebSocket:', err);
        this.setState('error');
        this.options.onError?.('Error en conexión con el servicio Live');
      };

      this.ws.onclose = () => {
        console.log('Chef Cero Live: WebSocket cerrado.');
        this.setState('disconnected');
        this.cleanupAudio();
      };

      return true;
    } catch (err: any) {
      console.error('Chef Cero Live: Error iniciando cliente Live:', err);
      this.setState('error');
      this.options.onError?.(err?.message || 'No se pudo acceder al micrófono o conectar a Live API');
      this.disconnect();
      return false;
    }
  }

  /**
   * Captura el audio del micrófono a 16kHz y lo transmite como PCM de 16 bits en base64
   */
  private startMicrophoneCapture() {
    if (!this.inputAudioCtx || !this.mediaStream) return;

    try {
      this.sourceNode = this.inputAudioCtx.createMediaStreamSource(this.mediaStream);
      // Buffer de 4096 muestras (~256ms a 16kHz)
      this.scriptProcessor = this.inputAudioCtx.createScriptProcessor(4096, 1, 1);

      this.sourceNode.connect(this.scriptProcessor);
      this.scriptProcessor.connect(this.inputAudioCtx.destination);

      this.scriptProcessor.onaudioprocess = (e) => {
        if (this.isMuted || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;

        const inputData = e.inputBuffer.getChannelData(0);

        // Calcular volumen para feedback visual de ondas de audio
        let sumSquares = 0;
        for (let i = 0; i < inputData.length; i++) {
          sumSquares += inputData[i] * inputData[i];
        }
        const rms = Math.sqrt(sumSquares / inputData.length);
        this.options.onAudioLevel?.(Math.min(1, rms * 5));

        // Convertir Float32 a Int16 PCM little-endian
        const int16Array = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]));
          int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }

        // Convertir a base64
        const binaryString = String.fromCharCode.apply(null, Array.from(new Uint8Array(int16Array.buffer)));
        const base64Audio = btoa(binaryString);

        this.ws.send(
          JSON.stringify({
            type: 'audio',
            data: base64Audio,
          })
        );
      };

      this.setState('listening');
    } catch (e: any) {
      console.warn('Chef Cero Live: Error iniciando procesador de micrófono:', e);
    }
  }

  /**
   * Procesa mensajes entrantes del servidor Gemini Live
   */
  private handleServerMessage(msg: any) {
    switch (msg.type) {
      case 'ready':
        this.setState('listening');
        break;

      case 'audio':
        if (msg.data) {
          this.setState('speaking');
          this.playPcm24kChunk(msg.data);
        }
        break;

      case 'outputTranscription':
        if (msg.text) {
          this.options.onChefTranscript?.(msg.text);
        }
        break;

      case 'inputTranscription':
        if (msg.text) {
          this.options.onUserTranscript?.(msg.text);
        }
        break;

      case 'interrupted':
        // El usuario habló mientras el chef hablaba: interrumpir reproducción de inmediato
        console.log('Chef Cero Live: Interrupción detectada (el usuario tomó la palabra)');
        this.stopAudioPlayback();
        this.setState('listening');
        break;

      case 'turnComplete':
        this.options.onTurnComplete?.();
        if (this.activeSources.length === 0) {
          this.setState('listening');
        }
        break;

      case 'error':
        this.options.onError?.(msg.message || 'Error en Gemini Live');
        break;

      case 'sessionClosed':
        this.setState('disconnected');
        break;
    }
  }

  /**
   * Reproduce trozos de audio PCM 24kHz sin huecos ni saltos
   */
  private playPcm24kChunk(base64Data: string) {
    if (!this.outputAudioCtx) return;

    try {
      if (this.outputAudioCtx.state === 'suspended') {
        this.outputAudioCtx.resume();
      }

      const binaryString = atob(base64Data);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const int16 = new Int16Array(bytes.buffer);
      const float32 = new Float32Array(int16.length);
      for (let i = 0; i < int16.length; i++) {
        float32[i] = int16[i] / 32768.0;
      }

      const audioBuffer = this.outputAudioCtx.createBuffer(1, float32.length, 24000);
      audioBuffer.getChannelData(0).set(float32);

      const source = this.outputAudioCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.outputAudioCtx.destination);

      const currentTime = this.outputAudioCtx.currentTime;
      if (this.nextStartTime < currentTime) {
        this.nextStartTime = currentTime;
      }

      source.start(this.nextStartTime);
      this.nextStartTime += audioBuffer.duration;

      this.activeSources.push(source);

      source.onended = () => {
        this.activeSources = this.activeSources.filter((s) => s !== source);
        if (this.activeSources.length === 0 && this.state === 'speaking') {
          this.setState('listening');
        }
      };
    } catch (err) {
      console.warn('Chef Cero Live: Error reproduciendo audio PCM 24k:', err);
    }
  }

  /**
   * Detiene la reproducción de audio inmediatamente (cuando el usuario interrumpe)
   */
  public stopAudioPlayback() {
    for (const source of this.activeSources) {
      try {
        source.stop();
        source.disconnect();
      } catch (_) {}
    }
    this.activeSources = [];
    if (this.outputAudioCtx) {
      this.nextStartTime = this.outputAudioCtx.currentTime;
    }
  }

  /**
   * Enviar mensaje de texto al modelo Live
   */
  public sendText(text: string) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'text', text }));
    }
  }

  /**
   * Mutear o desmutear el micrófono
   */
  public setMuted(muted: boolean) {
    this.isMuted = muted;
  }

  /**
   * Limpieza de contextos de audio
   */
  private cleanupAudio() {
    this.stopAudioPlayback();

    if (this.scriptProcessor) {
      this.scriptProcessor.disconnect();
      this.scriptProcessor = null;
    }

    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }

    if (this.inputAudioCtx) {
      this.inputAudioCtx.close().catch(() => {});
      this.inputAudioCtx = null;
    }

    if (this.outputAudioCtx) {
      this.outputAudioCtx.close().catch(() => {});
      this.outputAudioCtx = null;
    }
  }

  /**
   * Desconecta completamente la sesión Live
   */
  public disconnect() {
    this.cleanupAudio();

    if (this.ws) {
      try {
        this.ws.close();
      } catch (_) {}
      this.ws = null;
    }

    this.setState('idle');
  }
}
