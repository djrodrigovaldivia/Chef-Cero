import React, { useState, useEffect } from 'react';
import { ChefHat, Mic, BookOpen, MapPin, Award, Flame, Sparkles, Bell, BellRing, Check, VolumeX, Volume2 } from 'lucide-react';
import { UserProfile } from '../types';
import { getNotificationPermission, requestNotificationPermission, sendTestPushNotification } from '../utils/pushNotifications';
import { useSilentMode } from '../utils/useSilentMode';

export type ActiveTab = 'cocinar' | 'diccionario' | 'mapa' | 'cuaderno';

interface NavbarProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  onOpenVoiceAssistant: () => void;
  userProfile: UserProfile;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onSelectTab,
  onOpenVoiceAssistant,
  userProfile,
}) => {
  const [navPushStatus, setNavPushStatus] = useState<string>('default');
  const [navToast, setNavToast] = useState<string | null>(null);
  const { isSilent, toggleSilentMode } = useSilentMode();

  useEffect(() => {
    setNavPushStatus(getNotificationPermission());
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
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-stone-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20 gap-3">
          {/* Logo & Brand */}
          <div
            onClick={() => onSelectTab('cocinar')}
            className="flex items-center gap-3 cursor-pointer group"
          >
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-gradient-to-tr from-amber-600 to-amber-400 flex items-center justify-center text-white shadow-md group-hover:scale-105 transition-transform">
              <ChefHat className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-lg sm:text-xl text-stone-900 tracking-tight font-serif">
                  Chef Cero
                </span>
                <span className="hidden sm:inline-block px-2 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-900 rounded-full border border-amber-200">
                  Mentor IA en Vivo
                </span>
              </div>
              <p className="text-[11px] text-stone-500 hidden sm:block">
                Para los que no saben nada de cocina y quieren aprender
              </p>
            </div>
          </div>

          {/* Navigation Tabs (Desktop) */}
          <nav className="hidden md:flex items-center gap-1 bg-stone-100/80 p-1.5 rounded-2xl border border-stone-200/80">
            <button
              onClick={() => onSelectTab('cocinar')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'cocinar'
                  ? 'bg-white text-stone-900 shadow-sm'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <Flame className="w-3.5 h-3.5 text-orange-500" />
              <span>Modo Cocinar</span>
            </button>

            <button
              onClick={() => onSelectTab('diccionario')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'diccionario'
                  ? 'bg-white text-stone-900 shadow-sm'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5 text-amber-600" />
              <span>Diccionario Visual</span>
            </button>

            <button
              onClick={() => onSelectTab('mapa')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'mapa'
                  ? 'bg-white text-stone-900 shadow-sm'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <MapPin className="w-3.5 h-3.5 text-blue-600" />
              <span>¿Dónde va Guardado?</span>
            </button>

            <button
              onClick={() => onSelectTab('cuaderno')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'cuaderno'
                  ? 'bg-white text-stone-900 shadow-sm'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <Award className="w-3.5 h-3.5 text-purple-600" />
              <span>Mi Cuaderno</span>
              <span className="text-[10px] bg-amber-100 text-amber-900 px-1.5 py-0.2 rounded-full font-mono">
                {userProfile.xp} XP
              </span>
            </button>
          </nav>

          {/* Action: Modo Silencioso, Push Alerts & Hablar con el Chef */}
          <div className="flex items-center gap-2">
            {/* Modo Silencioso / Subtítulos en Pantalla */}
            <button
              onClick={toggleSilentMode}
              role="switch"
              aria-checked={isSilent}
              aria-label={isSilent ? 'Desactivar modo silencioso y activar voz' : 'Activar modo silencioso con subtítulos en pantalla'}
              title={
                isSilent
                  ? 'Modo Silencioso activo: las instrucciones y temporizadores se muestran como subtítulos sin ruido'
                  : 'Activar Modo Silencioso: convierte las instrucciones de voz a subtítulos sin emitir sonido'
              }
              className={`p-2 sm:px-3 sm:py-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition ${
                isSilent
                  ? 'bg-amber-100 border-amber-300 text-amber-950 ring-2 ring-amber-400/40'
                  : 'bg-stone-50 border-stone-200 text-stone-600 hover:text-stone-900 hover:bg-stone-100'
              }`}
            >
              {isSilent ? (
                <>
                  <VolumeX className="w-4 h-4 text-amber-700" />
                  <span className="hidden xl:inline text-[11px] font-bold">Modo Silencioso</span>
                  <span className="hidden sm:inline-block xl:hidden text-[11px] font-bold">Silencio</span>
                </>
              ) : (
                <>
                  <Volume2 className="w-4 h-4 text-stone-500" />
                  <span className="hidden xl:inline text-[11px]">Sonido ON</span>
                </>
              )}
            </button>

            <button
              onClick={handleNavPushClick}
              title={
                navPushStatus === 'granted'
                  ? 'Notificaciones Web Push activas (haz clic para probar alerta)'
                  : 'Activar notificaciones Web Push para alertas en segundo plano'
              }
              className={`p-2 sm:px-3 sm:py-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition ${
                navPushStatus === 'granted'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100'
                  : 'bg-stone-50 border-stone-200 text-stone-600 hover:text-stone-900 hover:bg-stone-100'
              }`}
            >
              {navPushStatus === 'granted' ? (
                <>
                  <BellRing className="w-4 h-4 text-emerald-600 animate-pulse" />
                  <span className="hidden xl:inline text-[11px] font-bold">Push Activo</span>
                </>
              ) : (
                <>
                  <Bell className="w-4 h-4 text-amber-600" />
                  <span className="hidden xl:inline text-[11px]">Activar Push</span>
                </>
              )}
            </button>

            <button
              onClick={onOpenVoiceAssistant}
              className="relative px-3.5 sm:px-4 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-stone-950 font-bold text-xs sm:text-sm rounded-xl flex items-center gap-2 shadow-md hover:shadow-lg transition-all ring-2 ring-amber-300/60"
            >
              <Mic className="w-4 h-4 text-stone-950 animate-pulse" />
              <span className="hidden sm:inline">Hablar con el Chef</span>
              <span className="sm:hidden font-extrabold">Chef</span>
              <span className="hidden lg:inline text-[10px] bg-stone-900 text-white px-2 py-0.5 rounded-full font-semibold">
                Manos Libres
              </span>
            </button>
          </div>
        </div>

        {navToast && (
          <div className="absolute top-full right-4 mt-2 px-3 py-2 bg-stone-900 text-white text-xs font-medium rounded-xl shadow-lg flex items-center gap-2 z-50 animate-fade-in border border-stone-800">
            <Check className="w-3.5 h-3.5 text-emerald-400" />
            <span>{navToast}</span>
          </div>
        )}

        {/* Mobile Navigation Bar */}
        <div className="md:hidden flex items-center justify-around py-2 border-t border-stone-100 text-xs">
          <button
            onClick={() => onSelectTab('cocinar')}
            className={`p-1.5 flex flex-col items-center gap-0.5 font-bold ${
              activeTab === 'cocinar' ? 'text-amber-600' : 'text-stone-500'
            }`}
          >
            <Flame className="w-4 h-4" />
            <span>Cocinar</span>
          </button>
          <button
            onClick={() => onSelectTab('diccionario')}
            className={`p-1.5 flex flex-col items-center gap-0.5 font-bold ${
              activeTab === 'diccionario' ? 'text-amber-600' : 'text-stone-500'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Diccionario</span>
          </button>
          <button
            onClick={() => onSelectTab('mapa')}
            className={`p-1.5 flex flex-col items-center gap-0.5 font-bold ${
              activeTab === 'mapa' ? 'text-amber-600' : 'text-stone-500'
            }`}
          >
            <MapPin className="w-4 h-4" />
            <span>Guardado</span>
          </button>
          <button
            onClick={() => onSelectTab('cuaderno')}
            className={`p-1.5 flex flex-col items-center gap-0.5 font-bold ${
              activeTab === 'cuaderno' ? 'text-amber-600' : 'text-stone-500'
            }`}
          >
            <Award className="w-4 h-4" />
            <span>Cuaderno</span>
          </button>
        </div>
      </div>
    </header>
  );
};
