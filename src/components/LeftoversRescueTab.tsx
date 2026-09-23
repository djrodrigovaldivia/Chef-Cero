import React, { useState } from 'react';
import { LeftoverIngredientRescue } from '../types';
import { LEFTOVER_RESCUES } from '../data/leftoversAndFaqData';
import { Sparkles, Clock, Flame, AlertTriangle, ArrowRight, ShieldCheck, RefreshCw } from 'lucide-react';

interface LeftoversRescueTabProps {
  onCookRecipeWithIngredients?: (ingredients: string[]) => void;
}

export const LeftoversRescueTab: React.FC<LeftoversRescueTabProps> = () => {
  const [selectedCategory, setSelectedCategory] = useState<'todas' | 'carbohidratos' | 'proteinas' | 'verduras' | 'pan_lacteos'>('todas');
  const [activeRescue, setActiveRescue] = useState<LeftoverIngredientRescue>(LEFTOVER_RESCUES[0]);
  const [activeTransformationIdx, setActiveTransformationIdx] = useState<number>(0);

  // Custom leftover search with AI
  const [customLeftoverText, setCustomLeftoverText] = useState('');
  const [customRescueResponse, setCustomRescueResponse] = useState<{
    headline: string;
    scienceReason: string;
    quickDish: string;
    flavorSecret: string;
    neverDo: string;
  } | null>(null);
  const [isConsultingAi, setIsConsultingAi] = useState(false);

  const filteredRescues = LEFTOVER_RESCUES.filter((item) => {
    if (selectedCategory === 'todas') return true;
    return item.category === selectedCategory;
  });

  const handleAskCustomLeftover = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customLeftoverText.trim()) return;

    try {
      setIsConsultingAi(true);
      const res = await fetch('/api/mentor/rescue-leftover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leftoverItem: customLeftoverText }),
      });

      if (res.ok) {
        const data = await res.json();
        setCustomRescueResponse(data);
      } else {
        // Fallback pedagógico seguro
        setCustomRescueResponse({
          headline: `Transformación rápida para: ${customLeftoverText}`,
          scienceReason: 'Al haber estado cocinado o cortado, los azúcares y almidones se concentran, lo que facilita un dorado rápido con una cucharadita de aceite o mantequilla.',
          quickDish: `Salteado rápido de ${customLeftoverText}: pica en trozos medianos, calienta una sartén con un chorrito de aceite, dora 3 a 4 minutos a fuego medio y termina con un chorrito de salsa de soya o queso rallado.`,
          flavorSecret: 'Agrega una pizca de orégano y unas gotas de limón al servir para levantar el sabor.',
          neverDo: 'No lo recalientes en microondas a máxima potencia sin una cucharadita de agua o tapa para que no se reseque.',
        });
      }
    } catch {
      setCustomRescueResponse({
        headline: `Aprovechar: ${customLeftoverText}`,
        scienceReason: 'El calor controlado en sartén despierta aromas que la nevera adormece.',
        quickDish: `Dora los restos en sartén a fuego medio con aceite y ajo. Mézclalo con 1 huevo batido o queso fundido para crear una tortilla exprés.`,
        flavorSecret: 'Toque de pimienta y gotas de limón fresco.',
        neverDo: 'Nunca dejes comida cocinada fuera del refrigerador por más de dos horas.',
      });
    } finally {
      setIsConsultingAi(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-600/15 via-teal-500/10 to-transparent p-6 rounded-3xl border border-emerald-200">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-emerald-800 text-xs font-bold uppercase tracking-wider mb-1">
              <span>♻️ Cocina Inteligente & Zero Waste (Estilo Sidekick)</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-stone-900 font-serif">
              Rescate de Sobras de la Nevera
            </h2>
            <p className="text-stone-600 text-xs sm:text-sm mt-1 max-w-2xl">
              Lo que te sobró ayer no es aburrido: es el ingrediente estrella de hoy. El arroz frío hace el mejor chaufa, el pan duro los mejores crutones y el pollo cocido las mejores quesadillas.
            </p>
          </div>

          <div className="bg-white/90 backdrop-blur-xs p-3 rounded-2xl border border-emerald-200 text-xs shadow-xs shrink-0 flex items-center gap-3">
            <span className="text-2xl">🌱</span>
            <div>
              <strong className="text-emerald-950 block">Ahorro y Sabor</strong>
              <span className="text-stone-500 text-[11px]">Transforma en 10 min sin desperdiciar</span>
            </div>
          </div>
        </div>

        {/* Buscador de Sobra Personalizada */}
        <form onSubmit={handleAskCustomLeftover} className="mt-5 pt-4 border-t border-emerald-200/80">
          <label className="block text-xs font-bold text-stone-700 mb-1.5">
            ¿Tienes otra sobra en tu heladera que no sabes cómo usar?
          </label>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={customLeftoverText}
              onChange={(e) => setCustomLeftoverText(e.target.value)}
              placeholder="Ej: me sobró media lata de atún, pure de papas frío, carne asada seca..."
              className="flex-1 px-4 py-2.5 bg-white border border-stone-300 rounded-xl text-xs sm:text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
            />
            <button
              type="submit"
              disabled={isConsultingAi || !customLeftoverText.trim()}
              className="px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition cursor-pointer shadow-xs shrink-0"
            >
              {isConsultingAi ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Consultando al Chef...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-emerald-200" />
                  <span>¿Qué puedo cocinar con esto?</span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* Resultado de Consulta de Sobra */}
        {customRescueResponse && (
          <div className="mt-4 p-4 rounded-2xl bg-white border-2 border-emerald-400 shadow-sm animate-in fade-in space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-800 uppercase tracking-wide">
                💡 Consejo de Rescate de tu Chef Mentor
              </span>
              <button
                onClick={() => setCustomRescueResponse(null)}
                className="text-stone-400 hover:text-stone-700 text-xs font-bold"
              >
                ✕
              </button>
            </div>
            <h4 className="text-sm sm:text-base font-bold text-stone-900">
              {customRescueResponse.headline}
            </h4>
            <p className="text-xs text-stone-700 font-medium leading-relaxed bg-emerald-50/70 p-2.5 rounded-xl border border-emerald-100">
              <strong>Plato rápido:</strong> {customRescueResponse.quickDish}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1">
              <div className="bg-amber-50 p-2.5 rounded-xl border border-amber-200 text-amber-950">
                <span className="font-bold block text-[11px]">✨ Potenciador de Sabor:</span>
                <span>{customRescueResponse.flavorSecret}</span>
              </div>
              <div className="bg-rose-50 p-2.5 rounded-xl border border-rose-200 text-rose-950">
                <span className="font-bold block text-[11px]">⚠️ Lo que NUNCA debes hacer:</span>
                <span>{customRescueResponse.neverDo}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Category Filter Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        <span className="text-xs font-bold text-stone-500 uppercase tracking-wider shrink-0 mr-1">
          Filtrar Sobras:
        </span>
        {[
          { id: 'todas', label: 'Todas las sobras', icon: '🍽️' },
          { id: 'carbohidratos', label: 'Arroz, Pastas & Papas', icon: '🍚' },
          { id: 'proteinas', label: 'Pollo y Carnes cocidas', icon: '🍗' },
          { id: 'pan_lacteos', label: 'Pan duro & Lácteos', icon: '🥖' },
          { id: 'verduras', label: 'Verduras arrugadas', icon: '🥕' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setSelectedCategory(tab.id as any)}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
              selectedCategory === tab.id
                ? 'bg-stone-900 text-white shadow-xs'
                : 'bg-white text-stone-700 hover:bg-stone-100 border border-stone-200'
            }`}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Main Grid: Left Column (Leftovers List) + Right Column (Deep-dive Rescue Card) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* List of common leftovers */}
        <div className="lg:col-span-5 space-y-2.5">
          <h3 className="text-xs font-bold text-stone-500 uppercase tracking-wider px-1">
            Sobras Frecuentes ({filteredRescues.length})
          </h3>
          <div className="space-y-2">
            {filteredRescues.map((rescue) => {
              const isSelected = activeRescue.id === rescue.id;
              return (
                <div
                  key={rescue.id}
                  onClick={() => {
                    setActiveRescue(rescue);
                    setActiveTransformationIdx(0);
                  }}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                    isSelected
                      ? 'bg-emerald-50 border-2 border-emerald-600 shadow-sm'
                      : 'bg-white border-stone-200 hover:border-emerald-300 hover:bg-stone-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-3xl p-1.5 rounded-xl bg-white shadow-2xs border border-stone-100 shrink-0">
                      {rescue.icon}
                    </span>
                    <div>
                      <h4 className="text-xs sm:text-sm font-bold text-stone-900">
                        {rescue.name}
                      </h4>
                      <p className="text-[11px] text-stone-500 line-clamp-1 mt-0.5">
                        {rescue.quickTransformations.length} formas de transformarlo
                      </p>
                    </div>
                  </div>
                  <ArrowRight
                    className={`w-4 h-4 transition-transform ${
                      isSelected ? 'text-emerald-700 translate-x-1' : 'text-stone-400'
                    }`}
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* Selected Leftover Detail & Recipes */}
        <div className="lg:col-span-7 bg-white rounded-3xl border border-stone-200 shadow-sm p-6 space-y-6">
          <div className="flex items-start justify-between gap-4 border-b border-stone-100 pb-4">
            <div className="flex items-center gap-3">
              <span className="text-4xl p-2 rounded-2xl bg-emerald-50 border border-emerald-200">
                {activeRescue.icon}
              </span>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-full">
                  Guía de Aprovechamiento
                </span>
                <h3 className="text-lg sm:text-xl font-extrabold text-stone-900 font-serif mt-1">
                  {activeRescue.name}
                </h3>
              </div>
            </div>
          </div>

          {/* Por qué guardarlo & Regla de oro */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3.5 rounded-2xl bg-stone-50 border border-stone-200">
              <span className="font-bold text-stone-800 flex items-center gap-1.5 mb-1 text-[11px] uppercase tracking-wider">
                <span>🔬</span> Por qué es un tesoro:
              </span>
              <p className="text-stone-600 leading-relaxed">
                {activeRescue.whySaveIt}
              </p>
            </div>
            <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200">
              <span className="font-bold text-amber-900 flex items-center gap-1.5 mb-1 text-[11px] uppercase tracking-wider">
                <span>⭐</span> Regla de oro del Chef:
              </span>
              <p className="text-stone-700 leading-relaxed font-medium">
                {activeRescue.goldenRule}
              </p>
            </div>
          </div>

          {/* Transformaciones Rápidas (Pestañas de platos) */}
          <div className="space-y-3">
            <span className="text-xs font-bold text-stone-500 uppercase tracking-wider block">
              3 Formas de Convertirlo en un Plato Nuevo:
            </span>

            <div className="flex flex-wrap gap-2">
              {activeRescue.quickTransformations.map((t, idx) => (
                <button
                  key={idx}
                  onClick={() => setActiveTransformationIdx(idx)}
                  className={`px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                    activeTransformationIdx === idx
                      ? 'bg-stone-900 text-white shadow-xs ring-2 ring-emerald-500/40'
                      : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                  }`}
                >
                  <span>✨</span>
                  <span className="truncate max-w-[200px]">{t.title.split('(')[0]}</span>
                  <span className="text-[10px] opacity-75">({t.timeMinutes}m)</span>
                </button>
              ))}
            </div>

            {/* Tarjeta de la transformación seleccionada */}
            {activeRescue.quickTransformations[activeTransformationIdx] && (
              <div className="p-4 sm:p-5 rounded-2xl bg-stone-50 border border-stone-200 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-200/60 pb-2.5">
                  <h4 className="text-sm sm:text-base font-bold text-stone-900 flex items-center gap-2">
                    <span>🍳</span>
                    <span>{activeRescue.quickTransformations[activeTransformationIdx].title}</span>
                  </h4>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {activeRescue.quickTransformations[activeTransformationIdx].timeMinutes} min
                    </span>
                    <span className="bg-stone-200 text-stone-700 font-bold px-2 py-0.5 rounded-full">
                      {activeRescue.quickTransformations[activeTransformationIdx].difficulty}
                    </span>
                  </div>
                </div>

                <div className="text-xs sm:text-sm text-stone-800 leading-relaxed">
                  <strong className="block text-[11px] uppercase tracking-wider text-stone-500 mb-1 font-bold">
                    Paso a paso express:
                  </strong>
                  <p>{activeRescue.quickTransformations[activeTransformationIdx].instructions}</p>
                </div>

                <div className="p-3 bg-white rounded-xl border border-amber-200 text-xs text-amber-950 flex items-start gap-2">
                  <span className="text-base shrink-0">✨</span>
                  <div>
                    <strong className="font-bold text-amber-900">Potenciador de Sabor:</strong>{' '}
                    <span>{activeRescue.quickTransformations[activeTransformationIdx].flavorBoost}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Error que nunca debes cometer con esta sobra */}
          <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-950 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <strong className="font-bold block text-rose-900 text-[11px] uppercase tracking-wide">
                Error de Seguridad / Textura a Evitar:
              </strong>
              <p className="mt-0.5 leading-relaxed">{activeRescue.neverDoMistake}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
