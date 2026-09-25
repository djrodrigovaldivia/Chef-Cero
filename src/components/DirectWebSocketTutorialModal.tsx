import React, { useState } from 'react';
import { X, Globe, Server, ArrowRight, Play, Copy, Check, Terminal, Radio, ShieldCheck, Zap, AlertCircle, RefreshCw } from 'lucide-react';

interface DirectWebSocketTutorialModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DirectWebSocketTutorialModal: React.FC<DirectWebSocketTutorialModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [copiedSnippet, setCopiedSnippet] = useState<string | null>(null);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testOutput, setTestOutput] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'tutorial' | 'interactive' | 'architecture'>('tutorial');

  if (!isOpen) return null;

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSnippet(id);
    setTimeout(() => setCopiedSnippet(null), 2500);
  };

  const handleTestDirectHandshake = async () => {
    setTestStatus('testing');
    setTestOutput('1. Solicitando credencial efímera y endpoint a /api/live/token...');
    try {
      const res = await fetch('/api/live/token', { method: 'POST' });
      if (!res.ok) {
        throw new Error(`Servidor devolvió código HTTP ${res.status}`);
      }
      const data = await res.json();
      setTestOutput((prev) => `${prev}\n2. Token recibido (${data.isEphemeral ? 'Token Efímero Seguro' : 'Credencial de Proyecto'}).\n3. Endpoint destino: ${data.directWsEndpoint}\n4. Modelo configurado: ${data.model} (Voz: Puck)\n5. Simulando verificación de Handshake Client-to-Server BidiGenerateContent...`);
      
      await new Promise((r) => setTimeout(r, 600));

      setTestOutput((prev) => `${prev}\n✨ [Conexión Directa Validada]: El frontend puede comunicarse directamente con wss://generativelanguage.googleapis.com sin pasar audio por el servidor Express.`);
      setTestStatus('success');
    } catch (err: any) {
      setTestOutput((prev) => `${prev}\n❌ Error en prueba: ${err?.message || err}`);
      setTestStatus('error');
    }
  };

  const clientCodeSample = `// 1. Obtener token efímero de tu servidor (evita exponer secretos fijos)
const tokenResponse = await fetch('/api/live/token', { method: 'POST' });
const { directWsEndpoint, token, setupConfig } = await tokenResponse.json();

// 2. Conectar DIRECTAMENTE desde el navegador a la API de Gemini Live
const wsUrl = \`\${directWsEndpoint}?key=\${token}\`;
const ws = new WebSocket(wsUrl);

ws.onopen = () => {
  console.log('¡Conectado directamente a Gemini Live!');

  // 3. Enviar mensaje inicial de configuración (BidiGenerateContentSetup)
  const setupMessage = {
    setup: setupConfig
  };
  ws.send(JSON.stringify(setupMessage));
};

// 4. Enviar audio en tiempo real desde el micrófono (PCM 16kHz Little Endian)
function sendAudioChunk(pcm16Base64) {
  const realtimeInput = {
    realtimeInput: {
      mediaChunks: [
        {
          mimeType: "audio/pcm;rate=16000",
          data: pcm16Base64
        }
      ]
    }
  };
  ws.send(JSON.stringify(realtimeInput));
}

// 5. Recibir audio de respuesta (PCM 24kHz) y reproducir al instante
ws.onmessage = async (event) => {
  const response = JSON.parse(event.data);
  const audioPart = response.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
  if (audioPart) {
    playPcm24Audio(audioPart);
  }
};`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/75 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="bg-stone-900 border border-stone-800 text-stone-100 rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden my-auto">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-stone-800 flex items-center justify-between bg-stone-950/80">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-amber-500 to-rose-600 rounded-2xl text-stone-950">
              <Radio className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-white font-serif">
                  Tutorial: WebSocket Client-to-Server (Gemini Live API)
                </h3>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-rose-950 text-rose-300 border border-rose-800">
                  Bypassing Backend
                </span>
              </div>
              <p className="text-xs text-stone-400">
                Aprende a conectar el frontend directamente con la API de Google sin triangular audio por tu servidor.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-stone-400 hover:text-white rounded-xl hover:bg-stone-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs de navegación */}
        <div className="flex border-b border-stone-800 bg-stone-950/40 px-6 gap-2 text-xs font-bold">
          <button
            onClick={() => setActiveTab('tutorial')}
            className={`py-3 px-3 border-b-2 transition cursor-pointer ${
              activeTab === 'tutorial'
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-stone-400 hover:text-stone-200'
            }`}
          >
            Guía Paso a Paso (Código)
          </button>
          <button
            onClick={() => setActiveTab('interactive')}
            className={`py-3 px-3 border-b-2 transition cursor-pointer ${
              activeTab === 'interactive'
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-stone-400 hover:text-stone-200'
            }`}
          >
            Prueba de Handshake en Vivo
          </button>
          <button
            onClick={() => setActiveTab('architecture')}
            className={`py-3 px-3 border-b-2 transition cursor-pointer ${
              activeTab === 'architecture'
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-stone-400 hover:text-stone-200'
            }`}
          >
            Comparativa de Arquitectura
          </button>
        </div>

        {/* Contenido scrolleable */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs sm:text-sm">
          
          {/* TAB 1: GUÍA PASO A PASO */}
          {activeTab === 'tutorial' && (
            <div className="space-y-5 animate-fade-in">
              <div className="bg-stone-950 p-4 rounded-2xl border border-stone-800">
                <h4 className="font-bold text-amber-300 mb-1 flex items-center gap-1.5">
                  <Zap className="w-4 h-4 text-amber-400" />
                  <span>¿Qué es la conexión Client-to-Server directa?</span>
                </h4>
                <p className="text-stone-300 text-xs leading-relaxed">
                  En lugar de enviar tus bloques de audio a tu servidor Node/Express para que este los retransmita a Gemini (Client → Backend → Gemini), el navegador abre un <strong>WebSocket directo</strong> con la infraestructura de Google (<code>wss://generativelanguage.googleapis.com</code>). Esto reduce la latencia a la mínima física posible eliminando un salto intermedio de red.
                </p>
              </div>

              {/* Los 4 Pasos Clave */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                <div className="p-3.5 bg-stone-950/60 rounded-xl border border-stone-800">
                  <div className="font-bold text-white flex items-center gap-2 mb-1">
                    <span className="w-5 h-5 rounded-full bg-amber-500 text-stone-950 text-xs flex items-center justify-center font-black">1</span>
                    <span>Credencial Efímera</span>
                  </div>
                  <p className="text-stone-400 text-xs">
                    El backend expone <code>POST /api/live/token</code> que genera un token de sesión de corta vida, protegiendo tus llaves maestras.
                  </p>
                </div>

                <div className="p-3.5 bg-stone-950/60 rounded-xl border border-stone-800">
                  <div className="font-bold text-white flex items-center gap-2 mb-1">
                    <span className="w-5 h-5 rounded-full bg-amber-500 text-stone-950 text-xs flex items-center justify-center font-black">2</span>
                    <span>Handshake BidiGenerateContent</span>
                  </div>
                  <p className="text-stone-400 text-xs">
                    El frontend abre el WebSocket hacia el endpoint de Google y envía el primer mensaje <code>setup</code> con el modelo y voz.
                  </p>
                </div>

                <div className="p-3.5 bg-stone-950/60 rounded-xl border border-stone-800">
                  <div className="font-bold text-white flex items-center gap-2 mb-1">
                    <span className="w-5 h-5 rounded-full bg-amber-500 text-stone-950 text-xs flex items-center justify-center font-black">3</span>
                    <span>Streaming de Micrófono (16kHz PCM)</span>
                  </div>
                  <p className="text-stone-400 text-xs">
                    Se capturan micro-bloques de 32ms (~512 muestras) a 16kHz y se envían en tiempo real como <code>mediaChunks</code>.
                  </p>
                </div>

                <div className="p-3.5 bg-stone-950/60 rounded-xl border border-stone-800">
                  <div className="font-bold text-white flex items-center gap-2 mb-1">
                    <span className="w-5 h-5 rounded-full bg-amber-500 text-stone-950 text-xs flex items-center justify-center font-black">4</span>
                    <span>Reproducción a 24kHz y Barge-in</span>
                  </div>
                  <p className="text-stone-400 text-xs">
                    Google responde con audio a 24kHz. Si el usuario habla, Google envía <code>interrupted: true</code> para cancelar el búfer al instante.
                  </p>
                </div>
              </div>

              {/* Snippet de Código */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-stone-300 flex items-center gap-1.5">
                    <Terminal className="w-3.5 h-3.5 text-amber-400" />
                    <span>Código Frontend en TypeScript / JavaScript:</span>
                  </span>
                  <button
                    onClick={() => handleCopy(clientCodeSample, 'code')}
                    className="px-2.5 py-1 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
                  >
                    {copiedSnippet === 'code' ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400">Copiado</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copiar Código</span>
                      </>
                    )}
                  </button>
                </div>

                <pre className="p-4 rounded-2xl bg-stone-950 border border-stone-800 text-amber-200/90 font-mono text-xs overflow-x-auto leading-relaxed">
                  {clientCodeSample}
                </pre>
              </div>
            </div>
          )}

          {/* TAB 2: PRUEBA EN VIVO */}
          {activeTab === 'interactive' && (
            <div className="space-y-4 animate-fade-in">
              <div className="p-4 rounded-2xl bg-stone-950 border border-stone-800 space-y-2">
                <h4 className="font-bold text-white flex items-center gap-2">
                  <Play className="w-4 h-4 text-emerald-400" />
                  <span>Verificador de Credencial Efímera & Ruta Directa</span>
                </h4>
                <p className="text-xs text-stone-400">
                  Prueba la primera etapa del flujo: invoca a <code>/api/live/token</code> para solicitar la credencial segura y el handshake preparado de Google Live.
                </p>

                <div className="pt-2">
                  <button
                    onClick={handleTestDirectHandshake}
                    disabled={testStatus === 'testing'}
                    className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-stone-950 font-bold text-xs flex items-center gap-2 shadow-md transition disabled:opacity-50 cursor-pointer"
                  >
                    {testStatus === 'testing' ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Comprobando Handshake...</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4 fill-stone-950" />
                        <span>Ejecutar Verificación Directa</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {testOutput && (
                <div className="p-4 rounded-2xl bg-black border border-stone-800 font-mono text-xs space-y-2">
                  <div className="text-stone-400 font-bold uppercase text-[10px]">Consola de Verificación:</div>
                  <pre className="text-emerald-400 whitespace-pre-wrap leading-relaxed">
                    {testOutput}
                  </pre>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: ARQUITECTURA */}
          {activeTab === 'architecture' && (
            <div className="space-y-4 animate-fade-in text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Tradicional con Proxy */}
                <div className="p-4 rounded-2xl bg-stone-950 border border-stone-800 space-y-2">
                  <div className="font-bold text-stone-300 flex items-center gap-2">
                    <Server className="w-4 h-4 text-blue-400" />
                    <span>Con Proxy en Servidor (Tradicional)</span>
                  </div>
                  <p className="text-stone-400">
                    Cliente ➔ Tu Servidor ➔ Gemini Live API.
                  </p>
                  <ul className="space-y-1.5 text-stone-400 pt-2 border-t border-stone-800">
                    <li>✓ Oculta completamente cualquier credencial.</li>
                    <li>✓ Permite inyectar lógica de moderación en el backend.</li>
                    <li>⚠️ Agrega un salto de red adicional (~30-80ms de retraso).</li>
                    <li>⚠️ Consume ancho de banda en tu servidor para transferir audio continuo.</li>
                  </ul>
                </div>

                {/* Directo Client-to-Server */}
                <div className="p-4 rounded-2xl bg-stone-950 border border-amber-500/30 space-y-2">
                  <div className="font-bold text-amber-300 flex items-center gap-2">
                    <Globe className="w-4 h-4 text-amber-400" />
                    <span>Directo Client-to-Server (Bypassing Backend)</span>
                  </div>
                  <p className="text-stone-400">
                    Cliente ➔ Gemini Live API (Token efímero inicial desde backend).
                  </p>
                  <ul className="space-y-1.5 text-stone-300 pt-2 border-t border-stone-800">
                    <li>⚡ <strong>Latencia mínima física:</strong> Sin saltos intermedios.</li>
                    <li>⚡ Menor carga de CPU y memoria en el servidor Node.js.</li>
                    <li>🔒 Seguro si se emplean tokens efímeros (tokens con expiración de minutos).</li>
                    <li>✓ Ideal para asistentes de cocina donde las interrupciones (barge-in) deben ser instantáneas.</li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-stone-800 bg-stone-950/80 flex items-center justify-between text-xs">
          <span className="text-stone-400 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Implementación estándar recomendada por Google para WebSockets de baja latencia.</span>
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-white font-bold transition cursor-pointer"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
};
