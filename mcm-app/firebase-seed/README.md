# Firebase Seeds

Ficheros JSON listos para importar a Firebase Realtime Database desde la consola.

## `profileConfig.json`

Estructura inicial del nodo `/profileConfig` usado por el Sistema de Perfiles.
Ver `docs/contratos/PANEL_PERFILES.md` (raíz del monorepo) para el diseño completo.

### Cómo subirlo

1. Abre la consola de Firebase → _Realtime Database_ de la instancia MCM.
2. En la raíz, crea el nodo `profileConfig` (si no existe).
3. Con el nodo seleccionado, menú _⋮_ → **Import JSON**.
4. Selecciona `profileConfig.json`. El contenido raíz (`updatedAt` + `data`) se
   volcará bajo `/profileConfig`.
5. Revisa que la estructura quede `/profileConfig/data/profiles/…` etc.

### Qué hay que editar a mano tras importar

- **`data.profiles.*.defaultCalendars`**: actualmente vacío en el seed. Rellena
  con los IDs reales de calendarios del nodo `/calendars` (los que se deban
  pre-seleccionar para cada perfil). Si lo dejas vacío, la app cae en el flag
  `defaultSelected` de cada calendario (retrocompatible).
- **`data.delegations.{id}`**: el seed ya incluye las 16 delegaciones con su
  `label`. Añade `notificationTopic`, `extraCalendars` o `override` solo a las
  que tengan algo especial. Las que solo tengan `label` heredan todo de
  `_default`. **El orden de las claves importa** — el cliente deriva la lista
  visible en el selector de onboarding/ajustes en orden de inserción.
- **`data.global.minAppVersion`** y **`maintenanceMode`**: kill switches
  remotos. `0.0.0` = sin bloqueo. `maintenanceMode: true` muestra
  `MaintenanceScreen` en toda la app.

### Topics de notificación

Los `notificationTopics` del perfil se sanitizan contra
`KNOWN_NOTIFICATION_TOPICS` (`constants/profileCatalog.ts`) → solo se aceptan
los IDs definidos ahí. En cambio, `delegations[id].notificationTopic` (string
suelto, ej. `"castellon"`) **no** se sanitiza: pasa tal cual al array
`/pushTokens/{id}/topics` para que el backend (`mcmpanel`) pueda segmentar
notificaciones por delegación local sin tocar código de la app.

### Este JSON es la fuente de verdad del fallback

El mismo contenido se importa desde el código en
`mcm-app/constants/defaultProfileConfig.ts` y se usa como fallback si Firebase no
está disponible en primera carga (sin caché). **Mantén ambos sincronizados**: si
editas la estructura remota, refleja los cambios en este JSON y viceversa.

---

## `evaluacion.json` · `app-evaluation-config.json` · `surveys.json`

Seeds del **sistema de encuestas** (ver `docs/funcionalidades/ENCUESTAS.md` y
`docs/contratos/ENCUESTAS_CONTRATO.md` en la raíz del monorepo). Todos siguen la forma `{ updatedAt, data }`.

| Seed                         | Importar en                      | Qué es                                                                              |
| ---------------------------- | -------------------------------- | ----------------------------------------------------------------------------------- |
| `evaluacion.json`            | `activities/<evento>/evaluacion` | Config de la evaluación de un evento (preguntas + estado).                          |
| `app-evaluation-config.json` | `app/evaluationConfig`           | Config de la evaluación de la app (incluye ejemplos de `scale`/`multi`).            |
| `surveys.json`               | `surveys`                        | Encuestas genéricas: índice `_index` (banners) + ejemplo `encuesta-monitores-2026`. |

> ⚠️ Importar **reemplaza** el nodo destino. Hazlo antes de que haya respuestas
> (las respuestas viven en `respuestas/<deviceId>` dentro del mismo nodo, o en
> `app/evaluations` para la app). Tras importar, edita `data` desde el panel y
> actualiza `updatedAt` en cada cambio.

---

## `eventos/` — JSONs de eventos pasados (plantillas)

Contenido real de eventos ya celebrados, tal y como estuvo en Firebase. **No se
importan en código** — se conservan como **plantilla de referencia**: sin acceso
a Firebase, un agente IA (o un humano) puede ver aquí cómo se maqueta cada
sección de un evento (BBCode incluido) y construir JSONs nuevos con la misma
estructura. Convención de paths y pasos para crear un evento nuevo:
`docs/funcionalidades/EVENTOS.md` (raíz del monorepo).

### `eventos/jubileo-2025/` — Jubileo de los Jóvenes (Roma 2025)

Cada archivo corresponde a una sección del nodo `jubileo/` de Firebase
(estructura legacy, hoy los eventos nuevos van bajo `activities/<nombre>/`):

| Archivo                   | Nodo Firebase        | Qué contiene                                 |
| ------------------------- | -------------------- | -------------------------------------------- |
| `jubileo-horario.json`    | `jubileo/horario`    | Días con eventos (hora, título, descripción) |
| `jubileo-materiales.json` | `jubileo/materiales` | Materiales con páginas en BBCode             |
| `jubileo-profundiza.json` | `jubileo/profundiza` | Contenido "Profundiza" en BBCode             |
| `jubileo-visitas.json`    | `jubileo/visitas`    | Lugares para visitar (descripción, mapa)     |
| `jubileo-grupos.json`     | `jubileo/grupos`     | Grupos de participantes                      |
| `jubileo-contactos.json`  | `jubileo/contactos`  | Teléfonos de contacto                        |
| `jubileo-apps.json`       | `jubileo/apps`       | Apps recomendadas para el evento             |

### `eventos/visita-papa-2026/` — Visita del Papa

| Archivo                      | Nodo Firebase                        | Qué contiene                                                                                          |
| ---------------------------- | ------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| `visitapapa-materiales.json` | `activities/visitapapa26/materiales` | Materiales por día con páginas en BBCode                                                              |
| `visita-misa.json`           | —                                    | Texto fuente del libreto de la misa (no es JSON pese a la extensión; materia prima de los materiales) |
