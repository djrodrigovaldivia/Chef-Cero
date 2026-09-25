# Plan: Sección de 'Recetas de Autor' (Alta Gastronomía & Experimentación de Nivel Experto)

Implementación de un estudio culinario de autor (**Signature Dishes / Taller de Autor**) en el Modo Completo de **Chef Cero**, donde el usuario puede idear y crear propuestas gastronómicas de nivel experto asistido por IA (mediante parámetros sensoriales/técnicos de alta cocina o mediante un lienzo de texto libre/concepto), guardar sus recetas de autor en su recetario personal persistente, y cocinarlas con el flujo interactivo de 3 etapas (Mise en Place, Control de Hornallas y Temporizadores).

---

## User Review & Critical Decisions

> [!IMPORTANT]
> Decisiones confirmadas a partir de tus respuestas:
> - **Método de Ideación**: Modo dual — Asistido por parámetros gastronómicos (técnica clave, perfil umami/ácido/ahumado, proteína o vegetal estrella, maridaje sugerido) o Modo Texto Libre / Lienzo Abierto.
> - **Ubicación en Modo Completo**: Nueva pestaña y sección dedicada `'autor'` en la barra de navegación del Modo Completo (junto a *Cocinar*, *Rescate de Sobras*, *Diccionario*, etc.).
> - **Persistencia**: Almacenamiento local persistente (`localStorage`) en el perfil del usuario para coleccionar sus propias creaciones con fecha, notas de autor, ajustes personales y la opción de exportarlas o cocinarlas directamente.

---

## 1. Overview & Core Concept

