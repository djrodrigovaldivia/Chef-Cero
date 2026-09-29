import React, { useState, useMemo } from 'react';
import { X, Search, Globe, ChevronRight, Sparkles, MapPin } from 'lucide-react';
import { WORLD_COUNTRIES, WorldCountry, CONTINENTS } from '../data/worldCountries';

interface WorldAtlasModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectCountry: (country: { name: string; flag: string; continent: string }) => void;
  currentSelectedCountryName?: string;
}

export const WorldAtlasModal: React.FC<WorldAtlasModalProps> = ({
  isOpen,
  onClose,
  onSelectCountry,
  currentSelectedCountryName,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedContinent, setSelectedContinent] = useState<string>('Todos');

  const filteredCountries = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return WORLD_COUNTRIES.filter((c) => {
      const matchesSearch = 
        !q ||
        c.name.toLowerCase().includes(q) ||
        c.continent.toLowerCase().includes(q) ||
        c.signatureDishes.toLowerCase().includes(q);

      const matchesContinent = 
        selectedContinent === 'Todos' || c.continent === selectedContinent;

      return matchesSearch && matchesContinent;
    });
  }, [searchQuery, selectedContinent]);

  if (!isOpen) return null;

  const isCustomCountryQuery = 
    searchQuery.trim().length > 1 && 
    !filteredCountries.some((c) => c.name.toLowerCase() === searchQuery.toLowerCase().trim());

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-950/70 backdrop-blur-sm animate-fade-in">
      <div 
        className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl border border-stone-200 flex flex-col max-h-[90vh] overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="atlas-title"
      >
        {/* Cabecera del Modal */}
        <div className="p-4 sm:p-6 border-b border-stone-100 flex items-center justify-between shrink-0 bg-stone-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500 text-stone-950 flex items-center justify-center shadow-xs">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h2 id="atlas-title" className="text-lg sm:text-xl font-black text-stone-900 font-serif">
                Atlas Gastronómico Mundial
              </h2>
              <p className="text-xs text-stone-500">
                Elige cualquier país para descubrir sus platos auténticos adaptados a principiantes.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-stone-200 rounded-full text-stone-400 hover:text-stone-700 transition cursor-pointer"
            aria-label="Cerrar atlas"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Buscador Rápido de Países */}
        <div className="p-4 border-b border-stone-100 space-y-3 bg-white shrink-0">
          <div className="relative flex items-center">
            <Search className="w-5 h-5 text-stone-400 ml-3.5 absolute pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por país, plato o región (ej: Tailandia, Grecia, Arepas, Japón...)"
              className="w-full pl-11 pr-10 py-2.5 bg-stone-100 border border-stone-200 rounded-2xl text-xs sm:text-sm text-stone-900 placeholder:text-stone-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 transition"
              autoFocus
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 p-1 hover:bg-stone-200 rounded-full text-stone-400"
                title="Limpiar búsqueda"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Filtros por Continente */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
            {CONTINENTS.map((cont) => (
              <button
                key={cont}
                type="button"
                onClick={() => setSelectedContinent(cont)}
                className={`px-3 py-1.5 rounded-xl font-bold transition whitespace-nowrap cursor-pointer ${
                  selectedContinent === cont
                    ? 'bg-stone-900 text-white shadow-2xs'
                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                }`}
              >
                {cont}
              </button>
            ))}
          </div>
        </div>

        {/* Lista de Países */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3">
          
          {/* Opción Dinámica: Buscar CUALQUIER país que no esté en la lista predefinida */}
          {isCustomCountryQuery && (
            <button
              type="button"
              onClick={() => {
                onSelectCountry({
                  name: searchQuery.trim(),
                  flag: '🌍',
                  continent: selectedContinent !== 'Todos' ? selectedContinent : 'Mundo',
                });
                onClose();
              }}
              className="w-full p-4 rounded-2xl bg-amber-50 hover:bg-amber-100 border-2 border-amber-300 text-left transition cursor-pointer flex items-center justify-between shadow-xs group"
            >
              <div className="flex items-center gap-3">
                <span className="text-3xl leading-none">✨</span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-black text-amber-950 font-serif">
                      Explorar gastronomía de "{searchQuery.trim()}"
                    </span>
                    <span className="text-[10px] bg-amber-200 text-amber-900 font-bold px-1.5 py-0.5 rounded-full">
                      Cualquier país
                    </span>
                  </div>
                  <p className="text-xs text-amber-800 mt-0.5">
                    Chef Cero creará recetas tradicionales paso a paso de este país al instante.
                  </p>
                </div>
              </div>

              <div className="w-8 h-8 rounded-full bg-amber-500 text-stone-950 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <ChevronRight className="w-4 h-4" />
              </div>
            </button>
          )}

          {/* Grilla de Países Catalogados */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {filteredCountries.map((country) => {
              const isSelected = currentSelectedCountryName?.toLowerCase() === country.name.toLowerCase();
              return (
                <button
                  key={country.id}
                  type="button"
                  onClick={() => {
                    onSelectCountry({
                      name: country.name,
                      flag: country.flag,
                      continent: country.continent,
                    });
                    onClose();
                  }}
                  className={`p-3.5 rounded-2xl border text-left transition cursor-pointer flex items-center justify-between gap-3 active:scale-[0.98] ${
                    isSelected
                      ? 'bg-amber-100/90 border-amber-400 ring-2 ring-amber-300/40 shadow-xs'
                      : 'bg-stone-50/70 hover:bg-white border-stone-200 hover:border-amber-300 hover:shadow-sm'
                  }`}
                >
                  <div className="flex items-center gap-3 truncate">
                    <span className="text-3xl leading-none shrink-0 drop-shadow-2xs">{country.flag}</span>
                    <div className="truncate">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs sm:text-sm font-black text-stone-900 truncate font-serif">
                          {country.name}
                        </span>
                        <span className="text-[10px] text-stone-400 font-medium truncate">
                          · {country.continent}
                        </span>
                      </div>
                      <p className="text-[11px] text-stone-500 truncate mt-0.5">
                        {country.signatureDishes}
                      </p>
                    </div>
                  </div>

                  <div className="shrink-0 text-stone-400 group-hover:text-amber-600">
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </button>
              );
            })}
          </div>

          {filteredCountries.length === 0 && !isCustomCountryQuery && (
            <div className="py-12 text-center text-stone-500 space-y-2">
              <span className="text-4xl block">🗺️</span>
              <p className="text-sm font-semibold text-stone-700">No encontramos países con esa búsqueda.</p>
              <p className="text-xs">Prueba escribiendo el nombre de cualquier país para que Chef Cero lo prepare.</p>
            </div>
          )}
        </div>

        {/* Pie del modal con tips */}
        <div className="p-3 sm:p-4 border-t border-stone-100 bg-stone-50 flex items-center justify-between text-xs text-stone-500">
          <span>Más de 190 países disponibles</span>
          <span className="font-semibold text-amber-900">Adaptadas paso a paso a prueba de principiantes</span>
        </div>
      </div>
    </div>
  );
};
