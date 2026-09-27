import React, { useState } from 'react';
import { X, Sparkles, RefreshCw, ChefHat, Check, ArrowRight } from 'lucide-react';
import { findInstantSubstitutes, InstantSubstitute } from '../utils/smartSubstitutions';

interface IngredientSubstituteDrawerProps {
  ingredientText: string;
  userLevel: number;
  recipeTitle?: string;
  onClose: () => void;
  onSelectSubstitute?: (substituteName: string) => void;
}

export const IngredientSubstituteDrawer: React.FC<IngredientSubstituteDrawerProps> = ({
  ingredientText,
  userLevel,
  recipeTitle,
  onClose,
  onSelectSubstitute,
}) => {
  const instantMatch = findInstantSubstitutes(ingredientText);
  const [customQuery, setCustomQuery] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<{
    substitute: string;
    ratio: string;
    whyItWorks: string;
  } | null>(null);

  const handleAskAiSubstitute = async () => {
    setAiLoading(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `¿Con qué puedo sustituir "${ingredientText}" en la receta "${recipeTitle || 'plato casero'}"? Dame 1 sustituto directo de alacena, la proporción exacta y por qué funciona. Responde en 3 líneas directas.`,
          userProfile: { level: userLevel, name: 'Aprendiz' },
        }),
      });
      const data = await res.json();
      if (data && data.reply) {
        setAiResult({
          substitute: 'Alternativa sugerida por el Chef Mentor',
          ratio: 'Ajuste proporcional al gusto',
          whyItWorks: data.reply,
        });
      }
    } catch {
      setAiResult({
        substitute: 'Aceite vegetal o caldo suave',
        ratio: '1:1 en proporción',
        whyItWorks: 'Aporta la humedad o grasa base sin alterar la textura principal.',
      });
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-stone-950/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-stone-200 overflow-hidden space-y-0 animate-scale-up"
      >
        {/* Cabecera */}
        <div className="bg-gradient-to-r from-amber-500 to-orange-500 p-4 text-stone-950 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-white/25 flex items-center justify-center font-bold">
              ⇄
            </div>
            <div>
              <h3 className="font-bold text-sm font-serif">Sustituto de Alacena</h3>
              <p className="text-[11px] text-stone-900/80">
                Cocina con lo que tienes a mano sin salir a comprar
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-black/10 text-stone-900 transition"
            aria-label="Cerrar modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Ingrediente original */}
          <div className="p-3 bg-stone-100 rounded-xl flex items-center justify-between text-xs text-stone-800">
            <span className="text-stone-500 font-medium">Ingrediente en la receta:</span>
            <strong className="text-stone-950 font-bold">{ingredientText}</strong>
          </div>

          {/* Opciones instantáneas del catálogo */}
          {instantMatch ? (
            <div className="space-y-3">
              <div className="text-xs font-bold text-stone-600 uppercase tracking-wider flex items-center gap-1.5">
                <ChefHat className="w-3.5 h-3.5 text-amber-600" />
                <span>Reemplazos recomendados al instante:</span>
              </div>

              {instantMatch.options.map((opt, i) => (
                <div
                  key={i}
                  className="p-3.5 rounded-2xl border border-amber-200/80 bg-amber-50/60 hover:bg-amber-50 transition space-y-1.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-xs sm:text-sm font-bold text-amber-950 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                      {opt.name}
                    </h4>
                    {onSelectSubstitute && (
                      <button
                        onClick={() => {
                          onSelectSubstitute(opt.name);
                          onClose();
                        }}
                        className="px-2 py-0.5 rounded-md bg-amber-500 hover:bg-amber-600 text-stone-950 font-bold text-[10px] shrink-0"
                      >
                        Usar este
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-stone-800 font-medium">
                    <strong className="text-amber-900">Medida: </strong>
                    {opt.ratio}
                  </p>
                  <p className="text-[11px] text-stone-600 leading-tight">
                    <em>{opt.whyItWorks}</em>
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 text-center space-y-2">
              <p className="text-xs text-stone-600">
                No tenemos un reemplazo pregrabado para este ingrediente específico, pero nuestro Chef
                Mentor puede dártelo de inmediato.
              </p>
            </div>
          )}

          {/* Resultado de IA si se consultó */}
          {aiResult && (
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300 space-y-2 animate-fade-in">
              <div className="flex items-center gap-1.5 text-amber-950 text-xs font-bold">
                <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                <span>Respuesta del Chef Mentor:</span>
              </div>
              <p className="text-xs text-stone-800 whitespace-pre-line leading-relaxed">
                {aiResult.whyItWorks}
              </p>
            </div>
          )}

          {/* Botón para pedir más opciones al Chef IA */}
          <div className="pt-2 border-t border-stone-100 flex items-center justify-between gap-2">
            <button
              onClick={handleAskAiSubstitute}
              disabled={aiLoading}
              className="w-full py-2.5 px-4 bg-stone-900 hover:bg-stone-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer shadow-xs"
            >
              {aiLoading ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-400" />
                  <span>Consultando al Chef Mentor...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>Preguntar otra alternativa al Chef</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
