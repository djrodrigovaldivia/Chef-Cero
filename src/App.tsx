import React, { useState, useEffect } from 'react';
import { Recipe, UserProfile } from './types';
import { Navbar, ActiveTab } from './components/Navbar';
import { CookingMode } from './components/CookingMode';
import { SimpleModeView } from './components/SimpleModeView';
import { FridgeScannerModal, ScannerMode } from './components/FridgeScannerModal';
import { TechniquesShowcaseModal } from './components/TechniquesShowcaseModal';
import { FoodInspectorTab } from './components/FoodInspectorTab';
import { SchoolAndNotebookTab } from './components/SchoolAndNotebookTab';
import { ShoppingListModal } from './components/ShoppingListModal';
import { VoiceAssistantModal } from './components/VoiceAssistantModal';
import { FloatingVoiceBar } from './components/FloatingVoiceBar';
import { OfflineIndicator } from './components/OfflineIndicator';
import { AccessibleSubtitles } from './components/AccessibleSubtitles';
import { WeeklyMealPlannerModal } from './components/WeeklyMealPlannerModal';
import { VisualTechniqueLoopModal } from './components/VisualTechniqueLoopModal';
import { RecipeImportModal } from './components/RecipeImportModal';
import { registerChefServiceWorker } from './utils/pushNotifications';
import { STARTER_RECIPES } from './data/recipeData';
import { Mic, ChefHat, Sparkles } from 'lucide-react';


const INITIAL_PROFILE: UserProfile = {
  name: 'Aprendiz Culinario',
  level: 1,
  levelTitle: 'Nivel 1: Principiante Total',
  xp: 35,
  xpToNextLevel: 100,
  pastMistakes: [
    'Suele usar fuego muy alto al dorar cebolla',
    'Olvida medir los ingredientes antes de encender la hornalla',
  ],
  masteredSkills: [
    'Mise en place antes de calentar',
    'Control de fuego bajo y llama suave',
  ],
  flavorPreferences: [
    'Toques frescos de limón o vinagre suave',
    'Aromas tostados sin amargor',
  ],
  flavorBoostersLearned: [
    {
      dish: 'Huevos Revueltos Suaves',
      tip: 'Unas gotas de limón o vinagre suave al final cortan la grasa y realzan la cremosidad.',
      category: 'acidez',
      date: 'Ayer',
    },
  ],
  evolutionaryMemories: [
    {
      id: 'mem-1',
      category: 'fuego',
      fact: 'Le tiene respeto al aceite caliente; prefiere iniciar con sartén templada y fuego bajo.',
      learnedAt: 'Día 1',
    },
    {
      id: 'mem-2',
      category: 'fortaleza',
      fact: 'Ya domina el Mise en Place (platitos listos antes de prender la hornalla).',
      learnedAt: 'Ayer',
    },
    {
      id: 'mem-3',
      category: 'gustos',
      fact: 'Le gustan los toques cítricos sutiles y las texturas cremosas.',
      learnedAt: 'Ayer',
    },
  ],
  aiToneSetting: 'mentor_paciencia',
  complexityLevel: 'basico_guiado',
  cookedHistory: [
    {
      id: 'dish-demo-1',
      recipeTitle: 'Huevos Revueltos Suaves',
      date: 'Ayer',
      rating: 'En su punto perfecto',
      difficultyFaced: 'Saber cuándo apagar la hornalla',
      mentorTip: 'Retirar la sartén cuando todavía se ven brillantes y húmedos fue la clave del éxito.',
      xpEarned: 35,
      skillImproved: 'Retirada a tiempo con calor residual',
      flavorBoosterLearned: 'Gotitas de limón al final para balancear la grasa',
      tastePreferenceDetected: 'Texturas sedosas y toques cítricos',
    },
  ],
  unlockedBadges: [
    {
      id: 'b1',
      title: 'Curioso Valiente',
      icon: '🌱',
      description: 'Te animaste a pisar la cocina sin saber nada.',
    },
    {
      id: 'b2',
      title: 'Garra de Oso',
      icon: '🐻',
      description: 'Aprendiste a esconder las uñas al usar el cuchillo.',
    },
    {
      id: 'b3',
      title: 'Mise en Place',
      icon: '🥣',
      description: 'Todo listo en platitos antes de prender fuego.',
    },
    {
      id: 'b4',
      title: 'Fuego Bajo Control',
      icon: '🔥',
      description: 'Dominaste la llama suave sin quemar el fondo.',
    },
  ],
};

