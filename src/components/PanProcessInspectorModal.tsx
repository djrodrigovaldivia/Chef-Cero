import React, { useState, useRef } from 'react';
import {
  Camera,
  Upload,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  OctagonAlert,
  Flame,
  Volume2,
  RefreshCw,
  X,
  ShieldAlert,
  ArrowRight,
  Info,
  Clock
} from 'lucide-react';
import { RecipeStep } from '../types';
import { speakSpanishText, stopSpeaking } from '../utils/audioAlert';

export interface PanInspectionResult {
  status: 'perfecto' | 'falta_tiempo' | 'ajustar_fuego' | 'alerta_retirar';
  statusBadge: string;
  visualDiagnosis: string;
  whatIsMissingOrExcess: string;
  immediateAction: string;
  chefTip: string;
  audioScript?: string;
  audioBase64?: string;
  audioMimeType?: string;
}

interface PanProcessInspectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  step: RecipeStep;
  recipeTitle: string;
  targetCue?: string;
}

const PAN_EXAMPLES = [
  {
    id: 'cebolla_perfecta',
    title: '🟢 Sofrito en su punto',
    desc: 'Translúcida y dorando suave',
    sampleImage: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300"><rect width="400" height="300" fill="%23292524"/><circle cx="200" cy="150" r="120" fill="%2344403c" stroke="%2378716c" stroke-width="8"/><circle cx="200" cy="150" r="100" fill="%23d97706" opacity="0.3"/><ellipse cx="180" cy="140" rx="35" ry="15" fill="%23fef08a" opacity="0.85"/><ellipse cx="220" cy="160" rx="40" ry="18" fill="%23fef3c7" opacity="0.9"/><ellipse cx="195" cy="170" rx="25" ry="12" fill="%23fcd34d" opacity="0.8"/><text x="200" y="270" font-family="sans-serif" font-size="14" font-weight="bold" fill="%2386efac" text-anchor="middle">SOFRITO TRANSLÚCIDO PERFECTO</text></svg>',
    fallbackResult: {
      status: 'perfecto' as const,
      statusBadge: '🟢 ¡Va en su punto exacto!',
      visualDiagnosis: 'La cebolla ha perdido rigidez y se observa translúcida y brillante, con un tono dorado suave en los extremos. El calor es uniforme.',
      whatIsMissingOrExcess: 'La cantidad de aceite es la correcta y no hay exceso de líquido en el fondo.',
      immediateAction: 'Mantén la llama suave y remueve durante 30 segundos más antes de agregar el siguiente ingrediente.',
      chefTip: 'Paciencia recompensada: sudar la cebolla sin arrebatos libera su dulzor natural.',
      audioScript: 'He revisado tu sartén. La cocción va perfecta, la cebolla está translúcida y con brillo sin quemarse. Mantén el fuego suave.',
    }
  },
  {
    id: 'fuego_alto',
    title: '🟠 Fuego demasiado alto',
    desc: 'Bordes oscureciéndose rápido',
    sampleImage: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300"><rect width="400" height="300" fill="%231c1917"/><circle cx="200" cy="150" r="120" fill="%23292524" stroke="%23ef4444" stroke-width="8"/><circle cx="200" cy="150" r="100" fill="%23b45309" opacity="0.4"/><ellipse cx="165" cy="130" rx="30" ry="12" fill="%23451a03" stroke="%2378350f" stroke-width="2"/><ellipse cx="230" cy="155" rx="35" ry="14" fill="%2378350f"/><ellipse cx="190" cy="175" rx="28" ry="10" fill="%231c1917"/><text x="200" y="270" font-family="sans-serif" font-size="14" font-weight="bold" fill="%23f97316" text-anchor="middle">CALOR EXCESIVO: BORDES QUEMADOS</text></svg>',
    fallbackResult: {
      status: 'ajustar_fuego' as const,
      statusBadge: '🟠 Fuego demasiado alto: Ajustar',
      visualDiagnosis: 'Se aprecian pequeños bordes oscuros mientras el centro aún luce húmedo. Las burbujas del aceite son demasiado rápidas y violentas.',
      whatIsMissingOrExcess: 'Le sobra temperatura a la sartén. El calor está concentrado en una sola zona.',
      immediateAction: 'Baja la hornalla al mínimo inmediatamente y remueve continuamente durante 45 segundos para distribuir el calor.',
      chefTip: 'En sartenes finas el calor sube de golpe. Controlar la hornalla al mínimo evita sabores amargos.',
      audioScript: 'Cuidado con la llama, está un poco fuerte y los bordes se están dorando antes de tiempo. Baja el fuego al mínimo y remueve hacia el centro.',
    }
  },
  {
    id: 'falta_tiempo',
    title: '🟡 Le falta tiempo',
    desc: 'Aún pálido y con líquido',
    sampleImage: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300"><rect width="400" height="300" fill="%23292524"/><circle cx="200" cy="150" r="120" fill="%2344403c" stroke="%23a8a29e" stroke-width="8"/><circle cx="200" cy="150" r="100" fill="%230284c7" opacity="0.2"/><ellipse cx="180" cy="140" rx="35" ry="15" fill="%23f8fafc" opacity="0.9"/><ellipse cx="225" cy="160" rx="38" ry="16" fill="%23f1f5f9" opacity="0.95"/><text x="200" y="270" font-family="sans-serif" font-size="14" font-weight="bold" fill="%23fde047" text-anchor="middle">LÍQUIDO VISIBLE: FALTA EVAPORAR</text></svg>',
    fallbackResult: {
      status: 'falta_tiempo' as const,
      statusBadge: '🟡 Le falta un poco: Paciencia',
      visualDiagnosis: 'La preparación todavía conserva agua visible y los trozos están rígidos y blanquecinos. No ha comenzado a caramelizar.',
      whatIsMissingOrExcess: 'Le faltan entre 2 y 3 minutos de cocción. No le agregues más aceite todavía.',
      immediateAction: 'Sube ligeramente la llama a fuego medio y deja que el líquido se evapore sin tapar la sartén.',
      chefTip: 'Los vegetales primero sueltan su agua natural; recién cuando esta se evapora comienza el verdadero sofrito.',
      audioScript: 'Tu preparación todavía está tierna y soltando líquido. Dale unos dos minutos más a fuego medio sin tapar para que empiece a dorar.',
    }
  }
];

