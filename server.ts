import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import { GoogleGenAI, Type, Modality } from '@google/genai';
import { WebSocketServer, WebSocket } from 'ws';
import webpush from 'web-push';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '15mb' }));

// Web Push (VAPID) configuration con persistencia en archivo para evitar invalidar suscripciones al reiniciar
const vapidEmail = 'mailto:chefcero@app.local';
let vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
let vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;

if (!vapidPublicKey || !vapidPrivateKey) {
  const vapidFilePath = path.join(process.cwd(), '.vapid.json');
  try {
    if (fs.existsSync(vapidFilePath)) {
      const stored = JSON.parse(fs.readFileSync(vapidFilePath, 'utf8'));
      if (stored.publicKey && stored.privateKey) {
        vapidPublicKey = stored.publicKey;
        vapidPrivateKey = stored.privateKey;
      }
    }
  } catch (readErr) {
    console.warn('Chef Cero: Error leyendo .vapid.json existente:', readErr);
  }

  if (!vapidPublicKey || !vapidPrivateKey) {
    const generated = webpush.generateVAPIDKeys();
    vapidPublicKey = generated.publicKey;
    vapidPrivateKey = generated.privateKey;
    try {
      fs.writeFileSync(
        vapidFilePath,
        JSON.stringify({ publicKey: vapidPublicKey, privateKey: vapidPrivateKey }, null, 2)
      );
      console.log('Chef Cero: Guardadas claves VAPID persistentes en .vapid.json');
    } catch (saveErr) {
      console.warn('Chef Cero: No se pudo guardar .vapid.json:', saveErr);
    }
  }
}

try {
  webpush.setVapidDetails(vapidEmail, vapidPublicKey, vapidPrivateKey);
} catch (vapidErr) {
  console.warn('Chef Cero: VAPID setup notice:', vapidErr);
}

// Stores for Web Push subscriptions & scheduled background timers
const subscriptionsMap = new Map<string, webpush.PushSubscription>();

interface ScheduledPushTimer {
  timerId: string;
  label: string;
  recipeTitle?: string;
  scheduledFor: number;
  timeoutHandle: NodeJS.Timeout;
  subscriptionEndpoint?: string;
}
const scheduledTimers = new Map<string, ScheduledPushTimer>();

// Lazy GoogleGenAI initialization
let aiClient: GoogleGenAI | null = null;
function getAi(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn('GEMINI_API_KEY is not defined in environment variables. Falling back to default assistant responses.');
    }
    aiClient = new GoogleGenAI({
      apiKey: apiKey || '',
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

// Helper seguro para parsear respuestas JSON generadas por Gemini
function safeParseGeminiJson<T>(rawText: string | undefined | null, fallback: T): T {
  if (!rawText) return fallback;
  const trimmed = rawText.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    // 1. Eliminar bloques de código markdown ```json ... ```
    try {
      const stripped = trimmed.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
      return JSON.parse(stripped);
    } catch {}

    // 2. Extraer el primer objeto o array JSON válido encontrado
    try {
      const match = trimmed.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
      if (match) {
        return JSON.parse(match[0]);
      }
    } catch {}

    console.warn('Chef Cero: No se pudo parsear salida JSON de Gemini, usando fallback seguro');
    return fallback;
  }
}

// Resilient helper that handles model overload (503 / 429 / spikes) with model fallback
async function callGeminiWithFallback(ai: GoogleGenAI, request: {
  contents: any;
  config?: any;
}) {
  const models = ['gemini-3.8-flash', 'gemini-3.1-flash-lite', 'gemini-flash-latest'];
  let lastError: any = null;

  for (const model of models) {
    try {
      const response = await ai.models.generateContent({
        ...request,
        model,
      });
      return response;
    } catch (err: any) {
      lastError = err;
      const errMsg = String(err?.message || err);
      console.warn(`Chef Cero: Modelo ${model} no disponible o sobrecargado (${errMsg.slice(0, 110)}). Evaluando respaldo...`);
      // Si el error es de sintaxis o schema fatal no reintentar a ciegas, pero para 503/429/high demand/unavailable sí
      const isTransient =
        errMsg.includes('503') ||
        errMsg.includes('UNAVAILABLE') ||
        errMsg.includes('high demand') ||
        errMsg.includes('overloaded') ||
        errMsg.includes('RESOURCE_EXHAUSTED') ||
        errMsg.includes('429');

      if (!isTransient && !errMsg.includes('not found') && !errMsg.includes('temporarily')) {
        throw err;
      }
      // Breve pausa para amortiguar picos de demanda
      await new Promise((resolve) => setTimeout(resolve, 350));
    }
  }

  throw lastError;
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
    vapidConfigured: Boolean(vapidPublicKey),
    time: new Date().toISOString(),
  });
});

// --- Web Push Notifications API ---

// 1. Obtener la clave pública VAPID para el navegador
app.get('/api/notifications/vapid-public-key', (req, res) => {
  res.json({
    publicKey: vapidPublicKey,
  });
});

// 2. Registrar subscripción Push del navegador
app.post('/api/notifications/subscribe', (req, res) => {
  try {
    const { subscription } = req.body;
    if (!subscription || !subscription.endpoint) {
      return res.status(400).json({ error: 'Subscripción inválida' });
    }

    subscriptionsMap.set(subscription.endpoint, subscription);
    return res.json({
      success: true,
      message: 'Subscripción registrada exitosamente para alertas en segundo plano.',
    });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Error al guardar subscripción' });
  }
});

