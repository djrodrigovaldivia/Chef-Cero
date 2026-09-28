import React, { useState, useEffect } from 'react';
import {
  Calendar, X, Sparkles, Plus, Trash2, ShoppingCart, Share2,
  Check, ArrowRight, Utensils, Clock, ChevronRight, RefreshCw, ChefHat
} from 'lucide-react';
import { Recipe, ShoppingItem } from '../types';
import { STARTER_RECIPES } from '../data/recipeData';

export interface MealSlot {
  recipeId?: string;
  customTitle?: string;
  servings: number;
  ingredients: string[];
}

export interface DayPlan {
  dayName: string;
  dayShort: string;
  lunch?: MealSlot;
  dinner?: MealSlot;
}

const DEFAULT_DAYS: { dayName: string; dayShort: string }[] = [
  { dayName: 'Lunes', dayShort: 'Lun' },
  { dayName: 'Martes', dayShort: 'Mar' },
  { dayName: 'Miércoles', dayShort: 'Mié' },
  { dayName: 'Jueves', dayShort: 'Jue' },
  { dayName: 'Viernes', dayShort: 'Vie' },
  { dayName: 'Sábado', dayShort: 'Sáb' },
  { dayName: 'Domingo', dayShort: 'Dom' },
];

const PRESET_PLANS: Record<number, { lunchIndex: number; dinnerIndex: number }> = {
  0: { lunchIndex: 0, dinnerIndex: 2 }, // Lunes: Arroz con Huevo / Fideos Ajo y Aceite
  1: { lunchIndex: 1, dinnerIndex: 3 }, // Martes: Pollo Salteado / Tortilla
  2: { lunchIndex: 2, dinnerIndex: 0 }, // Miércoles: Fideos / Huevos cremosos
  3: { lunchIndex: 3, dinnerIndex: 1 }, // Jueves: Tortilla / Pollo salteado
  4: { lunchIndex: 1, dinnerIndex: 2 }, // Viernes: Salteado / Pasta
  5: { lunchIndex: 3, dinnerIndex: 0 }, // Sábado: Tortilla / Arroz
  6: { lunchIndex: 1, dinnerIndex: 3 }, // Domingo: Salteado especial / Tortilla
};

interface WeeklyMealPlannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  recipes: Recipe[];
  onOpenShoppingList: () => void;
  onSelectRecipeToCook: (recipe: Recipe) => void;
}

