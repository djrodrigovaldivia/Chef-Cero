import React, { useState, useRef, useEffect } from 'react';
import {
  Camera,
  Upload,
  Sparkles,
  X,
  Check,
  Clock,
  ChevronRight,
  AlertCircle,
  RefreshCw,
  ChefHat,
  Search,
  ShieldCheck,
  AlertTriangle,
  OctagonAlert,
  Volume2,
  Eye,
  Ear,
  Wind,
  Flame,
  CheckCircle2,
  Calendar,
  ThumbsUp,
  Info,
  Layers,
  Zap,
  Award,
} from 'lucide-react';
import { Recipe } from '../types';
import { speakSpanishText, stopSpeaking } from '../utils/audioAlert';

export type ScannerMode = 'level_trio' | 'inspect_product' | 'fridge';

export interface TrioRecipeStep {
  stepNumber: number;
  title: string;
  instruction: string;
  tip: string;
  heatLevel: 'apagado' | 'bajo' | 'medio' | 'alto';
  timerSeconds: number;
  timerLabel?: string;
}

export interface TrioRecipe {
  id: string;
  level: 'principiante' | 'intermedio' | 'experto';
  levelNumber: number;
  levelBadge: string;
  title: string;
  description: string;
  totalTimeMinutes: number;
  estimatedCalories: number;
  difficulty: string;
  heroTechnique: string;
  additionalIngredients: string[];
  steps: TrioRecipeStep[];
  culturalSecret?: string;
}

export interface ProductTrioResult {
  productDetected: string;
  productCategory: string;
  baseCaloriesEst: string;
  chefObservation: string;
  recipes: TrioRecipe[];
  audioScript?: string;
  audioBase64?: string;
  audioMimeType?: string;
}

interface FridgeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartCookingRecipe: (recipe: Recipe) => void;
  initialMode?: ScannerMode;
}

interface ScanResult {
  detectedIngredients: string[];
  chefObservation: string;
  suggestedDishes: Array<{
    id: string;
    title: string;
    totalTimeMinutes: number;
    difficulty: string;
    ingredientsUsed: string[];
    keyTip: string;
    quickSteps: Array<{
      stepNumber: number;
      title: string;
      instruction: string;
      heatLevel: string;
    }>;
  }>;
}

export interface ProductInspectionResult {
  productName: string;
  productCategory: string;
  status: 'bueno' | 'consumir_urgente' | 'descartar';
  statusHeadline: string;
  freshnessScore: number;
  estimatedShelfLife: string;
  confidenceExplanation: string;
  sensoryCheck: {
    sight: string;
    smell: string;
    touch: string;
  };
  safetyAdvice: string;
  suggestedDishes: Array<{
    id: string;
    title: string;
    totalTimeMinutes: number;
    difficulty: string;
    ingredientsNeeded: string[];
    whyThisDishWorks: string;
    quickSteps: Array<{
      stepNumber: number;
      title: string;
      instruction: string;
      heatLevel: string;
    }>;
  }>;
  audioScript?: string;
  audioBase64?: string;
  audioMimeType?: string;
}

