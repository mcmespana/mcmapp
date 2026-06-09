# Prompt para el agente de **mcmpanel** — Módulo de Encuestas y Evaluaciones

> Contexto: la app MCM (repo `mcmapp`, carpeta `mcm-app/`) tiene un sistema de
> encuestas/evaluaciones cuyas **respuestas** viven en Firebase RTDB y cuya
> **configuración** la app ahora lee **desde Firebase** (con fallback a código).
> Eso significa que el panel `mcmpanel` puede **crear y editar encuestas, abrirlas
> y cerrarlas, segmentarlas y ver/analizar respuestas** sin tocar la app.
>
> Tu tarea: construir en el panel un **módulo de Encuestas** completo y bonito.
> Este documento es el encargo funcional + técnico. El contrato de datos exacto
> está en `ENCUESTAS_CONTRATO.md` (léelo entero) y la guía funcional en
> `ENCUESTAS.md`. **No te desvíes del contrato**: la app solo entiende lo que ahí
> se describe.

---

## 0. Objetivo

Un módulo "Encuestas" que permita a una persona no técnica:

1. **Crear** encuestas con un editor visual (preguntas de varios tipos).
2. **Gestionar** su ciclo de vida: borrador → programada → abierta → cerrada.
3. **Segmentar** a quién se le ofrece (perfil, delegación, topic).
4. **Lanzar** la encuesta (incluido disparar la notificación push que la abre).
5. **Ver respuestas** individuales, bonitas y legibles.
6. **Analizar** respuestas agregadas con visualizaciones por pregunta y por
   segmento (perfil, delegación, plataforma, fecha).
7. **Exportar** (CSV / Excel) para análisis externo.

Debe sentirse como un Typeform/Google Forms ligero, integrado en el panel, con el
look & feel de MCM.

---

## 1. Modelo de datos (resumen — detalle en el contrato)

Tres clases de encuesta, **mismo editor**:

| Clase                | Config (escribe panel)              | Respuestas (lee panel)                    |
| -------------------- | ----------------------------------- | ----------------------------------------- |
| Evaluación de evento | `activities/<evento>/evaluacion/data` | `activities/<evento>/evaluacion/respuestas/<deviceId>` |
| Evaluación de la app | `app/evaluationConfig/data`         | `app/evaluations/<deviceId>`              |
| Encuesta genérica    | `surveys/<id>/data`                 | `surveys/<id>/respuestas/<deviceId>`      |

`data` = objeto **`SurveyConfig`**. Al guardar **siempre** actualiza el
`updatedAt` hermano (epoch ms o ISO). Nunca escribas `undefined` (RTDB lo
rechaza); omite el campo.

### `SurveyConfig` (lo que el editor produce)

```jsonc
{
  "status": "draft|scheduled|open|closed",
  "opensAt": 1717000000000,   // opcional, epoch ms
  "closesAt": 1717600000000,  // opcional, epoch ms
  "title": "…", "intro": "…",
  "thanksTitle": "…", "thanksBody": "…",
  "closedTitle": "…", "closedBody": "…",
  "accentColor": "#31AADF", "emoji": "📋",
  "anonymous": false,                          // solo genéricas
  "placement": { "type": "link-only" },         // solo genéricas
  "audience": { "profileTypes": [], "topics": [], "delegationIds": [] }, // solo genéricas
  "questions": [ /* ver §2 */ ]
}
```

---

## 2. Editor de preguntas

Soporta **6 tipos**. El editor debe ofrecer un selector de tipo y los campos
propios de cada uno:

| Tipo     | Campos extra en el editor                          | Validación |
| -------- | -------------------------------------------------- | ---------- |
| `stars`  | —                                                  | — |
| `scale`  | `min` (def. 0), `max` (def. 10), `minLabel`, `maxLabel` | `min < max`; rango razonable (≤ 0..10) |
| `text`   | `placeholder`                                      | — |
| `yesno`  | —                                                  | — |
| `single` | lista de `options` (`{value,label}`)               | ≥ 2 opciones; `value` únicos |
| `multi`  | lista de `options` (`{value,label}`)               | ≥ 2 opciones; `value` únicos |

