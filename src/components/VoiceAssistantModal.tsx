import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Volume2, VolumeX, AlertTriangle, Send, X, Clock, Flame, ShieldAlert, Sparkles, ChefHat, MessageSquare, HelpCircle, Brain, Trash2, Plus, Check, Radio, Zap, Activity, Wifi, Lightbulb, Compass, ThumbsUp, Coins } from 'lucide-react';
import { UserProfile, ChatMessage, ChefMemoryFact } from '../types';
import { speakSpanishText, stopSpeaking, playEmergencyAlertSound } from '../utils/audioAlert';
import { requestNotificationPermission as requestBrowserNotificationPermission } from '../utils/notifications';
import { useSilentMode } from '../utils/useSilentMode';
import { GeminiLiveClient, LiveClientState, NetworkQuality, DetectedVoiceTone, PatienceMode } from '../utils/geminiLiveClient';
import { HandsFreeCookingListener } from '../utils/handsFreeListener';
import { useVoiceConnection, downsampleTo16kHz } from '../hooks/useVoiceConnection';
import { ReactiveLiveOrb } from './ReactiveLiveOrb';
import { DirectWebSocketTutorialModal } from './DirectWebSocketTutorialModal';
import { audioVisualizerBus } from '../utils/audioVisualizerBus';
import { tokenBudgetTracker, TokenUsageStats } from '../utils/tokenBudgetTracker';
import { TokenBudgetMonitor } from './TokenBudgetMonitor';

interface VoiceAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  userProfile: UserProfile;
  currentContext?: {
    recipeTitle?: string;
    stepNumber?: number;
    stepInstruction?: string;
    heatLevel?: string;
    totalSteps?: number;
  };
  onAddTimer?: (seconds: number, label: string) => void;
  onLearnFact?: (category: 'fuego' | 'gustos' | 'equipamiento' | 'habito' | 'fortaleza', fact: string) => void;
  onRemoveFact?: (id: string) => void;
  onNextStep?: () => void;
  onPrevStep?: () => void;
  onRepeatStep?: () => void;
  onEmergency?: () => void;
}