- **Qué hace**: Un laboratorio culinario interactivo donde cualquier usuario (desde aprendiz hasta nivel 5) puede concebir recetas de autor únicas de nivel experto, combinando técnicas avanzadas (como *mantecatura all'onda*, *sellado bimodal*, *emulsiones a baja temperatura*, *desglasados y reducciones*, *tatemados y contrastes de texturas*). La IA estructura la narrativa del plato, por qué funciona la combinación química de sabores, el maridaje sensorial y el paso a paso riguroso con checkpoints térmicos y auditivos.
- **Público Objetivo**: Usuarios que ya superaron el miedo inicial a la estufa y desean dar el salto a la cocina creativa y de restaurante, así como curiosos que quieren diseñar su propio plato insignia para ocasiones especiales.
- **Valor Clave**: Eleva la experiencia de la app de "aprender lo básico sin quemar nada" a "convertirse en un chef de autor con su propia biblioteca de creaciones".

---

## 2. User Experience & Visual Design

### Flujo del Usuario
1. **Acceso**: El usuario entra al Modo Completo y selecciona la pestaña **"Recetas de Autor"** (con insignia dorada `✨ / 👑`).
2. **Selector de Modalidad Creativa**:
   - **Taller Guiado por Parámetros**:
     - *Ingrediente / Protagonista*: (ej. Salmón salvaje, Coliflor caramelizada, Lomo, Setas portobello).
     - *Técnica Maestra*: (ej. Emulsión tibia, Confitado suave, Salteado a alta temperatura, Desglasado con reducción).
     - *Perfil Gustativo*: (ej. Ácido-cítrico yodado, Grasa untuosa con notas torrefactas, Dulzor ahumado umami).
     - *Estilo Culinario*: (ej. Fusión Nórdica-Japonesa, Vanguardia Mediterránea, Criollo Contemporáneo, Neotaberna).
   - **Lienzo Libre**: Un área de inspiración en blanco donde el usuario describe su visión o anécdota (ej. *"Quiero un plato de pasta con higos y reducción de vinagre balsámico con toque crujiente"*).
3. **Generación con IA de Alta Cocina**:
   - Llamada al endpoint `/api/recipe/author-craft` en el servidor con fallback sensorial instantáneo offline para garantizar que siempre funcione.
   - Presentación de la **Ficha de Autor**:
     - *Nombre Poético / Narrativo del Plato*.
     - *El Porqué Científico-Sensorial* (por qué conviven esos ingredientes en el paladar).
     - *Checkpoints de Emplatado & Maridaje Recomendado*.
     - *Mise en Place y Pasos de Nivel Experto con control de temperatura exacto*.
4. **Acciones de la Receta Creada**:
   - **"Guardar en Mi Cuaderno de Autor"**: Se guarda de forma permanente con opción de agregar notas personales del chef.
   - **"Cocinar Ahora Mismo"**: Carga la receta directamente en el motor de cocción guiada (etapa *Mise en Place* y *Fuegos* con sus temporizadores).
   - **Biblioteca Personal de Creaciones**: Galería de recetas creadas previamente por el usuario, con fecha de creación, nivel requerido y botón para cocinar o editar notas.

### Identidad Visual y Estilo (según `frontend-design`)
- **Atmósfera Editorial & Estudio Gastronómico**: Paleta sofisticada con fondo neutro pizarra/piedra (`#FAFAF9` / `#1C1917`), acentos sutiles en ámbar tostado y púrpura real, sin tarjetas abarrotadas ni píldoras innecesarias.
- **Tipografía**: Títulos con tipografía con carácter serif editorial, metadatos limpios separados por puntos tipográficos (`·`), y números de tiempo en formato tabular.
- **Zero-Pill & Microinteracciones**: Botones de segmented control limpios, estados activos evidentes y transiciones ágiles ($\le 200$ms).

---

## 3. Technical Architecture & Data Strategy

```
┌─────────────────────────────────────────────────────────────┐
│                       MODO COMPLETO                         │
│                                                             │
│   [Cocinar] [Recetas de Autor ✨] [Sobras] [Diccionario]    │
└───────────────────────────────┬─────────────────────────────┘
                                │
                                ▼
       ┌───────────────────────────────────────────────┐
       │             AuthorStudioView.tsx              │
       │                                               │
       │  ┌────────────────────┐   ┌─────────────────┐ │
       │  │ Modo Parámetros    │   │ Modo Texto      │ │
       │  │ (Técnica + Sabor)  │   │ Libre           │ │
       │  └─────────┬──────────┘   └────────┬────────┘ │
       │            └───────────┬───────────┘          │
       │                        ▼                      │
       │             /api/recipe/author-craft          │
       │            (Gemini 2.5 Flash / Pro            │
       │           + Fallback Sensorial Local)         │
       └────────────────────────┬──────────────────────┘
                                │
                                ▼
       ┌───────────────────────────────────────────────┐
       │            Ficha de Receta Creada             │
       │  • Nombre de Autor     • Porqué Científico    │
       │  • Pasos y Tiempos     • Maridaje Sugerido    │
       │                                               │
       │   [Guardar en Mi Recetario]   [¡Cocinar Ya!]  │
       └────────────────────────┬──────────────┬───────┘
                                │              │
                ┌───────────────┘              └─────────────┐
                ▼                                            ▼
   ┌───────────────────────────┐                ┌───────────────────────────┐
   │ localStorage Persistente  │                │ Transición a CookingMode  │
   │ (authorRecipes[] Profile) │                │ (Mise en Place + Fuegos)  │
   └───────────────────────────┘                └───────────────────────────┘
```

### Componentes y Rutas a Crear/Modificar
1. **Endpoint Backend (`server.ts`)**:
   - `POST /api/recipe/author-craft`: Procesa el prompt guiado por parámetros o el texto libre, aplicando un system prompt especializado en alta cocina contemporánea, balance sensorial y técnicas de nivel experto.
2. **Definiciones TypeScript (`src/types.ts`)**:
   - Extensión de `Recipe` y `UserProfile` con `authorRecipes: AuthorRecipe[]`.
   - `AuthorRecipe`: incluye notas del chef, fecha de creación, concepto, técnica estrella y maridaje.
3. **Vista de Estudio de Autor (`src/components/AuthorStudioView.tsx`)**:
   - Formulario interactivo dual (Parámetros / Texto Libre).
   - Generador asistido con preajustes de técnicas maestras (Mantecatura, Sellado Bimodal, Desglasado, Confitado, Emulsión fría/tibia).
   - Vista detallada de la receta generada con guardado local y botón de lanzamiento a cocinar.
   - Pestaña de "Mis Creaciones Guardadas" para revisar, editar notas y cocinar en cualquier momento.
4. **Navegación (`src/components/Navbar.tsx` y `src/App.tsx`)**:
   - Añadir la pestaña `'autor'` a `ActiveTab`.
   - Conectar la selección de receta de autor para que al presionar "Cocinar" abra directamente el flujo de cocina en `CookingMode`.

---

## 4. Verification & Validation Plan

1. **Compilación y Linteo**:
   - Ejecutar `compile_applet` tras crear la vista y los endpoints para confirmar cero errores TypeScript y de compilación Vite.
2. **Pruebas Funcionales**:
   - Generación de receta por parámetros (ej. Salmón + Sellado bimodal + Cítricos).
   - Generación de receta por texto libre (ej. Pasta de autor con hongos y crema de nuez).
   - Verificación del fallback sensorial offline si la API de Gemini alcanza rate-limit o no responde.
   - Guardar la receta en la colección personal y verificar que persista tras refrescar la página.
   - Presionar "Cocinar Esta Receta" y comprobar que `CookingMode` se abra con la receta de autor en la etapa de Mise en Place.
