import { Recipe } from '../types';
import { STARTER_RECIPES } from '../data/recipeData';

/**
 * Normaliza texto para búsqueda sin tildes ni caracteres raros
 */
function normalizeText(text: string): string {
  return (text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Generador local inteligente de recetas cuando la API de Gemini o Netlify Serverless no está conectada.
 * Busca primero coincidencia semántica en el recetario probado (ej: Arroz con huevo, Tortilla, Tomaticán, etc.)
 * y si no existe crea una receta estructurada y pedagógica garantizando:
 * 1. Paso 1 SIEMPRE con hornalla apagada (Mise en Place).
 * 2. Tiempos exactos, temporizadores y niveles de fuego precisos.
 * 3. Consejos para que no se queme ni se pegue.
 */
export function generateLocalRecipeFallback(query: string, userLevelTitle?: string): Recipe {
  const q = normalizeText(query);

  // 1. Coincidencias específicas populares
  if (q.includes('arroz') && (q.includes('huevo') || q.includes('huevos'))) {
    return {
      id: 'local-arroz-con-huevo-' + Date.now(),
      title: 'Arroz con Huevo Frito de Yema Cremosa (El Clásico Infalible)',
      description: 'El plato más querido y reconfortante del hogar. Aprende a dejar el arroz en su punto y freír el huevo con clara crujiente pero yema líquida y sedosa.',
      servings: 1,
      totalTimeMinutes: 12,
      difficulty: 'Principiante Total',
      cuisine: 'chilena_criolla',
      cuisineName: 'Cocina Casera Express',
      countryFlag: '🍳',
      isBudgetFriendly: true,
      estimatedCostLabel: 'Económica (<$1.00 USD)',
      culturalSecret: 'Bañar la clara con una cucharada del aceite caliente de la sartén cocina la parte superior de la clara sin sobrecocer la yema.',
      imageUrl: 'https://images.unsplash.com/photo-1525351484163-7529414344d8?auto=format&fit=crop&w=800&q=80',
      finishGalleryUrls: [
        'https://images.unsplash.com/photo-1525351484163-7529414344d8?auto=format&fit=crop&w=800&q=80',
      ],
      finishVisualCheckpoints: [
        'Arroz blanco caliente y humeante en la base del plato.',
        'Huevo con borde dorado crujiente ("puntilla") y clara totalmente blanca sin zonas gelatinosas crudas.',
        'Yema amarilla brillante que explota cremosa al tocarla con el tenedor.',
      ],
      safetyAlerts: [
        'Casca el huevo primero en una tacita antes de ponerlo al sartén para evitar que salpique aceite o caigan cáscaras.',
        'La sartén no debe estar humeando al poner el aceite.',
      ],
      miseEnPlace: [
        '1 taza de arroz blanco ya cocido (caliente o del día anterior)',
        '1 o 2 huevos frescos a temperatura ambiente',
        '2 cucharadas de aceite vegetal común',
        '1 pizca de sal fina y pimienta al gusto',
        'Sartén antiadherente pequeña o mediana + espátula',
      ],
      heatGuideExplanation: 'Fuego Medio para calentar el aceite y Fuego Medio-Bajo al echar el huevo para no quemar la base.',
      steps: [
        {
          stepNumber: 1,
          title: 'Mise en Place con Hornalla Apagada',
          instruction: 'Casca el huevo con cuidado dentro de una taza pequeña limpia. Ten el plato con el arroz listo a un lado de la estufa.',
          tip: 'Cascarlo en una taza te da calma mental total: no te saltará aceite en las manos y podrás deslizarlo con suavidad.',
          heatLevel: 'apagado',
          timerSeconds: 0,
          timerLabel: '',
          sensoryCues: {
            sight: 'Huevo entero sin romper en la tacita y sartén limpia.',
            sound: 'Silencio en la cocina.',
            smell: 'Sin olor, todo listo.',
          },
          whyItWorks: 'Tener el huevo ya listo en la taza evita el pánico de que la sartén se caliente de más mientras buscas el huevo.',
        },
        {
          stepNumber: 2,
          title: 'Calentar la sartén y el aceite',
          instruction: 'Pon la sartén a Fuego Medio. Agrega las 2 cucharadas de aceite y espera 60 segundos hasta que el aceite se mueva fluido y brillante por el fondo.',
          tip: 'No dejes que humee. Si ves humo blanco fino, baja el fuego de inmediato o aparta la sartén 10 segundos.',
          heatLevel: 'medio',
          timerSeconds: 60,
          timerLabel: 'Calentar aceite',
          sensoryCues: {
            sight: 'El aceite se vuelve líquido como agua y cubre el fondo.',
            sound: 'Silencio o micro-burbujas imperceptibles.',
            smell: 'Aroma templado limpio.',
          },
          whyItWorks: 'El aceite caliente crea una barrera térmica que impide que la clara se pegue al teflón.',
        },
        {
          stepNumber: 3,
          title: 'Deslizar el huevo a Fuego Medio-Bajo',
          instruction: 'Baja la perilla a Fuego Medio-Bajo. Acerca la taza al borde del aceite y desliza el huevo suavemente. Escucharás un chisporroteo alegre.',
          tip: 'Bajar un poco la llama evita que la clara se queme en los bordes antes de cocinarse al centro.',
          heatLevel: 'medio',
          timerSeconds: 45,
          timerLabel: 'Asentar huevo',
          sensoryCues: {
            sight: 'La clara se vuelve blanca opaca al instante alrededor de la yema.',
            sound: 'Chisporroteo rítmico y controlado, como lluvia sobre un tejado.',
            smell: 'Aroma dulce y reconfortante a huevo frito casero.',
          },
          whyItWorks: 'El choque térmico coagula las proteínas de la clara al contacto formando la base.',
        },
        {
          stepNumber: 4,
          title: 'Cocción de la clara y yema cremosa',
          instruction: 'Deja cocinar durante 90 segundos sin moverlo. Con una cuchara, toma un poco del aceite caliente de los lados y báñalo sobre la clara cerca de la yema.',
          tip: 'No toques la yema con la cuchara. Con 3 o 4 cucharadas de aceite sobre la clara quedará perfectamente cocida y blanca.',
          heatLevel: 'bajo',
          timerSeconds: 90,
          timerLabel: 'Cocinar clara',
          sensoryCues: {
            sight: 'Borde sutilmente dorado y crujiente, clara firme y yema abultada y brillante.',
            sound: 'Chisporroteo suave y decreciente.',
            smell: 'Fragancia tostada irresistible.',
          },
          whyItWorks: 'El aceite bañado cocina la parte superior de la albúmina sin necesidad de voltear el huevo.',
        },
        {
          stepNumber: 5,
          title: 'Montar sobre el arroz y disfrutar',
          instruction: 'Apaga la hornalla. Con la espátula, desliza el huevo sobre tu plato de arroz blanco caliente. Agrega una pizca de sal sobre la yema y sirve de inmediato.',
          tip: 'Rompe la yema con el tenedor para que bañe los granos de arroz como si fuera una salsa dorada.',
          heatLevel: 'apagado',
          timerSeconds: 0,
          timerLabel: '',
          sensoryCues: {
            sight: 'Yema dorada coronando el arroz blanco humeante.',
            sound: 'Silencio total, estufa apagada.',
            smell: 'El perfume inconfundible del hogar.',
          },
          whyItWorks: 'La grasa y la lecitina de la yema emulsionan con el almidón del arroz creando una textura cremosa natural.',
        },
      ],
    };
  }

  // 2. Buscar si coincide con alguna receta del catálogo local
  const matched = STARTER_RECIPES.find((r) => {
    const titleNorm = normalizeText(r.title);
    const descNorm = normalizeText(r.description);
    return titleNorm.includes(q) || q.includes(titleNorm) || descNorm.includes(q);
  });

  if (matched) {
    return {
      ...matched,
      id: 'matched-local-' + Date.now(),
      title: matched.title,
    };
  }

  // 3. Generar dinámicamente un plato bien guiado con la técnica exacta para lo solicitado
  const cleanedTitle = query.trim().charAt(0).toUpperCase() + query.trim().slice(1);
  return {
    id: 'dynamic-local-' + Date.now(),
    title: `${cleanedTitle} Fácil para Principiantes`,
    description: `Guía paso a paso a prueba de errores para preparar ${cleanedTitle} en casa con fuego controlado y cero riesgo de quemaduras.`,
    servings: 2,
    totalTimeMinutes: 18,
    difficulty: 'Principiante',
    cuisine: 'economica_bbb',
    cuisineName: 'Cocina Simple & Rápida',
    countryFlag: '🍳',
    isBudgetFriendly: true,
    estimatedCostLabel: 'Económica (<$3.00 USD)',
    culturalSecret: 'El 90% de los platos que se queman ocurren por distraerse picando con la sartén prendida. Cortar todo antes garantiza el éxito.',
    imageUrl: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80',
    finishGalleryUrls: [
      'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80',
    ],
    finishVisualCheckpoints: [
      'Tono dorado apetitoso y uniforme sin partes carbonizadas.',
      'Textura tierna y jugosa al tacto con el tenedor.',
      'Aroma fresco y bien sazonado.',
    ],
    safetyAlerts: [
      'Mantén el mango de la sartén hacia adentro de la mesada para no tropezar con él.',
      'Usa fuego medio o bajo: te dará tiempo suficiente de observar y corregir.',
    ],
    miseEnPlace: [
      `Ingredientes principales para ${cleanedTitle} lavados y cortados`,
      '1 cucharada de aceite o mantequilla',
      '1 pizca de sal fina y pimienta al gusto',
      '1 diente de ajo o trozo de cebolla picadita para dar sabor',
      'Plato hondo o plano limpio para servir',
    ],
    heatGuideExplanation: 'Iniciamos con sartén tibia a Fuego Bajo, subimos a Fuego Medio para dorar con calma y apagamos antes de que se seque.',
    steps: [
      {
        stepNumber: 1,
        title: 'Mise en Place con Hornalla Apagada',
        instruction: `Lava, pela y corta en platitos todos los ingredientes para preparar tu ${cleanedTitle} antes de tocar la estufa.`,
        tip: 'Tener todo medido elimina el estrés: nunca tendrás que salir corriendo a buscar sal mientras el aceite se calienta.',
        heatLevel: 'apagado',
        timerSeconds: 0,
        timerLabel: '',
        sensoryCues: {
          sight: 'Platitos ordenados junto a la cocina, hornalla apagada.',
          sound: 'Silencio en la cocina.',
          smell: 'Aroma fresco natural de los ingredientes.',
        },
        whyItWorks: 'La técnica profesional Mise en Place evita distracciones y quemaduras en el 100% de los casos.',
      },
      {
        stepNumber: 2,
        title: 'Calentar la base a Fuego Bajo',
        instruction: 'Pon la sartén u olla sobre la hornalla a Fuego Bajo. Agrega 1 cucharada de aceite o mantequilla y espera 60 segundos a que tome calor.',
        tip: 'Pon la palma de tu mano a 10 cm arriba de la sartén; si sientes un calor suave y acogedor, está en su punto.',
        heatLevel: 'bajo',
        timerSeconds: 60,
        timerLabel: 'Templar sartén',
        sensoryCues: {
          sight: 'El aceite brilla y cubre la base de manera fluida.',
          sound: 'Silencio calmo.',
          smell: 'Aroma tibio y limpio.',
        },
        whyItWorks: 'Calentar suavemente protege el antiadherente y evita que el aceite se degrade.',
      },
      {
        stepNumber: 3,
        title: 'Sofreír y dorar con calma a Fuego Medio',
        instruction: `Añade los ingredientes de tu ${cleanedTitle} a la sartén. Ajusta a Fuego Medio y remueve suavemente con cuchara de madera durante 4 a 5 minutos.`,
        tip: 'Si escuchas que chisporrotea muy violento o notas humo, baja la llama al mínimo de inmediato.',
        heatLevel: 'medio',
        timerSeconds: 270,
        timerLabel: 'Saltear y dorar',
        sensoryCues: {
          sight: 'Bordes que toman un color dorado claro y textura que se ablanda.',
          sound: 'Chisporroteo rítmico, constante y pacífico.',
          smell: 'Aroma casero y apetitoso llenando la cocina.',
        },
        whyItWorks: 'La reacción de Maillard ocurre entre 140°C y 165°C caramelizando los sabores sin quemar.',
      },
      {
        stepNumber: 4,
        title: 'Sazón, reposo con calor residual y servir',
        instruction: 'Prueba una pequeña porción con cuidado, ajusta la sal si hace falta y apaga la hornalla por completo. Deja reposar 1 minuto y sirve en tu plato.',
        tip: 'El calor residual que queda en la sartén terminará de asentar la preparación dejándola jugosa y suave.',
        heatLevel: 'apagado',
        timerSeconds: 60,
        timerLabel: 'Reposo final',
        sensoryCues: {
          sight: 'Humo tenue de vapor tibio, plato brillante y listo para comer.',
          sound: 'El chisporroteo se apaga lentamente.',
          smell: 'Aroma delicioso a comida casera recién hecha.',
        },
        whyItWorks: 'El reposo permite que los jugos internos se redistribuyan sin evaporarse de golpe.',
      },
    ],
  };
}
