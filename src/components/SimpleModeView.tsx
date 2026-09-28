import React, { useState, useMemo } from 'react';
import { 
  Sparkles, Mic, Clock, Flame, AlertTriangle, ChevronRight, Check, ChefHat, 
  Camera, Search, X, ArrowRight, RefreshCw, BookOpen, Utensils
} from 'lucide-react';
import { Recipe, UserProfile } from '../types';
import { STARTER_RECIPES } from '../data/recipeData';

interface SimpleModeViewProps {
  userProfile: UserProfile;
  onSelectRecipe: (recipe: Recipe) => void;
  onOpenVoice: () => void;
  onOpenEmergency: () => void;
  onOpenLeftovers?: () => void;
  onOpenScanner?: (mode?: 'inspect_product' | 'fridge') => void;
  onOpenTechniques?: () => void;
  onOpenMealPlanner?: () => void;
  onOpenRecipeImport?: () => void;
}

interface CommonIngredient {
  id: string;
  name: string;
  emoji: string;
  category: 'basicos' | 'frescos' | 'despensa';
}

const COMMON_PANTRY: CommonIngredient[] = [
  { id: 'huevos', name: 'Huevos', emoji: '🥚', category: 'basicos' },
  { id: 'arroz', name: 'Arroz', emoji: '🍚', category: 'despensa' },
  { id: 'fideos', name: 'Fideos / Pasta', emoji: '🍝', category: 'despensa' },
  { id: 'pan', name: 'Pan', emoji: '🍞', category: 'basicos' },
  { id: 'queso', name: 'Queso', emoji: '🧀', category: 'frescos' },
  { id: 'tomate', name: 'Tomate', emoji: '🍅', category: 'frescos' },
  { id: 'cebolla', name: 'Cebolla', emoji: '🧅', category: 'frescos' },
  { id: 'ajo', name: 'Ajo', emoji: '🧄', category: 'frescos' },
  { id: 'papa', name: 'Papa / Patata', emoji: '🥔', category: 'frescos' },
  { id: 'atun', name: 'Atún en lata', emoji: '🥫', category: 'despensa' },
  { id: 'pollo', name: 'Pollo', emoji: '🍗', category: 'frescos' },
  { id: 'leche', name: 'Leche', emoji: '🥛', category: 'frescos' },
];

const POPULAR_IDEAS = [
  'Tortilla de patatas',
  'Lasaña fácil',
  'Arroz chaufa',
  'Pasta alfredo',
  'Pollo al limón',
  'Sopa de pollo casera',
];

