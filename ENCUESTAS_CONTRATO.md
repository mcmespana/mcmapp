# Contrato de datos · Encuestas y Evaluaciones · MCM Panel ↔ MCM App

> Fuente de verdad: código de `mcm-app/`. Fecha: 2026-06-09 · App v2.0.0.
>
> Este documento define **cómo el panel crea/edita encuestas y lee respuestas**,
> y **qué procesa exactamente la app**. Es el contrato que el agente del panel
> (`mcmpanel`) debe respetar. Para la guía funcional ver `ENCUESTAS.md`; para el
> prompt de implementación del panel ver `PROMPT_MCMPANEL_ENCUESTAS.md`.

---

## TL;DR

- La app vuelve a leer la **configuración** de las encuestas **desde Firebase**
  (antes estaba solo en código). El panel puede crear/editar preguntas, abrir y
  cerrar encuestas **sin desplegar OTA**. Si el nodo no existe o está offline, la
  app cae a un set por defecto en código (solo para las dos evaluaciones fijas).
- Hay **tres clases** de encuesta, todas con el mismo modelo de preguntas y el
  mismo wizard:
  1. **Evaluación del evento** → `activities/<evento>/evaluacion`
  2. **Evaluación de la app** → config en `app/evaluationConfig`, respuestas en `app/evaluations`
  3. **Encuestas genéricas** (las crea el panel) → `surveys/<id>`
- **Tipos de pregunta**: `stars`, `text`, `yesno`, `scale`, `single`, `multi`.
- **Anti-duplicado por dispositivo** (no por usuario): una respuesta por
  `deviceId`. La app no requiere login. Ver §6 (implicaciones de analítica).
- Cada vez que el panel edite la `data` de un nodo, **debe tocar su `updatedAt`**
  (igual que `/profileConfig`) o los clientes con caché no verán el cambio.

---

## 1. Estructura en Firebase

### 1.1. Evaluación del evento — `activities/<evento>/evaluacion`

```
activities/<evento>/evaluacion
├── updatedAt: <ms|string>          ← invalida caché. El panel lo actualiza al editar.
├── hidden?: boolean                ← oculta la tarjeta en el hub del evento
├── data: SurveyConfig              ← config (preguntas, estado…). LA EDITA EL PANEL.
└── respuestas/<deviceId>: Response ← LA ESCRIBE LA APP (una por dispositivo)
```

- Seed de ejemplo: `mcm-app/firebase-seed/evaluacion.json`.
- Si `data` falta o `data.questions` está vacío, la app usa
  `DEFAULT_EVENT_EVALUATION` (código). El resto de campos de `data` (título,
  `status`, ventana) **sí** se aplican aunque no haya `questions`.

### 1.2. Evaluación de la app — `app/evaluationConfig` + `app/evaluations`

```
app/
├── evaluationConfig
│   ├── updatedAt: <ms|string>
│   └── data: SurveyConfig          ← config de la evaluación de la app (panel)
└── evaluations/<deviceId>: Response  ← respuestas (app). Lleva además status:"pending"
```

- Seed de ejemplo: `mcm-app/firebase-seed/app-evaluation-config.json`.
- ⚠️ **OJO**: la config de la app va en `app/evaluationConfig`, **separada** de
  las respuestas (`app/evaluations`) para no colisionar. No metas config dentro
  de `app/evaluations`.
- Fallback en código: `DEFAULT_APP_EVALUATION`.

### 1.3. Encuestas genéricas — `surveys/<id>`

```
surveys
├── updatedAt: <ms|string>          ← (opcional) marca global de la colección
└── <id>/                           ← id estable, slug. p.ej. "encuesta-monitores-2026"
    ├── updatedAt: <ms|string>
    ├── data: SurveyConfig          ← config completa (panel)
    └── respuestas/<deviceId>: Response  ← respuestas (app)
```

- Seed de ejemplo: `mcm-app/firebase-seed/surveys.json`.
- **No hay fallback en código**: si no existe `data` o no trae `questions`, la app
  muestra "Encuesta no disponible".
- La app llega a esta pantalla por **deep link / notificación push**:
  `data.internalRoute = "/encuesta/<id>"` (ver §5).

---

## 2. `SurveyConfig` — el objeto `data` que escribe el panel

Definición canónica: `mcm-app/constants/evaluation.ts` (`EvaluationConfig`) +
`mcm-app/constants/surveys.ts` (`SurveyConfig`, superset).

