// Web Audio API helper for sound chimes, alerts, Spanish speech synthesis and Silent Mode / Accessible Subtitles

export interface SubtitleItem {
  id: string;
  text: string;
  speaker: string; // e.g. 'Chef Cero' | 'Temporizador' | 'Alerta de Seguridad'
  badge?: string; // e.g. 'Modo Silencioso' | 'S.O.S.' | 'Paso Actual'
  timestamp: number;
  durationMs: number;
  isEmergency?: boolean;
}

type SubtitleListener = (subtitle: SubtitleItem | null) => void;
type SilentModeListener = (isSilent: boolean) => void;

let audioCtx: AudioContext | null = null;
const subtitleListeners: Set<SubtitleListener> = new Set();
const silentModeListeners: Set<SilentModeListener> = new Set();
let currentSubtitle: SubtitleItem | null = null;
let subtitleDismissTimeout: any = null;

// Inicializar preferencia de Modo Silencioso desde localStorage
let isSilentModeActive: boolean = (() => {
  try {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('chef_cero_silent_mode') === 'true';
    }
  } catch (_) {}
  return false;
})();

export function getSilentMode(): boolean {
  return isSilentModeActive;
}

export function setSilentMode(enabled: boolean) {
  isSilentModeActive = enabled;
  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem('chef_cero_silent_mode', enabled ? 'true' : 'false');
    }
  } catch (_) {}

  // Si se activa el modo silencioso, detener cualquier voz en reproducción
  if (enabled) {
    stopSpeaking();
  }

  // Notificar a todos los observadores
  silentModeListeners.forEach((listener) => {
    try {
      listener(enabled);
    } catch (e) {
      console.warn('Error in silent mode listener:', e);
    }
  });
}

export function subscribeToSilentMode(listener: SilentModeListener): () => void {
  silentModeListeners.add(listener);
  listener(isSilentModeActive);
  return () => {
    silentModeListeners.delete(listener);
  };
}

export function subscribeToSubtitles(listener: SubtitleListener): () => void {
  subtitleListeners.add(listener);
  listener(currentSubtitle);
  return () => {
    subtitleListeners.delete(listener);
  };
}

export function emitSubtitle(subtitle: SubtitleItem | null) {
  currentSubtitle = subtitle;
  if (subtitleDismissTimeout) {
    clearTimeout(subtitleDismissTimeout);
    subtitleDismissTimeout = null;
  }

  subtitleListeners.forEach((listener) => {
    try {
      listener(subtitle);
    } catch (e) {
      console.warn('Error in subtitle listener:', e);
    }
  });

  // Si hay un subtítulo activo con duración definida, programar su cierre automático
  if (subtitle && subtitle.durationMs > 0) {
    subtitleDismissTimeout = setTimeout(() => {
      clearActiveSubtitle();
    }, subtitle.durationMs);
  }
}

export function clearActiveSubtitle() {
  currentSubtitle = null;
  if (subtitleDismissTimeout) {
    clearTimeout(subtitleDismissTimeout);
    subtitleDismissTimeout = null;
  }
  subtitleListeners.forEach((listener) => {
    try {
      listener(null);
    } catch (e) {
      console.warn('Error clearing subtitle:', e);
    }
  });
}

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    audioCtx = new AudioContextClass();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

// Desbloquear automáticamente AudioContext en primer toque o clic del usuario (necesario en iOS Safari y Android)
if (typeof window !== 'undefined') {
  const unlockAudioContext = () => {
    try {
      if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume().catch(() => {});
      }
    } catch (_) {}
    window.removeEventListener('click', unlockAudioContext);
    window.removeEventListener('touchstart', unlockAudioContext);
  };
  window.addEventListener('click', unlockAudioContext, { passive: true, once: true });
  window.addEventListener('touchstart', unlockAudioContext, { passive: true, once: true });
}