export const SimpleModeView: React.FC<SimpleModeViewProps> = ({
  userProfile,
  onSelectRecipe,
  onOpenVoice,
  onOpenEmergency,
  onOpenLeftovers,
  onOpenScanner,
  onOpenTechniques,
  onOpenMealPlanner,
  onOpenRecipeImport,
}) => {
  // 1. Búsqueda y Generación Directa por Nombre de Receta (Escribir o Decir por Voz)
  const [recipeNameInput, setRecipeNameInput] = useState('');
  const [isGeneratingByName, setIsGeneratingByName] = useState(false);
  const [isListeningSpeech, setIsListeningSpeech] = useState(false);
  const [nameGenError, setNameGenError] = useState<string | null>(null);

  // Dictar nombre de plato con reconocimiento de voz en el navegador
  const startVoiceSearch = () => {
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) {
      onOpenVoice();
      return;
    }
    try {
      const recognition = new SpeechRec();
      recognition.lang = 'es-ES';
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onstart = () => {
        setIsListeningSpeech(true);
      };
      recognition.onresult = (event: any) => {
        const transcript = event.results?.[0]?.[0]?.transcript;
        if (transcript) {
          setRecipeNameInput(transcript);
          handleGenerateByName(transcript);
        }
      };
      recognition.onerror = () => {
        setIsListeningSpeech(false);
      };
      recognition.onend = () => {
        setIsListeningSpeech(false);
      };
      recognition.start();
    } catch {
      setIsListeningSpeech(false);
      onOpenVoice();
    }
  };

  // 2. Selección táctil instantánea de despensa
  const [selectedIngredientIds, setSelectedIngredientIds] = useState<string[]>(['huevos', 'arroz']);
  const [customInput, setCustomInput] = useState('');
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<'todos' | 'basicos' | 'frescos' | 'despensa'>('todos');

  // Toggle de ingrediente táctil
  const toggleIngredient = (id: string) => {
    setSelectedIngredientIds((prev) => 
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const addCustomIngredient = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = customInput.trim().toLowerCase();
    if (!clean) return;
    if (!selectedIngredientIds.includes(clean)) {
      setSelectedIngredientIds((prev) => [...prev, clean]);
    }
    setCustomInput('');
  };

  const removeIngredient = (id: string) => {
    setSelectedIngredientIds((prev) => prev.filter((item) => item !== id));
  };

  const clearAllIngredients = () => {
    setSelectedIngredientIds([]);
  };

  // Generar receta por NOMBRE DE PLATO con IA
  const handleGenerateByName = async (targetName?: string) => {
    const nameToQuery = (targetName || recipeNameInput).trim();
    if (!nameToQuery) return;

    setIsGeneratingByName(true);
    setNameGenError(null);

    try {
      const res = await fetch('/api/recipe/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipeName: nameToQuery,
          userProfile: {
            levelTitle: userProfile.levelTitle,
            pastMistakes: userProfile.pastMistakes,
          },
        }),
      });

      const data = await res.json();
      if (data && data.title && data.steps && data.steps.length > 0) {
        onSelectRecipe({
          id: 'ai-named-' + Date.now(),
          title: data.title,
          description: data.description || `Receta fácil y a prueba de errores de ${nameToQuery}.`,
          servings: data.servings || 2,
          totalTimeMinutes: data.totalTimeMinutes || 15,
          difficulty: data.difficulty || 'Principiante',
          cuisine: data.cuisine || 'economica_bbb',
          cuisineName: data.cuisineName || 'Cocina con IA',
          countryFlag: data.countryFlag || '✨',
          isBudgetFriendly: true,
          estimatedCostLabel: data.estimatedCostLabel || 'Económica (<$3 USD)',
          culturalSecret: data.culturalSecret,
          imageUrl: data.imageUrl,
          finishGalleryUrls: data.finishGalleryUrls,
          finishVisualCheckpoints: data.finishVisualCheckpoints,
          safetyAlerts: data.safetyAlerts || ['Controla el fuego', 'Pica todo antes de encender la hornalla'],
          miseEnPlace: data.miseEnPlace || [],
          heatGuideExplanation: data.heatGuideExplanation || 'Fuego controlado para cocinar con tranquilidad.',
          steps: data.steps,
        });
        return;
      }
      throw new Error('Respuesta inválida');
    } catch (err: any) {
      console.warn('Chef Cero: Error generando por nombre:', err);
      setNameGenError('No pudimos conectar con el asistente. Inténtalo de nuevo o elige una receta de la lista.');
    } finally {
      setIsGeneratingByName(false);
    }
  };

  // Motor de Matching Instantáneo con ingredientes seleccionados
  const matchedRecipes = useMemo(() => {
    if (selectedIngredientIds.length === 0) {
      return STARTER_RECIPES.slice(0, 4).map((r) => ({
        recipe: r,
        matchCount: 0,
        matchPercentage: 100,
        readyToCook: true,
      }));
    }

    return STARTER_RECIPES.map((recipe) => {
      const miseText = recipe.miseEnPlace.join(' ').toLowerCase();
      let matchedCount = 0;
      selectedIngredientIds.forEach((id) => {
        if (miseText.includes(id)) {
          matchedCount++;
        }
      });

      const totalKeyIngredients = Math.max(1, recipe.miseEnPlace.length - 2);
      const matchScore = Math.min(100, Math.round((matchedCount / Math.min(totalKeyIngredients, selectedIngredientIds.length)) * 100));

      return {
        recipe,
        matchCount: matchedCount,
        matchPercentage: matchedCount > 0 ? Math.max(45, matchScore) : 25,
        readyToCook: matchedCount >= 1,
      };
    })
    .sort((a, b) => b.matchCount - a.matchCount || a.recipe.totalTimeMinutes - b.recipe.totalTimeMinutes)
    .slice(0, 6);
  }, [selectedIngredientIds]);

  // Generador de receta por IA ultra-directo con los ingredientes seleccionados
  const handleAiQuickResolve = async () => {
    const list = selectedIngredientIds.join(', ');
    if (!list) {
      onOpenVoice();
      return;
    }

    setIsGeneratingAi(true);
    try {
      const res = await fetch('/api/recipe/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ingredients: list,
          cuisine: 'economica_bbb',
          budgetFocus: true,
          userProfile: {
            levelTitle: userProfile.levelTitle,
            pastMistakes: userProfile.pastMistakes,
          },
        }),
      });
      const data = await res.json();
      if (data && data.title && data.steps && data.steps.length > 0) {
        onSelectRecipe({
          id: 'simple-ai-' + Date.now(),
          title: data.title,
          description: data.description || `Receta express con ${list}.`,
          servings: data.servings || 1,
          totalTimeMinutes: data.totalTimeMinutes || 12,
          difficulty: 'Principiante Total',
          cuisine: 'economica_bbb',
          cuisineName: 'Cocina Simple & Rápida',
          countryFlag: '🍳',
          isBudgetFriendly: true,
          imageUrl: data.imageUrl,
          finishGalleryUrls: data.finishGalleryUrls,
          finishVisualCheckpoints: data.finishVisualCheckpoints,
          safetyAlerts: data.safetyAlerts || ['Vigila el fuego', 'Pica todo antes de calentar'],
          miseEnPlace: data.miseEnPlace || selectedIngredientIds.map((id) => `Ingrediente: ${id}`),
          heatGuideExplanation: data.heatGuideExplanation || 'Fuego bajo y medio para no quemar nada.',
          steps: data.steps,
        });
        return;
      }
    } catch {
      // Fallback a primera receta coincidente
      if (matchedRecipes.length > 0) {
        onSelectRecipe(matchedRecipes[0].recipe);
      }
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const filteredPantry = COMMON_PANTRY.filter((item) => {
    if (selectedCategoryFilter === 'todos') return true;
    return item.category === selectedCategoryFilter;
  });

  return (
    <div className="max-w-4xl mx-auto space-y-6 sm:space-y-8 animate-fade-in pb-20 px-3 sm:px-4">
      
      {/* 1. HERO PRINCIPAL: "LA REGLA DE LOS 3 SEGUNDOS" */}
      <section className="text-center pt-2 sm:pt-4 space-y-3">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-100 text-amber-950 text-xs font-bold border border-amber-300 shadow-2xs">
          <span>🍳</span>
          <span>Chef Cero • Cocina fácil paso a paso sin quemar nada</span>
        </div>
        
        <h1 className="text-3xl sm:text-5xl font-black text-stone-900 tracking-tight font-serif">
          ¿Qué te gustaría cocinar hoy?
        </h1>
        <p className="text-sm sm:text-base text-stone-600 max-w-xl mx-auto leading-relaxed">
          Escribe el nombre del plato que se te antoje o toca lo que tienes en casa. Te guiaremos paso a paso para que no se queme.
        </p>

        {/* 2. BUSCADOR INTELIGENTE CON IA: "PIDE CUALQUIER RECETA POR SU NOMBRE" */}
        <div className="max-w-2xl mx-auto pt-2">
          <form 
            onSubmit={(e) => {
              e.preventDefault();
              handleGenerateByName();
            }}
            className="bg-white p-2 rounded-2xl border-2 border-amber-400 shadow-md flex flex-col sm:flex-row gap-2 transition focus-within:ring-4 focus-within:ring-amber-200"
          >
            <div className="relative flex-1 flex items-center">
              <Search className="w-5 h-5 text-amber-500 ml-3 shrink-0" />
              <input
                type="text"
                value={recipeNameInput}
                onChange={(e) => setRecipeNameInput(e.target.value)}
                placeholder={isListeningSpeech ? "Escuchando... di el nombre del plato..." : "Escribe o di cualquier plato (ej: Lasaña fácil, Tortilla de patatas...)"}
                className={`w-full pl-3 pr-20 py-2.5 text-sm sm:text-base font-medium text-stone-900 placeholder:text-stone-400 focus:outline-none bg-transparent ${isListeningSpeech ? 'text-amber-800 placeholder:text-amber-700 animate-pulse' : ''}`}
              />
              <div className="absolute right-2 flex items-center gap-1">
                {recipeNameInput && (
                  <button
                    type="button"
                    onClick={() => setRecipeNameInput('')}
                    className="p-1 hover:bg-stone-100 rounded-full text-stone-400 cursor-pointer"
                    title="Limpiar"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={startVoiceSearch}
                  className={`p-1.5 rounded-xl transition cursor-pointer flex items-center gap-1 ${
                    isListeningSpeech
                      ? 'bg-rose-500 text-white animate-bounce shadow-xs ring-2 ring-rose-300'
                      : 'text-stone-500 hover:text-stone-900 hover:bg-stone-100'
                  }`}
                  title="Dictar nombre del plato por voz"
                >
                  <Mic className="w-4 h-4" />
                </button>
              </div>
            </div>
            
            <button
              type="submit"
              disabled={!recipeNameInput.trim() || isGeneratingByName}
              className="px-5 py-3 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-stone-950 font-black text-sm flex items-center justify-center gap-2 shadow-xs transition active:scale-98 cursor-pointer shrink-0"
            >
              {isGeneratingByName ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-stone-950" />
                  <span>Creando receta con IA...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-stone-950 fill-stone-950" />
                  <span>Cocinar con IA</span>
                </>
              )}
            </button>
          </form>

          {nameGenError && (
            <p className="text-xs text-rose-600 font-bold mt-2 text-center">
              {nameGenError}
            </p>
          )}

          {/* Sugerencias rápidas en 1 clic */}
          <div className="flex flex-wrap items-center justify-center gap-1.5 mt-2.5 text-xs text-stone-600">
            <span className="font-semibold text-stone-400 mr-1 text-[11px]">Ideas rápidas:</span>
            {POPULAR_IDEAS.map((idea) => (
              <button
                key={idea}
                type="button"
                onClick={() => {
                  setRecipeNameInput(idea);
                  handleGenerateByName(idea);
                }}
                className="px-2.5 py-1 rounded-full bg-stone-100 hover:bg-amber-100 text-stone-700 hover:text-amber-950 text-xs font-semibold transition cursor-pointer border border-stone-200"
              >
                {idea}
              </button>
            ))}

            {onOpenRecipeImport && (
              <button
                type="button"
                onClick={onOpenRecipeImport}
                className="px-2.5 py-1 rounded-full bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs font-black transition cursor-pointer border border-amber-300 flex items-center gap-1 shadow-2xs"
                title="Pegar texto de un blog o enlace y limpiarlo al instante"
              >
                <span>📋</span>
                <span>Importar Receta (Pegar de Blog o Web)</span>
              </button>
            )}
          </div>
        </div>
      </section>

      {/* 3. TRES BOTONES DE ACCIÓN RÁPIDA: VOZ, NEVERA Y S.O.S. */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <button
          type="button"
          onClick={onOpenVoice}
          className="p-4 rounded-2xl bg-amber-500 hover:bg-amber-600 text-stone-950 font-bold text-sm flex items-center justify-center gap-2.5 shadow-sm transition active:scale-98 cursor-pointer"
        >
          <Mic className="w-5 h-5 text-stone-950" />
          <span>Preguntar al Chef por Voz</span>
        </button>

        {onOpenScanner && (
          <button
            type="button"
            onClick={() => onOpenScanner('inspect_product')}
            className="p-4 rounded-2xl bg-white hover:bg-stone-50 border border-emerald-300 text-stone-800 font-bold text-sm flex items-center justify-center gap-2.5 shadow-2xs transition active:scale-98 cursor-pointer ring-1 ring-emerald-400/30"
          >
            <Camera className="w-5 h-5 text-emerald-600" />
            <div className="text-left">
              <span className="block text-xs font-black text-stone-900 leading-tight">Inspector con Foto</span>
              <span className="text-[10px] text-emerald-700 font-semibold">¿Está bueno? ¿Qué preparo?</span>
            </div>
          </button>
        )}

        <button
          type="button"
          onClick={onOpenEmergency}
          className="p-4 rounded-2xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-800 font-bold text-sm flex items-center justify-center gap-2.5 shadow-2xs transition active:scale-98 cursor-pointer"
        >
          <AlertTriangle className="w-5 h-5 text-rose-600" />
          <span>S.O.S. (¡Se quema la comida!)</span>
        </button>
      </div>

      {/* 4. SELECTOR TÁCTIL DE INGREDIENTES: "¿QUÉ TIENES EN CASA?" */}
      <section className="bg-white rounded-3xl p-5 sm:p-6 border border-stone-200 shadow-sm space-y-4">
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-100 pb-3">
          <div>
            <h2 className="text-base sm:text-lg font-black text-stone-900 font-serif flex items-center gap-2">
              <span>🥣</span>
              <span>O toca lo que tienes en tu cocina:</span>
            </h2>
            <p className="text-xs text-stone-500">
              Marca 1 o 2 ingredientes para ver platos rápidos sin salir al supermercado.
            </p>
          </div>

          {selectedIngredientIds.length > 0 && (
            <button
              type="button"
              onClick={clearAllIngredients}
              className="text-xs font-bold text-stone-400 hover:text-stone-700 transition cursor-pointer self-start sm:self-auto"
            >
              Limpiar selección
            </button>
          )}
        </div>

        {/* Ingredientes marcados */}
        {selectedIngredientIds.length > 0 && (
          <div className="flex flex-wrap gap-1.5 p-3 rounded-2xl bg-amber-50/70 border border-amber-200">
            {selectedIngredientIds.map((id) => {
              const matched = COMMON_PANTRY.find((c) => c.id === id);
              return (
                <span
                  key={id}
                  className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500 text-stone-950 font-bold text-xs rounded-xl shadow-2xs animate-fade-in"
                >
                  <span>{matched ? matched.emoji : '🥣'}</span>
                  <span className="capitalize">{matched ? matched.name : id}</span>
                  <button
                    type="button"
                    onClick={() => removeIngredient(id)}
                    className="p-0.5 hover:bg-black/15 rounded-full transition ml-0.5 cursor-pointer"
                    title="Eliminar"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              );
            })}
          </div>
        )}

        {/* Filtros de Categoría */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
          {(['todos', 'basicos', 'frescos', 'despensa'] as const).map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategoryFilter(cat)}
              className={`px-3 py-1.5 rounded-xl font-bold transition capitalize shrink-0 cursor-pointer ${
                selectedCategoryFilter === cat
                  ? 'bg-stone-900 text-white shadow-2xs'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }`}
            >
              {cat === 'todos' ? '✨ Todos' : cat === 'basicos' ? '🥚 Básicos' : cat === 'frescos' ? '🍅 Frescos' : '🥫 Despensa'}
            </button>
          ))}
        </div>

        {/* Grilla de ingredientes táctiles */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {filteredPantry.map((item) => {
            const isSelected = selectedIngredientIds.includes(item.id);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => toggleIngredient(item.id)}
                className={`p-3 rounded-2xl border text-left transition flex items-center justify-between gap-2 cursor-pointer select-none active:scale-97 ${
                  isSelected
                    ? 'bg-amber-100/90 border-amber-400 text-amber-950 font-black shadow-2xs ring-2 ring-amber-300/40'
                    : 'bg-stone-50 hover:bg-stone-100 border-stone-200 text-stone-700 font-medium'
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <span className="text-xl leading-none">{item.emoji}</span>
                  <span className="text-xs truncate">{item.name}</span>
                </div>
                {isSelected && (
                  <div className="w-4 h-4 rounded-full bg-amber-500 text-stone-950 flex items-center justify-center shrink-0">
                    <Check className="w-2.5 h-2.5 stroke-[3]" />
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Input para agregar otro ingrediente personalizado */}
        <form onSubmit={addCustomIngredient} className="flex gap-2 pt-1">
          <input
            type="text"
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            placeholder="¿Tienes otro ingrediente? (ej: zanahoria, mantequilla, carne...)"
            className="flex-1 pl-3.5 pr-4 py-2.5 bg-stone-50 border border-stone-300 rounded-xl text-xs text-stone-900 placeholder:text-stone-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
          <button
            type="submit"
            disabled={!customInput.trim()}
            className="px-4 py-2.5 bg-stone-800 hover:bg-stone-900 disabled:opacity-40 text-white font-bold text-xs rounded-xl transition cursor-pointer shrink-0"
          >
            + Agregar
          </button>
        </form>
      </section>

      {/* 5. CATÁLOGO DE RECETAS RECOMENDADAS CON FOTO Y 1 CLIC PARA COCINAR */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-stone-900 font-serif">
              Recetas fáciles para cocinar ya
            </h2>
            <p className="text-xs text-stone-500">
              Todas diseñadas a prueba de errores con tiempos y temperaturas exactas.
            </p>
          </div>

          <button
            type="button"
            onClick={handleAiQuickResolve}
            disabled={isGeneratingAi}
            className="text-xs font-bold text-amber-800 hover:text-amber-950 flex items-center gap-1.5 bg-amber-50 hover:bg-amber-100 px-3 py-1.5 rounded-xl border border-amber-300 transition cursor-pointer"
          >
            {isGeneratingAi ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-600" />
                <span>Creando receta...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                <span>Inventar receta con IA</span>
              </>
            )}
          </button>
        </div>

        {/* Tarjetas Grandes y Apetitosas con Foto Real del Plato Terminado */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {matchedRecipes.map(({ recipe, matchPercentage }) => (
            <div
              key={recipe.id}
              onClick={() => onSelectRecipe(recipe)}
              className="bg-white rounded-3xl border border-stone-200 overflow-hidden hover:border-amber-400 hover:shadow-lg transition cursor-pointer flex flex-col group active:scale-[0.99]"
            >
              {/* Foto del Plato Terminado */}
              <div className="relative h-44 w-full bg-stone-100 overflow-hidden">
                <img
                  src={recipe.imageUrl || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80'}
                  alt={recipe.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  loading="lazy"
                />
                
                {/* Badge de tiempo y nivel */}
                <div className="absolute top-3 left-3 flex items-center gap-2">
                  <span className="bg-stone-900/85 backdrop-blur-xs text-white text-[11px] font-bold px-2.5 py-1 rounded-xl shadow-xs flex items-center gap-1">
                    <Clock className="w-3 h-3 text-amber-400" />
                    <span>{recipe.totalTimeMinutes} min</span>
                  </span>
                  
                  {matchPercentage === 100 && (
                    <span className="bg-emerald-600 text-white text-[11px] font-bold px-2.5 py-1 rounded-xl shadow-xs">
                      ¡Tienes todo!
                    </span>
                  )}
                </div>

                <div className="absolute bottom-2 right-2 bg-stone-900/80 backdrop-blur-xs text-white text-[10px] font-bold px-2 py-0.5 rounded-lg">
                  {recipe.difficulty}
                </div>
              </div>

              {/* Contenido de la tarjeta */}
              <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between space-y-3">
                <div>
                  <h3 className="text-base sm:text-lg font-black text-stone-900 group-hover:text-amber-800 transition line-clamp-1">
                    {recipe.title.split('(')[0]}
                  </h3>
                  <p className="text-xs text-stone-600 mt-1 line-clamp-2 leading-relaxed">
                    {recipe.description}
                  </p>
                </div>

                <div className="pt-2 border-t border-stone-100 flex items-center justify-between">
                  <span className="text-xs text-stone-500 font-medium">
                    {recipe.steps.length} pasos • Fuego controlado
                  </span>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectRecipe(recipe);
                    }}
                    className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-2xs transition group-hover:shadow-xs cursor-pointer"
                  >
                    <span>Empezar a Cocinar</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 6. ATAJOS RÁPIDOS A HERRAMIENTAS ADICIONALES */}
      <section className="bg-stone-50 rounded-3xl p-5 border border-stone-200">
        <h3 className="text-xs font-black uppercase tracking-wider text-stone-500 mb-3">
          Otras herramientas útiles de Chef Cero:
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
          {onOpenMealPlanner && (
            <button
              onClick={onOpenMealPlanner}
              className="p-3 bg-white hover:bg-stone-100 rounded-xl border border-stone-200 font-bold text-stone-800 flex items-center gap-2 transition cursor-pointer"
            >
              <span>📅</span>
              <span>Menú Semanal</span>
            </button>
          )}

          {onOpenTechniques && (
            <button
              onClick={onOpenTechniques}
              className="p-3 bg-white hover:bg-stone-100 rounded-xl border border-stone-200 font-bold text-stone-800 flex items-center gap-2 transition cursor-pointer"
            >
              <span>🎬</span>
              <span>Técnicas en Bucle</span>
            </button>
          )}

          {onOpenLeftovers && (
            <button
              onClick={onOpenLeftovers}
              className="p-3 bg-white hover:bg-stone-100 rounded-xl border border-stone-200 font-bold text-stone-800 flex items-center gap-2 transition cursor-pointer"
            >
              <span>🧊</span>
              <span>Rescate de Sobras</span>
            </button>
          )}
        </div>
      </section>

    </div>
  );
};
