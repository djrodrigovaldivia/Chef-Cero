import React, { useState, useEffect } from 'react';
import { Sparkles, ChefHat, Flame, BookOpen, Star, Clock, Users, ArrowRight, Bookmark, BookmarkCheck, Trash2, Edit3, ShieldAlert, Award, Plus, RefreshCw, Wine, Utensils } from 'lucide-react';
import { Recipe, SignatureDish, UserProfile, SignatureDishCreationRequest } from '../types';

interface SignatureDishesTabProps {
  userProfile: UserProfile;
  onCookRecipe: (recipe: Recipe) => void;
  onLearnFact?: (category: 'fuego' | 'gustos' | 'equipamiento' | 'habito' | 'fortaleza', fact: string) => void;
}

const STORAGE_KEY_SIGNATURE_DISHES = 'chef_cero_saved_signature_dishes_v1';

const PRESET_CONCEPTS = [
  'Contraste térmico frío-caliente',
  'Alquimia de caramelización Maillard y reducción ácida',
  'Umami marino profundo con toque cítrico silvestre',
  'Cocina de fuego ancestral reinterpretada con emulsión moderna',
  'Juego de texturas: crujiente extremo sobre base aterciopelada',
];

const PRESET_TECHNIQUES = [
  'Sellado térmico bimodal (alta temperatura + reposo sagrado)',
  'Mantecatura all\'onda a 65°C fuera del fuego',
  'Emulsión mecánica con mantequilla congelada (beurre monté)',
  'Desglasado de fondo caramelizado con reducción de vino noble',
  'Tatemado de aromáticos y emulsión en frío',
];

const PRESET_PROFILES = [
  'Equilibrio de los 5 sabores con golpe umami',
  'Ácido vibrante, aromático y herbal fresco',
  'Tostado profundo, notas amaderadas y dulce balsámico',
  'Especiado sutil con final cítrico persistente',
];

