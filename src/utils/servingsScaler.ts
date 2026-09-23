/**
 * Utilidad inteligente para escalar cantidades en ingredientes y textos de Mise en Place.
 * Reconoce números enteros, decimales y fracciones comunes (1/2, 1/4, 3/4) multiplicándolos por el ratio.
 */

export function scaleIngredientText(ingredient: string, originalServings: number, targetServings: number): string {
  if (!originalServings || !targetServings || originalServings === targetServings) {
    return ingredient;
  }

  const ratio = targetServings / originalServings;

  // Regex para detectar patrones de números al inicio o tras palabras comunes
  // Ej: "2 huevos grandes", "1/2 taza", "200g fideos", "1.5 cucharadas", "1 diente de ajo"
  return ingredient.replace(
    /(\b\d+\/\d+|\b\d+(?:[.,]\d+)?)\s*(huevos?|claras?|yemas?|dientes?|tazas?|cucharadas?|cdas?|cucharaditas?|cdtas?|gramos?|g\b|kg\b|ml\b|litros?|l\b|rebanadas?|piezas?|unid(?:ades)?\.?)/gi,
    (match, numberStr, unit) => {
      let value = 0;
      if (numberStr.includes('/')) {
        const [num, den] = numberStr.split('/').map(Number);
        if (den) value = num / den;
      } else {
        value = parseFloat(numberStr.replace(',', '.'));
      }

      if (isNaN(value)) return match;

      const scaled = value * ratio;

      // Formatear amigable (sin decimales innecesarios como 2.00)
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
    }
  );
}
