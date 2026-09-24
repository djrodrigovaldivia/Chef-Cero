import React, { useState } from 'react';
import { Eye, Ear, Sparkles, X, Check, AlertTriangle, ShieldCheck, Flame } from 'lucide-react';

interface TechniquesShowcaseModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Technique {
  id: string;
  title: string;
  subtitle: string;
  emoji: string;
  category: string;
  visualColor: string;
  sensoryCue: {
    sight: string;
    sound: string;
    smell: string;
  };
  theMistake: string;
  theSecret: string;
  interactiveSim: {
    stateBad: string;
    stateGood: string;
  };
}

const TECHNIQUES: Technique[] = [
  {
    id: 'cebolla-sudada',
    title: 'La Cebolla Sudada (Pochada Traslúcida)',
    subtitle: 'El pilar de todo sabor criollo e internacional sin provocar ardor',
    emoji: '🧅',
    category: 'Control de Fuego',
    visualColor: 'from-amber-500/20 to-orange-500/10',
    sensoryCue: {
      sight: 'Pasa de blanco lechoso rígido a un tono perla translúcido y flexible como seda.',
      sound: 'Susurro leve y calmo (sssshhhh...), jamás un chisporroteo violento ni crujiente.',
      smell: 'Aroma dulce y reconfortante; si huele a tostado punzante, el fuego está demasiado alto.',
    },
    theMistake: 'Subir el fuego para que "se haga más rápido": los bordes se queman y el centro queda crudo y amargo.',
    theSecret: 'Fuego medio-bajo con una pizca de sal desde el inicio. La sal ayuda a que la cebolla "sude" su agua y se cocine en sus propios jugos azucarados.',
    interactiveSim: {
      stateBad: 'Bordes negros amargos y centro duro',
      stateGood: 'Textura suave, brillante, tierna y naturalmente dulce',
    },
  },
  {
    id: 'prueba-cuchara',
    title: 'La Prueba de la Cuchara de Madera en el Aceite',
    subtitle: 'Cómo saber si el aceite está listo sin salpicaduras ni termómetros caros',
    emoji: '🪵',
    category: 'Seguridad y Temperatura',
    visualColor: 'from-yellow-500/20 to-amber-500/10',
    sensoryCue: {
      sight: 'Introduce el mango o punta de una cuchara de madera seca: se forman pequeñas burbujitas finas que suben alegres.',
      sound: 'Burbujeo alegre y suave sin estallidos violentos.',
      smell: 'Calor limpio y neutro; ¡si sale humo blanco, apaga la estufa de inmediato!',
    },
    theMistake: 'Echar la comida cuando el aceite todavía está frío: los alimentos absorben todo el aceite como una esponja y quedan grasosos.',
    theSecret: 'Si no tienes cuchara de madera, echa una miguita diminuta de pan. Debe flotar y dorarse en 15 segundos sin quemarse.',
    interactiveSim: {
      stateBad: 'Aceite frío = comida grasosa y pesada',
      stateGood: 'Burbujas alegres = costra sellada y crocante sin absorber grasa',
    },
  },
  {
    id: 'fuego-corona',
    title: 'El "Fuego Corona" (El Secreto del Arroz Suelto)',
    subtitle: 'La llama más delicada para que los fondos de olla no se peguen jamás',
    emoji: '🔥',
    category: 'Técnica de Cocción Tapada',
    visualColor: 'from-blue-500/20 to-cyan-500/10',
    sensoryCue: {
      sight: 'Una corona azul mínima que apenas roza la base de la olla sin lamer los costados.',
      sound: 'Un murmullo casi inaudible bajo la tapa cerrada.',
      smell: 'Vapor húmedo con perfume a grano cocido.',
    },
    theMistake: 'Destapar la olla para "ver cómo va". Si levantas la tapa se escapa el vapor a presión y el grano queda duro arriba y quemado abajo.',
    theSecret: 'Regla sagrada de los 15 minutos: tapa puesta, fuego corona y no tocar la olla hasta que el cronómetro suene.',
    interactiveSim: {
      stateBad: 'Llama alta = fondo carbonizado y arroz crudo al centro',
      stateGood: 'Fuego corona = cocción por vapor perfecta y grano suelto',
    },
  },
  {
    id: 'garra-de-oso',
    title: 'La Garra de Oso (Corte Seguro sin Cortaduras)',
    subtitle: 'El agarre universal de los chefs para esconder las yemas de los dedos',
    emoji: '🐻',
    category: 'Seguridad con Cuchillos',
    visualColor: 'from-emerald-500/20 to-teal-500/10',
    sensoryCue: {
      sight: 'Los dedos de la mano que sostiene el alimento se curvan hacia adentro como la pata de un oso.',
      sound: 'Corte rítmico nítido sobre la tabla de madera o plástico firme.',
      smell: 'Verduras frescas sin estrés.',
    },
    theMistake: 'Dejar los dedos estirados con las uñas apuntando hacia el cuchillo: un tropiezo y te rebanas la yema.',
    theSecret: 'El lateral plano del cuchillo se apoya sobre los nudillos doblados, actuando como un escudo protector infranqueable.',
    interactiveSim: {
      stateBad: 'Dedos planos extendidos hacia la hoja = peligro constante',
      stateGood: 'Falanges dobladas hacia adentro = corte a ciegas con 100% de seguridad',
    },
  },
];

