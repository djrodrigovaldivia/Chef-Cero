import React, { useState, useEffect } from 'react';
import {
  Coins,
  Clock,
  Zap,
  TrendingDown,
  AlertCircle,
  ExternalLink,
  ShieldCheck,
  RefreshCw,
  Sparkles,
  Info,
  Sliders,
} from 'lucide-react';
import { tokenBudgetTracker, TokenUsageStats, TOKENS_PER_SECOND_AUDIO } from '../utils/tokenBudgetTracker';

interface TokenBudgetMonitorProps {
  isLiveActive?: boolean;
}

export const TokenBudgetMonitor: React.FC<TokenBudgetMonitorProps> = ({ isLiveActive = false }) => {
  const [stats, setStats] = useState<TokenUsageStats>(tokenBudgetTracker.getStats());
  const [showConfig, setShowConfig] = useState(false);
  const [customBudgetInput, setCustomBudgetInput] = useState<string>(stats.tokenBudget.toString());

  useEffect(() => {
    const unsubscribe = tokenBudgetTracker.subscribe((updated) => {
      setStats(updated);
      setCustomBudgetInput(updated.tokenBudget.toString());
    });
    return () => unsubscribe();
  }, []);

  const remainingTokens = Math.max(0, stats.tokenBudget - stats.totalTokensUsed);
  const estimatedMinutesLeft = tokenBudgetTracker.getEstimatedMinutesRemaining(stats);
  const usagePercentage = Math.min(100, Math.round((stats.totalTokensUsed / Math.max(1, stats.tokenBudget)) * 100));

  const isLowBudget = estimatedMinutesLeft <= stats.lowBudgetAlertMinutes;

  const handleSaveBudget = () => {
    const val = parseInt(customBudgetInput, 10);
    if (!isNaN(val) && val >= 1000) {
      tokenBudgetTracker.updateBudgetConfig({ tokenBudget: val });
      setShowConfig(false);
    }
  };

  const handleReset = () => {
    if (window.confirm('¿Deseas reiniciar los contadores de consumo para un nuevo ciclo?')) {
      tokenBudgetTracker.resetUsage();
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-stone-200 shadow-xs p-5 sm:p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-stone-100 pb-4">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-xl ${isLiveActive ? 'bg-rose-500 text-white animate-pulse' : 'bg-amber-100 text-amber-900'}`}>
            <Coins className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-stone-900 text-base">
                Transparencia de Recursos & Presupuesto Live
              </h3>
              {isLiveActive ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-100 text-rose-800 border border-rose-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-600 animate-ping"></span>
                  En Vivo Ahora
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-stone-100 text-stone-600">
                  Reposo
                </span>
              )}
            </div>
            <p className="text-xs text-stone-500 mt-0.5">
              Control transparente de tokens para streaming de voz en tiempo real con Gemini 3.8.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowConfig(!showConfig)}
            className="px-3 py-1.5 rounded-xl border border-stone-200 bg-stone-50 hover:bg-stone-100 text-stone-700 text-xs font-semibold flex items-center gap-1.5 transition"
            title="Ajustar presupuesto y alertas"
          >
            <Sliders className="w-3.5 h-3.5 text-stone-500" />
            <span>Configurar Límite</span>
          </button>
          <button
            onClick={handleReset}
            className="p-1.5 rounded-xl border border-stone-200 text-stone-400 hover:text-stone-700 hover:bg-stone-50 transition"
            title="Reiniciar contador de consumo"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Panel de Configuración Desplegable */}
      {showConfig && (
        <div className="p-4 bg-stone-50 border border-stone-200 rounded-xl space-y-3 text-xs animate-fade-in">
          <h4 className="font-bold text-stone-800 flex items-center gap-1.5">
            <Sliders className="w-4 h-4 text-amber-600" />
            <span>Personalizar Presupuesto Estimado de Tokens</span>
          </h4>
          <p className="text-stone-600">
            Define tu umbral de tokens mensual o de sesión para estimar los minutos de conversación disponibles.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 bg-white border border-stone-300 rounded-lg px-2.5 py-1.5">
              <span className="text-stone-400 font-mono">Tokens:</span>
              <input
                type="number"
                step="5000"
                min="5000"
                max="1000000"
                value={customBudgetInput}
                onChange={(e) => setCustomBudgetInput(e.target.value)}
                className="w-28 text-stone-900 font-bold focus:outline-none"
              />
            </div>
            <button
              onClick={handleSaveBudget}
              className="px-3 py-1.5 bg-stone-900 hover:bg-stone-800 text-white font-bold rounded-lg text-xs transition"
            >
              Guardar Presupuesto
            </button>
            <button
              onClick={() => setShowConfig(false)}
              className="px-3 py-1.5 text-stone-500 hover:text-stone-800 font-medium"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Main Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Card 1: Tiempo Estimado Restante */}
        <div className={`p-4 rounded-xl border transition-all ${
          isLowBudget
            ? 'bg-rose-50/70 border-rose-200 text-rose-950'
            : 'bg-emerald-50/60 border-emerald-200 text-emerald-950'
        }`}>
          <div className="flex items-center justify-between text-xs mb-1 font-bold">
            <span className="flex items-center gap-1.5">
              <Clock className={`w-4 h-4 ${isLowBudget ? 'text-rose-600' : 'text-emerald-600'}`} />
              <span>Tiempo Restante para Hablar</span>
            </span>
          </div>
          <div className="flex items-baseline gap-1 mt-2">
            <span className="text-2xl sm:text-3xl font-extrabold font-serif">
              ~{estimatedMinutesLeft}
            </span>
            <span className="text-xs font-semibold text-stone-600">minutos aprox.</span>
          </div>
          <p className="text-[11px] text-stone-500 mt-1">
            Basado en consumo de streaming continuo (~{TOKENS_PER_SECOND_AUDIO} tokens/segundo).
          </p>
        </div>

        {/* Card 2: Tokens Consumidos vs Presupuesto */}
        <div className="p-4 rounded-xl border border-stone-200 bg-stone-50/60 text-stone-900">
          <div className="flex items-center justify-between text-xs mb-1 font-bold text-stone-700">
            <span className="flex items-center gap-1.5">
              <Coins className="w-4 h-4 text-amber-600" />
              <span>Tokens Utilizados</span>
            </span>
            <span className="font-mono text-[11px] text-stone-500">{usagePercentage}%</span>
          </div>
          <div className="flex items-baseline gap-1 mt-2">
            <span className="text-2xl sm:text-3xl font-extrabold font-serif text-stone-900">
              {stats.totalTokensUsed.toLocaleString()}
            </span>
            <span className="text-xs text-stone-500 font-mono">
              / {stats.tokenBudget.toLocaleString()}
            </span>
          </div>
          {/* Barra de Progreso */}
          <div className="w-full bg-stone-200 h-2 rounded-full mt-2 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                usagePercentage > 85 ? 'bg-rose-500' : usagePercentage > 60 ? 'bg-amber-500' : 'bg-emerald-500'
              }`}
              style={{ width: `${usagePercentage}%` }}
            ></div>
          </div>
        </div>

        {/* Card 3: Sesión Activa vs Modo Gratuito */}
        <div className="p-4 rounded-xl border border-stone-200 bg-stone-50/60 text-stone-900">
          <div className="flex items-center justify-between text-xs mb-1 font-bold text-stone-700">
            <span className="flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-blue-600" />
              <span>Sesión Actual Live</span>
            </span>
            {isLiveActive && (
              <span className="text-[10px] text-rose-600 font-bold animate-pulse">● Activo</span>
            )}
          </div>
          <div className="flex items-baseline gap-1 mt-2">
            <span className="text-2xl sm:text-3xl font-extrabold font-serif text-stone-900">
              {tokenBudgetTracker.formatDuration(stats.sessionLiveSeconds)}
            </span>
            <span className="text-xs text-stone-500 font-medium">en audio</span>
          </div>
          <p className="text-[11px] text-stone-500 mt-1">
            {stats.sessionTokensUsed.toLocaleString()} tokens consumidos en esta sesión.
          </p>
        </div>
      </div>

      {/* Alerta si el saldo estimado es bajo */}
      {isLowBudget && (
        <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-900 flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <strong>Presupuesto cerca del límite estimado:</strong> Te quedan menos de {stats.lowBudgetAlertMinutes} minutos de conversación continua en Live. 
            El asistente seguirá funcionando con total normalidad en <em>Modo Estándar Gratuito</em> al agotarse.
          </div>
        </div>
      )}

      {/* Garantía de Transparencia & Explicación de Modos */}
      <div className="p-4 bg-gradient-to-r from-amber-50/60 via-stone-50 to-stone-50 rounded-xl border border-amber-200/70 text-xs space-y-2">
        <div className="flex items-center gap-2 font-bold text-stone-900">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>Tu Compromiso Cero Sorpresas de Chef Cero:</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-stone-600">
          <div className="p-2.5 rounded-lg bg-white border border-stone-200/80">
            <strong className="block text-emerald-800 font-bold mb-0.5">
              ✓ Modo Estándar (Por defecto):
            </strong>
            <p className="text-[11px]">
              El reconocimiento del navegador y las respuestas de texto/voz estándar son <strong>100% gratuitos</strong> y no gastan saldo de streaming en vivo.
            </p>
          </div>
          <div className="p-2.5 rounded-lg bg-white border border-stone-200/80">
            <strong className="block text-rose-800 font-bold mb-0.5">
              ⚡ Modo Gemini 3.8 Live (Opt-in):
            </strong>
            <p className="text-[11px]">
              Solo consume cuota cuando enciendes deliberadamente el botón <em>Live 3.8</em> para streaming bidireccional de baja latencia.
            </p>
          </div>
        </div>
      </div>

      {/* Enlace directo a Google AI Studio para recarga o facturación */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2 text-xs">
        <div className="flex items-center gap-1.5 text-stone-500">
          <Info className="w-3.5 h-3.5 text-stone-400" />
          <span>Gestiona tu clave, límites de cuota y facturación en la consola oficial:</span>
        </div>
        <a
          href="https://aistudio.google.com/app/plan_information"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-stone-900 hover:bg-stone-800 text-white font-bold rounded-xl transition shadow-xs shrink-0"
        >
          <span>Gestionar Plan en AI Studio</span>
          <ExternalLink className="w-3 h-3 text-stone-400" />
        </a>
      </div>
    </div>
  );
};
