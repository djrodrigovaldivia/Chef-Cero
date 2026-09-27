# Plan de Implementación: Escáner de Producto con 3 Recetas Progresivas (Principiante, Intermedio y Experto)

Este plan detalla la arquitectura e implementación para permitir a cualquier usuario tomarle una foto a un ingrediente o producto de su cocina y recibir al instante 3 recetas diseñadas para diferentes niveles culinarios, listas para ser cocinadas en el modo interactivo en vivo.

---

## 1. Resumen de la Funcionalidad

- **Disparador:** El usuario toma o sube una foto de cualquier producto o ingrediente (un tomate, una pechuga, arroz, berenjenas, huevos, etc.).
- **Procesamiento de Visión IA (Gemini 3.8 Flash):**
  - Identificación precisa del producto y sus características.
  - Estimación calórica base y aporte nutricional.
  - Generación de **3 recetas estructuradas por nivel de destreza**:
    1. **Nivel Principiante (Cero Absoluto / Aprendiz):** Máximo 3-4 pasos, técnica sin riesgo de salpicaduras o quemado, uso de fuego bajo/medio y despensa básica mínima (aceite, sal, agua).
    2. **Nivel Intermedio (Cocinero Casero Seguro):** Control térmico (sofrito prolongado, sellado jugoso, reducción o salteado al dente), técnica culinaria clave y balance de texturas.
    3. **Nivel Experto (Alta Cocina / Chef Creativo):** Técnicas avanzadas (emulsión fuera de fuego, desglasado, glaseado, contraste sensorial y emplatado de autor).
- **Detalles en cada receta:**
  - Tiempo de preparación exacto en minutos.
  - Calorimetría estimada (Kcal por porción).
  - Lista de ingredientes adicionales de alacena necesarios.
  - Pasos guiados interactivos (`instruction`, `heatLevel`, `tip`, `timerSeconds`) para cocinar en vivo con temporizadores y asistencia por voz de Chef Cero.

---

## 2. Cambios en Backend (`server.ts`)

- **Nuevo Endpoint:** `POST /api/product-trio-recipes`
  - Recibe `{ imageBase64, mimeType, userProfile }`.
  - Invoca `callGeminiWithFallback` con `gemini-3.8-flash` usando multimodal vision (`inlineData`) y `responseSchema` JSON estricto.
  - Estructura de respuesta:
    ```typescript
    {
      productDetected: string;
      productCategory: string;
      baseCaloriesEst: string;
      recipes: [
        {
          id: string;
          level: 'principiante' | 'intermedio' | 'experto';
          levelNumber: 1 | 3 | 5;
          levelBadge: string;
          title: string;
          description: string;
          totalTimeMinutes: number;
          estimatedCalories: number; // Kcal
          difficulty: string;
          heroTechnique: string;
          additionalIngredients: string[];
          steps: Array<{
            stepNumber: number;
            title: string;
            instruction: string;
            tip: string;
            heatLevel: 'apagado' | 'bajo' | 'medio' | 'alto';
            timerSeconds: number;
            timerLabel?: string;
          }>;
          culturalSecret?: string;
        }
      ]
    }
    ```
  - Incluye fallback robusto offline en caso de cortes de conexión o límites de API.

---

## 3. Cambios en Frontend

### A. Tipos (`src/types/index.ts` o `FridgeScannerModal.tsx`)
- Definición de tipos para `ProductTrioResult`, `TrioRecipe` y extensión de `ScannerMode = 'inspect_product' | 'fridge' | 'level_trio'`.

### B. Componente `src/components/FridgeScannerModal.tsx`
- Añadir la pestaña **"3 Niveles (1 Producto)"** en la barra superior de modos del modal con icono y etiqueta visual distintiva.
- Interfaz de captura fotográfica optimizada para móviles (cámara trasera directa en smartphones o selector de galería).
- Panel de resultados con:
  - Tarjeta de identificación del producto y calorimetría general.
  - Selector interactivo de nivel culinario (🟢 Principiante | 🟡 Intermedio | 🔴 Experto) con resumen de tiempo, Kcal e ingredientes adicionales requeridos.
  - Botón directo **"Cocinar este Nivel en Vivo"** que transforma la receta seleccionada en el formato completo de `Recipe` y activa el **`CookingMode`** con voz de Chef Cero, temporizadores por paso y guía de fuego.

### C. Navegación e Integración (`src/components/Navbar.tsx` & `src/App.tsx`)
- Permitir abrir directamente el escáner en el modo "3 Niveles" desde accesos rápidos o atajos de la barra de navegación para máxima comodidad.

---

## 4. Fases de Verificación

1. **Prueba de tipos y compilación:** Ejecución de `compile_applet` para garantizar que la integración TypeScript esté limpia sin errores de build.
2. **Prueba de conversión a Modo Cocina:** Verificar que al seleccionar cualquiera de las 3 recetas (principiante, intermedio o experto), el flujo se conecte sin interrupciones con el asistente interactivo de cocina paso a paso.
