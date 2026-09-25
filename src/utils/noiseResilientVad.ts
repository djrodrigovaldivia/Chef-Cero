/**
 * ============================================================================
 * CHEF CERO - NOISE-RESILIENT VAD (AUDIO WORKLET PROCESSOR)
 * ============================================================================
 * 
 * Filtro VAD de alta precisión ejecutado en el hilo de renderizado de audio de
 * bajo nivel (AudioWorkletGlobalScope) para evitar bloqueos del hilo principal (UI).
 * 
 * Etapas de Procesamiento Acústico DSP (Diseñado para ruidos hostiles de cocina):
 * 1. Filtro Pasa-Altos / Low-Cut (< 85Hz) de 2º orden:
 *    Elimina el zumbido eléctrico residual (mains hum 50/60Hz), vibración de la encimera
 *    y rumble sordo de compresores de refrigerador o turbinas.
 * 
 * 2. Filtro Pasa-Banda (300Hz - 3400Hz) Biquad IIR:
 *    Aísla la banda telefónica estándar donde se concentra el 95% de los formantes
 *    vocales inteligibles del habla humana. Atenúa siseos de sartenes (frying hiss > 3.5kHz),
 *    vapor de ollas express y chorros de agua.
 * 
 * 3. Estimación Dinámica del Piso de Ruido (Dynamic Noise Floor Tracking):
 *    Utiliza un seguidor de envolvente asimétrico adaptativo:
 *    - Si el nivel actual es menor que el piso estimado, desciende rápido (tracking de silencios).
 *    - Si el nivel sube, el piso asciende muy lentamente (evita que la voz humana altere el piso).
 *    - SNR Adaptativo: Determina actividad vocal cuando el ratio Señal/Ruido (SNR) supera el umbral dinámico.
 * 
 * 4. Histeresis Temporal (Attack / Release Hangover):
 *    - Ventana de confirmación de ataque (evita disparos por golpes accidentales de cubiertos).
 *    - Ventana de sostén / release (previene cortes bruscos en pausas naturales de respiración).
 */

export interface NoiseResilientVadConfig {
  sampleRate?: number;
  snrThresholdDb?: number;      // Mínimo dB sobre el piso de ruido para considerar habla (~8dB a 14dB)
  attackFrames?: number;        // Chunks consecutivos para disparar inicio de voz (~60-90ms)
  releaseFrames?: number;       // Chunks de gracia antes de declarar fin de voz (~250-400ms)
  minSpeechDurationMs?: number; // Descartar impulsos muy cortos (ej: choque de platos < 120ms)
  onVoiceStart?: () => void;
  onVoiceEnd?: (durationMs: number) => void;
  onNoiseFloorUpdate?: (noiseFloorDb: number, currentSignalDb: number, snrDb: number) => void;
  onAudioLevel?: (level: number) => void;
}

export interface VadStatusMetrics {
  isVoiceActive: boolean;
  signalDb: number;
  noiseFloorDb: number;
  snrDb: number;
  speechBandEnergy: number;
}

/**
 * Código fuente inline del AudioWorkletProcessor.
 * Se registra mediante Blob URL para garantizar portabilidad en Vite sin depender de rutas estáticas externas.
 */
