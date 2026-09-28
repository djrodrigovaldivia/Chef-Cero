import React, { useState } from 'react';
import { X, Play, Pause, RotateCcw, Sparkles, Check, ChevronRight, Award, ShieldCheck, Flame } from 'lucide-react';

interface CulinaryTechniqueDemo {
  id: string;
  name: string;
  category: 'Corte Seguro' | 'Control Térmico' | 'Emulsión';
  badge: string;
  durationLabel: string;
  difficulty: 'Básico (Nivel 1)' | 'Intermedio (Nivel 2-3)' | 'Avanzado';
  summary: string;
  goldenRule: string;
  visualGraphicType: 'claw' | 'brunoise' | 'julienne' | 'saute' | 'mantecatura' | 'sear';
  steps: {
    title: string;
    description: string;
  }[];
  sensoryCue: string;
}

const TECHNIQUES: CulinaryTechniqueDemo[] = [
  {
    id: 'claw',
    name: 'Técnica "Garra de Oso" (Corte Seguro)',
    category: 'Corte Seguro',
    badge: '🛡️ Seguridad',
    durationLabel: 'Bucle de 3s',
    difficulty: 'Básico (Nivel 1)',
    summary: 'La posición anatómica universal de los chefs para cortar rápido sin riesgo de cortarse jamás.',
    goldenRule: 'Las yemas de los dedos miran hacia adentro; la hoja plana del cuchillo se apoya en los nudillos medios.',
    visualGraphicType: 'claw',
    sensoryCue: 'Sientes el contacto frío del metal en el nudillo medio, nunca en la uña ni en la piel blanda.',
    steps: [
      { title: 'Curva los dedos', description: 'Imagina que sostienes una pelota de tenis pequeña o una manzana.' },
      { title: 'Esconde el pulgar', description: 'El pulgar y el meñique deben quedar detrás de los otros 3 dedos.' },
      { title: 'Desliza con vaivén', description: 'No golpees hacia abajo; desliza el filo empujando hacia adelante.' },
    ],
  },
  {
    id: 'brunoise',
    name: 'Corte Brunoise Fina (2 mm)',
    category: 'Corte Seguro',
    badge: '🔪 Corte Preciso',
    durationLabel: 'Bucle de 4s',
    difficulty: 'Básico (Nivel 1)',
    summary: 'Cubitos diminutos y milimétricos indispensables para sofritos que se funden y salsas uniformes.',
    goldenRule: 'Para que la cebolla o verdura no suelte agua ácida, usa un cuchillo bien afilado sin aplastarla.',
    visualGraphicType: 'brunoise',
    sensoryCue: 'Los cubitos quedan del tamaño de una cabeza de cerilla o grano de arroz.',
    steps: [
      { title: 'Corta tiras finas', description: 'Primero haz láminas de 2 mm de grosor de manera pareja.' },
      { title: 'Junta los bastones', description: 'Alinea los bastones de verdura con la palma.' },
      { title: 'Pica transversal', description: 'Corta en ángulo recto con ritmo uniforme.' },
    ],
  },
  {
    id: 'julienne',
    name: 'Corte Juliana (Bastoncitos de 5 cm)',
    category: 'Corte Seguro',
    badge: '🥕 Clásico',
    durationLabel: 'Bucle de 4s',
    difficulty: 'Básico (Nivel 1)',
    summary: 'Tiras alargadas de 2x2 mm por 5 cm de largo. Clave para salteados wok, ensaladas y sopas.',
    goldenRule: 'Cuadra primero el vegetal cortando una fina base para que no ruede en la tabla.',
    visualGraphicType: 'julienne',
    sensoryCue: 'Al saltear, todos los bastones se cocinan exactamente en el mismo segundo.',
    steps: [
      { title: 'Crea una base plana', description: 'Corta una rodajita fina para apoyar el vegetal firmemente.' },
      { title: 'Láminas longitudinales', description: 'Corta rebanadas delgadas a lo largo.' },
      { title: 'Apila y perfila', description: 'Apila máximo 3 láminas y corta en tiras alargadas.' },
    ],
  },
  {
    id: 'saute',
    name: 'Salteado Vivo al Sartén (Sauté)',
    category: 'Control Térmico',
    badge: '🔥 Fuego Vivo',
    durationLabel: 'Bucle de 3s',
    difficulty: 'Intermedio (Nivel 2-3)',
    summary: 'El movimiento de muñeca que dora verduras y carnes rápidamente manteniendo su textura crujiente.',
    goldenRule: 'El impulso nace del codo y la muñeca: empujas hacia adelante y tiras hacia arriba con suave curva.',
    visualGraphicType: 'saute',
    sensoryCue: 'Escuchas un chisporroteo alegre ("tszzz"), sin acumulación de líquido en el fondo.',
    steps: [
      { title: 'Sartén bien caliente', description: 'El aceite debe brillar como espejo antes de volcar ingredientes.' },
      { title: 'No sobrecargues', description: 'Deja espacio entre trozos; si amontonas, se hervirán en vez de dorar.' },
      { title: 'Movimiento en ola', description: 'Empuja la sartén hacia adelante y levanta la punta para envolver.' },
    ],
  },
  {
    id: 'mantecatura',
    name: 'Mantecatura y Emulsión de Pasta',
    category: 'Emulsión',
    badge: '🍝 Secreto Italiano',
    durationLabel: 'Bucle de 4s',
    difficulty: 'Intermedio (Nivel 2-3)',
    summary: 'Cómo lograr una salsa de restaurante sedosa y brillante sin usar una sola gota de nata o crema.',
    goldenRule: 'Fuera del fuego directo: agitas vigorosamente la pasta con su agua almidonada y grasa (aceite/queso).',
    visualGraphicType: 'mantecatura',
    sensoryCue: 'Ves cómo el líquido transparente se transforma en una crema aterciopelada que abraza la pasta.',
    steps: [
      { title: 'Reserva agua de pasta', description: 'Guarda 1/2 taza de esa agua turbia rica en almidón antes de escurrir.' },
      { title: 'Pasa la pasta al dente', description: 'Agrégala a la sartén 1 minuto antes de su punto final.' },
      { title: 'Agita fuera del fuego', description: 'Mueve en círculos mientras agregas queso o aceite para emulsionar.' },
    ],
  },
  {
    id: 'sear',
    name: 'Sellado Dorado (Reacción de Maillard)',
    category: 'Control Térmico',
    badge: '🥩 Textura & Jugos',
    durationLabel: 'Bucle de 4s',
    difficulty: 'Básico (Nivel 1)',
    summary: 'La costra dorada que concentra el sabor umami y retiene los jugos interiores.',
    goldenRule: 'Seca la proteína meticulosamente con papel de cocina. La humedad superficial es enemiga del dorado.',
    visualGraphicType: 'sear',
    sensoryCue: 'No intentes mover la carne al inicio. Cuando esté bien dorada, se despegará de la sartén sola.',
    steps: [
      { title: 'Seca con papel absorbente', description: 'Retira todo exceso de agua superficial de la carne.' },
      { title: 'Calor alto sin humear', description: 'Coloca la pieza y no la toques durante 2-3 minutos.' },
      { title: 'Voltea en su momento', description: 'Si se pega, espera 30 segundos más hasta que se suelte.' },
    ],
  },
];