export const VoiceAssistantModal: React.FC<VoiceAssistantModalProps> = ({
  isOpen,
  onClose,
  userProfile,
  currentContext,
  onAddTimer,
  onLearnFact,
  onRemoveFact,
  onNextStep,
  onPrevStep,
  onRepeatStep,
  onEmergency,
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
  const [showWsTutorial, setShowWsTutorial] = useState<boolean>(false);

  // Estados para Modo Manos Sucias (Navegación de pasos por voz de latencia ultra-baja < 50ms)
  const [isDirtyHandsMode, setIsDirtyHandsMode] = useState<boolean>(false);
  const [dirtyHandsLastCommand, setDirtyHandsLastCommand] = useState<{
    command: string;
    transcript: string;
    timestamp: number;
  } | null>(null);
  const [dirtyHandsLastHeard, setDirtyHandsLastHeard] = useState<string | null>(null);
  const dirtyHandsListenerRef = useRef<HandsFreeCookingListener | null>(null);
  const [liveRecipeContext, setLiveRecipeContext] = useState<any>(currentContext);

  useEffect(() => {
    if (currentContext) {
      setLiveRecipeContext(currentContext);
    }
  }, [currentContext]);

  useEffect(() => {
    const handleRecipeContext = (e: any) => {
      if (e.detail) {
        setLiveRecipeContext((prev: any) => ({ ...prev, ...e.detail }));
      }
    };
    window.addEventListener('chef-cero-recipe-context', handleRecipeContext);
    return () => window.removeEventListener('chef-cero-recipe-context', handleRecipeContext);
  }, []);

  // Manejo de Modo Manos Sucias con HandsFreeCookingListener optimizado (< 50ms latencia)
  useEffect(() => {
    if (!isOpen || !isDirtyHandsMode) {
      if (dirtyHandsListenerRef.current) {
        dirtyHandsListenerRef.current.stop();
        dirtyHandsListenerRef.current = null;
      }
      return;
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch (_) {}
    }
    setIsListening(false);

    const listener = new HandsFreeCookingListener({
      onNextStep: () => {
        onNextStep?.();
        window.dispatchEvent(new CustomEvent('chef-cero-step-cmd', { detail: { action: 'next' } }));
      },
      onPrevStep: () => {
        onPrevStep?.();
        window.dispatchEvent(new CustomEvent('chef-cero-step-cmd', { detail: { action: 'prev' } }));
      },
      onRepeatStep: () => {
        onRepeatStep?.();
        window.dispatchEvent(new CustomEvent('chef-cero-step-cmd', { detail: { action: 'repeat' } }));
      },
      onStartTimer: () => {
        window.dispatchEvent(new CustomEvent('chef-cero-step-cmd', { detail: { action: 'timer' } }));
      },
      onPauseTimer: () => {
        window.dispatchEvent(new CustomEvent('chef-cero-step-cmd', { detail: { action: 'pause' } }));
      },
      onEmergency: () => {
        onEmergency?.();
        window.dispatchEvent(new CustomEvent('chef-cero-step-cmd', { detail: { action: 'emergency' } }));
        setEmergencyAlert('¡Emergencia culinaria activada por comando de voz!');
      },
      onStatusChange: (_active, lastWord) => {
        if (lastWord) {
          setDirtyHandsLastHeard(lastWord);
          setTimeout(() => setDirtyHandsLastHeard(null), 3000);
        }
      },
      onCommandExecuted: (cmd, text) => {
        setDirtyHandsLastCommand({ command: cmd, transcript: text, timestamp: Date.now() });
        try {
          if (typeof navigator !== 'undefined' && navigator.vibrate) {
            navigator.vibrate([40]);
          }
        } catch (_) {}
        setTimeout(() => setDirtyHandsLastCommand(null), 3500);
      },
    });

    listener.start();
    dirtyHandsListenerRef.current = listener;

    return () => {
      listener.stop();
      dirtyHandsListenerRef.current = null;
    };
  }, [isOpen, isDirtyHandsMode, onNextStep, onPrevStep, onRepeatStep, onEmergency]);

  // Estados para Gemini 3.8 Live API en tiempo real
  const [isLiveAvailable, setIsLiveAvailable] = useState<boolean | null>(null);
  const [liveAudioLevel, setLiveAudioLevel] = useState<number>(0);
  const currentLiveUserMsgId = useRef<string | null>(null);
  const currentLiveChefMsgId = useRef<string | null>(null);
  const [latestChefLiveText, setLatestChefLiveText] = useState<string>('');
  const [latestUserLiveText, setLatestUserLiveText] = useState<string>('');

  // Nodos Web Audio API para DSP de Cancelación de Eco Quirúrgica y Noise Gate de Cocina
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const highpassFilterRef = useRef<BiquadFilterNode | null>(null);
  const inputAnalyserRef = useRef<AnalyserNode | null>(null);
  const dspProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const [isGatePassingVoice, setIsGatePassingVoice] = useState<boolean>(false);

  // Estados para Monitor de Latencia en tiempo real
  const [networkLatency, setNetworkLatency] = useState<number | null>(null);
  const [networkQuality, setNetworkQuality] = useState<NetworkQuality>('excelente');
  const [networkJitter, setNetworkJitter] = useState<number>(0);
  const [showLatencyDetails, setShowLatencyDetails] = useState<boolean>(false);

  // Estados para Monitoreo Transparente de Tokens y Presupuesto
  const [tokenStats, setTokenStats] = useState<TokenUsageStats>(() => tokenBudgetTracker.getStats());
  const [showTokenDetails, setShowTokenDetails] = useState<boolean>(false);

  useEffect(() => {
    const unsub = tokenBudgetTracker.subscribe((stats) => {
      setTokenStats(stats);
    });
    return () => unsub();
  }, []);

  // Estados para Inteligencia Tonal y Comprensión de Silencios (Paciencia Adaptativa)
  const [detectedTone, setDetectedTone] = useState<DetectedVoiceTone>('calmado');
  const [patienceMode, setPatienceMode] = useState<PatienceMode>('zen'); // 'zen' (2.6s), 'equilibrado' (1.8s), 'rapido' (0.9s)
  const [isUserThinking, setIsUserThinking] = useState(false);
  const [silenceProgress, setSilenceProgress] = useState(0);
  const silenceTimerRef = useRef<any>(null);
  const silenceProgressIntervalRef = useRef<any>(null);
  const pendingTranscriptRef = useRef<string>('');

  // Gestor Persistente de Conexión Live con Buffer Circular (useVoiceConnection)
  const voiceConn = useVoiceConnection({
    onUserTranscript: (transcript) => {
      if (!transcript.trim()) return;
      setLatestUserLiveText(transcript);
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
      setLatestChefLiveText((prev) => prev + chunk);
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
      setTimeout(() => setLatestChefLiveText(''), 7000);
    },
    onError: (errMsg) => {
      console.warn('Chef Cero: Error en Live API WebSocket persistente:', errMsg);
      setSpeechNotice(`Aviso Live: ${errMsg}. Continuando con auto-reconexión.`);
    },
    onLatencyMeasured: (rttMs, quality, jitterMs) => {
      setNetworkLatency(rttMs);
      setNetworkQuality(quality);
      setNetworkJitter(jitterMs);
    },
    onInterrupted: () => {
      setIsSpeaking(false);
      try {
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          navigator.vibrate([25]);
        }
      } catch (_) {}
    },
  });

  const isLiveActive = voiceConn.isLiveActive;
  const liveState = voiceConn.state;
  const voiceConnRef = useRef(voiceConn);
  voiceConnRef.current = voiceConn;

  // Estados para Sugerencias Proactivas y Memoria
  const [proactiveTip, setProactiveTip] = useState<{ tip: string; type: string; relatedMemory?: string } | null>(null);
  const [isLoadingProactiveTip, setIsLoadingProactiveTip] = useState(false);
  const [memoryFilter, setMemoryFilter] = useState<'todos' | 'fuego' | 'gustos' | 'equipamiento' | 'habito' | 'fortaleza'>('todos');

  const recognitionRef = useRef<any>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const autoListenTimeoutRef = useRef<any>(null);
  const isSpeakingRef = useRef<boolean>(false);
  const lastChefSpokenTextRef = useRef<string>('');

  // Pedir sugerencia proactiva del Chef según memorias, errores y contexto actual
  const handleRequestProactiveTip = async () => {
    try {
      setIsLoadingProactiveTip(true);
      const res = await fetch('/api/mentor/proactive-tip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userProfile,
          currentContext: liveRecipeContext || currentContext,
        }),
      });
      const data = await res.json();
      setProactiveTip(data);
    } catch (err) {
      console.warn('Chef Cero: Error obteniendo sugerencia proactiva:', err);
    } finally {
      setIsLoadingProactiveTip(false);
    }
  };

  // Medición de latencia de red continua vía ping ultraligero cuando no está en Live WS
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    const measureHttpPing = async () => {
      if (isLiveActive) return; // Si Live WS está conectado, mide continuamente mediante Ping/Pong WebSocket
      try {
        const t0 = performance.now();
        const res = await fetch('/api/live/ping', { cache: 'no-store' });
        if (res.ok && isMounted) {
          const rtt = Math.round(performance.now() - t0);
          setNetworkLatency(rtt);
          if (rtt > 350) setNetworkQuality('lenta');
          else if (rtt > 220) setNetworkQuality('moderada');
          else if (rtt > 100) setNetworkQuality('buena');
          else setNetworkQuality('excelente');
        }
      } catch (_) {}
    };

    measureHttpPing();
    const interval = setInterval(measureHttpPing, 3000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [isOpen, isLiveActive]);

  // Verificar disponibilidad de Gemini Live API en el backend
  useEffect(() => {
    fetch('/api/live/status')
      .then((r) => r.json())
      .then((data) => {
        setIsLiveAvailable(data?.available ?? false);
      })
      .catch(() => setIsLiveAvailable(false));
  }, []);

  /**
   * Detiene la sesión Live y desmantela limpiamente el grafo Web Audio DSP
   */
  const stopLiveSession = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    if (dspProcessorRef.current) {
      try {
        dspProcessorRef.current.disconnect();
      } catch (_) {}
      dspProcessorRef.current = null;
    }
    if (highpassFilterRef.current) {
      try {
        highpassFilterRef.current.disconnect();
      } catch (_) {}
      highpassFilterRef.current = null;
    }
    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.disconnect();
      } catch (_) {}
      sourceNodeRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      try {
        audioContextRef.current.close();
      } catch (_) {}
      audioContextRef.current = null;
    }

    voiceConn.disconnect();
    audioVisualizerBus.detach();
    tokenBudgetTracker.stopLiveSession();
    setIsGatePassingVoice(false);
    currentLiveUserMsgId.current = null;
    currentLiveChefMsgId.current = null;
    setLatestChefLiveText('');
    setLatestUserLiveText('');

  };

  /**
   * Inicia la sesión Live con la Web Audio API y el nodo DSP de Noise Gate & Cancelación de Eco Quirúrgica
   */
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

    try {
      // 1. Iniciar gestor de conexión persistente con buffer circular
      const ok = await voiceConn.connect();
      if (!ok) {
        setSpeechNotice('No se pudo conectar al canal en vivo persistente.');
        return;
      }

      tokenBudgetTracker.startLiveSession();

      // 2. Acceso a micrófono con restricciones de hardware para móviles (AEC nativa)
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        } as any,
      });
      mediaStreamRef.current = stream;

      // 3. Crear AudioContext con latencyHint interactiva de hardware
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const inputCtx = new AudioCtx({ latencyHint: 'interactive' });
      if (inputCtx.state === 'suspended') {
        await inputCtx.resume();
      }
      audioContextRef.current = inputCtx;

      // 4. Source Node desde el micrófono del teléfono
      const source = inputCtx.createMediaStreamSource(stream);
      sourceNodeRef.current = source;

      // Conectar el stream al bus del visualizador de forma de onda (waveform)
      audioVisualizerBus.attachStream(stream);

      // 5. Highpass Filter @ 85Hz: elimina zumbidos graves de extractores, estufas y vibraciones de mesada
      const highpass = inputCtx.createBiquadFilter();

      highpass.type = 'highpass';
      highpass.frequency.value = 85;
      highpass.Q.value = 0.707;
      highpassFilterRef.current = highpass;

      // 6. AnalyserNode para monitoreo de energía y animación reactiva del orbe
      const inputAnalyser = inputCtx.createAnalyser();
      inputAnalyser.fftSize = 256;
      inputAnalyser.smoothingTimeConstant = 0.8;
      inputAnalyserRef.current = inputAnalyser;

      // 7. Nodo DSP Noise Gate de Cocina con envolvente de ataque rápido y relajación suave
      const sampleRate = inputCtx.sampleRate;
      let gateEnvelope = 0;
      let holdCounter = 0;
      const attackStep = 1 / (sampleRate * 0.008); // 8ms ataque para no comer consonantes iniciales
      const releaseStep = 1 / (sampleRate * 0.160); // 160ms relajación suave para caída de voz natural
      const holdSamples = Math.round(sampleRate * 0.060); // 60ms retención
      const thresholdRms = 0.022; // Umbral calibrado de ruido de cocina (-42 dBFS aprox)

      const dspProcessor = inputCtx.createScriptProcessor(512, 1, 1);
      dspProcessorRef.current = dspProcessor;

      dspProcessor.onaudioprocess = (e) => {
        if (!voiceConnRef.current.isLiveActive) return;

        const inChannel = e.inputBuffer.getChannelData(0);
        const len = inChannel.length;

        // Calcular volumen eficaz (RMS)
        let sumSquares = 0;
        for (let i = 0; i < len; i++) {
          sumSquares += inChannel[i] * inChannel[i];
        }
        const rms = Math.sqrt(sumSquares / len);
        setLiveAudioLevel(Math.min(1, rms * 5));

        const isChefSpeaking = voiceConnRef.current.state === 'speaking';
        // Cancelación de eco acústico adaptativa: si el chef habla, el umbral es más riguroso para evitar bucles
        const effectiveThreshold = isChefSpeaking ? thresholdRms * 2.6 : thresholdRms;
        const isAbove = rms > effectiveThreshold;

        if (isAbove) {
          holdCounter = holdSamples;
          gateEnvelope = Math.min(1, gateEnvelope + attackStep * len * 8);
        } else if (holdCounter > 0) {
          holdCounter -= len;
        } else {
          gateEnvelope = Math.max(0, gateEnvelope - releaseStep * len * 4);
        }

        const gatePassing = gateEnvelope > 0.05;
        setIsGatePassingVoice(gatePassing);

        // Barge-in Quirúrgico: Si el usuario habla con firmeza mientras el chef responde, vaciar buffer de salida al instante
        if (isChefSpeaking && isAbove && rms > 0.06) {
          voiceConnRef.current.flushPlayback();
        }

        // Si el Noise Gate está abierto (pasa la voz y no el ruido de cocina), enviar audio PCM 16kHz
        if (gatePassing) {
          const processed = new Float32Array(len);
          for (let i = 0; i < len; i++) {
            processed[i] = inChannel[i] * gateEnvelope;
          }
          const pcm16 = downsampleTo16kHz(processed, sampleRate);
          voiceConnRef.current.sendAudioChunk(pcm16);
        }
      };

      // Conexión del grafo Web Audio DSP
      source.connect(highpass);
      highpass.connect(dspProcessor);
      dspProcessor.connect(inputAnalyser);

      // Conexión muda de seguridad para evitar que los navegadores recojan como basura el ScriptProcessorNode
      const silentGain = inputCtx.createGain();
      silentGain.gain.value = 0;
      dspProcessor.connect(silentGain);
      silentGain.connect(inputCtx.destination);

      setSpeechNotice(null);
    } catch (err: any) {
      console.warn('Chef Cero: Error iniciando Web Audio Live session:', err);
      setSpeechNotice(`Aviso Live: ${err?.message || err}. Usando modo estándar.`);
      stopLiveSession();
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

  // Initialize Web Speech Recognition con Paciencia Adaptativa (no responder al tiro en silencios)
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'es-419';

      recognition.onstart = () => {
        setIsListening(true);
        setSpeechNotice(null);
        audioVisualizerBus.setListening(true);
        audioVisualizerBus.requestMicStream().catch(() => {});
        window.dispatchEvent(new CustomEvent('chef-cero-voice-state', { detail: { isListening: true } }));
      };


      recognition.onresult = (event: any) => {
        // REGLA CRÍTICA ANTI-LOOP: Si el Chef está hablando o reproduciendo audio, ignorar el micrófono
        if (isSpeakingRef.current) {
          return;
        }

        const transcript = Array.from(event.results)
          .map((result: any) => result[0].transcript)
          .join('');

        // FILTRO DE ECO ACÚSTICO: Si el micrófono escucha las mismas palabras que dijo el Chef, descartar
        if (lastChefSpokenTextRef.current && transcript.trim().length > 6) {
          const normT = transcript.toLowerCase().trim();
          const normChef = lastChefSpokenTextRef.current.toLowerCase();
          if (normChef.includes(normT) || normT.includes(normChef)) {
            console.log('Chef Cero: Eco acústico del altavoz ignorado con éxito.');
            return;
          }
        }

        setInputQuery(transcript);
        pendingTranscriptRef.current = transcript;

        // Autoidentificación de Tono de Voz y Emoción Acústica en tiempo real
        const lower = transcript.toLowerCase();
        if (
          lower.includes('!') ||
          lower.includes('fuego') ||
          lower.includes('humo') ||
          lower.includes('se quema') ||
          lower.includes('se quemó') ||
          lower.includes('apaga') ||
          lower.includes('cuidado') ||
          lower.includes('urgente') ||
          lower.includes('auxilio') ||
          lower.includes('ayuda')
        ) {
          setDetectedTone('gritando_urgencia');
        } else if (
          lower.includes('?') ||
          lower.includes('cómo') ||
          lower.includes('cuándo') ||
          lower.includes('cuánto') ||
          lower.includes('por qué') ||
          lower.includes('será que') ||
          lower.includes('dime si') ||
          lower.includes('puedo')
        ) {
          setDetectedTone('pregunta');
        } else if (
          /(eh+|a ver|espera|esperate|déjame ver|y\s*$|pero\s*$|o sea\s*$|este\s*$)/i.test(transcript.trim())
        ) {
          setDetectedTone('pensando');
        } else {
          setDetectedTone('calmado');
        }

        // Limpiar temporizadores de silencio previos
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        if (silenceProgressIntervalRef.current) clearInterval(silenceProgressIntervalRef.current);

        // Ventana de paciencia adaptativa: No responder al tiro si hay una pausa natural para pensar
        let waitMs = patienceMode === 'zen' ? 2600 : patienceMode === 'equilibrado' ? 1800 : 900;
        // Si el usuario dijo una muletilla al final ("ehhh...", "a ver...", "espera..."), extender el tiempo de espera
        const hasFiller = /(eh+|a ver|espera|esperate|déjame ver|y\s*$|pero\s*$|o sea\s*$|este\s*$|cómo se llama\s*$)/i.test(
          transcript.trim()
        );
        if (hasFiller) {
          waitMs += 1400;
        }

        setIsUserThinking(true);
        const startTime = performance.now();

        silenceProgressIntervalRef.current = setInterval(() => {
          const elapsed = performance.now() - startTime;
          const pct = Math.min(100, Math.round((elapsed / waitMs) * 100));
          setSilenceProgress(pct);
        }, 50);

        silenceTimerRef.current = setTimeout(() => {
          clearInterval(silenceProgressIntervalRef.current);
          setIsUserThinking(false);
          setSilenceProgress(0);
          const finalQuery = pendingTranscriptRef.current.trim();
          if (finalQuery) {
            handleSendQuery(finalQuery);
          }
        }, waitMs);
      };

      recognition.onerror = (event: any) => {
        setIsListening(false);
        audioVisualizerBus.setListening(false);
        window.dispatchEvent(new CustomEvent('chef-cero-voice-state', { detail: { isListening: false } }));
        if (event.error === 'not-allowed') {
          setSpeechNotice('Acceso al micrófono denegado. Puedes escribir o tocar las consultas rápidas.');
        } else if (event.error === 'no-speech') {
          // Reposo silencioso
        } else {
          console.warn('Speech recognition notice:', event.error);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
        audioVisualizerBus.setListening(false);
        window.dispatchEvent(new CustomEvent('chef-cero-voice-state', { detail: { isListening: false } }));
      };

      recognitionRef.current = recognition;
    } else {
      setVoiceSupported(false);
    }

    return () => {
      stopSpeaking();
      audioVisualizerBus.setListening(false);
      window.dispatchEvent(new CustomEvent('chef-cero-voice-state', { detail: { isListening: false } }));

      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if (silenceProgressIntervalRef.current) clearInterval(silenceProgressIntervalRef.current);
      if (autoListenTimeoutRef.current) {
        clearTimeout(autoListenTimeoutRef.current);
      }
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (_) {}
      }
    };
  }, [patienceMode]);

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

    // Detener temporizadores de espera de silencio
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (silenceProgressIntervalRef.current) clearInterval(silenceProgressIntervalRef.current);
    setIsUserThinking(false);
    setSilenceProgress(0);

    // Si el modo Live está activo, enviar directo a través del canal en tiempo real
    if (isLiveActive) {
      setInputQuery('');
      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        sender: 'user',
        text,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, userMsg]);
      voiceConn.sendTextMessage(text);
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
          currentContext: liveRecipeContext || currentContext,
          detectedTone,
          patienceMode,
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
      lastChefSpokenTextRef.current = chefReplyText;

      // Abortar micrófono de inmediato mientras el Chef habla para evitar escuchar sus propios altavoces
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (_) {}
      }

      setIsSpeaking(true);
      isSpeakingRef.current = true;

      speakSpanishText(chefReplyText, {
        speaker: 'Chef Cero',
        badge: isSilent ? 'Modo Silencioso' : 'Voz Nativa en Vivo',
        audioBase64: data.audioBase64,
        audioMimeType: data.audioMimeType,
        onEnd: () => {
          setIsSpeaking(false);
          isSpeakingRef.current = false;
          // Si el modo conversación continua está activo y no es silencioso, esperar 1200ms para limpiar ecos antes de escuchar
          if (isContinuousMode && !isSilent) {
            autoListenTimeoutRef.current = setTimeout(() => {
              if (!isSpeakingRef.current) {
                startListeningSafe();
              }
            }, 1200);
          }
        },
      });
    } catch (err) {
      console.error('Chat error:', err);

      // Respuesta dinámica cálida y útil adaptada a la consulta (cero alarmismo ni bucle infinito)
      let fallbackText = 'Aquí estoy contigo. Para cualquier preparación, recuerda empezar con los ingredientes listos en platitos antes de prender el fuego. ¿Tienes alguna duda con la llama o los tiempos?';
      const q = text.toLowerCase();
      if (q.includes('papa') || q.includes('carne')) {
        fallbackText = '¡Excelente elección! Para unas papas fritas crujientes con carne: primero corta las papas en bastones y sécalas bien con un paño limpio para que doren crocantes. La carne séllala a fuego medio-alto 2 minutos por lado para que quede jugosa.';
      } else if (q.includes('arroz')) {
        fallbackText = 'Para el arroz blanco perfecto: 1 taza de arroz por 2 de agua caliente. Al hervir, pon fuego mínimo tapado por 20 minutos sin destapar.';
      } else if (q.includes('huevo')) {
        fallbackText = 'Para huevos revueltos cremosos: fuego bien bajo, revuelve suavemente con cuchara de madera y apaga la estufa cuando aún se vean brillantes.';
      }

      const fallbackMsg: ChatMessage = {
        id: String(Date.now() + 2),
        sender: 'chef',
        text: fallbackText,
        timestamp: 'Ahora',
      };
      setMessages((prev) => [...prev, fallbackMsg]);
      lastChefSpokenTextRef.current = fallbackText;

      // Abortar micrófono para no captar la voz del fallback
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (_) {}
      }

      setIsSpeaking(true);
      isSpeakingRef.current = true;

      speakSpanishText(fallbackMsg.text, {
        speaker: 'Chef Cero',
        badge: isSilent ? 'Modo Silencioso' : 'Voz Latinoamericana',
        isEmergency: false,
        onEnd: () => {
          setIsSpeaking(false);
          isSpeakingRef.current = false;
        },
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
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-lg text-white">Chef Cero en Vivo</h3>
                <span className="px-2 py-0.5 text-xs font-semibold bg-white/20 rounded-full text-white">
                  {isSilent ? 'Modo Silencioso' : 'Manos Libres'}
                </span>

                {/* Indicador de Tono de Voz y Estado Emocional Detectado */}
                <span
                  className={`px-2 py-0.5 rounded-lg text-xs font-bold flex items-center gap-1 transition border ${
                    detectedTone === 'gritando_urgencia'
                      ? 'bg-rose-950 text-rose-300 border-rose-500/80 animate-pulse'
                      : detectedTone === 'pensando'
                      ? 'bg-amber-950 text-amber-300 border-amber-500/80'
                      : detectedTone === 'pregunta'
                      ? 'bg-sky-950 text-sky-300 border-sky-500/80'
                      : 'bg-emerald-950 text-emerald-300 border-emerald-500/80'
                  }`}
                  title={`Tono de voz detectado: ${detectedTone}. El chef adapta su respuesta si preguntas, si gritas o si estás en calma.`}
                >
                  {detectedTone === 'gritando_urgencia' && '🚨 Urgencia'}
                  {detectedTone === 'pensando' && '💭 Pensando'}
                  {detectedTone === 'pregunta' && '❓ Pregunta'}
                  {detectedTone === 'calmado' && '🌿 Calmado'}
                </span>

                {/* Selector de Ritmo y Paciencia del Chef */}
                <div className="flex items-center gap-0.5 bg-black/25 p-0.5 rounded-lg text-[10px]">
                  <button
                    onClick={() => {
                      setPatienceMode('zen');
                    }}
                    title="Modo Zen: espera 2.6s de silencio para que pienses con calma antes de responder"
                    className={`px-1.5 py-0.5 rounded font-bold transition ${
                      patienceMode === 'zen' ? 'bg-white text-stone-900 shadow-2xs' : 'text-amber-100 hover:text-white'
                    }`}
                  >
                    🧘 Zen
                  </button>
                  <button
                    onClick={() => {
                      setPatienceMode('equilibrado');
                    }}
                    title="Modo Normal: espera 1.8s de silencio"
                    className={`px-1.5 py-0.5 rounded font-bold transition ${
                      patienceMode === 'equilibrado' ? 'bg-white text-stone-900 shadow-2xs' : 'text-amber-100 hover:text-white'
                    }`}
                  >
                    ⚖️ Normal
                  </button>
                  <button
                    onClick={() => {
                      setPatienceMode('rapido');
                    }}
                    title="Modo Rápido: espera 0.9s de silencio"
                    className={`px-1.5 py-0.5 rounded font-bold transition ${
                      patienceMode === 'rapido' ? 'bg-white text-stone-900 shadow-2xs' : 'text-amber-100 hover:text-white'
                    }`}
                  >
                    ⚡ Rápido
                  </button>
                </div>

                {/* Indicador Visual de Latencia de Red en Tiempo Real */}
                {networkLatency !== null && (
                  <button
                    onClick={() => setShowLatencyDetails((prev) => !prev)}
                    title={`Latencia de red en tiempo real: ${networkLatency}ms (${networkQuality}). Haz clic para ver el monitor técnico.`}
                    className={`px-2 py-0.5 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 transition border ${
                      networkQuality === 'excelente'
                        ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/50 hover:bg-emerald-900'
                        : networkQuality === 'buena'
                        ? 'bg-green-950/80 text-green-300 border-green-500/50 hover:bg-green-900'
                        : networkQuality === 'moderada'
                        ? 'bg-amber-950/80 text-amber-300 border-amber-500/50 hover:bg-amber-900'
                        : 'bg-rose-950/80 text-rose-300 border-rose-500/50 hover:bg-rose-900'
                    }`}
                  >
                    <span className="relative flex h-2 w-2">
                      <span
                        className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                          networkQuality === 'excelente'
                            ? 'bg-emerald-400'
                            : networkQuality === 'buena'
                            ? 'bg-green-400'
                            : networkQuality === 'moderada'
                            ? 'bg-amber-400'
                            : 'bg-rose-400'
                        }`}
                      ></span>
                      <span
                        className={`relative inline-flex rounded-full h-2 w-2 ${
                          networkQuality === 'excelente'
                            ? 'bg-emerald-400'
                            : networkQuality === 'buena'
                            ? 'bg-green-400'
                            : networkQuality === 'moderada'
                            ? 'bg-amber-400'
                            : 'bg-rose-400'
                        }`}
                      ></span>
                    </span>
                    <span>{networkLatency} ms</span>
                    <Activity className="w-3 h-3 opacity-80" />
                  </button>
                )}

                {/* Botón de Monitoreo Transparente de Tokens y Tiempo Estimado */}
                <button
                  onClick={() => setShowTokenDetails((prev) => !prev)}
                  title={`Presupuesto de Voz: ~${tokenBudgetTracker.getEstimatedMinutesRemaining(tokenStats)} min restantes (${tokenStats.totalTokensUsed.toLocaleString()} tokens). Clic para ver control de consumo.`}
                  className={`px-2 py-0.5 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 transition border ${
                    isLiveActive
                      ? 'bg-rose-950/90 text-rose-200 border-rose-500/60 hover:bg-rose-900'
                      : 'bg-amber-950/60 text-amber-200 border-amber-500/40 hover:bg-amber-900/80'
                  }`}
                >
                  <Coins className={`w-3.5 h-3.5 ${isLiveActive ? 'text-rose-400 animate-spin' : 'text-amber-400'}`} />
                  <span>~{tokenBudgetTracker.getEstimatedMinutesRemaining(tokenStats)} min</span>
                  <span className="text-[10px] text-amber-300/80 hidden sm:inline">
                    ({tokenStats.sessionTokensUsed > 0 ? `+${tokenStats.sessionTokensUsed}` : '0'})
                  </span>
                </button>
              </div>
              <p className="text-xs text-amber-100">
                {currentContext?.recipeTitle ? `Receta activa: ${currentContext.recipeTitle}` : 'Tu mentor de cocina en tiempo real'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Botón Sugerencia Proactiva del Chef */}
            <button
              onClick={handleRequestProactiveTip}
              disabled={isLoadingProactiveTip}
              title="Pedir una sugerencia anticipada basada en tus gustos, errores pasados y receta"
              className="px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 bg-amber-400 hover:bg-amber-300 text-stone-950 transition shadow-xs disabled:opacity-50"
            >
              <Sparkles className="w-3.5 h-3.5 text-stone-950" />
              <span className="hidden sm:inline">
                {isLoadingProactiveTip ? 'Pensando...' : 'Sugerencia'}
              </span>
            </button>
            {/* Toggle Modo Manos Sucias (Navegación de pasos por voz de latencia ultra-baja < 50ms) */}
            <button
              onClick={() => setIsDirtyHandsMode((prev) => !prev)}
              title={
                isDirtyHandsMode
                  ? 'Modo Manos Sucias ACTIVO (< 50ms latencia): di "Siguiente", "Anterior", "Repetir", "Tiempo" sin tocar la pantalla'
                  : 'Activar Modo Manos Sucias para controlar pasos de la receta por voz'
              }
              className={`px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition ${
                isDirtyHandsMode
                  ? 'bg-amber-400 text-stone-950 shadow-md ring-2 ring-amber-200'
                  : 'bg-white/20 hover:bg-white/30 text-white'
              }`}
            >
              <span className="text-sm">🖐️</span>
              <span className="hidden sm:inline">
                {isDirtyHandsMode ? 'Manos Sucias: ON' : 'Manos Sucias'}
              </span>
              <span className="sm:hidden">
                {isDirtyHandsMode ? 'Manos ON' : 'Manos'}
              </span>
            </button>

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

            {/* Botón de Tutorial WebSocket Client-to-Server */}
            <button
              onClick={() => setShowWsTutorial(true)}
              title="Ver tutorial de integración WebSocket Client-to-Server (bypassing backend) para Gemini Live"
              className="px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 bg-gradient-to-r from-indigo-700 to-purple-800 hover:from-indigo-600 hover:to-purple-700 text-white shadow-xs border border-indigo-400/30 cursor-pointer"
            >
              <span className="text-amber-300">⚡</span>
              <span className="hidden md:inline">Tutorial WebSocket</span>
              <span className="md:hidden">WS Tutorial</span>
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

        {/* Monitor de Latencia y Diagnóstico Técnico en Tiempo Real */}
        {showLatencyDetails && (
          <div className="bg-stone-950 border-b border-stone-800 text-stone-200 px-4 py-3 text-xs animate-in fade-in slide-in-from-top-1 shadow-inner">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-stone-800/80">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-400 animate-pulse" />
                <span className="font-extrabold text-white uppercase tracking-wider text-[11px]">
                  Monitor de Red y Latencia Física de Audio
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`px-2 py-0.5 rounded-full font-bold text-[10px] uppercase ${
                    networkQuality === 'excelente'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : networkQuality === 'buena'
                      ? 'bg-green-500/20 text-green-300 border border-green-500/40'
                      : networkQuality === 'moderada'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                  }`}
                >
                  Conexión {networkQuality}
                </span>
                <button
                  onClick={() => setShowLatencyDetails(false)}
                  className="text-stone-400 hover:text-stone-200 p-0.5"
                  title="Ocultar monitor de latencia"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 my-2">
              <div className="bg-stone-900/90 p-2 rounded-xl border border-stone-800">
                <div className="text-[10px] text-stone-400 font-semibold uppercase">Ping RTT Red</div>
                <div className="text-base font-black text-white font-mono mt-0.5 flex items-baseline gap-1">
                  {networkLatency} <span className="text-[10px] font-normal text-stone-400">ms</span>
                </div>
                <div className="text-[9px] text-stone-400 mt-0.5">Ida y vuelta al servidor</div>
              </div>

              <div className="bg-stone-900/90 p-2 rounded-xl border border-stone-800">
                <div className="text-[10px] text-stone-400 font-semibold uppercase">Búfer Audio</div>
                <div className="text-base font-black text-emerald-400 font-mono mt-0.5 flex items-baseline gap-1">
                  32 <span className="text-[10px] font-normal text-stone-400">ms</span>
                </div>
                <div className="text-[9px] text-stone-400 mt-0.5">512 muestras (16 kHz PCM)</div>
              </div>

              <div className="bg-stone-900/90 p-2 rounded-xl border border-stone-800">
                <div className="text-[10px] text-stone-400 font-semibold uppercase">Jitter de Red</div>
                <div className="text-base font-black text-amber-300 font-mono mt-0.5 flex items-baseline gap-1">
                  ±{networkJitter} <span className="text-[10px] font-normal text-stone-400">ms</span>
                </div>
                <div className="text-[9px] text-stone-400 mt-0.5">Estabilidad del flujo</div>
              </div>

              <div className="bg-stone-900/90 p-2 rounded-xl border border-stone-800">
                <div className="text-[10px] text-stone-400 font-semibold uppercase">Latencia Total Est.</div>
                <div className="text-base font-black text-cyan-300 font-mono mt-0.5 flex items-baseline gap-1">
                  ~{(networkLatency || 20) + 47} <span className="text-[10px] font-normal text-stone-400">ms</span>
                </div>
                <div className="text-[9px] text-stone-400 mt-0.5">Mínima física alcanzada</div>
              </div>
            </div>

            <div className="mt-2 text-[11px] leading-relaxed bg-black/40 p-2.5 rounded-lg border border-stone-800/60">
              {networkQuality === 'excelente' && (
                <p className="text-emerald-300">
                  ⚡ <strong>Conexión Excelente ({networkLatency} ms):</strong> Tu red responde al instante. La conversación con Gemini Live 3.8 y el Modo Manos Sucias se transmiten con fluidez instantánea en tiempo real.
                </p>
              )}
              {networkQuality === 'buena' && (
                <p className="text-green-300">
                  ✨ <strong>Conexión Buena ({networkLatency} ms):</strong> Audio sin pérdidas y respuestas rápidas. La latencia total ronda los ~150 ms, prácticamente indistinguible de una llamada de voz.
                </p>
              )}
              {networkQuality === 'moderada' && (
                <p className="text-amber-300">
                  ⏱️ <strong>Conexión Moderada ({networkLatency} ms):</strong> Puede haber una breve pausa de 200 a 300 ms antes de que el Chef empiece a hablar debido a la latencia de tu red WiFi o datos móviles.
                </p>
              )}
              {networkQuality === 'lenta' && (
                <p className="text-rose-300">
                  📶 <strong>Conexión Lenta ({networkLatency} ms):</strong> Tu red presenta congestión temporal. El sistema mantiene activado el micro-búfer adaptativo para evitar que el audio se corte o se entrecorte.
                </p>
              )}
            </div>
          </div>
        )}

        {/* Panel Desplegable de Monitoreo Transparente de Tokens y Presupuesto */}
        {showTokenDetails && (
          <div className="bg-stone-900 border-b border-stone-800 p-4 animate-in fade-in slide-in-from-top-1 shadow-xl">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-stone-800">
              <div className="flex items-center gap-2">
                <Coins className="w-4 h-4 text-amber-400" />
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                  Consumo Transparente de Recursos en Sesión
                </h4>
              </div>
              <button
                onClick={() => setShowTokenDetails(false)}
                className="text-stone-400 hover:text-white p-1 text-xs"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <TokenBudgetMonitor
              isLiveActive={isLiveActive}
              compact={false}
              showTips={true}
            />
          </div>
        )}

        {/* Panel Dedicado de Modo Manos Sucias (Ultra-Baja Latencia < 50ms para navegación de pasos) */}
        {isDirtyHandsMode && (
          <div className="bg-gradient-to-r from-amber-600 via-amber-700 to-orange-700 text-white px-4 py-3 border-b border-amber-600 shadow-md">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <span className="p-1.5 bg-black/25 rounded-xl text-lg shrink-0">🖐️</span>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-extrabold text-xs sm:text-sm uppercase tracking-wide">
                      Modo Manos Sucias Activo
                    </h4>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white text-stone-900 shadow-2xs">
                      Latencia &lt; 50ms
                    </span>
                  </div>
                  <p className="text-[11px] text-amber-100 mt-0.5 font-medium">
                    {liveRecipeContext?.recipeTitle
                      ? `Receta: ${liveRecipeContext.recipeTitle} • Paso ${liveRecipeContext.stepNumber || 1}${liveRecipeContext.totalSteps ? ` de ${liveRecipeContext.totalSteps}` : ''}`
                      : 'Controla la navegación de la receta mediante comandos de voz sencillos sin tocar la pantalla'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="relative flex h-2.5 w-2.5 mr-1">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400"></span>
                </span>
                <span className="text-[11px] font-bold bg-black/25 px-2 py-1 rounded-lg text-emerald-200">
                  Escuchando comandos
                </span>
              </div>
            </div>

            {/* Atajos de comandos por voz */}
            <div className="mt-2.5 pt-2 border-t border-white/20 flex flex-wrap items-center gap-1.5 text-[11px]">
              <span className="text-amber-200 font-semibold text-[10px] uppercase">Dí en voz alta:</span>
              <span className="bg-black/30 px-2 py-0.5 rounded-md font-mono font-bold text-amber-200">"Siguiente"</span>
              <span className="bg-black/30 px-2 py-0.5 rounded-md font-mono font-bold text-amber-200">"Anterior"</span>
              <span className="bg-black/30 px-2 py-0.5 rounded-md font-mono font-bold text-amber-200">"Repetir"</span>
              <span className="bg-black/30 px-2 py-0.5 rounded-md font-mono font-bold text-amber-200">"Tiempo"</span>
              <span className="bg-black/30 px-2 py-0.5 rounded-md font-mono font-bold text-amber-200">"Pausa"</span>
              <span className="bg-red-900/60 text-red-200 px-2 py-0.5 rounded-md font-mono font-bold">"S.O.S."</span>
            </div>

            {/* Alerta de comando detectado y ejecutado al instante */}
            {dirtyHandsLastCommand && (
              <div className="mt-2.5 bg-emerald-400 text-stone-950 font-extrabold px-3 py-1.5 rounded-xl text-xs flex items-center justify-between shadow-lg animate-in fade-in slide-in-from-top-1">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 fill-stone-950" />
                  <span>¡Comando ejecutado al instante: "{dirtyHandsLastCommand.command.toUpperCase()}"!</span>
                </div>
                <span className="text-[10px] bg-stone-950 text-emerald-300 px-1.5 py-0.5 rounded font-mono">
                  &lt; 50 ms
                </span>
              </div>
            )}
          </div>
        )}

        {/* Orbe Reactivo Dual con AnalyserNode, Cancelación de Eco y Noise Gate de Cocina */}
        {isLiveActive && (
          <ReactiveLiveOrb
            isLiveActive={isLiveActive}
            connectionState={voiceConn.state}
            inputAnalyser={inputAnalyserRef.current}
            outputAnalyser={voiceConn.outputAnalyser}
            isNoiseGateActive={true}
            isGatePassingVoice={isGatePassingVoice}
            networkLatency={voiceConn.networkLatency}
            networkQuality={voiceConn.networkQuality}
            onBargeIn={() => voiceConn.flushPlayback()}
            latestChefText={latestChefLiveText}
            latestUserText={latestUserLiveText}
          />
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
          <div className="bg-amber-50/90 border-b border-amber-200 p-4 max-h-72 overflow-y-auto animate-in slide-in-from-top-3 duration-200 text-xs text-stone-800">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <Brain className="w-4 h-4 text-amber-700" />
                <h4 className="font-bold text-amber-950 uppercase tracking-wide text-[11px]">
                  Cerebro del Chef: Lo que he aprendido de ti
                </h4>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleRequestProactiveTip}
                  disabled={isLoadingProactiveTip}
                  className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-[11px] flex items-center gap-1 transition shadow-2xs"
                >
                  <Sparkles className="w-3 h-3" />
                  <span>{isLoadingProactiveTip ? 'Analizando...' : 'Pedir sugerencia'}</span>
                </button>
              </div>
            </div>

            {/* Filtro de Categorías de Aprendizaje */}
            <div className="flex flex-wrap gap-1 mb-2.5">
              {(['todos', 'fuego', 'gustos', 'equipamiento', 'habito', 'fortaleza'] as const).map((cat) => (
                <button
                  key={cat}
                  onClick={() => setMemoryFilter(cat)}
                  className={`px-2 py-0.5 rounded-md font-bold text-[10px] uppercase transition ${
                    memoryFilter === cat
                      ? 'bg-amber-700 text-white shadow-xs'
                      : 'bg-amber-100/80 hover:bg-amber-200 text-amber-900'
                  }`}
                >
                  {cat === 'todos' && 'Todos'}
                  {cat === 'fuego' && '🔥 Fuego'}
                  {cat === 'gustos' && '🧂 Gustos'}
                  {cat === 'equipamiento' && '🍳 Equipo'}
                  {cat === 'habito' && '💡 Hábitos'}
                  {cat === 'fortaleza' && '⭐ Fortalezas'}
                </button>
              ))}
            </div>

            {(!userProfile.evolutionaryMemories || userProfile.evolutionaryMemories.length === 0) ? (
              <p className="text-stone-500 italic py-2">
                Aún no hay notas aprendidas. El Chef irá registrando tus gustos, errores superados y utensilios mientras conversas.
              </p>
            ) : (
              <div className="space-y-1.5 mb-3">
                {userProfile.evolutionaryMemories
                  .filter((m) => memoryFilter === 'todos' || m.category === memoryFilter)
                  .map((m) => (
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
                placeholder="Ej: Solo tengo cocina eléctrica, no uso cilantro, cocino para dos..."
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

        {/* Tarjeta de Sugerencia Proactiva del Chef */}
        {proactiveTip && (
          <div className="mx-4 mt-3 p-3 bg-gradient-to-r from-amber-500 via-amber-600 to-orange-600 text-white rounded-2xl shadow-md border border-amber-400 text-xs animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center justify-between pb-1.5 border-b border-white/20">
              <div className="flex items-center gap-1.5 font-black uppercase tracking-wider text-[11px]">
                <Sparkles className="w-4 h-4 text-yellow-200 animate-spin" />
                <span>Sugerencia Proactiva del Chef</span>
              </div>
              <button
                onClick={() => setProactiveTip(null)}
                className="text-white/80 hover:text-white p-0.5"
                title="Cerrar sugerencia"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="mt-2 text-sm font-semibold leading-snug text-amber-50">
              {proactiveTip.tip}
            </p>
            <div className="mt-2.5 flex items-center gap-2 flex-wrap">
              <button
                onClick={() => handleReplayAudio(proactiveTip.tip)}
                className="px-2.5 py-1 bg-white/20 hover:bg-white/30 text-white font-bold rounded-lg text-[11px] flex items-center gap-1 transition"
              >
                <Volume2 className="w-3 h-3" />
                <span>Escuchar consejo</span>
              </button>
              <button
                onClick={() => handleQuickAction(`Chef, sobre tu sugerencia: "${proactiveTip.tip}", ¿cómo la aplico en este momento?`)}
                className="px-2.5 py-1 bg-white text-stone-900 hover:bg-amber-50 font-bold rounded-lg text-[11px] flex items-center gap-1 transition shadow-xs"
              >
                <MessageSquare className="w-3 h-3" />
                <span>Profundizar en esto</span>
              </button>
            </div>
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

        {/* Indicador de Silencio y Comprensión de Pausas de Pensamiento */}
        {isUserThinking && inputQuery.trim().length > 0 && (
          <div className="px-4 py-2 bg-gradient-to-r from-amber-50 to-orange-50 border-t border-amber-200 text-xs text-amber-950 flex items-center justify-between animate-in fade-in">
            <div className="flex items-center gap-2.5 flex-1 mr-3">
              <span className="text-base animate-pulse">💭</span>
              <div className="flex-1">
                <div className="flex items-center justify-between text-[11px] font-bold text-amber-900 mb-1">
                  <span>El Chef entiende tus silencios... Tómate tu tiempo para pensar</span>
                  <span className="font-mono text-[10px] text-amber-700 font-semibold">
                    {patienceMode === 'zen' ? 'Ritmo Zen (2.6s)' : patienceMode === 'equilibrado' ? 'Ritmo Normal (1.8s)' : 'Ritmo Rápido (0.9s)'}
                  </span>
                </div>
                <div className="w-full bg-amber-200/80 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-amber-600 h-full transition-all duration-75 ease-linear rounded-full"
                    style={{ width: `${silenceProgress}%` }}
                  />
                </div>
              </div>
            </div>
            <button
              onClick={() => {
                if (pendingTranscriptRef.current) {
                  handleSendQuery(pendingTranscriptRef.current);
                }
              }}
              className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-xs shrink-0"
              title="Responder de inmediato sin esperar a que termine el tiempo de silencio"
            >
              <Zap className="w-3 h-3" />
              <span>Responder ya</span>
            </button>
          </div>
        )}

        {/* Status banner when listening in continuous hands-free mode */}
        {isListening && (
          <div className="px-4 py-2 bg-red-50 border-t border-red-200 flex items-center justify-between text-xs text-red-900 animate-in fade-in">
            <div className="flex items-center gap-2 font-medium">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-600"></span>
              </span>
              <span>
                <strong>El Chef te escucha en vivo:</strong> Habla con calma a tu ritmo (o di <em>"gracias"</em> / <em>"pausa"</em> para reposar).
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

      {/* Modal del Tutorial de WebSocket Client-to-Server */}
      <DirectWebSocketTutorialModal
        isOpen={showWsTutorial}
        onClose={() => setShowWsTutorial(false)}
      />
    </div>
  );
};

