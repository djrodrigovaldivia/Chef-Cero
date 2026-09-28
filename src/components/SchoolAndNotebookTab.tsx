import React, { useState } from 'react';
import { UserProfile } from '../types';
import { ChefNotebook } from './ChefNotebook';
import { VisualDictionary } from './VisualDictionary';
import { KitchenStorageMap } from './KitchenStorageMap';
import { Award, BookOpen, Play, MapPin } from 'lucide-react';

interface SchoolAndNotebookTabProps {
  userProfile: UserProfile;
  onUpdateProfile: (updated: Partial<UserProfile>) => void;
  onLearnFact?: (category: 'fuego' | 'gustos' | 'equipamiento' | 'habito' | 'fortaleza', fact: string) => void;
  onRemoveFact?: (id: string) => void;
  onOpenVisualLoops?: () => void;
}

type SubSection = 'cuaderno' | 'tecnicas' | 'diccionario' | 'almacen';

export const SchoolAndNotebookTab: React.FC<SchoolAndNotebookTabProps> = ({
  userProfile,
  onUpdateProfile,
  onLearnFact,
  onRemoveFact,
  onOpenVisualLoops,
}) => {
  const [activeSection, setActiveSection] = useState<SubSection>('cuaderno');

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in pb-16">
      {/* Selector Segmentado Zen */}
      <div className="flex items-center justify-center">
        <div className="inline-flex items-center gap-1 p-1 bg-stone-200/80 rounded-2xl border border-stone-300/70 shadow-2xs">
          <button
            type="button"
            onClick={() => setActiveSection('cuaderno')}
            className={`px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 transition cursor-pointer ${
              activeSection === 'cuaderno'
                ? 'bg-white text-stone-900 shadow-xs'
                : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/50'
            }`}
          >
            <Award className="w-4 h-4 text-purple-600" />
            <span>Mi Cuaderno</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (onOpenVisualLoops) {
                onOpenVisualLoops();
              } else {
                setActiveSection('tecnicas');
              }
            }}
            className={`px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 transition cursor-pointer ${
              activeSection === 'tecnicas'
                ? 'bg-white text-stone-900 shadow-xs'
                : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/50'
            }`}
          >
            <Play className="w-3.5 h-3.5 text-rose-600 fill-rose-600" />
            <span>Técnicas en Bucle</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSection('diccionario')}
            className={`px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 transition cursor-pointer ${
              activeSection === 'diccionario'
                ? 'bg-white text-stone-900 shadow-xs'
                : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/50'
            }`}
          >
            <BookOpen className="w-4 h-4 text-amber-600" />
            <span>Diccionario Visual</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSection('almacen')}
            className={`px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 transition cursor-pointer ${
              activeSection === 'almacen'
                ? 'bg-white text-stone-900 shadow-xs'
                : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/50'
            }`}
          >
            <MapPin className="w-4 h-4 text-blue-600" />
            <span>¿Dónde va Guardado?</span>
          </button>
        </div>
      </div>

      {/* Contenido de la subsección */}
      <div className="pt-2">
        {activeSection === 'cuaderno' && (
          <ChefNotebook
            userProfile={userProfile}
            onUpdateProfile={onUpdateProfile}
            onLearnFact={onLearnFact}
            onRemoveFact={onRemoveFact}
          />
        )}

        {activeSection === 'diccionario' && <VisualDictionary />}

        {activeSection === 'almacen' && <KitchenStorageMap />}

        {activeSection === 'tecnicas' && (
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-stone-200 text-center space-y-4">
            <div className="w-14 h-14 bg-rose-100 rounded-2xl flex items-center justify-center text-rose-600 mx-auto">
              <Play className="w-7 h-7 fill-rose-600 ml-0.5" />
            </div>
            <h3 className="text-xl sm:text-2xl font-black text-stone-900 font-serif">
              Micro-Demostraciones en Bucle de 4 Segundos
            </h3>
            <p className="text-sm text-stone-600 max-w-md mx-auto">
              Aprende el corte de garra de oso, el pochado de cebolla y el giro de sartén con videos cortos y directos sin teoría innecesaria.
            </p>
            {onOpenVisualLoops && (
              <button
                type="button"
                onClick={onOpenVisualLoops}
                className="px-5 py-3 rounded-2xl bg-amber-500 hover:bg-amber-600 text-stone-950 font-black text-sm inline-flex items-center gap-2 shadow-xs transition active:scale-98 cursor-pointer"
              >
                <span>Ver técnicas en video</span>
                <Play className="w-4 h-4 fill-stone-950" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
