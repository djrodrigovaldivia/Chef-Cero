import React, { useState, useEffect, useRef } from 'react';
import {
  ChefHat,
  Mic,
  Camera,
  Award,
  ShoppingCart,
  Calendar,
  VolumeX,
  Volume2,
  Bell,
  BellRing,
  Check,
  MoreHorizontal,
  ChevronDown,
  Sparkles,
  Play,
  Flame,
  AlertTriangle
} from 'lucide-react';
import { UserProfile } from '../types';
import { getNotificationPermission, requestNotificationPermission, sendTestPushNotification } from '../utils/pushNotifications';
import { useSilentMode } from '../utils/useSilentMode';

export type ActiveTab = 'cocinar' | 'escaner' | 'escuela';

interface NavbarProps {
  appMode?: 'simple' | 'complete';
  onToggleAppMode?: (mode: 'simple' | 'complete') => void;
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  onOpenVoiceAssistant: () => void;
  onOpenShoppingList?: () => void;
  onOpenFridgeScanner?: (mode?: 'level_trio' | 'inspect_product' | 'fridge') => void;
  onOpenTechniques?: () => void;
  onOpenMealPlanner?: () => void;
  onOpenVisualLoops?: () => void;
  onOpenEmergency?: () => void;
  onOpenRecipeImport?: () => void;
  userProfile: UserProfile;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onSelectTab,
  onOpenVoiceAssistant,
  onOpenShoppingList,
  onOpenMealPlanner,
  onOpenVisualLoops,
  onOpenEmergency,
  onOpenRecipeImport,
  userProfile,
}) => {
  const [navPushStatus, setNavPushStatus] = useState<string>('default');
  const [navToast, setNavToast] = useState<string | null>(null);
  const [isToolsMenuOpen, setIsToolsMenuOpen] = useState<boolean>(false);
  const { isSilent, toggleSilentMode } = useSilentMode();
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setNavPushStatus(getNotificationPermission());
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsToolsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleNavPushClick = async () => {
    if (navPushStatus !== 'granted') {
      const res = await requestNotificationPermission();
      setNavPushStatus(res.permission);
      setNavToast(res.message);
      setTimeout(() => setNavToast(null), 4500);
    } else {
      setNavToast('Enviando push de prueba...');
      const res = await sendTestPushNotification();
      setNavToast(res.message);
      setTimeout(() => setNavToast(null), 4500);
    }
  };

  return (
    <>
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-stone-200 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 sm:h-18 gap-3">
            {/* 1. Logo & Identidad de Marca */}
            <div
              onClick={() => onSelectTab('cocinar')}
              className="flex items-center gap-2.5 cursor-pointer group select-none shrink-0"
            >
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-amber-500 flex items-center justify-center text-stone-950 shadow-sm group-hover:scale-105 transition-transform">
                <ChefHat className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-black text-base sm:text-lg text-stone-900 tracking-tight font-serif">
                    Chef Cero
                  </span>
                  <span className="text-[10px] bg-amber-100 text-amber-900 font-bold px-1.5 py-0.2 rounded-full border border-amber-200">
                    IA
                  </span>
                </div>
                <p className="text-[10px] text-stone-500 hidden sm:block">
                  Aprende a cocinar sin miedo
                </p>
              </div>
            </div>

            {/* 2. Selector Maestro de 3 Pestañas Principales (Desktop / Tablet) */}
            <nav className="hidden md:flex items-center gap-1 bg-stone-100 p-1 rounded-2xl border border-stone-200">
              <button
                type="button"
                onClick={() => onSelectTab('cocinar')}
                className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition cursor-pointer ${
                  activeTab === 'cocinar'
                    ? 'bg-white text-stone-950 shadow-xs font-black'
                    : 'text-stone-600 hover:text-stone-950 hover:bg-stone-200/60'
                }`}
              >
                <span>🍳</span>
                <span>Cocinar</span>
              </button>

              <button
                type="button"
                onClick={() => onSelectTab('escaner')}
                className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition cursor-pointer ${
                  activeTab === 'escaner'
                    ? 'bg-white text-stone-950 shadow-xs font-black'
                    : 'text-stone-600 hover:text-stone-950 hover:bg-stone-200/60'
                }`}
              >
                <Camera className="w-4 h-4 text-emerald-600" />
                <span>Inspector de Alimentos</span>
                <span className="text-[9px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.2 rounded-full">
                  Foto
                </span>
              </button>

              <button
                type="button"
                onClick={() => onSelectTab('escuela')}
                className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition cursor-pointer ${
                  activeTab === 'escuela'
                    ? 'bg-white text-stone-950 shadow-xs font-black'
                    : 'text-stone-600 hover:text-stone-950 hover:bg-stone-200/60'
                }`}
              >
                <Award className="w-4 h-4 text-purple-600" />
                <span>Escuela & Cuaderno</span>
                <span className="text-[9px] bg-amber-100 text-amber-900 font-bold px-1.5 py-0.2 rounded-full font-mono">
                  {userProfile.xp} XP
                </span>
              </button>
            </nav>

            {/* 3. Acciones Rápidas Directas */}
            <div className="flex items-center gap-1.5 sm:gap-2" ref={menuRef}>
              {/* Botón S.O.S. de Emergencias en Sartén */}
              {onOpenEmergency && (
                <button
                  type="button"
                  onClick={onOpenEmergency}
                  className="px-2.5 sm:px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-800 text-xs font-black flex items-center gap-1.5 transition cursor-pointer"
                  title="Auxilio rápido si se te quema o pega la comida"
                >
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                  <span className="hidden sm:inline">S.O.S.</span>
                </button>
              )}

              {/* Botón Lista de Compras */}
              {onOpenShoppingList && (
                <button
                  type="button"
                  onClick={onOpenShoppingList}
                  className="px-2.5 sm:px-3 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                  title="Ver lista de compras del supermercado"
                >
                  <ShoppingCart className="w-4 h-4 text-emerald-600" />
                  <span className="hidden lg:inline">Compras</span>
                </button>
              )}

              {/* Botón Principal: Hablar con el Chef (Destacado y Cálido) */}
              <button
                type="button"
                onClick={onOpenVoiceAssistant}
                className="relative px-3 sm:px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-stone-950 font-black text-xs sm:text-sm rounded-xl flex items-center gap-1.5 shadow-sm hover:shadow-md transition-all ring-2 ring-amber-300/50 cursor-pointer"
              >
                <Mic className="w-4 h-4 text-stone-950 animate-pulse" />
                <span className="hidden sm:inline">Hablar con el Chef</span>
                <span className="sm:hidden font-extrabold">Chef</span>
              </button>

              {/* Menú Desplegable "Más Herramientas" */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsToolsMenuOpen(!isToolsMenuOpen)}
                  className={`p-2 rounded-xl border text-xs font-semibold flex items-center gap-1 transition cursor-pointer ${
                    isToolsMenuOpen
                      ? 'bg-stone-200 border-stone-300 text-stone-900'
                      : 'bg-stone-50 border-stone-200 text-stone-600 hover:bg-stone-100 hover:text-stone-900'
                  }`}
                  title="Más herramientas y ajustes"
                >
                  <MoreHorizontal className="w-4 h-4" />
                  <ChevronDown className="w-3 h-3 opacity-60 hidden sm:block" />
                </button>

                {/* Panel Flotante del Menú */}
                {isToolsMenuOpen && (
                  <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-2xl border border-stone-200 shadow-xl p-2 z-50 animate-fade-in text-xs space-y-1">
                    <div className="px-3 py-1.5 text-[10px] font-bold text-stone-400 uppercase tracking-wider">
                      Herramientas de cocina
                    </div>

                    {onOpenMealPlanner && (
                      <button
                        type="button"
                        onClick={() => {
                          onOpenMealPlanner();
                          setIsToolsMenuOpen(false);
                        }}
                        className="w-full text-left px-3 py-2 rounded-xl hover:bg-stone-50 text-stone-700 flex items-center justify-between transition cursor-pointer"
                      >
                        <span className="flex items-center gap-2 font-medium">
                          <Calendar className="w-3.5 h-3.5 text-amber-600" />
                          <span>Planificador Semanal</span>
                        </span>
                        <span className="text-[10px] bg-amber-100 text-amber-900 font-bold px-1.5 py-0.2 rounded-full">
                          Lunes-Domingo
                        </span>
                      </button>
                    )}

                    {onOpenVisualLoops && (
                      <button
                        type="button"
                        onClick={() => {
                          onOpenVisualLoops();
                          setIsToolsMenuOpen(false);
                        }}
                        className="w-full text-left px-3 py-2 rounded-xl hover:bg-stone-50 text-stone-700 flex items-center justify-between transition cursor-pointer"
                      >
                        <span className="flex items-center gap-2 font-medium">
                          <Play className="w-3.5 h-3.5 text-rose-600 fill-rose-600" />
                          <span>Técnicas en Bucle</span>
                        </span>
                        <span className="text-[10px] bg-rose-100 text-rose-800 font-bold px-1.5 py-0.2 rounded-full">
                          4 seg
                        </span>
                      </button>
                    )}

                    {onOpenRecipeImport && (
                      <button
                        type="button"
                        onClick={() => {
                          onOpenRecipeImport();
                          setIsToolsMenuOpen(false);
                        }}
                        className="w-full text-left px-3 py-2 rounded-xl hover:bg-amber-50 text-stone-700 hover:text-amber-950 flex items-center justify-between transition cursor-pointer"
                      >
                        <span className="flex items-center gap-2 font-medium">
                          <span>📋</span>
                          <span>Importar Receta (Pegar Blog o Web)</span>
                        </span>
                        <span className="text-[10px] bg-amber-100 text-amber-900 font-bold px-1.5 py-0.2 rounded-full">
                          Paprika
                        </span>
                      </button>
                    )}

                    <div className="pt-2 border-t border-stone-100 space-y-1">
                      <div className="px-3 py-1 text-[10px] font-bold text-stone-400 uppercase tracking-wider">
                        Preferencias
                      </div>

                      {/* Switch Modo Silencioso */}
                      <button
                        type="button"
                        onClick={toggleSilentMode}
                        className="w-full text-left px-3 py-2 rounded-xl hover:bg-stone-50 text-stone-700 flex items-center justify-between transition cursor-pointer"
                      >
                        <span className="flex items-center gap-2 font-medium">
                          {isSilent ? <VolumeX className="w-3.5 h-3.5 text-amber-600" /> : <Volume2 className="w-3.5 h-3.5 text-stone-500" />}
                          <span>Modo Silencioso (Subtítulos)</span>
                        </span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${isSilent ? 'bg-amber-100 text-amber-900' : 'bg-stone-100 text-stone-500'}`}>
                          {isSilent ? 'ON' : 'OFF'}
                        </span>
                      </button>

                      {/* Push Alerts */}
                      <button
                        type="button"
                        onClick={handleNavPushClick}
                        className="w-full text-left px-3 py-2 rounded-xl hover:bg-stone-50 text-stone-700 flex items-center justify-between transition cursor-pointer"
                      >
                        <span className="flex items-center gap-2 font-medium">
                          {navPushStatus === 'granted' ? <BellRing className="w-3.5 h-3.5 text-emerald-600" /> : <Bell className="w-3.5 h-3.5 text-amber-600" />}
                          <span>Notificaciones Push</span>
                        </span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${navPushStatus === 'granted' ? 'bg-emerald-100 text-emerald-800' : 'bg-stone-100 text-stone-500'}`}>
                          {navPushStatus === 'granted' ? 'Activo' : 'Activar'}
                        </span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {navToast && (
          <div className="absolute top-full right-4 mt-2 px-3 py-2 bg-stone-900 text-white text-xs font-medium rounded-xl shadow-lg flex items-center gap-2 z-50 animate-fade-in border border-stone-800">
            <Check className="w-3.5 h-3.5 text-emerald-400" />
            <span>{navToast}</span>
          </div>
        )}
      </header>

      {/* 4. BARRA DE NAVEGACIÓN INFERIOR FIJA PARA MÓVILES (Estilo iOS / Android Nativo) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-stone-200 px-3 pr-28 py-2 flex items-center justify-between shadow-lg">
        <button
          type="button"
          onClick={() => onSelectTab('cocinar')}
          className={`flex-1 flex flex-col items-center gap-1 py-1 px-1 rounded-xl transition cursor-pointer ${
            activeTab === 'cocinar' ? 'text-amber-600 font-black' : 'text-stone-500 hover:text-stone-900 font-medium'
          }`}
        >
          <span className="text-xl leading-none">🍳</span>
          <span className="text-[10px]">Cocinar</span>
        </button>

        <button
          type="button"
          onClick={() => onSelectTab('escaner')}
          className={`flex-1 flex flex-col items-center gap-1 py-1 px-1 rounded-xl transition cursor-pointer ${
            activeTab === 'escaner' ? 'text-emerald-600 font-black' : 'text-stone-500 hover:text-stone-900 font-medium'
          }`}
        >
          <Camera className="w-5 h-5 text-emerald-600" />
          <span className="text-[10px]">Inspector</span>
        </button>

        <button
          type="button"
          onClick={() => onSelectTab('escuela')}
          className={`flex-1 flex flex-col items-center gap-1 py-1 px-1 rounded-xl transition cursor-pointer ${
            activeTab === 'escuela' ? 'text-purple-600 font-black' : 'text-stone-500 hover:text-stone-900 font-medium'
          }`}
        >
          <Award className="w-5 h-5 text-purple-600" />
          <span className="text-[10px]">Cuaderno</span>
        </button>
      </nav>
    </>
  );
};
