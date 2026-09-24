/**
 * Módulo de Reconocimiento de Voz Continuo Manos Sucias (Estilo SideChef)
 * Optimizado para Ultra-Baja Latencia (< 50ms):
 * - interimResults: true para disparo instantáneo en la primera sílaba/palabra reconocida
 * - Cooldown anti-rebote inteligente (750ms) para evitar disparos dobles
 * - Detección exhaustiva de sinónimos de cocina y modismos
 * - Recuperación automática de conexión ante caídas del motor de voz
 */

export interface HandsFreeVoiceCallbacks {
  onNextStep: () => void;
  onPrevStep: () => void;
  onRepeatStep: () => void;
  onStartTimer: () => void;
  onPauseTimer: () => void;
  onEmergency: () => void;
  onStatusChange?: (isListening: boolean, lastHeardWord?: string) => void;
  onCommandExecuted?: (commandName: string, transcript: string) => void;
}

export class HandsFreeCookingListener {
  private recognition: any = null;
  private isExplicitlyStopped = false;
  private callbacks: HandsFreeVoiceCallbacks;
  private isListening = false;
  private lastTriggeredTime = 0;
  private readonly COOLDOWN_MS = 750; // Anti-rebote para comandos en streaming

  constructor(callbacks: HandsFreeVoiceCallbacks) {
    this.callbacks = callbacks;
    this.initSpeechRecognition();
  }

  private initSpeechRecognition() {
    if (typeof window === 'undefined') return;

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      console.warn('Chef Cero: SpeechRecognition no está soportado en este navegador.');
      return;
    }

    try {
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = true;
      // ULTRA-BAJA LATENCIA: true para no esperar pausas de silencio
      this.recognition.interimResults = true;
      this.recognition.lang = 'es-419'; // Español latinoamericano neutro
      this.recognition.maxAlternatives = 1;

      this.recognition.onstart = () => {
        this.isListening = true;
        this.callbacks.onStatusChange?.(true);
      };

      this.recognition.onend = () => {
        this.isListening = false;
        this.callbacks.onStatusChange?.(false);
        // Si no se detuvo intencionalmente, reconectar de inmediato para mantener manos libres activo
        if (!this.isExplicitlyStopped) {
          setTimeout(() => {
            try {
              if (!this.isExplicitlyStopped && this.recognition) {
                this.recognition.start();
              }
            } catch {}
          }, 200);
        }
      };

      this.recognition.onerror = (event: any) => {
        if (event.error !== 'no-speech' && event.error !== 'aborted') {
          console.warn('Chef Cero Hands-Free voice error:', event.error);
        }
      };

      this.recognition.onresult = (event: any) => {
        const resultCount = event.results.length;
        for (let i = event.resultIndex; i < resultCount; i++) {
          const res = event.results[i];
          const transcript = res[0]?.transcript?.toLowerCase()?.trim() || '';
          if (!transcript) continue;

          this.callbacks.onStatusChange?.(true, transcript);
          const executed = this.processCommand(transcript);
          if (executed) {
            // Si ya se disparó la acción para este fragmento, no procesar más hasta el siguiente turno
            break;
          }
        }
      };
    } catch (e) {
      console.warn('Chef Cero: Error instanciando SpeechRecognition:', e);
    }
  }

  /**
   * Evalúa la transcripción entrante y ejecuta el comando de inmediato
   * Retorna true si un comando fue ejecutado
   */
  private processCommand(text: string): boolean {
    const now = Date.now();
    if (now - this.lastTriggeredTime < this.COOLDOWN_MS) {
      return false;
    }

    const t = text.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); // Sin tildes para matching veloz

    // 1. Siguiente paso (Avanzar en la receta)
    if (
      t.includes('siguiente') ||
      t.includes('avanza') ||
      t.includes('avanzar') ||
      t.includes('continua') ||
      t.includes('adelante') ||
      t.includes('proximo') ||
      t.includes('ya esta') ||
      t.includes('listo') ||
      t.includes('dale')
    ) {
      this.lastTriggeredTime = now;
      this.callbacks.onCommandExecuted?.('siguiente', text);
      this.callbacks.onNextStep();
      return true;
    }

    // 2. Paso anterior (Retroceder)
    if (
      t.includes('anterior') ||
      t.includes('atras') ||
      t.includes('retrocede') ||
      t.includes('volver') ||
      t.includes('regresa') ||
      t.includes('previo')
    ) {
      this.lastTriggeredTime = now;
      this.callbacks.onCommandExecuted?.('anterior', text);
      this.callbacks.onPrevStep();
      return true;
    }

    // 3. Repetir lectura del paso
    if (
      t.includes('repetir') ||
      t.includes('leelo') ||
      t.includes('lee') ||
      t.includes('repite') ||
      t.includes('no escuche') ||
      t.includes('que hago') ||
      t.includes('otra vez')
    ) {
      this.lastTriggeredTime = now;
      this.callbacks.onCommandExecuted?.('repetir', text);
      this.callbacks.onRepeatStep();
      return true;
    }

    // 4. Temporizador (Arrancar cronómetro del paso actual)
    if (
      t.includes('tiempo') ||
      t.includes('temporizador') ||
      t.includes('cronometro') ||
      t.includes('iniciar') ||
      t.includes('arranca') ||
      t.includes('empieza') ||
      t.includes('cuenta regresiva')
    ) {
      this.lastTriggeredTime = now;
      this.callbacks.onCommandExecuted?.('temporizador', text);
      this.callbacks.onStartTimer();
      return true;
    }

    // 5. Pausar cronómetros
    if (
      t.includes('pausa') ||
      t.includes('parar') ||
      t.includes('detener') ||
      t.includes('alto') ||
      t.includes('para') ||
      t.includes('frena')
    ) {
      this.lastTriggeredTime = now;
      this.callbacks.onCommandExecuted?.('pausa', text);
      this.callbacks.onPauseTimer();
      return true;
    }

    // 6. Emergencia S.O.S. (Humo, fuego, quemado)
    if (
      t.includes('emergencia') ||
      t.includes('socorro') ||
      t.includes('humo') ||
      t.includes('se quema') ||
      t.includes('fuego') ||
      t.includes('auxilio') ||
      t.includes('ayuda') ||
      t.includes('sos')
    ) {
      this.lastTriggeredTime = now;
      this.callbacks.onCommandExecuted?.('emergencia', text);
      this.callbacks.onEmergency();
      return true;
    }

    return false;
  }

  public start() {
    this.isExplicitlyStopped = false;
    if (this.recognition && !this.isListening) {
      try {
        this.recognition.start();
      } catch (err) {
        console.warn('Chef Cero: Error iniciando escucha manos libres:', err);
      }
    }
  }

  public stop() {
    this.isExplicitlyStopped = true;
    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
      } catch {}
    }
  }

  public getStatus() {
    return this.isListening;
  }
}
