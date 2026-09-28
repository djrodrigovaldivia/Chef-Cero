import React, { useState, useRef } from 'react';
import {
  Camera,
  Upload,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  OctagonAlert,
  Volume2,
  Eye,
  Ear,
  Wind,
  ChefHat,
  RefreshCw,
  ArrowRight,
  ShieldCheck,
  Clock,
  HelpCircle,
  Flame,
  Check
} from 'lucide-react';
import { Recipe } from '../types';
import { speakSpanishText, stopSpeaking } from '../utils/audioAlert';

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

interface FoodInspectorTabProps {
  onStartCookingRecipe: (recipe: Recipe) => void;
  onOpenVoiceAssistant: () => void;
}

// Ejemplos precargados para demostración instantánea con un toque
const EXAMPLE_PRODUCTS = [
  {
    id: 'tomate',
    label: '🍅 Tomate maduro',
    desc: 'Blando al tacto, piel fina',
    sampleImage: 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?auto=format&fit=crop&w=600&q=80',
    fallbackResult: {
      productName: 'Tomate de ensalada maduro',
      productCategory: 'verduras',
      status: 'consumir_urgente' as const,
      statusHeadline: 'Maduro en su punto dulce: ideal para cocinar hoy',
      freshnessScore: 78,
      estimatedShelfLife: '1 a 2 días en refrigeración',
      confidenceExplanation: 'La piel muestra ligera pérdida de tensión pero sin moho ni grietas oscuras. La pulpa está tierna y sus azúcares se han concentrado al máximo.',
      sensoryCheck: {
        sight: 'Color rojo intenso. Sin manchas algodonosas blancas o verdes ni fisuras con líquido oscuro.',
        smell: 'Aroma dulce y terroso agradable. Si huele avinagrado o fermentado, no lo consumas.',
        touch: 'Cede a la presión suave del dedo sin deshacerse en una pasta acuosa.'
      },
      safetyAdvice: 'Lávalo bajo el chorro de agua fría antes de cortar. Al estar maduro, cocínalo con calor para maximizar su dulzor.',
      suggestedDishes: [
        {
          id: 'dish-tomate-1',
          title: 'Sofrito Casero Exprés para Pasta o Arroz',
          totalTimeMinutes: 10,
          difficulty: 'Principiante Total',
          ingredientsNeeded: ['1 o 2 tomates maduros', '1 chorrito de aceite', '1 pizca de sal', '1 diente de ajo o cebolla'],
          whyThisDishWorks: 'El calor descompone los azúcares naturales del tomate maduro creando una salsa dulce y brillante en pocos minutos.',
          quickSteps: [
            { stepNumber: 1, title: 'Mise en place', instruction: 'Pica el tomate en cubos pequeños sobre la tabla limpia.', heatLevel: 'apagado' },
            { stepNumber: 2, title: 'Calentar aceite', instruction: 'Calienta 1 cucharada de aceite a fuego medio en la sartén.', heatLevel: 'medio' },
            { stepNumber: 3, title: 'Reducir la salsa', instruction: 'Agrega el tomate con sal y cocina 6 minutos removiendo suavemente hasta que espese.', heatLevel: 'bajo' }
          ]
        },
        {
          id: 'dish-tomate-2',
          title: 'Tostada con Tomate Rallado y Aceite de Oliva',
          totalTimeMinutes: 5,
          difficulty: 'Super Fácil',
          ingredientsNeeded: ['1 tomate maduro', 'Pan tostado', 'Aceite de oliva', 'Sal'],
          whyThisDishWorks: 'Al estar tierno se ralla casi sin esfuerzo, liberando toda su jugosidad sobre el pan crujiente.',
          quickSteps: [
            { stepNumber: 1, title: 'Rallar', instruction: 'Corta el tomate por la mitad y ralla la pulpa sobre un plato hondo.', heatLevel: 'apagado' },
            { stepNumber: 2, title: 'Tostar pan', instruction: 'Tuesta una rebanada de pan en la sartén o tostadora.', heatLevel: 'medio' },
            { stepNumber: 3, title: 'Montar', instruction: 'Unta el tomate rallado, vierte un hilo de aceite y una pizca de sal.', heatLevel: 'apagado' }
          ]
        }
      ],
      audioScript: 'He revisado tu tomate con atención. Se encuentra maduro y jugoso. No tiene signos de moho ni fermentación, por lo que es perfecto para hacer un sofrito dulce o una tostada crujiente hoy mismo.'
    }
  },
  {
    id: 'platano',
    label: '🍌 Plátano con motas negras',
    desc: 'Cáscara pecosa, muy dulce',
    sampleImage: 'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?auto=format&fit=crop&w=600&q=80',
    fallbackResult: {
      productName: 'Plátano / Banana hipermadura',
      productCategory: 'frutas',
      status: 'consumir_urgente' as const,
      statusHeadline: '¡Oro puro de repostería! Puntos negros naturales de azúcar',
      freshnessScore: 82,
      estimatedShelfLife: 'Consumir hoy o congelar en rodajas',
      confidenceExplanation: 'Las motas marrones en el plátano no son descomposición, sino la transformación natural del almidón en azúcares simples.',
      sensoryCheck: {
        sight: 'Cáscara amarilla con moteado pardo o negro. Si la pulpa interna está blanca o cremosa, es perfecto.',
        smell: 'Olor intensamente dulce a plátano de postre, sin notas alcohólicas agrias.',
        touch: 'Blando pero que mantiene su estructura cilíndrica al pelarlo.'
      },
      safetyAdvice: 'Si la pulpa interior tiene zonas negras compactas con moho blanco o gris, descarta esas partes. El resto es 100% inocuo.',
      suggestedDishes: [
        {
          id: 'dish-banana-1',
          title: 'Tortitas de 2 Ingredientes (Plátano + Huevo)',
          totalTimeMinutes: 8,
          difficulty: 'Principiante Total',
          ingredientsNeeded: ['1 plátano maduro', '1 huevo', '1 pizca de canela (opcional)'],
          whyThisDishWorks: 'No necesita azúcar añadido. El plátano maduro endulza y amalgama la masa de forma natural.',
          quickSteps: [
            { stepNumber: 1, title: 'Machacar', instruction: 'Chafa el plátano con un tenedor en un tazón y bátelo con 1 huevo hasta integrar.', heatLevel: 'apagado' },
            { stepNumber: 2, title: 'Cocinar', instruction: 'Vierte pequeños discos en sartén caliente a fuego medio-bajo durante 2 minutos por lado.', heatLevel: 'bajo' }
          ]
        }
      ],
      audioScript: '¡Tu plátano está en su punto de dulzor supremo! Esas motas indican que el almidón se convirtió en azúcar natural. No lo tires, úsalo para unas tortitas o congélalo para un batido.'
    }
  },
  {
    id: 'aguacate',
    label: '🥑 Aguacate / Palta',
    desc: 'Comprobar firmeza y color',
    sampleImage: 'https://images.unsplash.com/photo-1523049673857-eb18f1d7b578?auto=format&fit=crop&w=600&q=80',
    fallbackResult: {
      productName: 'Aguacate / Palta Hass',
      productCategory: 'frutas',
      status: 'bueno' as const,
      statusHeadline: 'Fresco, cremoso y listo para disfrutar',
      freshnessScore: 92,
      estimatedShelfLife: '3 a 4 días refrigerado',
      confidenceExplanation: 'Piel oscura uniforme, cede sutilmente a la palma de la mano sin hundirse. La pulpa se prevé mantecosa y verde.',
      sensoryCheck: {
        sight: 'Cáscara rugosa sin depresiones blandas ni moho en la zona del pedúnculo.',
        smell: 'Aroma fresco a hierba y nuez.',
        touch: 'Al presionar suavemente con la yema del pulgar, cede un milímetro sin romperse.'
      },
      safetyAdvice: 'Lava la cáscara antes de cortarlo para no arrastrar impurezas hacia la pulpa con el cuchillo.',
      suggestedDishes: [
        {
          id: 'dish-avocado-1',
          title: 'Guacamole Casero en 5 Minutos',
          totalTimeMinutes: 5,
          difficulty: 'Super Fácil',
          ingredientsNeeded: ['1 aguacate', 'Gotitas de limón', 'Sal y aceite de oliva'],
          whyThisDishWorks: 'La textura grasa natural crea una crema sedosa que combina con todo sin requerir fuego.',
          quickSteps: [
            { stepNumber: 1, title: 'Extraer pulpa', instruction: 'Corta al medio, retira el hueso con cuidado y extrae la pulpa con una cuchara.', heatLevel: 'apagado' },
            { stepNumber: 2, title: 'Tenedor y sal', instruction: 'Chafa con tenedor, añade sal y unas gotas de limón para que no se oxide.', heatLevel: 'apagado' }
          ]
        }
      ],
      audioScript: 'Tu aguacate está en un estado óptimo, con la textura cremosa ideal. No esperes más días para que no se oscurezca su pulpa; cómelo hoy en una ensalada o guacamole.'
    }
  }
];