export function playTimerCompletionChime() {
  // Si está en Modo Silencioso, no emitir sonido audible
  if (isSilentModeActive) {
    // Alerta háptica por vibración si está disponible en móvil
    try {
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate([200, 100, 200, 100, 300]);
      }
    } catch (_) {}

    // Emitir subtítulo visual accesible en pantalla
    emitSubtitle({
      id: 'timer-' + Date.now(),
      text: '¡Tiempo cumplido! El temporizador de cocina ha finalizado. Revisa tu preparación en la sartén u olla.',
      speaker: 'Temporizador de Cocina',
      badge: 'Alerta Silenciosa',
      timestamp: Date.now(),
      durationMs: 7000,
      isEmergency: false,
    });
    return;
  }

  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    // Friendly 4-tone chime (C5 -> E5 -> G5 -> C6)
    const tones = [523.25, 659.25, 783.99, 1046.5];
    tones.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.15);

      gain.gain.setValueAtTime(0.001, now + idx * 0.15);
      gain.gain.exponentialRampToValueAtTime(0.3, now + idx * 0.15 + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.15 + 0.4);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + idx * 0.15);
      osc.stop(now + idx * 0.15 + 0.45);
    });
  } catch (err) {
    console.warn('Audio chime could not play:', err);
  }
}

export function playEmergencyAlertSound() {
  // Si está en Modo Silencioso, emitir solo subtítulo y vibración
  if (isSilentModeActive) {
    try {
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate([300, 100, 300, 100, 400]);
      }
    } catch (_) {}

    emitSubtitle({
      id: 'emergency-' + Date.now(),
      text: '¡Atención de Seguridad! Si ves humo o sientes olor a quemado, aparta la sartén hacia una hornalla apagada de inmediato.',
      speaker: 'Alerta de Seguridad',
      badge: 'S.O.S. Cocina',
      timestamp: Date.now(),
      durationMs: 9000,
      isEmergency: true,
    });
    return;
  }

  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    // Attention two-tone warning
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.setValueAtTime(440, now + 0.12);

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.35);
  } catch (err) {
    console.warn('Emergency sound error:', err);
  }
}

// Natural Spanish Speech Synthesis con soporte automático para Subtítulos Accesibles
let currentUtterance: SpeechSynthesisUtterance | null = null;