```jsonc
{
  // ── Estado de publicación (preferido) ──
  "status": "open",            // "draft" | "scheduled" | "open" | "closed"
  "opensAt": 1717000000000,    // (opcional) epoch ms — antes de esto, cerrada
  "closesAt": 1717600000000,   // (opcional) epoch ms — después de esto, cerrada
  // Legacy equivalente a status (solo si NO mandas status):
  "evaluationOpen": true,      // true = abierta, false = cerrada

  // ── Textos ──
  "title": "Encuesta a monitores 2026",
  "intro": "Nos ayudas a preparar el curso. 2 minutos 🙏",
  "thanksTitle": "¡Gracias!",          // (opcional) pantalla final
  "thanksBody": "Tu opinión nos ayuda.",
  "closedTitle": "Encuesta cerrada",    // (opcional) cuando status=closed / fuera de ventana
  "closedBody": "Ya no admite respuestas.",

  // ── Presentación ──
  "accentColor": "#31AADF",   // (opcional) hex; sobreescribe el color del evento
  "emoji": "📋",               // (opcional) para banners

  // ── Solo encuestas genéricas (surveys/<id>) ──
  "anonymous": false,          // true = NO se guardan datos de perfil con la respuesta
  "placement": { "type": "link-only" },   // ver §4
  "audience": {                // ver §4 (filtro por perfil). Vacío/ausente = todos
    "profileTypes": ["monitor"],
    "topics": [],
    "delegationIds": []
  },

  // ── Preguntas (obligatorio, no vacío) ──
  "questions": [ /* ver §3 */ ]
}
```

### Estado abierto/cerrado (lógica exacta de la app)

`isEvaluationOpen()` en `constants/evaluation.ts`:

1. `status === "draft"` o `"closed"` → **cerrada**.
2. Si hay `opensAt` y `ahora < opensAt` → **cerrada** (aún no empieza).
3. Si hay `closesAt` y `ahora > closesAt` → **cerrada** (ya terminó).
4. `status === "open"` o `"scheduled"` → **abierta** (dentro de ventana).
5. Sin `status`: usa `evaluationOpen` (por defecto **abierta** si no viene).

> **Recomendación**: usa siempre `status`. `scheduled` + `opensAt` permite dejar
> la encuesta lista y que se abra sola en una fecha. `evaluationOpen` se mantiene
> por compatibilidad pero es menos expresivo.

Qué controla "abierta/cerrada" en la app:

- **Evaluación del evento**: muestra/oculta el banner "Evalúa la actividad" en la
  Home. (Además del gating por acceso al evento y el flag local "ya evalué".)
- **Evaluación de la app**: muestra/oculta el banner "Evalúa la app" en la Home.
- **Encuesta genérica**: si está cerrada, la pantalla muestra `closedTitle` /
  `closedBody` en vez del formulario.

---

## 3. Preguntas (`questions[]`)

Tipo: `EvalQuestion` (`constants/evaluation.ts`).

| Campo         | Tipo                      | Aplica a        | Notas |
| ------------- | ------------------------- | --------------- | ----- |
| `id`          | string                    | todas           | **Clave estable** en `answers`. No la cambies tras recibir respuestas. |
| `type`        | string                    | todas           | `stars`\|`text`\|`yesno`\|`scale`\|`single`\|`multi` |
| `label`       | string                    | todas           | Enunciado. |
| `optional`    | boolean                   | todas           | Falta o `false` = **obligatoria**. |
| `placeholder` | string                    | `text`          | Texto guía del textarea. |
| `min` / `max` | number                    | `scale`         | Por defecto 0 y 10. |
| `minLabel` / `maxLabel` | string          | `scale`         | Etiquetas de los extremos. |
| `options`     | `{value,label}[]`         | `single`,`multi`| **Obligatorio** para esos tipos. `value` es lo que se guarda. |

### Cómo se guarda cada respuesta (`answers[id]`)

| `type`  | UI en la app                         | Valor en `answers[id]` |
| ------- | ------------------------------------ | ---------------------- |
| `stars` | 5 estrellas (1..5)                   | `number` 1..5 |
| `scale` | botones `min`..`max` + etiquetas     | `number` (`0` es válido, p. ej. NPS) |
| `text`  | textarea multilínea (máx. 1000)      | `string` (trim; vacío = no se guarda) |
| `yesno` | botones Sí / No                      | `boolean` |
| `single`| lista radio                          | `string` (== `option.value`) |
| `multi` | lista checkbox                       | `string[]` (`option.value`s; vacío = no se guarda) |

