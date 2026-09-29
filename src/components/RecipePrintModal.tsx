import React, { useState } from 'react';
import { Recipe } from '../types';
import { Printer, Download, Check, Sparkles, X, Share2, ShieldCheck, Flame, BookOpen, Clock, Users } from 'lucide-react';

interface RecipePrintModalProps {
  recipe: Recipe;
  isOpen: boolean;
  onClose: () => void;
}

export const RecipePrintModal: React.FC<RecipePrintModalProps> = ({
  recipe,
  isOpen,
  onClose,
}) => {
  const [includeSensoryCues, setIncludeSensoryCues] = useState(true);
  const [includeSafetyAlerts, setIncludeSafetyAlerts] = useState(true);
  const [includeSubstitutes, setIncludeSubstitutes] = useState(true);
  const [copiedLink, setCopiedLink] = useState(false);

  if (!isOpen) return null;

  const handleNativePrint = () => {
    window.print();
  };

  const handleExportText = () => {
    let content = `=========================================================\n`;
    content += `CHEF CERO - FICHA TÉCNICA Y RECETA DE COCINA\n`;
    content += `=========================================================\n\n`;
    content += `PLATO: ${recipe.title.toUpperCase()}\n`;
    content += `Dificultad: ${recipe.difficulty} | Porciones: ${recipe.servings} | Tiempo Total: ${recipe.totalTimeMinutes} minutos\n`;
    if (recipe.learningGoal) {
      content += `Meta Pedagógica: ${recipe.learningGoal}\n`;
    }
    content += `\nDESCRIPCIÓN:\n${recipe.description}\n\n`;

    content += `---------------------------------------------------------\n`;
    content += `FASE 1: MISE EN PLACE (TODO MEDIDO CON FUEGO APAGADO)\n`;
    content += `---------------------------------------------------------\n`;
    recipe.miseEnPlace.forEach((item, i) => {
      content += `[ ] ${i + 1}. ${item}\n`;
    });

    if (includeSubstitutes && recipe.pantrySubstitutes && recipe.pantrySubstitutes.length > 0) {
      content += `\nSUSTITUTOS DE DESPENSA INTELIGENTES (BBB):\n`;
      recipe.pantrySubstitutes.forEach((sub) => {
        content += `• Si no tienes "${sub.original}", usa "${sub.substitute}" (${sub.reason})\n`;
      });
    }

    if (includeSafetyAlerts && recipe.safetyAlerts && recipe.safetyAlerts.length > 0) {
      content += `\nREGLAS DE SEGURIDAD Y CONTROL DE FUEGO:\n`;
      recipe.safetyAlerts.forEach((alert) => {
        content += `! ${alert}\n`;
      });
    }

    content += `\n---------------------------------------------------------\n`;
    content += `FASE 2: EN LOS FUEGOS (PASO A PASO SECUENCIAL)\n`;
    content += `---------------------------------------------------------\n`;
    recipe.steps.forEach((step) => {
      content += `PASO ${step.stepNumber}: ${step.title.toUpperCase()}\n`;
      content += `Fuego: ${step.heatLevel.toUpperCase()}${step.timerSeconds ? ` | Tiempo: ${Math.round(step.timerSeconds / 60)} min` : ''}\n`;
      content += `Instrucción: ${step.instruction}\n`;
      content += `Consejo del Chef: ${step.tip}\n`;
      if (includeSensoryCues && step.sensoryCues) {
        if (step.sensoryCues.sound) content += `  -> Sonido: ${step.sensoryCues.sound}\n`;
        if (step.sensoryCues.sight) content += `  -> Vista: ${step.sensoryCues.sight}\n`;
        if (step.sensoryCues.smell) content += `  -> Olor: ${step.sensoryCues.smell}\n`;
      }
      if (step.whyItWorks) {
        content += `  -> Por qué funciona (Ciencia): ${step.whyItWorks}\n`;
      }
      content += `\n`;
    });

    content += `=========================================================\n`;
    content += `Chef Cero - Cocina sin miedo ni quemaduras. https://chefcero.app\n`;

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ChefCero-${recipe.title.toLowerCase().replace(/[^a-z0-9]/g, '-')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleShare = async () => {
    const textToShare = `¡Mira esta receta sin misterio de ${recipe.title} en Chef Cero!`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: recipe.title,
          text: textToShare,
          url: window.location.href,
        });
      } catch (e) {
        // Ignorar si cancela
      }
    } else {
      navigator.clipboard.writeText(`${textToShare} ${window.location.href}`);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-950/80 backdrop-blur-md overflow-y-auto animate-fade-in print:bg-white print:p-0">
      <div className="relative w-full max-w-3xl bg-white border border-stone-200 rounded-3xl shadow-2xl overflow-hidden my-auto text-stone-900 flex flex-col max-h-[90vh] print:max-h-none print:shadow-none print:border-none print:rounded-none">
        
        {/* Header no imprimible */}
        <div className="p-4 sm:p-5 bg-stone-50 border-b border-stone-200 flex items-center justify-between gap-3 shrink-0 print:hidden">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-stone-950 flex items-center justify-center text-xl font-black">
              📄
            </div>
            <div>
              <h3 className="font-extrabold text-base sm:text-lg text-stone-900 font-serif">
                Exportar Ficha de Cocina Limpia
              </h3>
              <p className="text-xs text-stone-500">
                Imprime o guarda en PDF sin anuncios ni elementos de distracción.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-stone-200 text-stone-500 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Barra de opciones de impresión (print:hidden) */}
        <div className="p-3 sm:px-5 bg-amber-50/70 border-b border-amber-200 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0 print:hidden">
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-1.5 cursor-pointer font-medium text-stone-700 select-none">
              <input
                type="checkbox"
                checked={includeSensoryCues}
                onChange={(e) => setIncludeSensoryCues(e.target.checked)}
                className="rounded text-amber-600 focus:ring-amber-500"
              />
              <span>Señales sensoriales (oído, vista, olor)</span>
            </label>

            <label className="flex items-center gap-1.5 cursor-pointer font-medium text-stone-700 select-none">
              <input
                type="checkbox"
                checked={includeSafetyAlerts}
                onChange={(e) => setIncludeSafetyAlerts(e.target.checked)}
                className="rounded text-amber-600 focus:ring-amber-500"
              />
              <span>Alertas de fuego y seguridad</span>
            </label>

            <label className="flex items-center gap-1.5 cursor-pointer font-medium text-stone-700 select-none">
              <input
                type="checkbox"
                checked={includeSubstitutes}
                onChange={(e) => setIncludeSubstitutes(e.target.checked)}
                className="rounded text-amber-600 focus:ring-amber-500"
              />
              <span>Sustitutos económicos</span>
            </label>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={handleExportText}
              className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-800 font-bold rounded-lg transition flex items-center gap-1.5 cursor-pointer"
              title="Descargar archivo .txt sin conexión"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Guardar TXT</span>
            </button>

            <button
              onClick={handleShare}
              className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-800 font-bold rounded-lg transition flex items-center gap-1.5 cursor-pointer"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>{copiedLink ? '¡Enlace Copiado!' : 'Compartir'}</span>
            </button>

            <button
              onClick={handleNativePrint}
              className="px-4 py-1.5 bg-amber-500 hover:bg-amber-600 text-stone-950 font-black rounded-lg transition flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir / Guardar PDF</span>
            </button>
          </div>
        </div>

        {/* Documento Imprimible Real (Ficha Técnica Limpia) */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6 print:p-0 print:space-y-4 font-sans text-stone-900 bg-white">
          
          {/* Header del Recetario */}
          <div className="border-b-2 border-stone-900 pb-4">
            <div className="flex items-center justify-between gap-4 mb-2">
              <span className="text-[11px] font-bold tracking-widest uppercase text-amber-800 font-mono">
                CHEF CERO • FICHA TÉCNICA PASO A PASO
              </span>
              <span className="text-xs font-mono font-bold text-stone-500">
                {recipe.cuisineName || 'Cocina Sin Quemaduras'}
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black font-serif text-stone-950 leading-tight">
              {recipe.title}
            </h1>

            <p className="text-xs sm:text-sm text-stone-600 mt-1 font-serif italic">
              {recipe.description}
            </p>

            {/* Metadatos en pastillas limpias */}
            <div className="flex flex-wrap items-center gap-4 mt-3 text-xs font-mono font-semibold text-stone-700 pt-2 border-t border-stone-200">
              <span className="flex items-center gap-1">
                <Users className="w-3.5 h-3.5 text-stone-500" />
                {recipe.servings} porciones
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-stone-500" />
                {recipe.totalTimeMinutes} minutos totales
              </span>
              <span className="flex items-center gap-1">
                <Flame className="w-3.5 h-3.5 text-amber-600" />
                {recipe.difficulty}
              </span>
              {recipe.estimatedCostLabel && (
                <span className="text-emerald-700 font-bold">
                  {recipe.estimatedCostLabel}
                </span>
              )}
            </div>
          </div>

          {/* Meta Pedagógica */}
          {recipe.learningGoal && (
            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs">
              <strong className="text-amber-900 font-bold">🎯 Meta pedagógica:</strong>{' '}
              <span className="text-stone-800">{recipe.learningGoal}</span>
            </div>
          )}

          {/* FASE 1: Mise en Place (Ingredientes listos antes del fuego) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-stone-300 pb-1.5">
              <h2 className="text-xs font-black uppercase tracking-wider text-stone-900 font-mono flex items-center gap-1.5">
                <span>1. MISE EN PLACE (Fuego Apagado)</span>
              </h2>
              <span className="text-[10px] text-stone-500 italic">
                Ten todo cortado y medido antes de encender la hornalla
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {recipe.miseEnPlace.map((item, idx) => (
                <div key={idx} className="flex items-start gap-2 p-1.5 rounded-lg bg-stone-50 border border-stone-200">
                  <div className="w-4 h-4 rounded border border-stone-400 mt-0.5 shrink-0 flex items-center justify-center font-mono text-[9px] font-bold text-stone-500">
                    {idx + 1}
                  </div>
                  <span className="text-stone-800 font-medium leading-snug">{item}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Sustitutos BBB si están activos */}
          {includeSubstitutes && recipe.pantrySubstitutes && recipe.pantrySubstitutes.length > 0 && (
            <div className="p-3 bg-emerald-50/70 rounded-xl border border-emerald-200 text-xs space-y-1">
              <span className="font-bold text-emerald-900 block text-[11px] uppercase tracking-wider">
                💡 Sustitutos de Despensa Ahorro BBB:
              </span>
              {recipe.pantrySubstitutes.map((sub, i) => (
                <div key={i} className="text-stone-700">
                  • <strong>{sub.original}</strong> → Sustituir por: <strong>{sub.substitute}</strong> ({sub.reason})
                </div>
              ))}
            </div>
          )}

          {/* FASE 2: En los Fuegos Paso a Paso */}
          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between border-b border-stone-300 pb-1.5">
              <h2 className="text-xs font-black uppercase tracking-wider text-stone-900 font-mono">
                2. EN LOS FUEGOS (Secuencia de Cocción)
              </h2>
              <span className="text-[10px] text-stone-500 italic">
                Sigue la temperatura y señales sensoriales
              </span>
            </div>

            <div className="space-y-3.5">
              {recipe.steps.map((step) => (
                <div
                  key={step.stepNumber}
                  className="p-3.5 rounded-xl border border-stone-200 bg-white space-y-2 break-inside-avoid shadow-2xs"
                >
                  <div className="flex items-center justify-between gap-2 border-b border-stone-100 pb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-stone-900 text-white font-mono text-xs font-bold flex items-center justify-center shrink-0">
                        {step.stepNumber}
                      </span>
                      <h3 className="font-bold text-xs sm:text-sm text-stone-900">
                        {step.title}
                      </h3>
                    </div>

                    <div className="flex items-center gap-2 font-mono text-xs">
                      <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 font-bold text-[10px] uppercase">
                        Fuego {step.heatLevel}
                      </span>
                      {step.timerSeconds && (
                        <span className="text-stone-600 font-semibold text-[11px]">
                          ⏱️ {Math.round(step.timerSeconds / 60)} min
                        </span>
                      )}
                    </div>
                  </div>

                  <p className="text-xs sm:text-sm text-stone-800 font-medium leading-relaxed">
                    {step.instruction}
                  </p>

                  <div className="p-2 bg-stone-50 rounded-lg text-xs text-stone-700 flex items-start gap-1.5 border border-stone-200/60">
                    <span className="shrink-0 text-amber-600 font-bold">💡 Consejo:</span>
                    <span>{step.tip}</span>
                  </div>

                  {includeSensoryCues && step.sensoryCues && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 text-[11px] text-stone-600 pt-1">
                      {step.sensoryCues.sound && (
                        <div className="bg-stone-100/70 p-1.5 rounded">
                          <strong>👂 Oído:</strong> {step.sensoryCues.sound}
                        </div>
                      )}
                      {step.sensoryCues.sight && (
                        <div className="bg-stone-100/70 p-1.5 rounded">
                          <strong>👀 Vista:</strong> {step.sensoryCues.sight}
                        </div>
                      )}
                      {step.sensoryCues.smell && (
                        <div className="bg-stone-100/70 p-1.5 rounded">
                          <strong>👃 Olor:</strong> {step.sensoryCues.smell}
                        </div>
                      )}
                    </div>
                  )}

                  {step.whyItWorks && (
                    <div className="text-[11px] text-stone-500 italic pt-0.5">
                      🔬 <strong>Ciencia:</strong> {step.whyItWorks}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Footer de Ficha Técnica */}
          <div className="pt-4 border-t-2 border-stone-900 flex items-center justify-between text-[10px] text-stone-500 font-mono">
            <span>Generado con Chef Cero • Asistente Culinario a Prueba de Errores</span>
            <span>https://chefcero.app</span>
          </div>

        </div>

      </div>
    </div>
  );
};
