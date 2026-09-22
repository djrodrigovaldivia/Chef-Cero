import React, { useState } from 'react';
import { Search, MapPin, AlertCircle, Clock, Sparkles, HelpCircle, Thermometer, ShieldAlert, ArrowRight, Check } from 'lucide-react';
import { STORAGE_ZONES, FOOD_ITEMS } from '../data/storageData';
import { FoodStorageItem, StorageZoneId } from '../types';

export const KitchenStorageMap: React.FC = () => {
  const [selectedFood, setSelectedFood] = useState<FoodStorageItem>(FOOD_ITEMS[0]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeZoneHover, setActiveZoneHover] = useState<StorageZoneId | null>(null);
  const [customFoodQuery, setCustomFoodQuery] = useState('');
  const [isAskingAi, setIsAskingAi] = useState(false);
  const [aiCustomResult, setAiCustomResult] = useState<any>(null);

  const filteredFoods = FOOD_ITEMS.filter((item) => {
    const q = searchQuery.toLowerCase();
    return (
      item.name.toLowerCase().includes(q) ||
      item.tags.some((t) => t.toLowerCase().includes(q)) ||
      STORAGE_ZONES[item.zoneId]?.name.toLowerCase().includes(q)
    );
  });

  const currentZone = STORAGE_ZONES[selectedFood?.zoneId || 'frutero'];

  const handleAskAiCustomFood = async () => {
    if (!customFoodQuery.trim()) return;
    setIsAskingAi(true);
    setAiCustomResult(null);

    try {
      const res = await fetch('/api/storage/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ foodName: customFoodQuery.trim() }),
      });
      const data = await res.json();
      setAiCustomResult(data);

      if (data.zoneId && STORAGE_ZONES[data.zoneId]) {
        // create virtual item
        const virtualFood: FoodStorageItem = {
          id: 'custom-' + Date.now(),
          name: data.foodName || customFoodQuery,
          zoneId: data.zoneId as StorageZoneId,
          imageUrl: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80',
          shelfLife: data.shelfLife || 'Consultar empaque',
          scientificReason: data.scientificReason || 'Ubicación determinada según humedad y temperatura óptima.',
          neverDoAlert: data.commonMistake || 'Evita romper la cadena de frío o la humedad.',
          bestStorageTip: 'Revisar frescura periódicamente.',
          tags: ['personalizado'],
        };
        setSelectedFood(virtualFood);
      }
    } catch (err) {
      console.warn('Error asking storage AI, fallback local heuristic:', err);
      // Fallback inteligente offline para no dejar al usuario sin respuesta
      const q = customFoodQuery.toLowerCase();
      let zoneId: StorageZoneId = 'alacena';
      let reason = 'Consérvalo en un lugar fresco, seco y protegido de la luz solar directa.';
      let shelfLife = '7 a 14 días';

      if (q.includes('leche') || q.includes('yogur') || q.includes('queso') || q.includes('crema')) {
        zoneId = 'refrigerador_medio';
        reason = 'Los lácteos requieren frío constante a 4°C-5°C para retardar bacterias lácticas.';
        shelfLife = '4 a 7 días abierto';
      } else if (q.includes('carne') || q.includes('pollo') || q.includes('pescado') || q.includes('marisco')) {
        zoneId = 'refrigerador_superior';
        reason = 'Las carnes y pescados requieren la zona más fría e higiénica del frigorífico o congelador.';
        shelfLife = '1 a 2 días en nevera, meses en freezer';
      } else if (q.includes('tomate') || q.includes('platan') || q.includes('banana') || q.includes('aguacate') || q.includes('palta')) {
        zoneId = 'frutero';
        reason = 'Maduran y conservan su textura mucho mejor a temperatura ambiente ventilada.';
        shelfLife = '4 a 6 días';
      } else if (q.includes('lechuga') || q.includes('zanahoria') || q.includes('verdura') || q.includes('espinaca')) {
        zoneId = 'refrigerador_cajon';
        reason = 'El cajón inferior conserva la humedad ideal evitando que las hojas se marchiten.';
        shelfLife = '5 a 7 días';
      }

      const virtualFood: FoodStorageItem = {
        id: 'custom-offline-' + Date.now(),
        name: customFoodQuery,
        zoneId,
        imageUrl: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80',
        shelfLife,
        scientificReason: reason,
        neverDoAlert: 'No guardes alimentos húmedos en bolsas de plástico herméticas sin ventilación.',
        bestStorageTip: 'Revisar frescura periódicamente antes de cocinar.',
        tags: ['personalizado', 'guía rápida'],
      };

      setSelectedFood(virtualFood);
      setAiCustomResult({
        foodName: customFoodQuery,
        zoneId,
        zoneName: STORAGE_ZONES[zoneId].name,
        scientificReason: reason,
        shelfLife,
        commonMistake: 'Evitar romper la cadena de frío o exponer a humedad excesiva.',
      });
    } finally {
      setIsAskingAi(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600/10 via-amber-500/5 to-transparent p-6 rounded-2xl border border-stone-200">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100 text-blue-900 text-xs font-semibold mb-2">
            <MapPin className="w-3.5 h-3.5 text-blue-700" />
            <span>Mapa del Hogar Interactivo</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-stone-900 font-serif">
            ¿Dónde va guardado esto en casa?
          </h2>
          <p className="text-stone-600 text-sm sm:text-base mt-1">
            Guardar las cosas en el lugar equivocado es la causa #1 de comida podrida y sabores arruinados. Toca cualquier alimento o búscalo y el mapa iluminará su zona exacta con la explicación científica.
          </p>
        </div>

        {/* Quick Search and custom AI query */}
        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="relative">
            <Search className="w-5 h-5 absolute left-3.5 top-3.5 text-stone-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar alimento (tomates, leche, papas, huevos...)"
              className="w-full pl-11 pr-4 py-3 bg-white border border-stone-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm text-stone-800"
            />
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={customFoodQuery}
              onChange={(e) => setCustomFoodQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAskAiCustomFood()}
              placeholder="¿No está en la lista? Pregunta a la IA..."
              className="flex-1 px-4 py-3 bg-white border border-stone-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-sm text-stone-800"
            />
            <button
              onClick={handleAskAiCustomFood}
              disabled={isAskingAi || !customFoodQuery.trim()}
              className="px-4 py-3 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold flex items-center gap-1.5 shadow-sm transition-all"
            >
              <Sparkles className="w-4 h-4" />
              <span>{isAskingAi ? 'Buscando...' : 'Consultar'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main 2-Column interactive dashboard */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Visual Kitchen Map (7 cols) */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-stone-200 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-stone-100 pb-3">
            <div>
              <h3 className="font-bold text-base text-stone-900 flex items-center gap-2">
                <span>Esquema Visual de Almacenamiento</span>
                <span className="text-xs font-normal text-stone-500">
                  (Las zonas se iluminan al seleccionar comida)
                </span>
              </h3>
            </div>
            <span className="text-xs bg-stone-100 text-stone-600 px-2.5 py-1 rounded-full font-medium">
              Interactúa con las zonas
            </span>
          </div>

          {/* Interactive Layout of Fridge & Kitchen */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
            {/* The Refrigerator Section (4 shelves) */}
            <div className="bg-stone-50 rounded-2xl border-2 border-stone-300 p-3.5 space-y-2.5 relative">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-sky-800 flex items-center gap-1">
                  ❄️ Refrigerador Familiar
                </span>
                <span className="text-[10px] text-stone-500">Puerta sellada</span>
              </div>

              {/* Shelf 1: Superior */}
              <div
                onClick={() => {
                  const item = FOOD_ITEMS.find((f) => f.zoneId === 'refrigerador_superior');
                  if (item) setSelectedFood(item);
                }}
                onMouseEnter={() => setActiveZoneHover('refrigerador_superior')}
                onMouseLeave={() => setActiveZoneHover(null)}
                className={`p-3 rounded-xl border-2 transition-all cursor-pointer ${
                  selectedFood.zoneId === 'refrigerador_superior'
                    ? 'bg-sky-50 border-sky-500 ring-4 ring-sky-200 shadow-md scale-[1.02]'
                    : 'bg-white border-stone-200 hover:border-sky-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="font-bold text-xs text-sky-950">1. Zona Superior Fría (4°C)</div>
                  <span className="text-[10px] bg-sky-100 text-sky-800 px-1.5 py-0.5 rounded font-medium">Estable</span>
                </div>
                <p className="text-[11px] text-stone-600 mt-1">
                  Sobras cocidas en tápers, leche abierta (¡al fondo!), quesos curados.
                </p>
              </div>

              {/* Shelf 2: Medio */}
              <div
                onClick={() => {
                  const item = FOOD_ITEMS.find((f) => f.zoneId === 'refrigerador_medio');
                  if (item) setSelectedFood(item);
                }}
                onMouseEnter={() => setActiveZoneHover('refrigerador_medio')}
                onMouseLeave={() => setActiveZoneHover(null)}
                className={`p-3 rounded-xl border-2 transition-all cursor-pointer ${
                  selectedFood.zoneId === 'refrigerador_medio'
                    ? 'bg-blue-50 border-blue-500 ring-4 ring-blue-200 shadow-md scale-[1.02]'
                    : 'bg-white border-stone-200 hover:border-blue-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="font-bold text-xs text-blue-950">2. Zona Media (5°C)</div>
                  <span className="text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded font-medium">Equilibrada</span>
                </div>
                <p className="text-[11px] text-stone-600 mt-1">
                  Huevos frescos en su cartón, yogures, quesos frescos, lácteos cerrados.
                </p>
              </div>

              {/* Shelf 3: Cajón de verduras */}
              <div
                onClick={() => {
                  const item = FOOD_ITEMS.find((f) => f.zoneId === 'refrigerador_cajon');
                  if (item) setSelectedFood(item);
                }}
                onMouseEnter={() => setActiveZoneHover('refrigerador_cajon')}
                onMouseLeave={() => setActiveZoneHover(null)}
                className={`p-3 rounded-xl border-2 transition-all cursor-pointer ${
                  selectedFood.zoneId === 'refrigerador_cajon'
                    ? 'bg-emerald-50 border-emerald-500 ring-4 ring-emerald-200 shadow-md scale-[1.02]'
                    : 'bg-white border-stone-200 hover:border-emerald-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="font-bold text-xs text-emerald-950">3. Cajón de Verduras (7-9°C)</div>
                  <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-medium">Humedad alta</span>
                </div>
                <p className="text-[11px] text-stone-600 mt-1">
                  Lechugas, espinacas, zanahorias, hierbas frescas envueltas, pepinos.
                </p>
              </div>

              {/* Shelf 4: Puerta de la nevera */}
              <div
                onClick={() => {
                  const item = FOOD_ITEMS.find((f) => f.zoneId === 'refrigerador_puerta');
                  if (item) setSelectedFood(item);
                }}
                onMouseEnter={() => setActiveZoneHover('refrigerador_puerta')}
                onMouseLeave={() => setActiveZoneHover(null)}
                className={`p-3 rounded-xl border-2 transition-all cursor-pointer ${
                  selectedFood.zoneId === 'refrigerador_puerta'
                    ? 'bg-cyan-50 border-cyan-500 ring-4 ring-cyan-200 shadow-md scale-[1.02]'
                    : 'bg-white border-stone-200 hover:border-cyan-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="font-bold text-xs text-cyan-950">4. Puerta del Refrigerador (8-10°C)</div>
                  <span className="text-[10px] bg-cyan-100 text-cyan-800 px-1.5 py-0.5 rounded font-medium">Fluctuante</span>
                </div>
                <p className="text-[11px] text-stone-600 mt-1">
                  Mermeladas, aderezos, mostazas, bebidas. (¡NUNCA leche abierta ni huevos!).
                </p>
              </div>
            </div>

            {/* Dry & Ambient Zones */}
            <div className="space-y-2.5">
              {/* Congelador */}
              <div
                onClick={() => {
                  const item = FOOD_ITEMS.find((f) => f.zoneId === 'congelador');
                  if (item) setSelectedFood(item);
                }}
                onMouseEnter={() => setActiveZoneHover('congelador')}
                onMouseLeave={() => setActiveZoneHover(null)}
                className={`p-3.5 rounded-xl border-2 transition-all cursor-pointer ${
                  selectedFood.zoneId === 'congelador'
                    ? 'bg-indigo-50 border-indigo-500 ring-4 ring-indigo-200 shadow-md scale-[1.02]'
                    : 'bg-stone-50 border-stone-200 hover:border-indigo-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="font-bold text-xs text-indigo-950 flex items-center gap-1.5">
                    <span>🧊 Congelador (-18°C)</span>
                  </div>
                  <span className="text-[10px] bg-indigo-100 text-indigo-800 px-1.5 py-0.5 rounded font-medium">Largo plazo</span>
                </div>
                <p className="text-[11px] text-stone-600 mt-1">
                  Carnes crudas porcionadas, pescados, pan rebanado para tostar, hielos.
                </p>
              </div>

              {/* Alacena Oscura y Fresca */}
              <div
                onClick={() => {
                  const item = FOOD_ITEMS.find((f) => f.zoneId === 'alacena');
                  if (item) setSelectedFood(item);
                }}
                onMouseEnter={() => setActiveZoneHover('alacena')}
                onMouseLeave={() => setActiveZoneHover(null)}
                className={`p-3.5 rounded-xl border-2 transition-all cursor-pointer ${
                  selectedFood.zoneId === 'alacena'
                    ? 'bg-amber-50 border-amber-600 ring-4 ring-amber-200 shadow-md scale-[1.02]'
                    : 'bg-stone-50 border-stone-200 hover:border-amber-400'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="font-bold text-xs text-amber-950 flex items-center gap-1.5">
                    <span>🚪 Alacena Fresca y Oscura (15-20°C)</span>
                  </div>
                  <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-medium">Seco</span>
                </div>
                <p className="text-[11px] text-stone-600 mt-1">
                  Papas (lejos de cebollas!), cebollas, ajos enteros, aceites de oliva, pan fresco, pastas secas.
                </p>
              </div>

              {/* Frutero Ambiente */}
              <div
                onClick={() => {
                  const item = FOOD_ITEMS.find((f) => f.zoneId === 'frutero');
                  if (item) setSelectedFood(item);
                }}
                onMouseEnter={() => setActiveZoneHover('frutero')}
                onMouseLeave={() => setActiveZoneHover(null)}
                className={`p-3.5 rounded-xl border-2 transition-all cursor-pointer ${
                  selectedFood.zoneId === 'frutero'
                    ? 'bg-orange-50 border-orange-500 ring-4 ring-orange-200 shadow-md scale-[1.02]'
                    : 'bg-stone-50 border-stone-200 hover:border-orange-400'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="font-bold text-xs text-orange-950 flex items-center gap-1.5">
                    <span>🧺 Frutero en Encimera (Ambiente)</span>
                  </div>
                  <span className="text-[10px] bg-orange-100 text-orange-800 px-1.5 py-0.5 rounded font-medium">Ventilación</span>
                </div>
                <p className="text-[11px] text-stone-600 mt-1">
                  ¡TOMATES FRESCOS! Plátanos, aguacates verdes, manzanas, cítricos.
                </p>
              </div>

              {/* Especiero */}
              <div
                onClick={() => {
                  const item = FOOD_ITEMS.find((f) => f.zoneId === 'especiero');
                  if (item) setSelectedFood(item);
                }}
                onMouseEnter={() => setActiveZoneHover('especiero')}
                onMouseLeave={() => setActiveZoneHover(null)}
                className={`p-3.5 rounded-xl border-2 transition-all cursor-pointer ${
                  selectedFood.zoneId === 'especiero'
                    ? 'bg-rose-50 border-rose-500 ring-4 ring-rose-200 shadow-md scale-[1.02]'
                    : 'bg-stone-50 border-stone-200 hover:border-rose-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="font-bold text-xs text-rose-950 flex items-center gap-1.5">
                    <span>🌿 Especiero Lejos del Vapor</span>
                  </div>
                  <span className="text-[10px] bg-rose-100 text-rose-800 px-1.5 py-0.5 rounded font-medium">Sin vapor</span>
                </div>
                <p className="text-[11px] text-stone-600 mt-1">
                  Sal, pimientas, orégano, páprika. Lejos del calor para que no pierdan aceites esenciales.
                </p>
              </div>
            </div>
          </div>

          {/* Quick Clickable Foods Carousel */}
          <div className="pt-2 border-t border-stone-100">
            <span className="text-xs font-semibold text-stone-500 block mb-2">
              Toca para consultar ubicación correcta:
            </span>
            <div className="flex flex-wrap gap-2">
              {filteredFoods.slice(0, 10).map((f) => (
                <button
                  key={f.id}
                  onClick={() => setSelectedFood(f)}
                  className={`text-xs px-3 py-1.5 rounded-full font-medium transition-all flex items-center gap-1.5 ${
                    selectedFood.id === f.id
                      ? 'bg-stone-900 text-white shadow-md'
                      : 'bg-stone-100 hover:bg-stone-200 text-stone-800'
                  }`}
                >
                  <span>{f.name}</span>
                  {selectedFood.id === f.id && <Check className="w-3 h-3 text-amber-400" />}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Detailed Scientific & Practical Food Card (5 cols) */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-lg">
          <div className="relative h-48 w-full bg-stone-100">
            <img
              src={selectedFood.imageUrl}
              alt={selectedFood.name}
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
            <div className="absolute top-3 left-3 bg-stone-900/85 backdrop-blur-md text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-amber-400" />
              <span>{currentZone?.name || 'Zona Asignada'}</span>
            </div>
            <div className="absolute bottom-3 right-3 bg-white/95 backdrop-blur-md text-stone-800 px-3 py-1 rounded-full text-xs font-semibold shadow flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-amber-600" />
              <span>{selectedFood.shelfLife}</span>
            </div>
          </div>

          <div className="p-5 space-y-4">
            <div>
              <h3 className="text-xl font-extrabold text-stone-900 font-serif">
                {selectedFood.name}
              </h3>
              <p className="text-xs text-amber-700 font-semibold mt-0.5">
                Ubicación obligatoria: {currentZone?.locationLabel}
              </p>
            </div>

            {/* Scientific reason */}
            <div className="bg-stone-50 border border-stone-200 rounded-xl p-3.5 space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-bold text-stone-800">
                <Thermometer className="w-4 h-4 text-blue-600" />
                <span>¿Por qué va aquí? (Razón práctica / científica):</span>
              </div>
              <p className="text-xs text-stone-700 leading-relaxed">
                {selectedFood.scientificReason}
              </p>
            </div>

            {/* Never Do Alert */}
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-3.5 space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-bold text-rose-800">
                <ShieldAlert className="w-4 h-4 text-rose-600" />
                <span>Error común que seguramente cometías:</span>
              </div>
              <p className="text-xs text-rose-950 font-medium leading-relaxed">
                {selectedFood.neverDoAlert}
              </p>
            </div>

            {/* Best Storage Tip */}
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800">
                <Check className="w-4 h-4 text-emerald-600" />
                <span>Cómo conservarlo como un chef profesional:</span>
              </div>
              <p className="text-xs text-emerald-950 leading-relaxed font-normal">
                {selectedFood.bestStorageTip}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