export const WeeklyMealPlannerModal: React.FC<WeeklyMealPlannerModalProps> = ({
  isOpen,
  onClose,
  recipes = STARTER_RECIPES,
  onOpenShoppingList,
  onSelectRecipeToCook,
}) => {
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const [weeklyPlan, setWeeklyPlan] = useState<Record<number, { lunch?: MealSlot; dinner?: MealSlot }>>(() => {
    try {
      const saved = localStorage.getItem('chef_cero_weekly_meal_plan');
      if (saved) return JSON.parse(saved);
    } catch {}
    // Generar plan por defecto equilibrado
    const initial: Record<number, { lunch?: MealSlot; dinner?: MealSlot }> = {};
    DEFAULT_DAYS.forEach((_, idx) => {
      const preset = PRESET_PLANS[idx] || { lunchIndex: 0, dinnerIndex: 1 };
      const lunchRec = recipes[preset.lunchIndex % recipes.length];
      const dinnerRec = recipes[preset.dinnerIndex % recipes.length];
      initial[idx] = {
        lunch: lunchRec
          ? {
              recipeId: lunchRec.id,
              customTitle: lunchRec.title,
              servings: 2,
              ingredients: lunchRec.miseEnPlace,
            }
          : undefined,
        dinner: dinnerRec
          ? {
              recipeId: dinnerRec.id,
              customTitle: dinnerRec.title,
              servings: 2,
              ingredients: dinnerRec.miseEnPlace,
            }
          : undefined,
      };
    });
    return initial;
  });

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [assigningSlot, setAssigningSlot] = useState<{ dayIndex: number; mealType: 'lunch' | 'dinner' } | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem('chef_cero_weekly_meal_plan', JSON.stringify(weeklyPlan));
    } catch {}
  }, [weeklyPlan]);

  if (!isOpen) return null;

  const currentDay = DEFAULT_DAYS[selectedDayIndex];
  const currentDayPlan = weeklyPlan[selectedDayIndex] || {};

  const handleAutoGeneratePlan = () => {
    const newPlan: Record<number, { lunch?: MealSlot; dinner?: MealSlot }> = {};
    DEFAULT_DAYS.forEach((_, idx) => {
      const lIndex = (idx * 2) % recipes.length;
      const dIndex = (idx * 2 + 1) % recipes.length;
      const lRec = recipes[lIndex];
      const dRec = recipes[dIndex];
      newPlan[idx] = {
        lunch: lRec ? { recipeId: lRec.id, customTitle: lRec.title, servings: 2, ingredients: lRec.miseEnPlace } : undefined,
        dinner: dRec ? { recipeId: dRec.id, customTitle: dRec.title, servings: 2, ingredients: dRec.miseEnPlace } : undefined,
      };
    });
    setWeeklyPlan(newPlan);
    setToastMessage('✨ Menú semanal equilibrado generado con éxito');
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleRemoveMeal = (dayIdx: number, type: 'lunch' | 'dinner') => {
    setWeeklyPlan((prev) => ({
      ...prev,
      [dayIdx]: {
        ...prev[dayIdx],
        [type]: undefined,
      },
    }));
  };

  const handleAssignRecipe = (recipe: Recipe) => {
    if (!assigningSlot) return;
    const { dayIndex, mealType } = assigningSlot;
    setWeeklyPlan((prev) => ({
      ...prev,
      [dayIndex]: {
        ...prev[dayIndex],
        [mealType]: {
          recipeId: recipe.id,
          customTitle: recipe.title,
          servings: 2,
          ingredients: recipe.miseEnPlace,
        },
      },
    }));
    setAssigningSlot(null);
  };

  const handleConsolidateToShoppingList = () => {
    // Recopilar todos los ingredientes planificados en la semana
    const allIngredients: string[] = [];
    Object.values(weeklyPlan).forEach((day) => {
      if (day.lunch?.ingredients) allIngredients.push(...day.lunch.ingredients);
      if (day.dinner?.ingredients) allIngredients.push(...day.dinner.ingredients);
    });

    if (allIngredients.length === 0) {
      setToastMessage('Agrega comidas al planificador antes de generar la lista.');
      setTimeout(() => setToastMessage(null), 3000);
      return;
    }

    try {
      const existing: ShoppingItem[] = JSON.parse(localStorage.getItem('chef_cero_shopping_list') || '[]');
      const newItems: ShoppingItem[] = allIngredients.map((ing, idx) => ({
        id: `mealplan-${Date.now()}-${idx}`,
        name: ing,
        category: ing.match(/pollo|carne|vacuno|huevo/i)
          ? 'Carnicería & Huevos'
          : ing.match(/leche|queso|mantequilla/i)
          ? 'Lácteos & Quesos'
          : ing.match(/cebolla|ajo|tomate|papa|zanahoria/i)
          ? 'Verdulería & Frutas'
          : ing.match(/aceite|sal|pimienta|orégano/i)
          ? 'Especias & Aceites'
          : 'Almacén & Granos',
        checked: false,
        recipeSource: 'Planificador Semanal',
      }));

      // Unificar y guardar
      localStorage.setItem('chef_cero_shopping_list', JSON.stringify([...newItems, ...existing]));
      setToastMessage(`✅ ¡${newItems.length} ingredientes consolidados y guardados en tu Lista de Supermercado!`);
      setTimeout(() => {
        setToastMessage(null);
        onOpenShoppingList();
      }, 1500);
    } catch {}
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-950/70 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white rounded-3xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl border border-stone-200 max-h-[92vh] flex flex-col space-y-4 overflow-hidden">
        {/* Encabezado */}
        <div className="flex items-center justify-between border-b border-stone-100 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500 text-stone-950 flex items-center justify-center text-xl shadow-xs font-bold">
              🗓️
            </div>
            <div>
              <h3 className="text-lg font-black text-stone-900 font-serif">
                Planificador Semanal Inteligente
              </h3>
              <p className="text-xs text-stone-500">
                Organiza tu semana culinaria sin estrés y genera tu lista de supermercado consolidada
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

        {/* Notificación Toast */}
        {toastMessage && (
          <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 animate-in fade-in">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Selector de Días de la Semana */}
        <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
          {DEFAULT_DAYS.map((d, idx) => {
            const isSelected = selectedDayIndex === idx;
            const hasMeals = weeklyPlan[idx]?.lunch || weeklyPlan[idx]?.dinner;
            return (
              <button
                key={d.dayShort}
                onClick={() => setSelectedDayIndex(idx)}
                className={`py-2 px-1 rounded-2xl flex flex-col items-center justify-center transition border cursor-pointer ${
                  isSelected
                    ? 'bg-amber-500 text-stone-950 font-black border-amber-600 shadow-xs ring-2 ring-amber-400/40'
                    : 'bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100'
                }`}
              >
                <span className="text-[11px] font-bold uppercase">{d.dayShort}</span>
                <span className="w-1.5 h-1.5 rounded-full mt-1 bg-current opacity-80" style={{ visibility: hasMeals ? 'visible' : 'hidden' }} />
              </button>
            );
          })}
        </div>

        {/* Vista del Día Seleccionado */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          <div className="flex items-center justify-between">
            <h4 className="text-base font-extrabold text-stone-900">
              Menú del {currentDay.dayName}
            </h4>
            <button
              onClick={handleAutoGeneratePlan}
              className="px-3 py-1.5 bg-amber-50 border border-amber-200 hover:bg-amber-100 text-amber-900 text-xs font-bold rounded-xl flex items-center gap-1.5 transition cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
              <span>Sugerir Todo con IA</span>
            </button>
          </div>

          {/* Tarjeta Almuerzo */}
          <div className="p-4 rounded-2xl border border-stone-200 bg-stone-50/80 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-800 flex items-center gap-1.5">
                ☀️ Almuerzo
              </span>
              {currentDayPlan.lunch && (
                <button
                  onClick={() => handleRemoveMeal(selectedDayIndex, 'lunch')}
                  className="text-stone-400 hover:text-rose-600 transition"
                  title="Eliminar del plan"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {currentDayPlan.lunch ? (
              <div className="flex items-center justify-between gap-3 bg-white p-3 rounded-xl border border-stone-200 shadow-2xs">
                <div>
                  <h5 className="text-sm font-bold text-stone-900">
                    {currentDayPlan.lunch.customTitle}
                  </h5>
                  <span className="text-[11px] text-stone-500">
                    2 porciones • {currentDayPlan.lunch.ingredients.length} ingredientes
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {recipes.find((r) => r.id === currentDayPlan.lunch?.recipeId) && (
                    <button
                      onClick={() => {
                        const rec = recipes.find((r) => r.id === currentDayPlan.lunch?.recipeId);
                        if (rec) {
                          onSelectRecipeToCook(rec);
                          onClose();
                        }
                      }}
                      className="px-2.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-stone-950 font-bold rounded-lg text-xs flex items-center gap-1 cursor-pointer transition"
                    >
                      <ChefHat className="w-3 h-3" />
                      <span>Cocinar</span>
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <button
                onClick={() => setAssigningSlot({ dayIndex: selectedDayIndex, mealType: 'lunch' })}
                className="w-full py-3 border-2 border-dashed border-stone-300 hover:border-amber-400 rounded-xl text-stone-500 hover:text-amber-900 text-xs font-bold flex items-center justify-center gap-1.5 bg-white transition cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Asignar Almuerzo</span>
              </button>
            )}
          </div>

          {/* Tarjeta Cena */}
          <div className="p-4 rounded-2xl border border-stone-200 bg-stone-50/80 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-800 flex items-center gap-1.5">
                🌙 Cena
              </span>
              {currentDayPlan.dinner && (
                <button
                  onClick={() => handleRemoveMeal(selectedDayIndex, 'dinner')}
                  className="text-stone-400 hover:text-rose-600 transition"
                  title="Eliminar del plan"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {currentDayPlan.dinner ? (
              <div className="flex items-center justify-between gap-3 bg-white p-3 rounded-xl border border-stone-200 shadow-2xs">
                <div>
                  <h5 className="text-sm font-bold text-stone-900">
                    {currentDayPlan.dinner.customTitle}
                  </h5>
                  <span className="text-[11px] text-stone-500">
                    2 porciones • {currentDayPlan.dinner.ingredients.length} ingredientes
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {recipes.find((r) => r.id === currentDayPlan.dinner?.recipeId) && (
                    <button
                      onClick={() => {
                        const rec = recipes.find((r) => r.id === currentDayPlan.dinner?.recipeId);
                        if (rec) {
                          onSelectRecipeToCook(rec);
                          onClose();
                        }
                      }}
                      className="px-2.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-stone-950 font-bold rounded-lg text-xs flex items-center gap-1 cursor-pointer transition"
                    >
                      <ChefHat className="w-3 h-3" />
                      <span>Cocinar</span>
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <button
                onClick={() => setAssigningSlot({ dayIndex: selectedDayIndex, mealType: 'dinner' })}
                className="w-full py-3 border-2 border-dashed border-stone-300 hover:border-amber-400 rounded-xl text-stone-500 hover:text-amber-900 text-xs font-bold flex items-center justify-center gap-1.5 bg-white transition cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Asignar Cena</span>
              </button>
            )}
          </div>
        </div>

        {/* Modal / Selector de Recetas para Asignar */}
        {assigningSlot && (
          <div className="fixed inset-0 z-60 bg-stone-950/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-md w-full p-5 space-y-3 shadow-2xl border border-stone-200">
              <div className="flex items-center justify-between">
                <h5 className="font-bold text-stone-900 text-sm">
                  Elige una receta para el {DEFAULT_DAYS[assigningSlot.dayIndex].dayName} ({assigningSlot.mealType === 'lunch' ? 'Almuerzo' : 'Cena'})
                </h5>
                <button
                  onClick={() => setAssigningSlot(null)}
                  className="text-stone-400 hover:text-stone-600 text-sm font-bold"
                >
                  ✕
                </button>
              </div>

              <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                {recipes.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => handleAssignRecipe(r)}
                    className="w-full text-left p-3 rounded-xl border border-stone-200 hover:border-amber-400 hover:bg-amber-50/50 flex items-center justify-between gap-2 transition cursor-pointer"
                  >
                    <div>
                      <div className="font-bold text-stone-900 text-xs">{r.title}</div>
                      <div className="text-[10px] text-stone-500">{r.totalTimeMinutes} min • {r.difficulty}</div>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-stone-400" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Pie de Acciones: Consolidar al Súper y WhatsApp */}
        <div className="border-t border-stone-200 pt-3 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-stone-500">
            Ahorra hasta un <strong className="text-emerald-700">35% de presupuesto</strong> comprando solo lo planificado.
          </div>

          <button
            onClick={handleConsolidateToShoppingList}
            className="w-full sm:w-auto px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black flex items-center justify-center gap-2 shadow-xs transition cursor-pointer"
          >
            <ShoppingCart className="w-4 h-4" />
            <span>Generar Lista de Supermercado</span>
          </button>
        </div>
      </div>
    </div>
  );
};
