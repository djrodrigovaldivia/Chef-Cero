import React, { useState } from 'react';
import {
  Link,
  FileText,
  Sparkles,
  X,
  RefreshCw,
  ChefHat,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Utensils
} from 'lucide-react';
import { Recipe } from '../types';

interface RecipeImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRecipeImported: (recipe: Recipe) => void;
}

const SAMPLE_MESSY_TEXT = `
Hola a todos! El fin de semana pasado estuve recordando las vacaciones en la casa de mi abuela en el campo cuando el olor a cebollita frita inundaba toda la casa a las 11 de la mañana. Me puse a buscar en mi viejo cuaderno y encontré su receta de Pollo al Limón Fácil. A mis hijos les fascina.

Ingredientes que vas a necesitar:
- 2 pechugas de pollo cortadas en cubitos
- El jugo de 1 limón grande
- 2 dientes de ajo picaditos finos
- 2 cucharadas de aceite de oliva
- Sal y pimienta a gusto
- 1 ramita de perejil picado para decorar

Preparación:
Primero marina el pollo con el jugo de limón, sal y pimienta unos 10 minutos. Luego calienta la sartén con el aceite y pon a dorar los ajitos sin que se quemen. Agrega el pollo y cocina unos 8 minutos hasta que esté bien doradito y jugoso. Sirve con el perejil por encima.
`;

export const RecipeImportModal: React.FC<RecipeImportModalProps> = ({
  isOpen,
  onClose,
  onRecipeImported,
}) => {
  const [rawText, setRawText] = useState('');
  const [isCleaning, setIsCleaning] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCleanAndImport = async (textToProcess: string) => {
    if (!textToProcess.trim()) {
      setErrorMessage('Por favor pega el enlace o texto de la receta');
      return;
    }

    setIsCleaning(true);
    setErrorMessage(null);
    try {
      const res = await fetch('/api/recipe/clean-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawContent: textToProcess }),
      });

      if (!res.ok) throw new Error('Error al limpiar');

      const data = await res.json();
      if (!data || !data.title || !data.steps) {
        throw new Error('Respuesta inválida');
      }

      const cleanRecipe: Recipe = {
        id: 'import-' + Date.now(),
        title: data.title,
        description: data.description || 'Receta importada y simplificada para principiantes.',
        servings: data.servings || 2,
        totalTimeMinutes: data.totalTimeMinutes || 15,
        difficulty: (data.difficulty as any) || 'Principiante Total',
        requiredLevel: 1,
        learningGoal: `Dominar la preparación de ${data.title} con mise en place ordenado`,
        cuisine: 'economica_bbb',
        cuisineName: 'Receta Importada & Limpia',
        countryFlag: '📋',
        isBudgetFriendly: true,
        imageUrl: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80',
        safetyAlerts: data.safetyAlerts || [
          'Ten todos los platitos medidos antes de encender el fuego.',
          'Si la sartén humea, baja la llama inmediatamente.',
        ],
        miseEnPlace: data.miseEnPlace || [],
        heatGuideExplanation: 'Paso 1 sin fuego para organizar tu mesa con calma.',
        steps: data.steps.map((s: any, idx: number) => ({
          stepNumber: s.stepNumber || idx + 1,
          title: s.title || `Paso ${idx + 1}`,
          instruction: s.instruction,
          heatLevel: s.heatLevel || (idx === 0 ? 'apagado' : 'medio'),
          tip: s.tip || (idx === 0 ? 'Mise en place con hornalla apagada.' : 'Controla la llama.'),
          timerSeconds: s.timerSeconds || undefined,
          timerLabel: s.timerLabel || undefined,
        })),
      };

      onRecipeImported(cleanRecipe);
      onClose();
    } catch {
      setErrorMessage('No pudimos extraer la receta. Verifica el texto o intenta con el ejemplo.');
    } finally {
      setIsCleaning(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-950/75 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl max-w-xl w-full p-5 sm:p-7 shadow-2xl border border-stone-200 space-y-4">
        
        {/* Cabecera */}
        <div className="flex items-start justify-between gap-3 border-b border-stone-100 pb-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-xl bg-amber-100 text-amber-900 flex items-center justify-center text-sm font-black shadow-2xs">
                📋
              </span>
              <h3 className="text-lg sm:text-xl font-black text-stone-900 font-serif">
                Importador y Limpiador de Recetas
              </h3>
            </div>
            <p className="text-xs text-stone-500">
              Inspirado en Paprika: elimina historias de blogs y convierte cualquier receta en pasos sencillos para principiantes.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-stone-100 rounded-full text-stone-400 hover:text-stone-700 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Input Textarea */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-stone-700 block">
            Pega el texto de la receta o la lista de pasos desordenada:
          </label>
          <textarea
            rows={5}
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            placeholder="Pega aquí el texto copiado de un blog, TikTok, Instagram o recetario..."
            className="w-full p-3.5 rounded-2xl border border-stone-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 text-xs sm:text-sm text-stone-800 outline-none resize-none transition"
          />
        </div>

        {/* Botón de probar ejemplo */}
        <div className="flex items-center justify-between text-xs">
          <button
            type="button"
            onClick={() => {
              setRawText(SAMPLE_MESSY_TEXT);
              handleCleanAndImport(SAMPLE_MESSY_TEXT);
            }}
            className="text-amber-800 hover:text-amber-950 font-bold underline transition cursor-pointer"
          >
            Probar con receta de blog desordenada (Ejemplo)
          </button>
        </div>

        {errorMessage && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-bold text-rose-800 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Botón principal */}
        <button
          type="button"
          disabled={!rawText.trim() || isCleaning}
          onClick={() => handleCleanAndImport(rawText)}
          className="w-full py-3.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-stone-950 font-black text-sm rounded-2xl flex items-center justify-center gap-2 shadow-xs transition active:scale-98 cursor-pointer"
        >
          {isCleaning ? (
            <>
              <RefreshCw className="w-4 h-4 text-stone-950 animate-spin" />
              <span>Limpiando y traduciendo a pasos de novato...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 text-stone-950" />
              <span>Limpiar y Cocinar Paso a Paso</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
