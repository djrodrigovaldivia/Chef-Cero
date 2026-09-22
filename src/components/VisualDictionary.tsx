import React, { useState, useMemo } from 'react';
import { Search, ShieldAlert, CheckCircle2, Lightbulb, Volume2, Sparkles, AlertOctagon } from 'lucide-react';
import { DICTIONARY_ITEMS } from '../data/dictionaryData';
import { DictionaryCategory, DictionaryItem } from '../types';
import { speakSpanishText } from '../utils/audioAlert';

export const VisualDictionary: React.FC = () => {
  const [activeCategory, setActiveCategory] = useState<DictionaryCategory | 'todas'>('todas');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedItem, setSelectedItem] = useState<DictionaryItem | null>(null);

  const filteredItems = useMemo(() => {
    return DICTIONARY_ITEMS.filter((item) => {
      const matchesCat = activeCategory === 'todas' || item.category === activeCategory;
      const matchesQuery =
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.simpleUse.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.safetyUsage.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.neverDo.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesCat && matchesQuery;
    });
  }, [activeCategory, searchTerm]);

  const handleListenCard = (item: DictionaryItem, e: React.MouseEvent) => {
    e.stopPropagation();
    const narration = `${item.name}. Para qué sirve: ${item.simpleUse}. Cómo usarlo con seguridad: ${item.safetyUsage}. Atención: Qué nunca debes hacer: ${item.neverDo}`;
    speakSpanishText(narration, { speaker: item.name, badge: 'Diccionario Visual' });
  };

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent p-6 rounded-2xl border border-amber-200/60">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-100 text-amber-900 text-xs font-semibold mb-2">
            <Sparkles className="w-3.5 h-3.5 text-amber-700" />
            <span>Guía Gráfica a Prueba de Novatos</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-stone-900 font-serif">
            Diccionario Visual de Utensilios, Cortes e Ingredientes
          </h2>
          <p className="text-stone-600 text-sm sm:text-base mt-1">
            Sin tecnicismos pretenciosos. Aprende qué hace cada cosa, cómo sostenerlo sin cortarte y lo más importante: <strong>qué NUNCA debes hacer</strong> para evitar desastres en la cocina.
          </p>
        </div>

        {/* Search Bar */}
        <div className="mt-5 relative max-w-xl">
          <Search className="w-5 h-5 absolute left-3.5 top-3.5 text-stone-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar utensilio, especia, corte (ej: teflón, juliana, sal, cebolla)..."
            className="w-full pl-11 pr-4 py-3 bg-white border border-stone-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent shadow-sm text-stone-800"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-3 text-xs text-stone-400 hover:text-stone-600 bg-stone-100 px-2 py-0.5 rounded"
            >
              Borrar
            </button>
          )}
        </div>

        {/* Category Filter Chips */}
        <div className="flex flex-wrap gap-2 mt-4">
          <button
            onClick={() => setActiveCategory('todas')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
              activeCategory === 'todas'
                ? 'bg-amber-600 text-white shadow-md'
                : 'bg-white text-stone-700 hover:bg-stone-100 border border-stone-200'
            }`}
          >
            Todos ({DICTIONARY_ITEMS.length})
          </button>
          <button
            onClick={() => setActiveCategory('utensilios')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
              activeCategory === 'utensilios'
                ? 'bg-amber-600 text-white shadow-md'
                : 'bg-white text-stone-700 hover:bg-stone-100 border border-stone-200'
            }`}
          >
            🍳 Utensilios Esenciales
          </button>
          <button
            onClick={() => setActiveCategory('especias')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
              activeCategory === 'especias'
                ? 'bg-amber-600 text-white shadow-md'
                : 'bg-white text-stone-700 hover:bg-stone-100 border border-stone-200'
            }`}
          >
            🧂 Especias y Condimentos
          </button>
          <button
            onClick={() => setActiveCategory('cortes')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
              activeCategory === 'cortes'
                ? 'bg-amber-600 text-white shadow-md'
                : 'bg-white text-stone-700 hover:bg-stone-100 border border-stone-200'
            }`}
          >
            🔪 Cortes Explicados
          </button>
          <button
            onClick={() => setActiveCategory('verduras')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
              activeCategory === 'verduras'
                ? 'bg-amber-600 text-white shadow-md'
                : 'bg-white text-stone-700 hover:bg-stone-100 border border-stone-200'
            }`}
          >
            🧅 Verduras Indispensables
          </button>
        </div>
      </div>

      {/* Grid of Dictionary Items */}
      {filteredItems.length === 0 ? (
        <div className="bg-white p-12 text-center rounded-2xl border border-stone-200 text-stone-500">
          <p className="text-base font-semibold">No se encontraron elementos con "{searchTerm}"</p>
          <p className="text-xs text-stone-400 mt-1">Prueba con palabras como "sartén", "ajo", "corte" o "pimentón".</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              onClick={() => setSelectedItem(item)}
              className="group bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col cursor-pointer hover:border-amber-400"
            >
              {/* Photo Banner with tag */}
              <div className="relative h-48 w-full bg-stone-100 overflow-hidden">
                <img
                  src={item.imageUrl}
                  alt={item.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute top-3 left-3 bg-stone-900/80 backdrop-blur-md text-white px-2.5 py-1 rounded-full text-[11px] font-semibold tracking-wide uppercase">
                  {item.category}
                </div>
                <button
                  onClick={(e) => handleListenCard(item, e)}
                  title="Escuchar explicación por voz"
                  className="absolute bottom-3 right-3 p-2 bg-white/90 hover:bg-white text-amber-700 rounded-full shadow-md backdrop-blur-sm transition-transform hover:scale-110"
                >
                  <Volume2 className="w-4 h-4" />
                </button>
              </div>

              {/* Content Card */}
              <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                <div>
                  <h3 className="text-lg font-bold text-stone-900 group-hover:text-amber-700 transition-colors">
                    {item.name}
                  </h3>
                  <p className="text-xs text-stone-600 mt-1 leading-relaxed">
                    {item.simpleUse}
                  </p>
                </div>

                {/* Safety & Usage */}
                <div className="space-y-2.5 pt-2 border-t border-stone-100">
                  <div className="bg-emerald-50/80 border border-emerald-200/60 rounded-xl p-3">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800 mb-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Cómo se agarra y usa con seguridad:</span>
                    </div>
                    <p className="text-xs text-emerald-950 leading-relaxed font-normal">
                      {item.safetyUsage}
                    </p>
                  </div>

                  {/* What NEVER to do */}
                  <div className="bg-rose-50 border border-rose-200 rounded-xl p-3">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-rose-800 mb-1">
                      <AlertOctagon className="w-3.5 h-3.5 text-rose-600" />
                      <span>Qué NUNCA debes hacer:</span>
                    </div>
                    <p className="text-xs text-rose-950 leading-relaxed font-medium">
                      {item.neverDo}
                    </p>
                  </div>

                  {item.proTip && (
                    <div className="flex items-start gap-1.5 text-[11px] text-amber-800 bg-amber-50/70 p-2 rounded-lg">
                      <Lightbulb className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                      <span><strong>Truco Chef:</strong> {item.proTip}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detail Modal */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-xl w-full overflow-hidden shadow-2xl border border-stone-200 max-h-[90vh] flex flex-col">
            <div className="relative h-56 w-full bg-stone-100">
              <img
                src={selectedItem.imageUrl}
                alt={selectedItem.name}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
              <button
                onClick={() => setSelectedItem(null)}
                className="absolute top-3 right-3 bg-stone-900/70 text-white p-2 rounded-full hover:bg-stone-900 transition-colors"
              >
                ✕
              </button>
              <div className="absolute bottom-3 left-3 bg-stone-900/80 backdrop-blur-md text-white px-3 py-1 rounded-full text-xs font-semibold">
                {selectedItem.category}
              </div>
            </div>

            <div className="p-6 overflow-y-auto space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-stone-900">{selectedItem.name}</h3>
                <button
                  onClick={(e) => handleListenCard(selectedItem, e)}
                  className="flex items-center gap-1.5 text-xs bg-amber-100 text-amber-900 font-semibold px-3 py-1.5 rounded-full hover:bg-amber-200"
                >
                  <Volume2 className="w-4 h-4" /> Escuchar
                </button>
              </div>

              <p className="text-sm text-stone-700 leading-relaxed bg-stone-50 p-3 rounded-xl border border-stone-200">
                {selectedItem.simpleUse}
              </p>

              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                <div className="flex items-center gap-2 font-bold text-sm text-emerald-900 mb-1">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Instrucción de agarre y seguridad:</span>
                </div>
                <p className="text-xs text-emerald-950 leading-relaxed">
                  {selectedItem.safetyUsage}
                </p>
              </div>

              <div className="bg-rose-50 border border-rose-300 rounded-xl p-4">
                <div className="flex items-center gap-2 font-bold text-sm text-rose-900 mb-1">
                  <ShieldAlert className="w-4 h-4 text-rose-600" />
                  <span>¡PELIGRO! Qué NUNCA debes hacer:</span>
                </div>
                <p className="text-xs text-rose-950 font-semibold leading-relaxed">
                  {selectedItem.neverDo}
                </p>
              </div>

              {selectedItem.proTip && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-950 flex items-start gap-2">
                  <Lightbulb className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="block font-bold">Consejo de Mentor:</strong>
                    {selectedItem.proTip}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
