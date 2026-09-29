import { Recipe } from '../types';

export interface WorldCuisineCacheEntry {
  countryName: string;
  flag: string;
  tagline: string;
  goldenRule: string;
  baseAromatics?: string;
  recipes: Recipe[];
  lastUpdated: number;
}

const STORAGE_KEY = 'chef_cero_world_library_v1';

export function getCachedWorldCuisine(countryName: string): WorldCuisineCacheEntry | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const library: Record<string, WorldCuisineCacheEntry> = JSON.parse(raw);
    const key = countryName.toLowerCase().trim();
    return library[key] || null;
  } catch (err) {
    console.warn('Chef Cero: Error leyendo caché de gastronomía mundial:', err);
    return null;
  }
}

export function saveCachedWorldCuisine(entry: WorldCuisineCacheEntry): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const library: Record<string, WorldCuisineCacheEntry> = raw ? JSON.parse(raw) : {};
    const key = entry.countryName.toLowerCase().trim();

    // Si ya existían recetas, combinar sin duplicar por título
    const existing = library[key];
    let mergedRecipes = entry.recipes;
    if (existing && Array.isArray(existing.recipes)) {
      const existingTitles = new Set(existing.recipes.map((r) => r.title.toLowerCase().trim()));
      const newUnique = entry.recipes.filter((r) => !existingTitles.has(r.title.toLowerCase().trim()));
      mergedRecipes = [...existing.recipes, ...newUnique];
    }

    library[key] = {
      ...entry,
      recipes: mergedRecipes,
      lastUpdated: Date.now(),
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(library));
  } catch (err) {
    console.warn('Chef Cero: Error guardando receta en biblioteca mundial:', err);
  }
}

export function getAllCachedWorldCuisines(): Record<string, WorldCuisineCacheEntry> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}