// 3. Programar temporizador de cocina en segundo plano
app.post('/api/notifications/schedule-timer', (req, res) => {
  try {
    const { timerId, label, seconds, recipeTitle, subscription } = req.body;
    if (!timerId || seconds === undefined) {
      return res.status(400).json({ error: 'Parámetros timerId y seconds requeridos' });
    }

    // Si viene la subscripción, la guardamos o actualizamos
    if (subscription && subscription.endpoint) {
      subscriptionsMap.set(subscription.endpoint, subscription);
    }

    // Cancelar temporizador previo con este ID si existía
    if (scheduledTimers.has(timerId)) {
      clearTimeout(scheduledTimers.get(timerId)!.timeoutHandle);
      scheduledTimers.delete(timerId);
    }

    const durationSeconds = Math.max(0, Math.round(Number(seconds)));
    const delayMs = durationSeconds * 1000;
    const targetScheduledTime = Date.now() + delayMs;

    const timeoutHandle = setTimeout(async () => {
      scheduledTimers.delete(timerId);

      const payload = JSON.stringify({
        title: '⏰ ¡Tiempo cumplido en Chef Cero!',
        body: `El temporizador para "${label || 'tu cocción'}" (${recipeTitle || 'Cocina en curso'}) ha terminado. ¡Revisa tu sartén u olla!`,
        icon: '/icon.svg',
        badge: '/icon.svg',
        tag: `timer-${timerId}`,
        data: {
          timerId,
          label,
          recipeTitle,
          url: '/',
          completedAt: new Date().toISOString(),
        },
      });

      // Asegurar que la subscripción esté en el mapa activo
      if (subscription?.endpoint) {
        subscriptionsMap.set(subscription.endpoint, subscription);
      }

      // Enviar a todas las subscripciones registradas (o a la específica si es la única)
      const targets = subscriptionsMap.size > 0 
        ? Array.from(subscriptionsMap.values()) 
        : (subscription?.endpoint ? [subscription] : []);

      for (const sub of targets) {
        try {
          await webpush.sendNotification(sub, payload);
        } catch (pushErr: any) {
          console.warn('Chef Cero: Error al enviar push a suscriptor:', pushErr?.statusCode, pushErr?.message);
          if (pushErr?.statusCode === 410 || pushErr?.statusCode === 404) {
            subscriptionsMap.delete(sub.endpoint);
          }
        }
      }
    }, delayMs);

    scheduledTimers.set(timerId, {
      timerId,
      label,
      recipeTitle,
      scheduledFor: targetScheduledTime,
      timeoutHandle,
      subscriptionEndpoint: subscription?.endpoint,
    });

    return res.json({
      success: true,
      message: `Temporizador "${label}" programado para alerta push en ${durationSeconds} segundos.`,
      targetScheduledTime,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Error programando temporizador push' });
  }
});

// 4. Cancelar o pausar temporizador push programado
app.post('/api/notifications/cancel-timer', (req, res) => {
  try {
    const { timerId } = req.body;
    if (!timerId) {
      return res.status(400).json({ error: 'timerId requerido' });
    }

    if (scheduledTimers.has(timerId)) {
      clearTimeout(scheduledTimers.get(timerId)!.timeoutHandle);
      scheduledTimers.delete(timerId);
    }

    return res.json({
      success: true,
      message: `Temporizador ${timerId} cancelado en el servidor push.`,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Error cancelando temporizador push' });
  }
});

// 5. Enviar notificación push de prueba
app.post('/api/notifications/test', async (req, res) => {
  try {
    const { subscription } = req.body;
    const targetSub = (subscription && subscription.endpoint) 
      ? subscription 
      : subscriptionsMap.values().next().value;

    if (!targetSub) {
      return res.status(400).json({ 
        error: 'No hay subscripción push activa registrada en el navegador para recibir pruebas.' 
      });
    }

    const payload = JSON.stringify({
      title: '🔔 ¡Prueba de Chef Cero exitosa!',
      body: 'Tus alertas en segundo plano están 100% activas. Te avisaremos puntualmente cuando terminen tus ollas y sartenes.',
      icon: '/icon.svg',
      badge: '/icon.svg',
      tag: 'chef-cero-test',
      data: { url: '/', test: true },
    });

    await webpush.sendNotification(targetSub, payload);
    return res.json({ success: true, message: 'Notificación push de prueba enviada con éxito.' });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Error enviando notificación de prueba' });
  }
});

// 1. Hands-free cooking voice & chat assistant
app.post('/api/chat', async (req, res) => {
  // Helper de respaldo dinámico en español latinoamericano (para cuando no hay API key o hay fallo de red)
  const generateDynamicFallback = (rawText: string) => {
    const q = rawText.toLowerCase();
    let reply = '';
    let safetyAlert: string | null = null;
    let timerSecondsRequested = 0;
    let timerLabel = '';
    let heatAdjustment = 'mantener';

    if (q.includes('aceite') && (q.includes('humo') || q.includes('fuego') || q.includes('quema') || q.includes('salpica'))) {
      reply = '¡RETIRA LA SARTÉN DEL FUEGO INMEDIATAMENTE hacia una hornilla apagada! Nunca le eches agua al aceite caliente porque salpicará violentamente. Tápala con una tapa metálica para ahogar el calor y déjala enfriar en paz.';
      safetyAlert = '¡ALERTA DE FUEGO! Retira la sartén del calor de inmediato. NUNCA uses agua.';
      heatAdjustment = 'apagar';
    } else if (q.includes('minuto') || q.includes('tiempo') || q.includes('temporizador') || q.includes('alarma')) {
      const match = q.match(/\b(\d+)\b/);
      const minutes = match ? parseInt(match[1], 10) : 5;
      timerSecondsRequested = minutes * 60;
      timerLabel = `Tiempo ${minutes} min`;
      const timerResponses = [
        `¡Listo! Ya activé tu temporizador de ${minutes} minutos. Mantén la hornilla a fuego moderado y yo te aviso cuando esté a punto.`,
        `Temporizador de ${minutes} minutos corriendo. Aprovecha para ordenar tu mesa o vigilar que el líquido no hierva a borbotones.`,
        `He puesto la cuenta regresiva de ${minutes} minutos. Si sientes que empieza a dorar muy rápido, baja la flama un punto.`,
      ];
      reply = timerResponses[Math.floor(Math.random() * timerResponses.length)];
    } else if (q.includes('arroz')) {
      const riceTips = [
        'Para que el arroz te quede bien desgranado: la proporción clásica es 1 taza de arroz por 2 de agua caliente. Cuando empiece a hervir, baja el fuego al mínimo, tápalo bien y déjalo 20 minutos sin destapar ni revolver.',
        'Si el arroz se te está pegando o quemando en el fondo, apaga el fuego de inmediato, retira la olla y déjala tapada sobre una superficie fría 5 minutos. El vapor residual soltará el grano sin sabor a quemado.',
        'Si sientes que el arroz quedó un poquito duro y ya no hay agua, agrega 3 a 4 cucharadas de agua hirviendo por los bordes, tapa bien y déjalo a fuego mínimo otros 3 minutos.',
      ];
      reply = riceTips[Math.floor(Math.random() * riceTips.length)];
    } else if (q.includes('pasta') || q.includes('fideo') || q.includes('tallarines')) {
      reply = 'Pon el agua a hervir a borbotones con buena sal antes de echar la pasta. No le eches aceite al agua porque la salsa resbalará después. Y un truco clave: guarda media taza del agua de cocción antes de colar para mezclarla con la salsa y que quede cremosa.';
    } else if (q.includes('pollo') || q.includes('carne')) {
      reply = 'Para saber si el pollo está cocido por dentro sin cortarlo todo: pincha la parte más gruesa con un tenedor o cuchillo. El jugo que brota debe ser completamente transparente. Si sale rosado, baja el fuego a medio-bajo, tapa la sartén y dale 3 a 5 minutos más.';
    } else if (q.includes('salado') || q.includes('sal')) {
      reply = 'Si te quedó un poco salado: agrega unas gotas de jugo de limón fresco o una cucharadita de vinagre suave; la acidez engaña al paladar y equilibra la sal. Si es un guiso o sopa, echa una papa pelada cortada en cuartos para que absorba el exceso.';
    } else if (q.includes('cebolla') || q.includes('sofrito')) {
      reply = 'El secreto de un sofrito dulce y suave es la paciencia: cocina la cebolla a fuego muy bajo con una pizca de sal durante unos 8 a 10 minutos. Debe ponerse transparente y tierna, nunca café oscuro de golpe porque amarga.';
    } else if (q.includes('ajo')) {
      reply = '¡Ojo con el ajo! Se quema en apenas 20 segundos a fuego fuerte y se vuelve amargo. Agrégalo siempre cuando la cebolla ya esté tierna y con el fuego medio o bajo, revolviendo constantemente.';
    } else if (q.includes('huevo') || q.includes('omelette')) {
      reply = 'Para unos huevos revueltos cremosos de restaurante: cocínalos a fuego bien bajito con una nuez de mantequilla o chorrito de aceite, revolviendo suavemente con cuchara de madera. Apaga la estufa cuando todavía se vean húmedos y brillantes.';
    } else if (q.includes('sartén') || q.includes('pega') || q.includes('pego')) {
      reply = 'Si la comida se pegó al fondo de la sartén: baja el fuego a mínimo, echa dos cucharadas de agua caliente o caldo y raspa suavemente con espátula de madera. Ese fondo dorado se llama desglasado y tiene muchísimo sabor concentrado.';
    } else if (q.includes('fuego') || q.includes('llama') || q.includes('calor')) {
      reply = 'Como regla general: ante cualquier duda o apuro, baja la llama al mínimo. El fuego bajo te da tiempo para pensar, mirar y oler sin riesgo de que se te queme nada.';
    } else {
      const generalLatinAdvice = [
        'Dime exactamente qué ingrediente tienes en la sartén o qué estás notando (olor, color o sonido), y te guío paso a paso.',
        'Aquí estoy contigo. Recuerda: cocinar no es correr, es prestar atención a los aromas y controlar la llama. ¿Qué duda tienes en este momento?',
        'Cuéntame en qué paso de la receta estás o si quieres saber cómo sustituir algún ingrediente con lo que tengas en tu alacena.',
        'Tranquilo, todo tiene solución en la cocina. ¿Ves mucho hervor, notas que le falta cocción o quieres medir algún condimento?',
      ];
      reply = generalLatinAdvice[Math.floor(Math.random() * generalLatinAdvice.length)];
    }

    return {
      reply,
      safetyAlert,
      timerSecondsRequested,
      timerLabel,
      heatAdjustment,
    };
  };

  try {
    const { message, userProfile, currentContext, history, detectedTone, patienceMode } = req.body;
    if (!message) {
      return res.status(400).json({ error: 'Mensaje requerido' });
    }

    const ai = getAi();
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.json(generateDynamicFallback(message));
    }

    const userMistakes = userProfile?.pastMistakes?.length
      ? userProfile.pastMistakes.join(', ')
      : 'Novato sin historial previo';
    const userLevel = userProfile?.levelTitle || 'Nivel 1: Principiante Total';
    const userMemories = Array.isArray(userProfile?.evolutionaryMemories) && userProfile.evolutionaryMemories.length > 0
      ? userProfile.evolutionaryMemories.map((m: any) => `• [${m.category || 'general'}]: ${m.fact}`).join('\n')
      : 'El aprendiz recién está comenzando. Aún no tienes memorias previas registradas.';

    let toneInstruction = '';
    if (detectedTone === 'gritando_urgencia') {
      toneInstruction = `ESTADO DE ALERTA: EL USUARIO ESTÁ GRITANDO O EN MÁXIMA URGENCIA (humo, fuego, quemadura, desborde).
- Responde de forma ULTRA DIRECTA, CONCISA (1 o 2 oraciones máximo) y TRANQUILIZADORA.
- Si hay peligro, ordena con amabilidad y firmeza: "¡APAGA LA HORNILLA YA Y APARTA LA SARTÉN DEL FUEGO!". Luego ayúdalo a respirar sin regañarlo.`;
    } else if (detectedTone === 'pensativo') {
      toneInstruction = `ESTADO DE PENSAMIENTO / PAUSA REFLEXIVA: El usuario hizo pausas, pensó con calma o reflexionó.
- Agradece su calma, valida su pensamiento y dale una respuesta suave, cariñosa y pausada. Demuéstrale que cocinar con calma y pensando cada paso es de los mejores hábitos.`;
    } else if (detectedTone === 'pregunta') {
      toneInstruction = `ESTADO DE CURIOSIDAD / PREGUNTA: El usuario hace una pregunta sobre técnica o ingredientes.
- Responde de forma muy pedagógica, con un truco práctico fácil de recordar y una analogía cotidiana.`;
    } else {
      toneInstruction = `ESTADO CALMADO: Conversa con naturalidad, calidez y compañerismo de cocina en español latinoamericano.`;
    }

    const systemInstruction = `Eres "Chef Cero", un mentor culinario de voz cálido, paciente, pedagógico y cercano.
IDIOMA Y TONO:
- Habla SIEMPRE en ESPAÑOL LATINOAMERICANO neutro y claro (usa vocabulario común en Latinoamérica: 'estufa/hornilla', 'sartén', 'fuego bajo/medio/alto', 'revolver', 'picar', 'probar', 'alacena/despensa').
- NUNCA uses modismos peninsulares de España como 'vosotros', 'fogón', 'sois', ni tecnicismos culinarios franceses sin explicarlos de forma cotidiana.
- Sé ULTRA CONVERSACIONAL, dinámico y empático. Conversa como un amigo chef que está de pie junto al usuario en la mesada de la cocina.
- NUNCA comiences todas las respuestas con frases cliché como "Respira hondo" o "¡Hola!". Varía tus respuestas naturalmente.
- Tu máxima prioridad es la SEGURIDAD personal y evitar que se queme la comida o la sartén.

DIRECTRICES DE RAZONAMIENTO CULINARIO:
1. FILOSOFÍA DE DESPENSA INTELIGENTE (Pantry-First):
   - Al recibir la lista de ingredientes del usuario (por voz o texto), sugiere exclusivamente recetas ejecutables con lo que tiene a mano, sin obligar al usuario a salir a comprar.
   - Asume por defecto una "despensa básica universal" disponible (sal, pimienta, agua corriente y aceite de cocina básico), a menos que el usuario especifique que carece de alguno de ellos.
2. PROTOCOLO DE SUSTITUCIÓN DINÁMICA:
   - Si una receta tradicional requiere un elemento faltante no esencial, sugiere de inmediato por voz una sustitución viable utilizando los ingredientes ya inventariados en la sesión o alacena común.
3. PERSISTENCIA DE ESTADO Y GUÍA PASO A PASO:
   - Mantén inmutables los ingredientes confirmados durante toda la interacción culinaria.
   - Guía siempre paso a paso. Si el usuario interrumpe con una duda lateral (ej: técnicas de corte o dudas calóricas), responde de forma breve (1 o 2 oraciones) y retoma de inmediato el paso activo: "Volviendo al paso [N]: [acción]".
4. INTEGRACIÓN DIRECTA CON EL STREAM DE AUDIO Y CANTIDADES LEGIBLES:
   - Todo texto de salida generado para las recetas o instrucciones de voz debe tener cantidades legibles para voz (fracciones, unidades y cadencias claras: ej: "media cucharada", "un cuarto de taza", "de dos a tres minutos") para alimentar limpiamente la síntesis de voz y el stream de Gemini Live a 24kHz.

${toneInstruction}

PACIENCIA CONVERSACIONAL Y COMPRENSIÓN DE SILENCIOS:
- El usuario está en su cocina activa, oliendo y pensando. Nunca lo apures.

MEMORIA EVOLUTIVA DEL ESTUDIANTE (Lo que sabes de él):
${userMemories}

REGLA DE CONEXIÓN PERSONAL Y APRENDIZAJE:
- Si aplica al tema actual, cita con naturalidad y cariño lo que recuerdas de él (ej: "Como ya sé que le tienes respeto al aceite caliente...", "Recuerda que en tu sartén antiadherente no necesitas tanto aceite", "Como la otra vez dominaste el arroz...").
- DETECCIÓN ACTIVA DE RECUERDOS (learnedMemory):
  Si el usuario menciona un gusto personal (ej: "me gusta con harto ajo", "no como picante", "poca sal"), su equipamiento (ej: "tengo cocina eléctrica", "mi sartén se pega", "tengo airfryer"), un hábito (ej: "cocino para dos", "tengo poco tiempo en la semana"), o una dificultad/temor (ej: "me da miedo prender el horno", "se me quemó la cebolla"), DEBES EXTRAERLO en el objeto 'learnedMemory' para guardarlo en su cerebro permanente.

REGLAS DE ORO CULTURALES LATINOAMERICANAS Y UNIVERSALES:
- Sofrito Criollo / Latino: La cebolla se suda a fuego muy lento (8 a 10 min) con calma para que quede dulce, transparente y no caiga pesada.
- Arroz casero: Proporción 1 a 2; fuego mínimo tapado 20 minutos; no destapar a cada rato.
- Ajo: Se quema en 15 segundos en fuego alto; agrégalo a fuego medio-bajo cuando la cebolla ya esté tierna.
- Pollo/Carne: Se sella con fuego medio-alto y luego se cocina con calma para que no quede seco ni crudo adentro.
- Sal y balance: El toque final de unas gotas de limón o vinagre corta la grasa y realza todos los sabores.

Perfil del estudiante:
- Nivel actual: ${userLevel}
- Errores típicos previos: ${userMistakes}
- Ritmo de paciencia preferido: ${patienceMode || 'zen'}
- Contexto de cocina actual: ${currentContext ? JSON.stringify(currentContext) : 'En cocina libre o consultando'}

Instrucciones para la respuesta JSON:
1. Máximo 2 a 4 oraciones claras y directas con cantidades fonéticamente legibles para ser escuchadas por audio mientras se cocina.
2. Si hay peligro de fuego, humo o aceite caliente, pon la instrucción de seguridad PRIMERO en mayúsculas amables (ej: "¡RETIRA LA SARTÉN DEL FUEGO DE INMEDIATO!").
3. Si el usuario pide un temporizador (ej: "pon 5 minutos"), incluye timerSecondsRequested con los segundos (ej: 300) y timerLabel.
4. Si detectas un hecho nuevo que valga la pena recordar para el futuro del usuario, llena 'learnedMemory'.`;

    // Armar historial multi-turno si viene en la petición para evitar repeticiones
    const contents: any[] = [];
    if (Array.isArray(history) && history.length > 0) {
      for (const h of history.slice(-6)) {
        if (h.text && typeof h.text === 'string') {
          contents.push({
            role: h.sender === 'chef' ? 'model' : 'user',
            parts: [{ text: h.text }],
          });
        }
      }
    }
    // Regla estricta de Gemini API: El primer contenido DEBE tener role 'user', no 'model'
    while (contents.length > 0 && contents[0].role === 'model') {
      contents.shift();
    }
    contents.push({
      role: 'user',
      parts: [{ text: message }],
    });

    const response = await callGeminiWithFallback(ai, {
      contents,
      config: {
        systemInstruction,
        temperature: 0.7, // Variabilidad y frescura en las respuestas
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            reply: {
              type: Type.STRING,
              description: 'Respuesta hablada calmada, clara, variada y directa en español latinoamericano.',
            },
            safetyAlert: {
              type: Type.STRING,
              description: 'Alerta urgente si hay peligro de fuego, humo o corte. Vacío si no aplica.',
            },
            timerSecondsRequested: {
              type: Type.INTEGER,
              description: 'Si el usuario pidió temporizador, número de segundos (ej: 480 para 8 min). 0 si no pidió.',
            },
            timerLabel: {
              type: Type.STRING,
              description: 'Etiqueta breve para el temporizador, ej: Pasta o Cocción.',
            },
            heatAdjustment: {
              type: Type.STRING,
              description: 'Ajuste de llama sugerido: bajo, medio, alto, apagar, o mantener.',
            },
            learnedMemory: {
              type: Type.OBJECT,
              description: 'Dato relevante nuevo descubierto sobre el usuario en esta interacción, o null si no se aprendió nada nuevo.',
              properties: {
                category: {
                  type: Type.STRING,
                  description: 'Categoría: fuego, gustos, equipamiento, habito o fortaleza',
                },
                fact: {
                  type: Type.STRING,
                  description: 'Hecho aprendido en una sola oración, ej: "Prefiere cocinar con poca sal" o "Solo tiene una sartén de teflón"',
                },
              },
            },
          },
          required: ['reply'],
        },
      },
    });

    const parsed = safeParseGeminiJson(response.text, {} as any);
    if (!parsed || !parsed.reply) {
      throw new Error('Gemini reply invalid or empty');
    }

    // Generar audio nativo en español latinoamericano con Gemini TTS con timeout de 3.5s
    try {
      const audioPromise = generateSpanishSpeechAudio(ai, parsed.reply);
      const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 3500));
      const audioResult = await Promise.race([audioPromise, timeoutPromise]);
      if (audioResult) {
        parsed.audioBase64 = audioResult.audioBase64;
        parsed.audioMimeType = audioResult.mimeType;
      }
    } catch (ttsErr) {
      console.warn('Chef Cero: Aviso en generación de audio TTS:', ttsErr);
    }

    return res.json(parsed);
  } catch (error: any) {
    console.warn('Gemini chat fallback engaged:', error?.message);
    const msg = req.body?.message || '';
    return res.json(generateDynamicFallback(msg));
  }
});