> Reglas de limpieza al enviar: las preguntas `text` vacías y las `multi` sin
> selección **no** se incluyen en `answers`. El resto de tipos contestados sí.
> Las preguntas opcionales sin contestar no aparecen en `answers`.

### Validación de "obligatoria"

- `stars`: contestada si valor > 0.
- `scale`: contestada si hay número (incluido **0**).
- `text`: contestada si tras `trim()` no está vacía.
- `multi`: contestada si hay ≥ 1 opción.
- `yesno` / `single`: contestada si hay valor.

---

## 4. Audiencia y colocación (solo encuestas genéricas)

### `audience` — a quién se le ofrece

`matchesAudience()` en `constants/surveys.ts`. Cada criterio es un array; **OR
dentro** del array, **AND entre** criterios definidos. Array vacío o ausente = no
filtra por ese criterio.

```jsonc
"audience": {
  "topics": ["monitores"],          // topics de notificación del usuario
  "profileTypes": ["monitor"],       // "familia" | "monitor" | "miembro"
  "delegationIds": ["mcm-madrid"]    // slugs de delegación
}
```

- Si el usuario **no** cumple, la pantalla muestra "No disponible para tu perfil".
- Valores válidos de `profileTypes`/`delegationIds`/`topics`: ver
  `NOTIFICACIONES_CONTRATO.md` §7 (mismo vocabulario de segmentación).
- Las **dos evaluaciones fijas** (evento/app) **no** usan `audience`: el evento se
  gatea por acceso al evento (perfil), y la de la app se ofrece a todos.

### `placement` — dónde aparece

```jsonc
"placement": { "type": "link-only", "eventId": "visitapapa26", "ctaLabel": "Responder" }
```

| `type`         | Significado |
| -------------- | ----------- |
| `link-only`    | Solo por deep link / push (`/encuesta/<id>`). **← lo soportado hoy en app.** |
| `home-banner`  | (Reservado) banner en la Home. Hoy **no** se auto-renderiza; usa push. |
| `event-banner` | (Reservado) banner en el hub del evento (`eventId`). Hoy no auto-renderiza. |
| `app-settings` | (Reservado) botón en Ajustes. Hoy no auto-renderiza. |

> **Estado real hoy**: la app surfacea las encuestas genéricas **por notificación
> push** con `internalRoute: "/encuesta/<id>"`. El campo `placement` se guarda para
> uso del panel y para una futura iteración que renderice banners automáticos (ver
> §"Mejoras" en `ENCUESTAS.md`). Las dos evaluaciones fijas **sí** tienen sus
> banners (Home/Ajustes), ahora controlados por `status` desde Firebase.

---

## 5. Cómo se abre una encuesta genérica (deep link / push)

La app registra la ruta raíz `app/encuesta/[id].tsx` → `SurveyScreen`. Para
llevar al usuario a una encuesta, manda una **notificación push** (ver
`NOTIFICACIONES_CONTRATO.md`) con:

```jsonc
"data": {
  "id": "uuid-de-la-notificacion",
  "internalRoute": "/encuesta/encuesta-monitores-2026",
  "actionButtons": [
    { "text": "Responder", "url": "/encuesta/encuesta-monitores-2026", "isInternal": true }
  ]
}
```

`normalizeNotificationRoute()` ya resuelve `/encuesta/<id>` (ruta raíz, sin
alias). No hace falta nada más en la app.

---

## 6. Respuestas (`Response`) — qué escribe la app

`SurveyScreen` / `EvaluacionScreen` / `EvaluacionAppScreen`:

```jsonc
{
  "answers": { "general": 5, "nps": 9, "temas": ["oracion", "biblia"], "comentarios": "…" },
  "deviceId": "<id estable del dispositivo>",
  "surveyId": "encuesta-monitores-2026",   // solo encuestas genéricas
  "eventId": "visitapapa26",                // solo evaluación de evento
  "timestamp": 1717942800000,               // epoch ms (cliente)
  "reportedAt": "2026-06-09T12:00:00.000Z", // ISO (legible)
  "platform": "ios",                         // "ios" | "android" | "web"
  "status": "pending",                       // solo evaluación de app (triaje del panel)
  "userName": "Juan García",                 // ausente si anonymous:true
  "userProfileType": "monitor",              // ausente si anonymous:true
  "userDelegation": "Madrid"                 // ausente si anonymous:true
}
```

