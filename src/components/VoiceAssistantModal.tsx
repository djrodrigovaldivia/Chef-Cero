import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Volume2, VolumeX, AlertTriangle, Send, X, Clock, Flame, ShieldAlert, Sparkles, ChefHat, MessageSquare, HelpCircle, Brain, Trash2, Plus, Check, Radio, Zap } from 'lucide-react';
import { UserProfile, ChatMessage, ChefMemoryFact } from '../types';
import { speakSpanishText, stopSpeaking, playEmergencyAlertSound } from '../utils/audioAlert';
import { requestNotificationPermission as requestBrowserNotificationPermission } from '../utils/notifications';
import { useSilentMode } from '../utils/useSilentMode';
import { GeminiLiveClient, LiveClientState } from '../utils/geminiLiveClient';

interface VoiceAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  userProfile: UserProfile;
  currentContext?: {
    recipeTitle?: string;
    stepNumber?: number;
    stepInstruction?: string;
    heatLevel?: string;
  };
  onAddTimer?: (seconds: number, label: string) => void;
  onLearnFact?: (category: 'fuego' | 'gustos' | 'equipamiento' | 'habito' | 'fortaleza', fact: string) => void;
  onRemoveFact?: (id: string) => void;
}

export const VoiceAssistantModal: React.FC<VoiceAssistantModalProps> = ({
  isOpen,
  onClose,
  userProfile,
  currentContext,
  onAddTimer,
  onLearnFact,
  onRemoveFact,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'chef',
      text: '¡Hola! Soy tu Chef Mentor en vivo. Cocina con calma y sin miedo. Puedes hablarme por micrófono o escribirme si tienes dudas con el fuego, la sal o los tiempos de cocción.',
      timestamp: 'Ahora',
    },
  ]);
  const [inputQuery, setInputQuery] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(true);
  const [isContinuousMode, setIsContinuousMode] = useState(true);
  const [showMemoryPanel, setShowMemoryPanel] = useState(false);
  const [newCustomFact, setNewCustomFact] = useState('');
  const [lastLearnedNotification, setLastLearnedNotification] = useState<string | null>(null);
  const { isSilent, toggleSilentMode } = useSilentMode();
  const [emergencyAlert, setEmergencyAlert] = useState<string | null>(null);
  const [speechNotice, setSpeechNotice] = useState<string | null>(null);

  // Estados para Gemini 3.8 Live API en tiempo real
  const [isLiveAvailable, setIsLiveAvailable] = useState<boolean | null>(null);
  const [isLiveActive, setIsLiveActive] = useState<boolean>(false);
  const [liveState, setLiveState] = useState<LiveClientState>('idle');
  const [liveAudioLevel, setLiveAudioLevel] = useState<number>(0);
  const liveClientRef = useRef<GeminiLiveClient | null>(null);
  const currentLiveUserMsgId = useRef<string | null>(null);
  const currentLiveChefMsgId = useRef<string | null>(null);

  const recognitionRef = useRef<any>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const autoListenTimeoutRef = useRef<any>(null);

  // Verificar disponibilidad de Gemini Live API en el backend
  useEffect(() => {
    fetch('/api/live/status')
      .then((r) => r.json())
      .then((data) => {
        setIsLiveAvailable(data?.available ?? false);
      })
      .catch(() => setIsLiveAvailable(false));
  }, []);

  const stopLiveSession = () => {
    if (liveClientRef.current) {
      liveClientRef.current.disconnect();
      liveClientRef.current = null;
    }
    setIsLiveActive(false);
    setLiveState('idle');
    currentLiveUserMsgId.current = null;
    currentLiveChefMsgId.current = null;
  };

  const startLiveSession = async () => {
    if (isSpeaking) {
      stopSpeaking();
      setIsSpeaking(false);
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch (_) {}
    }
    setIsListening(false);

    const client = new GeminiLiveClient({
      onStateChange: (st) => {
        setLiveState(st);
        if (st === 'speaking') {
          setIsSpeaking(true);
        } else if (st === 'listening') {
          setIsSpeaking(false);
        }
      },
      onAudioLevel: (lvl) => {
        setLiveAudioLevel(lvl);
      },
      onUserTranscript: (transcript) => {
        if (!transcript.trim()) return;
        // Se añade automáticamente al chat en vivo
        setMessages((prev) => {
          const id = currentLiveUserMsgId.current || `live-user-${Date.now()}`;
          currentLiveUserMsgId.current = id;
          const exists = prev.some((m) => m.id === id);
          if (exists) {
            return prev.map((m) => (m.id === id ? { ...m, text: transcript } : m));
          }
          return [
            ...prev,
            {
              id,
              sender: 'user',
              text: transcript,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            },
          ];
        });
      },
      onChefTranscript: (chunk) => {
        if (!chunk) return;
        // Transcripción en vivo del Chef añadida directamente al chat
        setMessages((prev) => {
          const id = currentLiveChefMsgId.current || `live-chef-${Date.now()}`;
          currentLiveChefMsgId.current = id;
          const exists = prev.some((m) => m.id === id);
          if (exists) {
            return prev.map((m) => (m.id === id ? { ...m, text: m.text + chunk } : m));
          }
          return [
            ...prev,
            {
              id,
              sender: 'chef',
              text: chunk,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            },
          ];
        });
      },
      onTurnComplete: () => {
        currentLiveUserMsgId.current = null;
        currentLiveChefMsgId.current = null;
      },
      onError: (errMsg) => {
        console.warn('Chef Cero: Error en Live API:', errMsg);
        setSpeechNotice(`Aviso Live: ${errMsg}. Continuando en modo estándar.`);
        stopLiveSession();
      },
    });

    liveClientRef.current = client;
    const ok = await client.connect();
    if (ok) {
      setIsLiveActive(true);
      setSpeechNotice(null);
    } else {
      setIsLiveActive(false);
      setSpeechNotice('No se pudo activar Live API. Usando modo estándar de chat.');
    }
  };

  // Cerrar con tecla Escape para máxima accesibilidad
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Helper para iniciar escucha segura
  const startListeningSafe = () => {
    if (!recognitionRef.current || isSilent) return;
    try {
      recognitionRef.current.abort();
    } catch (_) {}
    try {
      recognitionRef.current.start();
      setSpeechNotice(null);
    } catch (err) {
      console.warn('Speech start safe notice:', err);
    }
  };

  // Initialize Web Speech Recognition if available (configurado para español latinoamericano)
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      // Español de Latinoamérica neutro / regional
      recognition.lang = 'es-419';

      recognition.onstart = () => {
        setIsListening(true);
        setSpeechNotice(null);
      };

      recognition.onresult = (event: any) => {
        const transcript = Array.from(event.results)
          .map((result: any) => result[0].transcript)
          .join('');
        setInputQuery(transcript);
        if (event.results[0].isFinal) {
          handleSendQuery(transcript);
        }
      };

      recognition.onerror = (event: any) => {
        setIsListening(false);
        if (event.error === 'not-allowed') {
          setSpeechNotice('Acceso al micrófono denegado. Puedes escribir o tocar las consultas rápidas.');
        } else if (event.error === 'no-speech') {
          // Si no habló en modo continuo, simplemente dejamos en reposo
        } else {
          console.warn('Speech recognition notice:', event.error);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    } else {
      setVoiceSupported(false);
    }

    return () => {
      stopSpeaking();
      if (autoListenTimeoutRef.current) {
        clearTimeout(autoListenTimeoutRef.current);
      }
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (_) {}
      }
    };
  }, []);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const toggleListening = () => {
    if (isLiveActive) {
      stopLiveSession();
      return;
    }

    if (!recognitionRef.current) {
      setSpeechNotice('Tu navegador no tiene activado el reconocimiento por voz directo. Puedes escribir tu duda abajo o tocar las consultas rápidas.');
      return;
    }

    if (isListening) {
      try {
        recognitionRef.current.stop();
      } catch (_) {}
      setIsListening(false);
    } else {
      setSpeechNotice(null);
      stopSpeaking();
      startListeningSafe();
    }
  };

  const handleReplayAudio = (text: string, audioBase64?: string, audioMimeType?: string) => {
    stopSpeaking();
    setIsSpeaking(true);
    speakSpanishText(text, {
      speaker: 'Chef Cero',
      badge: isSilent ? 'Modo Silencioso' : 'Voz Nativa en Vivo',
      audioBase64,
      audioMimeType,
      onEnd: () => {
        setIsSpeaking(false);
        if (isContinuousMode && !isSilent) {
          autoListenTimeoutRef.current = setTimeout(() => {
            startListeningSafe();
          }, 600);
        }
      },
    });
  };

  const handleSendQuery = async (queryToSend?: string) => {
    const text = (queryToSend || inputQuery).trim();
    if (!text) return;

    // Si el modo Live está activo, enviar directo a través del canal en tiempo real
    if (isLiveActive && liveClientRef.current) {
      setInputQuery('');
      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        sender: 'user',
        text,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, userMsg]);
      liveClientRef.current.sendText(text);
      return;
    }

    // Si el usuario dijo palabras de despedida o pausa, pausar con cariño
    const lower = text.toLowerCase();
    if (lower === 'gracias' || lower === 'muchas gracias' || lower === 'pausa' || lower === 'silencio' || lower === 'listo chef' || lower === 'hasta luego') {
      const farewellMsg: ChatMessage = {
        id: String(Date.now()),
        sender: 'chef',
        text: '¡Con gusto! Aquí me quedo a tu lado en la mesada. Si notas humo o te surge cualquier duda, vuelve a tocar el micrófono.',
        timestamp: 'Ahora',
      };
      setMessages((prev) => [...prev, { id: String(Date.now() - 1), sender: 'user', text, timestamp: 'Ahora' }, farewellMsg]);
      setInputQuery('');
      speakSpanishText(farewellMsg.text, {
        speaker: 'Chef Cero',
        badge: isSilent ? 'Modo Silencioso' : 'Voz Latinoamericana',
      });
      return;
    }

    setInputQuery('');
    const userMsg: ChatMessage = {
      id: String(Date.now()),
      sender: 'user',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    // Alerta de seguridad instantánea acústica
    if (lower.includes('humo') || lower.includes('quema') || lower.includes('fuego') || lower.includes('aceite')) {
      playEmergencyAlertSound();
    }

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          userProfile: {
            levelTitle: userProfile.levelTitle,
            pastMistakes: userProfile.pastMistakes,
            evolutionaryMemories: userProfile.evolutionaryMemories || [],
          },
          currentContext,
          history: messages.slice(-6).map((m) => ({
            sender: m.sender,
            text: m.text,
          })),
        }),
      });

      const data = await response.json();
      const chefReplyText = data.reply || 'Respira con calma. Aparta la sartén de la hornilla mientras revisamos qué está pasando.';

      if (data.safetyAlert) {
        setEmergencyAlert(data.safetyAlert);
        playEmergencyAlertSound();
      } else {
        setEmergencyAlert(null);
      }

      if (data.timerSecondsRequested && data.timerSecondsRequested > 0 && onAddTimer) {
        onAddTimer(data.timerSecondsRequested, data.timerLabel || 'Temporizador');
        try {
          requestBrowserNotificationPermission();
        } catch {}
      }

      // Aprendizaje Progresivo en Tiempo Real
      if (data.learnedMemory?.fact && onLearnFact) {
        const cat = data.learnedMemory.category || 'habito';
        onLearnFact(cat as any, data.learnedMemory.fact);
        setLastLearnedNotification(data.learnedMemory.fact);
        setTimeout(() => setLastLearnedNotification(null), 7000);
      }

      const chefMsg: ChatMessage = {
        id: String(Date.now() + 1),
        sender: 'chef',
        text: chefReplyText,
        safetyAlert: data.safetyAlert || undefined,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        audioBase64: data.audioBase64,
        audioMimeType: data.audioMimeType,
      };

      setMessages((prev) => [...prev, chefMsg]);

      // Reproducir voz nativa con Gemini TTS y reactivar conversación continua al terminar
      setIsSpeaking(true);
      speakSpanishText(chefReplyText, {
        speaker: 'Chef Cero',
        badge: isSilent ? 'Modo Silencioso' : 'Voz Nativa en Vivo',
        audioBase64: data.audioBase64,
        audioMimeType: data.audioMimeType,
        onEnd: () => {
          setIsSpeaking(false);
          // Si el modo conversación continua está activo y no es silencioso, abrir micrófono automáticamente
          if (isContinuousMode && !isSilent) {
            autoListenTimeoutRef.current = setTimeout(() => {
              startListeningSafe();
            }, 700);
          }
        },
      });
    } catch (err) {
      console.error('Chat error:', err);
      const fallbackMsg: ChatMessage = {
        id: String(Date.now() + 2),
        sender: 'chef',
        text: '¡Ojo con la hornilla! Si algo huele a quemado o notas mucho humo, retira la sartén hacia una hornilla fría y baja el fuego mientras revisamos.',
        timestamp: 'Ahora',
      };
      setMessages((prev) => [...prev, fallbackMsg]);
      speakSpanishText(fallbackMsg.text, {
        speaker: 'Chef Cero',
        badge: isSilent ? 'Modo Silencioso' : 'Voz Latinoamericana',
        isEmergency: true,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickAction = (text: string) => {
    handleSendQuery(text);
  };

  const handleAddManualFact = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustomFact.trim() || !onLearnFact) return;
    onLearnFact('gustos', newCustomFact.trim());
    setNewCustomFact('');
    setLastLearnedNotification(`Nota guardada: "${newCustomFact.trim()}"`);
    setTimeout(() => setLastLearnedNotification(null), 5000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-900/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-stone-200 flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 bg-amber-500 text-white flex items-center justify-between border-b border-amber-600/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white backdrop-blur-sm">
              <ChefHat className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-lg text-white">Chef Cero en Vivo</h3>
                <span className="px-2 py-0.5 text-xs font-semibold bg-white/20 rounded-full text-white">
                  {isSilent ? 'Modo Silencioso' : 'Manos Libres'}
                </span>
              </div>
              <p className="text-xs text-amber-100">
                {currentContext?.recipeTitle ? `Receta activa: ${currentContext.recipeTitle}` : 'Tu mentor de cocina en tiempo real'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Toggle Gemini 3.8 Live API en tiempo real */}
            <button
              onClick={() => {
                if (isLiveActive) {
                  stopLiveSession();
                } else {
                  startLiveSession();
                }
              }}
              title={
                isLiveActive
                  ? 'Desactivar Gemini 3.8 Live y volver a chat estándar'
                  : 'Activar Gemini 3.8 Live API (conversación de audio en tiempo real continua manos libres)'
              }
              className={`px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition ${
                isLiveActive
                  ? 'bg-rose-600 text-white shadow-md ring-2 ring-rose-300 animate-pulse'
                  : 'bg-rose-700/80 hover:bg-rose-600 text-white shadow-sm'
              }`}
            >
              <Radio className={`w-3.5 h-3.5 ${isLiveActive ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">
                {isLiveActive ? 'Live 3.8: ON' : 'Live 3.8'}
              </span>
              <span className="sm:hidden">
                {isLiveActive ? 'Live ON' : 'Live'}
              </span>
            </button>

            {/* Toggle Conversación Continua Manos Libres */}
            <button
              onClick={() => setIsContinuousMode((prev) => !prev)}
              title={
                isContinuousMode
                  ? 'Conversación Fluida ACTIVA: el Chef abre el micrófono solo tras hablar para escucharte'
                  : 'Modo manual: toca el botón de micrófono cuando quieras hablar'
              }
              className={`px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 transition ${
                isContinuousMode
                  ? 'bg-amber-600 text-white shadow-inner ring-2 ring-amber-300/50'
                  : 'bg-white/20 hover:bg-white/30 text-amber-100'
              }`}
            >
              <Mic className="w-3.5 h-3.5" />
              <span className="hidden md:inline">
                {isContinuousMode ? 'Fluido: ON' : 'Fluido: OFF'}
              </span>
            </button>

            {/* Ver Memoria Aprendida */}
            <button
              onClick={() => setShowMemoryPanel((prev) => !prev)}
              title="Ver lo que el Chef Mentor ha aprendido sobre ti"
              className={`px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 transition ${
                showMemoryPanel
                  ? 'bg-stone-900 text-amber-300 ring-2 ring-amber-300/40'
                  : 'bg-white/20 hover:bg-white/30 text-white'
              }`}
            >
              <Brain className="w-3.5 h-3.5 text-amber-200" />
              <span className="hidden sm:inline">Memoria</span>
              <span className="px-1.5 py-0.2 bg-white/25 rounded-full text-[10px]">
                {userProfile.evolutionaryMemories?.length || 0}
              </span>
            </button>

            {/* Toggle de Modo Silencioso / Voz */}
            <button
              onClick={() => {
                if (isSpeaking) {
                  stopSpeaking();
                  setIsSpeaking(false);
                }
                toggleSilentMode();
              }}
              title={
                isSilent
                  ? 'Modo Silencioso activo: las respuestas se convierten a subtítulos en pantalla (haz clic para activar voz)'
                  : 'Voz activada: las respuestas se pronuncian en voz alta (haz clic para silenciar)'
              }
              aria-label={isSilent ? 'Activar voz del asistente' : 'Activar modo silencioso con subtítulos'}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition ${
                isSilent
                  ? 'bg-stone-900 text-amber-300 ring-2 ring-amber-300/40'
                  : 'bg-white/20 hover:bg-white/30 text-white'
              }`}
            >
              {isSilent ? (
                <>
                  <VolumeX className="w-4 h-4 text-amber-300" />
                  <span className="hidden md:inline">Silencio</span>
                </>
              ) : (
                <>
                  <Volume2 className="w-4 h-4" />
                  <span className="hidden md:inline">Voz</span>
                </>
              )}
            </button>

            <button
              onClick={() => {
                stopLiveSession();
                stopSpeaking();
                onClose();
              }}
              className="p-2 rounded-lg hover:bg-white/20 text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Barra de estado en vivo para Gemini 3.8 Live API */}
        {isLiveActive && (
          <div className="bg-rose-950 text-rose-100 px-4 py-2.5 flex items-center justify-between text-xs border-b border-rose-800 shadow-inner">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
              </span>
              <span>
                <strong>🔴 Gemini 3.8 Live Conectado:</strong>{' '}
                {liveState === 'speaking'
                  ? 'El Chef te responde en vivo (puedes interrumpir con tu voz)'
                  : liveState === 'connecting'
                  ? 'Conectando canal de audio...'
                  : 'Manos libres activas: habla con total naturalidad.'}
              </span>
            </div>
            {/* Visualizador dinámico de ondas sonoras */}
            <div className="flex items-center gap-1 h-3.5">
              {[0.4, 0.8, 1, 0.6, 0.9, 0.5, 0.7].map((h, i) => (
                <span
                  key={i}
                  className="w-1 bg-rose-400 rounded-full transition-all duration-75"
                  style={{
                    height: `${Math.max(3, (liveState === 'speaking' ? 14 : liveAudioLevel * 22) * h)}px`,
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {/* Notificación flotante de nuevo dato aprendido en tiempo real */}
        {lastLearnedNotification && (
          <div
            role="status"
            className="bg-emerald-600 text-white px-4 py-2.5 flex items-center justify-between text-xs shadow-md animate-in slide-in-from-top-2 duration-300 border-b border-emerald-700"
          >
            <div className="flex items-center gap-2">
              <Brain className="w-4 h-4 text-emerald-200 shrink-0 animate-bounce" />
              <span>
                <strong className="font-bold">🧠 El Chef aprendió de ti:</strong> {lastLearnedNotification}
              </span>
            </div>
            <button
              onClick={() => setLastLearnedNotification(null)}
              className="text-[11px] bg-white/20 hover:bg-white/30 px-2 py-0.5 rounded text-white font-medium"
            >
              Genial
            </button>
          </div>
        )}

        {/* Panel de Memoria Culinaria Evolutiva (Desplegable) */}
        {showMemoryPanel && (
          <div className="bg-amber-50/90 border-b border-amber-200 p-4 max-h-60 overflow-y-auto animate-in slide-in-from-top-3 duration-200 text-xs text-stone-800">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Brain className="w-4 h-4 text-amber-700" />
                <h4 className="font-bold text-amber-950 uppercase tracking-wide text-[11px]">
                  Memoria Culinaria Evolutiva del Chef
                </h4>
              </div>
              <span className="text-[10px] text-amber-800 font-medium">
                La IA personaliza cada consejo con estos datos
              </span>
            </div>

            {(!userProfile.evolutionaryMemories || userProfile.evolutionaryMemories.length === 0) ? (
              <p className="text-stone-500 italic py-2">
                Aún no hay notas aprendidas. El Chef irá registrando tus gustos, errores superados y utensilios mientras conversas.
              </p>
            ) : (
              <div className="space-y-1.5 mb-3">
                {userProfile.evolutionaryMemories.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-start justify-between gap-2 p-2 bg-white rounded-lg border border-amber-200/80 shadow-2xs"
                  >
                    <div className="flex items-start gap-1.5">
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider shrink-0 bg-amber-100 text-amber-800 border border-amber-200">
                        {m.category === 'fuego' && '🔥 Fuego'}
                        {m.category === 'fortaleza' && '⭐ Fortaleza'}
                        {m.category === 'gustos' && '🧂 Gustos'}
                        {m.category === 'equipamiento' && '🍳 Equipo'}
                        {m.category === 'habito' && '💡 Hábito'}
                        {!['fuego', 'fortaleza', 'gustos', 'equipamiento', 'habito'].includes(m.category) && m.category}
                      </span>
                      <p className="text-stone-800 leading-snug">{m.fact}</p>
                    </div>
                    {onRemoveFact && (
                      <button
                        onClick={() => onRemoveFact(m.id)}
                        className="text-stone-400 hover:text-red-600 p-1 transition"
                        title="Olvidar este dato"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Formulario rápido para añadir una nota manual al Chef */}
            <form onSubmit={handleAddManualFact} className="flex gap-1.5 pt-1">
              <input
                type="text"
                value={newCustomFact}
                onChange={(e) => setNewCustomFact(e.target.value)}
                placeholder="Ej: Solo tengo cocina eléctrica de 4 placas, no uso picante..."
                className="flex-1 bg-white border border-amber-300 rounded-lg px-2.5 py-1.5 text-xs text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
              <button
                type="submit"
                disabled={!newCustomFact.trim()}
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-40 text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Recordar</span>
              </button>
            </form>
          </div>
        )}

        {/* Banner informativo de Modo Silencioso Activo */}
        {isSilent && (
          <div
            role="status"
            aria-live="polite"
            className="bg-stone-900 text-stone-200 px-4 py-2 border-b border-stone-800 flex items-center justify-between text-xs animate-fade-in"
          >
            <div className="flex items-center gap-2">
              <VolumeX className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                <strong className="text-amber-400 font-bold">Modo Silencioso activo:</strong> Las respuestas de voz se convierten automáticamente en subtítulos en pantalla sin emitir ruido.
              </span>
            </div>
            <button
              onClick={toggleSilentMode}
              className="text-[11px] underline text-amber-400 hover:text-amber-300 font-bold ml-2 shrink-0"
            >
              Activar voz
            </button>
          </div>
        )}

        {/* Emergency Alert Banner if triggered */}
        {emergencyAlert && (
          <div className="bg-red-600 text-white px-4 py-3 flex items-center justify-between gap-3 animate-pulse">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <ShieldAlert className="w-5 h-5 shrink-0" />
              <span>{emergencyAlert}</span>
            </div>
            <button
              onClick={() => setEmergencyAlert(null)}
              className="text-xs bg-white/20 hover:bg-white/30 px-2 py-1 rounded"
            >
              Entendido
            </button>
          </div>
        )}

        {/* Notificación informativa accesible de voz / micrófono */}
        {speechNotice && (
          <div
            role="status"
            aria-live="polite"
            className="bg-amber-100 text-amber-950 px-4 py-2 text-xs flex items-center justify-between border-b border-amber-200"
          >
            <div className="flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-amber-700 shrink-0" />
              <span>{speechNotice}</span>
            </div>
            <button
              onClick={() => setSpeechNotice(null)}
              className="text-amber-800 hover:text-amber-950 font-bold ml-2 underline shrink-0"
            >
              Descartar
            </button>
          </div>
        )}

        {/* Chat History */}
        <div ref={chatScrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-amber-50/20">
          {/* Banner invitando a usar Live si está disponible y aún no está activo */}
          {!isLiveActive && isLiveAvailable && (
            <div className="p-3 bg-gradient-to-r from-rose-50 to-amber-50 border border-rose-200/90 rounded-2xl flex items-center justify-between gap-3 text-xs text-rose-950 shadow-xs">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-rose-600 text-white rounded-xl shrink-0 shadow-xs">
                  <Radio className="w-4 h-4" />
                </div>
                <div>
                  <p className="font-bold text-rose-950">Conversación en Tiempo Real con Gemini 3.8 Live</p>
                  <p className="text-[11px] text-stone-600">Habla con las manos libres de corrido sin tocar botones.</p>
                </div>
              </div>
              <button
                onClick={startLiveSession}
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl shadow-xs transition shrink-0 flex items-center gap-1.5 text-xs"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>Activar Live</span>
              </button>
            </div>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl p-4 shadow-sm text-sm leading-relaxed ${
                  msg.sender === 'user'
                    ? 'bg-amber-600 text-white rounded-br-none'
                    : 'bg-white border border-stone-200 text-stone-800 rounded-bl-none'
                }`}
              >
                {msg.safetyAlert && (
                  <div className="mb-2 p-2 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs font-bold flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
                    <span>{msg.safetyAlert}</span>
                  </div>
                )}
                <p className="whitespace-pre-line">{msg.text}</p>
                {msg.sender === 'chef' && (
                  <div className="mt-2 pt-2 border-t border-stone-100 flex items-center justify-between gap-2">
                    <button
                      onClick={() => handleReplayAudio(msg.text, msg.audioBase64, msg.audioMimeType)}
                      className="inline-flex items-center gap-1 text-[11px] text-amber-700 hover:text-amber-900 font-semibold transition py-0.5 px-2 rounded-lg hover:bg-amber-50"
                      title="Escuchar respuesta en voz nativa en español latinoamericano"
                    >
                      <Volume2 className="w-3.5 h-3.5 text-amber-600" />
                      <span>Escuchar en audio</span>
                    </button>
                    <span className="text-[10px] text-stone-400 font-medium">Español Latino</span>
                  </div>
                )}
              </div>
              <span className="text-[10px] text-stone-400 mt-1 px-1">{msg.timestamp}</span>
            </div>
          ))}

          {isLoading && (
            <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-100/70 w-fit px-3 py-2 rounded-full animate-pulse">
              <Sparkles className="w-4 h-4" />
              <span>El Chef está pensando tu respuesta...</span>
            </div>
          )}

          {isSpeaking && (
            <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-100/70 w-fit px-3 py-1.5 rounded-full">
              <Volume2 className="w-4 h-4 animate-bounce" />
              <span>El Chef está hablando... (puedes interrumpir con el micrófono)</span>
            </div>
          )}
        </div>

        {/* Quick Emergency / Voice triggers */}
        <div className="px-4 py-2 bg-stone-50 border-t border-stone-200">
          <p className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider mb-1.5">
            Botones rápidos de emergencia:
          </p>
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => handleQuickAction('¡Chef, el aceite empezó a humear mucho, qué hago!')}
              className="text-xs bg-red-100 hover:bg-red-200 text-red-800 font-medium px-2.5 py-1 rounded-full flex items-center gap-1 transition-colors"
            >
              <Flame className="w-3 h-3 text-red-600" /> ¡El aceite humea!
            </button>
            <button
              onClick={() => handleQuickAction('¡Chef, siento olor a quemado!')}
              className="text-xs bg-orange-100 hover:bg-orange-200 text-orange-800 font-medium px-2.5 py-1 rounded-full flex items-center gap-1 transition-colors"
            >
              <AlertTriangle className="w-3 h-3 text-orange-600" /> ¡Se me quema!
            </button>
            <button
              onClick={() => handleQuickAction('¿Cómo sé si el pollo ya está cocido por dentro y no crudo?')}
              className="text-xs bg-amber-100 hover:bg-amber-200 text-amber-900 font-medium px-2.5 py-1 rounded-full transition-colors"
            >
              ¿Pollo bien cocido?
            </button>
            <button
              onClick={() => handleQuickAction('Chef, pon un temporizador de 8 minutos para los fideos')}
              className="text-xs bg-blue-100 hover:bg-blue-200 text-blue-800 font-medium px-2.5 py-1 rounded-full flex items-center gap-1 transition-colors"
            >
              <Clock className="w-3 h-3" /> Temporizador 8 min
            </button>
            <button
              onClick={() => handleQuickAction('¿Cómo ajusto el fuego para que sea fuego bajo en mi hornalla?')}
              className="text-xs bg-stone-200 hover:bg-stone-300 text-stone-800 font-medium px-2.5 py-1 rounded-full transition-colors"
            >
              ¿Cómo es fuego bajo?
            </button>
          </div>
        </div>

        {/* Status banner when listening in continuous hands-free mode */}
        {isListening && (
          <div className="px-4 py-2 bg-red-50 border-t border-red-200 flex items-center justify-between text-xs text-red-900 animate-in fade-in">
            <div className="flex items-center gap-2 font-medium">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-600"></span>
              </span>
              <span>
                <strong>El Chef te escucha en vivo:</strong> Habla con naturalidad (o di <em>"gracias"</em> / <em>"pausa"</em> para reposar).
              </span>
            </div>
            <button
              onClick={toggleListening}
              className="text-[11px] bg-red-200/80 hover:bg-red-300 text-red-950 font-bold px-2 py-0.5 rounded transition"
            >
              Pausar micrófono
            </button>
          </div>
        )}

        {/* Input Bar with Hands-Free Mic Button */}
        <div className="p-4 bg-white border-t border-stone-200 flex items-center gap-2">
          <button
            onClick={toggleListening}
            className={`p-3.5 rounded-full flex items-center justify-center transition-all shadow-md ${
              isLiveActive
                ? 'bg-rose-600 text-white animate-pulse ring-4 ring-rose-300'
                : isListening
                ? 'bg-red-600 text-white animate-pulse ring-4 ring-red-200'
                : 'bg-amber-500 hover:bg-amber-600 text-white'
            }`}
            title={
              isLiveActive
                ? 'Gemini 3.8 Live activo (haz clic para pausar o detener Live)'
                : isListening
                ? 'Detener micrófono'
                : 'Hablar con el Chef (Manos Libres)'
            }
          >
            {isLiveActive ? (
              <Radio className="w-6 h-6 animate-pulse" />
            ) : isListening ? (
              <Mic className="w-6 h-6 animate-spin" />
            ) : (
              <Mic className="w-6 h-6" />
            )}
          </button>

          <div className="flex-1 relative">
            <input
              type="text"
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendQuery()}
              placeholder={
                isLiveActive
                  ? '🔴 Gemini 3.8 Live activo: habla de corrido o escribe aquí...'
                  : isListening
                  ? 'Escuchando tu voz en vivo...'
                  : 'Pregunta lo que sea o toca el micrófono...'
              }
              className="w-full bg-stone-100 border border-stone-300 rounded-full px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white transition-all text-stone-800"
            />
            {(isListening || isLiveActive) && (
              <span className="absolute right-3 top-3 flex h-3 w-3">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${isLiveActive ? 'bg-rose-400' : 'bg-red-400'} opacity-75`}></span>
                <span className={`relative inline-flex rounded-full h-3 w-3 ${isLiveActive ? 'bg-rose-500' : 'bg-red-500'}`}></span>
              </span>
            )}
          </div>

          <button
            onClick={() => handleSendQuery()}
            disabled={!inputQuery.trim() || isLoading}
            className="p-3 bg-amber-600 hover:bg-amber-700 disabled:opacity-40 text-white rounded-full transition-colors"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};
