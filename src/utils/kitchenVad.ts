/**
 * ============================================================================
 * CHEF CERO - FILTRO VAD RESILIENTE AL RUIDO DE COCINA (Noise-Resilient VAD)
 * ============================================================================
 * Discrimina ruidos de alta frecuencia y ruidos estocásticos de cocina
 * (siseo de fritura en sartén ~3.5kHz-8kHz, campana extractora de humo ~500Hz-2kHz,
 * agua del grifo corriendo) de la voz humana fundamental del usuario (100Hz - 3kHz).
 * 
 * Arquitectura de Procesamiento de Señal (Web Audio API DSP):
 * 1. Preamplificación y Filtro Pasa-Banda elíptico (85Hz a 3200Hz) para descartar rumble
 *    de estufa y siseo agudo de aceite.
 * 2. Filtro Notch o Pasa-Bajos en cascada para atenuar ruido blanco de campana extractora.
 * 3. Analizador de Densidad Espectral (FFT) y Ratio Espectral de Formantes:
 *    - Calcula la energía en la banda de voz humana (300Hz - 2500Hz) versus la banda
 *      de siseo culinario (3000Hz - 9000Hz).
 *    - Ratio de Siseo (Sizzle Ratio): si > 65% de la energía está sobre 3kHz, es aceite/vapor,
 *      no una orden de voz.
 * 4. Algoritmo de Histeresis Temporal (Attack/Decay Hangover) para no cortar palabras
 *    naturales ni disparar falsos positivos con ruidos secos de cubiertos.
 */

export interface KitchenVadConfig {
  sampleRate?: number;
  fftSize?: number;
  speechEnergyThreshold?: number; // Umbral de energía RMS para habla (-40dB a -18dB)
  sizzleRatioMaxThreshold?: number; // Si la energía aguda supera este ratio, se rechaza
  attackTimeMs?: number;           // Ventana de confirmación de voz (evita clicks de cubiertos)
  releaseTimeMs?: number;          // Tiempo de gracia para pausas naturales de respiración
  onVoiceStart?: () => void;
  onVoiceEnd?: (durationMs: number) => void;
  onNoiseRejected?: (reason: 'sartén_siseo' | 'campana_extractor' | 'chasquido_cubierto') => void;
  onTelemetryUpdate?: (metrics: KitchenVadMetrics) => void;
}

export interface KitchenVadMetrics {
  isVoiceActive: boolean;
  rmsLevelDb: number;
  speechBandEnergy: number;
  sizzleBandEnergy: number;
  voiceToNoiseRatio: number;
}

export class KitchenResilientVAD {
  private audioCtx: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private analyserNode: AnalyserNode | null = null;
  private bandpassFilter: BiquadFilterNode | null = null;
  private highShelfDampener: BiquadFilterNode | null = null;
  private lowCutFilter: BiquadFilterNode | null = null;

  private config: Required<KitchenVadConfig>;
  private isProcessing = false;
  private animFrameId: number | null = null;

  // Estado interno de histeresis
  private isVoiceDetected = false;
  private consecutiveVoiceFrames = 0;
  private consecutiveSilenceFrames = 0;
  private speechStartTime = 0;

  constructor(config: KitchenVadConfig = {}) {
    this.config = {
      sampleRate: config.sampleRate || 16000,
      fftSize: config.fftSize || 512,
      speechEnergyThreshold: config.speechEnergyThreshold ?? 0.045, // ~ -27dB
      sizzleRatioMaxThreshold: config.sizzleRatioMaxThreshold ?? 0.60,
      attackTimeMs: config.attackTimeMs ?? 90,   // ~5-6 frames consecutivos a 60fps
      releaseTimeMs: config.releaseTimeMs ?? 350, // Tiempo para aguantar silencios cortos
      onVoiceStart: config.onVoiceStart || (() => {}),
      onVoiceEnd: config.onVoiceEnd || (() => {}),
      onNoiseRejected: config.onNoiseRejected || (() => {}),
      onTelemetryUpdate: config.onTelemetryUpdate || (() => {}),
    };
  }

