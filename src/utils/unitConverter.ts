/**
 * Conversor Inteligente de Unidades Culinarias
 * Permite cambiar instantáneamente entre sistema Métrico (g / ml) y Casero (tazas / cucharadas).
 * Utiliza tablas de densidad real de ingredientes para evitar fallos de repostería y cocina.
 */

export type MeasurementSystem = 'metric' | 'household';

interface DensityRule {
  keywords: string[];
  gramsPerCup: number;
  gramsPerTbsp: number;
}

const DENSITY_RULES: DensityRule[] = [
  {
    keywords: ['harina', 'maicena', 'fécula', 'cacao en polvo'],
    gramsPerCup: 125,
    gramsPerTbsp: 8,
  },
  {
    keywords: ['azúcar blanca', 'azúcar morena', 'azúcar rubia', 'azúcar'],
    gramsPerCup: 200,
    gramsPerTbsp: 12.5,
  },
  {
    keywords: ['arroz', 'granos', 'lentejas', 'quinoa'],
    gramsPerCup: 185,
    gramsPerTbsp: 12,
  },
  {
    keywords: ['mantequilla', 'manteca', 'margarina'],
    gramsPerCup: 225,
    gramsPerTbsp: 14,
  },
  {
    keywords: ['leche', 'agua', 'caldo', 'vino', 'vinagre', 'jugo', 'salsa', 'crema'],
    gramsPerCup: 240, // 240 ml
    gramsPerTbsp: 15,
  },
  {
    keywords: ['aceite', 'oliva', 'vegetal'],
    gramsPerCup: 215, // 240 ml
    gramsPerTbsp: 14,
  },
  {
    keywords: ['sal'],
    gramsPerCup: 280,
    gramsPerTbsp: 18,
  },
  {
    keywords: ['queso rallado', 'parmesano'],
    gramsPerCup: 100,
    gramsPerTbsp: 7,
  },
];

function getDensityForIngredient(ingredientText: string): DensityRule {
  const lower = ingredientText.toLowerCase();
  for (const rule of DENSITY_RULES) {
    if (rule.keywords.some((kw) => lower.includes(kw))) {
      return rule;
    }
  }
  // Default estándar culinario
  return {
    keywords: [],
    gramsPerCup: 200,
    gramsPerTbsp: 15,
  };
}

/**
 * Convierte una cadena de ingrediente al sistema objetivo:
 * - 'metric': convierte tazas y cucharadas a gramos / mililitros
 * - 'household': convierte gramos y mililitros a tazas / cucharadas
 */
export function convertIngredientUnits(ingredientText: string, targetSystem: MeasurementSystem): string {
  if (!ingredientText) return '';
  const density = getDensityForIngredient(ingredientText);

  if (targetSystem === 'metric') {
    // Convertir de casero (tazas/cdas) a métrico (g / ml)
    return ingredientText.replace(
      /(\b\d+\/\d+|\b\d+(?:[.,]\d+)?)\s*(tazas?|taza\b|cucharadas?|cdas?|cucharaditas?|cdtas?)/gi,
      (match, numStr, unit) => {
        let val = 0;
        if (numStr.includes('/')) {
          const [n, d] = numStr.split('/').map(Number);
          if (d) val = n / d;
        } else {
          val = parseFloat(numStr.replace(',', '.'));
        }
        if (isNaN(val) || val <= 0) return match;

        const uLower = unit.toLowerCase();
        const isLiquid = /agua|leche|caldo|aceite|vino|vinagre|jugo|crema|salsa/i.test(ingredientText);

        if (uLower.startsWith('taza')) {
          const grams = Math.round(val * density.gramsPerCup);
          return isLiquid ? `${Math.round(val * 240)} ml` : `${grams} g`;
        } else if (uLower.startsWith('cucharada') || uLower.startsWith('cda')) {
          const grams = Math.round(val * density.gramsPerTbsp);
          return isLiquid ? `${Math.round(val * 15)} ml` : `${grams} g`;
        } else if (uLower.startsWith('cucharadita') || uLower.startsWith('cdta')) {
          const grams = Math.max(1, Math.round(val * (density.gramsPerTbsp / 3)));
          return isLiquid ? `${Math.round(val * 5)} ml` : `${grams} g`;
        }
        return match;
      }
    );
  }

  // targetSystem === 'household' (Gramos / ml -> Tazas / Cucharadas)
  return ingredientText.replace(
    /(\b\d+(?:[.,]\d+)?)\s*(gramos?|g\b|kg\b|ml\b|litros?|l\b)/gi,
    (match, numStr, unit) => {
      let val = parseFloat(numStr.replace(',', '.'));
      if (isNaN(val) || val <= 0) return match;

      const uLower = unit.toLowerCase();
      if (uLower === 'kg') val *= 1000;
      if (uLower.startsWith('l')) val *= 1000;

      const isLiquid = uLower === 'ml' || uLower.startsWith('l') || /agua|leche|caldo|aceite|vino|vinagre/i.test(ingredientText);
      const gramsPerCup = isLiquid ? 240 : density.gramsPerCup;
      const gramsPerTbsp = isLiquid ? 15 : density.gramsPerTbsp;

      // Si es una cantidad grande (>= 0.75 tazas aprox)
      if (val >= gramsPerCup * 0.75) {
        const cups = val / gramsPerCup;
        return formatFraction(cups, 'taza', 'tazas');
      } else if (val >= gramsPerCup * 0.4) {
        const cups = val / gramsPerCup;
        return formatFraction(cups, 'taza', 'tazas');
      } else if (val >= gramsPerTbsp * 1.5) {
        const tbsps = val / gramsPerTbsp;
        return formatFraction(tbsps, 'cucharada', 'cucharadas');
      } else if (val >= 3) {
        const tsps = val / (gramsPerTbsp / 3);
        return formatFraction(tsps, 'cucharadita', 'cucharaditas');
      }
      return match;
    }
  );
}

function formatFraction(val: number, singular: string, plural: string): string {
  const round = Math.round(val * 4) / 4;
  const unit = round === 1 ? singular : plural;

  if (Math.abs(round - 0.25) < 0.05) return `1/4 de ${unit}`;
  if (Math.abs(round - 0.33) < 0.05) return `1/3 de ${unit}`;
  if (Math.abs(round - 0.5) < 0.05) return `1/2 ${unit}`;
  if (Math.abs(round - 0.75) < 0.05) return `3/4 de ${unit}`;
  if (Math.abs(round - 1) < 0.05) return `1 ${singular}`;
  if (Math.abs(round - 1.25) < 0.05) return `1 y 1/4 ${plural}`;
  if (Math.abs(round - 1.5) < 0.05) return `1 y 1/2 ${plural}`;
  if (Math.abs(round - 2) < 0.05) return `2 ${plural}`;
  
  if (round > 2) {
    return `${Math.round(round)} ${plural}`;
  }
  return `${val.toFixed(1)} ${plural}`;
}