const NOISE_RESILIENT_WORKLET_CODE = `
class NoiseResilientVadProcessor extends AudioWorkletProcessor {
  constructor() {
    super();

    this.sampleRate = 16000; // Por defecto; se recalcula en process
    
    // Coeficientes Biquad Low-Cut (< 85Hz, Butterworth Q=0.707)
    this.lowCut = {
      b0: 1, b1: 0, b2: 0, a1: 0, a2: 0,
      x1: 0, x2: 0, y1: 0, y2: 0
    };

    // Coeficientes Biquad Pasa-Banda (300Hz - 3400Hz)
    // Usamos cascada de Pasa-Altos (300Hz) + Pasa-Bajos (3400Hz) para máxima atenuación
    this.highPass300 = {
      b0: 1, b1: 0, b2: 0, a1: 0, a2: 0,
      x1: 0, x2: 0, y1: 0, y2: 0
    };

    this.lowPass3400 = {
      b0: 1, b1: 0, b2: 0, a1: 0, a2: 0,
      x1: 0, x2: 0, y1: 0, y2: 0
    };

    // Seguimiento Dinámico del Piso de Ruido
    this.noiseFloorLinear = 0.005; // ~ -46 dB inicial
    this.alphaNoiseUp = 0.0004;    // El piso sube muy lentamente ante ruidos sostenidos
    this.alphaNoiseDown = 0.008;   // El piso baja ágilmente cuando la cocina queda en silencio
    this.snrThresholdLinear = 2.5; // ~8 dB SNR mínimo

    // Estado temporal e histeresis
    this.isSpeaking = false;
    this.voiceCounter = 0;
    this.silenceCounter = 0;
    this.attackFrames = 6;    // ~48ms (cada frame son 128 muestras = 8ms a 16kHz)
    this.releaseFrames = 30;  // ~240ms de hangover
    this.speechStartTimestamp = 0;

    this.initializedFilters = false;

    this.port.onmessage = (e) => {
      const { type, payload } = e.data;
      if (type === 'configure') {
        if (payload.attackFrames) this.attackFrames = payload.attackFrames;
        if (payload.releaseFrames) this.releaseFrames = payload.releaseFrames;
        if (payload.snrThresholdDb) {
          this.snrThresholdLinear = Math.pow(10, payload.snrThresholdDb / 20);
        }
      }
    };
  }

  computeBiquadHighPass(freq, q, sr) {
    const w0 = 2 * Math.PI * (freq / sr);
    const cosw0 = Math.cos(w0);
    const alpha = Math.sin(w0) / (2 * q);

    const b0 = (1 + cosw0) / 2;
    const b1 = -(1 + cosw0);
    const b2 = (1 + cosw0) / 2;
    const a0 = 1 + alpha;
    const a1 = -2 * cosw0;
    const a2 = 1 - alpha;

    return {
      b0: b0 / a0,
      b1: b1 / a0,
      b2: b2 / a0,
      a1: a1 / a0,
      a2: a2 / a0,
      x1: 0, x2: 0, y1: 0, y2: 0
    };
  }

  computeBiquadLowPass(freq, q, sr) {
    const w0 = 2 * Math.PI * (freq / sr);
    const cosw0 = Math.cos(w0);
    const alpha = Math.sin(w0) / (2 * q);

    const b0 = (1 - cosw0) / 2;
    const b1 = 1 - cosw0;
    const b2 = (1 - cosw0) / 2;
    const a0 = 1 + alpha;
    const a1 = -2 * cosw0;
    const a2 = 1 - alpha;

    return {
      b0: b0 / a0,
      b1: b1 / a0,
      b2: b2 / a0,
      a1: a1 / a0,
      a2: a2 / a0,
      x1: 0, x2: 0, y1: 0, y2: 0
    };
  }

  initFilters(sr) {
    this.sampleRate = sr;
    // 1. Low Cut < 85 Hz
    this.lowCut = this.computeBiquadHighPass(85, 0.707, sr);
    // 2. High Pass 300 Hz (límite inferior banda vocal)
    this.highPass300 = this.computeBiquadHighPass(300, 0.707, sr);
    // 3. Low Pass 3400 Hz (límite superior banda vocal, filtra siseo de sartén > 3.5kHz)
    this.lowPass3400 = this.computeBiquadLowPass(3400, 0.707, sr);
    this.initializedFilters = true;
  }

  processBiquad(sample, f) {
    const y = f.b0 * sample + f.b1 * f.x1 + f.b2 * f.x2 - f.a1 * f.y1 - f.a2 * f.y2;
    f.x2 = f.x1;
    f.x1 = sample;
    f.y2 = f.y1;
    f.y1 = y;
    return y;
  }

  process(inputs, outputs) {
    const input = inputs[0];
    if (!input || !input[0] || input[0].length === 0) return true;

    const channelData = input[0];
    const len = channelData.length;

    if (!this.initializedFilters || this.sampleRate !== globalThis.sampleRate) {
      this.initFilters(globalThis.sampleRate || 16000);
    }

    let rawSumSquares = 0;
    let filteredSumSquares = 0;

    for (let i = 0; i < len; i++) {
      const rawSample = channelData[i];
      rawSumSquares += rawSample * rawSample;

      // Etapa 1: Low-cut (< 85Hz)
      const afterLowCut = this.processBiquad(rawSample, this.lowCut);
      // Etapa 2: Pasa-Altos 300Hz
      const afterHP300 = this.processBiquad(afterLowCut, this.highPass300);
      // Etapa 3: Pasa-Bajos 3400Hz -> Banda de Voz Limpia (300Hz - 3400Hz)
      const speechFiltered = this.processBiquad(afterHP300, this.lowPass3400);

      filteredSumSquares += speechFiltered * speechFiltered;
    }

    const filteredRms = Math.sqrt(filteredSumSquares / len);

    // Seguimiento Dinámico del Piso de Ruido Asimétrico
    if (filteredRms < this.noiseFloorLinear) {
      this.noiseFloorLinear = (1 - this.alphaNoiseDown) * this.noiseFloorLinear + this.alphaNoiseDown * filteredRms;
    } else {
      this.noiseFloorLinear = (1 - this.alphaNoiseUp) * this.noiseFloorLinear + this.alphaNoiseUp * filteredRms;
    }
    // Asegurar piso mínimo para evitar división por cero
    if (this.noiseFloorLinear < 0.0005) this.noiseFloorLinear = 0.0005;

    // Cálculo de Relación Señal a Ruido (SNR)
    const currentSnr = filteredRms / this.noiseFloorLinear;
    const isInstantaneousVoice = currentSnr > this.snrThresholdLinear && filteredRms > 0.008;

    // Máquina de estados con Attack/Release Hangover
    if (isInstantaneousVoice) {
      this.voiceCounter++;
      this.silenceCounter = 0;

      if (!this.isSpeaking && this.voiceCounter >= this.attackFrames) {
        this.isSpeaking = true;
        this.speechStartTimestamp = currentTime;
        this.port.postMessage({ type: 'voice_start' });
      }
    } else {
      this.silenceCounter++;
      this.voiceCounter = 0;

      if (this.isSpeaking && this.silenceCounter >= this.releaseFrames) {
        this.isSpeaking = false;
        const durationMs = Math.round((currentTime - this.speechStartTimestamp) * 1000);
        this.port.postMessage({ type: 'voice_end', durationMs });
      }
    }

    // Telemetría periódica hacia el hilo principal cada ~10 bloques (~80ms)
    if (Math.random() < 0.1) {
      const signalDb = Math.round(20 * Math.log10(Math.max(filteredRms, 0.00001)));
      const noiseFloorDb = Math.round(20 * Math.log10(this.noiseFloorLinear));
      const snrDb = Math.round(20 * Math.log10(Math.max(currentSnr, 1)));

      this.port.postMessage({
        type: 'telemetry',
        metrics: {
          isVoiceActive: this.isSpeaking,
          signalDb,
          noiseFloorDb,
          snrDb,
          speechBandEnergy: filteredRms
        }
      });
    }

    return true;
  }
}

registerProcessor('noise-resilient-vad-processor', NoiseResilientVadProcessor);
`;