// Función para generar voz en español latinoamericano nativo y de alta fidelidad con Gemini TTS
async function generateSpanishSpeechAudio(
  ai: GoogleGenAI,
  textToSpeak: string
): Promise<{ audioBase64: string; mimeType: string } | null> {
  try {
    const cleanText = textToSpeak
      .replace(/[\u{1F300}-\u{1F9FF}]/gu, '')
      .replace(/[•·—–*#_`]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!cleanText) return null;

    // Usar gemini-3.8-flash-lite-tts con voz Puck y directiva explícita de pronunciación latina
    const ttsResponse = await ai.models.generateContent({
      model: 'gemini-3.8-flash-lite-tts',
      contents: cleanText,
      config: {
        systemInstruction: 'Lee el texto exactamente como está escrito con pronunciación nativa y cálida en español latinoamericano.',
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Puck' },
          },
        },
      },
    });

    const part = ttsResponse.candidates?.[0]?.content?.parts?.[0];
    if (part?.inlineData?.data) {
      return {
        audioBase64: part.inlineData.data,
        mimeType: part.inlineData.mimeType || 'audio/wav',
      };
    }
    return null;
  } catch (err: any) {
    console.warn('Chef Cero: Error generando voz TTS de Gemini:', err?.message || err);
    return null;
  }
}

// Endpoint dedicado para sintetizar audio nativo en español bajo demanda (ej: botón escuchar audio o pasos)
app.post('/api/tts', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Texto requerido' });
    }
    const ai = getAi();
    const audioResult = await generateSpanishSpeechAudio(ai, text);
    if (!audioResult) {
      return res.status(500).json({ error: 'No se pudo generar el audio nativo' });
    }
    return res.json(audioResult);
  } catch (err: any) {
    console.warn('Chef Cero: Error en endpoint /api/tts:', err?.message);
    return res.status(500).json({ error: 'Error interno en TTS' });
  }
});

// Endpoint para verificar si Gemini Live API está disponible en este entorno
app.get('/api/live/status', (req, res) => {
  const hasGemini = !!(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY);
  return res.json({
    available: hasGemini,
    model: 'gemini-3.8-live',
    voice: 'Puck',
    language: 'es-419 (Latinoamérica)',
    features: ['bidirectional_audio', 'realtime_transcription', 'live_interruptions', 'binary_streaming'],
  });
});

// Endpoint para obtener sugerencias proactivas del Chef según memorias y contexto actual
app.post('/api/mentor/proactive-tip', async (req, res) => {
  try {
    const { userProfile, currentContext } = req.body;
    const ai = getAi();
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.json({
        tip: 'Recuerda el secreto del sofrito: la cebolla picada con una pizca de sal a fuego muy suave se vuelve dulce y no cae pesada.',
        type: 'tecnica',
        category: 'fuego',
      });
    }

    const memoriesText = Array.isArray(userProfile?.evolutionaryMemories) && userProfile.evolutionaryMemories.length > 0
      ? userProfile.evolutionaryMemories.map((m: any) => `• [${m.category}]: ${m.fact}`).join('\n')
      : 'Novato con ganas de aprender.';

    const mistakesText = Array.isArray(userProfile?.pastMistakes) && userProfile.pastMistakes.length > 0
      ? userProfile.pastMistakes.join(', ')
      : 'Sin errores registrados.';

    const prompt = `Actúa como Chef Cero, un mentor de cocina cálido, perspicaz y proactivo para principiantes en español latinoamericano.
El estudiante está en su cocina.
Lo que sabes sobre él:
- Nivel: ${userProfile?.levelTitle || 'Principiante'}
- Errores del pasado: ${mistakesText}
- Memorias acumuladas de sus gustos y hábitos:
${memoriesText}
- Contexto actual: ${currentContext ? JSON.stringify(currentContext) : 'En cocina o planificando'}

Genera UNA sola sugerencia proactiva, inteligente y anticipatoria (máximo 2 oraciones) que le sirva AHORA MISMO:
- Si está en un paso de receta, anticípate al error más común de ese paso basándote en sus recuerdos.
- Si no está cocinando, dale un truco rápido para potenciar sabores o rescatar sobras según sus gustos aprendidos.
- Si tiene un error repetido (ej: fuego alto, quemar el ajo), dale un consejo preventivo cariñoso.`;

    const response = await callGeminiWithFallback(ai, {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            tip: {
              type: Type.STRING,
              description: 'Sugerencia proactiva cálida y personalizada en 1 o 2 oraciones en español latinoamericano.',
            },
            type: {
              type: Type.STRING,
              description: 'Tipo: preventiva, sabor, rescate o truco',
            },
            relatedMemory: {
              type: Type.STRING,
              description: 'Memoria o hábito del usuario al que hace alusión, o vacío si es general.',
            },
          },
          required: ['tip', 'type'],
        },
      },
    });

    const parsed = safeParseGeminiJson(response.text, {
      tip: 'Mantén la llama suave en la estufa para no correr riesgos innecesarios.',
      type: 'preventiva',
    });

    return res.json(parsed);
  } catch (err: any) {
    console.warn('Chef Cero: Error generando sugerencia proactiva:', err?.message);
    return res.json({
      tip: 'Cocinar no es una carrera. Pon la llama baja, respira el aroma y tómate tu tiempo.',
      type: 'preventiva',
    });
  }
});

// Endpoint ultraligero para medición de latencia RTT de red en tiempo real
app.get('/api/live/ping', (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  return res.json({ ok: true, t: Date.now() });
});

