import React, { useState } from 'react';
import { Sparkles, Mic, Clock, Flame, AlertTriangle, ChevronRight, HelpCircle, Check, ChefHat, Camera, GraduationCap } from 'lucide-react';
import { Recipe, UserProfile } from '../types';
import { STARTER_RECIPES } from '../data/recipeData';

interface SimpleModeViewProps {
  userProfile: UserProfile;
  onSelectRecipe: (recipe: Recipe) => void;
  onOpenVoice: () => void;
  onOpenEmergency: () => void;
  onOpenLeftovers: () => void;
  onSwitchToComplete: () => void;
  onOpenScanner?: () => void;
  onOpenTechniques?: () => void;
}

export const SimpleModeView: React.FC<SimpleModeViewProps> = ({
  userProfile,
  onSelectRecipe,
  onOpenVoice,
  onOpenEmergency,
  onOpenLeftovers,
  onSwitchToComplete,
  onOpenScanner,
  onOpenTechniques,
}) => {
  const [ingredientsText, setIngredientsText] = useState('');
  const [activeFaq, setActiveFaq] = useState<number | null>(null);

  // 3 recetas a prueba de fallas ideales para quien no sabe cocinar
  const beginnerRecipes = [
    STARTER_RECIPES.find((r) => r.id === 'arroz-blanco-perfecto') || STARTER_RECIPES[0],
    STARTER_RECIPES.find((r) => r.id === 'chilaquiles-rojos-express') || STARTER_RECIPES[1],
    STARTER_RECIPES.find((r) => r.id === 'arroz-chaufa-cantones') || STARTER_RECIPES[2],
  ].filter(Boolean);

  const quickPills = [
    { label: '🥚 Huevos', value: 'huevos' },
    { label: '🍞 Pan', value: 'pan' },
    { label: '🧀 Queso', value: 'queso' },
    { label: '🍅 Tomate', value: 'tomate' },
    { label: '🍚 Arroz', value: 'arroz' },
    { label: '🍝 Fideos', value: 'fideos' },
    { label: '🥫 Atún', value: 'atún' },
  ];

  const handleAddPill = (val: string) => {
    if (!ingredientsText) {
      setIngredientsText(val);
    } else if (!ingredientsText.toLowerCase().includes(val.toLowerCase())) {
      setIngredientsText(`${ingredientsText}, ${val}`);
    }
  };

  const handleSearchIngredients = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ingredientsText.trim()) {
      onOpenVoice();
      return;
    }
    // Buscar coincidencia en recetas existentes o abrir el generador inteligente
    const lower = ingredientsText.toLowerCase();
    const matched = STARTER_RECIPES.find((r) =>
      r.miseEnPlace.some((m) => lower.split(',').some((w) => m.toLowerCase().includes(w.trim())))
    );

    if (matched) {
      onSelectRecipe(matched);
    } else {
      onOpenLeftovers();
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in pb-12">
      {/* 1. Saludo Cálido y Desestresante */}
      <section className="text-center pt-2 sm:pt-4 space-y-2">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 text-amber-900 text-xs font-bold">
          <span>🌱</span>
          <span>Cocina sin miedo • Cero complicaciones</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-stone-900 tracking-tight font-serif">
          Hola, ¿qué comemos hoy?
        </h1>
        <p className="text-sm sm:text-base text-stone-600 max-w-lg mx-auto">
          Dime qué tienes a mano o elige una opción rápida. Te guío paso a paso con el fuego apagado primero.
        </p>
      </section>

      {/* 2. Buscador Central Amigable estilo "Half Lemons" */}
      <section className="bg-white rounded-3xl p-5 sm:p-7 border border-stone-200 shadow-lg shadow-stone-200/50 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-amber-100/50 rounded-full blur-2xl pointer-events-none" />

        <form onSubmit={handleSearchIngredients} className="space-y-4 relative z-10">
          <label className="block text-xs font-bold uppercase tracking-wider text-stone-500">
            ¿Qué ingredientes tienes en tu refrigerador o despensa?
          </label>

          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={ingredientsText}
                onChange={(e) => setIngredientsText(e.target.value)}
                placeholder="Ej: tengo 2 huevos, tomate y un poco de arroz..."
                className="w-full pl-4 pr-12 py-3.5 bg-stone-50 border border-stone-300 rounded-2xl text-stone-900 placeholder:text-stone-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm sm:text-base transition"
              />
              <button
                type="button"
                onClick={onOpenVoice}
                title="Hablar con el Chef en vivo"
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-amber-500 hover:bg-amber-600 text-stone-950 rounded-xl transition shadow-xs"
              >
                <Mic className="w-4 h-4" />
              </button>
            </div>

            <div className="flex gap-2">
              {onOpenScanner && (
                <button
                  type="button"
                  onClick={onOpenScanner}
                  className="px-4 py-3.5 bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-950 font-bold text-sm rounded-2xl transition flex items-center justify-center gap-2 shrink-0 cursor-pointer"
                  title="Tomar foto de tu nevera o alacena"
                >
                  <Camera className="w-4 h-4 text-amber-700" />
                  <span className="hidden sm:inline">Foto Nevera</span>
                </button>
              )}

              <button
                type="submit"
                className="px-6 py-3.5 bg-stone-900 hover:bg-stone-800 text-white font-bold text-sm rounded-2xl transition shadow-md flex items-center justify-center gap-2 shrink-0 cursor-pointer flex-1 sm:flex-initial"
              >
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>Resolver mi comida</span>
              </button>
            </div>
          </div>

          {/* Atajos de ingredientes rápidos */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="text-[11px] font-semibold text-stone-400 mr-1">Toca para agregar:</span>
            {quickPills.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => handleAddPill(p.value)}
                className="px-2.5 py-1 bg-stone-100 hover:bg-amber-100 text-stone-700 hover:text-amber-950 rounded-xl text-xs font-medium border border-stone-200 transition cursor-pointer"
              >
                {p.label}
              </button>
            ))}
          </div>
        </form>
      </section>

      {/* Micro-Demostraciones Sensoriales (Estilo Kitchen Stories) */}
      {onOpenTechniques && (
        <button
          type="button"
          onClick={onOpenTechniques}
          className="w-full p-4 rounded-3xl bg-gradient-to-r from-amber-500/15 via-orange-500/5 to-amber-100/30 border border-amber-200 text-left flex items-center justify-between gap-3 hover:border-amber-300 transition group cursor-pointer shadow-2xs"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-500 text-stone-950 flex items-center justify-center text-xl font-bold group-hover:scale-105 transition-transform shrink-0 shadow-2xs">
              🎓
            </div>
            <div>
              <div className="text-xs sm:text-sm font-black text-stone-900 flex items-center gap-2">
                <span>Micro-Guía Sensorial: Aprende el punto exacto</span>
                <span className="text-[10px] bg-amber-200 text-amber-950 font-bold px-2 py-0.5 rounded-full">
                  Nuevo
                </span>
              </div>
              <p className="text-xs text-stone-600 mt-0.5">
                Cómo reconocer la cebolla sudada, la prueba del aceite y el corte seguro sin cortarte nunca los dedos.
              </p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-stone-400 group-hover:text-amber-700 group-hover:translate-x-0.5 transition-transform shrink-0" />
        </button>
      )}

      {/* 3. Las 3 Tarjetas Claras de Decisión Rápida (Principio de Hick) */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-extrabold text-stone-900 font-serif">
            Elige una opción sencilla:
          </h2>
          <button
            onClick={onSwitchToComplete}
            className="text-xs font-bold text-amber-700 hover:text-amber-800 flex items-center gap-1"
          >
            <span>Ver catálogo completo con filtros</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Tarjeta 1: Rápido y a prueba de fallas */}
          <div className="bg-white rounded-3xl p-5 border border-stone-200 shadow-sm flex flex-col justify-between hover:border-amber-300 hover:shadow-md transition group">
            <div>
              <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center text-2xl mb-3 group-hover:scale-105 transition-transform">
                ⏱️
              </div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                10 a 20 Minutos
              </span>
              <h3 className="text-base font-extrabold text-stone-900 mt-2">
                Rápido y a prueba de fallas
              </h3>
              <p className="text-xs text-stone-600 mt-1 leading-relaxed">
                Platos de pocos pasos diseñados para que salgan ricos en el primer intento sin ensuciar casi nada.
              </p>
            </div>

            <div className="mt-4 pt-3 border-t border-stone-100 space-y-2">
              {beginnerRecipes.slice(0, 2).map((recipe) => (
                <button
                  key={recipe.id}
                  onClick={() => onSelectRecipe(recipe)}
                  className="w-full text-left p-2 rounded-xl hover:bg-stone-50 transition flex items-center justify-between group/item"
                >
                  <div className="truncate pr-2">
                    <div className="text-xs font-bold text-stone-800 group-hover/item:text-amber-700 truncate">
                      {recipe.title.split('(')[0]}
                    </div>
                    <div className="text-[10px] text-stone-500 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-stone-400" />
                      <span>{recipe.totalTimeMinutes} min</span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-stone-400 group-hover/item:translate-x-0.5 transition-transform shrink-0" />
                </button>
              ))}
            </div>
          </div>

          {/* Tarjeta 2: Rescatar sobras / qué hay en la nevera */}
          <div
            onClick={onOpenLeftovers}
            className="bg-white rounded-3xl p-5 border border-stone-200 shadow-sm flex flex-col justify-between hover:border-emerald-300 hover:shadow-md transition cursor-pointer group"
          >
            <div>
              <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center text-2xl mb-3 group-hover:scale-105 transition-transform">
                🧊
              </div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                Ahorro Total
              </span>
              <h3 className="text-base font-extrabold text-stone-900 mt-2">
                Rescatar lo que tengo
              </h3>
              <p className="text-xs text-stone-600 mt-1 leading-relaxed">
                ¿Te sobró arroz, medio tomate o pan duro? No tires nada: te armo una comida deliciosa en 3 minutos.
              </p>
            </div>

            <div className="mt-4 pt-3 border-t border-stone-100">
              <span className="w-full py-2 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition">
                <span>Abrir Rescate de Sobras</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </span>
            </div>
          </div>

          {/* Tarjeta 3: Botón S.O.S. en la sartén */}
          <div
            onClick={onOpenEmergency}
            className="bg-white rounded-3xl p-5 border border-rose-200 shadow-sm flex flex-col justify-between hover:border-rose-400 hover:shadow-md transition cursor-pointer group relative overflow-hidden"
          >
            <div className="absolute -right-4 -top-4 w-16 h-16 bg-rose-50 rounded-full pointer-events-none" />

            <div>
              <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-800 flex items-center justify-center text-2xl mb-3 group-hover:scale-105 transition-transform">
                🆘
              </div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
                Rescate en Segundos
              </span>
              <h3 className="text-base font-extrabold text-stone-900 mt-2">
                S.O.S. en la sartén
              </h3>
              <p className="text-xs text-stone-600 mt-1 leading-relaxed">
                ¿Hay mucho humo? ¿Se pegó la comida? ¿Se te fue la mano con la sal? Toca aquí y lo salvamos ya.
              </p>
            </div>

            <div className="mt-4 pt-3 border-t border-rose-100">
              <span className="w-full py-2 px-3 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition shadow-xs">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-300" />
                <span>Pedir auxilio al Chef</span>
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Respuestas Rápidas a los 3 Miedos Clásicos del Principiante */}
      <section className="bg-stone-50 rounded-3xl p-5 sm:p-6 border border-stone-200 space-y-3">
        <div className="flex items-center gap-2 text-stone-800">
          <HelpCircle className="w-4 h-4 text-amber-600" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-stone-600">
            Dudas que todos tenemos al empezar:
          </h3>
        </div>

        <div className="space-y-2">
          {[
            {
              q: '¿Cómo sé si el aceite ya está suficientemente caliente?',
              a: 'Mete la punta de una cuchara de madera o un trocito diminuto de pan. Si alrededor se forman burbujitas alegres de inmediato, está listo. Si echa humo blanco, ¡está demasiado caliente! Apaga el fuego un minuto.',
            },
            {
              q: '¿Qué significa realmente cocinar a "fuego bajo"?',
              a: 'Es la llama más pequeña posible de la hornalla más chica de tu cocina. No debe rugir ni asomarse por los costados de la olla; debe ser una coronita azul calma.',
            },
            {
              q: '¿Por qué la regla del "Fuego Apagado" (Mise en Place)?',
              a: 'Porque cuando el fuego está prendido, las cosas se queman en 20 segundos mientras tú buscas un cuchillo o abres un paquete. Si cortas y mides todo antes con la estufa fría, ¡es imposible fallar!',
            },
          ].map((item, idx) => (
            <div
              key={idx}
              className="bg-white rounded-2xl border border-stone-200 overflow-hidden transition"
            >
              <button
                type="button"
                onClick={() => setActiveFaq(activeFaq === idx ? null : idx)}
                className="w-full p-3.5 text-left text-xs sm:text-sm font-bold text-stone-800 flex items-center justify-between gap-3 hover:bg-stone-50"
              >
                <span>{item.q}</span>
                <span className="text-stone-400 text-lg font-mono leading-none">
                  {activeFaq === idx ? '−' : '+'}
                </span>
              </button>
              {activeFaq === idx && (
                <div className="p-3.5 pt-0 text-xs text-stone-600 leading-relaxed border-t border-stone-100 bg-stone-50/50">
                  {item.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