export class NoiseResilientVad {
  private audioCtx: AudioContext | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private mediaStream: MediaStream | null = null;
  private isRunning = false;
  private config: Required<NoiseResilientVadConfig>;
  private workletBlobUrl: string | null = null;

  constructor(config: NoiseResilientVadConfig = {}) {
    this.config = {
      sampleRate: config.sampleRate || 16000,
      snrThresholdDb: config.snrThresholdDb ?? 9, // 9 dB por encima del piso de ruido de la cocina
      attackFrames: config.attackFrames ?? 6,     // ~50ms
      releaseFrames: config.releaseFrames ?? 30,  // ~240ms de gracia
      minSpeechDurationMs: config.minSpeechDurationMs ?? 100,
      onVoiceStart: config.onVoiceStart || (() => {}),
      onVoiceEnd: config.onVoiceEnd || (() => {}),
      onNoiseFloorUpdate: config.onNoiseFloorUpdate || (() => {}),
      onAudioLevel: config.onAudioLevel || (() => {}),
    };
  }

  /**
   * Inicializa el AudioWorkletNode y conecta el flujo de entrada
   */
  public async start(stream?: MediaStream): Promise<boolean> {
    if (this.isRunning) return true;

    try {
      if (stream) {
        this.mediaStream = stream;
      } else {
        this.mediaStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            channelCount: 1,
            sampleRate: this.config.sampleRate,
            echoCancellation: true,
            noiseSuppression: false, // Permitimos a nuestro DSP aislar la banda completa
            autoGainControl: true,
          },
        });
      }

      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      this.audioCtx = new AudioCtxClass({
        sampleRate: this.config.sampleRate,
        latencyHint: 'interactive',
      });

      if (this.audioCtx.state === 'suspended') {
        await this.audioCtx.resume();
      }

      // Carga dinámica del AudioWorkletProcessor vía Blob URL
      const blob = new Blob([NOISE_RESILIENT_WORKLET_CODE], { type: 'application/javascript' });
      this.workletBlobUrl = URL.createObjectURL(blob);
      await this.audioCtx.audioWorklet.addModule(this.workletBlobUrl);

      this.sourceNode = this.audioCtx.createMediaStreamSource(this.mediaStream);
      this.workletNode = new AudioWorkletNode(this.audioCtx, 'noise-resilient-vad-processor');

      // Configurar parámetros iniciales en el hilo de renderizado
      this.workletNode.port.postMessage({
        type: 'configure',
        payload: {
          snrThresholdDb: this.config.snrThresholdDb,
          attackFrames: this.config.attackFrames,
          releaseFrames: this.config.releaseFrames,
        },
      });

      // Receptor de eventos desde el AudioWorklet
      this.workletNode.port.onmessage = (e) => {
        const { type, durationMs, metrics } = e.data;

        if (type === 'voice_start') {
          this.config.onVoiceStart();
        } else if (type === 'voice_end') {
          if (!this.config.minSpeechDurationMs || durationMs >= this.config.minSpeechDurationMs) {
            this.config.onVoiceEnd(durationMs);
          }
        } else if (type === 'telemetry' && metrics) {
          this.config.onNoiseFloorUpdate(metrics.noiseFloorDb, metrics.signalDb, metrics.snrDb);
          const normalizedLevel = Math.min(1, Math.max(0, (metrics.signalDb + 50) / 45));
          this.config.onAudioLevel(normalizedLevel);
        }
      };

      this.sourceNode.connect(this.workletNode);
      // Conectar a destination con nodo mudo o dejarlo procesando (los Worklets no necesitan destination si no emiten)
      this.isRunning = true;
      return true;
    } catch (err) {
      console.warn('Chef Cero: Error al inicializar AudioWorklet NoiseResilientVad:', err);
      this.stop();
      return false;
    }
  }

  /**
   * Detiene el procesador y libera recursos de audio
   */
  public stop(): void {
    this.isRunning = false;

    if (this.workletNode) {
      try {
        this.workletNode.disconnect();
      } catch (_) {}
      this.workletNode = null;
    }

    if (this.sourceNode) {
      try {
        this.sourceNode.disconnect();
      } catch (_) {}
      this.sourceNode = null;
    }

    if (this.audioCtx && this.audioCtx.state !== 'closed') {
      try {
        this.audioCtx.close();
      } catch (_) {}
      this.audioCtx = null;
    }

    if (this.workletBlobUrl) {
      try {
        URL.revokeObjectURL(this.workletBlobUrl);
      } catch (_) {}
      this.workletBlobUrl = null;
    }
  }

  public getIsRunning(): boolean {
    return this.isRunning;
  }
}