// Helper para limpiar y normalizar fonéticamente el texto para una pronunciación perfecta en español
export function normalizeTextForSpeech(raw: string): string {
  if (!raw) return '';

  let t = raw
    // Quitar markdown
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/#{1,6}\s?/g, '')
    .replace(/`[^`]*`/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Quitar emojis y símbolos especiales que los motores de voz leen feo
    .replace(/[\u{1F300}-\u{1F9FF}]/gu, '')
    .replace(/[\u{2600}-\u{26FF}]/gu, '')
    .replace(/[\u{2700}-\u{27BF}]/gu, '')
    .replace(/[•·—–]/g, ' ')
    // Normalizar abreviaturas culinarias comunes para pronunciación natural
    .replace(/\b1\/2\b/g, 'medio')
    .replace(/\b1\/4\b/g, 'un cuarto')
    .replace(/\b3\/4\b/g, 'tres cuartos')
    .replace(/\bcdas\b/gi, 'cucharadas')
    .replace(/\bcda\b/gi, 'cucharada')
    .replace(/\bcdtas\b/gi, 'cucharaditas')
    .replace(/\bcdta\b/gi, 'cucharadita')
    .replace(/\baprox\.?\b/gi, 'aproximadamente')
    .replace(/\btemp\.?\b/gi, 'temperatura')
    .replace(/\bkg\b/gi, 'kilos')
    .replace(/\bgrs?\b/gi, 'gramos')
    .replace(/\bml\b/gi, 'mililitros')
    .replace(/(\d+)\s*mins?\b/gi, '$1 minutos')
    .replace(/(\d+)\s*segs?\b/gi, '$1 segundos')
    .replace(/\bS\.O\.S\.\b/gi, 'emergencia')
    // Limpieza de espacios dobles
    .replace(/\s+/g, ' ')
    .trim();

  return t;
}

// Helper para seleccionar la mejor voz en español latinoamericano disponible
function getBestLatinAmericanVoice(): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices || voices.length === 0) return null;

  // 1. Preferencia absoluta: Voces Neuronales/Naturales en español latinoamericano
  const premiumKeywords = [
    'natural',
    'online (natural)',
    'sabina',
    'raul',
    'raúl',
    'dalia',
    'jorge',
    'paulina',
    'diego',
    'sofia',
    'sofía',
    'google español',
    'mexic',
    'estados unidos',
    'latin',
  ];

  for (const kw of premiumKeywords) {
    const match = voices.find((v) => {
      const isSpanish = (v.lang && v.lang.toLowerCase().startsWith('es')) || v.name.toLowerCase().includes('spanish');
      if (!isSpanish) return false;
      return v.name.toLowerCase().includes(kw);
    });
    if (match) return match;
  }

  // 2. Locales explícitos de Latinoamérica (es-419, es-MX, es-US, es-CO, es-CL, es-AR, etc.)
  const latinLocales = ['es-419', 'es-mx', 'es-us', 'es-co', 'es-cl', 'es-ar', 'es-pe'];
  for (const loc of latinLocales) {
    const match = voices.find((v) => v.lang && v.lang.toLowerCase() === loc);
    if (match) return match;
  }

  // 3. Fallback: cualquier voz que empiece por es- (excluyendo es-ES si hay otra disponible)
  const nonSpainSpanish = voices.find(
    (v) => v.lang && v.lang.toLowerCase().startsWith('es') && !v.lang.toLowerCase().includes('es-es')
  );
  if (nonSpainSpanish) return nonSpainSpanish;

  // 4. Último recurso: cualquier voz en español
  return voices.find((v) => v.lang && v.lang.toLowerCase().startsWith('es')) || null;
}

// Inicializar escucha de carga diferida de voces en navegadores (Chromium / Safari)
if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  window.speechSynthesis.onvoiceschanged = () => {
    // Voces precargadas en memoria
    getBestLatinAmericanVoice();
  };
}

export interface SpeakOptions {
  speaker?: string;
  badge?: string;
  isEmergency?: boolean;
  onEnd?: () => void;
  audioBase64?: string;
  audioMimeType?: string;
}

let currentAudioElement: HTMLAudioElement | null = null;

// Helper para reproducir audio nativo en base64 (generado por Gemini TTS de alta fidelidad)
function playBase64Audio(
  base64Data: string,
  mimeType: string,
  onEndCallback?: () => void
): boolean {
  try {
    const audioSrc = `data:${mimeType || 'audio/wav'};base64,${base64Data}`;
    const audio = new Audio(audioSrc);
    currentAudioElement = audio;

    audio.onended = () => {
      if (currentAudioElement === audio) {
        currentAudioElement = null;
      }
      onEndCallback?.();
    };

    audio.onerror = (e) => {
      console.warn('Chef Cero: Error reproduciendo audio nativo:', e);
      if (currentAudioElement === audio) {
        currentAudioElement = null;
      }
      onEndCallback?.();
    };

    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise.catch((playErr) => {
        console.warn('Chef Cero: Autoplay bloqueado o aviso de audio:', playErr);
        if (currentAudioElement === audio) {
          currentAudioElement = null;
        }
        onEndCallback?.();
      });
    }
    return true;
  } catch (err) {
    console.warn('Chef Cero: Excepción en reproducción de audio base64:', err);
    return false;
  }
}

// Fallback seguro a SpeechSynthesis del navegador, pero BLOQUEANDO voces en inglés
function speakWithBrowserFallback(
  cleanText: string,
  onEndCallback?: () => void
) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    onEndCallback?.();
    return;
  }

  const voices = window.speechSynthesis.getVoices();
  const latinVoice = getBestLatinAmericanVoice();

  // REGLA CRÍTICA ANTI-ACENTO: Si el navegador no tiene ninguna voz en español,
  // NO permitir que una voz en inglés intente pronunciar español ("inglés hablando mal español").
  const hasSpanishVoice = voices.some(
    (v) => (v.lang && v.lang.toLowerCase().startsWith('es')) || v.name.toLowerCase().includes('spanish')
  );

  if (!hasSpanishVoice && !latinVoice) {
    console.info('Chef Cero: No hay voz nativa en español en el sistema operativo; subtítulos visibles activados.');
    // Concluir amablemente sin emitir audio deformado
    setTimeout(() => {
      onEndCallback?.();
    }, 1500);
    return;
  }

  let speechWatchdog: any = null;

  try {
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
    }
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = latinVoice?.lang || 'es-419';
    utterance.rate = 0.94; // Cadencia óptima para máxima inteligibilidad
    utterance.pitch = 1.02; // Tono cálido y empático

    if (latinVoice) {
      utterance.voice = latinVoice;
    }

    const cleanupAndFinish = () => {
      if (speechWatchdog) {
        clearTimeout(speechWatchdog);
        speechWatchdog = null;
      }
      currentUtterance = null;
      (window as any).__chefCeroUtterance = null;
      onEndCallback?.();
    };

    utterance.onend = () => {
      cleanupAndFinish();
    };

    utterance.onerror = (e) => {
      if (e.error !== 'canceled' && e.error !== 'interrupted') {
        console.warn('SpeechSynthesis notice:', e.error);
      }
      cleanupAndFinish();
    };

    const maxSpeechDuration = Math.max(8000, cleanText.length * 90);
    speechWatchdog = setTimeout(() => {
      if (currentUtterance === utterance && window.speechSynthesis.speaking) {
        try {
          window.speechSynthesis.cancel();
        } catch (_) {}
        cleanupAndFinish();
      }
    }, maxSpeechDuration);

    currentUtterance = utterance;
    (window as any).__chefCeroUtterance = utterance;
    window.speechSynthesis.speak(utterance);
  } catch (err) {
    console.warn('Browser speech error:', err);
    if (speechWatchdog) clearTimeout(speechWatchdog);
    onEndCallback?.();
  }
}

export function speakSpanishText(
  text: string,
  onEndOrOptions?: (() => void) | SpeakOptions
) {
  let onEndCallback: (() => void) | undefined;
  let speakerName = 'Chef Cero';
  let badgeName = isSilentModeActive ? 'Modo Silencioso' : 'Voz Nativa en Vivo';
  let isEmergency = false;
  let providedAudioBase64: string | undefined;
  let providedAudioMimeType: string | undefined;

  if (typeof onEndOrOptions === 'function') {
    onEndCallback = onEndOrOptions;
  } else if (onEndOrOptions) {
    onEndCallback = onEndOrOptions.onEnd;
    if (onEndOrOptions.speaker) speakerName = onEndOrOptions.speaker;
    if (onEndOrOptions.badge) badgeName = onEndOrOptions.badge;
    if (onEndOrOptions.isEmergency) isEmergency = onEndOrOptions.isEmergency;
    providedAudioBase64 = onEndOrOptions.audioBase64;
    providedAudioMimeType = onEndOrOptions.audioMimeType;
  }

  // Detener cualquier audio o habla previa
  stopSpeaking();

  // Limpiar y normalizar fonéticamente el texto para dicción perfecta
  const cleanText = normalizeTextForSpeech(text);

  // Calcular tiempo de lectura accesible en base a la longitud (~160 palabras por minuto, mín 5.5 seg)
  const estimatedReadingMs = Math.max(5500, Math.min(22000, cleanText.length * 75));

  // Generar subtítulo visible en pantalla SIEMPRE (tanto si hay sonido como si está en modo silencioso)
  emitSubtitle({
    id: 'sub-' + Date.now(),
    text: cleanText,
    speaker: speakerName,
    badge: badgeName,
    timestamp: Date.now(),
    durationMs: estimatedReadingMs,
    isEmergency,
  });

  // Si está en MODO SILENCIOSO: NO REPRODUCIR VOZ NI AUDIO
  if (isSilentModeActive) {
    if (onEndCallback) {
      setTimeout(() => {
        onEndCallback?.();
      }, 1200);
    }
    return;
  }

  // 1. Si ya viene el audio nativo generado por Gemini TTS (cero acento extranjero, 100% natural)
  if (providedAudioBase64) {
    const ok = playBase64Audio(providedAudioBase64, providedAudioMimeType || 'audio/wav', onEndCallback);
    if (ok) return;
  }

  // 2. Si no viene pregenerado, solicitar audio nativo a /api/tts
  fetch('/api/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: cleanText }),
  })
    .then((res) => {
      if (!res.ok) throw new Error('TTS server response not ok');
      return res.json();
    })
    .then((data) => {
      if (data?.audioBase64) {
        playBase64Audio(data.audioBase64, data.mimeType || 'audio/wav', onEndCallback);
      } else {
        speakWithBrowserFallback(cleanText, onEndCallback);
      }
    })
    .catch((fetchErr) => {
      console.warn('Chef Cero: /api/tts no disponible, usando fallback local seguro:', fetchErr?.message);
      speakWithBrowserFallback(cleanText, onEndCallback);
    });
}

export function stopSpeaking() {
  if (currentAudioElement) {
    try {
      currentAudioElement.pause();
      currentAudioElement.currentTime = 0;
      currentAudioElement.src = '';
    } catch (_) {}
    currentAudioElement = null;
  }

  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
    } catch (_) {}
    currentUtterance = null;
    (window as any).__chefCeroUtterance = null;
  }
}