export const VisualTechniqueLoopModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
}> = ({ isOpen, onClose }) => {
  const [selectedTechId, setSelectedTechId] = useState<string>(TECHNIQUES[0].id);

  if (!isOpen) return null;

  const currentTech = TECHNIQUES.find((t) => t.id === selectedTechId) || TECHNIQUES[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-950/70 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white rounded-3xl max-w-3xl w-full p-5 sm:p-6 shadow-2xl border border-stone-200 max-h-[92vh] flex flex-col space-y-4 overflow-hidden">
        {/* Encabezado */}
        <div className="flex items-center justify-between border-b border-stone-100 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500 text-stone-950 flex items-center justify-center text-xl shadow-xs font-bold">
              🎬
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black text-stone-900 font-serif">
                  Técnicas en Bucle (Estilo Kitchen Stories)
                </h3>
                <span className="text-[10px] bg-amber-100 text-amber-900 font-bold px-2 py-0.5 rounded-full border border-amber-300">
                  Micro-Pedagogía
                </span>
              </div>
              <p className="text-xs text-stone-500">
                Visuales cinéticos y postura corporal para dominar la cocina con destreza y seguridad
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-600 flex items-center justify-center font-bold text-sm cursor-pointer transition"
          >
            ✕
          </button>
        </div>

        {/* Selector de Técnicas (Pestañas horizontales) */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
          {TECHNIQUES.map((tech) => {
            const isSelected = tech.id === currentTech.id;
            return (
              <button
                key={tech.id}
                onClick={() => setSelectedTechId(tech.id)}
                className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 border ${
                  isSelected
                    ? 'bg-stone-900 text-amber-400 border-stone-900 shadow-xs'
                    : 'bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100'
                }`}
              >
                <span>{tech.badge.split(' ')[0]}</span>
                <span>{tech.name.split('(')[0].trim()}</span>
              </button>
            );
          })}
        </div>

        {/* Panel Principal de la Técnica Activa */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Animación Visual Vectorial en Bucle Cursado */}
            <div className="bg-stone-900 rounded-2xl p-5 text-white flex flex-col justify-between relative overflow-hidden min-h-[220px] border border-stone-800 shadow-inner">
              <div className="flex items-center justify-between text-[11px] text-stone-400 z-10">
                <span className="flex items-center gap-1 font-mono uppercase tracking-wider text-amber-400">
                  <Play className="w-3 h-3 fill-amber-400 animate-pulse" />
                  {currentTech.durationLabel}
                </span>
                <span className="bg-stone-800 px-2 py-0.5 rounded-full font-bold">
                  {currentTech.difficulty}
                </span>
              </div>

              {/* Diagrama Animado según Técnica */}
              <div className="my-auto py-6 flex flex-col items-center justify-center text-center relative z-10">
                {currentTech.visualGraphicType === 'claw' && (
                  <div className="space-y-3">
                    <div className="text-5xl animate-bounce">
                      🦅 ➔ 🧅
                    </div>
                    <div className="text-xs text-amber-200 font-mono font-bold bg-stone-800/80 px-3 py-1.5 rounded-xl border border-stone-700">
                      Nudillo como riel guía • Yemas protegidas hacia atrás
                    </div>
                  </div>
                )}

                {currentTech.visualGraphicType === 'brunoise' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-center gap-3 text-4xl">
                      <span>🧅</span>
                      <span className="text-amber-400 text-2xl font-mono">➔</span>
                      <span className="text-2xl tracking-widest font-mono text-emerald-400">▪ ▪ ▪ ▪</span>
                    </div>
                    <div className="text-xs text-stone-300 font-mono font-bold bg-stone-800/80 px-3 py-1.5 rounded-xl border border-stone-700">
                      Cubos milimétricos uniformes (2 mm x 2 mm)
                    </div>
                  </div>
                )}

                {currentTech.visualGraphicType === 'julienne' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-center gap-3 text-4xl">
                      <span>🥕</span>
                      <span className="text-amber-400 text-2xl font-mono">➔</span>
                      <span className="text-xl tracking-widest font-mono text-orange-400">━━ ━━ ━━</span>
                    </div>
                    <div className="text-xs text-stone-300 font-mono font-bold bg-stone-800/80 px-3 py-1.5 rounded-xl border border-stone-700">
                      Bastoncitos homogéneos de 5 cm de longitud
                    </div>
                  </div>
                )}

                {currentTech.visualGraphicType === 'saute' && (
                  <div className="space-y-3">
                    <div className="text-5xl animate-pulse">
                      🍳 💨 ✨
                    </div>
                    <div className="text-xs text-amber-300 font-mono font-bold bg-stone-800/80 px-3 py-1.5 rounded-xl border border-stone-700">
                      Impulso hacia adelante + Elevación suave de muñeca
                    </div>
                  </div>
                )}

                {currentTech.visualGraphicType === 'mantecatura' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-center gap-2 text-4xl">
                      <span>🍝</span>
                      <span className="text-amber-400 text-xl font-bold">+</span>
                      <span>💧</span>
                      <span className="text-amber-400 text-xl font-bold">=</span>
                      <span>✨</span>
                    </div>
                    <div className="text-xs text-amber-300 font-mono font-bold bg-stone-800/80 px-3 py-1.5 rounded-xl border border-stone-700">
                      Emulsión física almidón + grasa fuera del fuego
                    </div>
                  </div>
                )}

                {currentTech.visualGraphicType === 'sear' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-center gap-2 text-5xl">
                      <Flame className="w-10 h-10 text-orange-500 animate-pulse" />
                      <span>🥩</span>
                    </div>
                    <div className="text-xs text-orange-300 font-mono font-bold bg-stone-800/80 px-3 py-1.5 rounded-xl border border-stone-700">
                      Superficie seca + Calor alto = Reacción de Maillard
                    </div>
                  </div>
                )}
              </div>

              {/* Regla de Oro */}
              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs font-medium z-10">
                <strong className="text-amber-400 block font-bold mb-0.5">💡 Regla de Oro:</strong>
                {currentTech.goldenRule}
              </div>
            </div>

            {/* Pasos y Explicación Detallada */}
            <div className="space-y-3">
              <div>
                <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">
                  {currentTech.category}
                </span>
                <h4 className="text-base font-extrabold text-stone-900">
                  {currentTech.name}
                </h4>
                <p className="text-xs text-stone-600 mt-1 leading-relaxed">
                  {currentTech.summary}
                </p>
              </div>

              {/* Guía en 3 Pasos */}
              <div className="space-y-2">
                {currentTech.steps.map((st, idx) => (
                  <div key={idx} className="p-3 bg-stone-50 rounded-xl border border-stone-200 flex items-start gap-2.5">
                    <div className="w-5 h-5 rounded-full bg-amber-500 text-stone-950 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                      {idx + 1}
                    </div>
                    <div>
                      <h6 className="text-xs font-bold text-stone-900">{st.title}</h6>
                      <p className="text-[11px] text-stone-600 leading-snug">{st.description}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Clave Sensorial */}
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-950 flex items-start gap-2">
                <Sparkles className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="block font-bold text-emerald-900">¿Cómo saber que lo estás haciendo bien?</strong>
                  <p className="text-[11px] text-emerald-800">{currentTech.sensoryCue}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-stone-100 pt-3 flex items-center justify-between">
          <span className="text-[11px] text-stone-500">
            Práctica recomendada antes de encender el fuego
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-bold cursor-pointer transition shadow-xs"
          >
            Entendido, volver a cocinar
          </button>
        </div>
      </div>
    </div>
  );
};
