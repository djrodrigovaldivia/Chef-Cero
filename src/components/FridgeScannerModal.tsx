import React, { useState, useRef } from 'react';
import { Camera, Upload, Sparkles, X, Check, Clock, ChevronRight, AlertCircle, RefreshCw, ChefHat } from 'lucide-react';
import { Recipe } from '../types';

interface FridgeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartCookingRecipe: (recipe: Recipe) => void;
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

export const FridgeScannerModal: React.FC<FridgeScannerModalProps> = ({
  isOpen,
  onClose,
  onStartCookingRecipe,
}) => {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar tipo de imagen
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
      analyzeImage(base64, file.type);
    };
    reader.onerror = () => {
      setErrorMessage('No se pudo leer la imagen');
    };
    reader.readAsDataURL(file);
  };

  const analyzeImage = async (base64: string, mimeType: string) => {
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
        throw new Error('Error en el servidor al analizar');
      }

      const data = await res.json();
      setScanResult(data);
    } catch (err: any) {
      console.warn('Chef Cero: Error analizando imagen:', err);
      setErrorMessage('Hubo un inconveniente analizando la foto. Intenta con una toma más cercana o con mejor luz.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleConvertAndCook = (dish: ScanResult['suggestedDishes'][0]) => {
    // Convertir el plato sugerido en una Recipe completa para el modo guiado
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
        timerSeconds: idx === 1 ? 180 : undefined,
        timerLabel: idx === 1 ? 'Cocción guiada' : undefined,
      })),
    };

    onStartCookingRecipe(convertedRecipe);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-stone-950/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
      <div className="bg-white rounded-3xl max-w-xl w-full border border-stone-200 shadow-2xl overflow-hidden my-6">
        {/* Cabecera del modal */}
        <div className="p-5 border-b border-stone-100 flex items-center justify-between bg-stone-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-500 text-stone-950 flex items-center justify-center font-bold shadow-xs">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="font-extrabold text-base text-stone-900 font-serif">
                  Escanear Nevera o Alacena
                </h3>
                <span className="text-[10px] bg-amber-100 text-amber-900 font-bold px-2 py-0.5 rounded-full border border-amber-200">
                  Visión IA
                </span>
              </div>
              <p className="text-xs text-stone-500">
                Toma una foto de lo que tienes y el Chef te inventa la comida en segundos
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-stone-400 hover:text-stone-700 hover:bg-stone-200/60 rounded-xl transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Contenido del modal */}
        <div className="p-5 sm:p-6 space-y-5">
          {/* Zona de captura / subida de foto */}
          {!selectedImage ? (
            <div className="border-2 border-dashed border-stone-300 rounded-3xl p-6 sm:p-8 text-center space-y-4 hover:border-amber-400 hover:bg-amber-50/20 transition cursor-pointer"
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

              <div className="w-16 h-16 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center mx-auto text-2xl shadow-inner">
                📸
              </div>

              <div>
                <h4 className="font-extrabold text-stone-900 text-sm sm:text-base">
                  Toca aquí para tomar una foto o subir desde tu galería
                </h4>
                <p className="text-xs text-stone-500 mt-1 max-w-sm mx-auto">
                  Apunta a los estantes de tu refrigerador, la mesa o los 3 o 4 ingredientes que tienes a mano.
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                <button
                  type="button"
                  className="px-4 py-2.5 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs transition"
                >
                  <Camera className="w-4 h-4 text-amber-400" />
                  <span>Abrir Cámara</span>
                </button>

                <button
                  type="button"
                  className="px-4 py-2.5 bg-white border border-stone-300 hover:bg-stone-100 text-stone-700 rounded-xl text-xs font-bold flex items-center gap-2 transition"
                >
                  <Upload className="w-4 h-4 text-stone-500" />
                  <span>Subir Foto</span>
                </button>
              </div>
            </div>
          ) : (
            /* Vista previa de imagen + escaneo en progreso o resultados */
            <div className="space-y-4">
              <div className="relative rounded-2xl overflow-hidden border border-stone-200 bg-stone-950 max-h-56 flex items-center justify-center">
                <img
                  src={selectedImage}
                  alt="Ingredientes escaneados"
                  className="w-full h-full object-cover max-h-56 opacity-90"
                />

                {isAnalyzing && (
                  <div className="absolute inset-0 bg-stone-950/60 backdrop-blur-xs flex flex-col items-center justify-center text-white p-4 space-y-3">
                    <div className="w-10 h-10 border-4 border-amber-400 border-t-transparent rounded-full animate-spin" />
                    <div className="text-center">
                      <div className="font-bold text-sm text-amber-300 flex items-center justify-center gap-1.5">
                        <Sparkles className="w-4 h-4 animate-pulse" />
                        <span>Analizando tu refrigerador...</span>
                      </div>
                      <p className="text-[11px] text-stone-300 mt-0.5">
                        Identificando alimentos y diseñando recetas de 10 minutos
                      </p>
                    </div>
                  </div>
                )}

                {!isAnalyzing && (
                  <button
                    onClick={() => {
                      setSelectedImage(null);
                      setScanResult(null);
                    }}
                    className="absolute top-2 right-2 px-2.5 py-1 bg-stone-900/80 hover:bg-stone-900 text-white text-[11px] font-bold rounded-lg backdrop-blur-xs flex items-center gap-1 transition"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Tomar otra</span>
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

              {/* Resultados del Escaneo */}
              {scanResult && !isAnalyzing && (
                <div className="space-y-4 animate-fade-in">
                  {/* Ingredientes reconocidos */}
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

                  {/* Platos sugeridos */}
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-stone-500 mb-2">
                      2 Platos que puedes preparar ya (sin complicaciones):
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
                            onClick={() => handleConvertAndCook(dish)}
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