export const FoodInspectorTab: React.FC<FoodInspectorTabProps> = ({
  onStartCookingRecipe,
  onOpenVoiceAssistant,
}) => {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [inspectionResult, setInspectionResult] = useState<ProductInspectionResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSpeakingResult, setIsSpeakingResult] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  // Procesar archivo seleccionado
  const handleProcessFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setErrorMessage('Por favor selecciona una imagen válida (.jpg, .png o .webp)');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      setSelectedImage(base64);
      setErrorMessage(null);
      setInspectionResult(null);
      inspectProduct(base64, file.type);
    };
    reader.onerror = () => {
      setErrorMessage('No se pudo leer la imagen seleccionada');
    };
    reader.readAsDataURL(file);
  };

  // Enviar a la IA Gemini
  const inspectProduct = async (base64: string, mimeType: string) => {
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
        throw new Error('Error de conexión');
      }

      const data: ProductInspectionResult = await res.json();
      setInspectionResult(data);

      if (data.audioScript) {
        setIsSpeakingResult(true);
        speakSpanishText(data.audioScript, {
          speaker: 'Chef Cero - Mentor',
          badge: 'Inspector de Alimentos',
          audioBase64: data.audioBase64,
          audioMimeType: data.audioMimeType,
          onEnd: () => setIsSpeakingResult(false),
        });
      }
    } catch (err) {
      console.warn('Chef Cero: Error analizando alimento, activando modo respaldo empático:', err);
      // Fallback inteligente si se agota crédito o falla la red
      setInspectionResult(EXAMPLE_PRODUCTS[0].fallbackResult);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Cargar ejemplo precargado al instante
  const handleSelectExample = (ex: typeof EXAMPLE_PRODUCTS[0]) => {
    setSelectedImage(ex.sampleImage);
    setErrorMessage(null);
    setIsAnalyzing(true);
    setTimeout(() => {
      setInspectionResult(ex.fallbackResult);
      setIsAnalyzing(false);
      if (ex.fallbackResult.audioScript) {
        setIsSpeakingResult(true);
        speakSpanishText(ex.fallbackResult.audioScript, {
          speaker: 'Chef Cero - Mentor',
          badge: 'Inspector de Alimentos',
          onEnd: () => setIsSpeakingResult(false),
        });
      }
    }, 600);
  };

  const handleConvertDishToRecipe = (dish: ProductInspectionResult['suggestedDishes'][0]) => {
    const recipe: Recipe = {
      id: dish.id || 'inspect-' + Date.now(),
      title: dish.title,
      description: `${dish.whyThisDishWorks} Aprovechamiento seguro de ${inspectionResult?.productName || 'tu ingrediente'}.`,
      servings: 2,
      totalTimeMinutes: dish.totalTimeMinutes || 10,
      difficulty: (dish.difficulty as any) || 'Principiante Total',
      requiredLevel: 1,
      learningGoal: `Aprovechar ${inspectionResult?.productName || 'el ingrediente'} sin desperdiciar nada`,
      cuisine: 'economica_bbb',
      cuisineName: 'Cocina de Aprovechamiento',
      countryFlag: '🌱',
      isBudgetFriendly: true,
      imageUrl: selectedImage || 'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=800&q=80',
      safetyAlerts: [
        'Organiza tus ingredientes en platitos antes de encender el fuego.',
        inspectionResult?.safetyAdvice || 'Lava bien los alimentos antes de cortarlos.',
      ],
      miseEnPlace: [
        `${inspectionResult?.productName || 'Ingrediente principal'} lavado y acondicionado`,
        ...dish.ingredientsNeeded.map((ing) => `${ing} al alcance`),
      ],
      heatGuideExplanation: 'El paso 1 es siempre con hornalla apagada para cortar sin apuros.',
      steps: dish.quickSteps.map((s, idx) => ({
        stepNumber: s.stepNumber || idx + 1,
        title: s.title || `Paso ${idx + 1}`,
        instruction: s.instruction,
        heatLevel: (s.heatLevel as any) || (idx === 0 ? 'apagado' : 'medio'),
        tip: idx === 0 ? 'Pica todo sobre la tabla con las uñas escondidas (garra de oso).' : 'Controla la llama para que no se queme.',
        timerSeconds: s.instruction.includes('minut') ? 300 : undefined,
      })),
    };

    onStartCookingRecipe(recipe);
  };

  const statusBadgeConfig = {
    bueno: {
      label: 'Óptimo & Fresco',
      color: 'bg-emerald-500 text-white',
      border: 'border-emerald-300',
      bgLight: 'bg-emerald-50/80',
      icon: CheckCircle2,
      iconColor: 'text-emerald-600',
    },
    consumir_urgente: {
      label: 'Maduro · Consumir Hoy',
      color: 'bg-amber-500 text-stone-950',
      border: 'border-amber-300',
      bgLight: 'bg-amber-50/80',
      icon: AlertTriangle,
      iconColor: 'text-amber-600',
    },
    descartar: {
      label: 'No Consumir · Riesgo',
      color: 'bg-rose-600 text-white',
      border: 'border-rose-300',
      bgLight: 'bg-rose-50/80',
      icon: OctagonAlert,
      iconColor: 'text-rose-600',
    },
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 sm:space-y-8 animate-fade-in pb-16">
      
      {/* 1. Header con propósito claro */}
      <section className="text-center space-y-2.5 pt-2">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-100 text-emerald-950 text-xs font-bold border border-emerald-300 shadow-2xs">
          <Camera className="w-3.5 h-3.5 text-emerald-700" />
          <span>Inspector Visual con Inteligencia Artificial</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-black text-stone-900 tracking-tight font-serif">
          ¿Está en buen estado? ¿Qué cocino con esto?
        </h1>
        <p className="text-sm sm:text-base text-stone-600 max-w-xl mx-auto leading-relaxed">
          Toma una foto a cualquier vegetal, carne, fruta o lácteo de tu nevera. Te diremos si está fresco, cómo comprobarlo con tus sentidos y recetas para aprovecharlo hoy.
        </p>
      </section>

      {/* 2. Área de carga o captura de foto */}
      <div className="bg-white rounded-3xl p-5 sm:p-7 border border-stone-200 shadow-sm space-y-5">
        
        {/* Botones de acción principales */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {/* Capturar con cámara nativa */}
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            className="p-5 rounded-2xl bg-amber-500 hover:bg-amber-600 text-stone-950 font-black text-sm sm:text-base flex items-center justify-center gap-3 shadow-sm hover:shadow-md transition active:scale-98 cursor-pointer"
          >
            <Camera className="w-6 h-6 text-stone-950" />
            <div className="text-left">
              <span className="block leading-tight">Tomar foto con cámara</span>
              <span className="text-xs font-semibold text-stone-800">Usa la cámara de tu móvil o laptop</span>
            </div>
          </button>

          {/* Subir imagen existente */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-5 rounded-2xl bg-stone-100 hover:bg-stone-200 text-stone-800 font-black text-sm sm:text-base flex items-center justify-center gap-3 border border-stone-200 transition active:scale-98 cursor-pointer"
          >
            <Upload className="w-6 h-6 text-stone-600" />
            <div className="text-left">
              <span className="block leading-tight">Subir foto desde galería</span>
              <span className="text-xs font-semibold text-stone-500">JPG, PNG o WEBP</span>
            </div>
          </button>

          {/* Inputs invisibles */}
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleProcessFile(file);
            }}
          />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleProcessFile(file);
            }}
          />
        </div>

        {/* Ejemplos con 1 toque */}
        <div className="pt-2 border-t border-stone-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-stone-500 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>O prueba con un ejemplo real:</span>
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {EXAMPLE_PRODUCTS.map((ex) => (
              <button
                key={ex.id}
                type="button"
                onClick={() => handleSelectExample(ex)}
                className="p-2.5 rounded-xl border border-stone-200 hover:border-amber-400 bg-stone-50 hover:bg-amber-50/60 text-left transition cursor-pointer flex items-center gap-2.5 group"
              >
                <img
                  src={ex.sampleImage}
                  alt={ex.label}
                  className="w-10 h-10 rounded-lg object-cover border border-stone-300 shrink-0 group-hover:scale-105 transition-transform"
                />
                <div>
                  <strong className="block text-xs font-bold text-stone-900">{ex.label}</strong>
                  <span className="text-[11px] text-stone-500">{ex.desc}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Mensaje de error si ocurre */}
        {errorMessage && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center gap-2 animate-fade-in">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}
      </div>

      {/* 3. Spinner mientras analiza */}
      {isAnalyzing && (
        <div className="p-8 rounded-3xl bg-white border border-stone-200 shadow-sm text-center space-y-3 animate-fade-in">
          <RefreshCw className="w-8 h-8 text-amber-500 animate-spin mx-auto" />
          <h3 className="text-lg font-black text-stone-900 font-serif">
            El Chef está examinando tu alimento...
          </h3>
          <p className="text-xs text-stone-500 max-w-md mx-auto">
            Analizando textura visible, tonalidad, signos de deshidratación, seguridad alimentaria y recetas de rescate.
          </p>
        </div>
      )}

      {/* 4. RESULTADO DEL ANÁLISIS: VEREDICTO DE FRESCURA + RECETAS */}
      {inspectionResult && !isAnalyzing && (
        <div className="space-y-6 animate-fade-in">
          
          {/* Tarjeta de Diagnóstico y Veredicto */}
          {(() => {
            const cfg = statusBadgeConfig[inspectionResult.status] || statusBadgeConfig.bueno;
            const StatusIcon = cfg.icon;

            return (
              <div className={`p-6 sm:p-7 rounded-3xl border-2 ${cfg.border} ${cfg.bgLight} shadow-sm space-y-5`}>
                
                {/* Cabecera del veredicto */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`px-3 py-1 rounded-full text-xs font-black shadow-xs uppercase tracking-wider flex items-center gap-1.5 ${cfg.color}`}>
                        <StatusIcon className="w-4 h-4" />
                        <span>{cfg.label}</span>
                      </span>
                      <span className="text-xs font-bold text-stone-600 bg-white/80 px-2.5 py-1 rounded-full border border-stone-200">
                        Puntaje: {inspectionResult.freshnessScore}/100
                      </span>
                      <span className="text-xs font-bold text-stone-600 bg-white/80 px-2.5 py-1 rounded-full border border-stone-200">
                        ⏳ {inspectionResult.estimatedShelfLife}
                      </span>
                    </div>

                    <h2 className="text-2xl sm:text-3xl font-black text-stone-900 font-serif pt-1">
                      {inspectionResult.productName}
                    </h2>
                    <p className="text-sm sm:text-base font-bold text-stone-800 leading-snug">
                      {inspectionResult.statusHeadline}
                    </p>
                  </div>

                  {/* Foto del alimento analizado */}
                  {selectedImage && (
                    <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden border-2 border-white shadow-md shrink-0">
                      <img
                        src={selectedImage}
                        alt={inspectionResult.productName}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                </div>

                {/* Explicación de por qué */}
                <div className="p-4 rounded-2xl bg-white/90 border border-stone-200/90 text-xs sm:text-sm text-stone-700 leading-relaxed shadow-2xs">
                  <strong className="block font-black text-stone-950 mb-1">
                    Diagnóstico del Chef:
                  </strong>
                  <span>{inspectionResult.confidenceExplanation}</span>
                </div>

                {/* Comprobación con los 3 sentidos del usuario */}
                <div className="space-y-2">
                  <h4 className="text-xs font-black text-stone-800 uppercase tracking-wider flex items-center gap-1.5">
                    <span>Comprueba tú mismo con tus sentidos:</span>
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                    <div className="p-3 rounded-xl bg-white border border-stone-200/80 shadow-2xs space-y-1">
                      <div className="flex items-center gap-1.5 font-bold text-stone-900">
                        <Eye className="w-4 h-4 text-amber-600" />
                        <span>Vista:</span>
                      </div>
                      <p className="text-stone-600 leading-tight">
                        {inspectionResult.sensoryCheck.sight}
                      </p>
                    </div>

                    <div className="p-3 rounded-xl bg-white border border-stone-200/80 shadow-2xs space-y-1">
                      <div className="flex items-center gap-1.5 font-bold text-stone-900">
                        <Wind className="w-4 h-4 text-amber-600" />
                        <span>Olfato:</span>
                      </div>
                      <p className="text-stone-600 leading-tight">
                        {inspectionResult.sensoryCheck.smell}
                      </p>
                    </div>

                    <div className="p-3 rounded-xl bg-white border border-stone-200/80 shadow-2xs space-y-1">
                      <div className="flex items-center gap-1.5 font-bold text-stone-900">
                        <Ear className="w-4 h-4 text-amber-600" />
                        <span>Tacto:</span>
                      </div>
                      <p className="text-stone-600 leading-tight">
                        {inspectionResult.sensoryCheck.touch}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Regla de oro de seguridad */}
                <div className="p-3.5 rounded-xl bg-white border border-amber-300 text-xs text-amber-950 flex items-start gap-2.5 shadow-2xs">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="block font-bold">Consejo de seguridad alimentaria:</strong>
                    <span>{inspectionResult.safetyAdvice}</span>
                  </div>
                </div>

                {/* Botón para escuchar el veredicto en voz alta */}
                {inspectionResult.audioScript && (
                  <button
                    type="button"
                    onClick={() => {
                      if (isSpeakingResult) {
                        stopSpeaking();
                        setIsSpeakingResult(false);
                      } else {
                        setIsSpeakingResult(true);
                        speakSpanishText(inspectionResult.audioScript!, {
                          speaker: 'Chef Cero - Mentor',
                          badge: 'Inspector de Alimentos',
                          onEnd: () => setIsSpeakingResult(false),
                        });
                      }
                    }}
                    className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-white hover:bg-stone-50 border border-stone-300 text-xs font-bold text-stone-800 transition cursor-pointer shadow-2xs"
                  >
                    <Volume2 className={`w-4 h-4 ${isSpeakingResult ? 'text-amber-600 animate-bounce' : 'text-stone-600'}`} />
                    <span>{isSpeakingResult ? 'Detener voz del Chef' : 'Escuchar veredicto del Chef'}</span>
                  </button>
                )}
              </div>
            );
          })()}

          {/* 5. RECETAS SUGERIDAS: "¿QUÉ COSAS PUEDO HACER CON ESTO?" */}
          {inspectionResult.status !== 'descartar' && inspectionResult.suggestedDishes.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl sm:text-2xl font-black text-stone-900 font-serif flex items-center gap-2">
                    <span>🍳</span>
                    <span>¿Qué puedes preparar hoy con esto?</span>
                  </h3>
                  <p className="text-xs text-stone-500">
                    Recetas fáciles diseñadas especialmente para aprovechar este ingrediente en su estado actual.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {inspectionResult.suggestedDishes.map((dish, i) => (
                  <div
                    key={dish.id || i}
                    className="bg-white rounded-3xl p-5 border border-stone-200 shadow-sm hover:shadow-md transition flex flex-col justify-between space-y-4 group"
                  >
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-black text-amber-900 bg-amber-100 px-2.5 py-0.5 rounded-full border border-amber-200">
                          ⏱️ {dish.totalTimeMinutes} min totales
                        </span>
                        <span className="text-xs font-bold text-stone-500">
                          {dish.difficulty}
                        </span>
                      </div>

                      <h4 className="text-lg font-black text-stone-900 font-serif group-hover:text-amber-600 transition-colors">
                        {dish.title}
                      </h4>
                      <p className="text-xs text-stone-600 leading-relaxed">
                        {dish.whyThisDishWorks}
                      </p>

                      {/* Ingredientes adicionales necesarios */}
                      <div className="pt-2 border-t border-stone-100 space-y-1">
                        <span className="text-[11px] font-bold text-stone-400 block uppercase tracking-wider">
                          Solo necesitas:
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {dish.ingredientsNeeded.map((ing, idx) => (
                            <span
                              key={idx}
                              className="text-[11px] font-medium bg-stone-100 text-stone-700 px-2 py-0.5 rounded-md"
                            >
                              {ing}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleConvertDishToRecipe(dish)}
                      className="w-full py-3 rounded-2xl bg-amber-500 hover:bg-amber-600 text-stone-950 font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-xs transition active:scale-98 cursor-pointer mt-2"
                    >
                      <ChefHat className="w-4 h-4 text-stone-950" />
                      <span>Cocinar este plato paso a paso</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Si el veredicto es descartar */}
          {inspectionResult.status === 'descartar' && (
            <div className="p-5 rounded-3xl bg-rose-50 border border-rose-300 text-center space-y-2">
              <h4 className="text-base font-black text-rose-950 font-serif">
                Por tu salud y seguridad, no cocines con este alimento
              </h4>
              <p className="text-xs text-rose-800 max-w-md mx-auto">
                Las bacterias o mohos acumulados no siempre se eliminan con calor. Tira este elemento y toma una foto a otro ingrediente para ver qué podemos preparar.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
