import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Volume2, VolumeX, AlertTriangle, Send, X, Clock, Flame, ShieldAlert, Sparkles, ChefHat, MessageSquare, HelpCircle } from 'lucide-react';
import { UserProfile, ChatMessage } from '../types';
import { speakSpanishText, stopSpeaking, playEmergencyAlertSound } from '../utils/audioAlert';
import { requestNotificationPermission as requestBrowserNotificationPermission } from '../utils/notifications';
import { useSilentMode } from '../utils/useSilentMode';

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
}

export const VoiceAssistantModal: React.FC<VoiceAssistantModalProps> = ({
  isOpen,
  onClose,
  userProfile,
  currentContext,
  onAddTimer,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'chef',
      text: '¡Hola! Soy tu Chef Mentor en vivo. Cocina con calma y sin miedo. Puedes hablarme por micrófono o tocar los botones de emergencia si ves humo o dudas con el fuego.',
      timestamp: 'Ahora',
    },
  ]);
  const [inputQuery, setInputQuery] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(true);
  const { isSilent, toggleSilentMode } = useSilentMode();
  const [emergencyAlert, setEmergencyAlert] = useState<string | null>(null);
  const [speechNotice, setSpeechNotice] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);

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

  // Initialize Web Speech Recognition if available
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'es-ES';

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
          setSpeechNotice('No se detectó voz. Intenta pulsar de nuevo y hablar.');
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
      try {
        recognitionRef.current.start();
      } catch (err) {
        console.warn('Recognition start error:', err);
      }
    }
  };

  const handleSendQuery = async (queryToSend?: string) => {
    const text = (queryToSend || inputQuery).trim();
    if (!text) return;

    setInputQuery('');
    const userMsg: ChatMessage = {
      id: String(Date.now()),
      sender: 'user',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    // Check emergency trigger words locally for instant audio reaction
    const lower = text.toLowerCase();
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
          },
          currentContext,
        }),
      });

      const data = await response.json();
      const chefReplyText = data.reply || 'Respira. Aparta la sartén del fuego y revisa si el calor está muy alto.';

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

      const chefMsg: ChatMessage = {
        id: String(Date.now() + 1),
        sender: 'chef',
        text: chefReplyText,
        safetyAlert: data.safetyAlert || undefined,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, chefMsg]);

      // Si el usuario no tiene la voz desactivada (Modo Silencioso convierte a subtítulos automáticamente)
      setIsSpeaking(true);
      speakSpanishText(chefReplyText, {
        speaker: 'Chef Cero',
        badge: isSilent ? 'Modo Silencioso' : 'Voz del Chef',
        onEnd: () => {
          setIsSpeaking(false);
        },
      });
    } catch (err) {
      console.error('Chat error:', err);
      const fallbackMsg: ChatMessage = {
        id: String(Date.now() + 2),
        sender: 'chef',
        text: '¡Atención! Si sientes que algo se te pasa de cocción o huele a quemado, retira la sartén hacia una hornalla fría y apaga el fuego mientras revisas.',
        timestamp: 'Ahora',
      };
      setMessages((prev) => [...prev, fallbackMsg]);
      speakSpanishText(fallbackMsg.text, {
        speaker: 'Chef Cero',
        badge: isSilent ? 'Modo Silencioso' : 'Voz del Chef',
        isEmergency: true,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickAction = (text: string) => {
    handleSendQuery(text);
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

          <div className="flex items-center gap-2">
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
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition ${
                isSilent
                  ? 'bg-stone-900 text-amber-300 ring-2 ring-amber-300/40'
                  : 'bg-white/20 hover:bg-white/30 text-white'
              }`}
            >
              {isSilent ? (
                <>
                  <VolumeX className="w-4 h-4 text-amber-300" />
                  <span className="hidden sm:inline">Modo Silencioso</span>
                </>
              ) : (
                <>
                  <Volume2 className="w-4 h-4" />
                  <span className="hidden sm:inline">Voz Activa</span>
                </>
              )}
            </button>

            <button
              onClick={() => {
                stopSpeaking();
                onClose();
              }}
              className="p-2 rounded-lg hover:bg-white/20 text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

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

        {/* Input Bar with Hands-Free Mic Button */}
        <div className="p-4 bg-white border-t border-stone-200 flex items-center gap-2">
          <button
            onClick={toggleListening}
            className={`p-3.5 rounded-full flex items-center justify-center transition-all shadow-md ${
              isListening
                ? 'bg-red-600 text-white animate-pulse ring-4 ring-red-200'
                : 'bg-amber-500 hover:bg-amber-600 text-white'
            }`}
            title={isListening ? 'Detener micrófono' : 'Hablar con el Chef (Manos Libres)'}
          >
            {isListening ? <Mic className="w-6 h-6 animate-spin" /> : <Mic className="w-6 h-6" />}
          </button>

          <div className="flex-1 relative">
            <input
              type="text"
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendQuery()}
              placeholder={
                isListening
                  ? 'Escuchando tu voz en vivo...'
                  : 'Pregunta lo que sea o toca el micrófono...'
              }
              className="w-full bg-stone-100 border border-stone-300 rounded-full px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white transition-all text-stone-800"
            />
            {isListening && (
              <span className="absolute right-3 top-3 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
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
