import React, { useState } from 'react';
import { ShieldAlert, AlertTriangle, Flame, X, Sparkles, Mic, ChevronRight, CheckCircle2 } from 'lucide-react';
import { KITCHEN_EMERGENCIES, KitchenEmergency } from '../data/emergencyGuide';

interface CookingEmergencyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenVoiceAssistant?: () => void;
}

export const CookingEmergencyModal: React.FC<CookingEmergencyModalProps> = ({
  isOpen,
  onClose,
  onOpenVoiceAssistant,
}) => {
  const [selectedEmergency, setSelectedEmergency] = useState<KitchenEmergency>(KITCHEN_EMERGENCIES[0]);
  const [searchQuery, setSearchQuery] = useState('');

  if (!isOpen) return null;

  const filteredEmergencies = KITCHEN_EMERGENCIES.filter((em) =>
    em.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    em.immediateAction.toLowerCase().includes(searchQuery.toLowerCase()) ||
    em.badge.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-950/80 backdrop-blur-sm animate-fade-in">
      <div
        id="cooking-emergency-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="emergency-title"
        className="bg-white rounded-3xl shadow-2xl max-w-3xl w-full max-h-[92vh] flex flex-col overflow-hidden border-2 border-red-500/80"
      >
        {/* Header con botón de pánico y cierre */}
        <div className="bg-red-600 text-white px-5 py-4 flex items-center justify-between gap-3 shadow-md shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center text-white shrink-0 animate-pulse">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase tracking-wider font-extrabold bg-red-800/80 px-2 py-0.5 rounded-full">
                  Primeros Auxilios Culinarios
                </span>
                <span className="text-[11px] text-red-200">1 toque para rescate</span>
              </div>
              <h2 id="emergency-title" className="text-lg sm:text-xl font-bold font-serif leading-tight">
                S.O.S. Cocina: No entres en pánico
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onOpenVoiceAssistant && (
              <button
                onClick={() => {
                  onClose();
                  onOpenVoiceAssistant();
                }}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-white text-red-700 hover:bg-red-50 rounded-xl text-xs font-bold shadow-sm transition"
                title="Preguntar por voz"
              >
                <Mic className="w-3.5 h-3.5 text-red-600 animate-pulse" />
                <span>Hablar con el Chef</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-red-700 hover:bg-red-800 text-white flex items-center justify-center transition"
              aria-label="Cerrar modal de emergencias"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Buscador rápido de crisis */}
        <div className="p-4 bg-stone-50 border-b border-stone-200 shrink-0">
          <input
            type="text"
            placeholder="¿Qué está pasando? (ej: humo, sal, pegado, quemado, cortado...)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2.5 bg-white border border-stone-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 text-stone-800 placeholder:text-stone-400"
          />
        </div>

        {/* Contenido dividido: Lista de incidentes y tarjeta de rescate */}
        <div className="flex-1 overflow-y-auto grid grid-cols-1 md:grid-cols-12 divide-y md:divide-y-0 md:divide-x divide-stone-200">
          {/* Columna Izquierda: Botones de incidentes */}
          <div className="md:col-span-5 p-3 space-y-2 overflow-y-auto max-h-[45vh] md:max-h-full">
            <div className="text-[11px] font-bold text-stone-500 uppercase tracking-wider px-2 pt-1">
              Selecciona tu incidente:
            </div>
            {filteredEmergencies.map((em) => {
              const isSelected = selectedEmergency.id === em.id;
              return (
                <button
                  key={em.id}
                  onClick={() => setSelectedEmergency(em)}
                  className={`w-full text-left p-3 rounded-2xl transition flex items-center justify-between gap-2 border ${
                    isSelected
                      ? 'bg-red-50 border-red-300 ring-2 ring-red-400 text-red-950 font-semibold'
                      : 'bg-white hover:bg-stone-50 border-stone-200 text-stone-800'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    {em.severity === 'critical' ? (
                      <Flame className="w-4 h-4 text-red-600 shrink-0 animate-bounce" />
                    ) : em.severity === 'high' ? (
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 text-stone-500 shrink-0" />
                    )}
                    <div>
                      <div className="text-xs leading-snug line-clamp-1">{em.title}</div>
                      <span className="text-[10px] text-stone-500">{em.badge}</span>
                    </div>
                  </div>
                  <ChevronRight
                    className={`w-4 h-4 shrink-0 transition-transform ${
                      isSelected ? 'text-red-600 translate-x-0.5' : 'text-stone-400'
                    }`}
                  />
                </button>
              );
            })}
          </div>

          {/* Columna Derecha: Protocolo de acción inmediato */}
          <div className="md:col-span-7 p-4 sm:p-6 bg-white overflow-y-auto">
            <div className="space-y-4">
              {/* Badge de gravedad y título */}
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <span
                    className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                      selectedEmergency.severity === 'critical'
                        ? 'bg-red-100 text-red-800 border border-red-200'
                        : selectedEmergency.severity === 'high'
                        ? 'bg-amber-100 text-amber-800 border border-amber-200'
                        : 'bg-blue-100 text-blue-800 border border-blue-200'
                    }`}
                  >
                    {selectedEmergency.badge}
                  </span>
                  <span className="text-xs text-stone-500 font-medium">Protocolo comprobado</span>
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-stone-900 leading-snug">
                  {selectedEmergency.title}
                </h3>
              </div>

              {/* Acción Inmediata (Banner de impacto) */}
              <div className="p-3.5 bg-red-50 border-l-4 border-red-500 rounded-r-2xl">
                <div className="text-[11px] font-bold text-red-800 uppercase tracking-wider mb-0.5">
                  ⚡ Acción Inmediata en 5 segundos:
                </div>
                <p className="text-sm font-semibold text-red-950 leading-relaxed">
                  {selectedEmergency.immediateAction}
                </p>
              </div>

              {/* Regla de Oro Vital */}
              <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-2xl flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-900 leading-relaxed font-medium">
                  <strong className="font-bold text-amber-950">Regla de Oro: </strong>
                  {selectedEmergency.goldenRule}
                </div>
              </div>

              {/* Pasos de rescate paso a paso */}
              <div>
                <div className="text-xs font-bold text-stone-700 uppercase tracking-wider mb-2">
                  Pasos de rescate ordenados:
                </div>
                <ol className="space-y-2">
                  {selectedEmergency.steps.map((step, idx) => (
                    <li
                      key={idx}
                      className="flex items-start gap-2.5 p-2.5 bg-stone-50 rounded-xl text-xs sm:text-sm text-stone-800 leading-relaxed border border-stone-200/70"
                    >
                      <span className="w-5 h-5 rounded-full bg-stone-200 text-stone-800 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                        {idx + 1}
                      </span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              </div>

              {/* Botón de Asistente de Voz dentro de la tarjeta */}
              {onOpenVoiceAssistant && (
                <div className="pt-2">
                  <button
                    onClick={() => {
                      onClose();
                      onOpenVoiceAssistant();
                    }}
                    className="w-full py-3 px-4 bg-stone-900 hover:bg-stone-800 text-white rounded-2xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-lg transition"
                  >
                    <Mic className="w-4 h-4 text-amber-400 animate-pulse" />
                    <span>¿Dudas sobre este incidente? Hablar con Chef Cero en Vivo</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-stone-100 px-5 py-3 border-t border-stone-200 flex items-center justify-between text-xs text-stone-600 shrink-0">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
            <span>La cocina es física y paciencia: el 95% de los errores tienen solución.</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-stone-200 hover:bg-stone-300 text-stone-800 rounded-xl font-bold transition"
          >
            Entendido, volver a cocinar
          </button>
        </div>
      </div>
    </div>
  );
};