Reglas del editor:

- Cada pregunta tiene `id` (slug estable autogenerado del label, editable, único
  dentro de la encuesta) + `label` + `optional` (toggle "obligatoria").
- **`id` inmutable tras recibir respuestas**: si ya hay respuestas, bloquea editar
  el `id` y avisa (cambiarlo rompe la correspondencia con las respuestas previas).
- `single`/`multi`: editor de opciones con `value` autogenerado del `label`.
- Reordenar preguntas (drag & drop). El orden del array es el orden en la app.
- **Vista previa** del wizard (réplica del de la app: una pregunta por pantalla,
  barra de progreso) para que se vea igual que en el móvil.

---

## 3. Pantallas del módulo

### 3.1. Listado de encuestas

- Tabla/tarjetas con: título, clase (evento/app/genérica), `status` (chip de
  color), nº de respuestas, ventana (opensAt–closesAt), última actividad.
- Acciones: **Crear**, **Editar**, **Duplicar**, **Abrir/Cerrar** (toggle de
  `status`), **Ver respuestas**, **Borrar** (solo borradores o con confirmación).
- Filtros: por estado, por clase, por evento.

### 3.2. Editor / Crear

- Formulario con: textos, estado + ventana (date-time pickers para
  `opensAt`/`closesAt`), color/emoji, audiencia (multiselect de profileTypes,
  delegaciones y topics — usa el mismo catálogo que las notificaciones),
  `anonymous`, `placement`, y el editor de preguntas (§2).
- Al guardar: escribe `data` + `updatedAt`. Para genéricas, el `id` del nodo se
  fija al crear (slug) y no cambia.
- **Botón "Lanzar"**: para genéricas, además de poner `status: "open"`, ofrece
  enviar la **notificación push** que la abre (reutiliza el módulo de
  notificaciones existente) con `internalRoute: "/encuesta/<id>"` y un
  `actionButton` "Responder" interno a esa misma ruta. Permite elegir el segmento
  (idealmente el mismo que `audience`).

### 3.3. Respuestas — vista individual ("bonita")

- Lista de respuestas (cards) con cabecera: `userName`, chip de `userProfileType`,
  chip de `userDelegation`, `platform`, fecha (`reportedAt`).
- Cuerpo: cada pregunta con su respuesta **renderizada según el tipo**:
  - `stars` → estrellas pintadas (★★★★☆).
  - `scale` → número grande + barra 0..max.
  - `yesno` → chip Sí/No.
  - `single` → la opción elegida (label, no value).
  - `multi` → chips de las opciones (labels).
  - `text` → texto en blockquote.
- Navegación anterior/siguiente entre respuestas. Buscar por nombre/delegación.
- Respeta `anonymous`: si la respuesta no trae datos de perfil, muéstrala como
  "Anónimo" sin inventar.

### 3.4. Respuestas — análisis agregado ("bonito, agrupado")

Dashboard de la encuesta con **una tarjeta por pregunta**, elegida según el tipo:

| Tipo     | Visualización agregada |
| -------- | ---------------------- |
| `stars`  | Media (1 decimal) + distribución (histograma 1..5) + nº respuestas. |
| `scale`  | Media + histograma. Si `min=0,max=10`: **calcular NPS** (% promotores 9-10 − % detractores 0-6) y mostrarlo destacado. |
| `yesno`  | Donut/porcentaje Sí vs No. |
| `single` | Barras horizontales por opción (con %). |
| `multi`  | Barras horizontales por opción (cuenta cada selección; el total puede superar el nº de respuestas). |
| `text`   | Lista de respuestas (paginada) + nº; opcional: nube de palabras / longitud media. |

Cabecera del dashboard: nº total de respuestas, % de completado por pregunta,
fecha primera/última respuesta, desglose por **plataforma**.

