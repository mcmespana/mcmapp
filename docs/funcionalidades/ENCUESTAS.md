# Encuestas y Evaluaciones — MCM App

> Guía funcional del sistema de encuestas: qué es, cómo funciona en la app, cómo
> se configura desde Firebase/panel y qué se puede mejorar.
>
> - **Contrato de datos Panel ↔ App**: `ENCUESTAS_CONTRATO.md`.
> - **Eventos** (dónde encaja la evaluación del evento): `EVENTOS.md`.

---

## 1. Qué es

Un sistema de **formularios tipo onboarding** (una pregunta por pantalla, barra de
progreso, animaciones, pantalla de agradecimiento) que la app usa para tres cosas:

1. **Evaluación del evento** — valorar una actividad (estrellas + preguntas).
   Banner "Evalúa la actividad" en la Home cuando está abierta.
2. **Evaluación de la app** — feedback sobre la propia app. Banner "Evalúa la app"
   en la Home y botón en Ajustes.
3. **Encuestas genéricas** — cualquier encuesta que cree el panel (`surveys/<id>`),
   accesible por notificación push / deep link.

Las tres comparten el **mismo wizard** (`components/EvaluationWizard.tsx`) y el
**mismo modelo de preguntas**.

## 2. Arquitectura (config en Firebase, fallback en código)

```
Firebase (config la escribe el panel)        App (la lee con caché)
─────────────────────────────────────        ──────────────────────────
activities/<evento>/evaluacion/data   ─────►  EvaluacionScreen  ─┐
app/evaluationConfig/data             ─────►  EvaluacionAppScreen├─►  EvaluationWizard
surveys/<id>/data                     ─────►  SurveyScreen      ─┘
```

- La config (preguntas, título, estado abierto/cerrado, audiencia) se lee de
  Firebase con `useFirebaseData` (caché offline + invalidación por `updatedAt`).
- Si el nodo no existe o no hay red, las **dos evaluaciones fijas** caen a un set
  por defecto en código (`DEFAULT_EVENT_EVALUATION` / `DEFAULT_APP_EVALUATION` en
  `constants/evaluation.ts`). Las **genéricas** no tienen fallback (sin config →
  "Encuesta no disponible").
- **Sin OTA**: el panel cambia preguntas, abre y cierra encuestas editando
  Firebase. La app lo recoge al siguiente arranque.

> Histórico: entre los commits `2c6db4c` y este, las preguntas estuvieron **solo en
> código** (Firebase ignorado). Eso se revirtió: la app vuelve a leer la config de
> Firebase para que el panel pueda gestionar encuestas de verdad.

## 3. Tipos de pregunta

| Tipo     | UI                                   | Respuesta guardada |
| -------- | ------------------------------------ | ------------------ |
| `stars`  | 5 estrellas (1..5)                   | `number` |
| `scale`  | botones `min`..`max` + etiquetas extremos | `number` (0 válido) |
| `text`   | textarea (máx. 1000)                 | `string` |
| `yesno`  | Sí / No                              | `boolean` |
| `single` | radio (lista de opciones)            | `string` (value) |
| `multi`  | checkbox (lista de opciones)         | `string[]` (values) |

`scale` con `min:0,max:10` sirve como **NPS**. `single`/`multi` requieren
`options: [{ value, label }]`. Ver campos exactos en `ENCUESTAS_CONTRATO.md` §3.

## 4. Estado: abrir y cerrar

Cada encuesta tiene `status` (`draft` | `scheduled` | `open` | `closed`) y una
ventana opcional `opensAt`/`closesAt` (epoch ms). Lógica en `isEvaluationOpen()`:

- `draft`/`closed` → cerrada. Fuera de ventana → cerrada.
- `open`/`scheduled` dentro de ventana → abierta.
- Sin `status`, cae al legacy `evaluationOpen` (true por defecto).

Efecto: las evaluaciones fijas muestran/ocultan su **banner** en la Home; las
genéricas muestran el formulario o un mensaje de **cerrada** (`closedTitle`/
`closedBody`).

## 5. Anti-duplicado e identidad

- **Sin sesión**: una respuesta por `deviceId` (caché local `AsyncStorage` +
  comprobación en Firebase antes de mostrar el formulario).
- **Con sesión** (Google/Apple): la respuesta añade `userId` (uid) y se escribe un
  marcador `users/<uid>/surveysAnswered/<scope>` → **dedup entre dispositivos** (la
  misma persona no puede responder dos veces aunque cambie de móvil). Encuestas
  anónimas no guardan ni `userId` ni marcador. Ver `utils/surveyIdentity.ts` y
  `ENCUESTAS_CONTRATO.md` §6.

## 6. Cómo se llega a cada encuesta

- **Evento**: banner "Evalúa la actividad" en la Home (gated por acceso al evento
  y estado abierto) → `EvaluacionScreen`. También como tarjeta en el hub del
  evento (`events.ts`, sección con `target: 'Evaluacion'`).
- **App**: banner "Evalúa la app" en la Home + botón en Ajustes → `/evaluacion-app`.
- **Genérica**: por **banner automático** (según `placement` + `audience`, leyendo
  el índice `surveys/_index`) en la Home, el hub del evento o Ajustes; y/o por
  **notificación push** con `internalRoute: "/encuesta/<id>"`. Ambas llevan a
  `app/encuesta/[id].tsx` → `SurveyScreen` (ruta raíz en `_layout.tsx`).

