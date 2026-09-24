import React, { useState, useEffect } from 'react';
import { 
  Play, Pause, RotateCcw, CheckSquare, Square, Clock, Flame, 
  AlertTriangle, ShieldCheck, ChevronRight, ChevronLeft, Sparkles, 
  HelpCircle, ChefHat, Award, PlusCircle, CheckCircle2,
  Bell, BellRing, BellOff, Volume2, VolumeX, MessageSquare, Trash2, Smartphone, Check, AlertCircle,
  Sun, ShieldAlert, Ear, Eye, Wind, ChevronDown, ChevronUp, WifiOff,
  ShoppingCart, Users, Mic, MicOff, Maximize2, Minimize2, HelpCircle as FaqIcon
} from 'lucide-react';
import { Recipe, RecipeStep, UserProfile, ActiveTimer, WorldCuisineId, CULINARY_LEVELS, CulinaryLevel, CulinaryLevelMeta } from '../types';
import { STARTER_RECIPES, WORLD_CUISINES } from '../data/recipeData';
import { NOVICE_FAQS } from '../data/leftoversAndFaqData';
import { playTimerCompletionChime, speakSpanishText } from '../utils/audioAlert';
import { useOnlineStatus } from '../utils/useOnlineStatus';
import { useSilentMode } from '../utils/useSilentMode';
import { scaleIngredientText } from '../utils/servingsScaler';
import { HandsFreeCookingListener } from '../utils/handsFreeListener';
import { ShoppingListModal } from './ShoppingListModal';
import {
  isPushSupported,
  getNotificationPermission,
  registerChefServiceWorker,
  requestPushPermissionAndSubscribe,
  requestNotificationPermission,
  checkNotificationPermissionOnTimerStart,
  scheduleServerPushNotification,
  cancelServerPushNotification,
  sendTestPushNotification,
  showLocalNotification,
} from '../utils/pushNotifications';
import {
  requestNotificationPermission as requestBrowserNotificationPermission,
  sendTimerAlertNotification,
  sendCustomNotification,
  isRunningInIframe,
} from '../utils/notifications';
import { setupWakeLockAutoRefresh, isWakeLockSupported } from '../utils/wakeLock';
import { CookingEmergencyModal } from './CookingEmergencyModal';
import { FloatingTimerIsland } from './FloatingTimerIsland';

interface CookingModeProps {
  userProfile: UserProfile;
  onUpdateProfile: (updated: Partial<UserProfile>) => void;
  onOpenVoiceAssistantWithContext: (context: {
    recipeTitle: string;
    stepNumber: number;
    stepInstruction: string;
    heatLevel: string;
  }) => void;
  incomingTimer?: { seconds: number; label: string } | null;
  onClearIncomingTimer?: () => void;
  onLearnFact?: (category: 'fuego' | 'gustos' | 'equipamiento' | 'habito' | 'fortaleza', fact: string) => void;
  externalSelectedRecipe?: Recipe | null;
  onRecipeConsumed?: () => void;
}

