export type CulinaryLevel = 1 | 2 | 3 | 4 | 5;

export interface CulinaryLevelMeta {
  level: CulinaryLevel;
  title: string;
  shortTitle: string;
  badge: string;
  tagline: string;
  description: string;
  unlockedTechniques: string[];
  recommendedCookType: string;
  minXp: number;
  targetXp: number;
}

export const CULINARY_LEVELS: CulinaryLevelMeta[] = [
  {
    level: 1,
    title: 'Nivel 1: Cero Absoluto ("Primeras Llamas")',
    shortTitle: 'Nivel 1: Cero Absoluto',
    badge: '🌱',
    tagline: 'Miedo cero a la estufa, seguridad y preparaciones a prueba de principiantes.',
    description: 'Empiezas desde cero total. Aprendes a cortar sin cortarte (técnica garra de oso), medir antes de encender el fuego (Mise en Place) y dominar la llama mínima para no quemar nada.',
    unlockedTechniques: [
      'Mise en Place estricto (preparar todo con fuego apagado)',
      'Llama mínima y calor residual de la sartén',
      'Corte básico seguro con técnica "garra de oso"',
      'Huevos cremosos y suaves sin dorar',
      'Arroz blanco con proporción 1:2 sin destapar',
    ],
    recommendedCookType: '1 hornalla, fuego bajo o medio, máximo 4 ingredientes.',
    minXp: 0,
    targetXp: 100,
  },
  {
    level: 2,
    title: 'Nivel 2: Aprendiz del Fuego ("Control Térmico")',
    shortTitle: 'Nivel 2: Aprendiz del Fuego',
    badge: '🔥',
    tagline: 'El arte del sofrito dulce, sellado jugoso y control de tiempos.',
    description: 'Ya perdiste el miedo al calor. Aprendes a sudar cebolla con calma sin que se arrebate, dorar ajo en el momento justo y sellar pollo jugoso sin secarlo.',
    unlockedTechniques: [
      'Sofrito criollo transparente y dulce (8-10 min con paciencia)',
      'Momento exacto para agregar ajo sin quemarlo ni amargarlo',
      'Sellado de carnes a fuego medio-alto y reposo',
      'Pochado suave de patatas para tortilla española',
    ],
    recommendedCookType: 'Control de fuego variable (medio a bajo), sofritos y sellados.',
    minXp: 100,
    targetXp: 250,
  },
  {
    level: 3,
    title: 'Nivel 3: Cocinero Casero Seguro ("Sabor y Textura")',
    shortTitle: 'Nivel 3: Cocinero Casero',
    badge: '🍳',
    tagline: 'Múltiples hornallas, pastas al dente mantecadas y salteados vivos.',
    description: 'Cocinas con soltura platos completos. Manejas dos sartenes a la vez, salteas arroz al estilo oriental y emulsionas salsas con agua de pasta almidonada.',
    unlockedTechniques: [
      'Salteado vivo en sartén (estilo wok/chaufa oriental)',
      'Mantecatura de pasta con agua de cocción almidonada',
      'Guisos y legumbres con espesado natural de almidones',
      'Manejo simultáneo de olla y sartén sin estrés',
    ],
    recommendedCookType: '2 hornallas simultáneas, salsas emulsionadas y salteados rápidos.',
    minXp: 250,
    targetXp: 500,
  },
  {
    level: 4,
    title: 'Nivel 4: Alquimista de Sabores ("Técnicas Clásicas")',
    shortTitle: 'Nivel 4: Alquimista de Sabores',
    badge: '✨',
    tagline: 'Desglasados, salsas reducidas y balance de los 5 sabores.',
    description: 'Aprovechas cada fondo dorado de sartén para crear salsas increíbles con caldo o vino. Dominas el punto de la carne y equilibras acidez, grasa y umami.',
    unlockedTechniques: [
      'Desglasado de fondo de sartén caramelizado (pan sauces)',
      'Tatemado de chiles y verduras para salsas rústicas',
      'Manejo de emulsiones con yema fuera del fuego (Carbonara)',
      'Reducciones aromáticas con vino y hierbas frescas',
    ],
    recommendedCookType: 'Técnicas culinarias clásicas, reducciones y combinaciones complejas.',
    minXp: 500,
    targetXp: 900,
  },
  {
    level: 5,
    title: 'Nivel 5: Chef Intuitivo ("Cocina Libre")',
    shortTitle: 'Nivel 5: Chef Intuitivo',
    badge: '👑',
    tagline: 'Cocinas sin receta guiándote por tus sentidos y lo que haya en la despensa.',
    description: 'Tu paladar e intuición son tu guía. Ajustas fuegos por sonido y olor, creas platos de autor con 3 sobras de la nevera y dominas cualquier ingrediente.',
    unlockedTechniques: [
      'Creación intuitiva sin recetas escritas',
      'Ajuste fino de sazón y balance de 5 sabores en tiempo real',
      'Reemplazo creativo de cualquier ingrediente ausente',
      'Maestría sensorial integral (oído, olfato y vista)',
    ],
    recommendedCookType: 'Cocina de autor libre, creaciones desde cero y alta intuición.',
    minXp: 900,
    targetXp: 1500,
  },
];

export interface PastMistake {
  id: string;
  text: string;
  category: 'fuego' | 'corte' | 'sal' | 'tiempo' | 'seguridad' | 'general';
  frequency: number;
}

export interface FlavorBooster {
  dish: string;
  tip: string;
  category: 'acidez' | 'textura' | 'umami' | 'hierbas' | 'fuego_final';
  date: string;
}

