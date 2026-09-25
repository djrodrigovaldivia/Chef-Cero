/**
 * tokenBudgetTracker.ts
 * Gestor transparente de presupuesto y monitor de tokens en tiempo real para Gemini Live API.
 * 
 * Reglas de cálculo basadas en la arquitectura de audio bidireccional:
 * - Entrada de audio (Usuario): ~25-32 tokens por segundo de audio muestreado a 16kHz
 * - Salida de audio (Chef): ~30-40 tokens por segundo de audio generado a 24kHz
 * - Modo Estándar de Voz (Reconocimiento del navegador Web Speech API): 0 Tokens (100% Gratuito)
 */

export interface TokenUsageStats {
  sessionLiveSeconds: number; // Segundos acumulados en sesión actual de Live
  totalLiveSeconds: number; // Segundos acumulados históricos
  sessionTokensUsed: number; // Tokens estimados de la sesión actual
  totalTokensUsed: number; // Tokens estimados totales
  tokenBudget: number; // Presupuesto asignado por el usuario (por defecto: 50.000 tokens)
  lowBudgetAlertMinutes: number; // Umbral de alerta (ej: 5 minutos)
  autoFallBackToFreeWhenDepleted: boolean; // Volver automáticamente a modo gratuito
  lastActiveTimestamp: number;
}

const STORAGE_KEY = 'chef_cero_token_budget_stats';

// Factores de conversión estándar para audio continuo
export const TOKENS_PER_SECOND_AUDIO = 30; // Promedio de streaming bidireccional (audio in + out)

const DEFAULT_STATS: TokenUsageStats = {
  sessionLiveSeconds: 0,
  totalLiveSeconds: 0,
  sessionTokensUsed: 0,
  totalTokensUsed: 0,
  tokenBudget: 50000, // Equivale a ~27-30 minutos de conversación continua
  lowBudgetAlertMinutes: 5,
  autoFallBackToFreeWhenDepleted: true,
  lastActiveTimestamp: Date.now(),
};

type Listener = (stats: TokenUsageStats) => void;
const listeners = new Set<Listener>();

let currentStats: TokenUsageStats = (() => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        ...DEFAULT_STATS,
        ...parsed,
        sessionLiveSeconds: 0, // Reinicia en cada recarga de app
        sessionTokensUsed: 0,
      };
    }
  } catch (e) {
    console.warn('Error cargando estadísticas de tokens:', e);
  }
  return { ...DEFAULT_STATS };
})();

let liveInterval: any = null;

function saveStats() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        totalLiveSeconds: currentStats.totalLiveSeconds,
        totalTokensUsed: currentStats.totalTokensUsed,
        tokenBudget: currentStats.tokenBudget,
        lowBudgetAlertMinutes: currentStats.lowBudgetAlertMinutes,
        autoFallBackToFreeWhenDepleted: currentStats.autoFallBackToFreeWhenDepleted,
      })
    );
  } catch (e) {
    // Ignore quota issues
  }
}

function notify() {
  listeners.forEach((l) => l({ ...currentStats }));
}

export const tokenBudgetTracker = {
  /**
   * Obtiene copia del estado actual
   */
  getStats(): TokenUsageStats {
    return { ...currentStats };
  },

  /**
   * Suscribe un componente a cambios en tiempo real
   */
  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    listener({ ...currentStats });
    return () => {
      listeners.delete(listener);
    };
  },

  /**
   * Inicia el cómputo de tiempo de sesión Live
   */
  startLiveSession() {
    if (liveInterval) clearInterval(liveInterval);

    liveInterval = setInterval(() => {
      const addedTokens = TOKENS_PER_SECOND_AUDIO;
      currentStats = {
        ...currentStats,
        sessionLiveSeconds: currentStats.sessionLiveSeconds + 1,
        totalLiveSeconds: currentStats.totalLiveSeconds + 1,
        sessionTokensUsed: currentStats.sessionTokensUsed + addedTokens,
        totalTokensUsed: currentStats.totalTokensUsed + addedTokens,
        lastActiveTimestamp: Date.now(),
      };
      saveStats();
      notify();
    }, 1000);
  },

  /**
   * Detiene el cómputo de sesión Live
   */
  stopLiveSession() {
    if (liveInterval) {
      clearInterval(liveInterval);
      liveInterval = null;
    }
    saveStats();
    notify();
  },

  /**
   * Añade tokens manualmente o cuando se procesa una llamada puntual
   */
  recordTokenUsage(tokens: number) {
    currentStats = {
      ...currentStats,
      sessionTokensUsed: currentStats.sessionTokensUsed + tokens,
      totalTokensUsed: currentStats.totalTokensUsed + tokens,
      lastActiveTimestamp: Date.now(),
    };
    saveStats();
    notify();
  },

  /**
   * Actualiza el presupuesto o preferencias de alerta
   */
  updateBudgetConfig(updates: Partial<Pick<TokenUsageStats, 'tokenBudget' | 'lowBudgetAlertMinutes' | 'autoFallBackToFreeWhenDepleted'>>) {
    currentStats = {
      ...currentStats,
      ...updates,
    };
    saveStats();
    notify();
  },

  /**
   * Reinicia los contadores de uso (p. ej. nuevo ciclo de facturación)
   */
  resetUsage() {
    currentStats = {
      ...currentStats,
      sessionLiveSeconds: 0,
      totalLiveSeconds: 0,
      sessionTokensUsed: 0,
      totalTokensUsed: 0,
    };
    saveStats();
    notify();
  },

  /**
   * Calcula los minutos restantes estimados basados en el presupuesto disponible
   */
  getEstimatedMinutesRemaining(stats = currentStats): number {
    const remainingTokens = Math.max(0, stats.tokenBudget - stats.totalTokensUsed);
    const tokensPerMinute = TOKENS_PER_SECOND_AUDIO * 60; // 1800 tokens / min
    return Math.floor(remainingTokens / tokensPerMinute);
  },

  /**
   * Formatea segundos a texto amigable "MM:SS"
   */
  formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs < 10 ? '0' : ''}${secs}s`;
  },
};