### Implicaciones para la analítica del panel (IMPORTANTE)

- **Una respuesta por `deviceId`**, no por persona. La app bloquea reenvíos por
  dispositivo (caché local + comprobación en Firebase). Un mismo usuario en dos
  dispositivos cuenta dos veces; varias personas en un dispositivo compartido,
  una sola.
- **No hay autenticación**: `userName`/`userProfileType`/`userDelegation` salen del
  perfil local (onboarding), no de una cuenta. Pueden ser `"Anónimo"` /
  `"sin-perfil"` / `"Sin delegación"` si el usuario no completó onboarding.
- `userDelegation` es la **etiqueta legible** (p. ej. `"Madrid"`), no el slug.
- La app **toca `updatedAt`** del nodo de la encuesta tras escribir una respuesta
  (evento y genéricas). No te bases en `updatedAt` para detectar "config editada":
  úsalo solo para caché.
- Las respuestas son un **mapa** (`respuestas/<deviceId>`), no una lista. Para
  contar/agregar, lee el nodo entero y recorre los hijos.

---

## 7. Reglas de seguridad (Firebase RTDB)

`mcm-app/database.rules.json` (desplegadas con Admin SDK / panel, que las ignora):

- `activities/<evento>/evaluacion/respuestas/<deviceId>` → **write público**.
- `app/evaluationConfig` → **read público** (config).
- `app/evaluations/<deviceId>` → **read+write público**.
- `surveys` → **read público**; `surveys/<id>/respuestas/<deviceId>` → **write
  público**; `surveys/<id>/updatedAt` → write público (la app lo toca al enviar).
- La `data` de config de cualquier encuesta **NO** es escribible por la app: solo
  el panel (Admin SDK) la escribe. Lectura pública para que la app la consuma.

> Si añades un tipo de encuesta o mueves un path, actualiza `database.rules.json`
> y `SEGURIDAD.md`.

---

## 8. Checklist para el panel al crear/editar una encuesta

1. Escribir `data` (SurveyConfig) en el nodo correcto (§1).
2. **Actualizar `updatedAt`** del nodo (ms o ISO string) — si no, no se refresca.
3. No mandar `undefined` en RTDB (omitir el campo). `null` borra el campo.
4. `questions[].id` estables; no reciclar ids entre preguntas distintas.
5. `single`/`multi` siempre con `options` no vacío.
6. Para lanzar una encuesta genérica: además, **enviar push** con
   `internalRoute: "/encuesta/<id>"`.
7. Para cerrar: `status: "closed"` (o pasar `closesAt`). El histórico de
   respuestas se conserva.

---

## 9. Qué procesa la app y qué ignora

| Campo de `data`        | ¿Se usa? | Cómo |
| ---------------------- | -------- | ---- |
| `status` / `opensAt` / `closesAt` | ✅ | Abrir/cerrar (banners y pantalla). |
| `evaluationOpen`       | ✅ | Legacy, solo si no hay `status`. |
| `title` / `intro`      | ✅ | Bienvenida del wizard. |
| `thanksTitle` / `thanksBody` | ✅ | Pantalla de agradecimiento. |
| `closedTitle` / `closedBody` | ✅ | Pantalla de encuesta cerrada (genéricas). |
| `accentColor`          | ✅ | Color de acento del wizard. |
| `questions[]`          | ✅ | Render del formulario. |
| `anonymous`            | ✅ | Genéricas: omite datos de perfil en la respuesta. |
| `audience`             | ✅ | Genéricas: filtra por perfil. |
| `placement`            | 🟡 | Se guarda; hoy solo `link-only` se materializa (vía push). |
| `emoji`                | 🟡 | Reservado para banners (no se pinta aún). |
| `hidden`               | ✅ | Evento: oculta la tarjeta en el hub. |

✅ procesa · 🟡 guardado/parcial · ❌ ignora

---

## 10. Referencias en el repo

- Modelo y helpers: `mcm-app/constants/evaluation.ts`, `mcm-app/constants/surveys.ts`.
- Wizard (render de tipos): `mcm-app/components/EvaluationWizard.tsx`.
- Pantallas: `mcm-app/app/screens/EvaluacionScreen.tsx`,
  `EvaluacionAppScreen.tsx`, `SurveyScreen.tsx`; ruta `app/encuesta/[id].tsx`.
- Reglas: `mcm-app/database.rules.json`. Seeds: `mcm-app/firebase-seed/`.
- Tests: `mcm-app/__tests__/surveys.test.ts`.
