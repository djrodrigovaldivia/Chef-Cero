import React, { useState, useEffect } from 'react';
import { ShoppingItem } from '../types';
import { ShoppingCart, Check, Trash2, Plus, Share2, Copy, CheckCheck, Sparkles } from 'lucide-react';

const CATEGORIES: ShoppingItem['category'][] = [
  'Verdulería & Frutas',
  'Carnicería & Huevos',
  'Almacén & Granos',
  'Lácteos & Quesos',
  'Especias & Aceites',
];

export const ShoppingListModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
}> = ({ isOpen, onClose }) => {
  const [items, setItems] = useState<ShoppingItem[]>(() => {
    try {
      const saved = localStorage.getItem('chef_cero_shopping_list');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [
      { id: '1', name: 'Huevos frescos', category: 'Carnicería & Huevos', quantity: '6 unid.', checked: false },
      { id: '2', name: 'Cebolla blanca o morada', category: 'Verdulería & Frutas', quantity: '2 unid.', checked: false },
      { id: '3', name: 'Dientes de ajo', category: 'Verdulería & Frutas', quantity: '1 cabeza', checked: false },
      { id: '4', name: 'Fideos espagueti o tallarines', category: 'Almacén & Granos', quantity: '1 paquete', checked: false },
      { id: '5', name: 'Aceite vegetal o de oliva', category: 'Especias & Aceites', quantity: '1 botella', checked: true },
    ];
  });

  const [newItemName, setNewItemName] = useState('');
  const [newItemCategory, setNewItemCategory] = useState<ShoppingItem['category']>('Verdulería & Frutas');
  const [newItemQty, setNewItemQty] = useState('');
  const [copiedToast, setCopiedToast] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem('chef_cero_shopping_list', JSON.stringify(items));
    } catch {}
  }, [items]);

  if (!isOpen) return null;

  const handleToggle = (id: string) => {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, checked: !it.checked } : it))
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

    const newItem: ShoppingItem = {
      id: 'shop-' + Date.now(),
      name: newItemName.trim(),
      category: newItemCategory,
      quantity: newItemQty.trim() || undefined,
      checked: false,
    };

    setItems((prev) => [newItem, ...prev]);
    setNewItemName('');
    setNewItemQty('');
  };

  const generateShareText = () => {
    const pending = items.filter((it) => !it.checked);
    if (pending.length === 0) return '🛒 Lista de compras (Chef Cero): ¡Todo listo!';

    let text = '🛒 *Lista del Súper (Chef Cero)*:\n\n';
    CATEGORIES.forEach((cat) => {
      const catItems = pending.filter((it) => it.category === cat);
      if (catItems.length > 0) {
        text += `*${cat}*:\n`;
        catItems.forEach((it) => {
          text += `  • ${it.name}${it.quantity ? ` (${it.quantity})` : ''}\n`;
        });
        text += '\n';
      }
    });
    text += '¡Listo para cocinar sin estrés! 🍳✨';
    return text;
  };

  const handleCopy = async () => {
    const text = generateShareText();
    try {
      await navigator.clipboard.writeText(text);
      setCopiedToast(true);
      setTimeout(() => setCopiedToast(false), 3000);
    } catch {
      // Fallback
    }
  };

  const handleShareWhatsApp = () => {
    const text = encodeURIComponent(generateShareText());
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
  };

  const pendingCount = items.filter((it) => !it.checked).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-stone-200 max-h-[92vh] flex flex-col space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-stone-200 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500 text-stone-950 flex items-center justify-center text-xl shadow-xs font-bold">
              🛒
            </div>
            <div>
              <h3 className="text-lg font-extrabold text-stone-900 font-serif">
                Lista de Compras Inteligente
              </h3>
              <p className="text-xs text-stone-500">
                Agrupada por pasillos del súper para comprar rápido y sin olvidos
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-600 flex items-center justify-center font-bold text-sm cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Add item form */}
        <form onSubmit={handleAddItem} className="space-y-2 bg-stone-50 p-3 rounded-2xl border border-stone-200">
          <div className="flex gap-2">
            <input
              type="text"
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              placeholder="Ej: Tomates, Aceite, Fideos..."
              className="flex-1 px-3 py-2 bg-white border border-stone-300 rounded-xl text-xs sm:text-sm focus:outline-hidden focus:ring-2 focus:ring-amber-500"
            />
            <input
              type="text"
              value={newItemQty}
              onChange={(e) => setNewItemQty(e.target.value)}
              placeholder="Cant. (ej: 500g)"
              className="w-24 sm:w-28 px-3 py-2 bg-white border border-stone-300 rounded-xl text-xs sm:text-sm focus:outline-hidden focus:ring-2 focus:ring-amber-500"
            />
          </div>
          <div className="flex items-center justify-between gap-2">
            <select
              value={newItemCategory}
              onChange={(e) => setNewItemCategory(e.target.value as any)}
              className="px-2.5 py-1.5 bg-white border border-stone-300 rounded-xl text-xs text-stone-700 font-medium focus:outline-hidden"
            >
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
            <button
              type="submit"
              disabled={!newItemName.trim()}
              className="px-4 py-1.5 bg-stone-900 hover:bg-stone-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Agregar</span>
            </button>
          </div>
        </form>

        {/* Items List grouped by category */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {items.length === 0 ? (
            <div className="text-center py-8 text-stone-400 text-xs">
              Tu lista de compras está vacía. Agrega ingredientes o importa desde una receta.
            </div>
          ) : (
            CATEGORIES.map((cat) => {
              const catItems = items.filter((it) => it.category === cat);
              if (catItems.length === 0) return null;

              return (
                <div key={cat} className="space-y-1.5">
                  <span className="text-[11px] font-bold text-stone-400 uppercase tracking-wider block px-1">
                    {cat} ({catItems.length})
                  </span>
                  <div className="space-y-1">
                    {catItems.map((item) => (
                      <div
                        key={item.id}
                        className={`flex items-center justify-between p-2.5 rounded-xl border transition ${
                          item.checked
                            ? 'bg-stone-50 border-stone-200 opacity-60'
                            : 'bg-white border-stone-200/90 shadow-2xs hover:border-amber-300'
                        }`}
                      >
                        <div
                          onClick={() => handleToggle(item.id)}
                          className="flex items-center gap-2.5 flex-1 cursor-pointer select-none"
                        >
                          <div
                            className={`w-5 h-5 rounded-lg flex items-center justify-center border transition ${
                              item.checked
                                ? 'bg-emerald-600 border-emerald-600 text-white'
                                : 'border-stone-300 bg-white'
                            }`}
                          >
                            {item.checked && <Check className="w-3.5 h-3.5" />}
                          </div>
                          <span
                            className={`text-xs font-medium ${
                              item.checked ? 'line-through text-stone-400' : 'text-stone-800'
                            }`}
                          >
                            {item.name}
                          </span>
                          {item.quantity && (
                            <span className="text-[11px] bg-stone-100 text-stone-600 px-2 py-0.5 rounded-md font-mono">
                              {item.quantity}
                            </span>
                          )}
                        </div>

                        <button
                          onClick={() => handleDelete(item.id)}
                          className="text-stone-400 hover:text-rose-600 p-1 rounded-lg transition"
                          title="Eliminar de la lista"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Actions: WhatsApp, Copiar, Limpiar */}
        <div className="border-t border-stone-200 pt-3 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="text-stone-500 font-medium">
              Pendientes: <strong className="text-stone-900">{pendingCount} artículos</strong>
            </span>
            {items.some((it) => it.checked) && (
              <button
                onClick={handleClearChecked}
                className="text-stone-500 hover:text-rose-600 text-xs font-medium cursor-pointer"
              >
                Limpiar comprados
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleShareWhatsApp}
              className="py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition shadow-xs cursor-pointer"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Enviar por WhatsApp</span>
            </button>

            <button
              onClick={handleCopy}
              className="py-2.5 px-3 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition shadow-xs cursor-pointer"
            >
              {copiedToast ? (
                <>
                  <CheckCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>¡Copiada al portapapeles!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
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