export default function App() {
  const [appMode, setAppMode] = useState<'simple' | 'complete'>(() => {
    return (localStorage.getItem('chef_cero_mode_preference') as 'simple' | 'complete') || 'simple';
  });
  const [selectedRecipeForCooking, setSelectedRecipeForCooking] = useState<Recipe | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>('cocinar');
  const [isVoiceOpen, setIsVoiceOpen] = useState(false);
  const [isShoppingListOpen, setIsShoppingListOpen] = useState(false);
  const [isFridgeScannerOpen, setIsFridgeScannerOpen] = useState(false);
  const [scannerMode, setScannerMode] = useState<ScannerMode>('level_trio');
  const [isTechniquesOpen, setIsTechniquesOpen] = useState(false);
  const [isMealPlannerOpen, setIsMealPlannerOpen] = useState(false);
  const [isVisualLoopsOpen, setIsVisualLoopsOpen] = useState(false);
  const [isRecipeImportOpen, setIsRecipeImportOpen] = useState(false);
  const [voiceContext, setVoiceContext] = useState<{
    recipeTitle?: string;
    stepNumber?: number;
    stepInstruction?: string;
    heatLevel?: string;
  } | undefined>(undefined);
  const [incomingTimer, setIncomingTimer] = useState<{ seconds: number; label: string } | null>(null);

  const handleToggleAppMode = (mode: 'simple' | 'complete') => {
    setAppMode(mode);
    try {
      localStorage.setItem('chef_cero_mode_preference', mode);
    } catch (_) {}
  };

  const handleVoiceAddTimer = (seconds: number, label: string) => {
    setActiveTab('cocinar');
    setIncomingTimer({ seconds, label });
  };

  const [userProfile, setUserProfile] = useState<UserProfile>(() => {
    try {
      const saved = localStorage.getItem('chef_cero_profile_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          ...INITIAL_PROFILE,
          ...parsed,
          pastMistakes: Array.isArray(parsed?.pastMistakes) ? parsed.pastMistakes : INITIAL_PROFILE.pastMistakes,
          cookedHistory: Array.isArray(parsed?.cookedHistory) ? parsed.cookedHistory : INITIAL_PROFILE.cookedHistory,
          unlockedBadges: Array.isArray(parsed?.unlockedBadges) ? parsed.unlockedBadges : INITIAL_PROFILE.unlockedBadges,
          masteredSkills: Array.isArray(parsed?.masteredSkills) ? parsed.masteredSkills : INITIAL_PROFILE.masteredSkills,
          flavorPreferences: Array.isArray(parsed?.flavorPreferences) ? parsed.flavorPreferences : INITIAL_PROFILE.flavorPreferences,
          flavorBoostersLearned: Array.isArray(parsed?.flavorBoostersLearned) ? parsed.flavorBoostersLearned : INITIAL_PROFILE.flavorBoostersLearned,
          evolutionaryMemories: Array.isArray(parsed?.evolutionaryMemories) ? parsed.evolutionaryMemories : INITIAL_PROFILE.evolutionaryMemories,
          aiToneSetting: parsed?.aiToneSetting || INITIAL_PROFILE.aiToneSetting,
          complexityLevel: parsed?.complexityLevel || INITIAL_PROFILE.complexityLevel,
        };
      }
    } catch (e) {
      console.warn('Chef Cero: Error restaurando perfil guardado, usando inicial:', e);
    }
    return INITIAL_PROFILE;
  });

  const handleLearnFact = (
    category: 'fuego' | 'gustos' | 'equipamiento' | 'habito' | 'fortaleza',
    fact: string
  ) => {
    setUserProfile((prev) => {
      const existing = prev.evolutionaryMemories || [];
      // Evitar duplicados exactos o muy parecidos
      if (existing.some((m) => m.fact.toLowerCase().trim() === fact.toLowerCase().trim())) {
        return prev;
      }
      const newFact = {
        id: 'mem-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
        category,
        fact: fact.trim(),
        learnedAt: 'Hoy',
      };
      return {
        ...prev,
        evolutionaryMemories: [newFact, ...existing],
      };
    });
  };

  const handleRemoveFact = (id: string) => {
    setUserProfile((prev) => ({
      ...prev,
      evolutionaryMemories: (prev.evolutionaryMemories || []).filter((m) => m.id !== id),
    }));
  };

  useEffect(() => {
    try {
      localStorage.setItem('chef_cero_profile_v1', JSON.stringify(userProfile));
    } catch (quotaErr) {
      console.warn('Chef Cero: No se pudo persistir el perfil en localStorage:', quotaErr);
    }
  }, [userProfile]);

  // Registro e inicio proactivo del Service Worker para garantizar la caché offline
  useEffect(() => {
    registerChefServiceWorker().catch((err) => {
      console.warn('Chef Cero: No se pudo registrar el Service Worker en inicio:', err);
    });
  }, []);

  const handleUpdateProfile = (updated: Partial<UserProfile>) => {
    setUserProfile((prev) => ({
      ...prev,
      ...updated,
    }));
  };

  const handleOpenVoiceWithContext = (context: {
    recipeTitle: string;
    stepNumber: number;
    stepInstruction: string;
    heatLevel: string;
  }) => {
    setVoiceContext(context);
    setIsVoiceOpen(true);
  };

  return (
    <div className="min-h-screen bg-stone-100/70 text-stone-900 flex flex-col font-sans">
      {/* Top Navbar */}
      <Navbar
        appMode={appMode}
        onToggleAppMode={handleToggleAppMode}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onOpenVoiceAssistant={() => {
          setVoiceContext(undefined);
          setIsVoiceOpen(true);
        }}
        onOpenShoppingList={() => setIsShoppingListOpen(true)}
        onOpenFridgeScanner={(mode?: ScannerMode) => {
          if (mode) setScannerMode(mode);
          setIsFridgeScannerOpen(true);
        }}
        onOpenTechniques={() => setIsTechniquesOpen(true)}
        onOpenMealPlanner={() => setIsMealPlannerOpen(true)}
        onOpenVisualLoops={() => setIsVisualLoopsOpen(true)}
        onOpenRecipeImport={() => setIsRecipeImportOpen(true)}
        onOpenEmergency={() => {
          setVoiceContext({
            recipeTitle: 'Emergencia en sartén',
            stepNumber: 1,
            stepInstruction: 'Auxilio rápido: comida pegada, humo o fuego alto',
            heatLevel: 'alto',
          });
          setIsVoiceOpen(true);
        }}
        userProfile={userProfile}
      />

      {/* Main Content Area: 3 Vistas Maestras Zen */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 pb-28 md:pb-12">
        {activeTab === 'cocinar' && (
          selectedRecipeForCooking ? (
            <div className="space-y-4">
              {/* Barra superior de retorno a la lista de recetas */}
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setSelectedRecipeForCooking(null)}
                  className="px-4 py-2.5 rounded-2xl bg-white hover:bg-stone-50 text-stone-900 text-xs sm:text-sm font-extrabold border border-stone-200 shadow-2xs flex items-center gap-2 transition cursor-pointer active:scale-98"
                >
                  <span className="text-base leading-none">←</span>
                  <span>Volver a elegir receta</span>
                </button>

                <div className="text-right">
                  <span className="text-xs text-stone-500 font-medium hidden sm:inline">
                    Plato actual:
                  </span>
                  <span className="text-xs sm:text-sm font-black text-amber-900 ml-1.5 font-serif">
                    {selectedRecipeForCooking.title.split('(')[0]}
                  </span>
                </div>
              </div>

              <CookingMode
                userProfile={userProfile}
                onUpdateProfile={handleUpdateProfile}
                onOpenVoiceAssistantWithContext={handleOpenVoiceWithContext}
                incomingTimer={incomingTimer}
                onClearIncomingTimer={() => setIncomingTimer(null)}
                onLearnFact={handleLearnFact}
                externalSelectedRecipe={selectedRecipeForCooking}
                onRecipeConsumed={() => setSelectedRecipeForCooking(null)}
                onNavigateToAutor={() => setActiveTab('escuela')}
              />
            </div>
          ) : (
            <SimpleModeView
              userProfile={userProfile}
              onSelectRecipe={(recipe) => {
                setSelectedRecipeForCooking(recipe);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              onOpenVoice={() => {
                setVoiceContext(undefined);
                setIsVoiceOpen(true);
              }}
              onOpenEmergency={() => {
                setVoiceContext({
                  recipeTitle: 'Emergencia en sartén',
                  stepNumber: 1,
                  stepInstruction: 'Auxilio rápido: comida pegada, humo o fuego alto',
                  heatLevel: 'alto',
                });
                setIsVoiceOpen(true);
              }}
              onOpenScanner={() => setActiveTab('escaner')}
              onOpenTechniques={() => setIsTechniquesOpen(true)}
              onOpenMealPlanner={() => setIsMealPlannerOpen(true)}
              onOpenRecipeImport={() => setIsRecipeImportOpen(true)}
            />
          )
        )}

        {/* 2. PESTAÑA ESTRELLA: INSPECTOR DE ALIMENTOS CON FOTO */}
        {activeTab === 'escaner' && (
          <FoodInspectorTab
            onStartCookingRecipe={(recipe) => {
              setSelectedRecipeForCooking(recipe);
              setActiveTab('cocinar');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onOpenVoiceAssistant={() => {
              setVoiceContext(undefined);
              setIsVoiceOpen(true);
            }}
          />
        )}

        {/* 3. PESTAÑA ESCUELA & CUADERNO DE APRENDIZ */}
        {activeTab === 'escuela' && (
          <SchoolAndNotebookTab
            userProfile={userProfile}
            onUpdateProfile={handleUpdateProfile}
            onLearnFact={handleLearnFact}
            onRemoveFact={handleRemoveFact}
            onOpenVisualLoops={() => setIsVisualLoopsOpen(true)}
          />
        )}
      </main>

      {/* Floating hands-free trigger button with real-time audio waveform visualizer */}
      <FloatingVoiceBar
        onOpenVoice={() => {
          setVoiceContext(undefined);
          setIsVoiceOpen(true);
        }}
        isVoiceOpen={isVoiceOpen}
      />


      {/* Hands-Free Voice Assistant Modal con Modo Conversacional Continuo y Memoria */}
      <VoiceAssistantModal
        isOpen={isVoiceOpen}
        onClose={() => setIsVoiceOpen(false)}
        userProfile={userProfile}
        currentContext={voiceContext}
        onAddTimer={handleVoiceAddTimer}
        onLearnFact={handleLearnFact}
        onRemoveFact={handleRemoveFact}
      />

      {/* Smart Shopping List Modal (Compartir vía WhatsApp o copiar) */}
      <ShoppingListModal
        isOpen={isShoppingListOpen}
        onClose={() => setIsShoppingListOpen(false)}
      />

      {/* Escáner de Nevera con Cámara Multimodal */}
      <FridgeScannerModal
        isOpen={isFridgeScannerOpen}
        initialMode={scannerMode}
        onClose={() => setIsFridgeScannerOpen(false)}
        onStartCookingRecipe={(recipe) => {
          setSelectedRecipeForCooking(recipe);
          setAppMode('complete');
          setActiveTab('cocinar');
        }}
      />

      {/* Micro-Demostraciones Sensoriales de Técnicas */}
      <TechniquesShowcaseModal
        isOpen={isTechniquesOpen}
        onClose={() => setIsTechniquesOpen(false)}
      />

      {/* Planificador Semanal Inteligente (Lunes a Domingo + Consolidación al Súper) */}
      <WeeklyMealPlannerModal
        isOpen={isMealPlannerOpen}
        onClose={() => setIsMealPlannerOpen(false)}
        recipes={STARTER_RECIPES}
        onOpenShoppingList={() => {
          setIsMealPlannerOpen(false);
          setIsShoppingListOpen(true);
        }}
        onSelectRecipeToCook={(recipe) => {
          setSelectedRecipeForCooking(recipe);
          setAppMode('complete');
          setActiveTab('cocinar');
        }}
      />

      {/* Demostraciones de Técnicas en Bucle (Micro-Pedagogía estilo Kitchen Stories) */}
      <VisualTechniqueLoopModal
        isOpen={isVisualLoopsOpen}
        onClose={() => setIsVisualLoopsOpen(false)}
      />

      {/* Importador y Limpiador de Recetas (Estilo Paprika / Reddit) */}
      <RecipeImportModal
        isOpen={isRecipeImportOpen}
        onClose={() => setIsRecipeImportOpen(false)}
        onRecipeImported={(recipe) => {
          setSelectedRecipeForCooking(recipe);
          setActiveTab('cocinar');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      />

      {/* Indicador de Estado Sin Conexión (Caché Offline activa) */}
      <OfflineIndicator />

      {/* Subtítulos Accesibles en Pantalla (Modo Silencioso / Closed Captions) */}
      <AccessibleSubtitles />

      {/* Footer */}
      <footer className="bg-white border-t border-stone-200 mt-12 py-6 text-center text-xs text-stone-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ChefHat className="w-4 h-4 text-amber-600" />
            <span className="font-bold text-stone-700 font-serif">Chef Cero</span>
            <span>— Tu mentor culinario para cocinar sin miedo y desde cero</span>
          </div>
          <div className="text-[11px] text-stone-400">
            Inteligencia Artificial Gemini con voz en tiempo real y memoria evolutiva
          </div>
        </div>
      </footer>
    </div>
  );
}
