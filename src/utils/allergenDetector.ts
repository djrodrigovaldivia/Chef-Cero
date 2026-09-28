/**
 * Detector y Gestor de Alérgenos e Intolerancias Preventivas (Estilo SideChef & Yummly)
 * Analiza recetas y ofrece reemplazos seguros sin sacrificar textura ni sabor.
 */

export type DietaryTag = 'sin_gluten' | 'sin_lactosa' | 'vegetariano' | 'vegano' | 'sin_frutos_secos';

export interface AllergenAlert {
  id: string;
  name: string;
  badge: string;
  detectedIngredients: string[];
  safeSubstituteTip: string;
}

export const DIETARY_PREFERENCES_LIST: { id: DietaryTag; label: string; icon: string; description: string }[] = [
  { id: 'sin_gluten', label: 'Sin Gluten (Celíaco)', icon: '🌾🚫', description: 'Sin trigo, cebada ni pastas convencionales' },
  { id: 'sin_lactosa', label: 'Sin Lactosa / Sin Lácteos', icon: '🥛🚫', description: 'Sin leche, crema, mantequilla ni quesos con lactosa' },
  { id: 'vegetariano', label: 'Vegetariano', icon: '🥦', description: 'Sin carnes, aves, pescados ni mariscos' },
  { id: 'vegano', label: 'Vegano Estricto', icon: '🌱', description: '100% origen vegetal (sin carnes, lácteos ni huevos)' },
  { id: 'sin_frutos_secos', label: 'Sin Frutos Secos', icon: '🥜🚫', description: 'Sin nueces, almendras ni cacahuates' },
];

export function detectAllergensInIngredients(ingredients: string[]): AllergenAlert[] {
  const alerts: AllergenAlert[] = [];
  const text = ingredients.join(' ').toLowerCase();

  // Gluten
  const glutenMatches = ingredients.filter((it) =>
    /harina (de trigo|blanca|común)|fideos|espagueti|tallarines|pasta|pan|soya|soja|salsa inglesa|cerveza/i.test(it)
  );
  if (glutenMatches.length > 0) {
    alerts.push({
      id: 'gluten',
      name: 'Contiene Gluten',
      badge: '🌾 Gluten',
      detectedIngredients: glutenMatches,
      safeSubstituteTip: 'Usa pasta de maíz/arroz, harina sin gluten certificada y salsa Tamari en lugar de soya común.',
    });
  }

  // Lácteos
  const dairyMatches = ingredients.filter((it) =>
    /mantequilla|manteca|leche|queso|parmesano|crema|nata|yogur|ricotta|mozzarella/i.test(it)
  );
  if (dairyMatches.length > 0) {
    alerts.push({
      id: 'lactosa',
      name: 'Contiene Lácteos',
      badge: '🥛 Lácteos',
      detectedIngredients: dairyMatches,
      safeSubstituteTip: 'Usa aceite de oliva virgen extra en lugar de mantequilla, o bebidas de avena/soya sin azúcar y queso vegetal.',
    });
  }

  // Huevo
  const eggMatches = ingredients.filter((it) =>
    /huevo|huevos|clara|yema/i.test(it)
  );
  if (eggMatches.length > 0) {
    alerts.push({
      id: 'huevo',
      name: 'Contiene Huevo',
      badge: '🥚 Huevo',
      detectedIngredients: eggMatches,
      safeSubstituteTip: 'En revueltos o tortillas puedes usar tofu desmenuzado con cúrcuma o harina de garbanzo con agua.',
    });
  }

  // Carnes / Aves / Pescado
  const meatMatches = ingredients.filter((it) =>
    /pollo|pechuga|carne|vacuno|res|cerdo|tocino|panceta|jamón|pescado|merluza|salmón|atún|camarones|mariscos/i.test(it)
  );
  if (meatMatches.length > 0) {
    alerts.push({
      id: 'carne',
      name: 'Contiene Carne/Pescado',
      badge: '🥩 No Vegetariano',
      detectedIngredients: meatMatches,
      safeSubstituteTip: 'Reemplaza por champiñones Portobello dorados, tofu firme salteado o lentejas cocidas.',
    });
  }

  // Frutos Secos
  const nutMatches = ingredients.filter((it) =>
    /nuez|nueces|almendra|almendras|maní|cacahuate|avellana|pistacho|anacardo/i.test(it)
  );
  if (nutMatches.length > 0) {
    alerts.push({
      id: 'frutos_secos',
      name: 'Contiene Frutos Secos',
      badge: '🥜 Frutos Secos',
      detectedIngredients: nutMatches,
      safeSubstituteTip: 'Usa semillas de girasol tostadas o semillas de calabaza para el mismo toque crujiente sin alérgenos.',
    });
  }

  return alerts;
}