// Endpoint de Visión Multimodal: Escaneo de Refrigerador o Despensa con Cámara
app.post('/api/scan-fridge', async (req, res) => {
  try {
    const { imageBase64, mimeType = 'image/jpeg' } = req.body;
    if (!imageBase64) {
      return res.status(400).json({ error: 'Falta la imagen en base64' });
    }

    const ai = getAi();
    const apiKey = process.env.GEMINI_API_KEY;

    // Limpiar prefijo data:image/...;base64, si viene incluido
    let cleanBase64 = imageBase64;
    let actualMime = mimeType;
    if (imageBase64.includes(';base64,')) {
      const parts = imageBase64.split(';base64,');
      actualMime = parts[0].replace('data:', '');
      cleanBase64 = parts[1];
    }

    if (!apiKey) {
      return res.json({
        detectedIngredients: ['Huevos', 'Pan', 'Tomate', 'Queso', 'Aceite'],
        chefObservation: '¡Tienes una excelente base! Con estos ingredientes podemos armar una comida deliciosa y nutritiva en menos de 10 minutos.',
        suggestedDishes: [
          {
            id: 'scan-dish-1',
            title: 'Tostas Doradas con Huevo Suave y Tomate',
            totalTimeMinutes: 8,
            difficulty: 'Principiante Total',
            ingredientsUsed: ['Pan', 'Huevos', 'Tomate', 'Aceite'],
            keyTip: 'Tuesta el pan con sartén seca a fuego medio y pon el huevo encima cuando aún esté brillante.',
            quickSteps: [
              {
                stepNumber: 1,
                title: 'Preparación en frío',
                instruction: 'Corta 2 rebanadas de pan y raya medio tomate sobre un plato hondo con una pizca de sal.',
                heatLevel: 'apagado',
              },
              {
                stepNumber: 2,
                title: 'Tostar el pan en sartén',
                instruction: 'Pon las rebanadas en sartén a fuego medio por 2 minutos por lado hasta que crujan.',
                heatLevel: 'medio',
              },
              {
                stepNumber: 3,
                title: 'Montaje y huevo',
                instruction: 'Unta el tomate sobre el pan caliente, cuaja un huevo tierno 1 minuto y corona la tosta.',
                heatLevel: 'bajo',
              },
            ],
          },
          {
            id: 'scan-dish-2',
            title: 'Huevos Revueltos Cremosos con Queso Derretido',
            totalTimeMinutes: 7,
            difficulty: 'Principiante Total',
            ingredientsUsed: ['Huevos', 'Queso', 'Aceite'],
            keyTip: 'Apaga el fuego en cuanto los huevos comiencen a cuajar; el calor de la sartén terminará el trabajo.',
            quickSteps: [
              {
                stepNumber: 1,
                title: 'Batir en tazón',
                instruction: 'Bate 2 huevos con una pizca de sal y corta el queso en cubitos pequeños.',
                heatLevel: 'apagado',
              },
              {
                stepNumber: 2,
                title: 'Cocción suave con espátula',
                instruction: 'Calienta la sartén a fuego bajo con un hilo de aceite, vierte los huevos y revuelve lento.',
                heatLevel: 'bajo',
              },
              {
                stepNumber: 3,
                title: 'Fundir con fuego apagado',
                instruction: 'Echa el queso, apaga la estufa de inmediato y deja que se funda 30 segundos antes de servir.',
                heatLevel: 'apagado',
              },
            ],
          },
        ],
      });
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `Eres el Chef Mentor de Chef Cero, una app diseñada para personas que no saben cocinar nada y tienen miedo a equivocarse.
Examina detenidamente esta imagen de refrigerador, estante, mesa o ingredientes.
1. Lista todos los ingredientes o alimentos comestibles reconocibles (máximo 8).
2. Propón 2 platos express ultra sencillos (de 8 a 15 minutos máximo) que se puedan preparar con lo que se ve.
3. Para cada plato:
   - title: nombre apetitoso y claro
   - totalTimeMinutes: número entre 7 y 15
   - difficulty: 'Principiante Total'
   - ingredientsUsed: array de ingredientes usados de la foto
   - keyTip: un tip anti-quemaduras o secreto de sabor en 1 sola frase
   - quickSteps: exactamente 3 pasos cortísimos (el paso 1 SIEMPRE debe ser con heatLevel: 'apagado' para mise en place).
Responde en JSON estricto.`,
            },
            {
              inlineData: {
                mimeType: actualMime,
                data: cleanBase64,
              },
            },
          ],
        },
      ],
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            detectedIngredients: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'Ingredientes o alimentos detectados en la imagen',
            },
            chefObservation: {
              type: Type.STRING,
              description: 'Comentario cálido y motivador en 1-2 frases',
            },
            suggestedDishes: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  title: { type: Type.STRING },
                  totalTimeMinutes: { type: Type.INTEGER },
                  difficulty: { type: Type.STRING },
                  ingredientsUsed: { type: Type.ARRAY, items: { type: Type.STRING } },
                  keyTip: { type: Type.STRING },
                  quickSteps: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        stepNumber: { type: Type.INTEGER },
                        title: { type: Type.STRING },
                        instruction: { type: Type.STRING },
                        heatLevel: { type: Type.STRING },
                      },
                      required: ['stepNumber', 'title', 'instruction', 'heatLevel'],
                    },
                  },
                },
                required: ['id', 'title', 'totalTimeMinutes', 'ingredientsUsed', 'keyTip', 'quickSteps'],
              },
            },
          },
          required: ['detectedIngredients', 'chefObservation', 'suggestedDishes'],
        },
      },
    });

    const parsed = safeParseGeminiJson(response.text, {
      detectedIngredients: ['Ingredientes frescos'],
      chefObservation: 'Detecté ingredientes listos para preparar un plato rápido y sabroso.',
      suggestedDishes: [],
    });

    return res.json(parsed);
  } catch (error: any) {
    console.warn('Chef Cero: Error en escaneo multimodal de refrigerador:', error?.message);
    return res.status(500).json({
      error: 'No se pudo analizar la imagen en este momento. Intenta con una toma más clara o escribe los ingredientes.',
    });
  }
});

// Endpoint dedicado: Inspector de Producto, Frescura y Sugerencia de Cocina con Cámara IA
app.post('/api/inspect-product', async (req, res) => {
  try {
    const { imageBase64, mimeType = 'image/jpeg' } = req.body;
    if (!imageBase64) {
      return res.status(400).json({ error: 'Falta la imagen del producto en base64' });
    }

    const ai = getAi();
    const apiKey = process.env.GEMINI_API_KEY;

    let cleanBase64 = imageBase64;
    let actualMime = mimeType;
    if (imageBase64.includes(';base64,')) {
      const parts = imageBase64.split(';base64,');
      actualMime = parts[0].replace('data:', '');
      cleanBase64 = parts[1];
    }

    if (!apiKey) {
      return res.json({
        productName: 'Tomate fresco de ensalada',
        productCategory: 'verduras',
        status: 'bueno',
        statusHeadline: '¡En excelente estado y listo para cocinar!',
        freshnessScore: 92,
        estimatedShelfLife: '4 a 5 días en refrigeración o lugar fresco',
        confidenceExplanation: 'Piel tersa, color rojo uniforme, sin manchas de moho ni hendiduras blandas.',
        sensoryCheck: {
          sight: 'Color brillante y piel sin arrugas profundas ni hongos.',
          smell: 'Aroma vegetal fresco y ligeramente dulce en la zona del pedúnculo.',
          touch: 'Firme al tacto con una leve elasticidad; no debe sentirse aguado.',
        },
        safetyAdvice: 'Lávalo con abundante agua fría antes de cortar. La piel está impecable.',
        suggestedDishes: [
          {
            id: 'prod-dish-1',
            title: 'Tostada con Tomate Rallado y Huevo Pochado',
            totalTimeMinutes: 8,
            difficulty: 'Principiante Total',
            ingredientsNeeded: ['Pan', '1 Huevo', 'Aceite de oliva o vegetal', 'Sal'],
            whyThisDishWorks: 'Aprovecha la jugosidad natural del tomate fresco sin necesidad de cocciones largas.',
            quickSteps: [
              {
                stepNumber: 1,
                title: 'Rallado en frío',
                instruction: 'Corta el tomate a la mitad y rállalo con un rallador sobre un plato hondo con sal y unas gotas de aceite.',
                heatLevel: 'apagado',
              },
              {
                stepNumber: 2,
                title: 'Tostar pan',
                instruction: 'Dora las rebanadas de pan en sartén a fuego medio 2 minutos por lado.',
                heatLevel: 'medio',
              },
              {
                stepNumber: 3,
                title: 'Montaje jugoso',
                instruction: 'Unta el tomate abundante sobre el pan caliente y acompáñalo con tu huevo favorito.',
                heatLevel: 'bajo',
              },
            ],
          },
          {
            id: 'prod-dish-2',
            title: 'Sofrito Base Exprés para Pastas o Arroz',
            totalTimeMinutes: 10,
            difficulty: 'Principiante Total',
            ingredientsNeeded: ['Cebolla o ajo', 'Aceite', 'Sal y pimienta'],
            whyThisDishWorks: 'El calor suave concentra los azúcares naturales del tomate volviéndolo dulce y aromático.',
            quickSteps: [
              {
                stepNumber: 1,
                title: 'Picar en cubitos',
                instruction: 'Pica el tomate en cuadritos con su piel y semillas en una tabla limpia.',
                heatLevel: 'apagado',
              },
              {
                stepNumber: 2,
                title: 'Sofreír a fuego suave',
                instruction: 'Calienta 1 cucharada de aceite a fuego medio-bajo y echa el tomate picado con sal.',
                heatLevel: 'medio',
              },
              {
                stepNumber: 3,
                title: 'Reducción dulce',
                instruction: 'Cocina 6 minutos removiendo con cuchara de madera hasta que se forme una salsita casera tierna.',
                heatLevel: 'bajo',
              },
            ],
          },
        ],
        audioScript: 'He revisado tu tomate con atención. Se encuentra en excelente estado, firme y con su piel brillante. Puedes usarlo con total confianza hoy mismo en una tosta rápida o un sofrito casero.',
      });
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `Eres el Chef Mentor y Especialista en Seguridad Alimentaria de Chef Cero.
El usuario abrió su refrigerador o alacena, sacó UN alimento o producto específico y le tomó una foto con la cámara para saber:
1. Qué producto exacto es.
2. Si está en buen estado, si debe consumirse hoy mismo o si está vencido/en mal estado (descartar).
3. Cómo comprobarlo con sus propios sentidos (vista, olfato, tacto).
4. Con qué y cómo cocinarlo de forma fácil y deliciosa hoy mismo.

INSTRUCCIONES CLAVE DE EVALUACIÓN:
- Sé riguroso y protector: Si el alimento muestra moho evidente, decoloración grisácea/verdosa, hinchazón en envase o signos de putrefacción, pon status: 'descartar' y advierte con amabilidad que la salud va primero.
- Si está en buen estado (fresco) pon status: 'bueno'.
- Si está maduro, con manchitas inocuas o cerca de pasarse pero comestible tras cocción, pon status: 'consumir_urgente'.
- Propón 2 recetas prácticas para principiantes (de 8 a 15 min) que aprovechen este ingrediente. El paso 1 de cada receta DEBE ser con heatLevel: 'apagado' (mise en place).
- Genera un audioScript de 2 o 3 oraciones cálidas en español latinoamericano para que el mentor se lo diga en audio.`,
            },
            {
              inlineData: {
                mimeType: actualMime,
                data: cleanBase64,
              },
            },
          ],
        },
      ],
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            productName: { type: Type.STRING, description: 'Nombre claro y común del alimento' },
            productCategory: { type: Type.STRING, description: 'verduras, carnes, lacteos, frutas, huevos, legumbres, panaderia u otros' },
            status: { type: Type.STRING, description: 'bueno | consumir_urgente | descartar' },
            statusHeadline: { type: Type.STRING, description: 'Frase titular clara sobre su estado' },
            freshnessScore: { type: Type.INTEGER, description: 'Puntaje de 1 a 100 de frescura' },
            estimatedShelfLife: { type: Type.STRING, description: 'Tiempo restante estimado antes de vencer' },
            confidenceExplanation: { type: Type.STRING, description: 'Por qué llegaste a esa conclusión según lo visible en la foto' },
            sensoryCheck: {
              type: Type.OBJECT,
              properties: {
                sight: { type: Type.STRING, description: 'Qué comprobar con la vista' },
                smell: { type: Type.STRING, description: 'Qué comprobar con el olfato' },
                touch: { type: Type.STRING, description: 'Qué comprobar con el tacto o textura' },
              },
              required: ['sight', 'smell', 'touch'],
            },
            safetyAdvice: { type: Type.STRING, description: 'Consejo de higiene o seguridad de oro' },
            suggestedDishes: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  title: { type: Type.STRING },
                  totalTimeMinutes: { type: Type.INTEGER },
                  difficulty: { type: Type.STRING },
                  ingredientsNeeded: { type: Type.ARRAY, items: { type: Type.STRING } },
                  whyThisDishWorks: { type: Type.STRING },
                  quickSteps: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        stepNumber: { type: Type.INTEGER },
                        title: { type: Type.STRING },
                        instruction: { type: Type.STRING },
                        heatLevel: { type: Type.STRING },
                      },
                      required: ['stepNumber', 'title', 'instruction', 'heatLevel'],
                    },
                  },
                },
                required: ['id', 'title', 'totalTimeMinutes', 'ingredientsNeeded', 'whyThisDishWorks', 'quickSteps'],
              },
            },
            audioScript: { type: Type.STRING, description: 'Mensaje cálido para ser escuchado por voz en español latino' },
          },
          required: [
            'productName',
            'productCategory',
            'status',
            'statusHeadline',
            'freshnessScore',
            'estimatedShelfLife',
            'confidenceExplanation',
            'sensoryCheck',
            'safetyAdvice',
            'suggestedDishes',
            'audioScript',
          ],
        },
      },
    });

    const parsed = safeParseGeminiJson(response.text, {} as any);
    if (!parsed || !parsed.productName) {
      throw new Error('Respuesta inválida de Gemini al inspeccionar producto');
    }

    // Generar audio nativo de voz con Gemini TTS en español latino (timeout 3.5s)
    try {
      if (parsed.audioScript) {
        const audioPromise = generateSpanishSpeechAudio(ai, parsed.audioScript);
        const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 3500));
        const audioResult = await Promise.race([audioPromise, timeoutPromise]);
        if (audioResult) {
          parsed.audioBase64 = audioResult.audioBase64;
          parsed.audioMimeType = audioResult.mimeType;
        }
      }
    } catch (ttsErr) {
      console.warn('Chef Cero: Aviso generando audio de veredicto:', ttsErr);
    }

    return res.json(parsed);
  } catch (error: any) {
    console.warn('Chef Cero: Error en inspección de producto:', error?.message);
    return res.status(500).json({
      error: 'No pudimos examinar el producto en este momento. Intenta enfocarlo con mejor luz o más de cerca.',
    });
  }
});