## 7. Activar la evaluación de un evento (paso a paso)

1. Importar `mcm-app/firebase-seed/evaluacion.json` en
   `activities/<evento>/evaluacion` (consola → ⋮ → Import JSON). ⚠️ Import
   **reemplaza** el nodo; hazlo antes de que haya respuestas.
2. La tarjeta del hub ya está en `constants/events.ts` para Visita Papa
   (`firebaseKey: 'evaluacion'`). Para otro evento, añade la sección igual.
3. Cuando quieras pedir la evaluación, pon `data.status = "open"` (o
   `evaluationOpen: true`) y toca `updatedAt`. Aparece el banner en la Home a quien
   tenga acceso al evento. Se oculta a quien ya evaluó.

## 8. Crear una encuesta genérica (paso a paso)

1. Escribir `surveys/<id>/data` (SurveyConfig) + `surveys/<id>/updatedAt`. Usa
   `mcm-app/firebase-seed/surveys.json` como plantilla.
2. (Opcional) `audience` para segmentar; `anonymous: true` si no quieres datos de
   perfil.
3. `status: "open"`.
4. Enviar una **notificación push** con `internalRoute: "/encuesta/<id>"` (y un
   botón "Responder" interno a esa ruta) al segmento deseado.
5. Cerrar con `status: "closed"` cuando termine (no borres el nodo: conservas
   respuestas).

> Todo esto lo hará el **módulo de Encuestas del panel** (ver
> el contrato `ENCUESTAS_CONTRATO.md`). A mano es posible pero tedioso.

## 9. Archivos clave (app)

| Archivo                                        | Qué hace |
| ---------------------------------------------- | -------- |
| `constants/evaluation.ts`                      | Tipos `EvalQuestion`/`EvaluationConfig`, defaults, `isEvaluationOpen`, `mergeEvaluationConfig` |
| `constants/surveys.ts`                         | Modelo genérico `SurveyConfig`, paths, `matchesAudience`, claves de caché |
| `components/EvaluationWizard.tsx`              | Wizard (render de los 6 tipos, validación, envío) |
| `app/screens/EvaluacionScreen.tsx`             | Evaluación del evento (config desde Firebase) |
| `app/screens/EvaluacionAppScreen.tsx`          | Evaluación de la app (config desde Firebase) |
| `app/screens/SurveyScreen.tsx`                 | Encuesta genérica (config, audiencia, cerrada, anónima) |
| `app/encuesta/[id].tsx`                        | Ruta raíz `/encuesta/<id>` (deep link / push / banner) |
| `hooks/useActiveSurveys.ts`                    | Lee `surveys/_index` y filtra encuestas activas por placement/audiencia |
| `components/SurveyBanner.tsx`                  | Banner/fila reutilizable de una encuesta activa |
| `utils/surveyIdentity.ts`                      | `userId` + dedup entre dispositivos (`users/<uid>/surveysAnswered`) |
| `app/(tabs)/index.tsx` · `EventHomeScreen.tsx` · `SettingsBottomSheet.tsx` | Renderizan los banners de encuestas activas |
| `database.rules.json`                          | Reglas RTDB de config/respuestas |
| `firebase-seed/{evaluacion,app-evaluation-config,surveys}.json` | Seeds importables |
| `__tests__/surveys.test.ts`                    | Tests de los helpers |

## 10. Mejoras hechas en esta entrega (MCM App)

Cambios JS (compatibles con **OTA**, sin código nativo):

1. **Config desde Firebase** para las dos evaluaciones + estado abrir/cerrar
   controlado por el panel sin OTA. (Antes: solo código.)
2. **Tipos de pregunta nuevos**: `scale` (NPS), `single` (radio), `multi`
   (checkbox), además de los `stars`/`text`/`yesno` existentes.
3. **Encuestas genéricas** (`/surveys/<id>`): pantalla + ruta deep link, audiencia
   por perfil, ventana de apertura, modo anónimo, textos de agradecimiento y de
   cierre configurables.
4. **Textos configurables** de agradecimiento (`thanksTitle`/`thanksBody`).
5. **Banners automáticos** de encuestas genéricas (antes mejora 11.1) según
   `placement` (`home-banner`, `event-banner`, `app-settings`) y `audience`, sin
   depender de push. La app lee un índice ligero `surveys/_index` (no toda la
   colección). Componente `SurveyBanner` + hook `useActiveSurveys`.
6. **Identidad real** (antes mejora 11.6): respuestas con `userId` cuando hay
   sesión + dedup entre dispositivos vía `users/<uid>/surveysAnswered`.
7. Reglas de seguridad y seeds para los nuevos nodos. Tests de los helpers.

## 11. Mejoras futuras sugeridas (no incluidas aún)

Requieren más trabajo en la app (siguen siendo OTA salvo que se indique):

1. **Listado de encuestas en la app** (p. ej. en "Más" o "Contigo"): un sitio
   donde el usuario vea las encuestas abiertas para su perfil.
2. **Editar/reenviar** la propia respuesta dentro de una ventana (hoy es envío
   único e inmutable por dispositivo/persona).
3. **Lógica condicional** (saltar preguntas según respuestas previas) y secciones.
4. **Validación de email/número** como tipos propios (hoy se haría con `text`).
5. **Cierre/aviso en vivo** (forzar refresco si una encuesta se cierra mientras la
   app está abierta). Hoy el estado se evalúa al entrar en la pantalla.