export const FridgeScannerModal: React.FC<FridgeScannerModalProps> = ({
  isOpen,
  onClose,
  onStartCookingRecipe,
  initialMode = 'level_trio',
}) => {
  const [mode, setMode] = useState<ScannerMode>(initialMode);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [inspectionResult, setInspectionResult] = useState<ProductInspectionResult | null>(null);
  const [trioResult, setTrioResult] = useState<ProductTrioResult | null>(null);
  const [selectedLevelTab, setSelectedLevelTab] = useState<'principiante' | 'intermedio' | 'experto'>('principiante');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSpeakingResult, setIsSpeakingResult] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setSelectedImage(null);
      setScanResult(null);
      setInspectionResult(null);
      setTrioResult(null);
      setSelectedLevelTab('principiante');
      setErrorMessage(null);
      setIsSpeakingResult(false);
      stopSpeaking();
    } else {
      stopSpeaking();
    }
  }, [isOpen, initialMode]);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMessage('Por favor selecciona una imagen válida (.jpg, .png o .webp)');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      setSelectedImage(base64);
      setErrorMessage(null);
      setScanResult(null);
      setInspectionResult(null);
      setTrioResult(null);

      if (mode === 'level_trio') {
        scanProductTrioWithAi(base64, file.type);
      } else if (mode === 'inspect_product') {
        inspectProductWithAi(base64, file.type);
      } else {
        analyzeFridgeWithAi(base64, file.type);
      }
    };
    reader.onerror = () => {
      setErrorMessage('No se pudo leer la imagen seleccionada');
    };
    reader.readAsDataURL(file);
  };

  // Escaneo de 1 producto para generar 3 recetas graduadas por nivel (Principiante, Intermedio y Experto)
  const scanProductTrioWithAi = async (base64: string, mimeType: string) => {
    setIsAnalyzing(true);
    setErrorMessage(null);
    try {
      const res = await fetch('/api/product-trio-recipes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: base64,
          mimeType,
        }),
      });

      if (!res.ok) {
        throw new Error('Error al conectar con el servidor de análisis');
      }

      const data: ProductTrioResult = await res.json();
      setTrioResult(data);
      setSelectedLevelTab('principiante');

      if (data.audioScript) {
        setIsSpeakingResult(true);
        speakSpanishText(data.audioScript, {
          speaker: 'Chef Cero - Mentor',
          badge: '3 Niveles Culinarios',
          audioBase64: data.audioBase64,
          audioMimeType: data.audioMimeType,
          onEnd: () => setIsSpeakingResult(false),
        });
      }
    } catch (err: any) {
      console.warn('Chef Cero: Error analizando producto para trío de recetas:', err);
      setErrorMessage('No pudimos generar las 3 recetas en este momento. Intenta con otra toma más clara o mejor luz.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSpeakTrio = () => {
    if (!trioResult?.audioScript) return;
    setIsSpeakingResult(true);
    speakSpanishText(trioResult.audioScript, {
      speaker: 'Chef Cero - Mentor',
      badge: '3 Niveles Culinarios',
      audioBase64: trioResult.audioBase64,
      audioMimeType: trioResult.audioMimeType,
      onEnd: () => setIsSpeakingResult(false),
    });
  };

  // Convertir una de las 3 recetas (Principiante, Intermedio o Experto) en Recipe para modo guiado en vivo
  const handleConvertTrioRecipeAndCook = (trioRecipe: TrioRecipe) => {
    let sampleImg = selectedImage || 'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=800&q=80';
    let gallery = [
      selectedImage || 'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1556910103-1c02745aae4d?auto=format&fit=crop&w=800&q=80',
    ];

    const convertedRecipe: Recipe = {
      id: trioRecipe.id || 'trio-' + Date.now(),
      title: trioRecipe.title,
      description: `${trioRecipe.description} Técnica protagonista: ${trioRecipe.heroTechnique}.`,
      servings: 1,
      totalTimeMinutes: trioRecipe.totalTimeMinutes || 12,
      difficulty: trioRecipe.difficulty || (trioRecipe.level === 'principiante' ? 'Principiante Total' : trioRecipe.level === 'intermedio' ? 'Intermedio Casero' : 'Chef Maestro / Experto'),
      requiredLevel: ((trioRecipe.levelNumber as 1 | 2 | 3 | 4 | 5) || (trioRecipe.level === 'principiante' ? 1 : trioRecipe.level === 'intermedio' ? 3 : 5)) as 1 | 2 | 3 | 4 | 5,
      learningGoal: `Dominar ${trioRecipe.heroTechnique} con ${trioResult?.productDetected || 'el ingrediente'}`,
      cuisine: 'economica_bbb',
      cuisineName: trioRecipe.level === 'experto' ? 'Cocina Gourmet & Autor' : 'Cocina Casera Inteligente',
      countryFlag: trioRecipe.level === 'principiante' ? '🟢' : trioRecipe.level === 'intermedio' ? '🟡' : '🔴',
      isBudgetFriendly: true,
      estimatedCostLabel: trioRecipe.level === 'experto' ? 'Gourmet (~$3.50 USD)' : 'Económica (<$2.00 USD)',
      culturalSecret: trioRecipe.culturalSecret || `El secreto: paciencia con el calor y atención a los cambios de color y aroma.`,
      imageUrl: sampleImg,
      finishGalleryUrls: gallery,
      finishVisualCheckpoints: [
        'Color apetitoso y dorado homogéneo sin marcas quemadas.',
        'Aroma equilibrado y textura jugosa.',
        'Servido a buena temperatura listo para disfrutar.',
      ],
      pantrySubstitutes: [],
      safetyAlerts: [
        'Ten los ingredientes adicionales listos en platitos antes de prender el fuego.',
        'Si la sartén humea o salpica fuerte, retírala de la hornalla unos segundos.',
      ],
      miseEnPlace: [
        `${trioResult?.productDetected || 'Ingrediente principal'} lavado y acondicionado`,
        ...trioRecipe.additionalIngredients.map((ing) => `${ing} medido y listo al alcance`),
      ],
      heatGuideExplanation: 'El primer paso es siempre con hornalla apagada para organizar la mesa sin prisas.',
      steps: trioRecipe.steps.map((s, idx) => ({
        stepNumber: s.stepNumber || idx + 1,
        title: s.title || `Paso ${idx + 1}`,
        instruction: s.instruction,
        heatLevel: (s.heatLevel as any) || (idx === 0 ? 'apagado' : 'medio'),
        tip: s.tip || (idx === 0 ? 'Mise en place: todo picado antes de encender el fuego.' : 'Respeta el fuego y no te distraigas.'),
        stepImageUrl: idx === 0 ? 'https://images.unsplash.com/photo-1556910103-1c02745aae4d?auto=format&fit=crop&w=600&q=80' : sampleImg,
        stepVisualCueLabel: idx === 0 ? 'Platitos listos con hornalla apagada' : `Punto del paso ${idx + 1}`,
        timerSeconds: s.timerSeconds > 0 ? s.timerSeconds : undefined,
        timerLabel: s.timerLabel || undefined,
      })),
    };

    onStartCookingRecipe(convertedRecipe);
    onClose();
  };

  // Inspección de un producto individual (Frescura, qué es, si está bueno y recetas)
  const inspectProductWithAi = async (base64: string, mimeType: string) => {
    setIsAnalyzing(true);
    setErrorMessage(null);
    try {
      const res = await fetch('/api/inspect-product', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: base64,
          mimeType,
        }),
      });

      if (!res.ok) {
        throw new Error('Error al conectar con el servidor de análisis');
      }

      const data: ProductInspectionResult = await res.json();
      setInspectionResult(data);

      // Reproducir automáticamente el veredicto del Chef en voz alta en español latino
      if (data.audioScript) {
        setIsSpeakingResult(true);
        speakSpanishText(data.audioScript, {
          speaker: 'Chef Cero - Inspector',
          badge: 'Veredicto de Frescura',
          audioBase64: data.audioBase64,
          audioMimeType: data.audioMimeType,
          onEnd: () => setIsSpeakingResult(false),
        });
      }
    } catch (err: any) {
      console.warn('Chef Cero: Error analizando producto:', err);
      setErrorMessage('No pudimos examinar el producto en este momento. Intenta enfocarlo con mejor luz o más de cerca.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Escaneo de nevera completa para recetas con varios ingredientes
  const analyzeFridgeWithAi = async (base64: string, mimeType: string) => {
    setIsAnalyzing(true);
    setErrorMessage(null);
    try {
      const res = await fetch('/api/scan-fridge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: base64,
          mimeType,
        }),
      });

      if (!res.ok) {
        throw new Error('Error al analizar la nevera');
      }

      const data: ScanResult = await res.json();
      setScanResult(data);
    } catch (err: any) {
      console.warn('Chef Cero: Error analizando nevera:', err);
      setErrorMessage('Hubo un inconveniente analizando la foto. Intenta con una toma más cercana o con mejor luz.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSpeakVerdict = () => {
    if (!inspectionResult?.audioScript) return;
    setIsSpeakingResult(true);
    speakSpanishText(inspectionResult.audioScript, {
      speaker: 'Chef Cero - Inspector',
      badge: 'Veredicto de Frescura',
      audioBase64: inspectionResult.audioBase64,
      audioMimeType: inspectionResult.audioMimeType,
      onEnd: () => setIsSpeakingResult(false),
    });
  };

  // Convertir plato sugerido del escaneo de nevera en Recipe para modo guiado
  const handleConvertFridgeDishAndCook = (dish: ScanResult['suggestedDishes'][0]) => {
    const lowerTitle = (dish.title + ' ' + dish.ingredientsUsed.join(' ')).toLowerCase();
    let sampleImg = 'https://images.unsplash.com/photo-1525351484163-7529414344d8?auto=format&fit=crop&w=800&q=80';
    let gallery = [
      'https://images.unsplash.com/photo-1525351484163-7529414344d8?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1586816001966-79b736744398?auto=format&fit=crop&w=800&q=80',
    ];

    if (lowerTitle.includes('tost') || lowerTitle.includes('pan')) {
      sampleImg = 'https://images.unsplash.com/photo-1525351484163-7529414344d8?auto=format&fit=crop&w=800&q=80';
      gallery = [
        'https://images.unsplash.com/photo-1525351484163-7529414344d8?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1484723091739-30a097e8f929?auto=format&fit=crop&w=800&q=80',
      ];
    } else if (lowerTitle.includes('arroz')) {
      sampleImg = 'https://images.unsplash.com/photo-1516684732162-798a0062be99?auto=format&fit=crop&w=800&q=80';
      gallery = [
        'https://images.unsplash.com/photo-1516684732162-798a0062be99?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1536304993881-ff6e9eefa2a6?auto=format&fit=crop&w=800&q=80',
      ];
    } else if (lowerTitle.includes('pasta') || lowerTitle.includes('fideo')) {
      sampleImg = 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?auto=format&fit=crop&w=800&q=80';
      gallery = [
        'https://images.unsplash.com/photo-1551183053-bf91a1d81141?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1559847844-5315695dadae?auto=format&fit=crop&w=800&q=80',
      ];
    }

    const convertedRecipe: Recipe = {
      id: dish.id || 'scan-' + Date.now(),
      title: dish.title,
      description: `${dish.keyTip} Plato express ideado para principiantes a partir de lo que tienes en casa.`,
      servings: 1,
      totalTimeMinutes: dish.totalTimeMinutes || 10,
      difficulty: 'Principiante Total',
      requiredLevel: 1,
      learningGoal: 'Cocinar con lo que hay a mano sin quemar el fondo',
      cuisine: 'economica_bbb',
      cuisineName: 'Cocina de Aprovechamiento',
      countryFlag: '🧊',
      isBudgetFriendly: true,
      estimatedCostLabel: 'Económica (<$1.50 USD)',
      culturalSecret: dish.keyTip,
      imageUrl: sampleImg,
      finishGalleryUrls: gallery,
      finishVisualCheckpoints: [
        'Textura jugosa y brillante, sin partes resecas ni exceso de grasa.',
        'Aroma apetitoso y equilibrado, sin notas a quemado.',
        'Emplatado limpio y listo para degustar caliente.',
      ],
      pantrySubstitutes: [],
      safetyAlerts: [
        'Ten los ingredientes cortados y en platitos antes de prender el fuego.',
        'Si la sartén humea, retírala de la hornalla de inmediato.',
      ],
      miseEnPlace: dish.ingredientsUsed.map((ing) => `${ing} listo en un plato o mesa`),
      heatGuideExplanation: 'Iniciamos con fuego apagado y luego sostenemos fuego bajo/medio.',
      steps: dish.quickSteps.map((s, idx) => ({
        stepNumber: s.stepNumber || idx + 1,
        title: s.title || `Paso ${idx + 1}`,
        instruction: s.instruction,
        heatLevel: (s.heatLevel as any) || 'bajo',
        tip: idx === 0 ? 'Mise en place estricto: no prendas fuego todavía.' : dish.keyTip,
        stepImageUrl: idx === 0 ? 'https://images.unsplash.com/photo-1556910103-1c02745aae4d?auto=format&fit=crop&w=600&q=80' : sampleImg,
        stepVisualCueLabel: idx === 0 ? 'Platitos listos con hornalla apagada' : `Punto del paso ${idx + 1}`,
        timerSeconds: idx === 1 ? 180 : undefined,
        timerLabel: idx === 1 ? 'Cocción guiada' : undefined,
      })),
    };

    onStartCookingRecipe(convertedRecipe);
    onClose();
  };

  // Convertir plato del producto inspeccionado en Recipe para cocinar de inmediato
  const handleConvertProductDishAndCook = (dish: ProductInspectionResult['suggestedDishes'][0]) => {
    let sampleImg = selectedImage || 'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=800&q=80';
    let gallery = [
      selectedImage || 'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1556910103-1c02745aae4d?auto=format&fit=crop&w=800&q=80',
    ];

    const convertedRecipe: Recipe = {
      id: dish.id || 'inspect-' + Date.now(),
      title: dish.title,
      description: `${dish.whyThisDishWorks} Diseñado para aprovechar ${inspectionResult?.productName || 'tu ingrediente'} en su punto óptimo.`,
      servings: 1,
      totalTimeMinutes: dish.totalTimeMinutes || 10,
      difficulty: dish.difficulty || 'Principiante Total',
      requiredLevel: 1,
      learningGoal: `Aprovechar ${inspectionResult?.productName || 'el ingrediente'} de tu nevera sin riesgos`,
      cuisine: 'economica_bbb',
      cuisineName: 'Cocina con Producto Inspeccionado',
      countryFlag: '🔍',
      isBudgetFriendly: true,
      estimatedCostLabel: 'Económica (<$1.50 USD)',
      culturalSecret: dish.whyThisDishWorks,
      imageUrl: sampleImg,
      finishGalleryUrls: gallery,
      finishVisualCheckpoints: [
        'Color dorado o brillante uniforme sin marcas quemadas.',
        'Aroma apetitoso y fresco.',
        'Listo y caliente para servir.',
      ],
      pantrySubstitutes: [],
      safetyAlerts: [
        inspectionResult?.safetyAdvice || 'Lávate las manos antes de manipular y usa una tabla limpia.',
        'Mise en place primero: corta todo antes de prender el fuego.',
      ],
      miseEnPlace: dish.ingredientsNeeded.map((ing) => `${ing} medido y listo al alcance`),
      heatGuideExplanation: 'El paso 1 es siempre con estufa apagada para cocinar sin sobresaltos.',
      steps: dish.quickSteps.map((s, idx) => ({
        stepNumber: s.stepNumber || idx + 1,
        title: s.title || `Paso ${idx + 1}`,
        instruction: s.instruction,
        heatLevel: (s.heatLevel as any) || (idx === 0 ? 'apagado' : 'medio'),
        tip: idx === 0 ? 'Mise en place: todo picado antes de encender la hornalla.' : dish.whyThisDishWorks,
        stepImageUrl: idx === 0 ? 'https://images.unsplash.com/photo-1556910103-1c02745aae4d?auto=format&fit=crop&w=600&q=80' : sampleImg,
        stepVisualCueLabel: idx === 0 ? 'Platitos listos con estufa apagada' : `Punto del paso ${idx + 1}`,
        timerSeconds: idx === 1 ? 180 : undefined,
        timerLabel: idx === 1 ? 'Cocción en sartén' : undefined,
      })),
    };

    onStartCookingRecipe(convertedRecipe);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-stone-950/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fade-in">
      <div className="bg-white rounded-3xl max-w-2xl w-full border border-stone-200 shadow-2xl overflow-hidden my-4 max-h-[92vh] flex flex-col">
        {/* Cabecera del modal con selector de modo */}
        <div className="p-4 sm:p-5 border-b border-stone-200 bg-stone-50/80 shrink-0">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-stone-950 shadow-xs ${
                mode === 'level_trio'
                  ? 'bg-amber-400'
                  : mode === 'inspect_product'
                  ? 'bg-emerald-500'
                  : 'bg-amber-500'
              }`}>
                {mode === 'level_trio' ? (
                  <Sparkles className="w-5 h-5 text-stone-950" />
                ) : mode === 'inspect_product' ? (
                  <Search className="w-5 h-5 text-stone-950" />
                ) : (
                  <Camera className="w-5 h-5 text-stone-950" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-extrabold text-base sm:text-lg text-stone-900 font-serif">
                    {mode === 'level_trio'
                      ? '3 Recetas por Nivel (Foto de 1 Producto)'
                      : mode === 'inspect_product'
                      ? '¿Está en buen estado mi comida?'
                      : 'Escanear Nevera Completa'}
                  </h3>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                    mode === 'level_trio'
                      ? 'bg-amber-100 text-amber-900 border-amber-300'
                      : mode === 'inspect_product'
                      ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                      : 'bg-amber-100 text-amber-900 border-amber-300'
                  }`}>
                    Gemini 3.8 Visión
                  </span>
                </div>
                <p className="text-xs text-stone-500">
                  {mode === 'level_trio'
                    ? 'Tómale foto a 1 producto o ingrediente: la IA te dará 3 recetas graduadas: Principiante, Medio y Experto.'
                    : mode === 'inspect_product'
                    ? 'Saca 1 producto de tu nevera: la IA te dice qué es, si está bueno y cómo cocinarlo.'
                    : 'Apunta a tus estantes para sugerir recetas con varios ingredientes que tengas a mano.'}
                </p>
              </div>
            </div>

            <button
              onClick={() => {
                stopSpeaking();
                onClose();
              }}
              className="p-2 text-stone-400 hover:text-stone-700 hover:bg-stone-200/60 rounded-xl transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Selector de modo estilo Pestañas (3 Modos) */}
          <div className="grid grid-cols-3 gap-1.5 p-1 bg-stone-200/70 rounded-2xl">
            <button
              type="button"
              onClick={() => {
                setMode('level_trio');
                setSelectedImage(null);
                setScanResult(null);
                setInspectionResult(null);
                setTrioResult(null);
                setErrorMessage(null);
                stopSpeaking();
              }}
              className={`py-2 px-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                mode === 'level_trio'
                  ? 'bg-white text-stone-900 shadow-xs ring-1 ring-black/5'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <span className="truncate">3 Recetas por Nivel</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setMode('inspect_product');
                setSelectedImage(null);
                setScanResult(null);
                setInspectionResult(null);
                setTrioResult(null);
                setErrorMessage(null);
                stopSpeaking();
              }}
              className={`py-2 px-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                mode === 'inspect_product'
                  ? 'bg-white text-stone-900 shadow-xs ring-1 ring-black/5'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <Search className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span className="truncate">Frescura 1 Alimento</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setMode('fridge');
                setSelectedImage(null);
                setScanResult(null);
                setInspectionResult(null);
                setTrioResult(null);
                setErrorMessage(null);
                stopSpeaking();
              }}
              className={`py-2 px-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                mode === 'fridge'
                  ? 'bg-white text-stone-900 shadow-xs ring-1 ring-black/5'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <Camera className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span className="truncate">Nevera Completa</span>
            </button>
          </div>
        </div>

        {/* Contenido con scroll */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4">
          {/* Zona de captura / subida de foto si no hay foto */}
          {!selectedImage ? (
            <div
              className={`border-2 border-dashed rounded-3xl p-6 sm:p-10 text-center space-y-4 transition cursor-pointer ${
                mode === 'level_trio'
                  ? 'border-amber-300 hover:border-amber-500 hover:bg-amber-50/20'
                  : mode === 'inspect_product'
                  ? 'border-emerald-300 hover:border-emerald-500 hover:bg-emerald-50/20'
                  : 'border-amber-300 hover:border-amber-500 hover:bg-amber-50/20'
              }`}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileChange}
                className="hidden"
              />

              <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto text-2xl shadow-inner ${
                mode === 'level_trio'
                  ? 'bg-amber-100 text-amber-900'
                  : mode === 'inspect_product'
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-amber-100 text-amber-800'
              }`}>
                {mode === 'level_trio' ? '🍳' : mode === 'inspect_product' ? '🔍' : '📸'}
              </div>

              <div>
                <h4 className="font-extrabold text-stone-900 text-sm sm:text-base">
                  {mode === 'level_trio'
                    ? 'Toca aquí para fotografiar el ingrediente o producto'
                    : mode === 'inspect_product'
                    ? 'Toca aquí para fotografiar el producto que sacaste'
                    : 'Toca aquí para fotografiar tu nevera o alacena'}
                </h4>
                <p className="text-xs text-stone-500 mt-1 max-w-md mx-auto leading-relaxed">
                  {mode === 'level_trio'
                    ? 'Apunta a un tomate, un huevo, pechuga de pollo, papa, berenjena o cualquier ingrediente para obtener 3 recetas: principiante, intermedio y experto.'
                    : mode === 'inspect_product'
                    ? 'Apunta a una carne, un tomate, un huevo, leche, queso o cualquier sobra que tengas dudas si está buena.'
                    : 'Apunta a los estantes de tu refrigerador o los 3 o 4 ingredientes que tienes a mano.'}
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                <button
                  type="button"
                  className="px-4 py-2.5 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs transition"
                >
                  <Camera className={`w-4 h-4 ${mode === 'inspect_product' ? 'text-emerald-400' : 'text-amber-400'}`} />
                  <span>Abrir Cámara</span>
                </button>

                <button
                  type="button"
                  className="px-4 py-2.5 bg-white border border-stone-300 hover:bg-stone-100 text-stone-700 rounded-xl text-xs font-bold flex items-center gap-2 transition"
                >
                  <Upload className="w-4 h-4 text-stone-500" />
                  <span>Subir Foto de Galería</span>
                </button>
              </div>
            </div>
          ) : (
            /* Vista previa de imagen + escaneo en progreso o resultados */
            <div className="space-y-4">
              <div className="relative rounded-2xl overflow-hidden border border-stone-200 bg-stone-950 max-h-56 flex items-center justify-center">
                <img
                  src={selectedImage}
                  alt="Alimento capturado"
                  className="w-full h-full object-cover max-h-56 opacity-90"
                />

                {isAnalyzing && (
                  <div className="absolute inset-0 bg-stone-950/70 backdrop-blur-xs flex flex-col items-center justify-center text-white p-4 space-y-3">
                    <div className={`w-10 h-10 border-4 border-t-transparent rounded-full animate-spin ${
                      mode === 'level_trio'
                        ? 'border-amber-400'
                        : mode === 'inspect_product'
                        ? 'border-emerald-400'
                        : 'border-amber-400'
                    }`} />
                    <div className="text-center">
                      <div className={`font-bold text-sm flex items-center justify-center gap-1.5 ${
                        mode === 'level_trio'
                          ? 'text-amber-300'
                          : mode === 'inspect_product'
                          ? 'text-emerald-300'
                          : 'text-amber-300'
                      }`}>
                        <Sparkles className="w-4 h-4 animate-pulse" />
                        <span>
                          {mode === 'level_trio'
                            ? 'Chef Cero creando 3 recetas por nivel...'
                            : mode === 'inspect_product'
                            ? 'Inspeccionando frescura y seguridad...'
                            : 'Analizando tu refrigerador...'}
                        </span>
                      </div>
                      <p className="text-[11px] text-stone-300 mt-0.5">
                        {mode === 'level_trio'
                          ? 'Diseñando recetas para nivel Principiante, Intermedio y Experto'
                          : mode === 'inspect_product'
                          ? 'Identificando alimento, fecha aproximada y recetas express'
                          : 'Detectando ingredientes y diseñando recetas'}
                      </p>
                    </div>
                  </div>
                )}

                {!isAnalyzing && (
                  <button
                    onClick={() => {
                      setSelectedImage(null);
                      setScanResult(null);
                      setInspectionResult(null);
                      setTrioResult(null);
                      stopSpeaking();
                    }}
                    className="absolute top-2 right-2 px-2.5 py-1.5 bg-stone-900/85 hover:bg-stone-900 text-white text-[11px] font-bold rounded-lg backdrop-blur-xs flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Tomar otra foto</span>
                  </button>
                )}
              </div>

              {/* Error si algo falló */}
              {errorMessage && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 text-xs flex items-center gap-2.5">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* MODO 0: RESULTADOS DE 3 RECETAS POR NIVEL (PRINCIPIANTE, MEDIO, EXPERTO) */}
              {trioResult && !isAnalyzing && (
                <div className="space-y-4 animate-fade-in">
                  {/* Tarjeta de Identificación y Calorimetría */}
                  <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-amber-500/10 via-amber-100/40 to-stone-50 border border-amber-300 text-stone-900 shadow-xs">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-amber-200/70">
                      <div>
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-800 flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                          <span>Producto Protagonista Reconocido:</span>
                        </span>
                        <h4 className="text-xl sm:text-2xl font-black font-serif text-stone-950 mt-0.5">
                          {trioResult.productDetected}
                        </h4>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <span className="px-3 py-1 bg-amber-500 text-stone-950 font-black text-xs rounded-xl shadow-2xs">
                          {trioResult.productCategory}
                        </span>
                        <span className="px-3 py-1 bg-white/90 border border-amber-300/80 text-stone-800 font-bold text-xs rounded-xl shadow-2xs flex items-center gap-1">
                          <Zap className="w-3.5 h-3.5 text-amber-600" />
                          <span>{trioResult.baseCaloriesEst}</span>
                        </span>
                      </div>
                    </div>

                    <p className="text-xs text-stone-700 mt-2.5 leading-relaxed font-medium italic">
                      "{trioResult.chefObservation}"
                    </p>

                    {trioResult.audioScript && (
                      <div className="mt-3 pt-2.5 border-t border-amber-200/50 flex justify-end">
                        <button
                          type="button"
                          onClick={handleSpeakTrio}
                          className="px-3 py-1.5 bg-white hover:bg-stone-50 border border-amber-300 rounded-xl font-bold text-xs flex items-center gap-1.5 text-stone-800 transition cursor-pointer shadow-2xs"
                        >
                          <Volume2 className={`w-3.5 h-3.5 ${isSpeakingResult ? 'text-amber-600 animate-pulse' : 'text-stone-600'}`} />
                          <span>{isSpeakingResult ? 'Chef hablando...' : 'Escuchar propuesta en voz alta'}</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Selector de Nivel: 🟢 Principiante | 🟡 Intermedio | 🔴 Experto */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-xs font-black uppercase tracking-wider text-stone-600 flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-amber-600" />
                        <span>Elige tu nivel para cocinar hoy:</span>
                      </h4>
                      <span className="text-[11px] text-stone-400 font-medium">3 alternativas progresivas</span>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      {trioResult.recipes.map((rec) => {
                        const isSelected = selectedLevelTab === rec.level;

                        return (
                          <button
                            key={rec.id || rec.level}
                            type="button"
                            onClick={() => setSelectedLevelTab(rec.level)}
                            className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                              isSelected
                                ? rec.level === 'principiante'
                                  ? 'bg-emerald-500/10 border-emerald-500 ring-2 ring-emerald-400/50 shadow-xs'
                                  : rec.level === 'intermedio'
                                  ? 'bg-amber-500/10 border-amber-500 ring-2 ring-amber-400/50 shadow-xs'
                                  : 'bg-rose-500/10 border-rose-500 ring-2 ring-rose-400/50 shadow-xs'
                                : 'bg-stone-50 border-stone-200 hover:border-stone-300 hover:bg-stone-100/70'
                            }`}
                          >
                            <div>
                              <div className="flex items-center justify-between">
                                <span className="text-base sm:text-lg">
                                  {rec.level === 'principiante' ? '🟢' : rec.level === 'intermedio' ? '🟡' : '🔴'}
                                </span>
                                <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                                  isSelected
                                    ? rec.level === 'principiante'
                                      ? 'bg-emerald-600 text-white'
                                      : rec.level === 'intermedio'
                                      ? 'bg-amber-600 text-white'
                                      : 'bg-rose-600 text-white'
                                    : 'bg-stone-200 text-stone-700'
                                }`}>
                                  {rec.level === 'principiante' ? 'Nivel 1' : rec.level === 'intermedio' ? 'Nivel 3' : 'Nivel 5'}
                                </span>
                              </div>
                              <h5 className="font-black text-xs sm:text-sm text-stone-900 mt-1 line-clamp-1">
                                {rec.level === 'principiante' ? 'Principiante' : rec.level === 'intermedio' ? 'Intermedio' : 'Experto'}
                              </h5>
                              <p className="text-[11px] text-stone-500 line-clamp-1 mt-0.5">
                                {rec.heroTechnique}
                              </p>
                            </div>

                            <div className="mt-2.5 pt-2 border-t border-stone-200/60 flex items-center justify-between text-[11px] font-bold text-stone-600">
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3 text-stone-400" />
                                <span>{rec.totalTimeMinutes}m</span>
                              </span>
                              <span className="text-stone-500 font-mono">
                                ~{rec.estimatedCalories} kcal
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Detalle de la Receta Activa del Nivel Seleccionado */}
                  {(() => {
                    const activeRecipe = trioResult.recipes.find((r) => r.level === selectedLevelTab) || trioResult.recipes[0];
                    if (!activeRecipe) return null;

                    const badgeBg =
                      activeRecipe.level === 'principiante'
                        ? 'bg-emerald-600'
                        : activeRecipe.level === 'intermedio'
                        ? 'bg-amber-600'
                        : 'bg-rose-600';

                    const borderHighlight =
                      activeRecipe.level === 'principiante'
                        ? 'border-emerald-300'
                        : activeRecipe.level === 'intermedio'
                        ? 'border-amber-300'
                        : 'border-rose-300';

                    return (
                      <div className={`p-4 sm:p-5 rounded-2xl bg-white border ${borderHighlight} shadow-sm space-y-4`}>
                        {/* Header de la Receta */}
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                          <div>
                            <div className="flex flex-wrap items-center gap-2 mb-1">
                              <span className={`text-[10px] font-black uppercase text-white px-2.5 py-0.5 rounded-full ${badgeBg}`}>
                                {activeRecipe.levelBadge}
                              </span>
                              <span className="text-[11px] font-bold text-stone-500 bg-stone-100 px-2 py-0.5 rounded-md">
                                {activeRecipe.difficulty}
                              </span>
                            </div>
                            <h4 className="text-lg sm:text-xl font-black text-stone-900 font-serif">
                              {activeRecipe.title}
                            </h4>
                            <p className="text-xs text-stone-600 mt-1 leading-relaxed">
                              {activeRecipe.description}
                            </p>
                          </div>

                          <div className="flex sm:flex-col gap-2 shrink-0">
                            <div className="px-3 py-1.5 bg-stone-100 rounded-xl text-center">
                              <span className="text-[10px] font-bold text-stone-400 block uppercase">Tiempo</span>
                              <span className="text-xs font-black text-stone-800 flex items-center justify-center gap-1">
                                <Clock className="w-3.5 h-3.5 text-stone-600" />
                                {activeRecipe.totalTimeMinutes} min
                              </span>
                            </div>

                            <div className="px-3 py-1.5 bg-amber-50 border border-amber-200/80 rounded-xl text-center">
                              <span className="text-[10px] font-bold text-amber-700 block uppercase">Calorías</span>
                              <span className="text-xs font-black text-amber-950 font-mono">
                                ~{activeRecipe.estimatedCalories} kcal
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Técnica Clave y Secreto del Chef */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                          <div className="p-3 bg-stone-50 rounded-xl border border-stone-200">
                            <span className="text-[10px] font-extrabold uppercase tracking-wider text-stone-500 block mb-0.5">
                              🎯 Técnica Culinaria Clave:
                            </span>
                            <p className="font-bold text-stone-800">{activeRecipe.heroTechnique}</p>
                          </div>

                          {activeRecipe.culturalSecret && (
                            <div className="p-3 bg-amber-50/70 rounded-xl border border-amber-200">
                              <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-800 block mb-0.5">
                                💡 Secreto de Chef Cero:
                              </span>
                              <p className="text-amber-950 font-medium">{activeRecipe.culturalSecret}</p>
                            </div>
                          )}
                        </div>

                        {/* Ingredientes adicionales necesarios de alacena */}
                        <div className="space-y-1.5">
                          <span className="text-[11px] font-black uppercase tracking-wider text-stone-700 flex items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Ingredientes básicos adicionales que necesitas:</span>
                          </span>

                          <div className="flex flex-wrap gap-1.5 pt-1">
                            <span className="px-2.5 py-1 bg-amber-100 text-amber-900 border border-amber-200 font-black rounded-xl text-xs flex items-center gap-1">
                              ⭐ {trioResult.productDetected} (De tu foto)
                            </span>
                            {activeRecipe.additionalIngredients.map((item, idx) => (
                              <span
                                key={idx}
                                className="px-2.5 py-1 bg-stone-100 hover:bg-stone-200/70 text-stone-800 font-semibold rounded-xl text-xs border border-stone-200 flex items-center gap-1 transition"
                              >
                                <Check className="w-3 h-3 text-emerald-600" />
                                <span>{item}</span>
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Pasos Guiados Interactivos */}
                        <div className="space-y-2 pt-1 border-t border-stone-100">
                          <span className="text-[11px] font-black uppercase tracking-wider text-stone-500 block">
                            Pasos guiados de preparación ({activeRecipe.steps.length} pasos):
                          </span>

                          <div className="space-y-2">
                            {activeRecipe.steps.map((st) => (
                              <div
                                key={st.stepNumber}
                                className="p-3 bg-stone-50/80 rounded-xl border border-stone-200 text-xs flex items-start gap-2.5"
                              >
                                <span className="w-5 h-5 rounded-full bg-stone-900 text-white font-black flex items-center justify-center shrink-0 text-[10px]">
                                  {st.stepNumber}
                                </span>
                                <div className="flex-1 space-y-0.5">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="font-extrabold text-stone-900">{st.title}</span>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                      <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-md ${
                                        st.heatLevel === 'apagado'
                                          ? 'bg-stone-200 text-stone-700'
                                          : st.heatLevel === 'bajo'
                                          ? 'bg-blue-100 text-blue-800'
                                          : st.heatLevel === 'medio'
                                          ? 'bg-amber-100 text-amber-800'
                                          : 'bg-rose-100 text-rose-800'
                                      }`}>
                                        Fuego {st.heatLevel}
                                      </span>
                                      {st.timerSeconds > 0 && (
                                        <span className="text-[10px] font-mono font-bold text-stone-600 bg-white px-1.5 py-0.2 rounded-md border border-stone-200">
                                          ⏱️ {st.timerSeconds}s
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <p className="text-stone-600 leading-snug">{st.instruction}</p>
                                  {st.tip && (
                                    <p className="text-[11px] text-amber-800 font-medium pt-0.5">
                                      💡 <em>{st.tip}</em>
                                    </p>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Gran Botón de Acción Principal para Iniciar en Vivo */}
                        <div className="pt-2">
                          <button
                            type="button"
                            onClick={() => handleConvertTrioRecipeAndCook(activeRecipe)}
                            className="w-full py-3.5 px-4 bg-gradient-to-r from-stone-950 via-stone-900 to-stone-950 hover:from-amber-600 hover:to-amber-700 text-white font-black text-sm rounded-2xl flex items-center justify-center gap-2.5 transition-all shadow-md hover:shadow-lg cursor-pointer group"
                          >
                            <Flame className="w-5 h-5 text-amber-400 group-hover:scale-110 transition-transform" />
                            <span>Cocinar este Nivel en Vivo con Chef Cero</span>
                            <ChevronRight className="w-4 h-4 text-amber-300 ml-1" />
                          </button>
                          <p className="text-[11px] text-center text-stone-500 mt-1.5">
                            Inicia el modo guiado paso a paso con temporizadores automáticos y asistencia de voz en tu cocina.
                          </p>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* MODO 1: RESULTADOS DE INSPECCIÓN DE PRODUCTO Y FRESCURA */}
              {inspectionResult && !isAnalyzing && (
                <div className="space-y-4 animate-fade-in">
                  {/* Tarjeta de Identificación y Semáforo de Estado */}
                  <div className={`p-4 sm:p-5 rounded-2xl border ${
                    inspectionResult.status === 'bueno'
                      ? 'bg-emerald-50/80 border-emerald-300 text-emerald-950'
                      : inspectionResult.status === 'consumir_urgente'
                      ? 'bg-amber-50/90 border-amber-300 text-amber-950'
                      : 'bg-rose-50 border-rose-300 text-rose-950'
                  }`}>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-black/10">
                      <div>
                        <span className="text-[10px] font-extrabold uppercase tracking-wider opacity-75 block">
                          Producto Identificado:
                        </span>
                        <h4 className="text-lg sm:text-xl font-black font-serif">
                          {inspectionResult.productName}
                        </h4>
                      </div>

                      <div className="flex items-center gap-2 self-start sm:self-auto">
                        <span className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-2xs ${
                          inspectionResult.status === 'bueno'
                            ? 'bg-emerald-600 text-white'
                            : inspectionResult.status === 'consumir_urgente'
                            ? 'bg-amber-600 text-white'
                            : 'bg-rose-600 text-white'
                        }`}>
                          {inspectionResult.status === 'bueno' && <ShieldCheck className="w-4 h-4" />}
                          {inspectionResult.status === 'consumir_urgente' && <AlertTriangle className="w-4 h-4" />}
                          {inspectionResult.status === 'descartar' && <OctagonAlert className="w-4 h-4" />}
                          <span>{inspectionResult.statusHeadline}</span>
                        </span>

                        <span className="text-xs font-black bg-white/80 px-2.5 py-1.5 rounded-xl border border-black/10">
                          Frescura: {inspectionResult.freshnessScore}%
                        </span>
                      </div>
                    </div>

                    <p className="text-xs mt-2.5 leading-relaxed font-medium">
                      {inspectionResult.confidenceExplanation}
                    </p>

                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-black/5 text-xs">
                      <div className="flex items-center gap-1.5 font-bold">
                        <Calendar className="w-3.5 h-3.5 text-stone-600" />
                        <span>Vida útil estimada:</span>
                        <span className="underline decoration-stone-400">{inspectionResult.estimatedShelfLife}</span>
                      </div>

                      {inspectionResult.audioScript && (
                        <button
                          type="button"
                          onClick={handleSpeakVerdict}
                          className="px-3 py-1 bg-white hover:bg-stone-50 border border-black/15 rounded-lg font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
                        >
                          <Volume2 className={`w-3.5 h-3.5 ${isSpeakingResult ? 'text-emerald-600 animate-pulse' : 'text-stone-700'}`} />
                          <span>{isSpeakingResult ? 'Chef hablando...' : 'Escuchar veredicto'}</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Checklist Sensorial de 3 Sentidos (Vista, Olfato, Tacto) */}
                  <div className="bg-stone-50 p-4 rounded-2xl border border-stone-200 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-extrabold uppercase tracking-wider text-stone-700 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Comprobación Sensorial en tu Mano (Los 3 Sentidos):</span>
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1 text-xs">
                      <div className="p-3 bg-white rounded-xl border border-stone-200/80 space-y-1">
                        <div className="font-extrabold text-stone-800 flex items-center gap-1.5 text-[11px] uppercase text-amber-800">
                          <Eye className="w-3.5 h-3.5" />
                          <span>1. Vista (Color y Piel)</span>
                        </div>
                        <p className="text-stone-600 leading-snug">{inspectionResult.sensoryCheck.sight}</p>
                      </div>

                      <div className="p-3 bg-white rounded-xl border border-stone-200/80 space-y-1">
                        <div className="font-extrabold text-stone-800 flex items-center gap-1.5 text-[11px] uppercase text-cyan-800">
                          <Wind className="w-3.5 h-3.5" />
                          <span>2. Olfato (Aroma)</span>
                        </div>
                        <p className="text-stone-600 leading-snug">{inspectionResult.sensoryCheck.smell}</p>
                      </div>

                      <div className="p-3 bg-white rounded-xl border border-stone-200/80 space-y-1">
                        <div className="font-extrabold text-stone-800 flex items-center gap-1.5 text-[11px] uppercase text-purple-800">
                          <ThumbsUp className="w-3.5 h-3.5" />
                          <span>3. Tacto (Firmeza)</span>
                        </div>
                        <p className="text-stone-600 leading-snug">{inspectionResult.sensoryCheck.touch}</p>
                      </div>
                    </div>

                    <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 text-xs flex items-center gap-2 font-medium">
                      <Info className="w-4 h-4 text-amber-700 shrink-0" />
                      <span>💡 <strong>Consejo del Mentor:</strong> {inspectionResult.safetyAdvice}</span>
                    </div>
                  </div>

                  {/* Recetas para cocinarlo hoy mismo (si está bueno o para consumir hoy) */}
                  {inspectionResult.status !== 'descartar' && (
                    <div className="space-y-2.5">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-stone-600 flex items-center gap-1.5">
                        <Flame className="w-3.5 h-3.5 text-orange-500" />
                        <span>¿Con qué y cómo cocinar este {inspectionResult.productName}?</span>
                      </h4>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {inspectionResult.suggestedDishes.map((dish, i) => (
                          <div
                            key={dish.id || i}
                            className="p-4 bg-white rounded-2xl border border-stone-200 hover:border-emerald-400 hover:shadow-xs transition flex flex-col justify-between gap-3 group"
                          >
                            <div>
                              <div className="flex items-center justify-between gap-2">
                                <h5 className="font-extrabold text-sm text-stone-900 group-hover:text-emerald-800 transition">
                                  {dish.title}
                                </h5>
                                <span className="text-[11px] font-bold text-stone-600 bg-stone-100 px-2 py-0.5 rounded-md flex items-center gap-1 shrink-0">
                                  <Clock className="w-3 h-3 text-stone-400" />
                                  <span>{dish.totalTimeMinutes} min</span>
                                </span>
                              </div>

                              <p className="text-xs text-stone-600 mt-1.5 leading-relaxed font-medium">
                                {dish.whyThisDishWorks}
                              </p>

                              <div className="mt-2 text-[11px] text-stone-500">
                                <strong>Necesitas:</strong> {dish.ingredientsNeeded.join(', ')}
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleConvertProductDishAndCook(dish)}
                              className="w-full py-2.5 px-3.5 bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition shadow-xs cursor-pointer"
                            >
                              <span>Cocinar este plato con guía paso a paso</span>
                              <ChevronRight className="w-4 h-4 text-emerald-400" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {inspectionResult.status === 'descartar' && (
                    <div className="p-4 bg-rose-50 border border-rose-300 rounded-2xl text-rose-900 text-xs space-y-2">
                      <div className="font-bold text-sm flex items-center gap-2">
                        <OctagonAlert className="w-5 h-5 text-rose-600" />
                        <span>Recomendación de Seguridad Estricta</span>
                      </div>
                      <p className="leading-relaxed">
                        No te arriesgues a cocinar este alimento. Cuando un producto presenta moho o signos avanzados de descomposición, el calor no siempre elimina las toxinas y puede causar malestar estomacal.
                      </p>
                      <p className="font-bold text-rose-800">
                        ¡Limpia el estante con un paño húmedo y vinagre para cuidar el resto de tus alimentos!
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* MODO 2: RESULTADOS DE NEVERA COMPLETA */}
              {scanResult && !isAnalyzing && (
                <div className="space-y-4 animate-fade-in">
                  <div className="bg-amber-50/70 p-3.5 rounded-2xl border border-amber-200/80">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-amber-900 mb-1.5">
                      Ingredientes detectados en la foto:
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {scanResult.detectedIngredients.map((item, idx) => (
                        <span
                          key={idx}
                          className="px-2.5 py-1 bg-white text-stone-800 font-bold rounded-xl text-xs border border-amber-200 shadow-2xs flex items-center gap-1"
                        >
                          <Check className="w-3 h-3 text-emerald-600" />
                          <span>{item}</span>
                        </span>
                      ))}
                    </div>
                    <p className="text-xs text-stone-600 mt-2 italic">
                      "{scanResult.chefObservation}"
                    </p>
                  </div>

                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-stone-500 mb-2">
                      Platos que puedes preparar ya (sin complicaciones):
                    </h4>

                    <div className="space-y-2.5">
                      {scanResult.suggestedDishes.map((dish, i) => (
                        <div
                          key={dish.id || i}
                          className="p-4 rounded-2xl border border-stone-200 hover:border-amber-300 hover:bg-stone-50/60 transition flex flex-col justify-between gap-3 group"
                        >
                          <div>
                            <div className="flex items-center justify-between gap-2">
                              <h5 className="font-extrabold text-sm sm:text-base text-stone-900 group-hover:text-amber-800 transition">
                                {dish.title}
                              </h5>
                              <span className="text-[11px] font-bold text-stone-600 bg-stone-100 px-2 py-0.5 rounded-md flex items-center gap-1 shrink-0">
                                <Clock className="w-3 h-3 text-stone-400" />
                                <span>{dish.totalTimeMinutes} min</span>
                              </span>
                            </div>

                            <p className="text-xs text-stone-600 mt-1 leading-relaxed">
                              💡 <strong>El secreto:</strong> {dish.keyTip}
                            </p>

                            <div className="mt-2 text-[11px] text-stone-500">
                              Usa: {dish.ingredientsUsed.join(', ')}
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleConvertFridgeDishAndCook(dish)}
                            className="w-full py-2.5 px-4 bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition shadow-xs cursor-pointer"
                          >
                            <span>Cocinar este plato con guía paso a paso</span>
                            <ChevronRight className="w-4 h-4 text-amber-400" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