// 2. Recipe Planner & "Tengo 3 ingredientes" Generator
app.post('/api/recipe/generate', async (req, res) => {
  try {
    const { ingredients, userProfile, targetMeal, cuisine, budgetFocus } = req.body;
    const ai = getAi();
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.json({
        title: 'Revuelto Rápido de Emergencia para Principiantes',
        description: 'Plato fácil con ingredientes sencillos, ideal para dominar el control del fuego y no quemar nada.',
        servings: 1,
        totalTimeMinutes: 12,
        difficulty: 'Principiante Absoluto',
        cuisine: cuisine || 'economica_bbb',
        cuisineName: 'Cocina Básica & Económica',
        countryFlag: '🍳',
        isBudgetFriendly: true,
        estimatedCostLabel: 'Económica (<$1.50 USD)',
        culturalSecret: 'El calor residual termina de cocinar los huevos en el plato sin resecarlos.',
        pantrySubstitutes: [
          {
            original: 'Mantequilla fina',
            substitute: '1 cucharadita de aceite común',
            reason: 'Cumple la misma función lubricante sin quemarse a fuego bajo.',
          },
        ],
        safetyAlerts: [
          'Nunca dejes la espátula de plástico apoyada en la sartén caliente.',
          'El fuego debe estar entre bajo y medio; si humea, está demasiado alto.',
        ],
        miseEnPlace: [
          '2 huevos cascados en un plato hondo batidos ligeramente con tenedor',
          '1 cucharadita de aceite o mantequilla lista junto a la sartén',
          'Una pizca de sal y pimienta a mano',
          'Plato vacío donde servirás listo a un lado',
        ],
        heatGuideExplanation: 'Fuego Bajo: la llama azul apenas besa el fondo de la sartén. Te da control total.',
        steps: [
          {
            stepNumber: 1,
            title: 'Mise en Place completa',
            instruction: 'Asegúrate de tener todos los ingredientes en platitos antes de encender la estufa.',
            tip: 'Si picas mientras cocinas, las cosas en la sartén se quemarán mientras estás distraído.',
            heatLevel: 'apagado',
            timerSeconds: 0,
            timerLabel: '',
          },
          {
            stepNumber: 2,
            title: 'Calentar la sartén suavemente',
            instruction: 'Coloca la sartén a Fuego Bajo. Agrega el aceite o mantequilla y espera a que brille sin humear.',
            tip: 'Pon la mano a 10 cm arriba de la sartén; si sientes tibio suave, está lista.',
            heatLevel: 'bajo',
            timerSeconds: 90,
            timerLabel: 'Calentar sartén',
          },
          {
            stepNumber: 3,
            title: 'Cocción suave de los huevos',
            instruction: 'Vierte los huevos. Con la espátula de madera o silicona, empuja los bordes suavemente hacia el centro.',
            tip: 'Apaga el fuego cuando los huevos aún se vean un poquito húmedos; se terminarán de cocinar con el calor residual.',
            heatLevel: 'bajo',
            timerSeconds: 120,
            timerLabel: 'Huevos revueltos',
          },
        ],
      });
    }

    const cuisineDirectives: Record<string, string> = {
      chilena_criolla: 'Gastronomía Chilena & Criolla: Secreto del sofrito lento de cebolla (dulce, sin acidez), comino en pizca justa, ají de color y uso sabroso de choclo, papas o zapallo.',
      mexicana: 'Gastronomía Mexicana Real & Rápida: Dorar chiles secos solo 20 segundos para que no amarguen, dorar tortillas con poco aceite sin salpicar, balance con lima/limón y cilantro.',
      asiatica: 'Gastronomía Asiática de Barrio (China/Thai/Japón): Si lleva arroz frito DEBE ser arroz frío del día anterior; saltear a fuego medio-alto en tandas; el ajo y jengibre no deben carbonizarse. Sustitutos baratos: vinagre con azúcar por mirin; soya con limón por salsas caras.',
      italiana: 'Gastronomía Italiana de la Nonna: Salar el agua como el mar, guardar 1 taza de agua con almidón para la salsa emulsionada (mantecatura), ajo suave sin dorar en exceso.',
      espanola: 'Gastronomía Española de Taberna: Pochado lento de patatas y cebolla en aceite suave, huevos jugosos, desglasado sutil con vinagre o vino blanco.',
      francesa: 'Gastronomía Francesa Fácil: Mantequilla derretida a fuego dulce sin humear, huevos batidos lisos y jugosos al centro sin corteza marrón, hierbas al final.',
      economica_bbb: 'COCINA ECONÓMICA BBB (Buena, Bonita y Barata): Máximo aprovechamiento de despensa (costo < $3.50 USD), uso de huevos, papas, arroz, legumbres y sustitutos inteligentes para no comprar cosas caras.',
    };

    const requestedCuisineNote = cuisine && cuisineDirectives[cuisine]
      ? cuisineDirectives[cuisine]
      : 'Cualquier cocina adaptada a principiantes con técnicas sencillas.';

    const userLevel = Number(userProfile?.level) || 1;
    let levelPedagogicalRule = '';
    if (userLevel === 1) {
      levelPedagogicalRule = `ADAPTACIÓN ESTRICTA A NIVEL 1 (CERO ABSOLUTO):
- El usuario NO SABE COCINAR y le tiene miedo a la estufa, a salpicarse o a que se le queme la comida.
- La receta DEBE usar 1 sola hornalla/sartén, fuego bajo o medio, máximo 3 o 4 pasos sencillos.
- Cero términos franceses o jerga culinaria sin explicar.
- Énfasis total en seguridad y en preparar todo con fuego apagado antes de calentar nada.`;
    } else if (userLevel === 2) {
      levelPedagogicalRule = `ADAPTACIÓN A NIVEL 2 (APRENDIZ DEL FUEGO):
- El usuario ya sabe hervir y freír algo básico sin pánico.
- Introduce control térmico: sudar cebolla despacio para dulzor (8 min), momento exacto para no quemar el ajo, o sellado jugoso de carne sin resecar.`;
    } else if (userLevel === 3) {
      levelPedagogicalRule = `ADAPTACIÓN A NIVEL 3 (COCINERO CASERO SEGURO):
- El usuario maneja tiempos con soltura.
- Puede manejar dos hornallas simultáneas, salteados vivos estilo oriental o emulsiones con agua de pasta.`;
    } else {
      levelPedagogicalRule = `ADAPTACIÓN A NIVEL 4/5 (ALQUIMISTA / CHEF):
- Desafíos culinarios: desglasado de sartenes con líquido, reducciones sedosas, y equilibrio sensorial de los 5 sabores.`;
    }

    const prompt = `Crea una receta adaptada al NIVEL CULINARIO del usuario con estos ingredientes: "${ingredients || 'huevos, cebolla, pan'}".
Perfil del aprendiz:
- Nivel Culinario Actual: Nivel ${userLevel} (${userProfile?.levelTitle || 'Cero Absoluto'})
${levelPedagogicalRule}
- Errores pasados que comete: ${userProfile?.pastMistakes?.join(', ') || 'Ninguno registrado'}
- Habilidades dominadas: ${userProfile?.masteredSkills?.join(', ') || 'Mise en place básica'}
Comida objetivo: ${targetMeal || 'Almuerzo o cena fácil'}.
Estilo Culinario Solicitado: ${requestedCuisineNote}
${budgetFocus ? 'ENFOQUE ECONÓMICO ACTIVO: Diseña el plato para que sea ultra accesible (BBB: Buena, Bonita y Barata) usando alimentos rendidores.' : ''}

REGLAS CRÍTICAS PARA CHEF CERO (FILOSOFÍA PANTRY-FIRST Y VOZ):
1. FILOSOFÍA DE DESPENSA INTELIGENTE (Pantry-First):
   - Sugiere EXCLUSIVAMENTE recetas ejecutables con los ingredientes que el usuario proporcionó ("${ingredients || 'huevos, cebolla, pan'}"). NO le pidas salir a comprar ingredientes extraños.
   - Asume por defecto únicamente una despensa básica universal: sal, pimienta, agua corriente y aceite de cocina común.
2. PROTOCOLO DE SUSTITUCIÓN DINÁMICA:
   - Si la receta tradicional usaría otro ingrediente, adáptala o sugiere de inmediato sustitutos viables con lo que ya tiene en su inventario en "pantrySubstitutes".
3. CANTIDADES FONÉTICAMENTE LEGIBLES PARA VOZ:
   - Todas las cantidades en mise en place e instrucciones deben expresarse con palabras y frases claras y legibles al ser leídas en voz alta por el sintetizador (ej: "media cucharadita", "un cuarto de taza", "dos huevos", "de dos a tres minutos"), evitando símbolos crudos confusos para TTS.
4. GUÍA PASO A PASO Y MISE EN PLACE:
   - "Mise en place": Lista obligatoria de todo lo que debe estar lavado, pelado, medido y en pocillos ANTES de encender el fuego.
   - Cada paso debe tener su nivel de fuego explícito ('bajo', 'medio', 'alto', 'apagado') y temporizadores precisos en segundos si requiere tiempo.
   - Incluye pistas sensoriales en cada paso (vista/sight, oído/sound, olfato/smell) para que el aprendiz sepa si va bien sin termómetros.
5. "culturalSecret": Incluye el secreto de oro de esa cultura explicado en 1-2 oraciones amables.
6. "pantrySubstitutes": Lista de 1 a 3 sustitutos baratos de alacena para no gastar de más.
7. "requiredLevel": El nivel culinario que amerita esta preparación (1 a 5).
8. "learningGoal": Una frase corta indicando qué técnica clave desbloquea o practica el usuario al hacer este plato.
9. Alertas de seguridad hiper-específicas para principiantes.`;

    const response = await callGeminiWithFallback(ai, {
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            description: { type: Type.STRING },
            servings: { type: Type.INTEGER },
            totalTimeMinutes: { type: Type.INTEGER },
            difficulty: { type: Type.STRING },
            requiredLevel: { type: Type.INTEGER },
            learningGoal: { type: Type.STRING },
            cuisine: { type: Type.STRING },
            cuisineName: { type: Type.STRING },
            countryFlag: { type: Type.STRING },
            isBudgetFriendly: { type: Type.BOOLEAN },
            estimatedCostLabel: { type: Type.STRING },
            culturalSecret: { type: Type.STRING },
            pantrySubstitutes: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  original: { type: Type.STRING },
                  substitute: { type: Type.STRING },
                  reason: { type: Type.STRING },
                },
                required: ['original', 'substitute', 'reason'],
              },
            },
            safetyAlerts: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            miseEnPlace: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            heatGuideExplanation: { type: Type.STRING },
            steps: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  stepNumber: { type: Type.INTEGER },
                  title: { type: Type.STRING },
                  instruction: { type: Type.STRING },
                  tip: { type: Type.STRING },
                  heatLevel: { type: Type.STRING },
                  timerSeconds: { type: Type.INTEGER },
                  timerLabel: { type: Type.STRING },
                  whyItWorks: { type: Type.STRING },
                  sensoryCues: {
                    type: Type.OBJECT,
                    properties: {
                      sight: { type: Type.STRING },
                      sound: { type: Type.STRING },
                      smell: { type: Type.STRING },
                    },
                  },
                },
                required: ['stepNumber', 'title', 'instruction', 'tip', 'heatLevel'],
              },
            },
          },
          required: ['title', 'description', 'miseEnPlace', 'steps', 'safetyAlerts'],
        },
      },
    });

    const parsed = safeParseGeminiJson(response.text, null as any);
    if (!parsed || !parsed.title || !parsed.steps) {
      throw new Error('Gemini recipe invalid structure');
    }
    return res.json(parsed);
  } catch (error: any) {
    console.warn('Gemini recipe fallback engaged:', error?.message);
    const ingr = req.body?.ingredients || 'tus ingredientes';
    const cuisine = req.body?.cuisine || 'economica_bbb';

    let title = `Salteado Express con ${ingr.slice(0, 25)}`;
    let flag = '🍳';
    let cName = 'Cocina Fácil';
    let secret = 'El control de fuego suave evita que los ingredientes se arrebaten antes de cocinarse.';

    if (cuisine === 'chilena_criolla') {
      title = `Salteado Criollo con ${ingr.slice(0, 22)}`;
      flag = '🇨🇱';
      cName = 'Chilena & Criolla';
      secret = 'Suda la cebolla lentamente para que quede dulce y no cause ardor estomacal.';
    } else if (cuisine === 'mexicana') {
      title = `Sartén Ranchero con ${ingr.slice(0, 22)}`;
      flag = '🇲🇽';
      cName = 'Mexicana Rápida';
      secret = 'Dora las tortillas con un velo ligero de aceite; no hace falta freírlas en hondo para que queden crocantes.';
    } else if (cuisine === 'asiatica') {
      title = `Salteado Estilo Oriental con ${ingr.slice(0, 20)}`;
      flag = '🥢';
      cName = 'Asiática de Barrio';
      secret = 'Agrega el ajo y la salsa de soya al final para que no se quemen ni amarguen.';
    } else if (cuisine === 'italiana') {
      title = `Pasta o Salteado Pomodoro con ${ingr.slice(0, 20)}`;
      flag = '🇮🇹';
      cName = 'Italiana de la Nonna';
      secret = 'Reserva un chorrito de agua caliente con almidón para lograr una salsa brillante y cremosa.';
    }

    return res.json({
      title,
      description: 'Una preparación reconfortante y accesible diseñada para principiantes, asegurando que nada se pegue ni se queme.',
      servings: 1,
      totalTimeMinutes: 14,
      difficulty: 'Principiante',
      cuisine,
      cuisineName: cName,
      countryFlag: flag,
      isBudgetFriendly: true,
      estimatedCostLabel: 'Económica (~$2 - $3.50 USD)',
      culturalSecret: secret,
      pantrySubstitutes: [
        {
          original: 'Condimentos o salsas importadas',
          substitute: 'Salsa de soya + chorrito de limón + pizca de azúcar',
          reason: 'Aporta el mismo balance dulce-salado y umami por una fracción del costo.',
        },
      ],
      safetyAlerts: [
        'Mantén el mango de la sartén girado hacia adentro de la mesada.',
        'Pica todo antes de calentar el aceite.',
        'Si algo salpica, apaga el fuego inmediatamente.',
      ],
      miseEnPlace: [
        `Tener medidos y limpios: ${ingr}`,
        '1 cucharadita de aceite de oliva o girasol',
        '1 pizca de sal en los dedos',
        '1 espátula de madera o silicona',
      ],
      heatGuideExplanation: 'Usa fuego bajo y medio para no apresurarte y tener el control absoluto.',
      steps: [
        {
          stepNumber: 1,
          title: 'Alistar y picar con tranquilidad',
          instruction: `Coloca tus ingredientes (${ingr}) picados en platos separados. No enciendas la hornalla todavía.`,
          tip: 'El secreto de los cocineros profesionales es no empezar a calentar hasta tener todo picado.',
          heatLevel: 'apagado',
          timerSeconds: 0,
          timerLabel: '',
        },
        {
          stepNumber: 2,
          title: 'Calentar la sartén a fuego bajo',
          instruction: 'Pon la sartén al fuego mínimo con 1 cucharadita de aceite. Espera 60 segundos a que tome calor suave.',
          tip: 'El aceite debe brillar ligeramente. Si empieza a largar humo, apaga el fuego porque está muy caliente.',
          heatLevel: 'bajo',
          timerSeconds: 60,
          timerLabel: 'Calentar sartén',
        },
        {
          stepNumber: 3,
          title: 'Cocinar suavemente',
          instruction: 'Agrega tus ingredientes a la sartén. Remueve despacio con espátula de madera durante 5 a 6 minutos.',
          tip: 'Escucha el chisporroteo: debe ser suave, como lluvia en el techo, nunca violento.',
          heatLevel: 'medio',
          timerSeconds: 300,
          timerLabel: 'Salteado suave',
        },
        {
          stepNumber: 4,
          title: 'Toque de sal y reposo',
          instruction: 'Agrega una pizca de sal, apaga el fuego y retira la sartén a una hornalla fría.',
          tip: 'Dejar reposar 1 minuto integra los sabores antes de servir.',
          heatLevel: 'apagado',
          timerSeconds: 60,
          timerLabel: 'Reposo',
        },
      ],
    });
  }
});