export interface CookedDishRecord {
  id: string;
  recipeTitle: string;
  date: string;
  rating: 'En su punto perfecto' | 'Salado' | 'Seco' | 'Se quemó' | 'Crudo adentro' | 'Le faltó sabor' | '¡Quedó delicioso!';
  difficultyFaced: string;
  mentorTip: string;
  xpEarned: number;
  skillImproved?: string;
  flavorBoosterLearned?: string;
  tastePreferenceDetected?: string;
}

export interface UserProfile {
  name: string;
  level: CulinaryLevel;
  levelTitle: string;
  xp: number;
  xpToNextLevel: number;
  pastMistakes: string[];
  cookedHistory: CookedDishRecord[];
  masteredSkills: string[];
  flavorPreferences: string[];
  flavorBoostersLearned: FlavorBooster[];
  aiToneSetting: 'mentor_paciencia' | 'complice_culinario' | 'chef_creativo';
  complexityLevel: 'basico_guiado' | 'intermedio_practico' | 'audaz_creativo';
  unlockedBadges: {
    id: string;
    title: string;
    icon: string;
    description: string;
    unlockedAt?: string;
  }[];
  evolutionaryMemories?: ChefMemoryFact[];
}

export interface ChefMemoryFact {
  id: string;
  category: 'fuego' | 'gustos' | 'equipamiento' | 'habito' | 'fortaleza';
  fact: string;
  learnedAt: string;
}

export type DictionaryCategory = 'utensilios' | 'especias' | 'cortes' | 'verduras';

export interface DictionaryItem {
  id: string;
  name: string;
  category: DictionaryCategory;
  imageUrl: string;
  simpleUse: string;
  safetyUsage: string;
  neverDo: string;
  proTip?: string;
}

export type StorageZoneId =
  | 'refrigerador_superior'
  | 'refrigerador_medio'
  | 'refrigerador_cajon'
  | 'refrigerador_puerta'
  | 'congelador'
  | 'alacena'
  | 'frutero'
  | 'especiero';

export interface StorageZone {
  id: StorageZoneId;
  name: string;
  locationLabel: string;
  temperature: string;
  description: string;
  idealFor: string[];
  color: string;
}

export interface FoodStorageItem {
  id: string;
  name: string;
  zoneId: StorageZoneId;
  imageUrl: string;
  shelfLife: string;
  scientificReason: string;
  neverDoAlert: string;
  bestStorageTip: string;
  tags: string[];
}

export type HeatLevel = 'bajo' | 'medio' | 'alto' | 'apagado';

export type WorldCuisineId =
  | 'todas'
  | 'economica_bbb'
  | 'chilena_criolla'
  | 'mexicana'
  | 'asiatica'
  | 'italiana'
  | 'espanola'
  | 'francesa';

export interface WorldCuisine {
  id: WorldCuisineId;
  name: string;
  flag: string;
  tagline: string;
  goldenRule: string;
  baseAromatics: string;
  budgetSecret: string;
}

export interface PantrySubstitute {
  original: string;
  substitute: string;
  reason: string;
}

export interface RecipeStep {
  stepNumber: number;
  title: string;
  instruction: string;
  tip: string;
  heatLevel: HeatLevel;
  timerSeconds?: number;
  timerLabel?: string;
  sensoryCues?: {
    sound?: string;
    sight?: string;
    smell?: string;
  };
  whyItWorks?: string;
}

export interface Recipe {
  id: string;
  title: string;
  description: string;
  servings: number;
  totalTimeMinutes: number;
  difficulty: string;
  imageUrl?: string;
  safetyAlerts: string[];
  miseEnPlace: string[];
  heatGuideExplanation: string;
  steps: RecipeStep[];
  // Campos culturales y económicos
  cuisine?: WorldCuisineId;
  cuisineName?: string;
  countryFlag?: string;
  isBudgetFriendly?: boolean;
  estimatedCostLabel?: string; // Ej: "Económica (~$2 - $3.50 USD)"
  culturalSecret?: string;     // La regla de oro cultural para que no falle
  pantrySubstitutes?: PantrySubstitute[];
  requiredLevel?: CulinaryLevel; // Nivel mínimo pedagógico (1: Cero absoluto, 2: Aprendiz, etc.)
  learningGoal?: string;        // Habilidad clave que se desbloquea al cocinar este plato
}

export interface ActiveTimer {
  id: string;
  label: string;
  totalSeconds: number;
  remainingSeconds: number;
  isRunning: boolean;
  stepIndex?: number;
  targetTimestamp?: number; // Unix timestamp en ms para cálculo exacto en pestañas en segundo plano
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'chef';
  text: string;
  safetyAlert?: string;
  timestamp: string;
}

export interface LeftoverIngredientRescue {
  id: string;
  name: string;
  category: 'carbohidratos' | 'proteinas' | 'verduras' | 'pan_lacteos';
  icon: string;
  whySaveIt: string;
  goldenRule: string;
  quickTransformations: {
    title: string;
    timeMinutes: number;
    difficulty: string;
    instructions: string;
    flavorBoost: string;
  }[];
  neverDoMistake: string;
}

export interface ShoppingItem {
  id: string;
  name: string;
  category: 'Verdulería & Frutas' | 'Carnicería & Huevos' | 'Almacén & Granos' | 'Lácteos & Quesos' | 'Especias & Aceites';
  quantity?: string;
  checked: boolean;
  recipeSource?: string;
}
