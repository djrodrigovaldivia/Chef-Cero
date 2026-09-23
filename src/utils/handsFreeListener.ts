/**
 * Módulo de Reconocimiento de Voz Continuo Manos Libres (Estilo SideChef)
 * Permite al usuario hablarle a la cocina con las manos sucias:
 * - "Siguiente" / "Avanzar" -> pasa al siguiente paso.
 * - "Atrás" / "Anterior" -> vuelve al paso previo.
 * - "Repetir" / "Léelo" -> vuelve a leer el paso actual.
 * - "Temporizador" / "Tiempo" -> arranca el cronómetro del paso.
 * - "Pausa" / "Parar" -> pausa los temporizadores.
 * - "S.O.S." / "Humo" / "Ayuda" -> abre la pantalla de emergencias.
 */

export interface HandsFreeVoiceCallbacks {
  onNextStep: () => void;
  onPrevStep: () => void;
  onRepeatStep: () => void;
  onStartTimer: () => void;
  onPauseTimer: () => void;
  onEmergency: () => void;
  onStatusChange?: (isListening: boolean, lastHeardWord?: string) => void;
}

export class HandsFreeCookingListener {
  private recognition: any = null;
  private isExplicitlyStopped = false;
  private callbacks: HandsFreeVoiceCallbacks;
  private isListening = false;

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
      this.recognition.interimResults = false;
      this.recognition.lang = 'es-ES';

      this.recognition.onstart = () => {
        this.isListening = true;
        this.callbacks.onStatusChange?.(true);
      };

      this.recognition.onend = () => {
        this.isListening = false;
        this.callbacks.onStatusChange?.(false);
        // Si no se detuvo intencionalmente, reconectar para mantener manos libres activo
        if (!this.isExplicitlyStopped) {
          setTimeout(() => {
            try {
              if (!this.isExplicitlyStopped && this.recognition) {
                this.recognition.start();
              }
            } catch {}
          }, 400);
        }
      };

      this.recognition.onerror = (event: any) => {
        // Ignorar "no-speech" normal en cocinas silenciosas
        if (event.error !== 'no-speech' && event.error !== 'aborted') {
          console.warn('Chef Cero Hands-Free voice error:', event.error);
        }
      };

      this.recognition.onresult = (event: any) => {
        const lastIndex = event.results.length - 1;
        const transcript = event.results[lastIndex][0].transcript.toLowerCase().trim();
        console.log('Chef Cero escuchó comando:', transcript);
        this.callbacks.onStatusChange?.(true, transcript);

        this.processCommand(transcript);
      };
    } catch (e) {
      console.warn('Chef Cero: Error instanciando SpeechRecognition:', e);
    }
  }

  private processCommand(text: string) {
    // 1. Siguiente paso
    if (
      text.includes('siguiente') ||
      text.includes('avanzar') ||
      text.includes('continua') ||
      text.includes('adelante') ||
      text.includes('próximo') ||
      text.includes('ya está') ||
      text.includes('listo')
    ) {
      this.callbacks.onNextStep();
      return;
    }

    // 2. Paso anterior
    if (text.includes('anterior') || text.includes('atrás') || text.includes('retrocede') || text.includes('volver')) {
      this.callbacks.onPrevStep();
      return;
    }

    // 3. Repetir lectura del paso
    if (
      text.includes('repetir') ||
      text.includes('léelo') ||
      text.includes('lee') ||
      text.includes('repite') ||
      text.includes('no escuché') ||
      text.includes('qué hago')
    ) {
      this.callbacks.onRepeatStep();
      return;
    }

    // 4. Temporizador
    if (
      text.includes('tiempo') ||
      text.includes('temporizador') ||
      text.includes('cronómetro') ||
      text.includes('iniciar') ||
      text.includes('arranca') ||
      text.includes('empieza')
    ) {
      this.callbacks.onStartTimer();
      return;
    }

    // 5. Pausar
    if (text.includes('pausa') || text.includes('parar') || text.includes('detener') || text.includes('alto')) {
      this.callbacks.onPauseTimer();
      return;
    }

    // 6. Emergencia S.O.S.
    if (
      text.includes('emergencia') ||
      text.includes('socorro') ||
      text.includes('humo') ||
      text.includes('se quema') ||
      text.includes('fuego') ||
      text.includes('auxilio') ||
      text.includes('ayuda')
    ) {
      this.callbacks.onEmergency();
      return;
    }
  }

  public start() {
    this.isExplicitlyStopped = false;
    if (this.recognition && !this.isListening) {
      try {
        this.recognition.start();
      } catch (err) {
        console.warn('Chef Cero: Error iniciando escucha:', err);
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