// 3. Post-Cooking Mentor Evaluation & Skill Evolution
app.post('/api/eval', async (req, res) => {
  try {
    const { recipeTitle, rating, difficultyEncountered, userProfile } = req.body;
    const ai = getAi();
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.json({
        mentorNote: `¡Gran trabajo cocinando "${recipeTitle}"! Aprender a cocinar es cometer pequeños errores y ajustar el fuego la próxima vez. ¡Sigue así!`,
        detectedMistake: rating === 'Se quemó' ? 'Fuego demasiado alto o descuido del tiempo' : rating === 'Salado' ? 'Exceso de sal al condimentar' : null,
        personalizedAdvice: 'La próxima vez mantén el fuego un punto más bajo y prueba la comida con una cuchara limpia antes de apagar.',
        xpAwarded: 50,
        skillImproved: 'Control de calor y seguridad en sartenes',
        flavorBoosterLearned: 'Unas gotas de limón o vinagre al final refrescan el plato y cortan cualquier exceso graso.',
        tastePreferenceDetected: 'Gusto por platos reconfortantes y balanceados.',
        toneEvolutionComment: 'Continúa sumando experiencia; cada receta forja tu intuición culinaria.',
      });
    }

    const prompt = `Evalúa el desempeño de un estudiante de cocina que preparó "${recipeTitle}".
Resultado del plato según el usuario: "${rating}" (ej: En su punto, Salado, Seco, Se quemó, Crudo adentro, Le faltó sabor).
Mayor dificultad que enfrentó: "${difficultyEncountered}".
Historial previo de errores del usuario: ${userProfile?.pastMistakes?.join(', ') || 'Ninguno'}.
Habilidades ya dominadas: ${userProfile?.masteredSkills?.join(', ') || 'Mise en place básica'}.
Nivel actual: ${userProfile?.levelTitle || 'Principiante'}.

Genera:
1. Una nota de mentor cálida, muy motivadora y educativa.
2. Si hubo un error técnico, resúmelo en una frase corta para su "Cuaderno de Chef" (ej: "Usa fuego muy alto para dorar", "Se apresura al salar").
3. Un consejo práctico accionable para su próxima receta.
4. XP a otorgar (entre 30 y 80 XP).
5. "skillImproved": una micro-técnica concreta que mejoró o practicó hoy (ej: "Control de llama baja", "Pochado suave de verduras", "Sudar cebolla con paciencia").
6. "flavorBoosterLearned": un secreto culinario o toque de sabor ("flavor booster") aplicable a este tipo de plato (ej: "Un toque de ralladura de cítrico o vinagre suave al retirar del fuego para realzar los aromas").
7. "tastePreferenceDetected": preferencia de paladar detectada según la preparación y el resultado.
8. "toneEvolutionComment": una breve frase indicando cómo evoluciona su relación con el mentor conforme gana confianza.`;

    const response = await callGeminiWithFallback(ai, {
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            mentorNote: { type: Type.STRING },
            detectedMistake: { type: Type.STRING },
            personalizedAdvice: { type: Type.STRING },
            xpAwarded: { type: Type.INTEGER },
            skillImproved: { type: Type.STRING },
            flavorBoosterLearned: { type: Type.STRING },
            tastePreferenceDetected: { type: Type.STRING },
            toneEvolutionComment: { type: Type.STRING },
          },
          required: ['mentorNote', 'personalizedAdvice', 'xpAwarded', 'skillImproved', 'flavorBoosterLearned'],
        },
      },
    });

    const parsed = safeParseGeminiJson(response.text, null as any);
    if (!parsed || !parsed.mentorNote) {
      throw new Error('Gemini eval invalid structure');
    }
    return res.json(parsed);
  } catch (error: any) {
    console.warn('Gemini eval fallback engaged:', error?.message);
    const title = req.body?.recipeTitle || 'tu plato';
    const rat = req.body?.rating || 'Bien';
    let mistake = null;
    let advice = 'Recuerda que bajar el fuego a mínimo a tiempo te da margen de maniobra.';
    let skill = 'Manejo del calor y atención a los sentidos';
    let booster = 'Un chorrito de limón o aceite de oliva crudo al servir despierta cualquier preparación simple.';
    let preference = 'Perfil equilibrado y hogareño';

    if (rat === 'Se quemó') {
      mistake = 'Fuego demasiado alto al dorar o sofreír';
      advice = 'La próxima vez mantén la llama baja y nunca te alejes de la sartén mientras esté al fuego.';
      skill = 'Alerta de fuego y retirada rápida al calor residual';
    } else if (rat === 'Salado') {
      mistake = 'Exceso de sal al condimentar de golpe';
      advice = 'Añade la sal en pequeñas pizcas con los dedos y prueba antes de servir.';
      skill = 'Medición de condimentos al tanteo seguro';
    } else if (rat === 'Crudo adentro') {
      mistake = 'Fuego muy alto que doró por fuera antes de cocinar por dentro';
      advice = 'Baja el fuego a medio-bajo y tapa la sartén para que el calor cocine el centro suavemente.';
      skill = 'Cocción con calor envolvente tapado';
    } else {
      skill = 'Punto de cocción controlado y paciencia';
      booster = 'Una pizca de hierba fresca picada (perejil o cilantro) al final le da aroma de restaurante.';
    }

    return res.json({
      mentorNote: `¡Felicitaciones por cocinar "${title}"! Cada intento te da intuición con el calor y los ingredientes. ¡Vas por excelente camino!`,
      detectedMistake: mistake,
      personalizedAdvice: advice,
      xpAwarded: 50,
      skillImproved: skill,
      flavorBoosterLearned: booster,
      tastePreferenceDetected: preference,
      toneEvolutionComment: 'Has demostrado constancia; el mentor te guiará con recetas con más personalidad.',
    });
  }
});

