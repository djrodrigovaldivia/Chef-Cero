/**
 * Cliente para Gemini 3.8 Live API (Streaming Bidireccional de Audio en Tiempo Real)
 * Arquitectura de Latencia Mínima Física en la Web con Inteligencia Tonal y Paciencia Adaptativa:
 * - AudioContext con latencyHint: 'interactive' para hardware audio scheduling prioritario
 * - Micro-chunks de 512 muestras (~32ms a 16kHz) coincidiendo exactamente con la ventana de Google Live API (20-40ms)
 * - Streaming binario nativo (Int16Array ArrayBuffer) por WebSocket sin overhead de serialización base64
 * - Análisis acústico en tiempo real: Detección de volumen RMS, picos, tono emocional (gritando/urgencia, pensativo, pregunta, calmado)
 * - Detección de silencios y pausas reflexivas para no cortar al usuario mientras piensa
 * - Medición continua de RTT y Jitter de red en tiempo real (Ping/Pong de alta frecuencia)
 * - Programación temporal sobre AudioContext Hardware Clock con micro-jitter buffer de 15ms
 * - Interrupción instantánea del audio al hablar el usuario (Barge-in con cancelación de buffers en hardware)
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

export type NetworkQuality = 'excelente' | 'buena' | 'moderada' | 'lenta';

export type DetectedVoiceTone = 'calmado' | 'pensando' | 'gritando_urgencia' | 'pregunta';

export type PatienceMode = 'zen' | 'equilibrado' | 'rapido';

export interface GeminiLiveOptions {
  onStateChange?: (state: LiveClientState) => void;
  onUserTranscript?: (text: string) => void;
  onChefTranscript?: (chunk: string) => void;
  onTurnComplete?: () => void;
  onError?: (errMessage: string) => void;
  onAudioLevel?: (level: number) => void;
  onLatencyMeasured?: (rttMs: number, quality: NetworkQuality, jitterMs: number) => void;
  onToneDetected?: (tone: DetectedVoiceTone, level: number) => void;
  onSilenceThinking?: (isThinking: boolean, silenceMs: number) => void;
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

  // Medición de Latencia en tiempo real
  private pingInterval: any = null;
  private recentRtts: number[] = [];

  // Análisis Acústico y Detección de Tono en Vivo
  private consecutiveSilenceChunks = 0;
  private recentRmsLevels: number[] = [];
  private currentDetectedTone: DetectedVoiceTone = 'calmado';
  private wasSpeakingBeforeSilence = false;
  private patienceMode: PatienceMode = 'zen';

  constructor(options: GeminiLiveOptions) {
    this.options = options;
  }

  public getState(): LiveClientState {
    return this.state;
  }

  public setPatienceMode(mode: PatienceMode) {
    this.patienceMode = mode;
  }

  private setState(newState: LiveClientState) {
    this.state = newState;
    this.options.onStateChange?.(newState);
  }

  /**
   * Conecta al endpoint WebSocket de Gemini 3.8 Live API y activa micrófono con latencia ultra-baja
   */
  public async connect(): Promise<boolean> {
    try {
      this.setState('connecting');

      // 1. Obtener acceso al micrófono con configuración de latencia mínima de hardware
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
          sampleRate: 16000,
          latency: 0,
        } as any,
      });

      // 2. Conectar WebSocket a /api/live con soporte para ArrayBuffer binario
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/api/live`;
      this.ws = new WebSocket(wsUrl);
      this.ws.binaryType = 'arraybuffer';

      // 3. Inicializar AudioContexts de entrada (16kHz) y salida (24kHz) con latencyHint: 'interactive'
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.inputAudioCtx = new AudioCtx({ sampleRate: 16000, latencyHint: 'interactive' });
      this.outputAudioCtx = new AudioCtx({ sampleRate: 24000, latencyHint: 'interactive' });

      if (this.outputAudioCtx.state === 'suspended') {
        await this.outputAudioCtx.resume();
      }
      if (this.inputAudioCtx.state === 'suspended') {
        await this.inputAudioCtx.resume();
      }

      this.ws.onopen = () => {
        console.log('Chef Cero Live: WebSocket abierto con Gemini 3.8 Live (Streaming Binario 32ms + Análisis Tonal)');
        this.setState('connected');
        this.startMicrophoneCapture();
        this.startPingHeartbeat();
      };

      this.ws.onmessage = (event) => {
        try {
          if (typeof event.data === 'string') {
            const msg = JSON.parse(event.data);
            this.handleServerMessage(msg);
          }
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
   * Ciclo de Ping/Pong para medir Latencia RTT de Red y Jitter en tiempo real
   */
  private startPingHeartbeat() {
    this.stopPingHeartbeat();
    this.sendPing();
    this.pingInterval = setInterval(() => {
      this.sendPing();
    }, 2500);
  }

  private stopPingHeartbeat() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private sendPing() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(
        JSON.stringify({
          type: 'ping',
          clientTime: performance.now(),
        })
      );
    }
  }

  /**
   * Captura el audio del micrófono a 16kHz y lo transmite en micro-chunks de 512 muestras (~32ms)
   * Analiza continuamente energía RMS, tono emocional y pausas reflexivas de pensamiento.
   */
  private startMicrophoneCapture() {
    if (!this.inputAudioCtx || !this.mediaStream) return;

    try {
      this.sourceNode = this.inputAudioCtx.createMediaStreamSource(this.mediaStream);
      // Micro-buffer de 512 muestras (~32ms a 16kHz) para la mínima latencia física posible en web
      this.scriptProcessor = this.inputAudioCtx.createScriptProcessor(512, 1, 1);

      this.sourceNode.connect(this.scriptProcessor);
      this.scriptProcessor.connect(this.inputAudioCtx.destination);

      this.scriptProcessor.onaudioprocess = (e) => {
        if (this.isMuted || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;

        const inputData = e.inputBuffer.getChannelData(0);
        const len = inputData.length;

        // 1. Calcular volumen eficaz (RMS) y pico máximo
        let sumSquares = 0;
        let peak = 0;
        let zeroCrossings = 0;

        for (let i = 0; i < len; i++) {
          const sample = inputData[i];
          const abs = Math.abs(sample);
          if (abs > peak) peak = abs;
          sumSquares += sample * sample;
          if (i > 0 && ((inputData[i] >= 0 && inputData[i - 1] < 0) || (inputData[i] < 0 && inputData[i - 1] >= 0))) {
            zeroCrossings++;
          }
        }

        const rms = Math.sqrt(sumSquares / len);
        const visualLevel = Math.min(1, rms * 5);
        this.options.onAudioLevel?.(visualLevel);

        // Guardar historial para media móvil de RMS
        this.recentRmsLevels.push(rms);
        if (this.recentRmsLevels.length > 20) this.recentRmsLevels.shift();

        // 2. Detección de silencios y comprensión de pausas reflexivas ("pensando")
        const isSilentChunk = rms < 0.02;
        if (isSilentChunk) {
          this.consecutiveSilenceChunks++;
          const silenceMs = this.consecutiveSilenceChunks * 32;

          // Si el usuario venía hablando y ahora guarda silencio entre 250ms y 3500ms -> Está pensando
          if (this.wasSpeakingBeforeSilence && silenceMs > 250 && silenceMs < 3500) {
            this.currentDetectedTone = 'pensando';
            this.options.onSilenceThinking?.(true, silenceMs);
            this.options.onToneDetected?.('pensando', visualLevel);
          } else if (silenceMs >= 3500) {
            this.options.onSilenceThinking?.(false, silenceMs);
            this.wasSpeakingBeforeSilence = false;
          }
        } else {
          // Usuario está produciendo sonido vocal
          this.consecutiveSilenceChunks = 0;
          this.options.onSilenceThinking?.(false, 0);

          if (rms > 0.04) {
            this.wasSpeakingBeforeSilence = true;
          }

          // 3. Clasificación de Tono de Voz y Emoción Acústica
          let newTone: DetectedVoiceTone = 'calmado';

          // Grito o alarma aguda (ej: "¡SE ME QUEMA!", "¡CUIDADO!", volumen elevado o pico alto)
          if (peak > 0.65 || rms > 0.22) {
            newTone = 'gritando_urgencia';
          } else if (zeroCrossings > 110 && rms > 0.05) {
            // Frecuencia alta / inflexión interrogativa
            newTone = 'pregunta';
          } else if (rms < 0.05 && this.wasSpeakingBeforeSilence) {
            newTone = 'pensando';
          } else {
            newTone = 'calmado';
          }

          if (newTone !== this.currentDetectedTone) {
            this.currentDetectedTone = newTone;
            this.options.onToneDetected?.(newTone, visualLevel);
            // Notificar al WebSocket sobre el cambio de tono del usuario para que el Chef adapte su respuesta
            this.sendToneUpdate(newTone);
          }
        }

        // 4. Convertir Float32 a Int16 PCM little-endian
        const int16Array = new Int16Array(len);
        for (let i = 0; i < len; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]));
          int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }

        // 5. Transmisión binaria directa de latencia cero por WebSocket
        this.ws.send(int16Array.buffer);
      };

      this.setState('listening');
    } catch (e: any) {
      console.warn('Chef Cero Live: Error iniciando procesador de micrófono:', e);
    }
  }

  /**
   * Envía actualización de tono detectado al servidor WebSocket
   */
  public sendToneUpdate(tone: DetectedVoiceTone) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(
        JSON.stringify({
          type: 'tone_update',
          tone,
        })
      );
    }
  }

  /**
   * Procesa mensajes entrantes del servidor Gemini Live
   */
  private handleServerMessage(msg: any) {
    switch (msg.type) {
      case 'pong':
        if (typeof msg.clientTime === 'number') {
          const rtt = Math.round(performance.now() - msg.clientTime);
          this.recentRtts.push(rtt);
          if (this.recentRtts.length > 5) this.recentRtts.shift();

          const avgRtt = Math.round(this.recentRtts.reduce((a, b) => a + b, 0) / this.recentRtts.length);
          const jitter = Math.abs(rtt - avgRtt);

          let quality: NetworkQuality = 'excelente';
          if (avgRtt > 350) quality = 'lenta';
          else if (avgRtt > 220) quality = 'moderada';
          else if (avgRtt > 100) quality = 'buena';

          this.options.onLatencyMeasured?.(avgRtt, quality, jitter);
        }
        break;

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
   * Reproduce trozos de audio PCM 24kHz sin huecos con programación directa en el reloj de hardware
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
      // Micro lookahead de 15ms para evitar cualquier jitter o clic de audio
      if (this.nextStartTime < currentTime) {
        this.nextStartTime = currentTime + 0.015;
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
   * Detiene la reproducción de audio inmediatamente a nivel de hardware clock (Barge-in)
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
    this.stopPingHeartbeat();
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
