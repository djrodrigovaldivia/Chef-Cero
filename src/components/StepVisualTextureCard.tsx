import React, { useState } from 'react';
import {
  Camera,
  Eye,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  Palette,
  Flame,
  Volume2,
  ChevronDown,
  ChevronUp,
  RotateCcw
} from 'lucide-react';
import { RecipeStep, VisualTextureCue } from '../types';
import { speakSpanishText } from '../utils/audioAlert';

interface StepVisualTextureCardProps {
  step: RecipeStep;
  recipeTitle: string;
  recipeImageUrl?: string;
  onAskChefVisual: (contextQuery: string) => void;
}

// Infiere dinámicamente el marcador visual de textura y color si la receta no lo trae predefinido
export function deriveVisualTextureCue(step: RecipeStep, recipeTitle: string): VisualTextureCue {
  if (step.visualCue) {
    return step.visualCue;
  }

  const text = `${step.title} ${step.instruction} ${recipeTitle}`.toLowerCase();
  const heat = step.heatLevel;

  // 1. Sofritos / Cebolla / Ajo
  if (text.includes('cebolla') || text.includes('sofrito') || text.includes('sudar') || text.includes('ajo')) {
    return {
      colorName: 'Translúcido brillante / Dorado muy tenue',
      colorHex: '#FEF08A',
      accentHex: '#F59E0B',
      textureDescription: 'Tierno, brillante y jugoso; la cebolla pierde rigidez y se vuelve flexible sin quemarse.',
      donenessCheck: 'La cebolla se ve casi transparente y no rechina en la sartén. Si el ajo está, debe estar amarillo pálido, nunca marrón.',
      visualWarning: 'Si ves bordes negros o café oscuro, la hornilla está demasiado fuerte. Aparta la sartén 30 segundos.',
    };
  }

  // 2. Huevos revueltos / Tortillas
  if (text.includes('huevo') || text.includes('revuelto') || text.includes('tortilla') || text.includes('yema')) {
    return {
      colorName: 'Amarillo cremoso satinado (sin dorado)',
      colorHex: '#FDE047',
      accentHex: '#FBBF24',
      textureDescription: 'Ondulaciones suaves, húmedas y elásticas, parecidas a natillas tiernas.',
      donenessCheck: 'Al inclinar la sartén el huevo ya no es líquido suelto, pero la superficie todavía brilla húmeda.',
      visualWarning: 'Si adquiere costra dorada o marrón, el huevo se secará rápidamente. Apaga el fuego inmediatamente.',
    };
  }

  // 3. Sellado de carnes / Pollo / Hamburguesas
  if (text.includes('carne') || text.includes('pollo') || text.includes('sellar') || text.includes('dorar') || text.includes('pechuga')) {
    return {
      colorName: 'Costra dorada caramelo / Bronce uniforme',
      colorHex: '#B45309',
      accentHex: '#D97706',
      textureDescription: 'Superficie firme y crujiente que retiene los jugos en el centro; no pegada a la sartén.',
      donenessCheck: 'La pieza se despega sola de la sartén con la espátula sin romperse. Si se resiste, dale 30 segundos más.',
      visualWarning: 'No pinches la carne con un tenedor para que no pierda sus jugos internos.',
    };
  }

  // 4. Arroz / Fideos / Granos
  if (text.includes('arroz') || text.includes('pasta') || text.includes('fideo') || text.includes('grano')) {
    return {
      colorName: 'Blanco perlado sin brillo de agua',
      colorHex: '#F3F4F6',
      accentHex: '#E5E7EB',
      textureDescription: 'Granos sueltos, hinchados y tiernos al morder pero con estructura firme.',
      donenessCheck: 'Se forman hoyitos o cráteres en la superficie del arroz y no queda charco visible en el fondo.',
      visualWarning: 'No revuelvas el arroz con cuchara durante la cocción o soltará almidón y quedará pegajoso.',
    };
  }

  // 5. Papas / Frituras / Crocantes
  if (text.includes('papa') || text.includes('patata') || text.includes('freír') || text.includes('crujiente') || text.includes('crocante')) {
    return {
      colorName: 'Dorado ámbar crujiente',
      colorHex: '#F59E0B',
      accentHex: '#D97706',
      textureDescription: 'Corteza rígida y arenosa que suena al rozar la espátula; centro suave y vaporoso.',
      donenessCheck: 'Las burbujas del aceite se vuelven más finas y la papa flota ligeramente.',
      visualWarning: 'Si el aceite humea, está a más de 190°C y quemará las papas por fuera dejándolas crudas por dentro.',
    };
  }

  // 6. Salsas / Tomate / Reducciones
  if (text.includes('salsa') || text.includes('tomate') || text.includes('reducir') || text.includes('sofrito rojo')) {
    return {
      colorName: 'Rojo rubí profundo y aterciopelado',
      colorHex: '#DC2626',
      accentHex: '#B91C1C',
      textureDescription: 'Untuosa y espesa, napa el dorso de una cuchara de madera sin escurrir como agua.',
      donenessCheck: 'Pasa la cuchara por el centro de la olla: debe verse el fondo durante 1 o 2 segundos antes de juntarse.',
      visualWarning: 'Si salpica violentamente hacia fuera, baja la llama a mínimo y tapa semi-abierto.',
    };
  }

  // 7. Mise en place / Corte / Apagado
  if (heat === 'apagado' || text.includes('cortar') || text.includes('picar') || text.includes('medir') || text.includes('platito')) {
    return {
      colorName: 'Ingredientes frescos y vivos en platitos limpios',
      colorHex: '#10B981',
      accentHex: '#059669',
      textureDescription: 'Cortes limpios y de tamaño uniforme para que se cocinen al mismo tiempo.',
      donenessCheck: 'Todos los ingredientes medidos al alcance de la mano con la estufa 100% apagada.',
      visualWarning: 'Nunca prendas el fuego si todavía estás picando sobre la tabla de cortar.',
    };
  }

  // Default equilibrado
  return {
    colorName: 'Tono dorado suave y natural',
    colorHex: '#F59E0B',
    accentHex: '#D97706',
    textureDescription: 'Cocción homogénea, brillante y tierna sin zonas resecas.',
    donenessCheck: 'Comprueba el aroma dulce del vapor y que la comida no esté pegada al fondo.',
    visualWarning: 'Mantén el fuego moderado para conservar el control total de la preparación.',
  };
}