// 4. Intelligent Level-Adaptive Recommendation ("Tu Siguiente Hito Culinario")
app.post('/api/mentor/recommend-next', async (req, res) => {
  try {
    const { userProfile, recipesCatalog } = req.body;
    const ai = getAi();
    const apiKey = process.env.GEMINI_API_KEY;
    const userLevel = Number(userProfile?.level) || 1;
    const cookedTitles = (userProfile?.cookedHistory || []).map((h: any) => h.recipeTitle);

    const fallbackRecommendations: Record<number, any> = {
      1: {
        recommendedRecipeId: cookedTitles.some((t: string) => t.includes('Huevo') || t.includes('Huevos'))
          ? 'arroz-blanco-perfecto'
          : 'huevos-revueltos-cremosos',
        headline: 'Tu Siguiente Gran Hito de Iniciación (Nivel 1)',
        mentorReasoning: cookedTitles.some((t: string) => t.includes('Huevo') || t.includes('Huevos'))
          ? 'Ya perdiste el miedo a la sartén con los huevos revueltos. Tu siguiente paso fundamental para dominar la cocina es el Arroz Blanco Perfecto: aprenderás la proporción 1:2 y a no destapar la olla.'
          : 'Para empezar desde cero absoluto sin miedo ni quemaduras, los Huevos Revueltos Suaves son la mejor escuela: aprenderás a usar la llama mínima y el calor residual.',
        learningFocus: 'Control de fuego mínimo y proporciones básicas sin prisa.',
        encouragement: 'Todo gran chef empezó sin saber hervir agua. ¡Vamos con calma!',
      },
      2: {
        recommendedRecipeId: 'pechuga-jugosa-sarten',
        headline: 'Desafío de Control Térmico (Nivel 2)',
        mentorReasoning: 'En el Nivel 2 el gran salto es aprender a sellar sin quemar y sin que la comida quede seca adentro. La Pechuga de Pollo Doradita a la Sartén te enseñará el secreto del fuego medio-alto y el reposo jugoso.',
        learningFocus: 'Sellado a fuego medio-alto y cocción con tapa a fuego bajo.',
        encouragement: '¡Ya dominas lo básico! Ahora le damos jugosidad y texturas doradas a tus platos.',
      },
      3: {
        recommendedRecipeId: 'arroz-chaufa-cantones',
        headline: 'Desafío de Fuego Vivo y Salteado (Nivel 3)',
        mentorReasoning: 'Tu cocina ya tiene ritmo. El Arroz Chaufa / Frito Cantones te enseñará a saltear con energía usando arroz frío y a caramelizar la salsa de soya por los bordes calientes.',
        learningFocus: 'Salteado rápido y aprovechamiento inteligente de sobras.',
        encouragement: '¡Manejas la sartén con soltura! Este plato te dará velocidad y sazón callejera.',
      },
      4: {
        recommendedRecipeId: 'omelette-baveuse',
        headline: 'Desafío de Técnica Francesa (Nivel 4)',
        mentorReasoning: 'Es momento de refinar el tacto. El auténtico Omelette Francés Baveuse requiere emulsionar mantequilla espumosa y enrollar el huevo con centro cremoso sin marcas tostadas.',
        learningFocus: 'Emulsión láctea y técnica de muñeca para enrollar.',
        encouragement: 'Tus sentidos culinarios están muy afilados. ¡Sorprende a todos con este clásico!',
      },
      5: {
        recommendedRecipeId: 'arroz-chaufa-cantones',
        headline: 'Creación Libre e Intuición (Nivel 5)',
        mentorReasoning: 'Estás en la cumbre: tu paladar es tu mejor receta. Prueba a personalizar cualquier plato con lo que tengas en la alacena aplicando tus propios sustitutos.',
        learningFocus: 'Ajuste de sazón en tiempo real y cocina intuitiva.',
        encouragement: '¡Eres un referente en tu cocina! Confía en tu olfato y tu gusto.',
      },
    };

    if (!apiKey) {
      return res.json(fallbackRecommendations[userLevel] || fallbackRecommendations[1]);
    }

    const availableListStr = (recipesCatalog || [])
      .map((r: any) => `- ID: "${r.id}" | Título: "${r.title}" | Nivel Requerido: ${r.requiredLevel || 1} | Meta: "${r.learningGoal || r.description}"`)
      .join('\n');

    const prompt = `Actúa como el Chef Mentor de "Chef Cero" en español latinoamericano.
Tu misión es recomendar el SIGUIENTE plato exacto que debe cocinar este aprendiz para evolucionar de principiante a chef.

PERFIL DEL APRENDIZ:
- Nivel Culinario Actual: Nivel ${userLevel} (${userProfile?.levelTitle || 'Cero Absoluto'})
- Platos que ya ha cocinado: ${cookedTitles.join(', ') || 'Aún no ha cocinado ningún plato completo (empezando desde cero total)'}
- Errores pasados registrados: ${userProfile?.pastMistakes?.join(', ') || 'Ninguno'}
- Habilidades ya dominadas: ${userProfile?.masteredSkills?.join(', ') || 'Primeros pasos'}

CATÁLOGO DE RECETAS DISPONIBLES:
${availableListStr}

REGLAS DE SELECCIÓN:
1. Si el usuario es Nivel 1 (Cero Absoluto), sugiere SOLO recetas de Nivel 1 que aún no haya dominado (ej. Huevos revueltos, Fideos con mantequilla, Arroz blanco o Pebre).
2. Si ya cocinó las de Nivel 1 y tiene buen puntaje, o si está cerca de subir a Nivel 2, explícale cómo esta receta lo graduará a su siguiente nivel.
3. Si es Nivel 2, sugiere recetas de Nivel 2 (como Sofrito, Pechuga jugosa o Tortilla de patatas).
4. Explica el razonamiento con calidez pedagógica, sin juzgar, animando al aprendiz y destacando QUÉ técnica específica va a aprender hoy.`;

    const response = await callGeminiWithFallback(ai, {
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            recommendedRecipeId: { type: Type.STRING },
            headline: { type: Type.STRING },
            mentorReasoning: { type: Type.STRING },
            learningFocus: { type: Type.STRING },
            encouragement: { type: Type.STRING },
          },
          required: ['recommendedRecipeId', 'headline', 'mentorReasoning', 'learningFocus', 'encouragement'],
        },
      },
    });

    const parsed = safeParseGeminiJson(response.text, null as any);
    if (!parsed || !parsed.recommendedRecipeId) {
      throw new Error('Gemini recommendation invalid structure');
    }
    return res.json(parsed);
  } catch (error: any) {
    console.warn('Gemini recommendation fallback engaged:', error?.message);
    const userLevel = Number(req.body?.userProfile?.level) || 1;
    const cooked = (req.body?.userProfile?.cookedHistory || []).map((h: any) => h.recipeTitle);
    return res.json({
      recommendedRecipeId: cooked.some((t: string) => t.includes('Huevo')) ? 'arroz-blanco-perfecto' : 'huevos-revueltos-cremosos',
      headline: userLevel === 1 ? 'Tu Siguiente Paso en Nivel 1 (Cero Absoluto)' : `Tu Siguiente Reto en Nivel ${userLevel}`,
      mentorReasoning: 'El camino del cocinero se construye plato a plato. Te recomendamos esta preparación porque afianza tu control del fuego y te dará la confianza para dar el salto al siguiente nivel.',
      learningFocus: 'Control de temperatura y confianza en los sentidos.',
      encouragement: '¡Cada receta completada suma experiencia a tu Cuaderno de Chef!',
    });
  }
});

// 4. Smart Storage query for any unknown food
app.post('/api/storage/query', async (req, res) => {
  try {
    const { foodName } = req.body;
    if (!foodName) {
      return res.status(400).json({ error: 'Nombre de alimento requerido' });
    }

    const ai = getAi();
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.json({
        foodName,
        zoneId: 'alacena',
        zoneName: 'Alacena / Despensa oscura y fresca',
        scientificReason: 'Consérvalo en un lugar seco, fresco y ventilado alejado del sol directo.',
        shelfLife: '7 a 14 días',
        commonMistake: 'Evita guardarlo con humedad o en bolsas de plástico cerradas.',
      });
    }

    const prompt = `Un usuario novato pregunta dónde guardar el alimento: "${foodName}".
Determina la zona EXACTA de la cocina entre estas opciones:
- refrigerador_superior (Zona fría estable 4°C: sobras cocidas, embutidos, quesos duros)
- refrigerador_medio (Zona media 5°C: lácteos, yogur)
- refrigerador_cajon (Cajón de verduras con humedad: hojas verdes, hortalizas)
- refrigerador_puerta (Zona menos fría con cambios de temperatura: mermeladas, salsas)
- congelador (Congelador -18°C: carnes a largo plazo)
- alacena (Alacena seca y fresca 15-20°C: papas, cebollas, ajos, harinas, aceites)
- frutero (Temperatura ambiente con ventilación: tomates, plátanos, aguacates)
- especiero (Gaveta seca lejos del vapor de la estufa: especias)

Explica con claridad científica y cotidiana la razón de esta ubicación y los días estimados de duración.`;

    const response = await callGeminiWithFallback(ai, {
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            foodName: { type: Type.STRING },
            zoneId: { type: Type.STRING },
            zoneName: { type: Type.STRING },
            scientificReason: { type: Type.STRING },
            shelfLife: { type: Type.STRING },
            commonMistake: { type: Type.STRING },
          },
          required: ['foodName', 'zoneId', 'zoneName', 'scientificReason', 'shelfLife'],
        },
      },
    });

    const parsed = safeParseGeminiJson(response.text, null as any);
    if (!parsed || !parsed.zoneId) {
      throw new Error('Gemini storage invalid structure');
    }
    return res.json(parsed);
  } catch (error: any) {
    console.warn('Gemini storage fallback engaged:', error?.message);
    const item = (req.body?.foodName || 'alimento').toLowerCase();
    let zoneId = 'alacena';
    let zoneName = 'Alacena / Despensa oscura y fresca';
    let scientificReason = 'Consérvalo en un lugar seco, fresco y ventilado alejado del sol directo.';
    let shelfLife = '7 a 14 días';
    let commonMistake = 'Evita la humedad excesiva o bolsas plásticas cerradas.';

    if (item.includes('leche') || item.includes('queso') || item.includes('yogur')) {
      zoneId = 'refrigerador_medio';
      zoneName = 'Zona Media del Refrigerador (5°C)';
      scientificReason = 'Los lácteos requieren frío constante para evitar la proliferación de bacterias lácticas.';
      shelfLife = '4 a 7 días abierto';
      commonMistake = 'Guardar la leche en la puerta de la nevera donde la temperatura sube cada vez que se abre.';
    } else if (item.includes('carne') || item.includes('pollo') || item.includes('pescado')) {
      zoneId = 'refrigerador_superior';
      zoneName = 'Zona Fría Superior o Congelador (-18°C)';
      scientificReason = 'Las proteínas crudas requieren frío intenso e higiénico.';
      shelfLife = '1 a 2 días en nevera, meses en congelador';
      commonMistake = 'Dejar carnes crudas goteando sobre otros alimentos.';
    } else if (item.includes('tomate') || item.includes('platano') || item.includes('plátano') || item.includes('aguacate')) {
      zoneId = 'frutero';
      zoneName = 'Frutero en Encimera (Ambiente con ventilación)';
      scientificReason = 'El frío daña sus membranas celulares, volviendo los tomates harinosos y los plátanos negros.';
      shelfLife = '5 a 7 días';
      commonMistake = 'Meter tomates frescos a la nevera, perdiendo todo su aroma dulce natural.';
    }

    return res.json({
      foodName: req.body?.foodName || 'Alimento consultado',
      zoneId,
      zoneName,
      scientificReason,
      shelfLife,
      commonMistake,
    });
  }
});

