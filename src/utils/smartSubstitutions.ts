/**
 * Catálogo instantáneo de sustitutos culinarios de alacena y despensa (Zero Latency)
 * Basado en reglas bromatológicas y culinarias para principiantes.
 */

export interface InstantSubstitute {
  originalPattern: RegExp;
  ingredientName: string;
  options: {
    name: string;
    ratio: string;
    whyItWorks: string;
    category: 'despensa' | 'vegetal' | 'lácteo' | 'emergencia';
  }[];
}

export const INSTANT_SUBSTITUTES_CATALOG: InstantSubstitute[] = [
  {
    originalPattern: /mantequilla|manteca/i,
    ingredientName: 'Mantequilla / Manteca',
    options: [
      {
        name: 'Aceite de oliva suave o vegetal',
        ratio: 'Usa ¾ de taza de aceite por cada taza de mantequilla.',
        whyItWorks: 'Aporta la materia grasa necesaria para saltear o emulsionar salsas.',
        category: 'despensa',
      },
      {
        name: 'Queso crema o yogur griego natural',
        ratio: 'Misma proporción (1:1) en salsas o purés.',
        whyItWorks: 'Aporta la cremosidad y punto lácteo sin exceso de grasa.',
        category: 'lácteo',
      },
    ],
  },
  {
    originalPattern: /vino blanco/i,
    ingredientName: 'Vino Blanco',
    options: [
      {
        name: 'Caldo de verduras o pollo + gotitas de limón o vinagre',
        ratio: '1 taza de caldo + 1 cucharadita de limón por taza de vino.',
        whyItWorks: 'El caldo aporta el fondo umami y el limón reproduce la acidez necesaria para desglasar la sartén.',
        category: 'despensa',
      },
      {
        name: 'Agua caliente con un toque de vinagre de manzana',
        ratio: 'Mismo volumen con 1 cdta de vinagre suave.',
        whyItWorks: 'Limpia los azúcares caramelizados pegados al fondo de la sartén.',
        category: 'emergencia',
      },
    ],
  },
  {
    originalPattern: /crema de leche|nata/i,
    ingredientName: 'Crema de Leche / Nata',
    options: [
      {
        name: 'Leche entera + 1 cucharadita de mantequilla o aceite',
        ratio: '¾ de taza de leche entera con 1 cda de mantequilla derretida.',
        whyItWorks: 'Reconstituye la emulsión grasa láctea para espesar pastas o guisos.',
        category: 'lácteo',
      },
      {
        name: 'Leche evaporada o queso crema derretido suave',
        ratio: 'Proporción 1:1 a fuego suave.',
        whyItWorks: 'Napará la cuchara con idéntica densidad sedosa.',
        category: 'despensa',
      },
    ],
  },
  {
    originalPattern: /huevo|huevos/i,
    ingredientName: 'Huevo',
    options: [
      {
        name: 'Aquafaba (el líquido de una lata de garbanzos)',
        ratio: '3 cucharadas soperas de líquido equivalen a 1 huevo.',
        whyItWorks: 'Contiene proteínas y almidones que emulsionan y ligan masas a la perfección.',
        category: 'despensa',
      },
      {
        name: '1 cucharada de chía en 3 cucharadas de agua tibia',
        ratio: 'Dejar reposar 5 minutos hasta que gelifique.',
        whyItWorks: 'El mucílago crea un aglutinante natural libre de grasa animal.',
        category: 'vegetal',
      },
    ],
  },
  {
    originalPattern: /salsa de soja|sillao|soya/i,
    ingredientName: 'Salsa de Soja',
    options: [
      {
        name: 'Caldo oscuro concentrado + pizca de sal y salsa inglesa',
        ratio: 'Proporción 1:1.',
        whyItWorks: 'Provee el sabor umami salino y el color tostado en salteados.',
        category: 'despensa',
      },
      {
        name: 'Pasta de miso diluida en un poco de agua tibia',
        ratio: '1 cdta de miso disuelta en 2 cdtas de agua.',
        whyItWorks: 'Misma fermentación de soja con fondo profundo.',
        category: 'despensa',
      },
    ],
  },
  {
    originalPattern: /cebolla|cebollín|cebolla morada/i,
    ingredientName: 'Cebolla / Cebollín',
    options: [
      {
        name: 'Puerro o parte blanca del cebollín',
        ratio: 'Misma cantidad picada fina.',
        whyItWorks: 'Misma familia alium; aporta el dulzor azufrado al sofreír.',
        category: 'vegetal',
      },
      {
        name: 'Cebolla en polvo',
        ratio: '1 cucharadita rasa equivale a media cebolla picada.',
        whyItWorks: 'Aromatiza caldos y carnes inmediatamente sin soltar agua.',
        category: 'despensa',
      },
    ],
  },
  {
    originalPattern: /ajo|diente de ajo/i,
    ingredientName: 'Ajo',
    options: [
      {
        name: 'Ajo en polvo o granulado',
        ratio: '¼ de cucharadita por cada diente de ajo fresco.',
        whyItWorks: 'Distribuye sabor homogéneo sin riesgo de quemarse tan rápido en el aceite.',
        category: 'despensa',
      },
      {
        name: 'Chalota o parte verde de cebollín sofrita',
        ratio: '1 chalota picada finamente.',
        whyItWorks: 'Aporta el matiz picante aromático característico.',
        category: 'vegetal',
      },
    ],
  },
  {
    originalPattern: /limón|jugo de limón|zumo de limón/i,
    ingredientName: 'Limón',
    options: [
      {
        name: 'Vinagre de manzana o vinagre blanco suave',
        ratio: 'Usa la mitad de cantidad de vinagre respecto al limón.',
        whyItWorks: 'Corta la grasa y realza los sabores salados por acidez cítrica/acética.',
        category: 'despensa',
      },
      {
        name: 'Vino blanco seco o naranja agria',
        ratio: 'Misma proporción.',
        whyItWorks: 'Aporta brillo y equilibra caldos y marinadas.',
        category: 'despensa',
      },
    ],
  },
  {
    originalPattern: /queso parmesano|parmesano|pecorino/i,
    ingredientName: 'Queso Parmesano',
    options: [
      {
        name: 'Queso maduro rallado (Granapadano, Manchego curado o gouda viejo)',
        ratio: 'Misma cantidad rallada fino.',
        whyItWorks: 'Aporta cristales de tirosina y glutamato umami natural.',
        category: 'lácteo',
      },
      {
        name: 'Levadura nutricional + pizca de sal marina',
        ratio: '1 cucharada rasa por 1 cda de parmesano.',
        whyItWorks: 'Alternativa vegetal clásica con sabor a queso tostado.',
        category: 'despensa',
      },
    ],
  },
  {
    originalPattern: /pan rallado|panko/i,
    ingredientName: 'Pan Rallado / Panko',
    options: [
      {
        name: 'Avena en hojuelas triturada o galletas de agua molidas',
        ratio: 'Misma proporción 1:1.',
        whyItWorks: 'Crea una costra crujiente y absorbe el vapor al freír o hornear.',
        category: 'despensa',
      },
      {
        name: 'Harina de maíz fina (polenta) o sémola',
        ratio: 'Para rebozados crocantes dorados.',
        whyItWorks: 'Doble textura crocante con tono dorado brillante.',
        category: 'despensa',
      },
    ],
  },
];

/**
 * Busca si un texto de ingrediente tiene sustitutos inmediatos en catálogo
 */
export function findInstantSubstitutes(ingredientText: string): InstantSubstitute | null {
  for (const item of INSTANT_SUBSTITUTES_CATALOG) {
    if (item.originalPattern.test(ingredientText)) {
      return item;
    }
  }
  return null;
}
