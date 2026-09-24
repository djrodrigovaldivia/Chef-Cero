/**
 * ============================================================================
 * CHEF CERO - NÚCLEO TÉCNICO: MIDDLEWARE DE TRADUCCIÓN FONÉTICA (PARSER / REGEX)
 * ============================================================================
 * Limpia y traduce texto culinario crudo antes de enviarlo a síntesis de voz (TTS).
 * 
 * Capacidades:
 * - Conversión precisa de fracciones numéricas (1/4, 1/2, 3/4, 1 1/2, etc.) con concordancia de género.
 * - Expansión fonética de unidades métricas e imperiales (g, kg, ml, l, cdta, cda, taza, pizca).
 * - Rangos numéricos de tiempo y cantidades ("2-3 min" -> "de dos a tres minutos").
 * - Temperaturas culinarias ("180°C" -> "ciento ochenta grados centígrados").
 * - Notaciones de pasos, guiones, viñetas y sanitización de markdown o emojis extraños.
 */

export interface PhoneticParserOptions {
  capitalizeFirstLetter?: boolean;
  expandNumbersUnderTen?: boolean;
  preservePunctuation?: boolean;
}

const FRACTION_WORDS: Record<string, { singular: string; plural: string; feminineSingular: string; femininePlural: string }> = {
  '1/2': { singular: 'medio', plural: 'medios', feminineSingular: 'media', femininePlural: 'medias' },
  '1/4': { singular: 'un cuarto de', plural: 'cuartos de', feminineSingular: 'un cuarto de', femininePlural: 'cuartos de' },
  '3/4': { singular: 'tres cuartos de', plural: 'tres cuartos de', feminineSingular: 'tres cuartos de', femininePlural: 'tres cuartos de' },
  '1/3': { singular: 'un tercio de', plural: 'tercios de', feminineSingular: 'un tercio de', femininePlural: 'tercios de' },
  '2/3': { singular: 'dos tercios de', plural: 'dos tercios de', feminineSingular: 'dos tercios de', femininePlural: 'dos tercios de' },
  '1/8': { singular: 'un octavo de', plural: 'octavos de', feminineSingular: 'un octavo de', femininePlural: 'octavos de' },
  '½': { singular: 'medio', plural: 'medios', feminineSingular: 'media', femininePlural: 'medias' },
  '¼': { singular: 'un cuarto de', plural: 'cuartos de', feminineSingular: 'un cuarto de', femininePlural: 'cuartos de' },
  '¾': { singular: 'tres cuartos de', plural: 'tres cuartos de', feminineSingular: 'tres cuartos de', femininePlural: 'tres cuartos de' },
  '⅓': { singular: 'un tercio de', plural: 'tercios de', feminineSingular: 'un tercio de', femininePlural: 'tercios de' },
  '⅔': { singular: 'dos tercios de', plural: 'dos tercios de', feminineSingular: 'dos tercios de', femininePlural: 'dos tercios de' },
  '⅛': { singular: 'un octavo de', plural: 'octavos de', feminineSingular: 'un octavo de', femininePlural: 'octavos de' },
};

