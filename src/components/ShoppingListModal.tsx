import React, { useState, useEffect, useMemo } from 'react';
import { ShoppingItem } from '../types';
import { ShoppingCart, Check, Trash2, Plus, Share2, Copy, CheckCheck, Sparkles, Lightbulb, RotateCcw } from 'lucide-react';

export const SUPERMARKET_AISLES = [
  '🥬 Verdulería y Frescos',
  '🥩 Carnes y Lácteos',
  '🥫 Alacena, Especias y Aceites',
  '🥖 Panadería y Varios',
] as const;

export type SupermarketAisle = typeof SUPERMARKET_AISLES[number];

// Mapeo seguro para categorizar cualquier ingrediente o categoría previa en los 4 pasillos canónicos
export function mapToAisle(categoryOrName: string): SupermarketAisle {
  const text = categoryOrName.toLowerCase();
  if (
    text.includes('verdur') ||
    text.includes('fruta') ||
    text.includes('fresco') ||
    text.includes('tomate') ||
    text.includes('cebolla') ||
    text.includes('ajo') ||
    text.includes('zanahoria') ||
    text.includes('papa') ||
    text.includes('limón') ||
    text.includes('limon') ||
    text.includes('cilantro') ||
    text.includes('perejil')
  ) {
    return '🥬 Verdulería y Frescos';
  }

  if (
    text.includes('carne') ||
    text.includes('pollo') ||
    text.includes('huevo') ||
    text.includes('lácteo') ||
    text.includes('lacteo') ||
    text.includes('queso') ||
    text.includes('leche') ||
    text.includes('crema') ||
    text.includes('manteca') ||
    text.includes('mantequilla') ||
    text.includes('pescado') ||
    text.includes('jamón') ||
    text.includes('jamon')
  ) {
    return '🥩 Carnes y Lácteos';
  }

  if (
    text.includes('pan') ||
    text.includes('tostada') ||
    text.includes('bollería') ||
    text.includes('tortilla') ||
    text.includes('varios') ||
    text.includes('limpieza') ||
    text.includes('papel')
  ) {
    return '🥖 Panadería y Varios';
  }

  return '🥫 Alacena, Especias y Aceites';
}

interface PurchaseHabit {
  name: string;
  category: SupermarketAisle;
  defaultQty?: string;
  frequency: number;
  lastPurchased: number;
}

const DEFAULT_STAPLES: PurchaseHabit[] = [
  { name: 'Huevos frescos', category: '🥩 Carnes y Lácteos', defaultQty: '6 unid.', frequency: 5, lastPurchased: Date.now() - 86400000 * 4 },
  { name: 'Aceite de oliva o vegetal', category: '🥫 Alacena, Especias y Aceites', defaultQty: '1 botella', frequency: 5, lastPurchased: Date.now() - 86400000 * 7 },
  { name: 'Cebolla blanca o morada', category: '🥬 Verdulería y Frescos', defaultQty: '2 unid.', frequency: 4, lastPurchased: Date.now() - 86400000 * 3 },
  { name: 'Dientes de ajo', category: '🥬 Verdulería y Frescos', defaultQty: '1 cabeza', frequency: 4, lastPurchased: Date.now() - 86400000 * 5 },
  { name: 'Sal fina o marina', category: '🥫 Alacena, Especias y Aceites', defaultQty: '1 paquete', frequency: 3, lastPurchased: Date.now() - 86400000 * 12 },
  { name: 'Leche entera o vegetal', category: '🥩 Carnes y Lácteos', defaultQty: '1 litro', frequency: 3, lastPurchased: Date.now() - 86400000 * 4 },
  { name: 'Pan fresco o de molde', category: '🥖 Panadería y Varios', defaultQty: '1 unidad', frequency: 3, lastPurchased: Date.now() - 86400000 * 2 },
  { name: 'Pimienta negra molida', category: '🥫 Alacena, Especias y Aceites', defaultQty: '1 frasco', frequency: 2, lastPurchased: Date.now() - 86400000 * 14 },
];

