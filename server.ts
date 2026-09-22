import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';
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
  try {
    const { message, userProfile, currentContext } = req.body;
    if (!message) {
      return res.status(400).json({ error: 'Mensaje requerido' });
    }

    const ai = getAi();
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.json({
        reply: `¡Hola! Como tu Chef Mentor de Chef Cero: ${message.includes('aceite') ? '¡Cuidado! Si el aceite humea, retira la sartén del fuego de inmediato hacia una hornalla apagada. Nunca eches agua.' : 'Mantén la calma. Baja el fuego al mínimo y dime exactamente qué estás viendo en la sartén.'}`,
        safetyAlert: message.toLowerCase().includes('humo') || message.toLowerCase().includes('quema') ? 'Peligro de quemado: aparta la olla del calor.' : null,
        suggestedAction: 'Bajar fuego a mínimo',
      });
    }

    const userMistakes = userProfile?.pastMistakes?.length
      ? userProfile.pastMistakes.join(', ')
      : 'Novato sin historial previo';
    const userLevel = userProfile?.levelTitle || 'Nivel 1: Principiante Total';

    const systemInstruction = `Eres "Chef Cero", un mentor culinario de voz cálido, paciente, pedagógico y calmado en español.
Tu usuario NO SABE ABSOLUTAMENTE NADA de cocina. No uses términos técnicos sin explicarlos.
Tu máxima prioridad es la SEGURIDAD personal y evitar que se queme la comida o la sartén.

REGLAS DE ORO CULTURALES UNIVERSALES PARA PRINCIPIANTES:
- Comida Chilena & Criolla: El sofrito de cebolla se suda a fuego muy lento con calma (10 min) para que quede dulce y no dé ardor ("no repita"); comino y ají de color en pizca justa; el choclo y la papa dan consistencia barata y rica.
- Comida Mexicana: Dorar chiles secos toma solo 20 segundos por lado; si se queman amargan toda la salsa. Las tortillas se doran con poco aceite para evitar salpicaduras; limón y cilantro aportan balance fresco.
- Comida Asiática (China, Tailandesa, Japonesa): El arroz frito SIEMPRE debe ser arroz frío del día anterior para que no se apelmace; el ajo y jengibre rallados se queman en 5 segundos en fuego alto, agrégalos con el fuego medio o con la salsa; saltea en tandas. Sustituye mirin con vinagre de manzana + azúcar; salsa de pescado con soya + limón.
- Comida Italiana: Salar el agua de pasta como agua de mar; reservar siempre 1 taza del agua con almidón para emulsionar la salsa (mantecatura); el ajo se confita a fuego mínimo sin que pase de rubio pálido.
- Comida Española: Las patatas de la tortilla se pochan tiernas en aceite medio-bajo, nunca fritas crujientes; voltear la tortilla con plato llano más grande que la sartén sin titubeos.
- Comida Francesa: Mantequilla a fuego dulce espumosa sin que se queme; un omelette es suave, sin costra marrón y jugoso al centro.
- FILOSOFÍA ECONÓMICA BBB (Buena, Bonita y Barata): Prioriza ingredientes económicos y versátiles (huevos, papas, arroz, legumbres, cebolla, fideos) y ofrece sustitutos de despensa para que el usuario no gaste de más.

Perfil del estudiante:
- Nivel actual: ${userLevel}
- Errores típicos y tendencias previas registradas: ${userMistakes}
- Contexto de cocina actual: ${currentContext ? JSON.stringify(currentContext) : 'En cocina libre o consultando'}

Instrucciones para tus respuestas:
1. Sé conciso y directo (el usuario está cocinando con las manos ocupadas o escuchando por voz). Máximo 2 a 4 oraciones claras.
2. Si menciona humo, aceite que chisporrotea, fuego alto o comida que se quema, da la instrucción de seguridad PRIMERO en mayúsculas amables (ej. "¡RETIRA LA SARTÉN DEL FUEGO AHORA MISMO!").
3. Si el usuario pide un temporizador (ej. "pon 8 minutos"), indícalo claramente con los segundos para que la app pueda activarlo.
4. Si pregunta por secretos de comida chilena, mexicana, asiática, etc., dale la regla de oro cultural sin vueltas técnicas.
5. Toma en cuenta sus errores pasados (por ejemplo, si suele quemar el ajo, recuérdale con cariño que vigile el dorado).`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: message,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            reply: {
              type: Type.STRING,
              description: 'Respuesta hablada calmada, clara y directa para el usuario.',
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
              description: 'Etiqueta breve para el temporizador, ej: Fideos o Cocción.',
            },
            heatAdjustment: {
              type: Type.STRING,
              description: 'Ajuste de llama sugerido: bajo, medio, alto, apagar, o mantener.',
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
    return res.json(parsed);
  } catch (error: any) {
    console.warn('Gemini chat fallback engaged:', error?.message);
    const msg = (req.body?.message || '').toLowerCase();
    const isOilSmoke = msg.includes('aceite') || msg.includes('humo') || msg.includes('quema');
    const isTimer = msg.includes('minuto') || msg.includes('tiempo') || msg.includes('temporizador');

    let reply = 'Respira hondo y mantén la calma. Si sientes olor a quemado o ves humo, retira la sartén hacia una hornalla apagada ahora mismo. Cuéntame qué estás cocinando.';
    let safetyAlert = null;
    let timerSecondsRequested = 0;
    let timerLabel = '';

    if (isOilSmoke) {
      reply = '¡RETIRA LA SARTÉN DEL FUEGO DE INMEDIATO! Apaga la hornalla. NUNCA le eches agua al aceite caliente. Tapa la sartén con una tapa metálica si es necesario y déjala enfriar.';
      safetyAlert = '¡PELIGRO DE FUEGO! Retira la sartén del calor inmediatamente.';
    } else if (msg.includes('pollo')) {
      reply = 'Para saber si el pollo está cocido sin termómetro: pincha la parte más gruesa con un cuchillo o tenedor. El jugo que sale debe ser completamente transparente. Si sale rosado o rojizo, le falta fuego bajo tapado por unos minutos más.';
    } else if (isTimer) {
      const match = msg.match(/\b(\d+)\b/);
      const minutes = match ? parseInt(match[1], 10) : 5;
      timerSecondsRequested = minutes * 60;
      timerLabel = `Cocción ${minutes} min`;
      reply = `He activado tu temporizador de ${minutes} minutos. Puedes relajarte mientras cuidas el fuego a intensidad moderada.`;
    }

    return res.json({
      reply,
      safetyAlert,
      timerSecondsRequested,
      timerLabel,
      heatAdjustment: isOilSmoke ? 'apagar' : 'bajo',
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

    const prompt = `Crea una receta a prueba de novatos absolutos con estos ingredientes: "${ingredients || 'huevos, cebolla, pan'}".
Perfil del aprendiz:
- Nivel: ${userProfile?.levelTitle || 'Principiante'}
- Errores pasados que comete: ${userProfile?.pastMistakes?.join(', ') || 'Ninguno registrado'}
Comida objetivo: ${targetMeal || 'Almuerzo o cena fácil'}.
Estilo Culinario Solicitado: ${requestedCuisineNote}
${budgetFocus ? 'ENFOQUE ECONÓMICO ACTIVO: Diseña el plato para que sea ultra accesible (BBB: Buena, Bonita y Barata) usando alimentos rendidores.' : ''}

REGLAS CRÍTICAS PARA CHEF CERO:
1. "Mise en place": Lista obligatoria de todo lo que debe estar lavado, pelado, medido y en pocillos ANTES de encender el fuego.
2. Cada paso debe tener su nivel de fuego explícito ('bajo', 'medio', 'alto', 'apagado') y temporizadores precisos en segundos si requiere tiempo.
3. Incluye pistas sensoriales en cada paso (vista/sight, oído/sound, olfato/smell) para que el novato sepa si va bien.
4. "culturalSecret": Incluye el secreto de oro de esa cultura explicado en 1-2 oraciones amables.
5. "pantrySubstitutes": Lista de 1 a 3 sustitutos baratos de alacena para que el usuario no tenga que gastar de más.
6. Incluye alertas de seguridad hiper-específicas para principiantes.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
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
      });
    }

    const prompt = `Evalúa el desempeño de un novato cocinando "${recipeTitle}".
Resultado del plato según el usuario: "${rating}" (ej: En su punto, Salado, Seco, Se quemó, Crudo adentro, Le faltó sabor).
Mayor dificultad que enfrentó: "${difficultyEncountered}".
Historial previo de errores del usuario: ${userProfile?.pastMistakes?.join(', ') || 'Ninguno'}.

Genera:
1. Una nota de mentor cariñosa, muy motivadora y educativa.
2. Si hubo un error técnico, resúmelo en una frase corta para su "Cuaderno de Chef" (ej: "Usa fuego muy alto para dorar", "Se apresura al salar").
3. Un consejo práctico accionable para su próxima receta.
4. XP a otorgar (entre 30 y 80 XP).`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
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
          },
          required: ['mentorNote', 'personalizedAdvice', 'xpAwarded'],
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
    if (rat === 'Se quemó') {
      mistake = 'Fuego demasiado alto al dorar o sofreír';
      advice = 'La próxima vez mantén la llama baja y nunca te alejes de la sartén mientras esté al fuego.';
    } else if (rat === 'Salado') {
      mistake = 'Exceso de sal al condimentar de golpe';
      advice = 'Añade la sal en pequeñas pizcas con los dedos y prueba antes de servir.';
    } else if (rat === 'Crudo adentro') {
      mistake = 'Fuego muy alto que doró por fuera antes de cocinar por dentro';
      advice = 'Baja el fuego a medio-bajo y tapa la sartén para que el calor cocine el centro suavemente.';
    }

    return res.json({
      mentorNote: `¡Felicitaciones por cocinar "${title}"! Cada intento te da intuición con el calor y los ingredientes. ¡Vas por excelente camino!`,
      detectedMistake: mistake,
      personalizedAdvice: advice,
      xpAwarded: 50,
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

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
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

// Vite middleware in development vs static files in production
async function startServer() {
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

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Chef Cero server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