  /**
   * Inicia la captura desde un MediaStream existente o solicita acceso al micrófono
   */
  public async start(existingStream?: MediaStream): Promise<void> {
    if (this.isProcessing) return;

    try {
      if (existingStream) {
        this.mediaStream = existingStream;
      } else {
        this.mediaStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: false, // Permitimos procesar la señal cruda con nuestro DSP culinario
            autoGainControl: true,
            channelCount: 1,
          },
        });
      }

      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      this.audioCtx = new AudioContextClass({ latencyHint: 'interactive' });
      this.sourceNode = this.audioCtx.createMediaStreamSource(this.mediaStream);

      // CADENA DSP EN SERIE:
      // 1. Filtro Pasa-Altos (85Hz) para remover vibración y rumble de refrigerador/estufa
      this.lowCutFilter = this.audioCtx.createBiquadFilter();
      this.lowCutFilter.type = 'highpass';
      this.lowCutFilter.frequency.setValueAtTime(85, this.audioCtx.currentTime);
      this.lowCutFilter.Q.setValueAtTime(0.7, this.audioCtx.currentTime);

      // 2. Filtro Pasa-Banda en formantes principales de voz (300Hz - 3400Hz)
      this.bandpassFilter = this.audioCtx.createBiquadFilter();
      this.bandpassFilter.type = 'bandpass';
      this.bandpassFilter.frequency.setValueAtTime(1400, this.audioCtx.currentTime);
      this.bandpassFilter.Q.setValueAtTime(0.55, this.audioCtx.currentTime);

      // 3. Atenuador High-Shelf (-14dB sobre 4kHz) para liquidar el siseo del aceite caliente
      this.highShelfDampener = this.audioCtx.createBiquadFilter();
      this.highShelfDampener.type = 'highshelf';
      this.highShelfDampener.frequency.setValueAtTime(3800, this.audioCtx.currentTime);
      this.highShelfDampener.gain.setValueAtTime(-14, this.audioCtx.currentTime);

      // 4. Analizador espectral de frecuencia y tiempo
      this.analyserNode = this.audioCtx.createAnalyser();
      this.analyserNode.fftSize = this.config.fftSize;
      this.analyserNode.smoothingTimeConstant = 0.3; // Suavizado rápido para transitorios

      // Conexión de la cadena de análisis
      this.sourceNode.connect(this.lowCutFilter);
      this.lowCutFilter.connect(this.highShelfDampener);
      this.highShelfDampener.connect(this.bandpassFilter);
      this.bandpassFilter.connect(this.analyserNode);
      // Ojo: no conectamos a audioCtx.destination para evitar feedback hacia los parlantes

      this.isProcessing = true;
      this.speechStartTime = 0;
      this.consecutiveVoiceFrames = 0;
      this.consecutiveSilenceFrames = 0;
      this.isVoiceDetected = false;

      this.runProcessingLoop();
    } catch (err) {
      console.warn('Chef Cero VAD: Error inicializando audio stream:', err);
      throw err;
    }
  }

  private runProcessingLoop = () => {
    if (!this.isProcessing || !this.analyserNode || !this.audioCtx) return;

    const bufferLength = this.analyserNode.frequencyBinCount;
    const freqData = new Uint8Array(bufferLength);
    const timeData = new Uint8Array(bufferLength);

    this.analyserNode.getByteFrequencyData(freqData);
    this.analyserNode.getByteTimeDomainData(timeData);

    // 1. Calcular RMS (Nivel de presión acústica general)
    let sumSquares = 0;
    for (let i = 0; i < bufferLength; i++) {
      const normalized = (timeData[i] - 128) / 128;
      sumSquares += normalized * normalized;
    }
    const rms = Math.sqrt(sumSquares / bufferLength);
    const rmsDb = 20 * Math.log10(Math.max(rms, 0.0001));

    // 2. Discriminación de Bandas Espectrales
    // Resolución por bin = (sampleRate / 2) / bufferLength (~22050 / 256 ≈ 86Hz por bin)
    const nyquist = this.audioCtx.sampleRate / 2;
    const binResolution = nyquist / bufferLength;

    let voiceEnergy = 0;
    let sizzleEnergy = 0;
    let lowRumbleEnergy = 0;

    for (let i = 0; i < bufferLength; i++) {
      const freq = i * binResolution;
      const energy = freqData[i] / 255;

      if (freq < 250) {
        lowRumbleEnergy += energy;
      } else if (freq >= 250 && freq <= 2800) {
        voiceEnergy += energy; // Banda principal de voz humana
      } else if (freq > 3200 && freq <= 9000) {
        sizzleEnergy += energy; // Siseo de sartén, freidora y agua
      }
    }

    const totalSpectralEnergy = voiceEnergy + sizzleEnergy + lowRumbleEnergy + 0.0001;
    const sizzleRatio = sizzleEnergy / totalSpectralEnergy;
    const voiceRatio = voiceEnergy / totalSpectralEnergy;

    // 3. Reglas Heurísticas de Clasificación Anti-Ruido:
    const isAboveRmsThreshold = rms >= this.config.speechEnergyThreshold;
    const isVoiceDominant = voiceEnergy > sizzleEnergy * 1.25;
    const isSizzleNoise = sizzleRatio > this.config.sizzleRatioMaxThreshold;

    let frameIsVoice = false;

    if (isAboveRmsThreshold) {
      if (isSizzleNoise && !isVoiceDominant) {
        this.config.onNoiseRejected('sartén_siseo');
      } else if (isVoiceDominant) {
        frameIsVoice = true;
      }
    }

    // 4. Histeresis de Tiempo (Attack & Release)
    const attackFrames = Math.max(1, Math.round(this.config.attackTimeMs / 16));
    const releaseFrames = Math.max(1, Math.round(this.config.releaseTimeMs / 16));

    if (frameIsVoice) {
      this.consecutiveVoiceFrames++;
      this.consecutiveSilenceFrames = 0;

      if (!this.isVoiceDetected && this.consecutiveVoiceFrames >= attackFrames) {
        this.isVoiceDetected = true;
        this.speechStartTime = performance.now();
        this.config.onVoiceStart();
      }
    } else {
      this.consecutiveSilenceFrames++;
      if (this.isVoiceDetected) {
        if (this.consecutiveSilenceFrames >= releaseFrames) {
          this.isVoiceDetected = false;
          const durationMs = performance.now() - this.speechStartTime;
          this.config.onVoiceEnd(durationMs);
          this.consecutiveVoiceFrames = 0;
        }
      } else {
        this.consecutiveVoiceFrames = 0;
      }
    }

    // 5. Enviar telemetría para orbes reactivos u osciloscopios de UI
    this.config.onTelemetryUpdate({
      isVoiceActive: this.isVoiceDetected,
      rmsLevelDb: Math.round(rmsDb),
      speechBandEnergy: Number(voiceRatio.toFixed(3)),
      sizzleBandEnergy: Number(sizzleRatio.toFixed(3)),
      voiceToNoiseRatio: Number((voiceEnergy / (sizzleEnergy + 0.001)).toFixed(2)),
    });

    this.animFrameId = requestAnimationFrame(this.runProcessingLoop);
  };

  /**
   * Detiene el VAD y libera recursos de hardware
   */
  public stop(): void {
    this.isProcessing = false;
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }

    if (this.sourceNode) {
      try { this.sourceNode.disconnect(); } catch (_) {}
      this.sourceNode = null;
    }

    if (this.audioCtx && this.audioCtx.state !== 'closed') {
      try { this.audioCtx.close(); } catch (_) {}
      this.audioCtx = null;
    }

    this.isVoiceDetected = false;
    this.consecutiveVoiceFrames = 0;
    this.consecutiveSilenceFrames = 0;
  }

  public getVoiceState(): boolean {
    return this.isVoiceDetected;
  }
}