export const TechniquesShowcaseModal: React.FC<TechniquesShowcaseModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [selectedTech, setSelectedTech] = useState<Technique>(TECHNIQUES[0]);
  const [interactiveView, setInteractiveView] = useState<'good' | 'bad'>('good');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-stone-950/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
      <div className="bg-white rounded-3xl max-w-2xl w-full border border-stone-200 shadow-2xl overflow-hidden my-6">
        {/* Cabecera */}
        <div className="p-5 border-b border-stone-100 flex items-center justify-between bg-stone-50/80">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-500 text-stone-950 flex items-center justify-center text-xl font-bold shadow-xs">
              🎓
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="font-extrabold text-base text-stone-900 font-serif">
                  Técnicas Sensoriales Clave
                </h3>
                <span className="text-[10px] bg-amber-100 text-amber-900 font-bold px-2 py-0.5 rounded-full border border-amber-200">
                  Aprende en 1 min
                </span>
              </div>
              <p className="text-xs text-stone-500">
                Aprende a reconocer el punto exacto con la vista, el oído y el olfato
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

        {/* Selector de Técnicas */}
        <div className="flex gap-2 p-3 border-b border-stone-100 overflow-x-auto scrollbar-none bg-stone-50/40">
          {TECHNIQUES.map((tech) => (
            <button
              key={tech.id}
              onClick={() => {
                setSelectedTech(tech);
                setInteractiveView('good');
              }}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 ${
                selectedTech.id === tech.id
                  ? 'bg-stone-900 text-white shadow-xs'
                  : 'bg-white text-stone-600 hover:bg-stone-100 border border-stone-200'
              }`}
            >
              <span>{tech.emoji}</span>
              <span>{tech.title.split('(')[0]}</span>
            </button>
          ))}
        </div>

        {/* Detalle de la Técnica Seleccionada */}
        <div className="p-5 sm:p-6 space-y-5">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] uppercase font-bold tracking-wider text-amber-800 bg-amber-100 px-2 py-0.5 rounded-md">
                {selectedTech.category}
              </span>
            </div>
            <h4 className="text-xl font-black text-stone-900 font-serif">
              {selectedTech.emoji} {selectedTech.title}
            </h4>
            <p className="text-xs sm:text-sm text-stone-600 mt-1">
              {selectedTech.subtitle}
            </p>
          </div>

          {/* Comparador Interactivo Bueno vs Malo */}
          <div className="bg-stone-100 p-1 rounded-2xl flex gap-1">
            <button
              onClick={() => setInteractiveView('good')}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                interactiveView === 'good'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <Check className="w-3.5 h-3.5" />
              <span>El Punto Perfecto (Cómo debe quedar)</span>
            </button>

            <button
              onClick={() => setInteractiveView('bad')}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                interactiveView === 'bad'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>El Error Típico (Lo que debes evitar)</span>
            </button>
          </div>

          {/* Estado Visual */}
          <div
            className={`p-4 rounded-2xl border transition-all ${
              interactiveView === 'good'
                ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
                : 'bg-rose-50/80 border-rose-200 text-rose-950'
            }`}
          >
            <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider mb-1">
              {interactiveView === 'good' ? (
                <>
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>Resultado Exitoso:</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                  <span>Cuidado con esto:</span>
                </>
              )}
            </div>
            <p className="text-xs sm:text-sm font-medium">
              {interactiveView === 'good'
                ? selectedTech.interactiveSim.stateGood
                : selectedTech.interactiveSim.stateBad}
            </p>
          </div>

          {/* Guía Sensorial de 3 Sentidos */}
          <div className="space-y-2 pt-1">
            <h5 className="text-xs font-bold uppercase tracking-wider text-stone-500">
              Cómo guiarte usando tus sentidos en la sartén:
            </h5>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div className="bg-stone-50 p-3 rounded-2xl border border-stone-200">
                <div className="flex items-center gap-1.5 text-xs font-bold text-stone-800 mb-1">
                  <Eye className="w-3.5 h-3.5 text-blue-600" />
                  <span>Vista</span>
                </div>
                <p className="text-[11px] text-stone-600 leading-relaxed">
                  {selectedTech.sensoryCue.sight}
                </p>
              </div>

              <div className="bg-stone-50 p-3 rounded-2xl border border-stone-200">
                <div className="flex items-center gap-1.5 text-xs font-bold text-stone-800 mb-1">
                  <Ear className="w-3.5 h-3.5 text-amber-600" />
                  <span>Oído</span>
                </div>
                <p className="text-[11px] text-stone-600 leading-relaxed">
                  {selectedTech.sensoryCue.sound}
                </p>
              </div>

              <div className="bg-stone-50 p-3 rounded-2xl border border-stone-200">
                <div className="flex items-center gap-1.5 text-xs font-bold text-stone-800 mb-1">
                  <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                  <span>Olfato</span>
                </div>
                <p className="text-[11px] text-stone-600 leading-relaxed">
                  {selectedTech.sensoryCue.smell}
                </p>
              </div>
            </div>
          </div>

          {/* El Secreto del Chef */}
          <div className="bg-amber-50 p-3.5 rounded-2xl border border-amber-200 text-xs text-amber-950 leading-relaxed">
            💡 <strong>El secreto infalible:</strong> {selectedTech.theSecret}
          </div>
        </div>
      </div>
    </div>
  );
};