export class CulinaryPhoneticParser {
  /**
   * Sanitiza el markdown, enlaces, etiquetas HTML y caracteres que alteran el ritmo de lectura.
   */
  public static stripArtifacts(text: string): string {
    return text
      // Eliminar bloques de código o backticks
      .replace(/```[\s\S]*?```/g, '')
      .replace(/`([^`]+)`/g, '$1')
      // Eliminar markdown enlaces [texto](url) -> texto
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      // Formato negrita/cursiva
      .replace(/\*{1,3}([^*]+)\*{1,3}/g, '$1')
      .replace(/_{1,3}([^_]+)_{1,3}/g, '$1')
      // Títulos markdown (#)
      .replace(/^#{1,6}\s+/gm, '')
      // Emojis y símbolos decorativos que suenan artificiales en TTS
      .replace(/[\u{1F300}-\u{1FAFF}]/gu, '')
      .replace(/[\u{2600}-\u{26FF}]/gu, '')
      .replace(/[\u{2700}-\u{27BF}]/gu, '')
      .replace(/[✓✔✕✖★☆✦✧🔥🍳🔪💡⚠️🚨]/g, '')
      // Viñetas y guiones de listas
      .replace(/^[\s*•\-–—]+\s*/gm, '')
      // Caracteres aislados extraños
      .replace(/[~|^#$@%&]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Procesa rangos como "2-3 min", "15 - 20 s", "1-2 cucharadas"
   */
  public static normalizeRanges(text: string): string {
    return text
      .replace(/(\d+)\s*[-–—]\s*(\d+)\s*(min(?:utos?|\.)?)/gi, 'de $1 a $2 minutos')
      .replace(/(\d+)\s*[-–—]\s*(\d+)\s*(seg(?:undos?|\.)?)/gi, 'de $1 a $2 segundos')
      .replace(/(\d+)\s*[-–—]\s*(\d+)\s*(h(?:oras?|\.)?)/gi, 'de $1 a $2 horas')
      .replace(/(\d+)\s*[-–—]\s*(\d+)\s*(cdas?|cucharadas?)/gi, 'de $1 a $2 cucharadas')
      .replace(/(\d+)\s*[-–—]\s*(\d+)\s*(cdtas?|cucharaditas?)/gi, 'de $1 a $2 cucharaditas')
      .replace(/(\d+)\s*[-–—]\s*(\d+)\s*(tazas?)/gi, 'de $1 a $2 tazas')
      .replace(/(\d+)\s*[-–—]\s*(\d+)\s*(g|grs?|gramos?)/gi, 'de $1 a $2 gramos')
      .replace(/(\d+)\s*[-–—]\s*(\d+)\s*(kg|kilos?)/gi, 'de $1 a $2 kilos')
      .replace(/(\d+)\s*[-–—]\s*(\d+)\s*(ml|mililitros?)/gi, 'de $1 a $2 mililitros')
      .replace(/(\b[0-9]+)\s*[-–—]\s*([0-9]+\b)/g, '$1 a $2');
  }

  /**
   * Resuelve concordancia de fracciones culinarias (concordancia femenina con taza/cucharada/cucharadita)
   */
  public static normalizeFractions(text: string): string {
    let result = text;

    // Entero más fracción: "1 1/2", "2 1/4"
    result = result.replace(/(\d+)\s+(1\/2|½)\s+(cdas?|cucharadas?|cdtas?|cucharaditas?|tazas?)/gi, (_, n, _f, unit) => {
      const u = unit.toLowerCase();
      const isFem = u.startsWith('cda') || u.startsWith('cucharada') || u.startsWith('cdta') || u.startsWith('cucharadita') || u.startsWith('taza');
      const numWord = n === '1' ? (isFem ? 'una' : 'un') : n;
      return `${numWord} y media ${unit}`;
    });

    result = result.replace(/(\d+)\s+(1\/2|½)/gi, '$1 y medio');
    result = result.replace(/(\d+)\s+(1\/4|¼)/gi, '$1 y un cuarto de');
    result = result.replace(/(\d+)\s+(3\/4|¾)/gi, '$1 y tres cuartos de');

    // Fracciones seguidas de unidades femeninas: "1/2 cda" -> "media cucharada", "1/2 taza" -> "media taza"
    result = result.replace(/(1\/2|½)\s*(cdas?|cucharadas?)/gi, 'media cucharada');
    result = result.replace(/(1\/2|½)\s*(cdtas?|cucharaditas?)/gi, 'media cucharadita');
    result = result.replace(/(1\/2|½)\s*(tazas?)/gi, 'media taza');
    result = result.replace(/(1\/2|½)\s*(cebolla|pizca|cucharada|rebanada|taza|naranja|lima|manzana|pechuga)/gi, 'media $2');

    // Fracciones estándar
    for (const [frac, entry] of Object.entries(FRACTION_WORDS)) {
      const escaped = frac.replace('/', '\\/');
      const regex = new RegExp(`\\b${escaped}\\b`, 'g');
      result = result.replace(regex, entry.singular);
    }

    return result;
  }

  /**
   * Traduce abreviaturas de unidades métricas, culinarias e imperiales
   */
  public static normalizeUnits(text: string): string {
    let t = text;

    // Cucharadas / Cucharaditas
    t = t.replace(/\b1\s*(cdas?|cucharada)\b/gi, 'una cucharada');
    t = t.replace(/(\d+)\s*(cdas?|cucharadas?)\b/gi, '$1 cucharadas');
    t = t.replace(/\b1\s*(cdtas?|cucharadita)\b/gi, 'una cucharadita');
    t = t.replace(/(\d+)\s*(cdtas?|cucharaditas?)\b/gi, '$1 cucharaditas');

    // Tazas
    t = t.replace(/\b1\s*taza\b/gi, 'una taza');
    t = t.replace(/(\d+)\s*tazas?\b/gi, '$1 tazas');

    // Gramos / Kilos
    t = t.replace(/\b1\s*(kg|kilo)\b/gi, 'un kilo');
    t = t.replace(/(\d+)\s*(kg|kilos?)\b/gi, '$1 kilos');
    t = t.replace(/\b1\s*(g|gr|grs?|gramo)\b/gi, 'un gramo');
    t = t.replace(/(\d+)\s*(g|gr|grs?|gramos?)\b/gi, '$1 gramos');

    // Mililitros / Litros
    t = t.replace(/\b1\s*(l|lt|litro)\b/gi, 'un litro');
    t = t.replace(/(\d+)\s*(l|lts?|litros?)\b/gi, '$1 litros');
    t = t.replace(/\b1\s*(ml|mililitro)\b/gi, 'un mililitro');
    t = t.replace(/(\d+)\s*(ml|mls?|mililitros?)\b/gi, '$1 mililitros');

    // Unidades de tiempo
    t = t.replace(/\b1\s*(min|minuto)\b/gi, 'un minuto');
    t = t.replace(/(\d+)\s*(mins?|minutos?)\b/gi, '$1 minutos');
    t = t.replace(/\b1\s*(seg|segundo)\b/gi, 'un segundo');
    t = t.replace(/(\d+)\s*(segs?|segundos?)\b/gi, '$1 segundos');
    t = t.replace(/\b1\s*(h|hr|hora)\b/gi, 'una hora');
    t = t.replace(/(\d+)\s*(hrs?|horas?)\b/gi, '$1 horas');

    // Temperaturas culinarias
    t = t.replace(/(\d+)\s*°\s*c(?:elsius)?\b/gi, '$1 grados centígrados');
    t = t.replace(/(\d+)\s*°\s*f(?:ahrenheit)?\b/gi, '$1 grados fahrenheit');
    t = t.replace(/(\d+)\s*°\b/gi, '$1 grados');

    // Modismos y términos culinarios
    t = t.replace(/\baprox\.?\b/gi, 'aproximadamente');
    t = t.replace(/\btemp\.?\b/gi, 'temperatura');
    t = t.replace(/\bpza\.?\b/gi, 'pieza');
    t = t.replace(/\bpzas\.?\b/gi, 'piezas');
    t = t.replace(/\bpaq\.?\b/gi, 'paquete');
    t = t.replace(/\bdte\.?\b/gi, 'diente');
    t = t.replace(/\bdtes\.?\b/gi, 'dientes');
    t = t.replace(/\bpaso\s*#?\s*(\d+)/gi, 'paso número $1');
    t = t.replace(/\bS\.O\.S\.?\b/gi, 'emergencia');

    return t;
  }

  /**
   * Limpia dobles espacios y remata con puntuación natural para que el motor de voz respire.
   */
  public static finalizeCadence(text: string): string {
    let t = text
      .replace(/\s*([,;:?.!])\s*/g, '$1 ')
      .replace(/\s+/g, ' ')
      .replace(/\.{2,}/g, '.')
      .trim();

    // Asegurar punto final para cadencia descendente natural en español
    if (t.length > 0 && !/[.!?]$/.test(t)) {
      t += '.';
    }
    return t;
  }

  /**
   * PIPELINE PRINCIPAL: Convierte texto culinario crudo en texto fonético óptimo para el TTS.
   */
  public static process(rawText: string, options: PhoneticParserOptions = {}): string {
    if (!rawText || typeof rawText !== 'string') return '';

    let text = this.stripArtifacts(rawText);
    text = this.normalizeRanges(text);
    text = this.normalizeFractions(text);
    text = this.normalizeUnits(text);
    text = this.finalizeCadence(text);

    if (options.capitalizeFirstLetter && text.length > 0) {
      text = text.charAt(0).toUpperCase() + text.slice(1);
    }

    return text;
  }
}
