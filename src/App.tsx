import React, { useState, useEffect } from 'react';
import { UserProfile } from './types';
import { Navbar, ActiveTab } from './components/Navbar';
import { CookingMode } from './components/CookingMode';
import { VisualDictionary } from './components/VisualDictionary';
import { KitchenStorageMap } from './components/KitchenStorageMap';
import { ChefNotebook } from './components/ChefNotebook';
import { VoiceAssistantModal } from './components/VoiceAssistantModal';
import { OfflineIndicator } from './components/OfflineIndicator';
import { AccessibleSubtitles } from './components/AccessibleSubtitles';
import { registerChefServiceWorker } from './utils/pushNotifications';
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
  cookedHistory: [
    {
      id: 'dish-demo-1',
      recipeTitle: 'Huevos Revueltos Suaves',
      date: 'Ayer',
      rating: 'En su punto perfecto',
      difficultyFaced: 'Saber cuándo apagar la hornalla',
      mentorTip: 'Retirar la sartén cuando todavía se ven brillantes y húmedos fue la clave del éxito.',
      xpEarned: 35,
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
  const [activeTab, setActiveTab] = useState<ActiveTab>('cocinar');
  const [isVoiceOpen, setIsVoiceOpen] = useState(false);
  const [voiceContext, setVoiceContext] = useState<{
    recipeTitle?: string;
    stepNumber?: number;
    stepInstruction?: string;
    heatLevel?: string;
  } | undefined>(undefined);
  const [incomingTimer, setIncomingTimer] = useState<{ seconds: number; label: string } | null>(null);

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
        };
      }
    } catch (e) {
      console.warn('Chef Cero: Error restaurando perfil guardado, usando inicial:', e);
    }
    return INITIAL_PROFILE;
  });

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
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onOpenVoiceAssistant={() => {
          setVoiceContext(undefined);
          setIsVoiceOpen(true);
        }}
        userProfile={userProfile}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {activeTab === 'cocinar' && (
          <CookingMode
            userProfile={userProfile}
            onUpdateProfile={handleUpdateProfile}
            onOpenVoiceAssistantWithContext={handleOpenVoiceWithContext}
            incomingTimer={incomingTimer}
            onClearIncomingTimer={() => setIncomingTimer(null)}
          />
        )}

        {activeTab === 'diccionario' && <VisualDictionary />}

        {activeTab === 'mapa' && <KitchenStorageMap />}

        {activeTab === 'cuaderno' && (
          <ChefNotebook
            userProfile={userProfile}
            onUpdateProfile={handleUpdateProfile}
          />
        )}
      </main>

      {/* Floating hands-free trigger button (always accessible while cooking with dirty hands) */}
      <aside
        id="floating-voice-bar"
        aria-label="Asistente de voz manos libres"
        className="fixed bottom-5 right-5 z-30"
      >
        <button
          onClick={() => {
            setVoiceContext(undefined);
            setIsVoiceOpen(true);
          }}
          className="group flex items-center gap-2.5 px-4 py-3 bg-stone-900 hover:bg-stone-800 text-white rounded-full shadow-2xl border border-stone-700 hover:scale-105 transition-all ring-4 ring-amber-400/40"
        >
          <div className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center text-stone-950 font-bold group-hover:scale-110 transition-transform">
            <Mic className="w-4 h-4 animate-pulse" />
          </div>
          <div className="text-left pr-1">
            <div className="text-[11px] font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1">
              <span>Chef Cero en Vivo</span>
              <Sparkles className="w-3 h-3 text-amber-400" />
            </div>
            <div className="text-xs font-semibold text-stone-200">
              ¿Dudas o humo? Toca para hablar
            </div>
          </div>
        </button>
      </aside>

      {/* Hands-Free Voice Assistant Modal */}
      <VoiceAssistantModal
        isOpen={isVoiceOpen}
        onClose={() => setIsVoiceOpen(false)}
        userProfile={userProfile}
        currentContext={voiceContext}
        onAddTimer={handleVoiceAddTimer}
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