export const ShoppingListModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
}> = ({ isOpen, onClose }) => {
  // Lista de compras activa
  const [items, setItems] = useState<ShoppingItem[]>(() => {
    try {
      const saved = localStorage.getItem('chef_cero_shopping_list');
      if (saved) {
        const parsed: ShoppingItem[] = JSON.parse(saved);
        // Migrar categorías a los 4 pasillos
        return parsed.map((item) => ({
          ...item,
          category: mapToAisle(item.category || item.name) as any,
        }));
      }
    } catch {}
    return [
      { id: '1', name: 'Huevos frescos', category: '🥩 Carnes y Lácteos' as any, quantity: '6 unid.', checked: false },
      { id: '2', name: 'Cebolla blanca o morada', category: '🥬 Verdulería y Frescos' as any, quantity: '2 unid.', checked: false },
      { id: '3', name: 'Dientes de ajo', category: '🥬 Verdulería y Frescos' as any, quantity: '1 cabeza', checked: false },
      { id: '4', name: 'Fideos espagueti o arroz', category: '🥫 Alacena, Especias y Aceites' as any, quantity: '1 paquete', checked: false },
      { id: '5', name: 'Aceite de oliva o girasol', category: '🥫 Alacena, Especias y Aceites' as any, quantity: '1 botella', checked: true },
    ];
  });

  // Hábitos de compra aprendidos por la IA
  const [purchaseHabits, setPurchaseHabits] = useState<PurchaseHabit[]>(() => {
    try {
      const saved = localStorage.getItem('chef_cero_purchase_habits');
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_STAPLES;
  });

  const [newItemName, setNewItemName] = useState('');
  const [newItemAisle, setNewItemAisle] = useState<SupermarketAisle>('🥬 Verdulería y Frescos');
  const [newItemQty, setNewItemQty] = useState('');
  const [copiedToast, setCopiedToast] = useState(false);
  const [selectedAisleFilter, setSelectedAisleFilter] = useState<'all' | SupermarketAisle>('all');

  // Guardar lista en localStorage
  useEffect(() => {
    try {
      localStorage.setItem('chef_cero_shopping_list', JSON.stringify(items));
    } catch {}
  }, [items]);

  // Guardar hábitos en localStorage
  useEffect(() => {
    try {
      localStorage.setItem('chef_cero_purchase_habits', JSON.stringify(purchaseHabits));
    } catch {}
  }, [purchaseHabits]);

  // Auto-clasificar pasillo al escribir el nombre
  const handleNameChange = (val: string) => {
    setNewItemName(val);
    if (val.trim().length >= 3) {
      setNewItemAisle(mapToAisle(val));
    }
  };

  // Registrar compra / hábito cuando un ítem se marca como comprado
  const recordHabit = (name: string, aisle: SupermarketAisle, qty?: string) => {
    const cleanName = name.trim();
    if (!cleanName) return;

    setPurchaseHabits((prev) => {
      const idx = prev.findIndex((h) => h.name.toLowerCase() === cleanName.toLowerCase());
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = {
          ...updated[idx],
          frequency: updated[idx].frequency + 1,
          lastPurchased: Date.now(),
          defaultQty: qty || updated[idx].defaultQty,
        };
        return updated;
      }
      return [
        ...prev,
        {
          name: cleanName,
          category: aisle,
          defaultQty: qty,
          frequency: 1,
          lastPurchased: Date.now(),
        },
      ];
    });
  };

  const handleToggle = (id: string) => {
    setItems((prev) =>
      prev.map((it) => {
        if (it.id === id) {
          const nextChecked = !it.checked;
          if (nextChecked) {
            recordHabit(it.name, mapToAisle(it.category as string), it.quantity);
          }
          return { ...it, checked: nextChecked };
        }
        return it;
      })
    );
  };

  const handleDelete = (id: string) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
  };

  const handleClearChecked = () => {
    setItems((prev) => prev.filter((it) => !it.checked));
  };

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim()) return;

    const aisle = newItemAisle || mapToAisle(newItemName);
    const newItem: ShoppingItem = {
      id: 'shop-' + Date.now(),
      name: newItemName.trim(),
      category: aisle as any,
      quantity: newItemQty.trim() || undefined,
      checked: false,
    };

    setItems((prev) => [newItem, ...prev]);
    recordHabit(newItemName.trim(), aisle, newItemQty.trim());
    setNewItemName('');
    setNewItemQty('');
  };

  // Añadir básico sugerido por la IA con 1 toque
  const handleAddStaple = (habit: PurchaseHabit) => {
    const exists = items.some((it) => it.name.toLowerCase() === habit.name.toLowerCase() && !it.checked);
    if (exists) return;

    const newItem: ShoppingItem = {
      id: 'shop-' + Date.now() + '-' + Math.random().toString(36).substring(2, 5),
      name: habit.name,
      category: habit.category as any,
      quantity: habit.defaultQty,
      checked: false,
    };

    setItems((prev) => [newItem, ...prev]);
  };

  // Búsqueda de básicos que NO están en la lista actual de pendientes
  const suggestedStaples = useMemo(() => {
    const pendingNames = items.filter((it) => !it.checked).map((it) => it.name.toLowerCase());
    return purchaseHabits
      .filter((h) => !pendingNames.some((p) => p.includes(h.name.toLowerCase()) || h.name.toLowerCase().includes(p)))
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 4);
  }, [items, purchaseHabits]);

  const generateShareText = () => {
    const pending = items.filter((it) => !it.checked);
    if (pending.length === 0) return '🛒 Lista del Súper (Chef Cero): ¡Todo listo!';

    let text = '🛒 *Lista del Súper por Pasillos (Chef Cero)*:\n\n';
    SUPERMARKET_AISLES.forEach((aisle) => {
      const aisleItems = pending.filter((it) => mapToAisle(it.category as string) === aisle);
      if (aisleItems.length > 0) {
        text += `*${aisle}*:\n`;
        aisleItems.forEach((it) => {
          text += `  ☐ ${it.name}${it.quantity ? ` (${it.quantity})` : ''}\n`;
        });
        text += '\n';
      }
    });
    text += 'Organizado para cruzar el súper en la mitad del tiempo 🚀';
    return text;
  };

  const handleCopy = async () => {
    const text = generateShareText();
    try {
      await navigator.clipboard.writeText(text);
      setCopiedToast(true);
      setTimeout(() => setCopiedToast(false), 3000);
    } catch {}
  };

  const handleShareWhatsApp = () => {
    const text = encodeURIComponent(generateShareText());
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
  };

  const pendingCount = items.filter((it) => !it.checked).length;
  const completedCount = items.filter((it) => it.checked).length;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-950/70 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl border border-stone-200 max-h-[92vh] flex flex-col space-y-4">
        {/* Cabecera Zen */}
        <div className="flex items-center justify-between border-b border-stone-100 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500 text-stone-950 flex items-center justify-center text-lg font-black shadow-xs">
              🛒
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-stone-900 font-serif leading-tight">
                Lista de Supermercado
              </h3>
              <p className="text-xs text-stone-500">
                Organizada por pasillos para comprar rápido y sin estrés
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-600 flex items-center justify-center font-bold text-sm transition cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Formulario rápido para añadir producto */}
        <form onSubmit={handleAddItem} className="space-y-2 bg-stone-50 p-3 rounded-2xl border border-stone-200/80">
          <div className="flex gap-2">
            <input
              type="text"
              value={newItemName}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="¿Qué vas a comprar? (ej: Huevos, Cebolla, Aceite...)"
              className="flex-1 px-3 py-2 bg-white border border-stone-300 rounded-xl text-xs sm:text-sm font-medium focus:outline-hidden focus:ring-2 focus:ring-amber-500"
            />
            <input
              type="text"
              value={newItemQty}
              onChange={(e) => setNewItemQty(e.target.value)}
              placeholder="Cant. (ej: 1 kg)"
              className="w-24 sm:w-28 px-3 py-2 bg-white border border-stone-300 rounded-xl text-xs sm:text-sm font-medium focus:outline-hidden focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <div className="flex items-center justify-between gap-2">
            <select
              value={newItemAisle}
              onChange={(e) => setNewItemAisle(e.target.value as SupermarketAisle)}
              className="px-2.5 py-1.5 bg-white border border-stone-300 rounded-xl text-xs text-stone-700 font-semibold focus:outline-hidden"
            >
              {SUPERMARKET_AISLES.map((aisle) => (
                <option key={aisle} value={aisle}>
                  {aisle}
                </option>
              ))}
            </select>

            <button
              type="submit"
              disabled={!newItemName.trim()}
              className="px-4 py-2 bg-stone-950 hover:bg-stone-800 disabled:opacity-40 text-white rounded-xl text-xs font-black flex items-center gap-1.5 transition cursor-pointer shadow-xs active:scale-98"
            >
              <Plus className="w-4 h-4" />
              <span>Agregar</span>
            </button>
          </div>
        </form>

        {/* Filtro de pasillos rápido */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
          <button
            type="button"
            onClick={() => setSelectedAisleFilter('all')}
            className={`px-3 py-1 rounded-full font-bold transition shrink-0 cursor-pointer ${
              selectedAisleFilter === 'all'
                ? 'bg-stone-900 text-white'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
          >
            Todos ({items.length})
          </button>
          {SUPERMARKET_AISLES.map((aisle) => {
            const count = items.filter((it) => mapToAisle(it.category as string) === aisle).length;
            if (count === 0 && selectedAisleFilter !== aisle) return null;
            return (
              <button
                key={aisle}
                type="button"
                onClick={() => setSelectedAisleFilter(aisle)}
                className={`px-2.5 py-1 rounded-full font-semibold transition shrink-0 cursor-pointer text-[11px] ${
                  selectedAisleFilter === aisle
                    ? 'bg-amber-500 text-stone-950 font-black'
                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                }`}
              >
                {aisle.split(' ')[0]} {aisle.split(' ')[1]} ({count})
              </button>
            );
          })}
        </div>

        {/* Lista de compras agrupada por pasillos */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {items.length === 0 ? (
            <div className="text-center py-10 px-4 bg-stone-50 rounded-2xl border border-dashed border-stone-200 text-stone-400 text-xs">
              <p className="font-semibold text-stone-600 mb-1">Tu lista del súper está limpia</p>
              <span>Agrega los ingredientes que necesites o toca una de las sugerencias inteligentes de abajo.</span>
            </div>
          ) : (
            SUPERMARKET_AISLES.map((aisle) => {
              if (selectedAisleFilter !== 'all' && selectedAisleFilter !== aisle) return null;
              const aisleItems = items.filter((it) => mapToAisle(it.category as string) === aisle);
              if (aisleItems.length === 0) return null;

              return (
                <div key={aisle} className="space-y-1.5">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-[11px] font-black text-stone-500 uppercase tracking-wider">
                      {aisle}
                    </span>
                    <span className="text-[10px] text-stone-400 font-mono">
                      {aisleItems.filter((i) => i.checked).length}/{aisleItems.length}
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    {aisleItems.map((item) => (
                      <div
                        key={item.id}
                        className={`flex items-center justify-between p-3 rounded-2xl border transition-all ${
                          item.checked
                            ? 'bg-stone-50 border-stone-200 opacity-60'
                            : 'bg-white border-stone-200 shadow-2xs hover:border-amber-400'
                        }`}
                      >
                        <div
                          onClick={() => handleToggle(item.id)}
                          className="flex items-center gap-3 flex-1 cursor-pointer select-none min-h-[36px]"
                        >
                          {/* Casilla táctil grande */}
                          <div
                            className={`w-6 h-6 rounded-lg flex items-center justify-center border-2 transition-all ${
                              item.checked
                                ? 'bg-emerald-600 border-emerald-600 text-white'
                                : 'border-stone-300 bg-stone-50 hover:border-amber-500'
                            }`}
                          >
                            {item.checked && <Check className="w-4 h-4 stroke-[3]" />}
                          </div>

                          <span
                            className={`text-sm font-semibold transition ${
                              item.checked ? 'line-through text-stone-400 font-normal' : 'text-stone-900'
                            }`}
                          >
                            {item.name}
                          </span>

                          {item.quantity && (
                            <span className="text-xs bg-stone-100 text-stone-600 px-2 py-0.5 rounded-lg font-mono ml-auto mr-2">
                              {item.quantity}
                            </span>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => handleDelete(item.id)}
                          className="text-stone-300 hover:text-rose-600 p-2 rounded-xl transition cursor-pointer"
                          title="Eliminar de la lista"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })
          )}

          {/* MOTOR PREDICTIVO DE OLVIDOS (Estilo AnyList + IA de Hábitos) */}
          {suggestedStaples.length > 0 && (
            <div className="p-3.5 bg-gradient-to-r from-amber-50 via-orange-50/50 to-amber-50 rounded-2xl border border-amber-200/80 space-y-2 mt-4">
              <div className="flex items-center gap-2">
                <Lightbulb className="w-4 h-4 text-amber-600 shrink-0" />
                <span className="text-xs font-black text-amber-950 font-serif">
                  ¿No te estás olvidando de tus básicos habituales?
                </span>
              </div>
              <p className="text-[11px] text-amber-900/80 leading-snug">
                Sueles comprar estos ingredientes con frecuencia. Toca para agregarlos si te quedan pocos:
              </p>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {suggestedStaples.map((habit) => (
                  <button
                    key={habit.name}
                    type="button"
                    onClick={() => handleAddStaple(habit)}
                    className="px-2.5 py-1 rounded-xl bg-white hover:bg-amber-100 text-stone-900 text-xs font-bold border border-amber-300/80 shadow-2xs flex items-center gap-1 transition cursor-pointer active:scale-95"
                    title={`Agregar ${habit.name} a ${habit.category}`}
                  >
                    <Plus className="w-3 h-3 text-amber-700" />
                    <span>{habit.name}</span>
                    {habit.defaultQty && (
                      <span className="text-[10px] text-stone-400 font-normal">({habit.defaultQty})</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Acciones del pie: WhatsApp, Copiar y Limpiar */}
        <div className="border-t border-stone-100 pt-3 space-y-2.5">
          <div className="flex items-center justify-between text-xs px-1">
            <span className="text-stone-500 font-medium">
              Por comprar: <strong className="text-stone-900 font-mono">{pendingCount}</strong> · Comprados:{' '}
              <strong className="text-emerald-700 font-mono">{completedCount}</strong>
            </span>
            {completedCount > 0 && (
              <button
                type="button"
                onClick={handleClearChecked}
                className="text-stone-500 hover:text-rose-600 text-xs font-semibold cursor-pointer transition"
              >
                Limpiar comprados
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleShareWhatsApp}
              className="py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition shadow-xs cursor-pointer active:scale-98"
            >
              <Share2 className="w-4 h-4" />
              <span>Enviar por WhatsApp</span>
            </button>

            <button
              type="button"
              onClick={handleCopy}
              className="py-2.5 px-3 bg-stone-950 hover:bg-stone-800 text-white rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition shadow-xs cursor-pointer active:scale-98"
            >
              {copiedToast ? (
                <>
                  <CheckCheck className="w-4 h-4 text-emerald-400" />
                  <span>¡Copiada al portapapeles!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Copiar Lista</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