// Endpoint para rescate inteligente de sobras con IA (Zero Waste estilo Sidekick)
app.post('/api/mentor/rescue-leftover', async (req, res) => {
  try {
    const { leftoverItem } = req.body;
    if (!leftoverItem || typeof leftoverItem !== 'string') {
      return res.status(400).json({ error: 'Falta leftoverItem' });
    }

    const ai = getAi();
    const prompt = `Eres el Chef Mentor de "Chef Cero", una escuela de cocina cálida y paciente para principiantes.
El usuario tiene una sobra en su nevera: "${leftoverItem}".
Explícale con calma cómo transformar esta sobra en un plato delicioso en 10 minutos o menos, sin comprar nada raro.

Devuelve EXCLUSIVAMENTE un objeto JSON válido con este formato:
{
  "headline": "Transformación mágica para: <nombre de la sobra>",
  "scienceReason": "Por qué esta sobra es genial para cocinar (ej: el almidón frío se separa, los azúcares se concentran al secarse)",
  "quickDish": "Instrucción de 3 o 4 líneas de cómo convertirlo en un plato caliente en sartén u olla en menos de 10 min",
  "flavorSecret": "Un truco sencillo para que sepa a comida recién hecha (ej: un toque ácido de limón, orégano, queso derretido)",
  "neverDo": "Un error común a evitar (ej: no recalentar en microondas seco, no dejar fuera de la nevera)"
}`;

    const response = await callGeminiWithFallback(ai, {
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        temperature: 0.4,
      },
    });

    const parsed = safeParseGeminiJson(response.text, {
      headline: `Aprovechar al máximo: ${leftoverItem}`,
      scienceReason: 'La comida ya cocinada necesita calor medio y humedad para revivir sus jugos.',
      quickDish: `Pica la sobra en trozos pequeños, calienta una sartén con un poco de aceite y ajo picado, y saltea 4 minutos a fuego medio. Agrega 1 huevo batido o fideos para armar un plato completo.`,
      flavorSecret: 'Gotitas de limón y una pizca de sal marina al apagar el fuego.',
      neverDo: 'No lo calientes a fuego máximo porque se endurece el exterior y se seca.',
    });

    return res.json(parsed);
  } catch (err: any) {
    console.error('Chef Cero: Error en rescate de sobra:', err);
    return res.json({
      headline: `Transformación rápida para: ${req.body?.leftoverItem || 'sobra'}`,
      scienceReason: 'El calor en sartén reactiva los aromas de la comida cocinada.',
      quickDish: 'Saltea en sartén con una cucharadita de aceite o mantequilla a fuego medio durante 3 a 5 minutos.',
      flavorSecret: 'Un toque de orégano y queso fundido.',
      neverDo: 'Nunca dejes comida cocinada fuera de la nevera más de dos horas.',
    });
  }
});

// Vite middleware in development vs static files in production

async function startServer() {
  const server = http.createServer(app);

  // Servidor WebSocket dedicado para Gemini 3.8 Live API en tiempo real
  const wss = new WebSocketServer({ server, path: '/api/live' });

  wss.on('connection', async (clientWs: WebSocket) => {
    console.log('Chef Cero: Cliente conectado al WebSocket de Live API (/api/live)');
    let session: any = null;
    let isClosed = false;

    try {
      const ai = getAi();
      session = await ai.live.connect({
        model: 'gemini-3.8-live',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Puck' } },
          },
          systemInstruction:
            'Eres Chef Cero, un mentor culinario de voz cálido, empático, paciente y experto para principiantes en español latinoamericano nativo. Habla SIEMPRE en español nativo con acento cálido y acogedor. Respuestas breves, directas y tranquilizadoras de 1 o 2 oraciones, ideales para alguien que está cocinando activamente con las manos ocupadas frente a la sartén.\n' +
            'DIRECTRICES DE RAZONAMIENTO CULINARIO:\n' +
            '1. FILOSOFÍA DE DESPENSA INTELIGENTE (Pantry-First): Al recibir la lista de ingredientes del usuario (por voz o texto), sugiere exclusivamente recetas ejecutables con lo que tiene a mano, sin obligar al usuario a salir a comprar. Asume por defecto una "despensa básica universal" disponible (sal, pimienta, agua corriente y aceite de cocina básico), a menos que el usuario especifique que carece de alguno.\n' +
            '2. PROTOCOLO DE SUSTITUCIÓN DINÁMICA: Si una receta tradicional requiere un elemento faltante no esencial, sugiere de inmediato por voz una sustitución viable utilizando los ingredientes ya inventariados en la sesión o alacena común.\n' +
            '3. PERSISTENCIA DE ESTADO Y GUÍA PASO A PASO: Mantén inmutables los ingredientes confirmados durante toda la interacción culinaria. Guía siempre paso a paso. Si el usuario interrumpe con una duda lateral (ej: técnicas de corte o dudas calóricas), responde de forma breve (1 o 2 oraciones) y retoma de inmediato el paso activo: "Volviendo al paso [N]: [acción]".\n' +
            '4. INTEGRACIÓN DIRECTA CON EL STREAM DE AUDIO Y CANTIDADES LEGIBLES: Todo texto de salida generado debe estructurarse con cantidades fonéticamente legibles para voz (ej: "media cucharadita", "un cuarto de taza", "de dos a tres minutos") para alimentar de forma natural y cristalina el stream de audio a 24kHz.\n' +
            'REGLA FUNDAMENTAL DE PACIENCIA Y RITMO: El usuario está cocinando en tiempo real, oliendo, cortando y pensando sus preguntas. Respeta sus silencios y pausas reflexivas. Si titubea o dice "ehhh...", "a ver...", "espera..." o hace una pausa para mirar su sartén, GUARDA SILENCIO Y DALE ESPACIO para completar su idea. Nunca respondas apresuradamente ni lo cortes.\n' +
            'MODULACIÓN TONAL Y EMOCIONAL: Identifica el tono de voz del usuario:\n' +
            '- Si te habla asustado, alarmado o gritando (humo, fuego, quemado, desborde), responde al instante con firmeza y calma: "¡Apaga la hornilla ya y aparta la sartén del fuego!".\n' +
            '- Si te hace una pregunta, responde con amabilidad pedagógica y un truco fácil.\n' +
            '- Si está pensativo o pausado, responde con calidez y tranquilidad.',
          outputAudioTranscription: {},
          inputAudioTranscription: {},
        },
        callbacks: {
          onmessage: (msg: any) => {
            if (isClosed || clientWs.readyState !== WebSocket.OPEN) return;

            // Enviar audio PCM a 24kHz del Chef Cero
            const audioPart = msg.serverContent?.modelTurn?.parts?.find((p: any) => p.inlineData?.data);
            if (audioPart?.inlineData?.data) {
              clientWs.send(
                JSON.stringify({
                  type: 'audio',
                  data: audioPart.inlineData.data,
                  mimeType: audioPart.inlineData.mimeType || 'audio/pcm;rate=24000',
                })
              );
            }

            // Transcripción en vivo del Chef (se va añadiendo al chat)
            if (msg.serverContent?.outputTranscription?.text) {
              clientWs.send(
                JSON.stringify({
                  type: 'outputTranscription',
                  text: msg.serverContent.outputTranscription.text,
                })
              );
            }

            // Transcripción en vivo de lo que dice el usuario
            if (msg.serverContent?.inputTranscription?.text) {
              clientWs.send(
                JSON.stringify({
                  type: 'inputTranscription',
                  text: msg.serverContent.inputTranscription.text,
                })
              );
            }

            // Si el usuario interrumpe al chef hablando
            if (msg.serverContent?.interrupted) {
              clientWs.send(JSON.stringify({ type: 'interrupted' }));
            }

            // Si la respuesta ha terminado
            if (msg.serverContent?.turnComplete || msg.serverContent?.generationComplete) {
              clientWs.send(JSON.stringify({ type: 'turnComplete' }));
            }
          },
          onclose: () => {
            if (!isClosed && clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(JSON.stringify({ type: 'sessionClosed' }));
            }
          },
          onerror: (err: any) => {
            console.warn('Chef Cero: Error en Live API session:', err?.message || err);
            if (!isClosed && clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(JSON.stringify({ type: 'error', message: 'Error en conexión con Live API' }));
            }
          },
        },
      });

      clientWs.send(JSON.stringify({ type: 'ready', model: 'gemini-3.8-live' }));
    } catch (err: any) {
      console.error('Chef Cero: No se pudo conectar a Gemini Live:', err?.message || err);
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(
          JSON.stringify({
            type: 'error',
            message: 'No se pudo iniciar Gemini 3.8 Live API, recurriendo a modo chat estándar.',
          })
        );
        clientWs.close();
      }
      return;
    }

    clientWs.on('message', async (data: any, isBinary: boolean) => {
      if (!session || isClosed) return;
      try {
        // Optimización de Ultra-Baja Latencia: Streaming binario directo (Int16 PCM)
        if (isBinary || (Buffer.isBuffer(data) && data.length > 0 && data[0] !== 123 /* '{' */)) {
          const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
          session.sendRealtimeInput({
            audio: { data: buf.toString('base64'), mimeType: 'audio/pcm;rate=16000' },
          });
          return;
        }

        const msg = JSON.parse(data.toString());

        // Heartbeat y medición de latencia RTT de red en tiempo real
        if (msg.type === 'ping') {
          if (clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(
              JSON.stringify({
                type: 'pong',
                clientTime: msg.clientTime,
                serverTime: Date.now(),
              })
            );
          }
          return;
        }

        if (msg.type === 'tone_update' && msg.tone) {
          // Loggear y enviar contexto sutil si aplica
          console.log(`Chef Cero Live: Tono emocional del usuario actualizado a: ${msg.tone}`);
          return;
        }

        if (msg.type === 'audio' && msg.data) {
          // Enviar audio PCM de 16kHz al modelo Live
          session.sendRealtimeInput({
            audio: { data: msg.data, mimeType: 'audio/pcm;rate=16000' },
          });
        } else if (msg.type === 'text' && msg.text) {
          session.sendRealtimeInput({
            text: msg.text,
          });
        }
      } catch (e: any) {
        console.warn('Chef Cero: Error procesando mensaje de cliente en Live WebSocket:', e?.message);
      }
    });

    clientWs.on('close', async () => {
      isClosed = true;
      if (session) {
        try {
          await session.close();
        } catch (_) {}
        session = null;
      }
    });

    clientWs.on('error', async (err) => {
      console.warn('Chef Cero: WebSocket error:', err);
      isClosed = true;
      if (session) {
        try {
          await session.close();
        } catch (_) {}
        session = null;
      }
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Chef Cero server running on http://0.0.0.0:${PORT} (HTTP + WebSockets Live API en /api/live)`);
  });
}

startServer();
