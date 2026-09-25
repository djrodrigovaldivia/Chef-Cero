import React, { useState, useMemo } from 'react';
import { 
  Sparkles, Mic, Clock, Flame, AlertTriangle, ChevronRight, Check, ChefHat, 
  Camera, Search, X, ShieldCheck, ArrowRight, RefreshCw, Zap
} from 'lucide-react';
import { Recipe, UserProfile } from '../types';
import { STARTER_RECIPES } from '../data/recipeData';

interface SimpleModeViewProps {
  userProfile: UserProfile;
  onSelectRecipe: (recipe: Recipe) => void;
  onOpenVoice: () => void;
  onOpenEmergency: () => void;
  onOpenLeftovers: () => void;
  onSwitchToComplete: () => void;
  onOpenScanner?: (mode?: 'inspect_product' | 'fridge') => void;
  onOpenTechniques?: () => void;
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
  // Selección táctil instantánea estilo Supercook / Half Lemons
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

  // Motor de Matching Instantáneo: Calcula cuántos ingredientes coinciden con cada receta
  const matchedRecipes = useMemo(() => {
    if (selectedIngredientIds.length === 0) {
      // Si no ha seleccionado nada, sugerir las 3 más sencillas de nivel 1
      return STARTER_RECIPES.slice(0, 3).map((r) => ({
        recipe: r,
        matchCount: 0,
        matchPercentage: 100,
        missingIngredients: [],
        readyToCook: true,
      }));
    }

    return STARTER_RECIPES.map((recipe) => {
      // Normalizar texto de ingredientes de la receta
      const miseText = recipe.miseEnPlace.join(' ').toLowerCase();
      
      let matchedCount = 0;
      selectedIngredientIds.forEach((id) => {
        if (miseText.includes(id)) {
          matchedCount++;
        }
      });

      // Calcular porcentaje aproximado
      const totalKeyIngredients = Math.max(1, recipe.miseEnPlace.length - 2); // Excluyendo sal, aceite, agua
      const matchScore = Math.min(100, Math.round((matchedCount / Math.min(totalKeyIngredients, selectedIngredientIds.length)) * 100));

      return {
        recipe,
        matchCount: matchedCount,
        matchPercentage: matchedCount > 0 ? Math.max(40, matchScore) : 20,
        readyToCook: matchedCount >= 1,
      };
    })
    .sort((a, b) => b.matchCount - a.matchCount || a.recipe.totalTimeMinutes - b.recipe.totalTimeMinutes)
    .slice(0, 4);
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
          safetyAlerts: data.safetyAlerts || ['Vigila el fuego', 'Pica todo antes de calentar'],
          miseEnPlace: data.miseEnPlace || selectedIngredientIds.map((id) => `Ingrediente: ${id}`),
          heatGuideExplanation: data.heatGuideExplanation || 'Fuego bajo y medio para no quemar nada.',
          steps: data.steps,
        });
        return;
      }
    } catch {
      // Network or API failure, handle with dynamic direct generator below
    } finally {
      setIsGeneratingAi(false);
    }

    // Generador Sensorial Dinámico con los ingredientes exactos seleccionados (Garantía de funcionamiento 100%)
    const names = selectedIngredientIds.join(', ');
    const hasEggs = selectedIngredientIds.some((i) => i.toLowerCase().includes('huevo'));
    const hasRice = selectedIngredientIds.some((i) => i.toLowerCase().includes('arroz'));
    const hasBread = selectedIngredientIds.some((i) => i.toLowerCase().includes('pan'));

    let dynamicTitle = `Salteado Express con ${names}`;
    let dynamicDesc = 'Preparación rápida, reconfortante y a prueba de errores con tus ingredientes.';
    let dynamicSteps: any[] = [];

    if (hasEggs && hasRice) {
      dynamicTitle = `Arroz Salteado con Huevos y ${selectedIngredientIds.filter((i) => !i.includes('huevo') && !i.includes('arroz')).join(' y ') || 'Aromáticos'}`;
      dynamicDesc = 'El clásico salteado de rescate: granos sueltos, huevo tierno y toque dorado sin que nada se pegue.';
      dynamicSteps = [
        {
          stepNumber: 1,
          title: 'Mise en Place: Ingredientes listos',
          instruction: `Ten a mano tus ingredientes: ${names}. Casca los huevos en un bol con pizca de sal y bátelos suavemente con un tenedor.`,
          heatLevel: 'apagado',
          tip: 'Tener todo medido antes de encender el fuego evita que el huevo se arrebate.',
          sensoryCues: {
            sight: 'Huevos batidos de color amarillo uniforme y arroz desgranado con los dedos.',
            sound: 'Silencio, estufa apagada.',
            smell: 'Aroma fresco limpio.',
          },
        },
        {
          stepNumber: 2,
          title: 'Cuajar el huevo a fuego suave',
          instruction: 'Pon la sartén a Fuego Medio con 1 cucharada de aceite. Vierte los huevos y remueve con espátula durante 45 segundos hasta que cuajen tiernos sin dorar. Retira a un plato.',
          heatLevel: 'medio',
          tip: 'El huevo debe quedar suave y brillante, no seco ni marrón.',
          timerSeconds: 45,
          timerLabel: 'Cuajar huevo tierno',
          sensoryCues: {
            sight: 'Cuajada amarilla cremosa y esponjosa.',
            sound: 'Chisporroteo fino y calmo.',
            smell: 'Aroma tibio a huevo recién hecho.',
          },
        },
        {
          stepNumber: 3,
          title: 'Saltear el arroz y demás ingredientes',
          instruction: `En la misma sartén añade un hilo de aceite, echa el arroz y ${selectedIngredientIds.filter((i) => !i.includes('huevo') && !i.includes('arroz')).join(', ') || 'demás ingredientes'}. Saltea a fuego medio durante 3 minutos moviendo la espátula.`,
          heatLevel: 'medio',
          tip: 'Aplasta los grumos de arroz con el reverso de la espátula para que doren parejo.',
          timerSeconds: 180,
          timerLabel: 'Saltear arroz',
          sensoryCues: {
            sight: 'Granos de arroz brillantes y separados.',
            sound: 'Chispazo continuo y rítmico.',
            smell: 'Fragancia tostada suave apetecible.',
          },
        },
        {
          stepNumber: 4,
          title: 'Integrar todo y servir caliente',
          instruction: 'Reincorpora el huevo a la sartén. Remueve todo junto 1 minuto para que se unan los sabores, ajusta con una pizca de sal y sirve de inmediato.',
          heatLevel: 'bajo',
          tip: '¡Listo! Un plato nutritivo y delicioso hecho en 10 minutos.',
          timerSeconds: 60,
          timerLabel: 'Integración final',
          sensoryCues: {
            sight: 'Plato lleno de color y brillo uniforme.',
            sound: 'Siseo calmo.',
            smell: 'Aroma casero irresistible.',
          },
        },
      ];
    } else if (hasBread && hasEggs) {
      dynamicTitle = `Tostadas Francesas Saladas o Revuelto con Pan Crujiente`;
      dynamicDesc = 'La combinación perfecta de pan dorado con huevo esponjoso y sazón dorada.';
      dynamicSteps = [
        {
          stepNumber: 1,
          title: 'Preparar pan y huevos',
          instruction: `Corta el pan en rebanadas o cubos. Bate los huevos con pizca de sal y pimienta.`,
          heatLevel: 'apagado',
          tip: 'El pan del día anterior absorbe el huevo mucho mejor que el pan fresco.',
        },
        {
          stepNumber: 2,
          title: 'Dorar el pan en la sartén',
          instruction: 'Pon la sartén a Fuego Medio con un velo de aceite. Tuesta el pan 2 minutos por lado hasta que quede crujiente.',
          heatLevel: 'medio',
          timerSeconds: 120,
          timerLabel: 'Dorar pan',
        },
        {
          stepNumber: 3,
          title: 'Añadir huevo y cuajar suave',
          instruction: 'Baja a Fuego Bajo, vierte el huevo batido y remueve suavemente con el pan hasta que cuaje cremoso. Sirve caliente.',
          heatLevel: 'bajo',
          timerSeconds: 90,
          timerLabel: 'Cuajado cremoso',
        },
      ];
    } else {
      dynamicSteps = [
        {
          stepNumber: 1,
          title: 'Mise en Place: Cortar y organizar',
          instruction: `Corta ${names} en bocados homogéneos sobre tu tabla con fuego apagado.`,
          heatLevel: 'apagado',
          tip: 'Tener todo cortado elimina el 90% de la ansiedad al cocinar.',
        },
        {
          stepNumber: 2,
          title: 'Calentar la base con aceite',
          instruction: 'Calienta la sartén a Fuego Medio con 1 cucharada de aceite durante 40 segundos.',
          heatLevel: 'medio',
          timerSeconds: 40,
          timerLabel: 'Calentar aceite',
        },
        {
          stepNumber: 3,
          title: 'Cocción y dorado uniforme',
          instruction: `Agrega ${names}. Saltea con espátula de madera durante 4 a 5 minutos a Fuego Medio-Bajo con una pizca de sal.`,
          heatLevel: 'bajo',
          timerSeconds: 270,
          timerLabel: 'Salteado continuo',
        },
        {
          stepNumber: 4,
          title: 'Punto final y reposo',
          instruction: 'Prueba un bocado para verificar que esté tierno y con el punto de sal exacto. Apaga el fuego y sirve.',
          heatLevel: 'apagado',
          tip: 'Deja reposar 1 minuto en el plato para que los jugos se asienten.',
        },
      ];
    }

    onSelectRecipe({
      id: 'simple-dynamic-' + Date.now(),
      title: dynamicTitle,
      description: dynamicDesc,
      servings: 1,
      totalTimeMinutes: 10,
      difficulty: 'Principiante',
      cuisine: 'economica_bbb',
      cuisineName: 'Cocina Simple con tus Ingredientes',
      countryFlag: '🍳',
      isBudgetFriendly: true,
      safetyAlerts: ['Mantén el mango de la sartén hacia adentro', 'Controla la llama a fuego medio-bajo'],
      miseEnPlace: selectedIngredientIds.map((item) => `Tener listo: ${item}`),
      heatGuideExplanation: 'Fuego medio-bajo en todo momento para evitar que nada se queme ni se pegue.',
      steps: dynamicSteps,
    });
  };

  const filteredPantry = COMMON_PANTRY.filter((item) => {
    if (selectedCategoryFilter === 'todos') return true;
    return item.category === selectedCategoryFilter;
  });

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in pb-16">
      
      {/* 1. ENCABEZADO ZEN ULTRA-LIMPIO */}
      <section className="text-center pt-1 sm:pt-3 space-y-2">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 text-amber-950 text-xs font-black tracking-wide border border-amber-300/60 shadow-2xs">
          <span>🧘</span>
          <span>MODO SIMPLE • ESTILO HALF LEMONS & SUPERCOOK</span>
        </div>
        
        <h1 className="text-2xl sm:text-4xl font-black text-stone-900 tracking-tight font-serif">
          Toca lo que tienes en casa
        </h1>
        <p className="text-xs sm:text-sm text-stone-600 max-w-md mx-auto">
          Sin listas largas ni compras caras. Te mostramos qué cocinar en 10 minutos con lo que ya tienes.
        </p>
      </section>

      {/* 2. RECONOCIMIENTO VISUAL / POR VOZ RÁPIDO (Estilo SideChef & Whisk) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        <button
          type="button"
          onClick={onOpenVoice}
          className="p-3.5 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-stone-950 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-sm hover:shadow-md transition active:scale-98 cursor-pointer ring-2 ring-amber-300/60"
        >
          <Mic className="w-4 h-4 shrink-0" />
          <span>Decir por voz</span>
        </button>

        {onOpenScanner ? (
          <button
            type="button"
            onClick={() => onOpenScanner('fridge')}
            className="p-3.5 rounded-2xl bg-white hover:bg-stone-50 border border-stone-300 text-stone-800 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-2xs transition active:scale-98 cursor-pointer"
          >
            <Camera className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="truncate">Foto nevera</span>
          </button>
        ) : null}

        <button
          type="button"
          onClick={onOpenEmergency}
          className="col-span-2 sm:col-span-1 p-3.5 rounded-2xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-800 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-2xs transition active:scale-98 cursor-pointer"
        >
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>S.O.S. Sartén</span>
        </button>
      </div>

      {/* 3. SELECTOR TÁCTIL DE INGREDIENTES (El corazón de Supercook / Half Lemons) */}
      <section className="bg-white rounded-3xl p-5 sm:p-6 border border-stone-200 shadow-sm space-y-4">
        
        {/* Cabecera del selector */}
        <div className="flex items-center justify-between gap-2 border-b border-stone-100 pb-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black uppercase tracking-wider text-stone-700">
              Despensa activa
            </span>
            <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 font-black text-xs">
              {selectedIngredientIds.length}
            </span>
          </div>

          {selectedIngredientIds.length > 0 && (
            <button
              type="button"
              onClick={clearAllIngredients}
              className="text-[11px] font-bold text-stone-400 hover:text-stone-700 transition cursor-pointer"
            >
              Borrar todo
            </button>
          )}
        </div>

        {/* Chips activos seleccionados */}
        {selectedIngredientIds.length > 0 ? (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-1.5 min-h-[38px] p-2.5 rounded-2xl bg-amber-50/60 border border-amber-200">
              {selectedIngredientIds.map((id) => {
                const matched = COMMON_PANTRY.find((c) => c.id === id);
                return (
                  <span
                    key={id}
                    className="inline-flex items-center gap-1 px-3 py-1 bg-amber-500 text-stone-950 font-bold text-xs rounded-xl shadow-2xs animate-fade-in"
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

            {/* BOTÓN DE ACCIÓN PRINCIPAL: Crear y cocinar la receta con estos ingredientes */}
            <div className="p-3.5 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-stone-950 shadow-md flex flex-col sm:flex-row items-center justify-between gap-3 animate-fade-in">
              <div className="text-center sm:text-left">
                <div className="flex items-center justify-center sm:justify-start gap-1.5 text-xs font-black uppercase tracking-wider text-amber-950">
                  <Sparkles className="w-4 h-4 text-amber-950 fill-amber-950" />
                  <span>¿Listo para cocinar con tus {selectedIngredientIds.length} ingredientes?</span>
                </div>
                <p className="text-xs text-amber-950/90 font-medium mt-0.5">
                  El Chef Cero creará una receta guiada paso a paso adaptada exactamente a lo que tienes.
                </p>
              </div>

              <button
                type="button"
                onClick={handleAiQuickResolve}
                disabled={isGeneratingAi}
                className="w-full sm:w-auto px-5 py-3 rounded-xl bg-stone-900 hover:bg-stone-800 disabled:bg-stone-700 text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-sm transition active:scale-97 cursor-pointer shrink-0"
              >
                {isGeneratingAi ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
                    <span>Creando tu receta con IA...</span>
                  </>
                ) : (
                  <>
                    <ChefHat className="w-4 h-4 text-amber-400" />
                    <span>¡Cocinar con mis ingredientes!</span>
                    <ArrowRight className="w-4 h-4 text-amber-400" />
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          <div className="p-3 text-center rounded-2xl bg-stone-50 border border-dashed border-stone-300 text-xs text-stone-500">
            Toca los ingredientes de abajo (por ejemplo: Huevos, Arroz o Pan) para ver qué preparar o crear una receta al instante.
          </div>
        )}

        {/* Filtros de Categoría rápidos (Estilo Supercook) */}
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

        {/* Grilla táctil de 1 toque (Tap-to-add) */}
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {filteredPantry.map((item) => {
            const isSelected = selectedIngredientIds.includes(item.id);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => toggleIngredient(item.id)}
                className={`p-2.5 rounded-2xl border text-left transition flex items-center justify-between gap-1.5 cursor-pointer select-none active:scale-96 ${
                  isSelected
                    ? 'bg-amber-100/90 border-amber-400 text-amber-950 font-black shadow-2xs ring-2 ring-amber-300/40'
                    : 'bg-stone-50/80 hover:bg-stone-100 border-stone-200 text-stone-700 font-medium'
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <span className="text-lg leading-none">{item.emoji}</span>
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

        {/* Input manual discreto para cualquier otro ingrediente */}
        <form onSubmit={addCustomIngredient} className="flex gap-2 pt-1">
          <div className="relative flex-1">
            <input
              type="text"
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              placeholder="¿Tienes otro ingrediente? (ej: zanahoria, queso crema...)"
              className="w-full pl-3.5 pr-10 py-2.5 bg-stone-50 border border-stone-300 rounded-xl text-xs text-stone-900 placeholder:text-stone-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
          <button
            type="submit"
            disabled={!customInput.trim()}
            className="px-4 py-2.5 bg-stone-800 hover:bg-stone-900 disabled:opacity-40 text-white font-bold text-xs rounded-xl transition cursor-pointer shrink-0"
          >
            + Agregar
          </button>
        </form>
      </section>

      {/* 4. RECETAS SUGERIDAS AL INSTANTE (Resultados inmediatos, 0 clics de búsqueda) */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-base sm:text-lg font-black text-stone-900 font-serif">
              Recetas que puedes hacer ya
            </h2>
            <span className="text-[11px] font-bold text-stone-500">
              (Asume sal, agua y aceite en casa)
            </span>
          </div>

          <button
            type="button"
            onClick={handleAiQuickResolve}
            disabled={isGeneratingAi}
            className="text-xs font-bold text-amber-700 hover:text-amber-800 flex items-center gap-1 bg-amber-50 px-2.5 py-1 rounded-xl border border-amber-200 transition cursor-pointer"
          >
            {isGeneratingAi ? (
              <>
                <RefreshCw className="w-3 h-3 animate-spin text-amber-600" />
                <span>Creando receta...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3 h-3 text-amber-600" />
                <span>Crear receta nueva con IA</span>
              </>
            )}
          </button>
        </div>

        {/* Tarjetas de Recetas estilo SideChef & Half Lemons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {matchedRecipes.map(({ recipe, matchPercentage }) => (
            <div
              key={recipe.id}
              onClick={() => onSelectRecipe(recipe)}
              className="bg-white rounded-3xl p-4 sm:p-5 border border-stone-200 hover:border-amber-400 hover:shadow-md transition cursor-pointer flex flex-col justify-between group active:scale-[0.99] relative overflow-hidden"
            >
              {/* Badge de compatibilidad estilo Supercook */}
              <div className="flex items-center justify-between gap-2 mb-2.5">
                <span className="inline-flex items-center gap-1 text-[11px] font-black px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-950 border border-emerald-300">
                  <Check className="w-3 h-3 text-emerald-700 stroke-[3]" />
                  <span>{matchPercentage}% listo para cocinar</span>
                </span>

                <span className="text-[11px] text-stone-500 font-bold flex items-center gap-1">
                  <Clock className="w-3 h-3 text-stone-400" />
                  <span>{recipe.totalTimeMinutes} min</span>
                </span>
              </div>

              <div>
                <h3 className="text-base font-extrabold text-stone-900 group-hover:text-amber-800 transition line-clamp-1">
                  {recipe.title.split('(')[0]}
                </h3>
                <p className="text-xs text-stone-600 mt-1 line-clamp-2 leading-relaxed">
                  {recipe.description}
                </p>
              </div>

              {/* Ingredientes clave de la receta */}
              <div className="mt-3 pt-3 border-t border-stone-100 flex items-center justify-between">
                <div className="flex items-center gap-1 text-[11px] text-stone-500 truncate pr-2">
                  <span className="font-semibold text-stone-400">Pasos:</span>
                  <span className="font-bold text-stone-700">{recipe.steps.length} sencillos</span>
                  <span className="text-stone-300">•</span>
                  <span className="text-emerald-700 font-bold">Fuego bajo/medio</span>
                </div>

                <div className="w-8 h-8 rounded-xl bg-amber-100 group-hover:bg-amber-500 text-stone-900 flex items-center justify-center shrink-0 transition">
                  <ArrowRight className="w-4 h-4" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 5. RESCATE Y TÉCNICAS (Banners de 1 toque de ayuda) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
        {onOpenTechniques && (
          <button
            type="button"
            onClick={onOpenTechniques}
            className="p-4 rounded-2xl bg-stone-50 hover:bg-stone-100 border border-stone-200 text-left flex items-center gap-3 transition cursor-pointer"
          >
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center text-xl shrink-0">
              🎓
            </div>
            <div className="truncate">
              <div className="text-xs font-black text-stone-900">
                Aprender el corte seguro (Garra de Oso)
              </div>
              <p className="text-[11px] text-stone-500 mt-0.5 truncate">
                Cómo picar cebolla sin cortarte jamás un dedo.
              </p>
            </div>
          </button>
        )}

        <button
          type="button"
          onClick={onOpenLeftovers}
          className="p-4 rounded-2xl bg-stone-50 hover:bg-stone-100 border border-stone-200 text-left flex items-center gap-3 transition cursor-pointer"
        >
          <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center text-xl shrink-0">
            🧊
          </div>
          <div className="truncate">
            <div className="text-xs font-black text-stone-900">
              Rescate de Sobras de Ayer
            </div>
            <p className="text-[11px] text-stone-500 mt-0.5 truncate">
              ¿Sobró arroz o pasta fría? Rescátalo en 5 min.
            </p>
          </div>
        </button>
      </div>

      {/* Enlace al modo completo para quien quiera explorar más */}
      <div className="text-center pt-2">
        <button
          type="button"
          onClick={onSwitchToComplete}
          className="text-xs font-bold text-stone-500 hover:text-stone-800 underline underline-offset-4 cursor-pointer"
        >
          ¿Quieres ver el catálogo con filtros avanzados y gastronomías del mundo? Ir a Modo Completo →
        </button>
      </div>

    </div>
  );
};