export const StepVisualTextureCard: React.FC<StepVisualTextureCardProps> = ({
  step,
  recipeTitle,
  recipeImageUrl,
  onAskChefVisual,
}) => {
  const [imageError, setImageError] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [showDetailedGuide, setShowDetailedGuide] = useState(false);

  const visualCue = deriveVisualTextureCue(step, recipeTitle);
  const rawImageUrl = step.stepImageUrl || recipeImageUrl;
  const hasValidImage = rawImageUrl && !imageError;

  const handleConfirmVisual = () => {
    setIsConfirmed(true);
    speakSpanishText('¡Punto visual verificado con éxito! Tu preparación luce genial.', {
      speaker: 'Chef Cero',
      badge: 'Control Visual',
    });
  };

  const handleAskChef = () => {
    const query = `Chef, en este paso ${step.stepNumber} de ${step.title}: ¿cómo debe verse exactamente el color "${visualCue.colorName}" y la textura "${visualCue.textureDescription}" en mi sartén?`;
    onAskChefVisual(query);
  };

  return (
    <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-xs space-y-0 transition-all">
      {/* Cabecera del Marcador Visual */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 px-4 bg-stone-50 border-b border-stone-200/80 gap-2">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center text-amber-800">
            <Palette className="w-4 h-4" />
          </div>
          <div>
            <span className="text-xs font-black text-stone-900 uppercase tracking-wider block">
              Marcador de Textura y Color (Paso {step.stepNumber})
            </span>
            <span className="text-[11px] text-stone-500">
              Guía del asistente para saber el punto exacto de cocción con tus ojos
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {/* Swatch de color en vivo */}
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border shadow-2xs"
            style={{
              backgroundColor: visualCue.colorHex ? `${visualCue.colorHex}22` : '#FEF3C7',
              borderColor: visualCue.colorHex || '#F59E0B',
              color: '#451A03',
            }}
            title={`Tono objetivo: ${visualCue.colorName}`}
          >
            <span
              className="w-3 h-3 rounded-full border border-black/20 shrink-0"
              style={{ backgroundColor: visualCue.colorHex || '#F59E0B' }}
            />
            <span className="truncate max-w-[130px] sm:max-w-none">{visualCue.colorName}</span>
          </div>

          <button
            type="button"
            onClick={() => setShowDetailedGuide(!showDetailedGuide)}
            className="p-1.5 text-stone-500 hover:text-stone-800 rounded-lg hover:bg-stone-200/60 transition cursor-pointer"
            title="Expandir/colapsar detalles de textura"
          >
            {showDetailedGuide ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* ZONA DE IMAGEN O MARCADOR DINÁMICO DE REEMPLAZO (PLACEHOLDER DE TEXTURA) */}
      <div className="relative overflow-hidden bg-stone-950">
        {hasValidImage ? (
          <div className="relative h-48 sm:h-60 w-full group">
            <img
              src={rawImageUrl}
              alt={`Aspecto visual de ${step.title}`}
              onError={() => setImageError(true)}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 opacity-95"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-stone-950/80 via-transparent to-black/20 pointer-events-none" />

            {/* Etiqueta flotante sobre la foto real */}
            <div className="absolute bottom-2.5 left-2.5 right-2.5 bg-stone-950/85 backdrop-blur-xs text-white p-3 rounded-xl border border-white/15 flex items-start gap-2.5">
              <Eye className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div className="text-xs leading-snug">
                <strong className="block text-amber-300 font-bold mb-0.5">
                  {step.stepVisualCueLabel || visualCue.colorName}
                </strong>
                <span className="text-stone-200 font-medium">
                  {visualCue.textureDescription}
                </span>
              </div>
            </div>
          </div>
        ) : (
          /* MARCADOR DINÁMICO DE TEXTURA Y COLOR (Cuando no hay foto o falló la carga) */
          <div
            className="relative h-48 sm:h-56 w-full p-5 flex flex-col justify-between overflow-hidden text-white"
            style={{
              background: `linear-gradient(135deg, ${visualCue.colorHex || '#B45309'} 0%, ${visualCue.accentHex || '#1C1917'} 100%)`,
            }}
          >
            {/* Patrón estético culinario de fondo */}
            <div
              className="absolute inset-0 opacity-15 pointer-events-none"
              style={{
                backgroundImage: 'radial-gradient(circle at 20% 50%, white 1.5px, transparent 2px), radial-gradient(circle at 80% 30%, white 1px, transparent 1.5px)',
                backgroundSize: '24px 24px',
              }}
            />

            <div className="relative z-10 flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider bg-black/40 backdrop-blur-xs px-2.5 py-1 rounded-md border border-white/20 flex items-center gap-1.5">
                <Camera className="w-3 h-3 text-amber-300" />
                <span>Simulador Visual del Asistente</span>
              </span>

              <span className="text-[11px] font-bold bg-white/20 backdrop-blur-xs px-2.5 py-0.5 rounded-full border border-white/30">
                Paso {step.stepNumber} • {step.heatLevel === 'apagado' ? 'Estufa Apagada' : `Fuego ${step.heatLevel.toUpperCase()}`}
              </span>
            </div>

            <div className="relative z-10 space-y-1.5 my-auto py-2">
              <span className="text-xs text-amber-200 uppercase tracking-widest font-black block">
                Tono y Textura Objetivo:
              </span>
              <h4 className="text-lg sm:text-xl font-black font-serif tracking-tight drop-shadow-sm">
                {visualCue.colorName}
              </h4>
              <p className="text-xs text-stone-100 max-w-xl leading-relaxed opacity-95">
                {visualCue.textureDescription}
              </p>
            </div>

            <div className="relative z-10 flex items-center justify-between pt-2 border-t border-white/20 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-white/90">Prueba con espátula:</span>
                <span className="text-[11px] text-amber-200 italic">{visualCue.donenessCheck}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* PANEL DE CONTROL DE TEXTURA Y COLOR DEL ASISTENTE */}
      <div className="p-3.5 sm:p-4 bg-stone-50/70 border-t border-stone-200 space-y-3">
        {/* Fichas rápidas de Comprobación Visual */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
          {/* Ficha 1: Color y Brillo */}
          <div className="p-3 bg-white rounded-xl border border-stone-200 shadow-2xs space-y-1">
            <div className="flex items-center justify-between text-stone-800 font-bold">
              <span className="flex items-center gap-1.5 text-amber-900 uppercase text-[10px] tracking-wider">
                <Eye className="w-3.5 h-3.5 text-amber-600" />
                <span>Color y Apariencia:</span>
              </span>
            </div>
            <p className="text-stone-800 font-bold leading-snug">
              {visualCue.colorName}
            </p>
            <p className="text-[11px] text-stone-500 leading-tight">
              {step.stepVisualCueLabel || 'Compara la tonalidad en el centro y bordes de la sartén.'}
            </p>
          </div>

          {/* Ficha 2: Textura y Tacto con la Cuchara */}
          <div className="p-3 bg-white rounded-xl border border-stone-200 shadow-2xs space-y-1">
            <div className="flex items-center justify-between text-stone-800 font-bold">
              <span className="flex items-center gap-1.5 text-emerald-900 uppercase text-[10px] tracking-wider">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                <span>Textura y Consistencia:</span>
              </span>
            </div>
            <p className="text-stone-800 font-bold leading-snug">
              {visualCue.textureDescription}
            </p>
            <p className="text-[11px] text-stone-500 leading-tight">
              {visualCue.donenessCheck}
            </p>
          </div>
        </div>

        {/* Guía Detallada y Alerta Visual si está expandido o alerta importante */}
        {(showDetailedGuide || visualCue.visualWarning) && (
          <div className="space-y-2 pt-1 animate-fade-in">
            {visualCue.visualWarning && (
              <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-300 text-amber-950 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
                <span>
                  <strong>¡Atención visual!</strong> {visualCue.visualWarning}
                </span>
              </div>
            )}

            {showDetailedGuide && (
              <div className="p-3 bg-white rounded-xl border border-stone-200 text-xs text-stone-700 space-y-1.5">
                <strong className="block text-stone-900">¿Cómo verificar la textura exacta?</strong>
                <p className="text-stone-600 leading-relaxed">
                  Pasa una cuchara de madera o espátula por el fondo de la sartén: {visualCue.donenessCheck}. Si ves humo o un cambio de color abrupto a marrón oscuro, baja el fuego a mínimo o retira la sartén temporalmente.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Botonera interactiva del Asistente */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <button
            type="button"
            onClick={handleAskChef}
            className="px-3 py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-2xs cursor-pointer"
            title="Preguntarle al Chef Cero por voz o chat sobre la textura o color exacto"
          >
            <HelpCircle className="w-3.5 h-3.5 text-amber-400" />
            <span>Preguntar al Chef sobre el color/textura</span>
          </button>

          <button
            type="button"
            onClick={handleConfirmVisual}
            className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer border ${
              isConfirmed
                ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                : 'bg-white hover:bg-emerald-50 text-stone-700 border-stone-300'
            }`}
          >
            <CheckCircle2 className={`w-3.5 h-3.5 ${isConfirmed ? 'text-emerald-700' : 'text-stone-400'}`} />
            <span>{isConfirmed ? '¡Textura y color comprobados! ✓' : 'Confirmar que luce así'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