**Segmentación del análisis**: selector para **agrupar/filtrar** por
`userProfileType`, `userDelegation`, `platform` y rango de fechas. Al cambiarlo,
todas las tarjetas se recalculan. (Ej.: "ver solo monitores de Madrid".)

> Maneja con cuidado: las respuestas son un **mapa por `deviceId`**, no una lista.
> Lee el nodo entero (`.../respuestas`) y recorre los hijos. Ignora hijos que no
> tengan `answers`.

### 3.5. Exportar

- **CSV / Excel**: una fila por respuesta, una columna por pregunta (`id`), más
  metadatos (`userName`, `userProfileType`, `userDelegation`, `platform`,
  `reportedAt`). Para `multi`, serializa el array (p. ej. `"oracion; biblia"`).
- Opcional: export del dashboard a PDF.

---

## 4. Análisis de respuestas — detalles que importan

- **Una respuesta = un dispositivo** (no un usuario, no hay login). No presentes
  los números como "X personas" sino "X respuestas/dispositivos". Documenta este
  matiz en la UI del dashboard (tooltip).
- `userDelegation` es la **etiqueta** legible (`"Madrid"`), no el slug. Agrupa por
  ese string tal cual.
- Valores faltantes: una pregunta opcional sin contestar **no aparece** en
  `answers`. En agregados, usa el nº real de respuestas a esa pregunta como
  denominador (no el total de la encuesta).
- `text` vacíos y `multi` vacíos no se guardan: no los cuentes como respuesta a esa
  pregunta.
- Para la evaluación de la app, las respuestas llevan `status: "pending"` — puedes
  usarlo para un flujo de triaje (marcar como revisada) escribiéndolo desde el
  panel (Admin SDK), pero **no** lo borres.

---

## 5. Reglas de oro (no romper la app)

1. **No cambies los paths** del contrato. La app lee exactamente esos nodos.
2. **`updatedAt` en cada guardado** de config, o los clientes con caché no verán
   los cambios (patrón idéntico a `/profileConfig`).
3. **Nunca `undefined`** en RTDB. Para borrar un campo, escribe `null`.
4. `questions[].id` estables; `single`/`multi` siempre con `options`.
5. La app **bloquea reenvíos por dispositivo**: no esperes correcciones de una
   respuesta ya enviada.
6. Cambiar preguntas de una encuesta **con respuestas ya recibidas** mezcla
   esquemas: avisa en la UI y, si cambian ids/opciones, considera versionar
   (crear una encuesta nueva) en vez de editar.
7. Borrar el `data` de una encuesta deja a los clientes con la última caché; para
   "apagarla" usa `status: "closed"`, no borres el nodo.

---

## 6. UX sugerida (resumen)

- Wizard de creación en 3 pasos: **Contenido** (textos) → **Preguntas** →
  **Publicación** (estado, ventana, audiencia, lanzamiento + push).
- Estados con color: `draft` gris, `scheduled` azul, `open` verde, `closed` rojo.
- Vista previa en vivo del wizard del móvil.
- En "Lanzar", checklist: ¿preguntas válidas? ¿audiencia? ¿push? ¿fecha de cierre?
- Dashboard con tarjetas tipo "metric + chart", filtros sticky arriba.

---

## 7. Referencias

- **Contrato de datos (obligatorio)**: `ENCUESTAS_CONTRATO.md`.
- **Guía funcional**: `ENCUESTAS.md`.
- **Segmentación (profileTypes/delegaciones/topics)**: `NOTIFICACIONES_CONTRATO.md`
  §7 y `PANEL_PERFILES.md`.
- **Notificaciones (para el "Lanzar")**: `NOTIFICACIONES_CONTRATO.md`,
  `PROMPT_MCMPANEL_NOTIS_BOTONES.md`.
- **Seeds de ejemplo**: `mcm-app/firebase-seed/evaluacion.json`,
  `app-evaluation-config.json`, `surveys.json`.
- **Código de la app** (por si dudas): `mcm-app/constants/evaluation.ts`,
  `mcm-app/constants/surveys.ts`, `mcm-app/components/EvaluationWizard.tsx`.