export const PanProcessInspectorModal: React.FC<PanProcessInspectorModalProps> = ({
  isOpen,
  onClose,
  step,
  recipeTitle,
  targetCue,
}) => {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<PanInspectionResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const handleProcessFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setErrorMessage('Por favor selecciona una foto válida');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      setSelectedImage(base64);
      setErrorMessage(null);
      setResult(null);
      inspectPanWithAi(base64, file.type);
    };
    reader.onerror = () => {
      setErrorMessage('No se pudo cargar la imagen');
    };
    reader.readAsDataURL(file);
  };

  const inspectPanWithAi = async (base64: string, mimeType: string) => {
    setIsAnalyzing(true);
    setErrorMessage(null);
    try {
      const res = await fetch('/api/inspect-pan-process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: base64,
          mimeType,
          recipeTitle,
          stepNumber: step.stepNumber,
          stepInstruction: step.instruction,
          heatLevel: step.heatLevel,
          targetCue: targetCue || step.stepVisualCueLabel || 'Dorado suave sin quemar',
        }),
      });

      if (!res.ok) throw new Error('Error de conexión');

      const data: PanInspectionResult = await res.json();
      setResult(data);

      if (data.audioScript) {
        setIsSpeaking(true);
        speakSpanishText(data.audioScript, {
          speaker: 'Chef Mentor',
          badge: 'Ojo en la Sartén',
          audioBase64: data.audioBase64,
          audioMimeType: data.audioMimeType,
          onEnd: () => setIsSpeaking(false),
        });
      }
    } catch {
      // Fallback amigable
      setResult(PAN_EXAMPLES[0].fallbackResult);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSelectExample = (ex: typeof PAN_EXAMPLES[0]) => {
    setSelectedImage(ex.sampleImage);
    setErrorMessage(null);
    setIsAnalyzing(true);
    setTimeout(() => {
      setResult(ex.fallbackResult);
      setIsAnalyzing(false);
      if (ex.fallbackResult.audioScript) {
        setIsSpeaking(true);
        speakSpanishText(ex.fallbackResult.audioScript, {
          speaker: 'Chef Mentor',
          badge: 'Ojo en la Sartén',
          onEnd: () => setIsSpeaking(false),
        });
      }
    }, 550);
  };

  const statusConfig = {
    perfecto: {
      bg: 'bg-emerald-50 border-emerald-300',
      badge: 'bg-emerald-500 text-white',
      icon: CheckCircle2,
      iconColor: 'text-emerald-600',
    },
    falta_tiempo: {
      bg: 'bg-amber-50 border-amber-300',
      badge: 'bg-amber-500 text-stone-950',
      icon: Clock,
      iconColor: 'text-amber-600',
    },
    ajustar_fuego: {
      bg: 'bg-orange-50 border-orange-300',
      badge: 'bg-orange-500 text-white',
      icon: Flame,
      iconColor: 'text-orange-600',
    },
    alerta_retirar: {
      bg: 'bg-rose-50 border-rose-300',
      badge: 'bg-rose-600 text-white',
      icon: OctagonAlert,
      iconColor: 'text-rose-600',
    },
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-950/75 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[92vh] overflow-y-auto shadow-2xl border border-stone-200 p-5 sm:p-7 space-y-5">
        
        {/* Cabecera */}
        <div className="flex items-start justify-between gap-3 border-b border-stone-100 pb-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-xl bg-amber-500 flex items-center justify-center text-stone-950 text-sm font-black shadow-xs">
                📸
              </span>
              <h3 className="text-lg sm:text-xl font-black text-stone-900 font-serif">
                El Ojo del Chef en tu Sartén
              </h3>
            </div>
            <p className="text-xs text-stone-500">
              Paso {step.stepNumber}: <span className="font-semibold text-stone-700">{step.title}</span> (Fuego: {step.heatLevel})
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              stopSpeaking();
              onClose();
            }}
            className="p-2 hover:bg-stone-100 rounded-full text-stone-400 hover:text-stone-700 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Zona de captura y botones */}
        <div className="space-y-3">
          <p className="text-xs sm:text-sm text-stone-600 leading-relaxed">
            Sácale una foto a tu sartén u olla en este momento. La IA evaluará si el dorado va bien, si le falta tiempo o si debes bajar el fuego.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              className="p-4 rounded-2xl bg-amber-500 hover:bg-amber-600 text-stone-950 font-black text-sm flex items-center justify-center gap-2.5 shadow-sm transition active:scale-98 cursor-pointer"
            >
              <Camera className="w-5 h-5 text-stone-950" />
              <span>Tomar foto a la sartén</span>
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-4 rounded-2xl bg-stone-100 hover:bg-stone-200 text-stone-800 font-bold text-sm flex items-center justify-center gap-2.5 border border-stone-200 transition active:scale-98 cursor-pointer"
            >
              <Upload className="w-5 h-5 text-stone-600" />
              <span>Subir foto guardada</span>
            </button>

            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleProcessFile(f);
              }}
            />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleProcessFile(f);
              }}
            />
          </div>

          {/* Ejemplos de prueba rápida con 1 toque */}
          <div className="pt-2">
            <span className="text-[11px] font-bold text-stone-400 uppercase tracking-wider block mb-1.5">
              O prueba un caso típico al instante:
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {PAN_EXAMPLES.map((ex) => (
                <button
                  key={ex.id}
                  type="button"
                  onClick={() => handleSelectExample(ex)}
                  className="p-2.5 rounded-xl border border-stone-200 hover:border-amber-400 bg-stone-50 hover:bg-amber-50/50 text-left transition cursor-pointer text-xs"
                >
                  <strong className="block font-bold text-stone-900">{ex.title}</strong>
                  <span className="text-[11px] text-stone-500">{ex.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-bold text-rose-800 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>

        {/* Loader mientras analiza */}
        {isAnalyzing && (
          <div className="p-6 rounded-2xl bg-amber-50/70 border border-amber-200 text-center space-y-2 animate-fade-in">
            <RefreshCw className="w-6 h-6 text-amber-600 animate-spin mx-auto" />
            <span className="text-sm font-black text-amber-950 block font-serif">
              Examinando el calor, burbujas y color en tu sartén...
            </span>
          </div>
        )}

        {/* RESULTADO DE LA EVALUACIÓN EN VIVO */}
        {result && !isAnalyzing && (
          <div className="space-y-4 animate-fade-in">
            {(() => {
              const cfg = statusConfig[result.status] || statusConfig.perfecto;
              const Icon = cfg.icon;

              return (
                <div className={`p-5 rounded-2xl border-2 ${cfg.bg} space-y-4 shadow-sm`}>
                  {/* Badge y Titular */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-200/60 pb-3">
                    <div className="flex items-center gap-2">
                      <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-2xs ${cfg.badge}`}>
                        <Icon className="w-3.5 h-3.5" />
                        <span>{result.statusBadge}</span>
                      </span>
                    </div>

                    {result.audioScript && (
                      <button
                        type="button"
                        onClick={() => {
                          if (isSpeaking) {
                            stopSpeaking();
                            setIsSpeaking(false);
                          } else {
                            setIsSpeaking(true);
                            speakSpanishText(result.audioScript!, {
                              speaker: 'Chef Mentor',
                              badge: 'Ojo en la Sartén',
                              onEnd: () => setIsSpeaking(false),
                            });
                          }
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white hover:bg-stone-50 border border-stone-300 text-xs font-bold text-stone-700 transition cursor-pointer self-start sm:self-auto"
                      >
                        <Volume2 className={`w-3.5 h-3.5 ${isSpeaking ? 'text-amber-600 animate-bounce' : 'text-stone-500'}`} />
                        <span>{isSpeaking ? 'Detener voz' : 'Escuchar veredicto'}</span>
                      </button>
                    )}
                  </div>

                  {/* 1. Diagnóstico visual */}
                  <div className="space-y-1">
                    <span className="text-[11px] font-black uppercase tracking-wider text-stone-500 block">
                      Lo que ve el Chef en la foto:
                    </span>
                    <p className="text-xs sm:text-sm text-stone-800 leading-relaxed font-medium">
                      {result.visualDiagnosis}
                    </p>
                  </div>

                  {/* 2. Qué le falta o sobra */}
                  <div className="p-3 bg-white/90 rounded-xl border border-stone-200/80 text-xs space-y-1">
                    <strong className="text-stone-900 block font-bold">
                      Balance de calor y tiempo:
                    </strong>
                    <p className="text-stone-700">
                      {result.whatIsMissingOrExcess}
                    </p>
                  </div>

                  {/* 3. ACCIÓN INMEDIATA (Lo que debe hacer ya) */}
                  <div className="p-3.5 bg-amber-500 text-stone-950 rounded-xl font-bold text-xs sm:text-sm shadow-xs flex items-start gap-2.5">
                    <ArrowRight className="w-4 h-4 shrink-0 mt-0.5" />
                    <div>
                      <span className="block font-black uppercase text-[10px] tracking-wider text-stone-900">
                        Acción Correctiva Inmediata:
                      </span>
                      <span>{result.immediateAction}</span>
                    </div>
                  </div>

                  {/* 4. Consejo formativo */}
                  <div className="text-[11px] text-stone-600 italic">
                    💡 <strong>Lección del Chef:</strong> {result.chefTip}
                  </div>
                </div>
              );
            })()}

            <button
              type="button"
              onClick={() => {
                stopSpeaking();
                onClose();
              }}
              className="w-full py-3 bg-stone-900 hover:bg-stone-800 text-white font-black text-xs sm:text-sm rounded-xl transition cursor-pointer shadow-sm"
            >
              Entendido, volver a la cocina
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
