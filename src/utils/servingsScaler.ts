/**
 * Utilidad inteligente para escalar cantidades en ingredientes y textos de Mise en Place.
 * Reconoce números enteros, decimales y fracciones comunes (1/2, 1/4, 3/4, 1.5, etc.) multiplicándolos por el ratio.
 * Maneja tanto unidades de medida como nombres de alimentos directos (ej: "2 papas", "1/2 cebolla", "300g fideos").
 */

export function scaleIngredientText(ingredient: string, originalServings: number, targetServings: number): string {
  if (!originalServings || !targetServings || originalServings === targetServings) {
    return ingredient;
  }

  const ratio = targetServings / originalServings;

  // Lista amplia de unidades y alimentos comunes cuantificables
  const unitsRegex = new RegExp(
    '(\\b\\d+\\/\\d+|\\b\\d+(?:[.,]\\d+)?)\\s*(huevos?|claras?|yemas?|dientes?|tazas?|cucharadas?|cdas?|cucharaditas?|cdtas?|gramos?|g\\b|kg\\b|ml\\b|litros?|l\\b|rebanadas?|piezas?|unid(?:ades)?\\.?|papas?|patatas?|cebollas?|tomates?|zanahorias?|pechugas?|filetes?|rodajas?|lonchas?|pizcas?|latas?|hojas?|ramas?|vasos?|porciones?|puñados?)',
    'gi'
  );

  let result = ingredient.replace(unitsRegex, (match, numberStr, unit) => {
    let value = 0;
    if (numberStr.includes('/')) {
      const [num, den] = numberStr.split('/').map(Number);
      if (den) value = num / den;
    } else {
      value = parseFloat(numberStr.replace(',', '.'));
    }

    if (isNaN(value)) return match;

    const scaled = value * ratio;

    // Formatear amigable (evitar decimales largos e inapropiados para cocina)
    let formatted = '';
    if (Math.abs(scaled - Math.round(scaled)) < 0.05) {
      formatted = Math.round(scaled).toString();
    } else if (Math.abs(scaled - 0.5) < 0.05) {
      formatted = '1/2';
    } else if (Math.abs(scaled - 1.5) < 0.05) {
      formatted = '1 y 1/2';
    } else if (Math.abs(scaled - 0.25) < 0.05) {
      formatted = '1/4';
    } else if (Math.abs(scaled - 0.75) < 0.05) {
      formatted = '3/4';
    } else {
      formatted = scaled.toFixed(1).replace('.0', '');
    }

    return `${formatted} ${unit}`;
  });

  // Si el texto comenzaba con un número que no coincidió con ninguna unidad específica (ej. "2 limones grandes")
  if (result === ingredient) {
    result = ingredient.replace(/^(\d+\/\d+|\d+(?:[.,]\d+)?)\s+([a-zA-Záéíóúñ]+)/i, (match, numberStr, nextWord) => {
      let value = 0;
      if (numberStr.includes('/')) {
        const [num, den] = numberStr.split('/').map(Number);
        if (den) value = num / den;
      } else {
        value = parseFloat(numberStr.replace(',', '.'));
      }

      if (isNaN(value)) return match;

      const scaled = value * ratio;
      let formatted = '';
      if (Math.abs(scaled - Math.round(scaled)) < 0.05) {
        formatted = Math.round(scaled).toString();
      } else if (Math.abs(scaled - 0.5) < 0.05) {
        formatted = '1/2';
      } else if (Math.abs(scaled - 1.5) < 0.05) {
        formatted = '1 y 1/2';
      } else {
        formatted = scaled.toFixed(1).replace('.0', '');
      }

      return `${formatted} ${nextWord}`;
    });
  }

  return result;
}

/**
 * Retorna consejos inteligentes de utensilios según el escalado de porciones (ej: sartén más amplia para >= 4)
 */
export function getPanServingAdvice(targetServings: number, baseServings: number = 2): string | null {
  if (targetServings >= 4) {
    return 'Para 4 o más personas, asegúrate de usar una sartén u olla más amplia para no apelmazar los ingredientes y garantizar una cocción uniforme.';
  }
  if (targetServings === 1) {
    return 'Cocinando para 1 persona: los líquidos reducen más rápido. Vigila el fuego un punto más bajo si notas evaporación acelerada.';
  }
  return null;
}
