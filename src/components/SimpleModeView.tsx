import React, { useState, useMemo, useEffect } from 'react';
import { 
  Sparkles, Mic, Clock, Flame, AlertTriangle, ChevronRight, Check, ChefHat, 
  Camera, Search, X, ArrowRight, RefreshCw, BookOpen, Utensils, Calendar,
  Globe, Compass, CheckCircle2, Plus, MapPin
} from 'lucide-react';
import { Recipe, UserProfile, WorldCuisineId } from '../types';
import { STARTER_RECIPES, WORLD_CUISINES } from '../data/recipeData';
import { WORLD_COUNTRIES } from '../data/worldCountries';
import { getCachedWorldCuisine, saveCachedWorldCuisine } from '../utils/worldRecipeCache';
import { generateLocalRecipeFallback } from '../utils/recipeGeneratorFallback';
import { WorldAtlasModal } from './WorldAtlasModal';

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

// Países destacados en la barra rápida
const POPULAR_QUICK_COUNTRIES = [
  { name: 'Todas', flag: '🌍', continent: 'Mundial' },
  { name: 'Chile', flag: '🇨🇱', continent: 'América del Sur', cuisineId: 'chilena_criolla' },
  { name: 'Italia', flag: '🇮🇹', continent: 'Europa', cuisineId: 'italiana' },
  { name: 'Perú', flag: '🇵🇪', continent: 'América del Sur', cuisineId: 'peruana' },
  { name: 'México', flag: '🇲🇽', continent: 'Centro & Norteamérica', cuisineId: 'mexicana' },
  { name: 'Argentina', flag: '🇦🇷', continent: 'América del Sur' },
  { name: 'Tailandia', flag: '🇹🇭', continent: 'Asia' },
  { name: 'España', flag: '🇪🇸', continent: 'Europa', cuisineId: 'espanola' },
  { name: 'Francia', flag: '🇫🇷', continent: 'Europa', cuisineId: 'francesa' },
  { name: 'Japón', flag: '🇯🇵', continent: 'Asia' },
  { name: 'China', flag: '🇨🇳', continent: 'Asia', cuisineId: 'asiatica' },
  { name: 'Estados Unidos', flag: '🇺🇸', continent: 'Centro & Norteamérica', cuisineId: 'americana' },
  { name: 'Económicas BBB', flag: '💰', continent: 'Mundial', cuisineId: 'economica_bbb' },
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
  // 1. Selector Maestro de Modo: "Explorar Cocinas del Mundo" vs "Cocinar con mi Despensa"
  const [activeMainMode, setActiveMainMode] = useState<'cocinas' | 'despensa'>('cocinas');

  // 2. País / Gastronomía Activa (Pasaporte Gastronómico)
  const [activeCountry, setActiveCountry] = useState<{
    name: string;
    flag: string;
    continent: string;
    tagline?: string;
    goldenRule?: string;
  }>({
    name: 'Todas',
    flag: '🌍',
    continent: 'Mundial',
    tagline: 'Recetas sin misterio ni quemaduras para principiantes',
    goldenRule: 'Mise en place estricto: ten todo cortado y medido antes de encender el fuego.',
  });

  // Modal Atlas Mundial
  const [isAtlasOpen, setIsAtlasOpen] = useState(false);

  // Recetas dinámicas descubiertas por país (almacenadas en estado + sincronizadas con localStorage)
  const [dynamicWorldRecipes, setDynamicWorldRecipes] = useState<Record<string, Recipe[]>>({});
  const [isLoadingCountryDishes, setIsLoadingCountryDishes] = useState(false);
  const [countryLoadError, setCountryLoadError] = useState<string | null>(null);

  // 3. Búsqueda y Generación Directa por Nombre de Receta
  const [recipeNameInput, setRecipeNameInput] = useState('');
  const [isGeneratingByName, setIsGeneratingByName] = useState(false);
  const [isListeningSpeech, setIsListeningSpeech] = useState(false);
  const [nameGenError, setNameGenError] = useState<string | null>(null);

  // 4. Selección táctil de despensa
  const [selectedIngredientIds, setSelectedIngredientIds] = useState<string[]>([]);
  const [customInput, setCustomInput] = useState('');
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<'todos' | 'basicos' | 'frescos' | 'despensa'>('todos');

  // Cargar recetas de la caché local cuando cambia el país
  useEffect(() => {
    if (activeCountry.name === 'Todas') return;

    const cached = getCachedWorldCuisine(activeCountry.name);
    if (cached && cached.recipes.length > 0) {
      setDynamicWorldRecipes((prev) => ({
        ...prev,
        [activeCountry.name.toLowerCase()]: cached.recipes,
      }));
      if (cached.tagline && !activeCountry.tagline) {
        setActiveCountry((prev) => ({
          ...prev,
          tagline: cached.tagline,
          goldenRule: cached.goldenRule,
        }));
      }
    } else {
      // Si no hay recetas en caché ni en starter_recipes para este país, pedirlas automáticamente
      const starterMatches = STARTER_RECIPES.filter(
        (r) => r.cuisineName?.toLowerCase().includes(activeCountry.name.toLowerCase())
      );
      if (starterMatches.length === 0) {
        fetchMoreDishesForCountry(activeCountry.name, activeCountry.flag, activeCountry.continent, []);
      }
    }
  }, [activeCountry.name]);

  // Función para obtener más recetas del país vía /api/recipe/world-catalog
  const fetchMoreDishesForCountry = async (
    countryName: string,
    flag: string,
    continent: string,
    currentExcludeTitles: string[]
  ) => {
    setIsLoadingCountryDishes(true);
    setCountryLoadError(null);

    try {
      const res = await fetch('/api/recipe/world-catalog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          countryName,
          flag,
          continent,
          userLevel: userProfile.level || 1,
          count: 3,
          excludeTitles: currentExcludeTitles,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data && data.recipes && data.recipes.length > 0) {
          const key = countryName.toLowerCase();
          const existing = dynamicWorldRecipes[key] || [];
          const combined = [...existing, ...data.recipes];

          setDynamicWorldRecipes((prev) => ({
            ...prev,
            [key]: combined,
          }));

          saveCachedWorldCuisine({
            countryName,
            flag: data.flag || flag,
            tagline: data.tagline || `Auténticos platos caseros de ${countryName}.`,
            goldenRule: data.goldenRule || 'Respetar los tiempos y cocinar a fuego controlado.',
            recipes: combined,
            lastUpdated: Date.now(),
          });

          setActiveCountry((prev) => ({
            ...prev,
            tagline: data.tagline || prev.tagline,
            goldenRule: data.goldenRule || prev.goldenRule,
          }));
          return;
        }
      }
      throw new Error('No se pudieron obtener más platos');
    } catch (err: any) {
      console.warn('Chef Cero: Error cargando platos de país:', err);
      setCountryLoadError('No se pudieron cargar nuevos platos en este momento. Revisa tu conexión.');
    } finally {
      setIsLoadingCountryDishes(false);
    }
  };

  // Dictado por voz en el buscador
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
          cuisine: activeCountry.name !== 'Todas' ? activeCountry.name : undefined,
          userProfile: {
            levelTitle: userProfile.levelTitle,
            pastMistakes: userProfile.pastMistakes,
          },
        }),
      });

      if (res.ok) {
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
            cuisineName: data.cuisineName || activeCountry.name,
            countryFlag: data.countryFlag || activeCountry.flag || '✨',
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
      }
      throw new Error('API offline');
    } catch (err: any) {
      console.warn('Chef Cero: Servidor no respondió, usando recetario inteligente local:', err);
      try {
        const fallbackRecipe = generateLocalRecipeFallback(nameToQuery, userProfile.levelTitle);
        onSelectRecipe(fallbackRecipe);
        return;
      } catch (fallbackErr) {
        setNameGenError('No se pudo conectar con el asistente. Elige una de las recetas recomendadas abajo.');
      }
    } finally {
      setIsGeneratingByName(false);
    }
  };

  // Recetas dinámicas a mostrar según el país activo
  const displayedCountryRecipes = useMemo(() => {
    if (activeCountry.name === 'Todas') {
      return STARTER_RECIPES.slice(0, 8);
    }

    const key = activeCountry.name.toLowerCase();
    const dynamic = dynamicWorldRecipes[key] || [];

    // Mapear países comunes a las recetas iniciales
    let matchedStarters: Recipe[] = [];
    if (activeCountry.name === 'Chile') {
      matchedStarters = STARTER_RECIPES.filter((r) => r.cuisine === 'chilena_criolla');
    } else if (activeCountry.name === 'Italia') {
      matchedStarters = STARTER_RECIPES.filter((r) => r.cuisine === 'italiana');
    } else if (activeCountry.name === 'Perú') {
      matchedStarters = STARTER_RECIPES.filter((r) => r.cuisine === 'peruana');
    } else if (activeCountry.name === 'México') {
      matchedStarters = STARTER_RECIPES.filter((r) => r.cuisine === 'mexicana');
    } else if (activeCountry.name === 'España') {
      matchedStarters = STARTER_RECIPES.filter((r) => r.cuisine === 'espanola');
    } else if (activeCountry.name === 'Francia') {
      matchedStarters = STARTER_RECIPES.filter((r) => r.cuisine === 'francesa');
    } else if (activeCountry.name === 'Estados Unidos') {
      matchedStarters = STARTER_RECIPES.filter((r) => r.cuisine === 'americana');
    } else if (activeCountry.name === 'China' || activeCountry.name === 'Asiática') {
      matchedStarters = STARTER_RECIPES.filter((r) => r.cuisine === 'asiatica');
    } else if (activeCountry.name === 'Económicas BBB') {
      matchedStarters = STARTER_RECIPES.filter((r) => r.cuisine === 'economica_bbb');
    }

    // Combinar sin duplicados por ID o título
    const seenTitles = new Set<string>();
    const combined: Recipe[] = [];

    [...matchedStarters, ...dynamic].forEach((recipe) => {
      const cleanTitle = recipe.title.toLowerCase().trim();
      if (!seenTitles.has(cleanTitle)) {
        seenTitles.add(cleanTitle);
        combined.push(recipe);
      }
    });

    return combined.length > 0 ? combined : STARTER_RECIPES.slice(0, 4);
  }, [activeCountry.name, dynamicWorldRecipes]);

  // Motor de Matching con la despensa
  const matchedRecipes = useMemo(() => {
    if (selectedIngredientIds.length === 0) {
      return STARTER_RECIPES.slice(0, 6).map((r) => ({
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

  // Generador de receta por IA con ingredientes de despensa
  const handleAiQuickResolve = async () => {
    const list = selectedIngredientIds.join(', ');
    if (!list) return;

    setIsGeneratingAi(true);
    try {
      const res = await fetch('/api/recipe/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ingredients: list,
          cuisine: activeCountry.name !== 'Todas' ? activeCountry.name : 'economica_bbb',
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
          cuisineName: activeCountry.name !== 'Todas' ? activeCountry.name : 'Cocina Simple & Rápida',
          countryFlag: activeCountry.flag || '🍳',
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
    <div className="max-w-4xl mx-auto space-y-3.5 sm:space-y-6 animate-fade-in pb-16 px-2.5 sm:px-4">
      
      {/* 1. HERO COMPACTO Y CÁLIDO (Optimizado para pliegue móvil 375px) */}
      <section className="text-center pt-0.5 sm:pt-2 space-y-1 sm:space-y-1.5">
        <h1 className="text-xl sm:text-3xl font-black text-stone-900 tracking-tight font-serif leading-tight">
          ¿Qué cocinamos hoy?
        </h1>
        <p className="text-[11px] sm:text-xs text-stone-500 max-w-sm sm:max-w-lg mx-auto leading-snug">
          Pide cualquier plato o viaja por más de 190 países con fotos apetitosas y técnica a prueba de errores.
        </p>

        {/* 2. BUSCADOR OMNICANAL EN LÍNEA ÚNICA (Cero scroll en 375px) */}
        <div className="max-w-2xl mx-auto pt-0.5 sm:pt-1">
          <form 
            onSubmit={(e) => {
              e.preventDefault();
              handleGenerateByName();
            }}
            className="bg-white p-1 sm:p-1.5 rounded-2xl border border-stone-200 shadow-2xs flex flex-row items-center gap-1.5 sm:gap-2 transition focus-within:border-amber-400 focus-within:ring-2 focus-within:ring-amber-200/50"
          >
            <div className="relative flex-1 flex items-center min-w-0">
              <Search className="w-4 h-4 sm:w-5 sm:h-5 text-stone-400 ml-2.5 sm:ml-3 shrink-0" />
              <input
                type="text"
                value={recipeNameInput}
                onChange={(e) => setRecipeNameInput(e.target.value)}
                placeholder={
                  isListeningSpeech 
                    ? "Escuchando... di cualquier plato..." 
                    : activeCountry.name !== 'Todas' 
                      ? `Plato de ${activeCountry.name} o pedir receta...`
                      : "Escribe plato (ej: Tomaticán, Carbonara...)"
                }
                className={`w-full pl-2 sm:pl-3 pr-16 sm:pr-20 py-1.5 sm:py-2 text-xs sm:text-base font-medium text-stone-900 placeholder:text-stone-400 focus:outline-none bg-transparent truncate ${isListeningSpeech ? 'text-amber-800 placeholder:text-amber-700 animate-pulse' : ''}`}
              />
              <div className="absolute right-1.5 sm:right-2 flex items-center gap-0.5 sm:gap-1">
                {recipeNameInput && (
                  <button
                    type="button"
                    onClick={() => setRecipeNameInput('')}
                    className="p-1 hover:bg-stone-100 rounded-full text-stone-400 cursor-pointer"
                    title="Limpiar"
                  >
                    <X className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={startVoiceSearch}
                  className={`p-1 sm:p-1.5 rounded-xl transition cursor-pointer flex items-center gap-1 ${
                    isListeningSpeech
                      ? 'bg-rose-500 text-white animate-bounce shadow-xs ring-2 ring-rose-300'
                      : 'text-stone-400 hover:text-stone-800 hover:bg-stone-100'
                  }`}
                  title="Dictar plato por voz"
                >
                  <Mic className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </button>
              </div>
            </div>
            
            <button
              type="submit"
              disabled={!recipeNameInput.trim() || isGeneratingByName}
              className="px-3 sm:px-5 py-1.5 sm:py-2 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-stone-950 font-black text-xs sm:text-sm flex items-center justify-center gap-1 sm:gap-1.5 shadow-2xs transition active:scale-98 cursor-pointer shrink-0"
            >
              {isGeneratingByName ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-stone-950" />
                  <span className="hidden xs:inline">Cocinando...</span>
                </>
              ) : (
                <>
                  <span className="hidden xs:inline">Cocinar</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </form>

          {nameGenError && (
            <p className="text-[11px] text-rose-600 font-bold mt-1 text-center">
              {nameGenError}
            </p>
          )}

          {/* 3. ACCESO DIRECTO AL INSPECTOR CON FOTO (COMPACTO) */}
          <div className="flex flex-wrap items-center justify-center gap-1.5 pt-1.5 sm:pt-2.5 text-[11px] sm:text-xs">
            {onOpenScanner && (
              <button
                type="button"
                onClick={() => onOpenScanner('inspect_product')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-emerald-50/60 border border-emerald-300/80 text-emerald-950 font-bold shadow-2xs transition hover:border-emerald-400 cursor-pointer group"
              >
                <Camera className="w-3.5 h-3.5 text-emerald-600 group-hover:scale-110 transition-transform" />
                <span className="truncate">Foto a mi heladera o producto</span>
                <span className="text-[9px] bg-emerald-100 text-emerald-800 px-1 py-0.2 rounded font-semibold">Cámara</span>
              </button>
            )}

            {onOpenRecipeImport && (
              <button
                type="button"
                onClick={onOpenRecipeImport}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white hover:bg-stone-50 border border-stone-200 text-stone-600 hover:text-stone-900 font-medium transition cursor-pointer"
                title="Pegar enlace de blog o texto"
              >
                <span>📋</span>
                <span className="hidden sm:inline">Importar de web</span>
              </button>
            )}
          </div>
        </div>
      </section>

      {/* 4. SELECTOR MAESTRO DE MODO (DOS MODELOS MENTALES CLAROS) */}
      <div className="flex justify-center pt-0.5 sm:pt-1">
        <div className="p-0.5 sm:p-1 bg-stone-200/80 rounded-2xl flex items-center gap-1 w-full max-w-md shadow-inner">
          <button
            type="button"
            onClick={() => setActiveMainMode('cocinas')}
            className={`flex-1 py-1.5 sm:py-2.5 px-2.5 sm:px-3 rounded-xl text-[11px] sm:text-sm font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeMainMode === 'cocinas'
                ? 'bg-white text-stone-900 shadow-xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <span>🌍</span>
            <span>Pasaporte Gastronómico</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveMainMode('despensa')}
            className={`flex-1 py-1.5 sm:py-2.5 px-2.5 sm:px-3 rounded-xl text-[11px] sm:text-sm font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeMainMode === 'despensa'
                ? 'bg-white text-stone-900 shadow-xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <span>🥫</span>
            <span>Mi despensa</span>
            {selectedIngredientIds.length > 0 && (
              <span className="w-4 h-4 rounded-full bg-amber-500 text-stone-950 text-[9px] font-black flex items-center justify-center">
                {selectedIngredientIds.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* 5A. MODO PASAPORTE GASTRONÓMICO MUNDIAL (CATÁLOGO INFINITO DE RECETAS) */}
      {activeMainMode === 'cocinas' && (
        <div className="space-y-3 sm:space-y-6 animate-fade-in">
          
          {/* BARRA HORIZONTAL ELEGANTE DE PAÍSES + BOTÓN ATLAS MUNDIAL 190+ */}
          <div className="space-y-1.5 sm:space-y-2.5">
            <div className="flex items-center justify-between text-xs px-1">
              <span className="font-bold text-stone-500 uppercase tracking-wider text-[10px] sm:text-[11px] flex items-center gap-1.5">
                <Globe className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-600" />
                <span>Explorar país gastronómico:</span>
              </span>
              
              <button
                type="button"
                onClick={() => setIsAtlasOpen(true)}
                className="text-[11px] sm:text-xs font-bold text-amber-800 hover:text-amber-950 flex items-center gap-1 hover:underline cursor-pointer"
              >
                <span>Atlas de 190+ Países</span>
                <ChevronRight className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              </button>
            </div>

            {/* Chips de Países Rápidos + Botón del Atlas */}
            <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-1.5 scrollbar-none">
              
              {/* Si el país activo no está en la barra rápida, mostrarlo como primer chip */}
              {activeCountry.name !== 'Todas' && !POPULAR_QUICK_COUNTRIES.some((c) => c.name === activeCountry.name) && (
                <button
                  type="button"
                  className="px-3.5 py-2 rounded-2xl text-xs font-black transition flex items-center gap-2 shrink-0 bg-amber-500 text-stone-950 shadow-xs ring-2 ring-amber-400/40"
                >
                  <span className="text-base leading-none">{activeCountry.flag}</span>
                  <span>{activeCountry.name}</span>
                </button>
              )}

              {POPULAR_QUICK_COUNTRIES.map((c) => {
                const isSelected = activeCountry.name === c.name;
                return (
                  <button
                    key={c.name}
                    type="button"
                    onClick={() => {
                      setActiveCountry({
                        name: c.name,
                        flag: c.flag,
                        continent: c.continent,
                      });
                    }}
                    className={`px-3.5 py-2 rounded-2xl text-xs font-bold transition flex items-center gap-2 shrink-0 cursor-pointer active:scale-97 ${
                      isSelected
                        ? 'bg-amber-500 text-stone-950 shadow-xs ring-2 ring-amber-400/40 font-black'
                        : 'bg-white hover:bg-stone-50 border border-stone-200 text-stone-700 hover:border-amber-300'
                    }`}
                  >
                    <span className="text-base leading-none">{c.flag}</span>
                    <span>{c.name}</span>
                  </button>
                );
              })}

              {/* Botón Destacado: Abrir Atlas de 190+ Países */}
              <button
                type="button"
                onClick={() => setIsAtlasOpen(true)}
                className="px-4 py-2 rounded-2xl text-xs font-black bg-stone-900 hover:bg-stone-800 text-white flex items-center gap-2 shrink-0 shadow-xs transition cursor-pointer active:scale-97"
              >
                <span>🗺️</span>
                <span>+ 190 Países</span>
              </button>
            </div>

            {/* Banner editorial con la Regla de Oro del País seleccionado */}
            {activeCountry.name !== 'Todas' && (
              <div className="p-3.5 rounded-2xl bg-amber-50/80 border border-amber-200/90 flex items-start gap-3 text-xs animate-fade-in">
                <span className="text-2xl leading-none mt-0.5">{activeCountry.flag}</span>
                <div className="space-y-0.5 flex-1">
                  <div className="flex items-center justify-between">
                    <h3 className="font-black text-amber-950 font-serif text-sm">
                      Gastronomía de {activeCountry.name}
                    </h3>
                    <span className="text-[10px] bg-amber-200 text-amber-900 font-bold px-2 py-0.5 rounded-full">
                      {activeCountry.continent}
                    </span>
                  </div>
                  {activeCountry.tagline && (
                    <p className="text-amber-800 text-xs font-medium">
                      {activeCountry.tagline}
                    </p>
                  )}
                  {activeCountry.goldenRule && (
                    <p className="text-stone-600 text-xs leading-relaxed pt-0.5">
                      <strong className="text-amber-900 font-semibold">Regla de oro: </strong>
                      {activeCountry.goldenRule}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* CATÁLOGO DE RECETAS CON FOTOS APETITOSAS Y DISEÑO PULIDO */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base sm:text-lg font-black text-stone-900 font-serif flex items-center gap-2">
                  <span>🍽️</span>
                  <span>
                    {activeCountry.name === 'Todas'
                      ? 'Recetas recomendadas del mundo'
                      : `Platos auténticos de ${activeCountry.name}`}
                  </span>
                </h2>
                <p className="text-xs text-stone-500">
                  {displayedCountryRecipes.length} recetas a prueba de fuego y con sustitutos de despensa común.
                </p>
              </div>

              {activeCountry.name !== 'Todas' && (
                <button
                  type="button"
                  onClick={() => {
                    const currentTitles = displayedCountryRecipes.map((r) => r.title);
                    fetchMoreDishesForCountry(activeCountry.name, activeCountry.flag, activeCountry.continent, currentTitles);
                  }}
                  disabled={isLoadingCountryDishes}
                  className="px-3.5 py-1.5 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-950 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  title="Generar más platos únicos de este país"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingCountryDishes ? 'animate-spin text-amber-600' : 'text-amber-800'}`} />
                  <span>{isLoadingCountryDishes ? 'Buscando...' : '+ Más platos'}</span>
                </button>
              )}
            </div>

            {countryLoadError && (
              <p className="text-xs text-rose-600 font-bold text-center bg-rose-50 p-2 rounded-xl border border-rose-200">
                {countryLoadError}
              </p>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {displayedCountryRecipes.map((recipe) => (
                <div
                  key={recipe.id}
                  onClick={() => onSelectRecipe(recipe)}
                  className="bg-white rounded-3xl border border-stone-200 overflow-hidden hover:border-amber-400 hover:shadow-lg transition-all duration-300 cursor-pointer flex flex-col group active:scale-[0.99]"
                >
                  {/* Imagen Apetitosa en 16:9 */}
                  <div className="relative h-44 w-full bg-stone-100 overflow-hidden">
                    <img
                      src={recipe.imageUrl || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80'}
                      alt={recipe.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      loading="lazy"
                      onError={(e) => {
                        const target = e.currentTarget;
                        if (!target.dataset.fallback) {
                          target.dataset.fallback = 'true';
                          target.src = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80';
                        }
                      }}
                    />
                    
                    {/* Metadata limpia sobre la foto */}
                    <div className="absolute top-3 left-3 flex items-center gap-1.5">
                      <span className="bg-stone-900/85 backdrop-blur-xs text-white text-[11px] font-bold px-2.5 py-1 rounded-xl shadow-xs flex items-center gap-1">
                        <Clock className="w-3 h-3 text-amber-400" />
                        <span>{recipe.totalTimeMinutes} min</span>
                      </span>
                      {recipe.countryFlag && (
                        <span className="bg-stone-900/85 backdrop-blur-xs text-white text-xs px-2 py-0.5 rounded-xl shadow-xs">
                          {recipe.countryFlag}
                        </span>
                      )}
                    </div>

                    <div className="absolute bottom-2.5 right-2.5 bg-stone-900/80 backdrop-blur-xs text-white text-[10px] font-bold px-2 py-0.5 rounded-lg">
                      {recipe.difficulty}
                    </div>
                  </div>

                  {/* Cuerpo de la tarjeta con CTA elegante */}
                  <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between space-y-3">
                    <div>
                      <h3 className="text-base sm:text-lg font-black text-stone-900 group-hover:text-amber-800 transition line-clamp-1 font-serif">
                        {recipe.title.split('(')[0]}
                      </h3>
                      <p className="text-xs text-stone-600 mt-1 line-clamp-2 leading-relaxed">
                        {recipe.description}
                      </p>
                    </div>

                    <div className="pt-2.5 border-t border-stone-100 flex items-center justify-between">
                      <div className="text-xs text-stone-500 font-medium">
                        <span>{recipe.steps.length} pasos</span>
                        <span className="mx-1.5 text-stone-300">·</span>
                        <span>{recipe.servings} porciones</span>
                      </div>

                      {/* CTA sutil y armónico */}
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-900 group-hover:text-amber-600 group-hover:translate-x-0.5 transition-all">
                        <span>Cocinar receta</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* BOTÓN DE CATÁLOGO INFINITO: DESCUBRIR MÁS PLATOS DE ESTE PAÍS */}
            {activeCountry.name !== 'Todas' && (
              <div className="pt-3 text-center">
                <button
                  type="button"
                  onClick={() => {
                    const currentTitles = displayedCountryRecipes.map((r) => r.title);
                    fetchMoreDishesForCountry(activeCountry.name, activeCountry.flag, activeCountry.continent, currentTitles);
                  }}
                  disabled={isLoadingCountryDishes}
                  className="px-6 py-3.5 rounded-2xl bg-white hover:bg-amber-50/70 border-2 border-amber-300 text-stone-900 font-black text-xs sm:text-sm transition-all shadow-xs hover:shadow-md cursor-pointer inline-flex items-center gap-2.5 group active:scale-98 disabled:opacity-60"
                >
                  {isLoadingCountryDishes ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-amber-600" />
                      <span>Descubriendo nuevos platos de {activeCountry.name}...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 text-amber-500 group-hover:rotate-12 transition-transform" />
                      <span>Descubrir más platos auténticos de {activeCountry.name}</span>
                      <span className="text-base leading-none">{activeCountry.flag}</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </section>
        </div>
      )}

      {/* 5B. MODO COCINAR CON MI DESPENSA (TÁCTIL) */}
      {activeMainMode === 'despensa' && (
        <div className="space-y-6 animate-fade-in">
          <section className="bg-white rounded-3xl p-5 sm:p-6 border border-stone-200 shadow-sm space-y-4">
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-100 pb-3">
              <div>
                <h2 className="text-base sm:text-lg font-black text-stone-900 font-serif flex items-center gap-2">
                  <span>🥣</span>
                  <span>Toca lo que tienes en tu cocina:</span>
                </h2>
                <p className="text-xs text-stone-500">
                  Selecciona uno o más ingredientes para ver platos posibles sin salir a comprar.
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

            {/* Ingredientes marcados con CTA grande */}
            {selectedIngredientIds.length > 0 ? (
              <div className="p-3 rounded-2xl bg-amber-50/70 border border-amber-200 space-y-3">
                <div className="flex flex-wrap gap-1.5">
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

                <button
                  type="button"
                  onClick={handleAiQuickResolve}
                  disabled={isGeneratingAi}
                  className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-stone-950 font-black text-sm flex items-center justify-center gap-2 shadow-sm transition active:scale-98 cursor-pointer"
                >
                  {isGeneratingAi ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-stone-950" />
                      <span>Creando receta a tu medida...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 text-stone-950 fill-stone-950" />
                      <span>Crear receta con estos {selectedIngredientIds.length} ingredientes</span>
                    </>
                  )}
                </button>
              </div>
            ) : (
              <div className="py-2.5 px-3 rounded-xl bg-stone-50 border border-dashed border-stone-200 text-xs text-stone-500 text-center">
                Aún no has marcado ingredientes. Toca los botones de abajo para comenzar.
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
                      ? 'bg-amber-500 text-stone-950 shadow-2xs'
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

            {/* Input para agregar ingrediente personalizado */}
            <form onSubmit={addCustomIngredient} className="flex gap-2 pt-1">
              <input
                type="text"
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value)}
                placeholder="¿Tienes otro ingrediente? (ej: zanahoria, mantequilla, carne...)"
                className="flex-1 pl-3.5 pr-4 py-2 bg-stone-50 border border-stone-300 rounded-xl text-xs text-stone-900 placeholder:text-stone-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
              <button
                type="submit"
                disabled={!customInput.trim()}
                className="px-4 py-2 bg-stone-800 hover:bg-stone-900 disabled:opacity-40 text-white font-bold text-xs rounded-xl transition cursor-pointer shrink-0"
              >
                + Agregar
              </button>
            </form>
          </section>

          {/* Recetas coincidentes */}
          <section className="space-y-4">
            <h2 className="text-base sm:text-lg font-black text-stone-900 font-serif">
              {selectedIngredientIds.length > 0 
                ? `Platos posibles con tus ingredientes:`
                : `Recetas con ingredientes cotidianos:`}
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {matchedRecipes.map(({ recipe, matchCount }) => (
                <div
                  key={recipe.id}
                  onClick={() => onSelectRecipe(recipe)}
                  className="bg-white rounded-3xl border border-stone-200 overflow-hidden hover:border-amber-400 hover:shadow-md transition cursor-pointer flex flex-col group active:scale-[0.99]"
                >
                  <div className="relative h-40 w-full bg-stone-100 overflow-hidden">
                    <img
                      src={recipe.imageUrl || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80'}
                      alt={recipe.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                      onError={(e) => {
                        const target = e.currentTarget;
                        if (!target.dataset.fallback) {
                          target.dataset.fallback = 'true';
                          target.src = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80';
                        }
                      }}
                    />
                    
                    <div className="absolute top-3 left-3 flex items-center gap-1.5">
                      <span className="bg-stone-900/85 backdrop-blur-xs text-white text-[11px] font-bold px-2.5 py-1 rounded-xl shadow-xs flex items-center gap-1">
                        <Clock className="w-3 h-3 text-amber-400" />
                        <span>{recipe.totalTimeMinutes} min</span>
                      </span>
                      
                      {selectedIngredientIds.length > 0 && matchCount > 0 && (
                        <span className="bg-emerald-600 text-white text-[11px] font-bold px-2.5 py-1 rounded-xl shadow-xs">
                          {matchCount} coincidente{matchCount > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between space-y-3">
                    <div>
                      <h3 className="text-base sm:text-lg font-black text-stone-900 group-hover:text-amber-800 transition line-clamp-1 font-serif">
                        {recipe.title.split('(')[0]}
                      </h3>
                      <p className="text-xs text-stone-600 mt-1 line-clamp-2 leading-relaxed">
                        {recipe.description}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-stone-100 flex items-center justify-between">
                      <span className="text-xs text-stone-500 font-medium">
                        {recipe.difficulty} • {recipe.steps.length} pasos
                      </span>

                      <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-900 group-hover:text-amber-600">
                        <span>Cocinar</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {/* 6. TRANQUILIDAD Y AUXILIO: BANNER DISCRETO DE S.O.S. AL FINAL */}
      {onOpenEmergency && (
        <div className="pt-4 text-center">
          <button
            type="button"
            onClick={onOpenEmergency}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-stone-100 hover:bg-rose-50 border border-stone-200 hover:border-rose-200 text-stone-600 hover:text-rose-700 text-xs font-semibold transition cursor-pointer"
          >
            <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
            <span>¿Ya estás cocinando y algo se pega o quema? Abrir auxilio de emergencia (S.O.S.)</span>
          </button>
        </div>
      )}

      {/* MODAL DEL ATLAS MUNDIAL GASTRONÓMICO (190+ PAÍSES) */}
      <WorldAtlasModal
        isOpen={isAtlasOpen}
        onClose={() => setIsAtlasOpen(false)}
        onSelectCountry={(country) => {
          setActiveCountry({
            name: country.name,
            flag: country.flag,
            continent: country.continent,
          });
        }}
        currentSelectedCountryName={activeCountry.name}
      />

    </div>
  );
};
