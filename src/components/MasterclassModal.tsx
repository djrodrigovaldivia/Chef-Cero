import React, { useState } from 'react';
import { MasterclassCapsule } from '../types';
import { MASTERCLASS_CAPSULES } from '../data/masterclassData';
import { Sparkles, Play, Award, Volume2, X, ExternalLink, Flame, ShieldAlert, BookOpen } from 'lucide-react';

interface MasterclassModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedCapsuleId?: string;
  onSpeak?: (text: string) => void;
}

export const MasterclassModal: React.FC<MasterclassModalProps> = ({
  isOpen,
  onClose,
  selectedCapsuleId,
  onSpeak,
}) => {
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [activeCapsule, setActiveCapsule] = useState<MasterclassCapsule>(() => {
    if (selectedCapsuleId) {
      const found = MASTERCLASS_CAPSULES.find((c) => c.id === selectedCapsuleId);
      if (found) return found;
    }
    return MASTERCLASS_CAPSULES[0];
  });
  const [showFullVideo, setShowFullVideo] = useState(false);

  if (!isOpen) return null;

  const filteredCapsules = activeCategory === 'all'
    ? MASTERCLASS_CAPSULES
    : MASTERCLASS_CAPSULES.filter((c) => c.category === activeCategory);

  const categories = [
    { id: 'all', label: 'Todas las Técnicas', icon: '🌟' },
    { id: 'fuego', label: 'Fuego & Calor', icon: '🔥' },
    { id: 'corte', label: 'Cuchillo & Cortes', icon: '🔪' },
    { id: 'marcado_maillard', label: 'Sellado Maillard', icon: '🥩' },
    { id: 'emulsion', label: 'Emulsiones', icon: '🍝' },
    { id: 'salsas', label: 'Salsas & Fondos', icon: '🍷' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-950/80 backdrop-blur-md overflow-y-auto animate-fade-in">
      <div className="relative w-full max-w-4xl bg-stone-900 border border-amber-500/30 rounded-3xl shadow-2xl overflow-hidden my-auto text-stone-100 flex flex-col max-h-[90vh]">
        
        {/* Header estilo Revista Gastronómica / Masterclass */}
        <div className="p-4 sm:p-6 bg-gradient-to-r from-stone-900 via-stone-900 to-amber-950/50 border-b border-stone-800 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 text-stone-950 flex items-center justify-center text-2xl font-black shadow-lg shadow-amber-500/20 shrink-0">
              🎓
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-amber-400 font-serif">
                  Cátedra Culinaria de Alta Escuela
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40">
                  3★ Michelin Edition
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-white font-serif tracking-tight">
                Micro-Masterclasses de Maestros
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2.5 rounded-full bg-stone-800/80 hover:bg-stone-700 text-stone-300 hover:text-white transition cursor-pointer"
            aria-label="Cerrar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Barra de Filtros */}
        <div className="px-4 sm:px-6 py-2.5 bg-stone-950/60 border-b border-stone-800/80 flex items-center gap-1.5 overflow-x-auto shrink-0 scrollbar-none">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                activeCategory === cat.id
                  ? 'bg-amber-500 text-stone-950 shadow-md shadow-amber-500/20'
                  : 'bg-stone-800/70 text-stone-400 hover:text-stone-200 hover:bg-stone-800'
              }`}
            >
              <span>{cat.icon}</span>
              <span>{cat.label}</span>
            </button>
          ))}
        </div>

        {/* Contenido Principal: Video Loop + Explicación Científica */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* Columna Izquierda: Video Loop Cinematográfico */}
            <div className="lg:col-span-6 space-y-3">
              <div className="relative rounded-2xl overflow-hidden bg-black border border-stone-800 aspect-video sm:aspect-4/3 shadow-xl">
                {!showFullVideo ? (
                  <>
                    <video
                      key={activeCapsule.id}
                      src={activeCapsule.videoLoopUrl}
                      poster={activeCapsule.fallbackPosterUrl}
                      autoPlay
                      muted
                      loop
                      playsInline
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-stone-950 via-transparent to-black/30 pointer-events-none" />
                    
                    <div className="absolute top-3 left-3 bg-stone-950/80 backdrop-blur-md px-2.5 py-1 rounded-lg border border-white/10 flex items-center gap-1.5 text-[11px] text-amber-300 font-bold">
                      <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                      <span>Loop Cinematográfico ({activeCapsule.durationSeconds}s)</span>
                    </div>

                    <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-xs text-white">
                      <span className="font-bold flex items-center gap-1.5 drop-shadow-md">
                        <Award className="w-4 h-4 text-amber-400" />
                        {activeCapsule.masterChef}
                      </span>

                      {activeCapsule.youtubeId && (
                        <button
                          onClick={() => setShowFullVideo(true)}
                          className="px-2.5 py-1 bg-rose-600/90 hover:bg-rose-600 text-white rounded-lg font-bold flex items-center gap-1 transition shadow-md cursor-pointer text-[11px]"
                        >
                          <Play className="w-3 h-3 fill-white" />
                          <span>Ver Masterclass HD</span>
                        </button>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="relative w-full h-full">
                    <iframe
                      src={`https://www.youtube-nocookie.com/embed/${activeCapsule.youtubeId}?autoplay=1&rel=0`}
                      title={activeCapsule.title}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      className="w-full h-full border-0"
                    />
                    <button
                      onClick={() => setShowFullVideo(false)}
                      className="absolute top-2 right-2 bg-stone-900/90 text-white p-1 rounded-lg text-xs hover:bg-stone-800"
                    >
                      Volver al loop
                    </button>
                  </div>
                )}
              </div>

              {/* Cita Histórica del Chef */}
              {activeCapsule.historicalQuote && (
                <div className="bg-stone-800/60 p-3.5 rounded-xl border border-stone-700/60 italic text-stone-300 text-xs sm:text-sm font-serif leading-relaxed">
                  {activeCapsule.historicalQuote}
                </div>
              )}
            </div>

            {/* Columna Derecha: Explicación Pedagógica y Sensorica */}
            <div className="lg:col-span-6 space-y-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xl">{activeCapsule.badge}</span>
                  <span className="text-xs text-amber-400 font-bold uppercase tracking-wider">
                    {activeCapsule.restaurantOrPedigree}
                  </span>
                </div>
                <h3 className="text-xl sm:text-2xl font-black text-white font-serif">
                  {activeCapsule.title}
                </h3>
              </div>

              {/* Regla de Oro del Maestro */}
              <div className="bg-amber-500/10 border border-amber-500/30 p-3.5 rounded-2xl">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-400 uppercase tracking-wider mb-1">
                  <Flame className="w-4 h-4 text-amber-400" />
                  <span>Regla de Oro Inquebrantable</span>
                </div>
                <p className="text-xs sm:text-sm text-stone-200 font-medium leading-relaxed">
                  {activeCapsule.masteryRule}
                </p>
              </div>

              {/* La Ciencia Detrás (Por Qué Ocurre) */}
              <div className="bg-stone-800/70 border border-stone-700 p-3.5 rounded-2xl">
                <div className="flex items-center gap-2 text-xs font-bold text-sky-400 uppercase tracking-wider mb-1">
                  <BookOpen className="w-4 h-4 text-sky-400" />
                  <span>La Química Culinaria (¿Por qué funciona?)</span>
                </div>
                <p className="text-xs sm:text-sm text-stone-300 leading-relaxed">
                  {activeCapsule.scientificWhy}
                </p>
              </div>

              {/* Señal Sensorial & Error a Evitar */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="bg-emerald-950/40 border border-emerald-500/30 p-3 rounded-xl">
                  <span className="font-bold text-emerald-400 block mb-1">
                    👂 Señal Sensorial:
                  </span>
                  <p className="text-stone-300 leading-snug">
                    {activeCapsule.sensoryCue}
                  </p>
                </div>

                <div className="bg-rose-950/40 border border-rose-500/30 p-3 rounded-xl">
                  <span className="font-bold text-rose-400 block mb-1">
                    ⚠️ Error Típico de Principiante:
                  </span>
                  <p className="text-stone-300 leading-snug">
                    {activeCapsule.proMistakeToAvoid}
                  </p>
                </div>
              </div>

              {/* Botón de Voz TTS para escuchar la lección */}
              {onSpeak && (
                <button
                  onClick={() => onSpeak(`${activeCapsule.title}. Regla del chef: ${activeCapsule.masteryRule}. Por qué funciona: ${activeCapsule.scientificWhy}`)}
                  className="w-full py-2.5 px-4 bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition border border-stone-700 cursor-pointer"
                >
                  <Volume2 className="w-4 h-4 text-amber-400" />
                  <span>Escuchar explicación del Chef Mentor</span>
                </button>
              )}
            </div>
          </div>

          {/* Carrusel de Cápsulas Rápidas Disponibles */}
          <div className="pt-4 border-t border-stone-800">
            <h4 className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-3">
              Seleccionar otra Masterclass Corta ({filteredCapsules.length}):
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
              {filteredCapsules.map((capsule) => {
                const isCurrent = capsule.id === activeCapsule.id;
                return (
                  <button
                    key={capsule.id}
                    onClick={() => {
                      setActiveCapsule(capsule);
                      setShowFullVideo(false);
                    }}
                    className={`p-3 rounded-xl text-left transition flex items-start gap-2.5 cursor-pointer ${
                      isCurrent
                        ? 'bg-amber-500/20 border-2 border-amber-400 text-white shadow-md'
                        : 'bg-stone-800/60 hover:bg-stone-800 border border-stone-700/60 text-stone-300'
                    }`}
                  >
                    <span className="text-2xl shrink-0 mt-0.5">{capsule.badge}</span>
                    <div className="min-w-0">
                      <div className="font-bold text-xs truncate text-white">
                        {capsule.title}
                      </div>
                      <div className="text-[11px] text-amber-400 truncate mt-0.5">
                        {capsule.masterChef.split('(')[0]}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

        </div>

        {/* Footer del Modal */}
        <div className="p-3 sm:p-4 bg-stone-950 border-t border-stone-800 flex items-center justify-between text-xs text-stone-400 shrink-0">
          <span>Técnicas probadas con rigor científico y alta cocina.</span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-stone-950 font-bold rounded-xl transition cursor-pointer"
          >
            Entendido, volver a la cocina
          </button>
        </div>

      </div>
    </div>
  );
};
