import React, { useState, useEffect, useRef } from 'react';
import { ChefHat, Mic, BookOpen, MapPin, Award, Flame, Bell, BellRing, Check, VolumeX, Volume2, Recycle, ShoppingCart, MoreHorizontal, Sparkles, ChevronDown, Camera, GraduationCap, Coins } from 'lucide-react';
import { UserProfile } from '../types';
import { getNotificationPermission, requestNotificationPermission, sendTestPushNotification } from '../utils/pushNotifications';
import { useSilentMode } from '../utils/useSilentMode';

export type ActiveTab = 'cocinar' | 'autor' | 'sobras' | 'diccionario' | 'mapa' | 'cuaderno';

interface NavbarProps {
  appMode: 'simple' | 'complete';
  onToggleAppMode: (mode: 'simple' | 'complete') => void;
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  onOpenVoiceAssistant: () => void;
  onOpenShoppingList?: () => void;
  onOpenFridgeScanner?: () => void;
  onOpenTechniques?: () => void;
  userProfile: UserProfile;
}

export const Navbar: React.FC<NavbarProps> = ({
  appMode,
  onToggleAppMode,
  activeTab,
  onSelectTab,
  onOpenVoiceAssistant,
  onOpenShoppingList,
  onOpenFridgeScanner,
  onOpenTechniques,
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

  // Cerrar menú desplegable al hacer clic fuera
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

  const handleToolItemClick = (tab: ActiveTab) => {
    onSelectTab(tab);
    onToggleAppMode('complete');
    setIsToolsMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-stone-200 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-18 gap-3">
          {/* Logo & Marca Desestresante */}
          <div
            onClick={() => {
              onToggleAppMode('simple');
              onSelectTab('cocinar');
            }}
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
                Cocina fácil para principiantes
              </p>
            </div>
          </div>

          {/* Selector de Modo: Simple (Zen) vs Completo (Explorar) */}
          <div className="flex items-center bg-stone-100 p-1 rounded-2xl border border-stone-200/80 shadow-2xs">
            <button
              onClick={() => {
                onToggleAppMode('simple');
                onSelectTab('cocinar');
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                appMode === 'simple'
                  ? 'bg-white text-stone-900 shadow-xs'
                  : 'text-stone-500 hover:text-stone-800'
              }`}
            >
              <span>🧘</span>
              <span>Modo Sencillo</span>
            </button>

            <button
              onClick={() => onToggleAppMode('complete')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                appMode === 'complete'
                  ? 'bg-white text-stone-900 shadow-xs'
                  : 'text-stone-500 hover:text-stone-800'
              }`}
            >
              <Flame className="w-3.5 h-3.5 text-orange-500" />
              <span className="hidden sm:inline">Modo Completo</span>
              <span className="sm:hidden">Completo</span>
            </button>
          </div>

          {/* Acciones Principales: Hablar con el Chef + Menú de Herramientas Ordenado */}
          <div className="flex items-center gap-2" ref={menuRef}>
            {/* Botón Principal: Hablar con el Chef (Destacado y Cálido) */}
            <button
              onClick={onOpenVoiceAssistant}
              className="relative px-3.5 sm:px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-stone-950 font-bold text-xs sm:text-sm rounded-xl flex items-center gap-1.5 shadow-sm hover:shadow-md transition-all ring-2 ring-amber-300/50 cursor-pointer"
            >
              <Mic className="w-4 h-4 text-stone-950 animate-pulse" />
              <span className="hidden sm:inline">Hablar con el Chef</span>
              <span className="sm:hidden font-extrabold">Chef</span>
            </button>

            {/* Menú Desplegable "Más Herramientas" (Guarda todo sin saturar la vista) */}
            <div className="relative">
              <button
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

                  {onOpenFridgeScanner && (
                    <button
                      onClick={() => {
                        onOpenFridgeScanner();
                        setIsToolsMenuOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 rounded-xl hover:bg-amber-50 text-stone-700 hover:text-amber-950 flex items-center justify-between transition cursor-pointer"
                    >
                      <span className="flex items-center gap-2 font-medium">
                        <Camera className="w-3.5 h-3.5 text-amber-600" />
                        <span>Escanear Nevera con Cámara</span>
                      </span>
                      <span className="text-[9px] bg-amber-100 text-amber-900 font-bold px-1.5 py-0.2 rounded-full">
                        IA
                      </span>
                    </button>
                  )}

                  {onOpenTechniques && (
                    <button
                      onClick={() => {
                        onOpenTechniques();
                        setIsToolsMenuOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 rounded-xl hover:bg-stone-50 text-stone-700 flex items-center gap-2 font-medium transition cursor-pointer"
                    >
                      <GraduationCap className="w-3.5 h-3.5 text-stone-600" />
                      <span>Guía Sensorial (Puntos exactos)</span>
                    </button>
                  )}

                  {onOpenShoppingList && (
                    <button
                      onClick={() => {
                        onOpenShoppingList();
                        setIsToolsMenuOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 rounded-xl hover:bg-stone-50 text-stone-700 flex items-center justify-between transition cursor-pointer"
                    >
                      <span className="flex items-center gap-2 font-medium">
                        <ShoppingCart className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Lista de Supermercado</span>
                      </span>
                    </button>
                  )}

                  <button
                    onClick={() => handleToolItemClick('sobras')}
                    className="w-full text-left px-3 py-2 rounded-xl hover:bg-stone-50 text-stone-700 flex items-center justify-between transition cursor-pointer"
                  >
                    <span className="flex items-center gap-2 font-medium">
                      <Recycle className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Rescate de Sobras</span>
                    </span>
                    <span className="text-[9px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.2 rounded-full">
                      Zero Waste
                    </span>
                  </button>

                  <button
                    onClick={() => handleToolItemClick('diccionario')}
                    className="w-full text-left px-3 py-2 rounded-xl hover:bg-stone-50 text-stone-700 flex items-center gap-2 font-medium transition cursor-pointer"
                  >
                    <BookOpen className="w-3.5 h-3.5 text-amber-600" />
                    <span>Diccionario Visual de Cocina</span>
                  </button>

                  <button
                    onClick={() => handleToolItemClick('mapa')}
                    className="w-full text-left px-3 py-2 rounded-xl hover:bg-stone-50 text-stone-700 flex items-center gap-2 font-medium transition cursor-pointer"
                  >
                    <MapPin className="w-3.5 h-3.5 text-blue-600" />
                    <span>¿Dónde va Guardado?</span>
                  </button>

                  <button
                    onClick={() => handleToolItemClick('cuaderno')}
                    className="w-full text-left px-3 py-2 rounded-xl hover:bg-stone-50 text-stone-700 flex items-center justify-between transition cursor-pointer"
                  >
                    <span className="flex items-center gap-2 font-medium">
                      <Award className="w-3.5 h-3.5 text-purple-600" />
                      <span>Mi Cuaderno de Aprendiz</span>
                    </span>
                    <span className="text-[10px] bg-amber-100 text-amber-900 font-mono font-bold px-1.5 py-0.2 rounded-full">
                      {userProfile.xp} XP
                    </span>
                  </button>

                  <button
                    onClick={() => handleToolItemClick('cuaderno')}
                    className="w-full text-left px-3 py-2 rounded-xl hover:bg-stone-50 text-stone-700 flex items-center justify-between transition cursor-pointer"
                  >
                    <span className="flex items-center gap-2 font-medium">
                      <Coins className="w-3.5 h-3.5 text-amber-600" />
                      <span>Presupuesto Live & Tokens</span>
                    </span>
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.2 rounded-full">
                      Control
                    </span>
                  </button>

                  <div className="pt-2 border-t border-stone-100 space-y-1">
                    <div className="px-3 py-1 text-[10px] font-bold text-stone-400 uppercase tracking-wider">
                      Preferencias de voz y avisos
                    </div>

                    {/* Switch Modo Silencioso */}
                    <button
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
                      onClick={handleNavPushClick}
                      className="w-full text-left px-3 py-2 rounded-xl hover:bg-stone-50 text-stone-700 flex items-center justify-between transition cursor-pointer"
                    >
                      <span className="flex items-center gap-2 font-medium">
                        {navPushStatus === 'granted' ? <BellRing className="w-3.5 h-3.5 text-emerald-600" /> : <Bell className="w-3.5 h-3.5 text-amber-600" />}
                        <span>Notificaciones de Alerta</span>
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

        {navToast && (
          <div className="absolute top-full right-4 mt-2 px-3 py-2 bg-stone-900 text-white text-xs font-medium rounded-xl shadow-lg flex items-center gap-2 z-50 animate-fade-in border border-stone-800">
            <Check className="w-3.5 h-3.5 text-emerald-400" />
            <span>{navToast}</span>
          </div>
        )}

        {/* Pestañas secundarias en modo Completo (solo se muestran cuando el usuario elige el modo completo) */}
        {appMode === 'complete' && (
          <div className="flex items-center gap-2 py-2 border-t border-stone-100 overflow-x-auto text-xs scrollbar-none">
            <button
              onClick={() => onSelectTab('cocinar')}
              className={`px-3 py-1.5 rounded-xl font-bold transition shrink-0 flex items-center gap-1.5 ${
                activeTab === 'cocinar' ? 'bg-amber-100 text-amber-950 font-black' : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <Flame className="w-3.5 h-3.5 text-orange-500" />
              <span>Catálogo de Recetas</span>
            </button>

            <button
              onClick={() => onSelectTab('autor')}
              className={`px-3 py-1.5 rounded-xl font-bold transition shrink-0 flex items-center gap-1.5 ${
                activeTab === 'autor'
                  ? 'bg-gradient-to-r from-purple-800 to-amber-700 text-white shadow-xs font-black'
                  : 'text-purple-900 bg-purple-50/70 hover:bg-purple-100 border border-purple-200'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Recetas de Autor (IA)</span>
            </button>

            <button
              onClick={() => onSelectTab('sobras')}
              className={`px-3 py-1.5 rounded-xl font-bold transition shrink-0 flex items-center gap-1.5 ${
                activeTab === 'sobras' ? 'bg-emerald-100 text-emerald-950' : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <Recycle className="w-3.5 h-3.5 text-emerald-600" />
              <span>Rescate de Sobras</span>
            </button>

            <button
              onClick={() => onSelectTab('diccionario')}
              className={`px-3 py-1.5 rounded-xl font-bold transition shrink-0 flex items-center gap-1.5 ${
                activeTab === 'diccionario' ? 'bg-amber-100 text-amber-950' : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5 text-amber-600" />
              <span>Diccionario Visual</span>
            </button>

            <button
              onClick={() => onSelectTab('mapa')}
              className={`px-3 py-1.5 rounded-xl font-bold transition shrink-0 flex items-center gap-1.5 ${
                activeTab === 'mapa' ? 'bg-blue-100 text-blue-950' : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <MapPin className="w-3.5 h-3.5 text-blue-600" />
              <span>Guardado</span>
            </button>

            <button
              onClick={() => onSelectTab('cuaderno')}
              className={`px-3 py-1.5 rounded-xl font-bold transition shrink-0 flex items-center gap-1.5 ${
                activeTab === 'cuaderno' ? 'bg-purple-100 text-purple-950' : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <Award className="w-3.5 h-3.5 text-purple-600" />
              <span>Mi Cuaderno ({userProfile.xp} XP)</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
