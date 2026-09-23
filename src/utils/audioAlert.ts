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
}

export function speakSpanishText(
  text: string,
  onEndOrOptions?: (() => void) | SpeakOptions
) {
  let onEndCallback: (() => void) | undefined;
  let speakerName = 'Chef Cero';
  let badgeName = isSilentModeActive ? 'Modo Silencioso' : 'Subtítulo en Vivo';
  let isEmergency = false;

  if (typeof onEndOrOptions === 'function') {
    onEndCallback = onEndOrOptions;
  } else if (onEndOrOptions) {
    onEndCallback = onEndOrOptions.onEnd;
    if (onEndOrOptions.speaker) speakerName = onEndOrOptions.speaker;
    if (onEndOrOptions.badge) badgeName = onEndOrOptions.badge;
    if (onEndOrOptions.isEmergency) isEmergency = onEndOrOptions.isEmergency;
  }

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
    stopSpeaking();
    // Simular el término tras un lapso de lectura adecuado
    if (onEndCallback) {
      setTimeout(() => {
        onEndCallback?.();
      }, 1200);
    }
    return;
  }

  // Si el audio está activado, sintetizar la voz normalmente
  if (!('speechSynthesis' in window)) {
    console.warn('Speech synthesis not supported on this browser.');
    if (onEndCallback) onEndCallback();
    return;
  }

  let speechWatchdog: any = null;

  try {
    // Reanudar la síntesis si estaba pausada y limpiar colas
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
    }
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(cleanText);
    const latinVoice = getBestLatinAmericanVoice();

    // Configuración optimizada para español latinoamericano: cadencia calmada, dicción nítida
    utterance.lang = latinVoice?.lang || 'es-419';
    utterance.rate = 0.94; // Cadencia óptima para máxima inteligibilidad en cocina
    utterance.pitch = 1.02; // Tono cálido, empático y natural

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
      if (onEndCallback) {
        const cb = onEndCallback;
        onEndCallback = undefined;
        cb();
      }
    };

    utterance.onend = () => {
      cleanupAndFinish();
    };

    utterance.onerror = (e) => {
      // Si el error fue por cancelación intencional ('canceled' o 'interrupted'), no es un fallo
      if (e.error !== 'canceled' && e.error !== 'interrupted') {
        console.warn('SpeechSynthesis notice:', e.error);
      }
      cleanupAndFinish();
    };

    // Watchdog de seguridad: evita que Chromium congele el estado `speaking` indefinidamente en textos largos
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
    // Referencia global para evitar recolección de basura prematura en Chrome/Safari
    (window as any).__chefCeroUtterance = utterance;
    window.speechSynthesis.speak(utterance);
  } catch (err) {
    console.warn('Speak error:', err);
    if (speechWatchdog) clearTimeout(speechWatchdog);
    if (onEndCallback) onEndCallback();
  }
}

export function stopSpeaking() {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
    } catch (_) {}
    currentUtterance = null;
    (window as any).__chefCeroUtterance = null;
  }
}
