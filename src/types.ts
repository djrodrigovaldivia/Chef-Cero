export type CulinaryLevel = 1 | 2 | 3 | 4 | 5;

export interface PastMistake {
  id: string;
  text: string;
  category: 'fuego' | 'corte' | 'sal' | 'tiempo' | 'seguridad' | 'general';
  frequency: number;
}

export interface CookedDishRecord {
  id: string;
  recipeTitle: string;
  date: string;
  rating: 'En su punto perfecto' | 'Salado' | 'Seco' | 'Se quemó' | 'Crudo adentro' | 'Le faltó sabor';
  difficultyFaced: string;
  mentorTip: string;
  xpEarned: number;
}

export interface UserProfile {
  name: string;
  level: CulinaryLevel;
  levelTitle: string;
  xp: number;
  xpToNextLevel: number;
  pastMistakes: string[];
  cookedHistory: CookedDishRecord[];
  unlockedBadges: {
    id: string;
    title: string;
    icon: string;
    description: string;
    unlockedAt?: string;
  }[];
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