export const CookingMode: React.FC<CookingModeProps> = ({
  userProfile,
  onUpdateProfile,
  onOpenVoiceAssistantWithContext,
  incomingTimer,
  onClearIncomingTimer,
  onLearnFact,
  externalSelectedRecipe,
  onRecipeConsumed,
}) => {
  const [recipesList, setRecipesList] = useState<Recipe[]>(STARTER_RECIPES);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe>(STARTER_RECIPES[0]);
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [miseEnPlaceChecked, setMiseEnPlaceChecked] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (externalSelectedRecipe) {
      setSelectedRecipe(externalSelectedRecipe);
      setCurrentStepIndex(0);
      setMiseEnPlaceChecked({});
      setCookingStage('mise');
      if (onRecipeConsumed) onRecipeConsumed();
    }
  }, [externalSelectedRecipe, onRecipeConsumed]);

  // World Cuisines and Budget Filtering
  const [selectedCuisine, setSelectedCuisine] = useState<WorldCuisineId>('todas');
  const [generatorCuisine, setGeneratorCuisine] = useState<WorldCuisineId>('economica_bbb');
  const [generatorBudgetFocus, setGeneratorBudgetFocus] = useState<boolean>(true);
  
  // Custom ingredients generator modal
  const [showGeneratorModal, setShowGeneratorModal] = useState(false);
  const [customIngredientsInput, setCustomIngredientsInput] = useState('');
  const [isGeneratingRecipe, setIsGeneratingRecipe] = useState(false);

  // Active timers
  const [activeTimers, setActiveTimers] = useState<ActiveTimer[]>([]);

  // Web Push Notifications state
  const [pushStatus, setPushStatus] = useState<'granted' | 'denied' | 'default' | 'unsupported'>('default');
  const [isSubscribingPush, setIsSubscribingPush] = useState(false);
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [pushFeedbackMessage, setPushFeedbackMessage] = useState<string | null>(null);

  // Comprobación de notificaciones al iniciar temporizadores
  const [timerNotice, setTimerNotice] = useState<{
    type: 'success' | 'warning' | 'info';
    title: string;
    message: string;
  } | null>(null);

  // Post-cooking evaluation modal
  const [showEvalModal, setShowEvalModal] = useState(false);
  const [evalRating, setEvalRating] = useState<'En su punto perfecto' | 'Salado' | 'Seco' | 'Se quemó' | 'Crudo adentro' | 'Le faltó sabor'>('En su punto perfecto');
  const [evalDifficulty, setEvalDifficulty] = useState('Controlar la intensidad del fuego');
  const [isSubmittingEval, setIsSubmittingEval] = useState(false);
  const [evalFeedbackResult, setEvalFeedbackResult] = useState<any>(null);

  // Screen Wake Lock (mantener la pantalla encendida automáticamente mientras cocinas)
  const [wakeLockActive, setWakeLockActive] = useState(false);
  const [wakeLockPreferred, setWakeLockPreferred] = useState(true);

  // Modal de Emergencias Culinarias S.O.S. (1 toque para rescate)
  const [isEmergencyModalOpen, setIsEmergencyModalOpen] = useState(false);

  // Desplegable de ciencia culinaria por paso
  const [isScienceExpanded, setIsScienceExpanded] = useState(false);

  // Flujo ordenado por etapas para eliminar el caos visual y la sobrecarga de información
  const [cookingStage, setCookingStage] = useState<'receta' | 'mise' | 'fuegos'>('receta');
  // Referencias secundarias desplegables durante la cocción activa
  const [showHeatGuideInCooking, setShowHeatGuideInCooking] = useState(false);
  const [showIngredientsInCooking, setShowIngredientsInCooking] = useState(false);

  // Escalador de porciones inteligente (1, 2, 4 porciones)
  const [targetServings, setTargetServings] = useState<number>(selectedRecipe.servings || 2);
  // Modal de Lista de Compras Compartible
  const [isShoppingModalOpen, setIsShoppingModalOpen] = useState(false);
  const [addedToShoppingNotice, setAddedToShoppingNotice] = useState<string | null>(null);

  // Modo Manos Libres con Escucha Continua (Estilo SideChef)
  const [isHandsFreeActive, setIsHandsFreeActive] = useState<boolean>(false);
  const [handsFreeLastHeard, setHandsFreeLastHeard] = useState<string | null>(null);
  const [handsFreeListener, setHandsFreeListener] = useState<HandsFreeCookingListener | null>(null);

  // Modo Inmersivo Pantalla Completa
  const [isFullScreenCooking, setIsFullScreenCooking] = useState<boolean>(false);

  // Acordeón FAQ de Miedos y Mitos del Novato
  const [showFaqSection, setShowFaqSection] = useState<boolean>(false);
  const [expandedFaqId, setExpandedFaqId] = useState<string | null>(null);

  // Sincronizar porciones objetivo cuando cambia la receta
  useEffect(() => {
    setTargetServings(selectedRecipe.servings || 2);
  }, [selectedRecipe.id]);

  // Evolución y Progresión Culinaria (Desde no saber nada hasta dominar la cocina)
  const [levelFilter, setLevelFilter] = useState<'all' | 'my_level' | number>('all');
  const [showRoadmapModal, setShowRoadmapModal] = useState(false);
  const [levelUpCelebration, setLevelUpCelebration] = useState<{
    oldLevel: number;
    newLevel: number;
    newTitle: string;
    newBadge: string;
    unlockedTechniques: string[];
  } | null>(null);
  const [mentorRecommendation, setMentorRecommendation] = useState<{
    recommendedRecipeId: string;
    headline: string;
    mentorReasoning: string;
    learningFocus: string;
    encouragement: string;
  } | null>(null);
  const [isLoadingRecommendation, setIsLoadingRecommendation] = useState(false);

  // Cargar recomendación pedagógica adaptativa para el nivel actual
  useEffect(() => {
    let isMounted = true;
    const fetchMentorRecommendation = async () => {
      try {
        setIsLoadingRecommendation(true);
        const res = await fetch('/api/mentor/recommend-next', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userProfile,
            recipesCatalog: recipesList,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          if (isMounted) setMentorRecommendation(data);
        }
      } catch (err) {
        console.warn('Recommendation fetch failed:', err);
      } finally {
        if (isMounted) setIsLoadingRecommendation(false);
      }
    };
    fetchMentorRecommendation();
    return () => {
      isMounted = false;
    };
  }, [userProfile.level, userProfile.cookedHistory?.length]);

  // Estado de conexión a internet para asegurar la experiencia offline
  const isOnline = useOnlineStatus();

  // Modo Silencioso con subtítulos accesibles
  const { isSilent, toggleSilentMode } = useSilentMode();

  // Gestionar Screen Wake Lock automático
  useEffect(() => {
    const cleanup = setupWakeLockAutoRefresh(wakeLockPreferred, setWakeLockActive);
    return cleanup;
  }, [wakeLockPreferred]);

  // Manejo de manos libres por voz continuo (Estilo SideChef)
  useEffect(() => {
    if (!isHandsFreeActive) {
      if (handsFreeListener) {
        handsFreeListener.stop();
        setHandsFreeListener(null);
      }
      return;
    }

    const listener = new HandsFreeCookingListener({
      onNextStep: () => {
        if (currentStepIndex < selectedRecipe.steps.length - 1) {
          setCurrentStepIndex((prev) => prev + 1);
          speakSpanishText(`Paso ${currentStepIndex + 2}: ${selectedRecipe.steps[currentStepIndex + 1]?.title}`);
        } else {
          speakSpanishText('¡Has completado el último paso de la receta!');
        }
      },
      onPrevStep: () => {
        if (currentStepIndex > 0) {
          setCurrentStepIndex((prev) => prev - 1);
          speakSpanishText(`Paso ${currentStepIndex}: ${selectedRecipe.steps[currentStepIndex - 1]?.title}`);
        }
      },
      onRepeatStep: () => {
        const step = selectedRecipe.steps[currentStepIndex];
        if (step) {
          speakSpanishText(`Paso ${step.stepNumber}: ${step.title}. ${step.instruction}`);
        }
      },
      onStartTimer: () => {
        const step = selectedRecipe.steps[currentStepIndex];
        if (step?.timerSeconds) {
          handleStartTimer(step.timerSeconds, step.timerLabel || `Paso ${step.stepNumber}`, currentStepIndex);
          speakSpanishText(`Temporizador de ${Math.round(step.timerSeconds / 60)} minutos iniciado.`);
        } else {
          speakSpanishText('Este paso no requiere temporizador fijo.');
        }
      },
      onPauseTimer: () => {
        setActiveTimers((prev) => prev.map((t) => ({ ...t, isRunning: false })));
        speakSpanishText('Temporizadores pausados.');
      },
      onEmergency: () => {
        setIsEmergencyModalOpen(true);
        speakSpanishText('Abriendo menú de emergencias culinarias de inmediato.');
      },
      onStatusChange: (_listening, lastWord) => {
        if (lastWord) {
          setHandsFreeLastHeard(lastWord);
          setTimeout(() => setHandsFreeLastHeard(null), 3000);
        }
      },
    });

    listener.start();
    setHandsFreeListener(listener);

    return () => {
      listener.stop();
    };
  }, [isHandsFreeActive, currentStepIndex, selectedRecipe]);

  // Listener para comandos de voz provenientes de Modo Manos Sucias en VoiceAssistantModal
  useEffect(() => {
    const handleRemoteStepCmd = (e: any) => {
      const action = e.detail?.action;
      if (!action) return;

      if (action === 'next') {
        if (currentStepIndex < selectedRecipe.steps.length - 1) {
          setCurrentStepIndex((prev) => prev + 1);
          speakSpanishText(`Paso ${currentStepIndex + 2}: ${selectedRecipe.steps[currentStepIndex + 1]?.title}`);
        } else {
          speakSpanishText('¡Has completado el último paso de la receta!');
        }
      } else if (action === 'prev') {
        if (currentStepIndex > 0) {
          setCurrentStepIndex((prev) => prev - 1);
          speakSpanishText(`Paso ${currentStepIndex}: ${selectedRecipe.steps[currentStepIndex - 1]?.title}`);
        }
      } else if (action === 'repeat') {
        const step = selectedRecipe.steps[currentStepIndex];
        if (step) {
          speakSpanishText(`Paso ${step.stepNumber}: ${step.title}. ${step.instruction}`);
        }
      } else if (action === 'timer') {
        const step = selectedRecipe.steps[currentStepIndex];
        if (step?.timerSeconds) {
          handleStartTimer(step.timerSeconds, step.timerLabel || `Paso ${step.stepNumber}`, currentStepIndex);
          speakSpanishText(`Temporizador de ${Math.round(step.timerSeconds / 60)} minutos iniciado.`);
        } else {
          speakSpanishText('Este paso no requiere temporizador fijo.');
        }
      } else if (action === 'pause') {
        setActiveTimers((prev) => prev.map((t) => ({ ...t, isRunning: false })));
        speakSpanishText('Temporizadores pausados.');
      } else if (action === 'emergency') {
        setIsEmergencyModalOpen(true);
        speakSpanishText('Abriendo menú de emergencias culinarias de inmediato.');
      }
    };

    window.addEventListener('chef-cero-step-cmd', handleRemoteStepCmd);
    return () => window.removeEventListener('chef-cero-step-cmd', handleRemoteStepCmd);
  }, [currentStepIndex, selectedRecipe]);

  // Difundir contexto de la receta en curso para que el VoiceAssistantModal y Modo Manos Sucias lo tengan al instante
  useEffect(() => {
    const step = selectedRecipe.steps[currentStepIndex];
    window.dispatchEvent(
      new CustomEvent('chef-cero-recipe-context', {
        detail: {
          recipeTitle: selectedRecipe.title,
          stepNumber: step?.stepNumber ?? currentStepIndex + 1,
          totalSteps: selectedRecipe.steps.length,
          stepTitle: step?.title,
          stepInstruction: step?.instruction,
          heatLevel: step?.heatLevel,
          timerSeconds: step?.timerSeconds,
        },
      })
    );
  }, [currentStepIndex, selectedRecipe]);

  // Inicializar Service Worker y verificar soporte de Notificaciones al montar
  useEffect(() => {
    if (isPushSupported()) {
      setPushStatus(getNotificationPermission());
      registerChefServiceWorker();
    } else {
      setPushStatus('unsupported');
    }
  }, []);

  // Detector de visibilidad de pestaña: si el usuario vuelve tras tener la pestaña en segundo plano,
  // recalculamos los segundos exactos contra la hora real (targetTimestamp) para evitar desfases por throttling del navegador
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        setActiveTimers((prev) =>
          prev.map((timer) => {
            if (!timer.isRunning || !timer.targetTimestamp) return timer;
            const remaining = Math.max(0, Math.round((timer.targetTimestamp - Date.now()) / 1000));
            if (remaining <= 0) {
              playTimerCompletionChime();
              speakSpanishText(`¡Tiempo cumplido para: ${timer.label}! Revisa tu cocina.`);
              sendTimerAlertNotification(timer.label, selectedRecipe.title);
              showLocalNotification(
                '⏰ ¡Tiempo cumplido en Chef Cero!',
                `El temporizador para "${timer.label}" ha finalizado. ¡Revisa tu sartén u olla!`
              );
              return { ...timer, remainingSeconds: 0, isRunning: false, targetTimestamp: undefined };
            }
            return { ...timer, remainingSeconds: remaining };
          })
        );
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // Timer interval ticker con compensación de tiempo real
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveTimers((prev) =>
        prev.map((timer) => {
          if (!timer.isRunning) return timer;

          let remaining = timer.remainingSeconds - 1;
          if (timer.targetTimestamp) {
            remaining = Math.max(0, Math.round((timer.targetTimestamp - Date.now()) / 1000));
          }

          if (remaining <= 0) {
            playTimerCompletionChime();
            speakSpanishText(`¡Tiempo cumplido para: ${timer.label}! Revisa tu cocina.`);
            sendTimerAlertNotification(timer.label, selectedRecipe.title);
            showLocalNotification(
              '⏰ ¡Tiempo cumplido en Chef Cero!',
              `El temporizador para "${timer.label}" (${selectedRecipe.title}) ha terminado. ¡Revisa el fuego!`
            );
            return { ...timer, remainingSeconds: 0, isRunning: false, targetTimestamp: undefined };
          }
          return { ...timer, remainingSeconds: remaining };
        })
      );
    }, 1000);

    return () => clearInterval(interval);
  }, [selectedRecipe.title]);

  const handleStartTimer = async (seconds: number, label: string, stepIndex?: number) => {
    // Solicitar los permisos necesarios mediante Notification.requestPermission()
    try {
      await requestBrowserNotificationPermission();
    } catch {}

    const targetTimestamp = Date.now() + seconds * 1000;
    const existing = activeTimers.find((t) => t.label === label);
    const timerId = existing ? existing.id : 'timer-' + Date.now();

    if (existing) {
      setActiveTimers((prev) =>
        prev.map((t) =>
          t.id === existing.id
            ? { ...t, remainingSeconds: seconds, totalSeconds: seconds, isRunning: true, targetTimestamp }
            : t
        )
      );
    } else {
      const newTimer: ActiveTimer = {
        id: timerId,
        label,
        totalSeconds: seconds,
        remainingSeconds: seconds,
        isRunning: true,
        stepIndex,
        targetTimestamp,
      };
      setActiveTimers((prev) => [...prev, newTimer]);
    }

    // Programar la notificación Web Push en el servidor de fondo
    scheduleServerPushNotification(timerId, label, seconds, selectedRecipe.title);

    // Comprobación de permisos al iniciar el temporizador para asegurar avisos fuera de la pestaña
    try {
      const checkResult = await checkNotificationPermissionOnTimerStart(label);
      setPushStatus(checkResult.permission);
      setTimerNotice(checkResult.feedbackNotice);

      // Auto-ocultar notificación informativa pasados 7 segundos
      setTimeout(() => {
        setTimerNotice((current) => (current === checkResult.feedbackNotice ? null : current));
      }, 7000);
    } catch (err) {
      console.warn('Chef Cero: Error comprobando permisos de notificación al iniciar temporizador:', err);
    }
  };

  // Escuchar solicitudes de temporizador originadas por el Asistente de Voz
  useEffect(() => {
    if (incomingTimer && incomingTimer.seconds > 0) {
      handleStartTimer(incomingTimer.seconds, incomingTimer.label);
      if (onClearIncomingTimer) {
        onClearIncomingTimer();
      }
    }
  }, [incomingTimer]);

  const toggleTimerPause = (timerId: string) => {
    setActiveTimers((prev) =>
      prev.map((t) => {
        if (t.id === timerId) {
          const nextRunning = !t.isRunning;
          if (nextRunning) {
            const targetTimestamp = Date.now() + t.remainingSeconds * 1000;
            scheduleServerPushNotification(timerId, t.label, t.remainingSeconds, selectedRecipe.title);
            return { ...t, isRunning: true, targetTimestamp };
          } else {
            cancelServerPushNotification(timerId);
            return { ...t, isRunning: false, targetTimestamp: undefined };
          }
        }
        return t;
      })
    );
  };

  const resetTimer = (timerId: string) => {
    cancelServerPushNotification(timerId);
    setActiveTimers((prev) =>
      prev.map((t) =>
        t.id === timerId
          ? { ...t, remainingSeconds: t.totalSeconds, isRunning: false, targetTimestamp: undefined }
          : t
      )
    );
  };

  const removeTimer = (timerId: string) => {
    cancelServerPushNotification(timerId);
    setActiveTimers((prev) => prev.filter((t) => t.id !== timerId));
  };

  // Manejador para solicitar y habilitar Web Push usando la función utilitaria
  const handleEnablePushNotifications = async () => {
    setIsSubscribingPush(true);
    setPushFeedbackMessage(null);
    try {
      await requestBrowserNotificationPermission();
      const res = await requestNotificationPermission();
      setPushStatus(res.permission);
      setPushFeedbackMessage(res.message);
      if (res.granted) {
        sendCustomNotification('¡Notificaciones activadas!', {
          body: 'Chef Cero te avisará con "¡Tiempo cumplido!" incluso si estás en otra pestaña.',
        });
        setTimerNotice({
          type: 'success',
          title: 'Notificaciones activadas',
          message: 'Recibirás avisos sonoros y en pantalla aunque minimices el navegador.',
        });
        setTimeout(() => setTimerNotice(null), 6000);
      }
    } catch {
      setPushFeedbackMessage('Error al activar notificaciones push.');
    } finally {
      setIsSubscribingPush(false);
    }
  };

  // Enviar alerta de prueba inmediata
  const handleTestPushAlert = async () => {
    setIsSendingTest(true);
    setPushFeedbackMessage('Emitiendo notificación push de prueba...');
    try {
      const res = await sendTestPushNotification();
      setPushFeedbackMessage(res.message);
      setTimeout(() => {
        setPushFeedbackMessage(null);
      }, 5000);
    } catch {
      setPushFeedbackMessage('Error al probar la notificación.');
    } finally {
      setIsSendingTest(false);
    }
  };

  const toggleMiseItem = (idx: number) => {
    setMiseEnPlaceChecked((prev) => ({
      ...prev,
      [idx]: !prev[idx],
    }));
  };

  const allMiseChecked =
    selectedRecipe.miseEnPlace.length > 0 &&
    selectedRecipe.miseEnPlace.every((_, idx) => miseEnPlaceChecked[idx]);

  const currentStep = selectedRecipe.steps[currentStepIndex] || selectedRecipe.steps[0];

  const handleGenerateRecipeWithIngredients = async () => {
    if (!customIngredientsInput.trim()) return;
    setIsGeneratingRecipe(true);

    try {
      const res = await fetch('/api/recipe/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ingredients: customIngredientsInput,
          cuisine: generatorCuisine,
          budgetFocus: generatorBudgetFocus,
          userProfile: {
            levelTitle: userProfile.levelTitle,
            pastMistakes: userProfile.pastMistakes,
          },
        }),
      });
      const data = await res.json();
      if (data.title) {
        const newRecipe: Recipe = {
          id: 'custom-' + Date.now(),
          title: data.title,
          description: data.description || 'Receta personalizada para tus ingredientes.',
          servings: data.servings || 1,
          totalTimeMinutes: data.totalTimeMinutes || 15,
          difficulty: data.difficulty || 'Principiante',
          cuisine: data.cuisine || generatorCuisine,
          cuisineName: data.cuisineName || 'Cocina Personalizada',
          countryFlag: data.countryFlag || '🍳',
          isBudgetFriendly: data.isBudgetFriendly ?? generatorBudgetFocus,
          estimatedCostLabel: data.estimatedCostLabel || 'Económica (<$3.50 USD)',
          culturalSecret: data.culturalSecret,
          pantrySubstitutes: data.pantrySubstitutes,
          imageUrl: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80',
          safetyAlerts: data.safetyAlerts || ['Vigila el fuego'],
          miseEnPlace: data.miseEnPlace || ['Ingredientes listos'],
          heatGuideExplanation: data.heatGuideExplanation || 'Fuego bajo y medio para evitar que se queme.',
          steps: data.steps || [],
        };
        setRecipesList((prev) => [newRecipe, ...prev]);
        setSelectedRecipe(newRecipe);
        setCurrentStepIndex(0);
        setMiseEnPlaceChecked({});
        setShowGeneratorModal(false);
        setCustomIngredientsInput('');
      } else {
        throw new Error('Respuesta de receta incompleta');
      }
    } catch (err) {
      console.warn('Recipe gen error, activando generador sensorial offline:', err);
      const ingr = customIngredientsInput.trim();
      const offlineRecipe: Recipe = {
        id: 'custom-offline-' + Date.now(),
        title: `Salteado Suave con ${ingr.slice(0, 28)}`,
        description: 'Preparación express diseñada para principiantes, con control de temperatura suave para que nada se pegue.',
        servings: 1,
        totalTimeMinutes: 12,
        difficulty: 'Principiante',
        cuisine: generatorCuisine,
        cuisineName: generatorCuisine === 'chilena_criolla' ? 'Chilena & Criolla' : generatorCuisine === 'mexicana' ? 'Mexicana Real' : generatorCuisine === 'asiatica' ? 'Asiática de Barrio' : 'Cocina Económica',
        countryFlag: generatorCuisine === 'chilena_criolla' ? '🇨🇱' : generatorCuisine === 'mexicana' ? '🇲🇽' : generatorCuisine === 'asiatica' ? '🥢' : '🍳',
        isBudgetFriendly: true,
        estimatedCostLabel: 'Económica (<$2.50 USD)',
        culturalSecret: 'El control suave del calor garantiza que los ingredientes liberen su sabor sin amargar.',
        pantrySubstitutes: [
          {
            original: 'Ingredientes o salsas costosas',
            substitute: 'Aceite común + pizca de sal + ajo o cebolla',
            reason: 'Es la base aromática universal de bajo costo.',
          },
        ],
        imageUrl: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80',
        safetyAlerts: [
          'Pica y organiza todos los ingredientes antes de encender la hornalla.',
          'Mantén el mango de la sartén siempre hacia el interior de la mesada.',
          'Si algo empieza a chispear o humear, retira la sartén del fuego de inmediato.',
        ],
        miseEnPlace: [
          `Tus ingredientes lavados y troceados: ${ingr}`,
          '1 cucharadita de aceite de oliva o girasol',
          '1 pizca pequeña de sal en los dedos',
        ],
        heatGuideExplanation: 'Fuego medio-bajo en todo momento para que tengas control total sin que nada se dore en exceso.',
        steps: [
          {
            stepNumber: 1,
            title: 'Mise en Place: Preparar y medir',
            instruction: `Corta ${ingr} en bocados homogéneos sobre una tabla seca y déjalos en un plato cerca de la hornalla.`,
            heatLevel: 'apagado',
            tip: 'Tener todo cortado antes de calentar el aceite elimina el 90% de la ansiedad en la cocina.',
            timerSeconds: 0,
            sensoryCues: {
              sight: 'Todos los trozos de tamaño similar para cocción uniforme.',
              smell: 'Aromas limpios y frescos de ingredientes crudos.',
              sound: 'Silencio total, hornalla apagada.',
            },
          },
          {
            stepNumber: 2,
            title: 'Calentar la base con aceite',
            instruction: 'Pon la sartén a fuego medio, agrega la cucharadita de aceite y espera 45 segundos a que se fluidifique.',
            heatLevel: 'medio',
            tip: 'Si ves el más mínimo hilo de humo, apaga la hornalla: el aceite se calentó de más.',
            timerSeconds: 45,
            sensoryCues: {
              sight: 'El aceite brilla y se mueve ligero como agua al inclinar la sartén.',
              smell: 'Aroma tibio a aceite, sin humo en absoluto.',
              sound: 'Silencio, listo para recibir los ingredientes.',
            },
          },
          {
            stepNumber: 3,
            title: 'Saltear y dorar suavemente',
            instruction: `Agrega con cuidado ${ingr}. Remueve suavemente con espátula de madera o silicona durante 4 a 5 minutos.`,
            heatLevel: 'bajo',
            tip: 'No necesitas mover la sartén en el aire; remueve con calma usando una cuchara o espátula.',
            timerSeconds: 270,
            sensoryCues: {
              sight: 'Bordes ligeramente dorados y textura tierna al pinchar con un tenedor.',
              smell: 'Aroma apetitoso y tostado suave.',
              sound: 'Chisporroteo rítmico y constante, como lluvia sobre un tejado.',
            },
          },
          {
            stepNumber: 4,
            title: 'Sazonar y emplatar',
            instruction: 'Apaga el fuego, retira la sartén a una hornalla apagada, agrega la pizca de sal, mezcla y sirve en un plato hondo.',
            heatLevel: 'apagado',
            tip: 'Servir en plato tibio conserva mejor los aromas.',
            timerSeconds: 0,
            sensoryCues: {
              sight: 'Colores vivos, brillo suave y sin restos quemados.',
              smell: 'Aroma cálido y reconfortante.',
              sound: 'El chisporroteo cesa al apagar el fuego.',
            },
          },
        ],
      };
      setRecipesList((prev) => [offlineRecipe, ...prev]);
      setSelectedRecipe(offlineRecipe);
      setCurrentStepIndex(0);
      setMiseEnPlaceChecked({});
      setShowGeneratorModal(false);
      setCustomIngredientsInput('');
    } finally {
      setIsGeneratingRecipe(false);
    }
  };

  const handleFinishCooking = () => {
    setShowEvalModal(true);
  };

  const handleSubmitEvaluation = async () => {
    setIsSubmittingEval(true);
    try {
      const res = await fetch('/api/eval', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipeTitle: selectedRecipe.title,
          rating: evalRating,
          difficultyEncountered: evalDifficulty,
          userProfile,
        }),
      });
      const data = await res.json();
      setEvalFeedbackResult(data);

      // Award XP & calculate level progression based on CULINARY_LEVELS
      const newXp = userProfile.xp + (data.xpAwarded || 50);
      let newLevel = userProfile.level;
      let newLevelTitle = userProfile.levelTitle;

      if (newXp >= 900) {
        newLevel = 5;
        newLevelTitle = 'Nivel 5: Chef Intuitivo';
      } else if (newXp >= 500) {
        newLevel = 4;
        newLevelTitle = 'Nivel 4: Alquimista de Sabores';
      } else if (newXp >= 250) {
        newLevel = 3;
        newLevelTitle = 'Nivel 3: Cocinero Casero Seguro';
      } else if (newXp >= 100) {
        newLevel = 2;
        newLevelTitle = 'Nivel 2: Aprendiz del Fuego';
      } else {
        newLevel = 1;
        newLevelTitle = 'Nivel 1: Cero Absoluto';
      }

      // Check if user leveled up
      if (newLevel > userProfile.level) {
        const newLevelMeta = CULINARY_LEVELS.find((l) => l.level === newLevel);
        setLevelUpCelebration({
          oldLevel: userProfile.level,
          newLevel,
          newTitle: newLevelMeta?.title || newLevelTitle,
          newBadge: newLevelMeta?.badge || '🎉',
          unlockedTechniques: newLevelMeta?.unlockedTechniques || [],
        });
      }

      const updatedMistakes = [...userProfile.pastMistakes];
      if (data.detectedMistake && !updatedMistakes.includes(data.detectedMistake)) {
        updatedMistakes.push(data.detectedMistake);
      }

      const updatedSkills = [...(userProfile.masteredSkills || [])];
      if (data.skillImproved && !updatedSkills.includes(data.skillImproved)) {
        updatedSkills.push(data.skillImproved);
      }

      const updatedPreferences = [...(userProfile.flavorPreferences || [])];
      if (data.tastePreferenceDetected && !updatedPreferences.includes(data.tastePreferenceDetected)) {
        updatedPreferences.push(data.tastePreferenceDetected);
        if (onLearnFact) {
          onLearnFact('gustos', data.tastePreferenceDetected);
        }
      }

      if (data.detectedMistake && onLearnFact) {
        onLearnFact('fuego', `Ojo en ${selectedRecipe.title}: ${data.detectedMistake}`);
      }

      if (data.skillImproved && onLearnFact) {
        onLearnFact('fortaleza', `Dominó ${data.skillImproved} preparando ${selectedRecipe.title}`);
      }

      const updatedBoosters = [...(userProfile.flavorBoostersLearned || [])];
      if (data.flavorBoosterLearned) {
        updatedBoosters.unshift({
          dish: selectedRecipe.title,
          tip: data.flavorBoosterLearned,
          category: 'acidez',
          date: 'Hoy',
        });
      }

      let newAiTone = userProfile.aiToneSetting || 'mentor_paciencia';
      let newComplexity = userProfile.complexityLevel || 'basico_guiado';

      if (newLevel >= 4) {
        newAiTone = 'chef_creativo';
        newComplexity = 'audaz_creativo';
      } else if (newLevel >= 3) {
        newAiTone = 'complice_culinario';
        newComplexity = 'intermedio_practico';
      }

      const newRecord = {
        id: 'dish-' + Date.now(),
        recipeTitle: selectedRecipe.title,
        date: new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }),
        rating: evalRating,
        difficultyFaced: evalDifficulty,
        mentorTip: data.personalizedAdvice || data.mentorNote,
        xpEarned: data.xpAwarded || 50,
        skillImproved: data.skillImproved,
        flavorBoosterLearned: data.flavorBoosterLearned,
        tastePreferenceDetected: data.tastePreferenceDetected,
      };

      onUpdateProfile({
        xp: newXp,
        level: newLevel,
        levelTitle: newLevelTitle,
        pastMistakes: updatedMistakes,
        masteredSkills: updatedSkills,
        flavorPreferences: updatedPreferences,
        flavorBoostersLearned: updatedBoosters,
        aiToneSetting: newAiTone,
        complexityLevel: newComplexity,
        cookedHistory: [newRecord, ...userProfile.cookedHistory],
      });
    } catch (err) {
      console.error('Eval error:', err);
    } finally {
      setIsSubmittingEval(false);
    }
  };

  const formatSeconds = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const s = sec % 60;
    return `${mins}:${s < 10 ? '0' : ''}${s}`;
  };

  const activeCuisineMeta = WORLD_CUISINES.find((c) => c.id === selectedCuisine);

  const currentLevel = (userProfile.level || 1) as CulinaryLevel;
  const currentLevelMeta = CULINARY_LEVELS.find((l) => l.level === currentLevel) || CULINARY_LEVELS[0];
  const nextLevelMeta = CULINARY_LEVELS.find((l) => l.level === currentLevel + 1) || null;

  const recommendedRecipeObj = mentorRecommendation?.recommendedRecipeId
    ? recipesList.find((r) => r.id === mentorRecommendation.recommendedRecipeId) || null
    : null;

  const filteredRecipes = recipesList.filter((r) => {
    // Cuisine filter
    let matchesCuisine = true;
    if (selectedCuisine === 'economica_bbb') {
      matchesCuisine = r.isBudgetFriendly || r.cuisine === 'economica_bbb';
    } else if (selectedCuisine !== 'todas') {
      matchesCuisine = r.cuisine === selectedCuisine;
    }

    // Level progression filter
    let matchesLevel = true;
    const rLevel = r.requiredLevel || 1;
    if (levelFilter === 'my_level') {
      matchesLevel = rLevel <= userProfile.level;
    } else if (typeof levelFilter === 'number') {
      matchesLevel = rLevel === levelFilter;
    }

    return matchesCuisine && matchesLevel;
  });

  return (
    <div className="space-y-6">
      {/* Dynamic Island Flotante de Temporizadores Múltiples */}
      <FloatingTimerIsland
        activeTimers={activeTimers}
        onTogglePause={toggleTimerPause}
        onRemoveTimer={removeTimer}
        onResetTimer={resetTimer}
      />

      {/* Selector Principal de Etapas (Flujo Claro y Sin Caos Visual) */}
      <div className="bg-white p-2 rounded-2xl border border-stone-200 shadow-xs flex flex-wrap sm:flex-nowrap items-center justify-between gap-1.5 sm:gap-2">
        <button
          onClick={() => {
            setCookingStage('receta');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className={`flex-1 min-w-[120px] py-2.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 ${
            cookingStage === 'receta'
              ? 'bg-amber-600 text-white shadow-xs'
              : 'text-stone-600 hover:bg-stone-100'
          }`}
        >
          <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-mono ${
            cookingStage === 'receta' ? 'bg-white/20 text-white' : 'bg-stone-200 text-stone-700'
          }`}>1</span>
          <span className="truncate">1. Elegir Receta</span>
        </button>

        <ChevronRight className="w-4 h-4 text-stone-300 shrink-0 hidden sm:block" />

        <button
          onClick={() => {
            setCookingStage('mise');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className={`flex-1 min-w-[120px] py-2.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 ${
            cookingStage === 'mise'
              ? 'bg-amber-600 text-white shadow-xs'
              : 'text-stone-600 hover:bg-stone-100'
          }`}
        >
          <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-mono ${
            cookingStage === 'mise' ? 'bg-white/20 text-white' : 'bg-stone-200 text-stone-700'
          }`}>2</span>
          <span className="truncate">2. Preparar (Fuego Apagado)</span>
          {allMiseChecked && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
        </button>

        <ChevronRight className="w-4 h-4 text-stone-300 shrink-0 hidden sm:block" />

        <button
          onClick={() => {
            setCookingStage('fuegos');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className={`flex-1 min-w-[120px] py-2.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 ${
            cookingStage === 'fuegos'
              ? 'bg-stone-900 text-white shadow-xs'
              : 'text-stone-600 hover:bg-stone-100'
          }`}
        >
          <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-mono ${
            cookingStage === 'fuegos' ? 'bg-white/20 text-white' : 'bg-stone-200 text-stone-700'
          }`}>3</span>
          <Flame className="w-3.5 h-3.5 text-orange-400" />
          <span className="truncate">3. En los Fuegos</span>
        </button>
      </div>

      {/* ========================================================= */}
      {/* ETAPA 1: SELECCIÓN Y DETALLE DE LA RECETA                 */}
      {/* ========================================================= */}
      {cookingStage === 'receta' && (
        <div className="space-y-6">
          {/* Tarjeta Unificada y Compacta de Nivel y Recomendación */}
          <div className="bg-white rounded-2xl border border-stone-200 shadow-xs p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-amber-500 text-stone-950 flex items-center justify-center text-xl font-bold shrink-0 shadow-2xs">
                {currentLevelMeta.badge}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-sm text-stone-900">
                    {currentLevelMeta.title}
                  </span>
                  <span className="text-[10px] bg-amber-100 text-amber-900 font-bold px-2 py-0.5 rounded-full font-mono">
                    {userProfile.xp} / {currentLevelMeta.targetXp} XP
                  </span>
                </div>
                <div className="text-xs text-stone-500 mt-0.5 flex items-center gap-1.5">
                  <span>💡 Recomendado:</span>
                  <strong className="text-stone-800">
                    {mentorRecommendation ? mentorRecommendation.headline : (recommendedRecipeObj ? recommendedRecipeObj.title.split('(')[0] : 'Arroz Blanco')}
                  </strong>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start md:self-center shrink-0">
              <button
                onClick={() => setShowRoadmapModal(true)}
                className="px-3 py-2 rounded-xl text-stone-600 hover:text-stone-900 hover:bg-stone-100 text-xs font-semibold transition"
              >
                <span>🗺️ Ver Ruta</span>
              </button>

              {recommendedRecipeObj && (
                <button
                  onClick={() => {
                    setSelectedRecipe(recommendedRecipeObj);
                    setCurrentStepIndex(0);
                    setMiseEnPlaceChecked({});
                    window.scrollTo({ top: 380, behavior: 'smooth' });
                  }}
                  className="px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition shadow-xs cursor-pointer"
                >
                  <span>Cocinar Ahora</span>
                  <ChevronRight className="w-4 h-4 text-amber-400" />
                </button>
              )}
            </div>
          </div>

          {/* Top Banner & Recipe Selector */}
          <div className="bg-gradient-to-r from-amber-600/10 via-orange-500/5 to-transparent p-6 rounded-2xl border border-stone-200">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-100 text-amber-900 text-xs font-semibold mb-2">
                  <ChefHat className="w-3.5 h-3.5 text-amber-700" />
                  <span>Etapa 1: Explorar y Elegir qué Cocinar</span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-stone-900 font-serif">
                  Catálogo de Recetas Evolutivas
                </h2>
                <p className="text-stone-600 text-sm mt-1 max-w-2xl">
                  Selecciona una receta según tu nivel o estilo de cocina, o dile al Chef qué 3 ingredientes tienes para inventar un plato adaptado a ti.
                </p>
              </div>

              <button
                onClick={() => setShowGeneratorModal(true)}
                className="px-4 py-3 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-sm font-semibold flex items-center gap-2 shadow-md transition-all shrink-0 cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>Tengo estos 3 ingredientes...</span>
              </button>
            </div>

            {/* Filtro por Nivel Culinario */}
            <div className="mt-5 pt-4 border-t border-stone-200/80">
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider flex items-center gap-1.5">
                  <span>🎓 Filtrar por Nivel de Complejidad:</span>
                </span>
                <span className="text-[11px] text-stone-500">
                  Tu nivel actual: <strong className="text-amber-800">Nivel {userProfile.level}</strong>
                </span>
              </div>

              <div className="flex flex-wrap gap-1.5 sm:gap-2">
                <button
                  onClick={() => setLevelFilter('all')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                    levelFilter === 'all'
                      ? 'bg-stone-900 text-white shadow-xs'
                      : 'bg-white text-stone-700 hover:bg-stone-100 border border-stone-200'
                  }`}
                >
                  Todas las Recetas ({recipesList.length})
                </button>
                <button
                  onClick={() => setLevelFilter('my_level')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    levelFilter === 'my_level'
                      ? 'bg-amber-600 text-white shadow-xs ring-2 ring-amber-500/40'
                      : 'bg-amber-100/70 text-amber-950 hover:bg-amber-100 border border-amber-300'
                  }`}
                >
                  <span>{currentLevelMeta.badge}</span>
                  <span>Aptas para Mi Nivel (Hasta Nivel {userProfile.level})</span>
                </button>
                <button
                  onClick={() => setLevelFilter(1)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                    levelFilter === 1
                      ? 'bg-stone-800 text-white'
                      : 'bg-white text-stone-600 hover:bg-stone-100 border border-stone-200'
                  }`}
                >
                  🌱 Nivel 1 (Cero Absoluto)
                </button>
                <button
                  onClick={() => setLevelFilter(2)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                    levelFilter === 2
                      ? 'bg-stone-800 text-white'
                      : 'bg-white text-stone-600 hover:bg-stone-100 border border-stone-200'
                  }`}
                >
                  🔥 Nivel 2 (Aprendiz)
                </button>
                <button
                  onClick={() => setLevelFilter(3)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                    levelFilter === 3
                      ? 'bg-stone-800 text-white'
                      : 'bg-white text-stone-600 hover:bg-stone-100 border border-stone-200'
                  }`}
                >
                  🍳 Nivel 3 (Casero Seguro)
                </button>
                <button
                  onClick={() => setLevelFilter(4)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                    levelFilter === 4
                      ? 'bg-stone-800 text-white'
                      : 'bg-white text-stone-600 hover:bg-stone-100 border border-stone-200'
                  }`}
                >
                  ✨ Nivel 4 (Avanzado)
                </button>
              </div>
            </div>

            {/* World Cuisines & BBB Filter Bar */}
            <div className="mt-4 pt-3 border-t border-stone-200/80">
              <div className="flex items-center justify-between gap-2 mb-2.5">
                <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider flex items-center gap-1.5">
                  <span>🌍 Gastronomías del Mundo & Recetas BBB:</span>
                </span>
                <span className="text-[11px] text-amber-800 font-semibold bg-amber-100/80 px-2 py-0.5 rounded-full">
                  {filteredRecipes.length} receta{filteredRecipes.length !== 1 ? 's' : ''} encontrada{filteredRecipes.length !== 1 ? 's' : ''}
                </span>
              </div>

              <div className="flex flex-wrap gap-2">
                {WORLD_CUISINES.map((c) => {
                  const isSelected = selectedCuisine === c.id;
                  return (
                    <button
                      key={c.id}
                      onClick={() => {
                        setSelectedCuisine(c.id);
                        const matching = recipesList.filter((r) => {
                          if (c.id === 'todas') return true;
                          if (c.id === 'economica_bbb') return r.isBudgetFriendly || r.cuisine === 'economica_bbb';
                          return r.cuisine === c.id;
                        });
                        if (matching.length > 0 && !matching.some((m) => m.id === selectedRecipe.id)) {
                          setSelectedRecipe(matching[0]);
                          setCurrentStepIndex(0);
                          setMiseEnPlaceChecked({});
                        }
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                        isSelected
                          ? 'bg-amber-600 text-white shadow-sm ring-2 ring-amber-500/40'
                          : 'bg-white text-stone-700 hover:bg-stone-100 border border-stone-200'
                      }`}
                    >
                      <span className="text-sm">{c.flag}</span>
                      <span>{c.name}</span>
                    </button>
                  );
                })}
              </div>

              {/* Active Cultural Wisdom Card */}
              {activeCuisineMeta && activeCuisineMeta.id !== 'todas' && (
                <div className="mt-3.5 p-3.5 rounded-xl bg-amber-500/10 border border-amber-300/80 text-stone-900 shadow-xs">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 border-b border-amber-200/80 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{activeCuisineMeta.flag}</span>
                      <div>
                        <h4 className="font-extrabold text-xs sm:text-sm text-amber-950 font-serif">
                          {activeCuisineMeta.name} — {activeCuisineMeta.tagline}
                        </h4>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-200 text-amber-950 self-start sm:self-auto uppercase">
                      Reglas de Oro Culinarias
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mt-2.5 text-xs">
                    <div className="bg-white/90 p-2.5 rounded-lg border border-amber-200/60 shadow-2xs">
                      <span className="font-bold text-amber-950 block mb-0.5 flex items-center gap-1">
                        <span>🌟</span> Regla de Oro:
                      </span>
                      <p className="text-stone-700 leading-snug text-[11px]">{activeCuisineMeta.goldenRule}</p>
                    </div>
                    <div className="bg-white/90 p-2.5 rounded-lg border border-amber-200/60 shadow-2xs">
                      <span className="font-bold text-amber-950 block mb-0.5 flex items-center gap-1">
                        <span>🧅</span> Base Aromática:
                      </span>
                      <p className="text-stone-700 leading-snug text-[11px]">{activeCuisineMeta.baseAromatics}</p>
                    </div>
                    <div className="bg-white/90 p-2.5 rounded-lg border border-amber-200/60 shadow-2xs">
                      <span className="font-bold text-amber-950 block mb-0.5 flex items-center gap-1">
                        <span>💰</span> Ahorro BBB (Despensa):
                      </span>
                      <p className="text-stone-700 leading-snug text-[11px]">{activeCuisineMeta.budgetSecret}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Recipe Pills Selection */}
            <div className="mt-4 flex flex-wrap gap-2">
              {filteredRecipes.length > 0 ? (
                filteredRecipes.map((r) => {
                  const reqLvl = r.requiredLevel || 1;
                  const isLocked = reqLvl > userProfile.level;
                  const isSelected = selectedRecipe.id === r.id;

                  return (
                    <button
                      key={r.id}
                      onClick={() => {
                        setSelectedRecipe(r);
                        setCurrentStepIndex(0);
                        setMiseEnPlaceChecked({});
                      }}
                      className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                        isSelected
                          ? 'bg-stone-900 text-white shadow-md ring-2 ring-amber-500/40'
                          : 'bg-white text-stone-700 hover:bg-stone-100 border border-stone-200'
                      }`}
                    >
                      <span>{r.countryFlag || '🍳'}</span>
                      <span className="truncate max-w-[200px] sm:max-w-none">{r.title.split('(')[0]}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-mono font-bold ${
                        isSelected
                          ? 'bg-white/20 text-amber-300'
                          : isLocked
                          ? 'bg-stone-200 text-stone-700'
                          : 'bg-amber-100 text-amber-900'
                      }`}>
                        {isLocked ? `🔒 N${reqLvl}` : `N${reqLvl}`}
                      </span>
                      <span className="text-[11px] opacity-75">({r.totalTimeMinutes}m)</span>
                    </button>
                  );
                })
              ) : (
                <div className="p-3 bg-white/80 rounded-xl border border-dashed border-stone-300 text-xs text-stone-600 flex items-center justify-between w-full">
                  <span>No hay recetas que coincidan con estos filtros. ¡Prueba a cambiar el nivel o crea una con tus ingredientes!</span>
                  <button
                    onClick={() => {
                      setGeneratorCuisine(selectedCuisine);
                      setShowGeneratorModal(true);
                    }}
                    className="px-3 py-1 bg-amber-600 text-white font-bold rounded-lg text-xs hover:bg-amber-700 cursor-pointer"
                  >
                    Crear con IA
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Recipe Header Card with Safety Alerts & Details */}
          <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-sm">
            <div className="relative h-48 sm:h-64 w-full bg-stone-100">
              <img
                src={selectedRecipe.imageUrl || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80'}
                alt={selectedRecipe.title}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-stone-900/85 via-stone-900/35 to-transparent flex items-end p-5">
                <div>
                  <div className="flex flex-wrap items-center gap-2 mb-1.5">
                    <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${
                      (selectedRecipe.requiredLevel || 1) <= userProfile.level
                        ? 'bg-emerald-500 text-white'
                        : 'bg-amber-400 text-stone-900'
                    }`}>
                      {(selectedRecipe.requiredLevel || 1) <= userProfile.level
                        ? `🌱 Nivel ${selectedRecipe.requiredLevel || 1} (Desbloqueado)`
                        : `🔒 Nivel ${selectedRecipe.requiredLevel || 1} (Desafío)`}
                    </span>
                    <span className="text-xs bg-amber-500 text-stone-900 px-2.5 py-0.5 rounded-full font-bold">
                      {selectedRecipe.difficulty}
                    </span>
                    <span className="text-xs bg-stone-800/80 text-white px-2.5 py-0.5 rounded-full font-semibold">
                      {selectedRecipe.steps.length} pasos sencillos
                    </span>
                  </div>
                  <h3 className="text-2xl sm:text-3xl font-extrabold text-white">
                    {selectedRecipe.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-stone-200 max-w-xl mt-1">
                    {selectedRecipe.description}
                  </p>
                </div>
              </div>
            </div>

            {/* Meta Pedagógica de la Receta */}
            {selectedRecipe.learningGoal && (
              <div className="bg-amber-100/70 border-b border-amber-200/90 px-5 py-2.5 flex items-center gap-2 text-xs text-amber-950">
                <span className="text-base shrink-0">🎯</span>
                <div>
                  <strong className="font-bold text-amber-900">Lo que aprenderás con este plato:</strong>{' '}
                  <span className="font-medium text-stone-800">{selectedRecipe.learningGoal}</span>
                </div>
              </div>
            )}

            {/* Aviso de Desafío si la receta supera el nivel del usuario */}
            {(selectedRecipe.requiredLevel || 1) > userProfile.level && (
              <div className="bg-orange-50 border-b border-orange-200 px-5 py-2 text-xs text-orange-950 flex items-center gap-2">
                <span className="text-sm shrink-0">⚡</span>
                <p>
                  <strong>Desafío de Nivel Superior:</strong> Estás en Nivel {userProfile.level} y esta receta es de Nivel {selectedRecipe.requiredLevel}. ¡No te preocupes! El Chef Mentor te guiará paso a paso con las alertas de fuego activadas.
                </p>
              </div>
            )}

            {/* Cultural & Budget Badges & Portion Scaler */}
            <div className="bg-stone-50 border-b border-stone-200 px-5 py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-stone-900 text-white font-bold text-xs shadow-2xs">
                  <span>{selectedRecipe.countryFlag || '🍳'}</span>
                  <span>{selectedRecipe.cuisineName || 'Cocina Internacional'}</span>
                </span>

                {selectedRecipe.isBudgetFriendly && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-950 font-bold text-xs border border-emerald-300">
                    <span>💰</span>
                    <span>{selectedRecipe.estimatedCostLabel || 'Económica BBB'}</span>
                  </span>
                )}

                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-100 text-amber-900 font-semibold text-xs">
                  <Clock className="w-3 h-3 text-amber-700" />
                  <span>{selectedRecipe.totalTimeMinutes} min totales</span>
                </span>
              </div>

              {/* Portion Scaler Control (1, 2, 4 porciones) */}
              <div className="flex items-center gap-3">
                <div className="flex items-center bg-white border border-stone-300 rounded-xl p-0.5 shadow-2xs">
                  <span className="text-[11px] text-stone-500 font-bold px-2 flex items-center gap-1">
                    <Users className="w-3.5 h-3.5 text-stone-400" />
                    <span>Porciones:</span>
                  </span>
                  {[1, 2, 4].map((serv) => (
                    <button
                      key={serv}
                      onClick={() => setTargetServings(serv)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                        targetServings === serv
                          ? 'bg-amber-500 text-stone-950 shadow-xs'
                          : 'text-stone-600 hover:bg-stone-100'
                      }`}
                    >
                      {serv}
                    </button>
                  ))}
                </div>

                {/* Add to Smart Shopping List */}
                <button
                  onClick={() => {
                    try {
                      const currentList = JSON.parse(localStorage.getItem('chef_cero_shopping_list') || '[]');
                      const newItems = selectedRecipe.miseEnPlace.map((item, i) => ({
                        id: 'recipe-' + Date.now() + '-' + i,
                        name: scaleIngredientText(item, selectedRecipe.servings || 2, targetServings),
                        category: (item.toLowerCase().includes('cebolla') || item.toLowerCase().includes('ajo') || item.toLowerCase().includes('tomate') || item.toLowerCase().includes('papa') || item.toLowerCase().includes('zanahoria'))
                          ? 'Verdulería & Frutas'
                          : (item.toLowerCase().includes('pollo') || item.toLowerCase().includes('huevo') || item.toLowerCase().includes('carne'))
                          ? 'Carnicería & Huevos'
                          : (item.toLowerCase().includes('fideo') || item.toLowerCase().includes('arroz') || item.toLowerCase().includes('harina'))
                          ? 'Almacén & Granos'
                          : (item.toLowerCase().includes('queso') || item.toLowerCase().includes('mantequilla') || item.toLowerCase().includes('leche'))
                          ? 'Lácteos & Quesos'
                          : 'Especias & Aceites',
                        checked: false,
                      }));
                      localStorage.setItem('chef_cero_shopping_list', JSON.stringify([...newItems, ...currentList]));
                      setAddedToShoppingNotice(`¡${selectedRecipe.title} agregada a la lista de compras!`);
                      setTimeout(() => setAddedToShoppingNotice(null), 3000);
                      setIsShoppingModalOpen(true);
                    } catch {}
                  }}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs transition cursor-pointer"
                  title="Enviar los ingredientes de esta receta a la lista de compras del súper"
                >
                  <ShoppingCart className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Comprar al Súper</span>
                </button>
              </div>
            </div>

            {addedToShoppingNotice && (
              <div className="bg-emerald-100 border-b border-emerald-300 px-5 py-2 text-xs font-bold text-emerald-950 flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-700" />
                <span>{addedToShoppingNotice}</span>
              </div>
            )}

            {/* Cultural Secret Card */}
            {selectedRecipe.culturalSecret && (
              <div className="bg-gradient-to-r from-amber-500/15 via-amber-500/5 to-transparent p-4 border-b border-amber-200/90 flex items-start gap-3">
                <span className="text-xl shrink-0 mt-0.5">✨</span>
                <div>
                  <h4 className="text-xs font-bold text-amber-950 uppercase tracking-wider">
                    Secreto Cultural de Oro ({selectedRecipe.cuisineName || 'Chef Cero'}):
                  </h4>
                  <p className="text-xs text-amber-900 mt-0.5 leading-relaxed font-medium">
                    {selectedRecipe.culturalSecret}
                  </p>
                </div>
              </div>
            )}

            {/* Pantry Substitutes (Ahorro Inteligente BBB) */}
            {selectedRecipe.pantrySubstitutes && selectedRecipe.pantrySubstitutes.length > 0 && (
              <div className="bg-emerald-50/90 border-b border-emerald-200 p-4">
                <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-950 uppercase tracking-wider mb-2">
                  <span className="text-base">💡</span>
                  <span>Ahorro Inteligente BBB: Sustitutos de Despensa</span>
                </div>
                <div className="space-y-1.5">
                  {selectedRecipe.pantrySubstitutes.map((sub, idx) => (
                    <div key={idx} className="text-xs text-emerald-950 flex flex-col sm:flex-row sm:items-baseline gap-1">
                      <span className="font-semibold text-stone-600 line-through">{sub.original}</span>
                      <span className="hidden sm:inline text-stone-400">→</span>
                      <span className="font-bold text-emerald-800">Usa: {sub.substitute}</span>
                      <span className="text-emerald-700/90 text-[11px]">({sub.reason})</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Safety Warnings */}
            {selectedRecipe.safetyAlerts.length > 0 && (
              <div className="bg-amber-50 p-4 border-b border-amber-200 flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-amber-900 uppercase tracking-wider">
                    Reglas de Oro de Seguridad para este plato:
                  </h4>
                  <ul className="text-xs text-amber-900/90 list-disc list-inside mt-1 space-y-0.5 font-medium">
                    {selectedRecipe.safetyAlerts.map((alert, i) => (
                      <li key={i}>{alert}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {/* Barra de Avance a Etapa 2 (Mise en Place) */}
            <div className="p-4 sm:p-5 bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-transparent flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider block">
                  Paso siguiente del flujo
                </span>
                <h4 className="font-extrabold text-stone-900 text-sm sm:text-base">
                  ¿Prepararás {selectedRecipe.title}?
                </h4>
                <p className="text-xs text-stone-600 mt-0.5">
                  Primero organizaremos y mediremos los {selectedRecipe.miseEnPlace.length} ingredientes con la hornilla apagada.
                </p>
              </div>

              <div className="flex items-center gap-2.5 w-full sm:w-auto">
                <button
                  onClick={() => {
                    setCookingStage('fuegos');
                    setCurrentStepIndex(0);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="px-3.5 py-2.5 bg-white hover:bg-stone-100 text-stone-700 font-semibold border border-stone-300 rounded-xl text-xs transition"
                >
                  Saltar a cocinar
                </button>

                <button
                  onClick={() => {
                    setCookingStage('mise');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="flex-1 sm:flex-none px-5 py-3 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md transition"
                >
                  <span>Preparar Ingredientes (Fase 2)</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* ETAPA 2: MISE EN PLACE (FUEGO APAGADO)                    */}
      {/* ========================================================= */}
      {cookingStage === 'mise' && (
        <div className="space-y-6">
          {/* Phase 1: Mise en Place Checklist */}
          <div className="bg-white rounded-2xl border-2 border-amber-300 p-5 sm:p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-100 pb-3">
              <div>
                <span className="text-[11px] font-extrabold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full uppercase tracking-wider block w-fit mb-1">
                  Etapa 2: Preparación con Fuego Apagado
                </span>
                <h3 className="font-extrabold text-xl text-stone-900">
                  Mise en Place para {selectedRecipe.title}
                </h3>
              </div>
              <span
                className={`text-xs px-3 py-1.5 rounded-xl font-bold self-start sm:self-auto flex items-center gap-1.5 ${
                  allMiseChecked
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                    : 'bg-amber-100 text-amber-900 border border-amber-300'
                }`}
              >
                {allMiseChecked ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>¡Todo picado y medido!</span>
                  </>
                ) : (
                  <span>Prepara todo antes de calentar la sartén</span>
                )}
              </span>
            </div>

            <p className="text-xs text-stone-600 leading-relaxed">
              El 90% de los platos que se queman o pegan ocurren porque el cocinero novato empieza a picar ajo o medir agua <em>mientras</em> el aceite ya está humeando. Pon cada ingrediente en su platito o taza medido antes de encender la estufa:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              {selectedRecipe.miseEnPlace.map((item, idx) => {
                const isChecked = !!miseEnPlaceChecked[idx];
                const scaledItem = scaleIngredientText(item, selectedRecipe.servings || 2, targetServings);
                return (
                  <div
                    key={idx}
                    onClick={() => toggleMiseItem(idx)}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-start gap-3 ${
                      isChecked
                        ? 'bg-emerald-50/80 border-emerald-300 text-emerald-950'
                        : 'bg-stone-50 border-stone-200 text-stone-800 hover:bg-stone-100'
                    }`}
                  >
                    {isChecked ? (
                      <CheckSquare className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                    ) : (
                      <Square className="w-5 h-5 text-stone-400 shrink-0 mt-0.5" />
                    )}
                    <span className={`text-xs sm:text-sm font-medium leading-relaxed ${isChecked ? 'line-through text-stone-500' : ''}`}>
                      {scaledItem}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Quick check buttons */}
            <div className="flex items-center justify-between pt-2 border-t border-stone-100 text-xs text-stone-500">
              <button
                onClick={() => {
                  const allDone: Record<string, boolean> = {};
                  selectedRecipe.miseEnPlace.forEach((_, idx) => (allDone[idx] = true));
                  setMiseEnPlaceChecked(allDone);
                }}
                className="text-amber-800 hover:text-amber-950 font-bold underline"
              >
                Marcar todos como listos
              </button>

              <button
                onClick={() => setMiseEnPlaceChecked({})}
                className="text-stone-500 hover:text-stone-700 underline"
              >
                Desmarcar todos
              </button>
            </div>

            {/* Stage 2 Action Bar */}
            <div className="pt-4 border-t border-stone-200 flex flex-col sm:flex-row items-center justify-between gap-3">
              <button
                onClick={() => {
                  setCookingStage('receta');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="px-4 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-700 font-semibold rounded-xl text-xs flex items-center gap-1.5 transition w-full sm:w-auto justify-center"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Volver a Elegir Receta</span>
              </button>

              <button
                onClick={() => {
                  setCookingStage('fuegos');
                  setCurrentStepIndex(0);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="px-6 py-3 bg-stone-900 hover:bg-stone-800 text-white font-bold rounded-xl text-xs sm:text-sm flex items-center gap-2 shadow-md transition w-full sm:w-auto justify-center"
              >
                <Flame className="w-4 h-4 text-orange-400" />
                <span>¡Todo Listo! Encender Hornilla e Iniciar Cocción →</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* ETAPA 3: EN LOS FUEGOS (COCCIÓN PASO A PASO)               */}
      {/* ========================================================= */}
      {cookingStage === 'fuegos' && (
        <div className="space-y-6">

      {/* Aviso de Comprobación de Notificaciones al Iniciar Temporizador */}
      {timerNotice && (
        <div
          className={`p-4 rounded-2xl border shadow-sm flex items-start justify-between gap-3 animate-fade-in transition-all ${
            timerNotice.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
              : 'bg-amber-50 border-amber-300 text-amber-950'
          }`}
        >
          <div className="flex items-start gap-3">
            <div
              className={`p-2 rounded-xl shrink-0 ${
                timerNotice.type === 'success'
                  ? 'bg-emerald-200 text-emerald-800'
                  : 'bg-amber-200 text-amber-800'
              }`}
            >
              {timerNotice.type === 'success' ? (
                <BellRing className="w-5 h-5 animate-pulse" />
              ) : (
                <BellOff className="w-5 h-5" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-xs font-bold uppercase tracking-wider">
                  {timerNotice.title}
                </h4>
                {timerNotice.type === 'success' ? (
                  <span className="text-[10px] bg-emerald-200/80 text-emerald-900 px-2 py-0.5 rounded-full font-bold">
                    Segundo plano garantizado
                  </span>
                ) : (
                  <span className="text-[10px] bg-amber-200/80 text-amber-900 px-2 py-0.5 rounded-full font-bold">
                    Atención recomendada
                  </span>
                )}
              </div>
              <p className="text-xs mt-1 leading-relaxed text-stone-700">
                {timerNotice.message}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isRunningInIframe() && pushStatus !== 'granted' && (
              <a
                href={typeof window !== 'undefined' ? window.location.href : '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="px-2.5 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-xs font-semibold border border-stone-300 transition inline-flex items-center gap-1"
                title="Abrir en pestaña nueva para habilitar notificaciones nativas del sistema"
              >
                Abrir en pestaña nueva ↗
              </a>
            )}
            {timerNotice.type !== 'success' && pushStatus !== 'granted' && (
              <button
                onClick={handleEnablePushNotifications}
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold shadow-xs transition"
              >
                Activar Ahora
              </button>
            )}
            <button
              onClick={() => setTimerNotice(null)}
              className="p-1 hover:bg-stone-200/60 rounded-lg text-stone-500 hover:text-stone-800 text-xs"
              title="Cerrar aviso"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Active Floating Timers Dock (if any) */}
      {activeTimers.length > 0 && (
        <div className="bg-stone-900 text-white p-4 rounded-2xl shadow-xl flex flex-wrap items-center justify-between gap-4 border border-stone-700">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-400 animate-spin" />
            <span className="font-bold text-sm">Temporizadores Activos:</span>
          </div>

          <div className="flex flex-wrap gap-3">
            {activeTimers.map((t) => (
              <div
                key={t.id}
                className={`px-4 py-2 rounded-xl flex items-center gap-3 border ${
                  t.remainingSeconds === 0
                    ? 'bg-red-600 border-red-500 animate-pulse'
                    : 'bg-stone-800 border-stone-700'
                }`}
              >
                <div>
                  <div className="text-[11px] text-stone-300 font-medium">{t.label}</div>
                  <div className="text-lg font-mono font-bold">
                    {formatSeconds(t.remainingSeconds)}
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => toggleTimerPause(t.id)}
                    className="p-1.5 hover:bg-white/20 rounded-lg text-white"
                  >
                    {t.isRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => resetTimer(t.id)}
                    className="p-1.5 hover:bg-white/20 rounded-lg text-white"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => removeTimer(t.id)}
                    className="p-1.5 hover:bg-white/20 rounded-lg text-stone-400 hover:text-white text-xs"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recipe Header Card with Safety Alerts */}
      <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-sm">
        <div className="relative h-44 sm:h-56 w-full bg-stone-100">
          <img
            src={selectedRecipe.imageUrl || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80'}
            alt={selectedRecipe.title}
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-stone-900/80 via-stone-900/30 to-transparent flex items-end p-5">
            <div>
              <span className="text-xs bg-amber-500 text-stone-900 px-2.5 py-0.5 rounded-full font-bold">
                {selectedRecipe.difficulty}
              </span>
              <h3 className="text-xl sm:text-2xl font-bold text-white mt-1">
                {selectedRecipe.title}
              </h3>
              <p className="text-xs sm:text-sm text-stone-200 max-w-xl">
                {selectedRecipe.description}
              </p>
            </div>
          </div>
        </div>

        {/* Cultural & Budget Badges */}
        <div className="bg-stone-50 border-b border-stone-200 px-5 py-2.5 flex flex-wrap items-center justify-between gap-2.5 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-stone-900 text-white font-bold text-xs shadow-2xs">
              <span>{selectedRecipe.countryFlag || '🍳'}</span>
              <span>{selectedRecipe.cuisineName || 'Cocina Internacional'}</span>
            </span>

            {selectedRecipe.isBudgetFriendly && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-950 font-bold text-xs border border-emerald-300">
                <span>💰</span>
                <span>{selectedRecipe.estimatedCostLabel || 'Económica BBB'}</span>
              </span>
            )}

            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-100 text-amber-900 font-semibold text-xs">
              <Clock className="w-3 h-3 text-amber-700" />
              <span>{selectedRecipe.totalTimeMinutes} min totales</span>
            </span>
          </div>

          <span className="text-[11px] text-stone-500 font-medium">
            Rinde: {selectedRecipe.servings} porción{selectedRecipe.servings > 1 ? 'es' : ''}
          </span>
        </div>

        {/* Cultural Secret Card */}
        {selectedRecipe.culturalSecret && (
          <div className="bg-gradient-to-r from-amber-500/15 via-amber-500/5 to-transparent p-4 border-b border-amber-200/90 flex items-start gap-3">
            <span className="text-xl shrink-0 mt-0.5">✨</span>
            <div>
              <h4 className="text-xs font-bold text-amber-950 uppercase tracking-wider">
                Secreto Cultural de Oro ({selectedRecipe.cuisineName || 'Chef Cero'}):
              </h4>
              <p className="text-xs text-amber-900 mt-0.5 leading-relaxed font-medium">
                {selectedRecipe.culturalSecret}
              </p>
            </div>
          </div>
        )}

        {/* Pantry Substitutes (Ahorro Inteligente BBB) */}
        {selectedRecipe.pantrySubstitutes && selectedRecipe.pantrySubstitutes.length > 0 && (
          <div className="bg-emerald-50/90 border-b border-emerald-200 p-4">
            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-950 uppercase tracking-wider mb-2">
              <span className="text-base">💡</span>
              <span>Ahorro Inteligente BBB: Sustitutos de Despensa (No compres cosas caras)</span>
            </div>
            <div className="space-y-1.5">
              {selectedRecipe.pantrySubstitutes.map((sub, idx) => (
                <div key={idx} className="text-xs text-emerald-950 flex flex-col sm:flex-row sm:items-baseline gap-1">
                  <span className="font-semibold text-stone-600 line-through">{sub.original}</span>
                  <span className="hidden sm:inline text-stone-400">→</span>
                  <span className="font-bold text-emerald-800">Usa: {sub.substitute}</span>
                  <span className="text-emerald-700/90 text-[11px]">({sub.reason})</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Safety Warnings for beginners */}
        {selectedRecipe.safetyAlerts.length > 0 && (
          <div className="bg-amber-50 p-4 border-b border-amber-200 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-bold text-amber-900 uppercase tracking-wider">
                Reglas de Oro de Seguridad para este plato:
              </h4>
              <ul className="text-xs text-amber-900/90 list-disc list-inside mt-1 space-y-0.5 font-medium">
                {selectedRecipe.safetyAlerts.map((alert, i) => (
                  <li key={i}>{alert}</li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* Visual Guide to Heat Levels */}
      <div className="bg-white rounded-2xl border border-stone-200 p-5 shadow-sm">
        <h3 className="text-sm font-bold text-stone-900 uppercase tracking-wider mb-3 flex items-center gap-2">
          <Flame className="w-4 h-4 text-orange-500" />
          <span>Guía Visual de Intensidades de Fuego (Llama de la hornalla)</span>
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="p-3.5 rounded-xl border border-blue-200 bg-blue-50/60">
            <div className="flex items-center gap-2 text-xs font-bold text-blue-900">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
              <span>Fuego Bajo (Llama Mínima)</span>
            </div>
            <p className="text-[11px] text-blue-950 mt-1 leading-relaxed">
              La corona de fuego azul es diminuta y apenas roza el fondo de la sartén. Te da tiempo de reaccionar. <strong>Ideal para:</strong> huevos revueltos, dorar ajo sin quemarlo, arroces tapados.
            </p>
          </div>

          <div className="p-3.5 rounded-xl border border-amber-200 bg-amber-50/60">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-900">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
              <span>Fuego Medio (Controlado)</span>
            </div>
            <p className="text-[11px] text-amber-950 mt-1 leading-relaxed">
              La llama cubre alrededor del 50% de la base sin lamer los costados. <strong>Ideal para:</strong> sofreír cebollas hasta que queden transparentes, saltear pollo, cocinar verduras tiernas.
            </p>
          </div>

          <div className="p-3.5 rounded-xl border border-red-200 bg-red-50/60">
            <div className="flex items-center gap-2 text-xs font-bold text-red-900">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span>
              <span>Fuego Alto (¡Cuidado novatos!)</span>
            </div>
            <p className="text-[11px] text-red-950 mt-1 leading-relaxed">
              Llama viva que cubre todo el fondo. En 15 segundos puede carbonizar cualquier cosa. <strong>Solo para:</strong> hervir agua de fideos o caldos. Nunca para dorar ajo o mantequilla.
            </p>
          </div>
        </div>
      </div>

      {/* Phase 1: Mise en Place Checklist */}
      <div className="bg-white rounded-2xl border border-stone-200 p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-stone-100 pb-3">
          <div>
            <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider block">
              Paso Preliminar Obligatorio
            </span>
            <h3 className="font-bold text-base text-stone-900">
              Fase 1: Checklist "Mise en Place" (Fuego Apagado)
            </h3>
          </div>
          <span
            className={`text-xs px-3 py-1 rounded-full font-bold ${
              allMiseChecked
                ? 'bg-emerald-100 text-emerald-800'
                : 'bg-amber-100 text-amber-900'
            }`}
          >
            {allMiseChecked ? '¡Listo para encender el fuego!' : 'Prepara antes de cocinar'}
          </span>
        </div>

        <p className="text-xs text-stone-600 leading-relaxed">
          El 90% de la comida que se quema ocurre porque el cocinero novato empieza a picar o medir cosas <em>mientras</em> la sartén ya está caliente. Marca cada casilla cuando tengas el ingrediente medido en su platito:
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {selectedRecipe.miseEnPlace.map((item, idx) => {
            const isChecked = !!miseEnPlaceChecked[idx];
            return (
              <div
                key={idx}
                onClick={() => toggleMiseItem(idx)}
                className={`p-3 rounded-xl border transition-all cursor-pointer flex items-start gap-3 ${
                  isChecked
                    ? 'bg-emerald-50/80 border-emerald-300 text-emerald-950'
                    : 'bg-stone-50 border-stone-200 text-stone-800 hover:bg-stone-100'
                }`}
              >
                {isChecked ? (
                  <CheckSquare className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <Square className="w-5 h-5 text-stone-400 shrink-0 mt-0.5" />
                )}
                <span className={`text-xs font-medium leading-relaxed ${isChecked ? 'line-through text-stone-500' : ''}`}>
                  {item}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Web Push & Background Alerts - Barra compacta respetuosa */}
      <div className={`px-4 py-3 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
        pushStatus === 'granted'
          ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
          : pushStatus === 'denied'
          ? 'bg-amber-50/70 border-amber-200 text-stone-800'
          : 'bg-stone-50 border-stone-200 text-stone-800'
      }`}>
        <div className="flex items-center gap-2.5">
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
            pushStatus === 'granted'
              ? 'bg-emerald-600 text-white'
              : 'bg-amber-500 text-stone-950'
          }`}>
            {pushStatus === 'granted' ? (
              <BellRing className="w-4 h-4" />
            ) : pushStatus === 'denied' ? (
              <BellOff className="w-4 h-4 text-stone-900" />
            ) : (
              <Bell className="w-4 h-4 text-stone-950" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold">
                {pushStatus === 'granted'
                  ? 'Alertas en segundo plano activas'
                  : 'Avisos fuera de la pestaña'}
              </span>
              <span className={`text-[10px] px-2 py-0.2 rounded-full font-bold ${
                pushStatus === 'granted'
                  ? 'bg-emerald-200 text-emerald-900'
                  : 'bg-amber-200 text-amber-950'
              }`}>
                {pushStatus === 'granted' ? 'Web Push Conectado' : 'Recomendado'}
              </span>
            </div>
            <p className="text-[11px] text-stone-600">
              {pushStatus === 'granted'
                ? 'Sonará la campana y verás notificación en tu pantalla al terminar cualquier temporizador.'
                : 'Recibe alertas si cambias de app o bloqueas el móvil para no quemar la comida.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
          {pushStatus !== 'granted' && pushStatus !== 'unsupported' && (
            <button
              onClick={handleEnablePushNotifications}
              disabled={isSubscribingPush}
              className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-stone-950 font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-xs transition"
            >
              <Bell className="w-3.5 h-3.5" />
              <span>{isSubscribingPush ? 'Activando...' : 'Activar Alertas'}</span>
            </button>
          )}

          <button
            onClick={handleTestPushAlert}
            disabled={isSendingTest}
            className="px-3 py-1.5 bg-white hover:bg-stone-100 text-stone-700 font-semibold border border-stone-200 rounded-xl text-xs flex items-center gap-1 transition"
          >
            <Smartphone className="w-3 h-3 text-amber-600" />
            <span>{isSendingTest ? 'Enviando...' : 'Probar'}</span>
          </button>
        </div>
      </div>

      {/* Active Timers Dock / Monitor */}
      {activeTimers.length > 0 && (
        <div className="bg-stone-900 text-white rounded-2xl p-5 shadow-xl border border-stone-800 space-y-4">
          <div className="flex items-center justify-between border-b border-stone-800 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse"></div>
              <h3 className="font-extrabold text-sm sm:text-base text-amber-400 tracking-wide uppercase">
                Temporizadores Activos ({activeTimers.length})
              </h3>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-stone-400">
              <Clock className="w-3.5 h-3.5" />
              <span>Protegido con Web Push en segundo plano</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {activeTimers.map((timer) => {
              const progressPct = timer.totalSeconds > 0
                ? Math.min(100, Math.max(0, ((timer.totalSeconds - timer.remainingSeconds) / timer.totalSeconds) * 100))
                : 0;
              const isFinished = timer.remainingSeconds === 0;

              return (
                <div
                  key={timer.id}
                  className={`p-4 rounded-xl border transition-all ${
                    isFinished
                      ? 'bg-emerald-950/60 border-emerald-500/80 ring-2 ring-emerald-500/50'
                      : timer.isRunning
                      ? 'bg-stone-800/90 border-stone-700'
                      : 'bg-stone-800/40 border-stone-700/60 opacity-80'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="font-bold text-xs text-stone-200 truncate max-w-[200px]">
                      {timer.label}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                        isFinished
                          ? 'bg-emerald-500 text-stone-950 font-black animate-pulse'
                          : timer.isRunning
                          ? 'bg-amber-500/20 text-amber-300'
                          : 'bg-stone-700 text-stone-300'
                      }`}
                    >
                      {isFinished ? '¡Tiempo Cumplido!' : timer.isRunning ? 'En marcha' : 'Pausado'}
                    </span>
                  </div>

                  {/* Big Digital Display */}
                  <div className="flex items-baseline justify-between py-1">
                    <span className={`font-mono text-3xl font-extrabold tracking-tight ${
                      isFinished
                        ? 'text-emerald-400'
                        : timer.remainingSeconds <= 30
                        ? 'text-red-400 animate-pulse'
                        : 'text-amber-400'
                    }`}>
                      {formatSeconds(timer.remainingSeconds)}
                    </span>

                    <span className="text-[11px] text-stone-400">
                      Total: {formatSeconds(timer.totalSeconds)}
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full h-2 bg-stone-700/60 rounded-full overflow-hidden my-2.5">
                    <div
                      className={`h-full transition-all duration-500 ${
                        isFinished
                          ? 'bg-emerald-500'
                          : timer.remainingSeconds <= 30
                          ? 'bg-red-500'
                          : 'bg-amber-500'
                      }`}
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-1.5">
                      {!isFinished ? (
                        <button
                          onClick={() => toggleTimerPause(timer.id)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition ${
                            timer.isRunning
                              ? 'bg-stone-700 hover:bg-stone-600 text-stone-200'
                              : 'bg-amber-500 hover:bg-amber-400 text-stone-950'
                          }`}
                        >
                          {timer.isRunning ? (
                            <>
                              <Pause className="w-3 h-3" /> Pausar
                            </>
                          ) : (
                            <>
                              <Play className="w-3 h-3" /> Reanudar
                            </>
                          )}
                        </button>
                      ) : (
                        <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" /> ¡Completado!
                        </span>
                      )}

                      <button
                        onClick={() => resetTimer(timer.id)}
                        title="Reiniciar temporizador"
                        className="p-1.5 text-stone-400 hover:text-stone-200 hover:bg-stone-700/60 rounded-lg transition"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <button
                      onClick={() => removeTimer(timer.id)}
                      title="Eliminar temporizador"
                      className="p-1.5 text-red-400/80 hover:text-red-300 hover:bg-red-950/40 rounded-lg transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Phase 2: Guided Step-by-Step Cooking with Timers */}
      <div className={`bg-white rounded-2xl border-2 border-amber-300 p-5 sm:p-6 shadow-md space-y-5 transition-all ${
        isFullScreenCooking
          ? 'fixed inset-0 z-50 overflow-y-auto m-0 rounded-none border-none p-6 sm:p-10 bg-white max-w-none'
          : ''
      }`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-stone-100 pb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[11px] font-extrabold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full uppercase tracking-wider">
                Fase 2: Cocción en Vivo
              </span>
              <span className="text-xs text-stone-500 font-semibold">
                Paso {currentStep.stepNumber} de {selectedRecipe.steps.length}
              </span>
            </div>
            <h3 className="font-extrabold text-xl text-stone-900 leading-tight">
              {currentStep.title}
            </h3>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Fuego sugerido */}
            <span
              className={`px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider border flex items-center gap-1.5 ${
                currentStep.heatLevel === 'bajo'
                  ? 'bg-blue-50 border-blue-200 text-blue-900'
                  : currentStep.heatLevel === 'medio'
                  ? 'bg-amber-50 border-amber-200 text-amber-950'
                  : currentStep.heatLevel === 'alto'
                  ? 'bg-red-50 border-red-200 text-red-900'
                  : 'bg-stone-50 border-stone-200 text-stone-700'
              }`}
            >
              <Flame className="w-3.5 h-3.5 text-orange-500" />
              <span>Fuego: {currentStep.heatLevel}</span>
            </span>

            {/* Distintivo de Modo Sin Conexión si pierde internet */}
            {!isOnline && (
              <span
                className="px-2.5 py-1.5 rounded-xl text-xs font-bold bg-stone-900 text-stone-200 border border-stone-700 flex items-center gap-1.5"
                title="Modo sin conexión: la receta y los temporizadores siguen funcionando sin internet gracias a la caché"
              >
                <WifiOff className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden sm:inline">Offline (Caché Activa)</span>
                <span className="sm:hidden">Offline</span>
              </span>
            )}

            {/* Screen Wake Lock Toggle (Mantener Pantalla Activa) */}
            <button
              onClick={() => setWakeLockPreferred(!wakeLockPreferred)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition ${
                wakeLockActive
                  ? 'bg-amber-100 border-amber-300 text-amber-950 shadow-xs'
                  : 'bg-stone-100 border-stone-200 text-stone-600 hover:bg-stone-200'
              }`}
              title={wakeLockActive ? 'Pantalla despierta (no se apagará)' : 'Toca para mantener la pantalla siempre encendida mientras cocinas'}
            >
              <Sun className={`w-3.5 h-3.5 ${wakeLockActive ? 'text-amber-600 animate-spin-slow' : 'text-stone-400'}`} />
              <span className="hidden sm:inline">{wakeLockActive ? 'Pantalla Activa' : 'Mantener Pantalla'}</span>
              <span className="sm:hidden">{wakeLockActive ? 'Activa' : 'Pantalla'}</span>
            </button>

            {/* Modo Silencioso / Subtítulos en Pantalla Toggle */}
            <button
              onClick={toggleSilentMode}
              role="switch"
              aria-checked={isSilent}
              aria-label={isSilent ? 'Desactivar modo silencioso' : 'Activar modo silencioso con subtítulos'}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition ${
                isSilent
                  ? 'bg-stone-900 border-stone-700 text-amber-300 shadow-xs ring-1 ring-amber-400/40'
                  : 'bg-stone-100 border-stone-200 text-stone-600 hover:bg-stone-200'
              }`}
              title={
                isSilent
                  ? 'Modo Silencioso activo: las instrucciones y temporizadores se muestran como subtítulos sin ruido'
                  : 'Toca para activar Modo Silencioso y convertir la voz a subtítulos en pantalla'
              }
            >
              {isSilent ? (
                <>
                  <VolumeX className="w-3.5 h-3.5 text-amber-400" />
                  <span className="hidden sm:inline">Modo Silencioso</span>
                  <span className="sm:hidden">Silencio</span>
                </>
              ) : (
                <>
                  <Volume2 className="w-3.5 h-3.5 text-stone-500" />
                  <span className="hidden sm:inline">Voz ON</span>
                  <span className="sm:hidden">Voz</span>
                </>
              )}
            </button>

            {/* Botón Manos Libres por Voz Continuo (Estilo SideChef) */}
            <button
              onClick={() => {
                const nextState = !isHandsFreeActive;
                setIsHandsFreeActive(nextState);
                if (nextState) {
                  speakSpanishText('Modo manos libres activado. Puedes decir "siguiente", "atrás", "temporizador" o "emergencia".');
                } else {
                  speakSpanishText('Modo manos libres desactivado.');
                }
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition cursor-pointer ${
                isHandsFreeActive
                  ? 'bg-amber-500 border-amber-600 text-stone-950 shadow-md ring-2 ring-amber-300 animate-pulse'
                  : 'bg-stone-100 border-stone-200 text-stone-700 hover:bg-stone-200'
              }`}
              title={
                isHandsFreeActive
                  ? 'Micrófono activo: di "siguiente", "atrás" o "temporizador"'
                  : 'Activar control por voz manos libres para cocinar sin tocar la pantalla'
              }
            >
              {isHandsFreeActive ? (
                <>
                  <Mic className="w-3.5 h-3.5 text-stone-950" />
                  <span>Manos Libres ON</span>
                </>
              ) : (
                <>
                  <MicOff className="w-3.5 h-3.5 text-stone-500" />
                  <span className="hidden sm:inline">Manos Libres</span>
                  <span className="sm:hidden">Voz</span>
                </>
              )}
            </button>

            {/* Modo Pantalla Completa Inmersivo */}
            <button
              onClick={() => setIsFullScreenCooking(!isFullScreenCooking)}
              className="p-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-600 border border-stone-200 text-xs transition cursor-pointer"
              title={isFullScreenCooking ? 'Salir de pantalla completa' : 'Modo cocina inmersivo pantalla completa'}
            >
              {isFullScreenCooking ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            {/* Botón de Pánico / S.O.S. Cocina */}
            <button
              onClick={() => setIsEmergencyModalOpen(true)}
              className="px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-md hover:scale-105 active:scale-95 transition-all ring-2 ring-red-400/50"
              title="Rescate inmediato: humo, sal, comida pegada o quemada"
            >
              <ShieldAlert className="w-4 h-4 animate-bounce" />
              <span>S.O.S. Cocina</span>
            </button>
          </div>
        </div>

        {/* Barra de Consultas Rápidas (Guía de Fuegos e Ingredientes desplegables) */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button
            onClick={() => setShowHeatGuideInCooking((prev) => !prev)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition ${
              showHeatGuideInCooking
                ? 'bg-orange-50 border-orange-300 text-orange-950 shadow-2xs'
                : 'bg-stone-50 border-stone-200 text-stone-600 hover:bg-stone-100'
            }`}
          >
            <Flame className="w-3.5 h-3.5 text-orange-500" />
            <span>{showHeatGuideInCooking ? 'Ocultar Guía de Fuegos' : 'Ver Guía de Fuegos'}</span>
            {showHeatGuideInCooking ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          <button
            onClick={() => setShowIngredientsInCooking((prev) => !prev)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition ${
              showIngredientsInCooking
                ? 'bg-emerald-50 border-emerald-300 text-emerald-950 shadow-2xs'
                : 'bg-stone-50 border-stone-200 text-stone-600 hover:bg-stone-100'
            }`}
          >
            <CheckSquare className="w-3.5 h-3.5 text-emerald-600" />
            <span>{showIngredientsInCooking ? 'Ocultar Ingredientes' : 'Ver Ingredientes / Mise'}</span>
            {showIngredientsInCooking ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {isHandsFreeActive && (
            <div className="px-3 py-1 bg-amber-50 border border-amber-300 text-amber-950 rounded-xl text-xs flex items-center gap-1.5 animate-pulse">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>Escuchando: di <strong>"Siguiente"</strong>, <strong>"Atrás"</strong> o <strong>"Tiempo"</strong></span>
              {handsFreeLastHeard && (
                <span className="font-mono bg-white px-1.5 py-0.5 rounded border border-amber-300 text-[10px]">
                  "{handsFreeLastHeard}"
                </span>
              )}
            </div>
          )}
        </div>

        {/* Guía Visual de Intensidades de Fuego desplegable */}
        {showHeatGuideInCooking && (
          <div className="bg-amber-50/50 rounded-2xl border border-amber-200 p-4 space-y-2 animate-fade-in">
            <h4 className="text-xs font-bold text-stone-900 uppercase tracking-wider flex items-center gap-1.5">
              <Flame className="w-4 h-4 text-orange-500" />
              <span>Referencia: Intensidades de Fuego (Llama de la hornalla)</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div className="p-3 rounded-xl border border-blue-200 bg-white text-xs">
                <span className="font-bold text-blue-900 block">Fuego Bajo (Mínimo):</span>
                <p className="text-[11px] text-stone-600 mt-0.5">Llama diminuta que apenas roza la base. Para huevos revueltos, dorar ajo sin quemar o tapar arroz.</p>
              </div>
              <div className="p-3 rounded-xl border border-amber-200 bg-white text-xs">
                <span className="font-bold text-amber-900 block">Fuego Medio (Controlado):</span>
                <p className="text-[11px] text-stone-600 mt-0.5">Llama al 50% de la base. Para sofreír cebollas transparentes, sellar pollo o saltear verduras.</p>
              </div>
              <div className="p-3 rounded-xl border border-red-200 bg-white text-xs">
                <span className="font-bold text-red-900 block">Fuego Alto (¡Cuidado novatos!):</span>
                <p className="text-[11px] text-stone-600 mt-0.5">Cubre todo el fondo. Solo para hervir agua de fideos o caldos. En 15 segundos quema mantequilla o sofritos.</p>
              </div>
            </div>
          </div>
        )}

        {/* Ingredientes de la receta desplegables sin salir del paso */}
        {showIngredientsInCooking && (
          <div className="bg-emerald-50/50 rounded-2xl border border-emerald-200 p-4 space-y-2 animate-fade-in">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-emerald-950 uppercase tracking-wider flex items-center gap-1.5">
                <CheckSquare className="w-4 h-4 text-emerald-600" />
                <span>Ingredientes ({targetServings} {targetServings === 1 ? 'porción' : 'porciones'})</span>
              </h4>
              <span className="text-[10px] text-emerald-800 font-bold bg-emerald-100 px-2 py-0.5 rounded-full">
                Escalado automático
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {selectedRecipe.miseEnPlace.map((item, idx) => (
                <div key={idx} className="p-2 bg-white rounded-lg border border-stone-200 text-stone-700 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
                  <span>{scaleIngredientText(item, selectedRecipe.servings || 2, targetServings)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step instruction card */}
        <div className="bg-stone-50 p-4 sm:p-5 rounded-2xl border border-stone-200 space-y-4">
          {/* Acción Telegráfica Inmediata */}
          <div className="p-4 bg-white rounded-xl border border-stone-200 shadow-xs space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="text-[11px] font-bold text-stone-500 uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                <span>Acción en este momento:</span>
              </div>

              {/* Botón para Leer o Mostrar en Subtítulos */}
              <button
                onClick={() =>
                  speakSpanishText(currentStep.instruction, {
                    speaker: 'Chef Cero',
                    badge: `Paso ${currentStep.stepNumber}`,
                  })
                }
                className={`px-2.5 py-1 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition ${
                  isSilent
                    ? 'bg-amber-50 border-amber-300 text-amber-950 hover:bg-amber-100'
                    : 'bg-stone-100 border-stone-200 text-stone-700 hover:bg-stone-200'
                }`}
                title={
                  isSilent
                    ? 'Mostrar instrucción en subtítulos accesibles en pantalla'
                    : 'Escuchar instrucción en voz alta'
                }
                aria-label="Escuchar o ver subtítulos de la instrucción"
              >
                {isSilent ? (
                  <>
                    <MessageSquare className="w-3.5 h-3.5 text-amber-600" />
                    <span>Ver Subtítulo</span>
                  </>
                ) : (
                  <>
                    <Volume2 className="w-3.5 h-3.5 text-stone-600" />
                    <span>Escuchar Paso</span>
                  </>
                )}
              </button>
            </div>

            <p className="text-base sm:text-lg font-bold text-stone-900 leading-snug">
              {currentStep.instruction}
            </p>
          </div>

          {/* Radar Sensorial: Los 3 Sentidos del Paso (Oído, Vista, Olfato) */}
          <div className="bg-amber-50/70 border border-amber-200/90 rounded-xl p-3.5 space-y-2">
            <div className="text-[11px] font-bold text-amber-900 uppercase tracking-wider flex items-center gap-1.5">
              <span>Radar Sensorial (Comprueba con tus sentidos)</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 pt-1">
              <div className="p-2.5 bg-white/90 rounded-lg border border-amber-200/70 flex items-start gap-2">
                <Ear className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-[11px] block font-bold text-stone-800">Oído:</strong>
                  <span className="text-xs text-stone-700 leading-tight">
                    {currentStep.sensoryCues?.sound || (
                      currentStep.heatLevel === 'bajo'
                        ? 'Susurro constante y suave'
                        : currentStep.heatLevel === 'medio'
                        ? 'Chisporroteo rítmico y controlado'
                        : 'Hervor activo y alegre'
                    )}
                  </span>
                </div>
              </div>

              <div className="p-2.5 bg-white/90 rounded-lg border border-amber-200/70 flex items-start gap-2">
                <Eye className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-[11px] block font-bold text-stone-800">Vista:</strong>
                  <span className="text-xs text-stone-700 leading-tight">
                    {currentStep.sensoryCues?.sight || 'Tono dorado homogéneo sin bordes ennegrecidos'}
                  </span>
                </div>
              </div>

              <div className="p-2.5 bg-white/90 rounded-lg border border-amber-200/70 flex items-start gap-2">
                <Wind className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-[11px] block font-bold text-stone-800">Olfato:</strong>
                  <span className="text-xs text-stone-700 leading-tight">
                    {currentStep.sensoryCues?.smell || 'Aroma dulce y agradable; si hay humo denso, baja el fuego'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Consejo vital de mentor */}
          {currentStep.tip && (
            <div className="bg-white border border-stone-200 rounded-xl p-3.5 text-xs text-stone-900 flex items-start gap-2.5 shadow-2xs">
              <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <strong className="block font-bold text-stone-950">Consejo de mentor:</strong>
                <span className="text-stone-700 leading-relaxed">{currentStep.tip}</span>
              </div>
            </div>
          )}

          {/* Acordeón opcional: ¿Por qué se hace así? (Ciencia Culinaria) */}
          <div className="border border-stone-200 rounded-xl overflow-hidden bg-white">
            <button
              onClick={() => setIsScienceExpanded(!isScienceExpanded)}
              className="w-full px-3.5 py-2.5 text-left text-xs font-bold text-stone-700 hover:text-stone-950 hover:bg-stone-50 flex items-center justify-between transition"
            >
              <span className="flex items-center gap-1.5">
                <span>🧠 ¿Por qué se hace así? (La ciencia detrás del paso)</span>
              </span>
              {isScienceExpanded ? (
                <ChevronUp className="w-4 h-4 text-stone-500" />
              ) : (
                <ChevronDown className="w-4 h-4 text-stone-500" />
              )}
            </button>
            {isScienceExpanded && (
              <div className="px-3.5 pb-3 pt-1 text-xs text-stone-600 border-t border-stone-100 bg-stone-50/50 leading-relaxed">
                {currentStep.whyItWorks ||
                  'Cocinar con fuego medido permite que los azúcares y proteínas caramelicen lentamente sin carbonizarse, conservando humedad, jugosidad y textura en el plato terminado.'}
              </div>
            )}
          </div>

          {/* Integrated timer button for this step */}
          {currentStep.timerSeconds && currentStep.timerSeconds > 0 && (() => {
            const stepTimer = activeTimers.find(
              (t) => t.stepIndex === currentStep.stepNumber || t.label === (currentStep.timerLabel || `Paso ${currentStep.stepNumber}`)
            );

            if (stepTimer) {
              return (
                <div className="pt-2 p-3.5 bg-amber-500/10 border border-amber-300 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-3 h-3 rounded-full ${stepTimer.isRunning ? 'bg-emerald-500 animate-ping' : 'bg-stone-400'}`} />
                    <div>
                      <span className="text-xs font-bold text-stone-900 block">
                        Temporizador de este paso: {stepTimer.label}
                      </span>
                      <span className="text-[11px] text-amber-900 font-medium">
                        {stepTimer.remainingSeconds > 0
                          ? `Restante: ${formatSeconds(stepTimer.remainingSeconds)} (Web Push activo en segundo plano)`
                          : '¡Tiempo cumplido! Apaga el fuego'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleTimerPause(stepTimer.id)}
                      className="px-3 py-1.5 bg-stone-900 text-white hover:bg-stone-800 rounded-lg text-xs font-bold flex items-center gap-1 transition"
                    >
                      {stepTimer.isRunning ? (
                        <>
                          <Pause className="w-3 h-3" /> Pausar
                        </>
                      ) : (
                        <>
                          <Play className="w-3 h-3" /> Reanudar
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => handleStartTimer(stepTimer.remainingSeconds + 60, stepTimer.label, stepTimer.stepIndex)}
                      className="px-2.5 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-900 font-bold rounded-lg text-xs transition"
                      title="Sumar 1 minuto"
                    >
                      +1 min
                    </button>
                  </div>
                </div>
              );
            }

            return (
              <div className="pt-2 flex flex-wrap items-center gap-3">
                <button
                  onClick={() =>
                    handleStartTimer(
                      currentStep.timerSeconds!,
                      currentStep.timerLabel || `Paso ${currentStep.stepNumber}`,
                      currentStep.stepNumber
                    )
                  }
                  className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-stone-950 font-bold rounded-xl text-xs flex items-center gap-2 shadow transition-all"
                >
                  <Clock className="w-4 h-4" />
                  <span>
                    Iniciar temporizador: {formatSeconds(currentStep.timerSeconds)} ({currentStep.timerLabel})
                  </span>
                  <Bell className="w-3 h-3 text-stone-800" />
                </button>
                <span className="text-[11px] text-stone-500">
                  Te avisaremos con sonido y push aunque minimices esta pestaña
                </span>
              </div>
            );
          })()}
        </div>

        {/* Step Navigation Controls */}
        <div className="flex items-center justify-between pt-2">
          <button
            onClick={() => setCurrentStepIndex((prev) => Math.max(0, prev - 1))}
            disabled={currentStepIndex === 0}
            className="px-4 py-2.5 bg-stone-100 hover:bg-stone-200 disabled:opacity-30 text-stone-700 font-semibold rounded-xl text-xs flex items-center gap-1.5 transition-all"
          >
            <ChevronLeft className="w-4 h-4" /> Paso Anterior
          </button>

          <button
            onClick={() =>
              onOpenVoiceAssistantWithContext({
                recipeTitle: selectedRecipe.title,
                stepNumber: currentStep.stepNumber,
                stepInstruction: currentStep.instruction,
                heatLevel: currentStep.heatLevel,
              })
            }
            className="px-3.5 py-2 bg-stone-900 text-white hover:bg-stone-800 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all"
          >
            <HelpCircle className="w-4 h-4 text-amber-400" />
            <span>Consultar este paso con el Chef</span>
          </button>

          {currentStepIndex < selectedRecipe.steps.length - 1 ? (
            <button
              onClick={() => setCurrentStepIndex((prev) => prev + 1)}
              className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-xl text-xs flex items-center gap-1.5 shadow transition-all"
            >
              Siguiente Paso <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleFinishCooking}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-lg transition-all"
            >
              <Award className="w-4 h-4" />
              <span>¡Terminé de Cocinar! (Evaluar)</span>
            </button>
          )}
        </div>

        {/* Enlace para volver a revisar Mise en Place si lo necesita */}
        <div className="pt-3 flex items-center justify-between border-t border-stone-100 text-xs">
          <button
            onClick={() => {
              setCookingStage('mise');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="text-stone-500 hover:text-stone-800 flex items-center gap-1 font-medium transition"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span>Volver a Fase 2 (Mise en Place)</span>
          </button>
          <span className="text-stone-400 text-[11px]">
            {selectedRecipe.title} • {selectedRecipe.cuisineName || 'Chef Cero'}
          </span>
        </div>
      </div>
    </div>
  )}

      {/* Modal: Custom Recipe Generator ("Tengo estos 3 ingredientes") */}
      {showGeneratorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-stone-200 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold text-stone-900 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-500" />
                <span>¿Qué tienes en tu cocina hoy?</span>
              </h3>
              <button
                onClick={() => setShowGeneratorModal(false)}
                className="text-stone-400 hover:text-stone-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-stone-600 leading-relaxed">
              Dile a Gemini qué ingredientes tienes a mano (ejemplo: <em>"2 huevos, media cebolla y una papa"</em>). El Chef diseñará al instante una receta a prueba de principiantes con mise-en-place y control de fuego.
            </p>

            {/* Cultural Style Selector */}
            <div>
              <label className="text-xs font-bold text-stone-700 block mb-1.5">
                Estilo Culinario Deseado:
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                {WORLD_CUISINES.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setGeneratorCuisine(c.id)}
                    className={`p-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 border transition-all ${
                      generatorCuisine === c.id
                        ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                        : 'bg-stone-50 border-stone-200 text-stone-700 hover:bg-stone-100'
                    }`}
                  >
                    <span>{c.flag}</span>
                    <span className="truncate">{c.name.split(' ')[0]}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* BBB Economical focus checkbox */}
            <label className="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 cursor-pointer text-xs text-emerald-950 font-medium">
              <input
                type="checkbox"
                checked={generatorBudgetFocus}
                onChange={(e) => setGeneratorBudgetFocus(e.target.checked)}
                className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
              />
              <span><strong>Enfoque Económico BBB:</strong> Asegurar costo menor a $3.50 USD y sustitutos de alacena.</span>
            </label>

            <textarea
              rows={3}
              value={customIngredientsInput}
              onChange={(e) => setCustomIngredientsInput(e.target.value)}
              placeholder="Escribe tus ingredientes aquí..."
              className="w-full p-3.5 bg-stone-50 border border-stone-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 text-stone-800"
            />

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowGeneratorModal(false)}
                className="px-4 py-2 text-xs font-semibold text-stone-600 hover:bg-stone-100 rounded-xl"
              >
                Cancelar
              </button>
              <button
                onClick={handleGenerateRecipeWithIngredients}
                disabled={isGeneratingRecipe || !customIngredientsInput.trim()}
                className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl flex items-center gap-2 shadow"
              >
                {isGeneratingRecipe ? (
                  <>
                    <Sparkles className="w-4 h-4 animate-spin" />
                    <span>Diseñando receta segura...</span>
                  </>
                ) : (
                  <>
                    <ChefHat className="w-4 h-4" />
                    <span>Crear Receta para Principiante</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Post-Cooking Evaluation & Mentorship */}
      {showEvalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-stone-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold text-stone-900 flex items-center gap-2">
              <Award className="w-6 h-6 text-amber-500" />
              <span>Evaluación de tu Plato con el Mentor</span>
            </h3>

            {!evalFeedbackResult ? (
              <div className="space-y-4 text-left">
                <p className="text-xs text-stone-600">
                  Aprender a cocinar se basa en notar qué pasó y ajustar el fuego la próxima vez. Sé honesto, no juzgamos:
                </p>

                {/* Rating selection */}
                <div>
                  <label className="text-xs font-bold text-stone-700 block mb-2">
                    ¿Cómo te quedó finalmente el plato?
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {(
                      [
                        'En su punto perfecto',
                        'Salado',
                        'Seco',
                        'Se quemó',
                        'Crudo adentro',
                        'Le faltó sabor',
                      ] as const
                    ).map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setEvalRating(r)}
                        className={`p-2.5 rounded-xl border text-xs font-semibold text-center transition-all ${
                          evalRating === r
                            ? 'bg-amber-500 text-white border-amber-600 shadow'
                            : 'bg-stone-50 border-stone-200 text-stone-700 hover:bg-stone-100'
                        }`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Difficulty faced */}
                <div>
                  <label className="text-xs font-bold text-stone-700 block mb-2">
                    ¿Qué fue lo más difícil durante la preparación?
                  </label>
                  <select
                    value={evalDifficulty}
                    onChange={(e) => setEvalDifficulty(e.target.value)}
                    className="w-full p-3 bg-stone-50 border border-stone-300 rounded-xl text-xs text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="Controlar la intensidad del fuego">Controlar la intensidad del fuego</option>
                    <option value="El tiempo (se me pasó de cocción)">El tiempo (se me pasó de cocción)</option>
                    <option value="Cortar las verduras o ingredientes">Cortar las verduras o ingredientes</option>
                    <option value="Saber cuándo apagar la hornalla">Saber cuándo apagar la hornalla</option>
                    <option value="La cantidad de sal o condimentos">La cantidad de sal o condimentos</option>
                    <option value="Todo salió fácil y fluido">Todo salió fácil y fluido</option>
                  </select>
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    onClick={() => setShowEvalModal(false)}
                    className="px-4 py-2 text-xs font-semibold text-stone-600 hover:bg-stone-100 rounded-xl"
                  >
                    Cerrar
                  </button>
                  <button
                    onClick={handleSubmitEvaluation}
                    disabled={isSubmittingEval}
                    className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl flex items-center gap-2 shadow"
                  >
                    {isSubmittingEval ? (
                      <>
                        <Sparkles className="w-4 h-4 animate-spin" />
                        <span>El Chef está analizando tu plato...</span>
                      </>
                    ) : (
                      <>
                        <span>Guardar en Mi Cuaderno de Chef</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              /* Results after AI feedback */
              <div className="space-y-4 pt-2">
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-left space-y-2">
                  <div className="flex items-center gap-2 text-emerald-900 font-bold text-sm">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    <span>¡+{evalFeedbackResult.xpAwarded || 50} Puntos de Experiencia (XP)!</span>
                  </div>
                  <p className="text-xs text-emerald-950 leading-relaxed">
                    {evalFeedbackResult.mentorNote}
                  </p>
                </div>

                {evalFeedbackResult.skillImproved && (
                  <div className="p-3 bg-amber-50/90 border border-amber-300/80 rounded-xl text-left text-xs text-amber-950 space-y-1">
                    <div className="flex items-center gap-1.5 font-bold text-amber-900">
                      <Sparkles className="w-4 h-4 text-amber-600" />
                      <span>Micro-Habilidad Incorporada:</span>
                    </div>
                    <p className="text-stone-700 pl-5 font-medium">{evalFeedbackResult.skillImproved}</p>
                  </div>
                )}

                {evalFeedbackResult.flavorBoosterLearned && (
                  <div className="p-3 bg-orange-50 border border-orange-200 rounded-xl text-left text-xs text-orange-950 space-y-1">
                    <div className="flex items-center gap-1.5 font-bold text-orange-900">
                      <span>✨ Potenciador de Sabor (Flavor Booster):</span>
                    </div>
                    <p className="text-stone-700 pl-5 font-medium">{evalFeedbackResult.flavorBoosterLearned}</p>
                  </div>
                )}

                {evalFeedbackResult.tastePreferenceDetected && (
                  <div className="p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-left text-xs text-stone-700 flex items-center gap-2">
                    <span className="text-base">👅</span>
                    <div>
                      <strong className="text-stone-900 font-semibold">Preferencia registrada:</strong>{' '}
                      {evalFeedbackResult.tastePreferenceDetected}
                    </div>
                  </div>
                )}

                {evalFeedbackResult.detectedMistake && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-left text-xs text-amber-950">
                    <strong>Punto anotado en tu Cuaderno:</strong> {evalFeedbackResult.detectedMistake}. El Chef te recordará este detalle en tus próximos platos.
                  </div>
                )}

                {evalFeedbackResult.personalizedAdvice && (
                  <div className="p-3 bg-stone-50 border border-stone-200 rounded-xl text-left text-xs text-stone-800">
                    <strong>Consejo para la próxima:</strong> {evalFeedbackResult.personalizedAdvice}
                  </div>
                )}

                {evalFeedbackResult.toneEvolutionComment && (
                  <div className="p-2.5 bg-indigo-50 border border-indigo-200 rounded-xl text-left text-xs text-indigo-900">
                    <strong>Progreso de relación con tu mentor:</strong> {evalFeedbackResult.toneEvolutionComment}
                  </div>
                )}

                <button
                  onClick={() => {
                    setShowEvalModal(false);
                    setEvalFeedbackResult(null);
                  }}
                  className="w-full py-3 bg-stone-900 text-white rounded-xl text-xs font-bold hover:bg-stone-800 transition-colors"
                >
                  Continuar explorando
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal: Ruta de los 5 Niveles Culinarios */}
      {showRoadmapModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-stone-200 max-h-[90vh] overflow-y-auto space-y-5">
            <div className="flex items-center justify-between border-b border-stone-200 pb-3">
              <div className="flex items-center gap-2.5">
                <span className="text-2xl">🗺️</span>
                <div>
                  <h3 className="text-lg font-extrabold text-stone-900 font-serif">
                    Ruta de Evolución: De Cero a Chef Intuitivo
                  </h3>
                  <p className="text-xs text-stone-500">
                    Aprende paso a paso sin frustraciones. Cada nivel desbloquea nuevas técnicas seguras.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowRoadmapModal(false)}
                className="w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-600 flex items-center justify-center font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              {CULINARY_LEVELS.map((lvl) => {
                const isCurrent = userProfile.level === lvl.level;
                const isPassed = userProfile.level > lvl.level;
                const isLocked = userProfile.level < lvl.level;

                return (
                  <div
                    key={lvl.level}
                    className={`p-4 rounded-xl border transition-all ${
                      isCurrent
                        ? 'bg-amber-50/90 border-2 border-amber-400 shadow-sm ring-2 ring-amber-400/20'
                        : isPassed
                        ? 'bg-stone-50 border-stone-200 opacity-90'
                        : 'bg-white border-stone-200 opacity-80'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2.5">
                        <span className="text-2xl p-2 rounded-xl bg-white shadow-2xs border border-stone-200 shrink-0">
                          {lvl.badge}
                        </span>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-extrabold text-sm sm:text-base text-stone-900">
                              {lvl.title}
                            </h4>
                            {isCurrent && (
                              <span className="text-[10px] bg-amber-600 text-white font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                                Tu Nivel Actual
                              </span>
                            )}
                            {isPassed && (
                              <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full flex items-center gap-0.5">
                                <span>✓</span> Superado
                              </span>
                            )}
                            {isLocked && (
                              <span className="text-[10px] bg-stone-100 text-stone-600 font-medium px-2 py-0.5 rounded-full">
                                Próximo reto
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-stone-600 font-medium">{lvl.tagline}</p>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-xs font-mono font-bold text-stone-700 bg-white px-2.5 py-1 rounded-lg border border-stone-200 block sm:inline-block">
                          {lvl.minXp} - {lvl.targetXp} XP
                        </span>
                      </div>
                    </div>

                    <p className="text-xs text-stone-700 mt-2 mb-3 leading-relaxed">
                      {lvl.description}
                    </p>

                    <div className="bg-white/80 p-3 rounded-lg border border-stone-200/80 text-xs">
                      <strong className="text-[11px] uppercase tracking-wider text-amber-900 font-bold block mb-1.5 flex items-center gap-1">
                        <span>✨</span> Técnicas y micro-habilidades que dominas:
                      </strong>
                      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-[11px] text-stone-700">
                        {lvl.unlockedTechniques.map((tech, idx) => (
                          <li key={idx} className="flex items-center gap-1.5">
                            <span className="text-amber-500 font-bold">✓</span>
                            <span>{tech}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setShowRoadmapModal(false)}
                className="px-5 py-2.5 bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold rounded-xl transition cursor-pointer"
              >
                Cerrar y Continuar Cocinando
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Celebración de Ascenso de Nivel Culinario */}
      {levelUpCelebration && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/70 backdrop-blur-md animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 text-center shadow-2xl border-4 border-amber-400 space-y-4 relative overflow-hidden">
            {/* Top decoration */}
            <div className="absolute -top-10 -right-10 w-28 h-28 bg-amber-400/20 rounded-full blur-xl pointer-events-none" />
            <div className="absolute -bottom-10 -left-10 w-28 h-28 bg-orange-400/20 rounded-full blur-xl pointer-events-none" />

            <div className="w-20 h-20 mx-auto rounded-3xl bg-gradient-to-tr from-amber-500 to-orange-500 text-white flex items-center justify-center text-4xl shadow-lg animate-bounce">
              {levelUpCelebration.newBadge}
            </div>

            <div>
              <span className="text-xs font-bold uppercase tracking-widest text-amber-800 bg-amber-100 px-3 py-1 rounded-full">
                ¡Ascenso Culinario!
              </span>
              <h3 className="text-2xl font-black text-stone-900 mt-2 font-serif">
                ¡Felicidades, Chef!
              </h3>
              <p className="text-sm font-bold text-amber-950 mt-1">
                Has alcanzado el {levelUpCelebration.newTitle}
              </p>
              <p className="text-xs text-stone-600 mt-1 max-w-xs mx-auto">
                Tu práctica en los fuegos ha dado frutos. Tu mentor gastronómico ahora te propondrá desafíos más ricos y técnicas más sabrosas.
              </p>
            </div>

            {levelUpCelebration.unlockedTechniques.length > 0 && (
              <div className="bg-amber-50 p-3.5 rounded-2xl border border-amber-200 text-left text-xs space-y-2">
                <span className="font-bold text-amber-900 block text-[11px] uppercase tracking-wider">
                  Nuevas técnicas desbloqueadas:
                </span>
                <ul className="space-y-1 text-stone-700 text-xs">
                  {levelUpCelebration.unlockedTechniques.slice(0, 3).map((tech, idx) => (
                    <li key={idx} className="flex items-center gap-1.5 font-medium">
                      <span className="text-amber-600 font-bold">✨</span>
                      <span>{tech}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <button
              onClick={() => setLevelUpCelebration(null)}
              className="w-full py-3 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-sm font-bold shadow-md transition cursor-pointer"
            >
              ¡A seguir cocinando!
            </button>
          </div>
        </div>
      )}

      {/* Modal de Emergencias Culinarias S.O.S. */}
      <CookingEmergencyModal
        isOpen={isEmergencyModalOpen}
        onClose={() => setIsEmergencyModalOpen(false)}
        onOpenVoiceAssistant={() => {
          setIsEmergencyModalOpen(false);
          onOpenVoiceAssistantWithContext?.({
            recipeTitle: selectedRecipe.title,
            stepNumber: currentStep.stepNumber,
            stepInstruction: currentStep.instruction,
            heatLevel: currentStep.heatLevel,
          });
        }}
      />

      {/* Modal de Lista de Compras Inteligente y Compartible */}
      <ShoppingListModal
        isOpen={isShoppingModalOpen}
        onClose={() => setIsShoppingModalOpen(false)}
      />

      {/* Sección FAQ: "Mitos y Miedos del Cocinero Novato" */}
      <div className="mt-10 bg-white rounded-3xl border border-stone-200 p-6 shadow-sm space-y-4">
        <div
          onClick={() => setShowFaqSection(!showFaqSection)}
          className="flex items-center justify-between cursor-pointer select-none"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-900 flex items-center justify-center text-xl font-bold shadow-2xs">
              💡
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-extrabold text-stone-900 font-serif">
                  Mitos y Miedos Comunes del Principiante
                </h3>
                <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                  FAQ Cero Ansiedad
                </span>
              </div>
              <p className="text-xs text-stone-500">
                Todo lo que te daba vergüenza preguntar en la cocina explicado con calma y ciencia.
              </p>
            </div>
          </div>
          <button className="p-2 rounded-xl bg-stone-100 text-stone-600 hover:bg-stone-200 transition">
            {showFaqSection ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

        {showFaqSection && (
          <div className="space-y-3 pt-3 border-t border-stone-100 animate-in fade-in">
            {NOVICE_FAQS.map((faq) => {
              const isExpanded = expandedFaqId === faq.id;
              return (
                <div
                  key={faq.id}
                  className="rounded-2xl border border-stone-200 overflow-hidden transition-all bg-stone-50/50"
                >
                  <button
                    onClick={() => setExpandedFaqId(isExpanded ? null : faq.id)}
                    className="w-full p-4 text-left flex items-center justify-between gap-3 hover:bg-stone-100/70 transition cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text-base shrink-0">{faq.icon}</span>
                      <span className="text-xs sm:text-sm font-bold text-stone-900">
                        {faq.question}
                      </span>
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-stone-400 shrink-0" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-stone-400 shrink-0" />
                    )}
                  </button>

                  {isExpanded && (
                    <div className="p-4 pt-1 bg-white border-t border-stone-100 space-y-3 text-xs">
                      <div className="p-2.5 rounded-xl bg-amber-50/80 border border-amber-200 text-stone-900 leading-relaxed font-semibold">
                        {faq.shortAnswer}
                      </div>

                      <div className="text-stone-700 leading-relaxed bg-stone-50 p-3 rounded-xl border border-stone-200">
                        <strong className="block text-[11px] uppercase tracking-wide text-stone-500 mb-1">
                          🔬 Explicación Científica y Solución:
                        </strong>
                        <p>{faq.explanation}</p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