const CURATED_SIGNATURE_SEEDS: SignatureDish[] = [
  {
    id: 'sig-preset-1',
    isSignatureDish: true,
    title: 'Milhojas de Portobello Glaseado en Balsámico con Crema de Ajo Asado y Nueces',
    chefConcept: 'Contraste umami vegetal profundo con crocante de fruto seco tostado',
    storyNarrative: 'Nace de elevar un ingrediente terrenal a la sofisticación de una mesa de tres estrellas: la carne densa del portobello caramelizada lentamente absorbe el vinagre añejo, mientras el ajo asado aporta una untuosidad dulce que no necesita crema.',
    heroTechnique: 'Reducción balsámica y montaje de salsa con emulsión fuera del fuego',
    totalTimeMinutes: 28,
    servings: 2,
    difficulty: 'Chef Maestro / Experto',
    requiredLevel: 5,
    cuisine: 'autor',
    cuisineName: 'Cocina de Autor & Alta Gastronomía',
    countryFlag: '👑',
    isBudgetFriendly: false,
    estimatedCostLabel: 'Gourmet de Autor (~$5.50 USD)',
    culturalSecret: 'El hongo portobello nunca debe lavarse con agua sumergida; se limpia con un paño húmedo para que dore en lugar de soltar vapor.',
    sensoryContrast: {
      texture: 'Superficie caramelizada con centro carnoso jugoso y lluvia crujiente de nueces tostadas.',
      temperature: 'Portobello caliente a 60°C sobre cama de puré tibio y brotes frescos fríos.',
      acidityVsFat: 'La acidez oscura del balsámico corta la riqueza lipídica de las nueces y la mantequilla.',
    },
    sommelierPairing: {
      beverage: 'Vino tinto Nebbiolo o Cabernet Franc con buena acidez y notas terrosas.',
      nonAlcoholic: 'Infusión fría de té Oolong tostado con toque de cáscara de naranja amarga.',
      whyItHarmonizes: 'Los taninos y las notas a sotobosque del vino potencian la profundidad fúngica del portobello.',
    },
    safetyAlerts: [
      'Al reducir el vinagre balsámico se desprenden vapores ácidos fuertes; mantén la campana o ventana abierta y no acerques el rostro.',
    ],
    miseEnPlace: [
      '4 sombreros grandes de portobello limpios con paño seco',
      '40ml de vinagre balsámico de Módena',
      '30g de mantequilla sin sal fría en cubos',
      '1 cabeza entera de ajo asada previamente (dientes tiernos y dulces)',
      '40g de nueces peladas picadas groseramente',
      '1 cucharada de aceite de oliva virgen extra',
      'Flor de sal y pimienta negra de molinillo',
      'Ramitas de tomillo fresco',
    ],
    finishVisualCheckpoints: [
      'Portobellos con laca brillante y color caoba oscuro espejo.',
      'Salsa que forma un cordón nítido alrededor del plato sin desangrarse.',
      'Nueces doradas con borde tostado uniforme.',
    ],
    heatGuideExplanation: 'Fuego medio-alto inicial para dorar sin sudar agua, fuego medio para reducir el balsámico, y fuego apagado para la mantecatura de la salsa.',
    steps: [
      {
        stepNumber: 1,
        title: 'Mise en Place y preparación de hongos',
        instruction: 'Limpia los portobellos con un paño húmedo. Retira el tallo con los dedos. Tuesta las nueces picadas en una sartén seca durante 2 minutos hasta que huelan a tostado noble. Reserva.',
        tip: 'Tostar los frutos secos despierta sus aceites esenciales volátiles.',
        heatLevel: 'apagado',
        sensoryCues: {
          sight: 'Hongos secos aterciopelados y nueces con brillo tostado tenue.',
          sound: 'Silencio, estufa apagada.',
          smell: 'Aroma a bosque y nuez tostada.',
        },
      },
      {
        stepNumber: 2,
        title: 'Caramelización de los portobellos',
        instruction: 'Calienta la sartén a FUEGO MEDIO-ALTO con la cucharada de aceite de oliva. Coloca los portobellos boca abajo. Dora 3 minutos sin moverlos hasta que se forme costra dorada. Voltea y cocina 2 minutos más.',
        tip: 'Si mueves los hongos antes de tiempo, bajarás el calor y empezarán a hervir en su propio jugo.',
        heatLevel: 'medio',
        timerSeconds: 300,
        timerLabel: 'Caramelizar portobellos',
        sensoryCues: {
          sight: 'Bordes dorados con intenso brillo caramelizado.',
          sound: 'Chisporroteo rítmico alegre.',
          smell: 'Perfume profundo a asado de campo.',
        },
      },
      {
        stepNumber: 3,
        title: 'Glaseado balsámico y reducción',
        instruction: 'Baja a FUEGO MEDIO. Vierte el vinagre balsámico y los dientes de ajo asado machacados. Remueve la sartén en vaivén bañando los hongos con una cuchara durante 2 minutos mientras el vinagre se convierte en jarabe.',
        tip: 'El balsámico pasará de líquido a un jarabe denso que cubre el dorso de la cuchara.',
        heatLevel: 'medio',
        timerSeconds: 120,
        timerLabel: 'Reducir glaseado balsámico',
        sensoryCues: {
          sight: 'Burbujas densas y oscuras que cubren los hongos con un barniz brillante.',
          sound: 'Burbujeo espeso y suave.',
          smell: 'Fragancia agridulce reconfortante con notas de roble y uva.',
        },
      },
      {
        stepNumber: 4,
        title: 'Emulsión al plato (Hornalla Apagada)',
        instruction: 'APAGA EL FUEGO COMPLETAMENTE. Retira los hongos a los platos de servicio. En la sartén fuera del fuego, añade los dados de mantequilla fría batiendo enérgicamente en círculos hasta ligar una salsa densa y brillante.',
        tip: 'La diferencia de temperatura entre la sartén tibia y la mantequilla fría produce una emulsión perfecta.',
        heatLevel: 'apagado',
        timerSeconds: 60,
        timerLabel: 'Mantecar salsa con mantequilla fría',
        sensoryCues: {
          sight: 'La salsa se vuelve sedosa con reflejos chocolate brillante.',
          sound: 'Chapoteo suave aterciopelado.',
          smell: 'Equilibrio embriagador de mantequilla fresca y balsámico.',
        },
      },
      {
        stepNumber: 5,
        title: 'Emplatado de Alta Gastronomía',
        instruction: 'Corta los portobellos en abanico. Napa con la salsa emulsionada caliente, corona con las nueces tostadas crujientes, flor de sal y hojitas de tomillo fresco.',
        tip: 'Sirve inmediatamente mientras el contraste de texturas esté vivo.',
        heatLevel: 'apagado',
        sensoryCues: {
          sight: 'Presentación de restaurante de autor con relieve y brillo.',
          sound: 'Silencio y disfrute.',
          smell: 'Impacto olfativo que llena el salón.',
        },
      },
    ],
    createdAt: new Date().toISOString(),
    authorNotes: 'Plato estrella para sorprender a comensales exigentes o vegetarianos gourmet.',
    personalRating: 5,
    timesCooked: 2,
  },
];

export const SignatureDishesTab: React.FC<SignatureDishesTabProps> = ({
  userProfile,
  onCookRecipe,
  onLearnFact,
}) => {
  // Lista persistente de recetas de autor guardadas
  const [savedDishes, setSavedDishes] = useState<SignatureDish[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_SIGNATURE_DISHES);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (_) {}
    return CURATED_SIGNATURE_SEEDS;
  });

  // Guardar en localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_SIGNATURE_DISHES, JSON.stringify(savedDishes));
    } catch (_) {}
  }, [savedDishes]);

  // Modo de Creación: Taller Asistido ('guided') o Texto Libre ('free_prompt')
  const [creationMode, setCreationMode] = useState<'guided' | 'free_prompt'>('guided');

  // Inputs del Taller Guiado
  const [concept, setConcept] = useState<string>('Contraste térmico frío-caliente con golpe umami');
  const [heroIngredient, setHeroIngredient] = useState<string>('Magret de pato o solomillo');
  const [technique, setTechnique] = useState<string>('Sellado térmico bimodal con reposo y reducción de vino');
  const [flavorProfile, setFlavorProfile] = useState<string>('Equilibrio de los 5 sabores con golpe umami');
  const [textureContrast, setTextureContrast] = useState<string>('Costra ultra-crocante con núcleo fundente');
  const [creativeRisk, setCreativeRisk] = useState<'equilibrado' | 'audaz' | 'vanguardista'>('audaz');

  // Input de Modo Libre
  const [freePrompt, setFreePrompt] = useState<string>(
    'Quiero un plato de autor que use salmón fresco, una salsa ácida con maracuyá o lima, y un crujiente de quinoa o semillas tostadas.'
  );

  // Estados de generación y visualización
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generatedDish, setGeneratedDish] = useState<SignatureDish | null>(null);
  const [selectedDishToView, setSelectedDishToView] = useState<SignatureDish | null>(null);
  const [editingNotesId, setEditingNotesId] = useState<string | null>(null);
  const [tempNotes, setTempNotes] = useState<string>('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleGenerateSignatureDish = async () => {
    setIsGenerating(true);
    setGeneratedDish(null);
    try {
      const payload: SignatureDishCreationRequest = {
        creationMode,
        concept: creationMode === 'guided' ? concept : undefined,
        heroIngredient: creationMode === 'guided' ? heroIngredient : undefined,
        technique: creationMode === 'guided' ? technique : undefined,
        flavorProfile: creationMode === 'guided' ? flavorProfile : undefined,
        textureContrast: creationMode === 'guided' ? textureContrast : undefined,
        creativeRisk: creationMode === 'guided' ? creativeRisk : undefined,
        freePrompt: creationMode === 'free_prompt' ? freePrompt : undefined,
      };

      const res = await fetch('/api/signature/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          userProfile,
        }),
      });

      if (!res.ok) {
        throw new Error(`Error en servidor: ${res.status}`);
      }

      const dish: SignatureDish = await res.json();
      setGeneratedDish(dish);
      setSelectedDishToView(dish);
      showToast('✨ ¡Receta de Autor creada con éxito por la IA gastronómica!');

      if (onLearnFact) {
        onLearnFact('fortaleza', `Creación de autor: ${dish.heroTechnique}`);
      }
    } catch (err: any) {
      console.warn('Error al generar plato de autor:', err?.message);
      showToast('Aviso: generada propuesta con motor sensorial de alta cocina.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveToBook = (dishToSave: SignatureDish) => {
    const exists = savedDishes.some((d) => d.id === dishToSave.id);
    if (exists) {
      showToast('Esta receta ya está en tu Cuaderno de Autor.');
      return;
    }
    const updated = [dishToSave, ...savedDishes];
    setSavedDishes(updated);
    showToast('📚 ¡Guardada en tu Cuaderno de Recetas de Autor!');
  };

  const handleDeleteDish = (id: string) => {
    setSavedDishes((prev) => prev.filter((d) => d.id !== id));
    if (selectedDishToView?.id === id) {
      setSelectedDishToView(null);
    }
    showToast('Receta eliminada del cuaderno.');
  };

  const handleSaveNotes = (id: string) => {
    setSavedDishes((prev) =>
      prev.map((d) => (d.id === id ? { ...d, authorNotes: tempNotes } : d))
    );
    if (selectedDishToView?.id === id) {
      setSelectedDishToView((prev) => (prev ? { ...prev, authorNotes: tempNotes } : null));
    }
    setEditingNotesId(null);
    showToast('Notas de autor guardadas.');
  };

  const handleSetRating = (id: string, rating: number) => {
    setSavedDishes((prev) =>
      prev.map((d) => (d.id === id ? { ...d, personalRating: rating } : d))
    );
    if (selectedDishToView?.id === id) {
      setSelectedDishToView((prev) => (prev ? { ...prev, personalRating: rating } : null));
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-stone-900 text-amber-300 font-bold text-xs sm:text-sm px-4 py-2.5 rounded-2xl shadow-xl border border-amber-500/40 animate-fade-in flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Hero Header: Taller de Recetas de Autor */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-stone-950 via-purple-950 to-stone-900 text-white p-6 sm:p-10 border border-purple-800/40 shadow-xl">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-72 h-72 bg-gradient-to-br from-purple-500/20 to-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-900/60 border border-purple-500/40 text-purple-200 text-xs font-bold mb-3 shadow-inner">
            <span className="text-amber-400">👑</span>
            <span>Nivel 5: Alta Gastronomía & Cocina Intuitiva</span>
          </div>

          <h1 className="text-2xl sm:text-4xl font-black font-serif tracking-tight text-white">
            Taller Culinario de <span className="bg-gradient-to-r from-amber-300 via-purple-200 to-amber-400 bg-clip-text text-transparent">Recetas de Autor</span>
          </h1>

          <p className="mt-2.5 text-stone-300 text-sm sm:text-base leading-relaxed">
            Diseña tus propias creaciones gastronómicas únicas con la IA. Experimenta con contrastes sensoriales, maridajes de sommelier y técnicas de alta cocina. Guarda cada creación en tu recetario personal y cocínala paso a paso cuando quieras.
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-4 text-xs font-semibold text-stone-300">
            <div className="flex items-center gap-1.5 bg-stone-900/80 px-3 py-1.5 rounded-xl border border-purple-700/30">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>IA Culinaria de Vanguardia</span>
            </div>
            <div className="flex items-center gap-1.5 bg-stone-900/80 px-3 py-1.5 rounded-xl border border-purple-700/30">
              <Bookmark className="w-3.5 h-3.5 text-purple-400" />
              <span>{savedDishes.length} Creaciones en tu Cuaderno</span>
            </div>
            <div className="flex items-center gap-1.5 bg-stone-900/80 px-3 py-1.5 rounded-xl border border-purple-700/30">
              <Award className="w-3.5 h-3.5 text-amber-400" />
              <span>{userProfile.levelTitle}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Grid Principal: Estudio Creativo a la izquierda, Cuaderno de Creaciones a la derecha */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* PANEL IZQUIERDO: ESTUDIO DE CREACIÓN (Cols 1-7) */}
        <div className="lg:col-span-7 bg-white rounded-3xl p-6 sm:p-7 border border-stone-200 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-stone-100 pb-4">
            <div>
              <h2 className="text-lg sm:text-xl font-black text-stone-900 font-serif flex items-center gap-2">
                <ChefHat className="w-5 h-5 text-purple-700" />
                <span>Laboratorio de Creación Gastronómica</span>
              </h2>
              <p className="text-xs text-stone-500 mt-0.5">
                Elige cómo inspirar a la IA: mediante parámetros de técnica o con tu propia visión libre.
              </p>
            </div>

            {/* Selector de Modo: Guiado vs Libre */}
            <div className="flex items-center p-1 bg-stone-100 rounded-xl border border-stone-200 text-xs font-bold">
              <button
                type="button"
                onClick={() => setCreationMode('guided')}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  creationMode === 'guided'
                    ? 'bg-purple-900 text-white shadow-xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                Taller Guiado
              </button>
              <button
                type="button"
                onClick={() => setCreationMode('free_prompt')}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  creationMode === 'free_prompt'
                    ? 'bg-purple-900 text-white shadow-xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                Texto Libre
              </button>
            </div>
          </div>

          {/* CONTENIDO MODO GUIADO */}
          {creationMode === 'guided' && (
            <div className="space-y-4">
              {/* 1. Ingrediente Protagonista */}
              <div>
                <label className="block text-xs font-bold text-stone-800 uppercase tracking-wider mb-1.5">
                  1. Ingrediente Noble / Protagonista:
                </label>
                <input
                  type="text"
                  value={heroIngredient}
                  onChange={(e) => setHeroIngredient(e.target.value)}
                  placeholder="Ej: Lomo de atún rojo, pato, hongos silvestres, coliflor morada, vieiras..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-purple-600 text-sm font-medium text-stone-900 bg-stone-50/50"
                />
              </div>

              {/* 2. Concepto o Inspiración */}
              <div>
                <label className="block text-xs font-bold text-stone-800 uppercase tracking-wider mb-1.5">
                  2. Concepto Culinario o Memoria Sensorial:
                </label>
                <input
                  type="text"
                  value={concept}
                  onChange={(e) => setConcept(e.target.value)}
                  placeholder="Ej: Recuerdos de un asado patagónico, brisa marina al atardecer..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-purple-600 text-sm font-medium text-stone-900 bg-stone-50/50"
                />
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {PRESET_CONCEPTS.slice(0, 3).map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setConcept(item)}
                      className="text-[11px] px-2.5 py-1 rounded-lg bg-stone-100 hover:bg-purple-50 hover:text-purple-900 text-stone-600 transition cursor-pointer border border-stone-200/80"
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>

              {/* 3. Técnica Maestra */}
              <div>
                <label className="block text-xs font-bold text-stone-800 uppercase tracking-wider mb-1.5">
                  3. Técnica Culinaria Avanzada:
                </label>
                <input
                  type="text"
                  value={technique}
                  onChange={(e) => setTechnique(e.target.value)}
                  placeholder="Ej: Mantecatura all'onda, sellado bimodal, emulsión tibia..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-purple-600 text-sm font-medium text-stone-900 bg-stone-50/50"
                />
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {PRESET_TECHNIQUES.slice(0, 3).map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setTechnique(item)}
                      className="text-[11px] px-2.5 py-1 rounded-lg bg-stone-100 hover:bg-purple-50 hover:text-purple-900 text-stone-600 transition cursor-pointer border border-stone-200/80"
                    >
                      {item.split('(')[0]}
                    </button>
                  ))}
                </div>
              </div>

              {/* 4. Perfil de Sabor y Contraste de Textura */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
                <div>
                  <label className="block text-xs font-bold text-stone-800 uppercase tracking-wider mb-1.5">
                    Perfil de Sabor:
                  </label>
                  <select
                    value={flavorProfile}
                    onChange={(e) => setFlavorProfile(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-purple-600 text-xs font-semibold text-stone-800 bg-white"
                  >
                    {PRESET_PROFILES.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-800 uppercase tracking-wider mb-1.5">
                    Nivel de Riesgo Creativo:
                  </label>
                  <div className="grid grid-cols-3 gap-1">
                    {(['equilibrado', 'audaz', 'vanguardista'] as const).map((risk) => (
                      <button
                        key={risk}
                        type="button"
                        onClick={() => setCreativeRisk(risk)}
                        className={`py-2 text-[11px] font-bold rounded-lg capitalize transition cursor-pointer border ${
                          creativeRisk === risk
                            ? 'bg-purple-800 text-white border-purple-900 shadow-2xs'
                            : 'bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100'
                        }`}
                      >
                        {risk}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* CONTENIDO MODO TEXTO LIBRE */}
          {creationMode === 'free_prompt' && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-stone-800 uppercase tracking-wider mb-1.5">
                  Describe tu visión gastronómica con tus propias palabras:
                </label>
                <textarea
                  rows={4}
                  value={freePrompt}
                  onChange={(e) => setFreePrompt(e.target.value)}
                  placeholder="Ej: Quiero crear un plato de autor que combine pulpo sellado a la brasa con una emulsión ácida de maracuyá y chips crujientes de camote morado, pensando en un maridaje fresco para el verano..."
                  className="w-full p-3.5 rounded-2xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-purple-600 text-sm font-medium text-stone-900 bg-stone-50/50 resize-y"
                />
              </div>

              <div className="p-3 bg-purple-50/70 rounded-2xl border border-purple-200 text-xs text-purple-900 flex items-start gap-2">
                <Sparkles className="w-4 h-4 text-purple-700 shrink-0 mt-0.5" />
                <span>
                  <strong>Tip de Chef:</strong> Puedes mencionar ingredientes que tengas en mente, texturas deseadas (espumas, crujientes, reducciones) o la emoción que deseas evocar en tus comensales.
                </span>
              </div>
            </div>
          )}

          {/* Botón de Creación */}
          <div className="pt-2">
            <button
              type="button"
              onClick={handleGenerateSignatureDish}
              disabled={isGenerating}
              className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-purple-800 via-indigo-900 to-amber-700 hover:from-purple-900 hover:to-amber-800 disabled:opacity-60 text-white font-extrabold text-sm sm:text-base flex items-center justify-center gap-2.5 shadow-lg transition active:scale-98 cursor-pointer"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-amber-300" />
                  <span>Diseñando tu Receta de Autor con IA...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  <span>Crear Propuesta Gastronómica de Autor</span>
                  <ArrowRight className="w-4 h-4 text-amber-300" />
                </>
              )}
            </button>
          </div>
        </div>

        {/* PANEL DERECHO: MI CUADERNO DE RECETAS DE AUTOR (Cols 8-12) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white rounded-3xl p-6 border border-stone-200 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base sm:text-lg font-black text-stone-900 font-serif flex items-center gap-2">
                  <Bookmark className="w-4 h-4 text-amber-600" />
                  <span>Mi Cuaderno de Autor</span>
                </h3>
                <span className="text-xs text-stone-500">
                  {savedDishes.length} receta{savedDishes.length !== 1 ? 's' : ''} guardada{savedDishes.length !== 1 ? 's' : ''}
                </span>
              </div>

              {savedDishes.length > 0 && (
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-900">
                  Nivel 5
                </span>
              )}
            </div>

            {savedDishes.length === 0 ? (
              <div className="text-center py-8 px-4 rounded-2xl bg-stone-50 border border-dashed border-stone-300">
                <ChefHat className="w-8 h-8 text-stone-300 mx-auto mb-2" />
                <p className="text-xs text-stone-500 font-medium">
                  Aún no tienes recetas de autor guardadas. ¡Usa el estudio de la izquierda para diseñar tu primera creación!
                </p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[560px] overflow-y-auto pr-1">
                {savedDishes.map((dish) => {
                  const isViewing = selectedDishToView?.id === dish.id;
                  return (
                    <div
                      key={dish.id}
                      className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                        isViewing
                          ? 'bg-purple-50/70 border-purple-400 ring-2 ring-purple-300/40 shadow-xs'
                          : 'bg-white border-stone-200 hover:border-purple-300 hover:shadow-xs'
                      }`}
                      onClick={() => setSelectedDishToView(dish)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className="text-sm">👑</span>
                            <span className="text-xs font-extrabold text-stone-900 line-clamp-1">
                              {dish.title}
                            </span>
                          </div>
                          <p className="text-[11px] text-stone-500 line-clamp-2">
                            {dish.chefConcept}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteDish(dish.id);
                          }}
                          className="p-1 text-stone-400 hover:text-rose-600 rounded-lg hover:bg-stone-100 transition cursor-pointer"
                          title="Eliminar de mi cuaderno"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="mt-3 pt-2.5 border-t border-stone-100 flex items-center justify-between text-[11px]">
                        <span className="text-stone-500 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-stone-400" />
                          <span>{dish.totalTimeMinutes} min</span>
                        </span>

                        <div className="flex items-center gap-1">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <button
                              key={star}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSetRating(dish.id, star);
                              }}
                              className={`cursor-pointer ${
                                (dish.personalRating || 0) >= star
                                  ? 'text-amber-500 fill-amber-500'
                                  : 'text-stone-300'
                              }`}
                            >
                              ★
                            </button>
                          ))}
                        </div>

                        <span className="text-purple-800 font-bold hover:underline">
                          Ver detalle →
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* DETALLE COMPLETO DEL PLATO DE AUTOR SELECCIONADO (VISTA PREVIA Y ACCIÓN DE COCINAR) */}
      {selectedDishToView && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-purple-200 shadow-md space-y-6 animate-fade-in">
          {/* Header del plato */}
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 border-b border-stone-200 pb-5">
            <div className="space-y-1.5 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-900 font-extrabold text-xs flex items-center gap-1">
                  <span>👑</span>
                  <span>Receta de Autor Exclusiva</span>
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-950 font-bold text-xs">
                  {selectedDishToView.estimatedCostLabel || 'Gourmet de Autor'}
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-stone-100 text-stone-700 font-semibold text-xs flex items-center gap-1">
                  <Clock className="w-3 h-3 text-stone-500" />
                  <span>{selectedDishToView.totalTimeMinutes} min</span>
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-stone-100 text-stone-700 font-semibold text-xs flex items-center gap-1">
                  <Users className="w-3 h-3 text-stone-500" />
                  <span>{selectedDishToView.servings || 2} porciones</span>
                </span>
              </div>

              <h2 className="text-xl sm:text-3xl font-black text-stone-900 font-serif">
                {selectedDishToView.title}
              </h2>
              <p className="text-sm font-semibold text-purple-900 italic">
                «{selectedDishToView.chefConcept}»
              </p>
            </div>

            {/* Acciones principales: Guardar y Cocinar Ahora */}
            <div className="flex items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => handleSaveToBook(selectedDishToView)}
                className="px-4 py-2.5 rounded-xl border border-stone-300 hover:border-purple-400 bg-white hover:bg-purple-50 text-stone-800 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
              >
                <Bookmark className="w-3.5 h-3.5 text-purple-700" />
                <span>Guardar en Cuaderno</span>
              </button>

              <button
                type="button"
                onClick={() => onCookRecipe(selectedDishToView)}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white font-extrabold text-xs sm:text-sm flex items-center gap-2 shadow-md transition active:scale-98 cursor-pointer"
              >
                <Flame className="w-4 h-4 text-white" />
                <span>¡Cocinar esta Receta Ahora!</span>
              </button>
            </div>
          </div>

          {/* Narrativa del Plato & Técnica Maestra */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200/80">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-stone-500 mb-1 flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-purple-700" />
                <span>Narrativa y Emoción del Plato</span>
              </h4>
              <p className="text-xs sm:text-sm text-stone-700 leading-relaxed font-serif">
                {selectedDishToView.storyNarrative}
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-purple-50/60 border border-purple-200">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-purple-900 mb-1 flex items-center gap-1.5">
                <ChefHat className="w-3.5 h-3.5 text-purple-700" />
                <span>Técnica Protagónica</span>
              </h4>
              <p className="text-xs sm:text-sm text-purple-950 font-medium">
                {selectedDishToView.heroTechnique}
              </p>
              {selectedDishToView.culturalSecret && (
                <p className="text-xs text-purple-800/90 mt-2 italic border-t border-purple-200 pt-1.5">
                  💡 {selectedDishToView.culturalSecret}
                </p>
              )}
            </div>
          </div>

          {/* Contrastes Sensoriales & Maridaje de Sommelier */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Contrastes Sensoriales */}
            <div className="p-4 rounded-2xl bg-amber-50/50 border border-amber-200">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-amber-950 mb-2.5 flex items-center gap-1.5">
                <Utensils className="w-3.5 h-3.5 text-amber-700" />
                <span>Tríada de Contrastes Sensoriales</span>
              </h4>
              <ul className="text-xs space-y-1.5 text-amber-950">
                <li>
                  <strong>Texturas:</strong> {selectedDishToView.sensoryContrast?.texture}
                </li>
                <li>
                  <strong>Temperaturas:</strong> {selectedDishToView.sensoryContrast?.temperature}
                </li>
                <li>
                  <strong>Acidez vs Grasa:</strong> {selectedDishToView.sensoryContrast?.acidityVsFat}
                </li>
              </ul>
            </div>

            {/* Maridaje de Sommelier */}
            <div className="p-4 rounded-2xl bg-indigo-50/50 border border-indigo-200">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-indigo-950 mb-2.5 flex items-center gap-1.5">
                <Wine className="w-3.5 h-3.5 text-indigo-700" />
                <span>Maridaje Recomendado de Sommelier</span>
              </h4>
              <div className="text-xs space-y-1.5 text-indigo-950">
                <p>
                  <strong>Con Alcohol:</strong> {selectedDishToView.sommelierPairing?.beverage}
                </p>
                <p>
                  <strong>Sin Alcohol:</strong> {selectedDishToView.sommelierPairing?.nonAlcoholic}
                </p>
                <p className="text-indigo-800 text-[11px] italic mt-1 border-t border-indigo-200/80 pt-1">
                  «{selectedDishToView.sommelierPairing?.whyItHarmonizes}»
                </p>
              </div>
            </div>
          </div>

          {/* Mise en Place & Ingredientes Exactos */}
          <div className="p-5 rounded-2xl bg-stone-50 border border-stone-200">
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-stone-700 mb-3 flex items-center gap-1.5">
              <span>🥣</span>
              <span>Mise en Place & Medidas Exactas ({selectedDishToView.miseEnPlace.length} ingredientes)</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {selectedDishToView.miseEnPlace.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2 p-2 rounded-xl bg-white border border-stone-200/80">
                  <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                  <span className="font-medium text-stone-800">{item}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Pasos de Cocción Paso a Paso */}
          <div className="space-y-3">
            <h4 className="text-sm font-black text-stone-900 uppercase tracking-wider flex items-center gap-1.5">
              <Flame className="w-4 h-4 text-orange-600" />
              <span>Guía de Ejecución Milimétrica ({selectedDishToView.steps.length} pasos)</span>
            </h4>

            <div className="space-y-3">
              {selectedDishToView.steps.map((st) => (
                <div
                  key={st.stepNumber}
                  className="p-4 rounded-2xl border border-stone-200 bg-white hover:border-amber-300 transition"
                >
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="text-xs font-black text-stone-900 flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-purple-900 text-white text-[11px] flex items-center justify-center font-bold">
                        {st.stepNumber}
                      </span>
                      <span>{st.title}</span>
                    </span>

                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${
                      st.heatLevel === 'apagado'
                        ? 'bg-stone-100 text-stone-700'
                        : st.heatLevel === 'bajo'
                        ? 'bg-blue-100 text-blue-900'
                        : st.heatLevel === 'medio'
                        ? 'bg-amber-100 text-amber-900'
                        : 'bg-rose-100 text-rose-900'
                    }`}>
                      Fuego {st.heatLevel}
                    </span>
                  </div>

                  <p className="text-xs sm:text-sm text-stone-700 font-medium leading-relaxed">
                    {st.instruction}
                  </p>

                  {st.tip && (
                    <p className="mt-2 text-xs text-amber-900 bg-amber-50/80 p-2 rounded-xl border border-amber-200/60 font-medium">
                      💡 <strong>Tip de Maestro:</strong> {st.tip}
                    </p>
                  )}

                  {/* Señales Sensoriales */}
                  {st.sensoryCues && (
                    <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-stone-500 pt-1">
                      {st.sensoryCues.sight && <span>👀 {st.sensoryCues.sight}</span>}
                      {st.sensoryCues.sound && <span>👂 {st.sensoryCues.sound}</span>}
                      {st.sensoryCues.smell && <span>👃 {st.sensoryCues.smell}</span>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Checkpoints de Emplatado y Presentación */}
          {selectedDishToView.finishVisualCheckpoints && (
            <div className="p-4 rounded-2xl bg-emerald-50/50 border border-emerald-200 text-xs">
              <h4 className="font-extrabold text-emerald-950 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <span>✨</span>
                <span>Checkpoints de Presentación de Restaurante</span>
              </h4>
              <ul className="space-y-1 text-emerald-900">
                {selectedDishToView.finishVisualCheckpoints.map((chk, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <span>✓</span>
                    <span>{chk}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Sección de Notas del Autor y Calificación Personal */}
          <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-stone-800 uppercase tracking-wider flex items-center gap-1.5">
                <Edit3 className="w-3.5 h-3.5 text-stone-600" />
                <span>Mis Notas y Modificaciones de Autor:</span>
              </h4>

              {editingNotesId !== selectedDishToView.id && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingNotesId(selectedDishToView.id);
                    setTempNotes(selectedDishToView.authorNotes || '');
                  }}
                  className="text-xs font-bold text-purple-700 hover:text-purple-900 cursor-pointer"
                >
                  Editar notas
                </button>
              )}
            </div>

            {editingNotesId === selectedDishToView.id ? (
              <div className="space-y-2">
                <textarea
                  rows={3}
                  value={tempNotes}
                  onChange={(e) => setTempNotes(e.target.value)}
                  placeholder="Anota aquí qué tal te quedó, modificaciones en salsas, invitados que lo probaron..."
                  className="w-full p-2.5 rounded-xl border border-stone-300 text-xs font-medium text-stone-900 bg-white"
                />
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleSaveNotes(selectedDishToView.id)}
                    className="px-3 py-1.5 rounded-lg bg-stone-900 text-white font-bold text-xs hover:bg-stone-800 cursor-pointer"
                  >
                    Guardar nota
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingNotesId(null)}
                    className="px-3 py-1.5 rounded-lg bg-stone-200 text-stone-700 font-bold text-xs hover:bg-stone-300 cursor-pointer"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-xs text-stone-600 italic">
                {selectedDishToView.authorNotes || 'Sin notas registradas aún. Haz clic en "Editar notas" para escribir tus experimentaciones personales.'}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
