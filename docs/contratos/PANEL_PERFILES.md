# MCM Panel — Gestión del Sistema de Perfiles

> Documento para el agente que va a adaptar **mcmpanel** (Next.js admin) al
> nuevo sistema de perfiles/delegaciones de la app MCM. Aquí se describe la
> estructura en Firebase Realtime Database, qué controla cada cosa, y cómo
> debería ser la UI de administración.
>
> **Diseño técnico completo de la app cliente**: `mcm-app/TODO_SISTEMA_PERFILES.md`.
> **Seed inicial listo para importar**: `mcm-app/firebase-seed/profileConfig.json`.

---

## 0. Resumen ejecutivo

La app cliente (Expo/React Native) ha eliminado los antiguos `featureFlags` y
ahora lee toda la configuración desde **un único nodo en Firebase RTDB**:
`/profileConfig`. Cuando el panel modifica ese nodo, los cambios llegan a la
app la próxima vez que se abre (patrón `updatedAt` + caché en AsyncStorage).

El panel debe permitir gestionar **cuatro cosas** que afectan al sistema:

1. `/profileConfig` — perfiles, delegaciones, overrides, flags globales.
2. `/calendars` — fuentes ICS (existente, ya estaba antes).
3. `/albums` — opcionalmente etiquetar álbumes con `tags` para que solo los
   vea cierto perfil.
4. `/pushTokens` — los tokens de los usuarios ahora vienen con `profileType`,
   `delegationId` y `topics` para segmentar al enviar notificaciones.

Lo importante: **toda la lógica de resolución vive en la app**. El panel solo
edita JSON. El cliente combina perfil + delegación + overrides al arrancar.

---

## 1. Estructura del nodo `/profileConfig`

```
/profileConfig
├── updatedAt: "2026-04-30T12:00:00.000Z"     ← timestamp ISO. La app refresca caché si cambia.
└── data
    ├── global
    ├── profiles
    │   ├── familia
    │   ├── monitor
    │   └── miembro
    ├── delegations
    │   ├── _default
    │   ├── mcm-castellon
    │   ├── mcm-madrid
    │   └── ...
    ├── delegationList
    └── overrides       (opcional)
```

> **Importante**: cada vez que el panel guarde un cambio en `/profileConfig`,
> debe **actualizar también `updatedAt`** (`new Date().toISOString()`). Si no lo
> hace, los clientes que ya tengan caché no verán los cambios.

### 1.1. `data.global` — flags globales (afectan a todos los usuarios)

```jsonc
{
  "defaultTab": "index",            // tab inicial cuando se abre la app
  "showNotificationsIcon": true,    // si se muestra la campana en Home
  "showOnboarding": true,           // si la app fuerza onboarding al primer arranque
  "showChangeNameButton": false,    // legacy, dejar en false
  "maintenanceMode": false,         // ⚠ true → toda la app muestra MaintenanceScreen
  "maintenanceMessage": "",         // mensaje opcional durante mantenimiento
  "minAppVersion": "0.0.0"          // semver mínima soportada. "0.0.0" = sin bloqueo
}
```

**Casos de uso desde el panel**:

- _Apagar notificaciones temporalmente_: `showNotificationsIcon = false`.
- _Avisar de mantenimiento programado_: `maintenanceMode = true` +
  `maintenanceMessage = "Volvemos en 1 h"`.
- _Forzar actualización_ tras un release crítico: subir `minAppVersion` a la
  nueva versión publicada en stores. Las apps inferiores verán pantalla
  bloqueante con botón "Ir a la tienda".

### 1.2. `data.profiles.{familia | monitor | miembro}` — perfiles base

Las claves son **fijas** (los tres perfiles posibles). El panel **no** debe
permitir crear/borrar perfiles — solo editar su contenido. Si alguna vez se
añade un cuarto perfil, hay que tocar también el código del cliente.

```jsonc
{
  "label": "Familia",
  "description": "Padres, madres y familiares",
  "tabs": ["index", "cancionero", "contigo", "calendario", "fotos", "mas"],
  "homeButtons": ["comunica", "cancionero", "fotos", "evangelio", "mas"],
  "masItems": ["comunica", "jubileo"],
  "defaultCalendars": [],            // ⚠ rellenar con IDs reales de /calendars
  "albumTags": ["all"],
  "notificationTopics": ["general", "eventos", "familias"]
}
```

Cada array es una **lista de IDs** que la app conoce. Si el panel mete un ID
que la app no conoce, el cliente lo descarta silenciosamente con un warning
(no rompe la UI). Los IDs válidos son los del catálogo:

| Campo                | IDs aceptados                                                                            | Notas                                               |
| -------------------- | ---------------------------------------------------------------------------------------- | --------------------------------------------------- |
| `tabs`               | `index`, `cancionero`, `contigo`, `calendario`, `fotos`, `comunica`, `mas`               | Pestañas de la barra inferior                        |
| `homeButtons`        | `comunica`, `cancionero`, `fotos`, `evangelio`, `mas`                                    | Botones del grid de la Home                          |
| `masItems`           | `comunica`, `comunica-gestion`, `jubileo`                                                | Items del menú "Más"                                 |
| `albumTags`          | `all`, `general`, `encuentros`, `interno`, `monitores`, `miembros`                       | Tags de visibilidad de fotos. `"all"` = ver todo     |
| `notificationTopics` | `general`, `eventos`, `familias`, `monitores`, `miembros`                                | Topics base. Las delegaciones añaden los suyos       |
| `defaultCalendars`   | IDs de `/calendars` (ej. `mcm-europa`)                                                   | **No validados contra catálogo** — ojo con typos    |

**UX recomendada del panel para editar un perfil**:

- Para `tabs`, `homeButtons`, `masItems`, `albumTags`, `notificationTopics`:
  **multiselect con checkboxes** mostrando los IDs aceptados (lista cerrada).
  No usar input libre — meter un ID inválido hace que la app lo ignore y el
  admin se pregunta por qué no aparece.
- Para `defaultCalendars`: **multiselect** poblado con los calendarios reales
  de `/calendars` (mostrar `name`, guardar `id`).
- `label` y `description` son texto libre — se muestran al usuario en el
  onboarding y en Ajustes, así que tratar como copy.

### 1.3. `data.delegations.{id}` — delegaciones

`_default` es **obligatoria**. Todas las demás delegaciones deben existir
también, aunque solo tengan `label` (heredan resto de `_default`).

```jsonc
// Caso 1: delegación "normal" — solo necesita label
{
  "label": "MCM Granada"
}

// Caso 2: delegación con calendario y topic propios
{
  "label": "MCM Castellón",
  "notificationTopic": "castellon",          // string libre — se publicará en /pushTokens.topics
  "extraCalendars": ["castellon-local"],      // se concatenan a profile.defaultCalendars
  "extraHomeButtons": [],                     // aditivos opcionales
  "extraMasItems": [],
  "extraAlbumTags": [],
  "extraTabs": []
}

// Caso 3: delegación que reemplaza un campo entero para todos sus perfiles
{
  "label": "MCM Madrid",
  "override": {
    "tabs": ["index", "cancionero", "calendario", "fotos", "mas"]   // sin contigo, p.ej.
  }
}
```

**Aditivos vs override**:

- **`extraX`** → SE CONCATENAN a lo que tenga el perfil base (deduplicado).
- **`override`** → REEMPLAZA el campo entero del perfil base.

> **Nota sobre `notificationTopic`**: este campo es un **string libre**, no se
> valida contra el catálogo — se cuela tal cual al array `topics` que se
> escribe en `/pushTokens/{id}/topics`. Esto permite añadir delegaciones
> nuevas sin tocar código de la app. Convención: usar slug en kebab-case
> (`castellon`, `mcm-madrid`).

### 1.4. `data.delegationList` — lista para el selector

Array ordenado de las delegaciones que aparecen en el onboarding y en
Ajustes. Es independiente de `data.delegations` para permitir reordenar /
ocultar sin perder la config:

```json
[
  { "id": "mcm-espana", "label": "MCM España" },
  { "id": "mcm-castellon", "label": "MCM Castellón" },
  { "id": "mcm-madrid", "label": "MCM Madrid" }
]
```

> **Importante**: si una delegación está en `data.delegations` pero NO en
> `data.delegationList`, el usuario no podrá seleccionarla en el onboarding.
> El panel debería avisar al admin si detecta esa inconsistencia.

### 1.5. `data.overrides` — combinaciones específicas perfil:delegación

Para casos como "las familias de Castellón ven una tab extra que el resto de
familias no ve". La clave es `"perfil:delegación"` y el valor es un parcial
de `ProfileBase` que **reemplaza** los campos que defina:

```jsonc
{
  "familia:mcm-castellon": {
    "tabs": ["index", "cancionero", "fotos", "mas", "comunica"]
  },
  "monitor:mcm-madrid": {
    "masItems": ["jubileo", "comunica-gestion", "formacion-madrid"]
  }
}
```

**UX recomendada**: tabla con columnas `Perfil`, `Delegación`, `Campos
sobreescritos`. El admin elige perfil + delegación de selectores poblados con
los valores reales y luego marca qué campos quiere reemplazar.

---

## 2. Orden de resolución (lo que hace el cliente)

Esto **no** es algo que el panel ejecute — pero conviene que el admin entienda
el orden para que entienda lo que va a ver el usuario:

```
1. Perfil base (profiles[X])
   ↓
2. + extraTabs / extraHomeButtons / extraMasItems / extraCalendars /
     extraAlbumTags / notificationTopic        (concatenados, dedup)
   ↓
3. + delegations[id].override                  (reemplaza campos enteros)
   ↓
4. + overrides["perfil:delegacion"]            (reemplaza campos enteros)
   ↓
5. Sanitización contra catálogo conocido       (descarta IDs inválidos)
   ↓
6. + flags globales (data.global)
```

**Implicación para el panel**: si el admin define un `override` a nivel
delegación y _además_ un `overrides["perfil:delegacion"]`, el segundo gana
sobre los campos que defina. Mostrar esto visualmente en la edición ayuda a
no marearse.

---

## 3. Cambios en otros nodos relacionados

### 3.1. `/calendars` (existente, sin cambios estructurales)

Cada calendario sigue teniendo `id`, `name`, `url`, `color`,
`defaultSelected`. El nuevo sistema usa el `id` para que `defaultCalendars`
del perfil pueda referenciarlo.

**Recomendación para el panel**: en la pantalla de gestión de calendarios,
mostrar para cada calendario en qué perfiles está pre-seleccionado (lectura
inversa de `profiles.*.defaultCalendars`). Útil para evitar que el admin
borre un calendario que está en uso.

### 3.2. `/albums` (campo opcional nuevo)

Cada álbum admite ahora un campo `tags` opcional:

```jsonc
{
  "id": "encuentro-2026",
  "title": "Encuentro Nacional 2026",
  "imageUrl": "...",
  "albumUrl": "...",
  "tags": ["interno", "monitores"]    // ← nuevo, opcional
}
```

**Reglas de visibilidad** (las aplica el cliente):

- Perfil con `albumTags: ["all"]` → ve TODOS los álbumes.
- Álbum sin `tags` o con `tags: []` → visible para todos (retrocompatible).
- En otro caso, se muestra si hay intersección entre `album.tags` y
  `profile.albumTags`.

**UX recomendada del panel**: en el formulario del álbum, multiselect de
tags con los valores del catálogo (`general`, `encuentros`, `interno`,
`monitores`, `miembros`). Texto explicativo: _"Sin tags = todos lo ven. Con
tags = solo lo ven perfiles con esa etiqueta."_

### 3.3. `/pushTokens/{id}` — tokens ampliados

Cada token registrado por la app ahora trae metadata para segmentar
notificaciones desde el panel:

```jsonc
{
  "token": "ExponentPushToken[...]",
  "platform": "ios",
  "registeredAt": "2026-01-15T10:30:00.000Z",
  "lastActive": "2026-04-30T08:00:00.000Z",
  "appVersion": "1.0.1",
  "deviceInfo": { "model": "iPhone 15", "osVersion": "18.2" },
  "profileType": "monitor",                          // ← nuevo (puede ser null)
  "delegationId": "mcm-castellon",                   // ← nuevo (puede ser null)
  "topics": ["general", "eventos", "monitores",      // ← nuevo (pre-computado)
             "castellon"]
}
```

`topics` es la **unión** de los `notificationTopics` del perfil + el
`notificationTopic` de la delegación. Se pre-computa en el cliente para que
el panel pueda hacer queries sencillas.

**Queries típicas para enviar notificaciones desde el panel**:

```js
// Todos los de Castellón
pushTokens.where('delegationId', '==', 'mcm-castellon')

// Todos los monitores (cualquier delegación)
pushTokens.where('profileType', '==', 'monitor')

// Monitores de Madrid
pushTokens.where('profileType', '==', 'monitor')
          .where('delegationId', '==', 'mcm-madrid')

// Cualquiera con topic "general" (= todos los onboarded)
pushTokens.where('topics', 'array-contains', 'general')
```

**UX recomendada del panel** para el composer de notificaciones:

- Selector de **destinatarios** con tres formas combinables:
  - **Todos** (equivale a topic `general`).
  - **Por perfil**: checkbox `Familia` / `Monitor/a` / `Miembro MCM`.
  - **Por delegación**: multiselect poblado con `delegationList`.
- Al pulsar "previsualizar", calcular cuántos tokens cumplen el filtro
  (recuento de docs en `/pushTokens` que cuadran).
- Avisar si `profileType === null` (usuarios que saltaron el onboarding) —
  el admin decide si los incluye o no.

> **Nota sobre tokens "huérfanos"**: la app usa el propio token sanitizado
> como ID en `/pushTokens` (ya no un `deviceId` aleatorio). Esto evita que
> reinstalaciones acumulen tokens muertos. Aun así, es buena idea tener una
> rutina de limpieza que borre tokens con `lastActive` > 90 días.

---

## 4. Flujos de admin en mcmpanel

### 4.1. "Cambiar la experiencia por defecto del perfil Familia"

1. Panel → _Perfiles_ → _Familia_.
2. Edita arrays (`tabs`, `homeButtons`, `masItems`, `albumTags`,
   `notificationTopics`, `defaultCalendars`) con multiselects.
3. Al guardar: escribir `data.profiles.familia` y refrescar
   `updatedAt`.
4. La próxima apertura de la app aplica los cambios.

### 4.2. "Añadir una delegación nueva (Sevilla)"

1. Panel → _Delegaciones_ → _Nueva_.
2. Rellenar `id` (slug, ej. `mcm-sevilla`) y `label` (display name).
3. Si es "normal", solo se guarda con label.
4. Si tiene calendario propio: añadir `extraCalendars: ["sevilla-local"]`
   (panel debe hacer multiselect contra `/calendars`).
5. Si tiene topic de notificaciones propio: `notificationTopic: "sevilla"`
   (string libre, slug).
6. Panel debe **automáticamente** añadirla a `delegationList` (a no ser que
   el admin la marque como "oculta").

### 4.3. "Hacer mantenimiento programado el sábado"

1. Panel → _Sistema_ → _Modo mantenimiento_.
2. Toggle `maintenanceMode = true`.
3. Mensaje opcional: `maintenanceMessage = "Volvemos a las 18:00"`.
4. Guardar.
5. Toda la app cliente muestra `MaintenanceScreen` hasta que el admin lo
   apague.

### 4.4. "Forzar actualización a 1.0.5 tras release crítico"

1. Panel → _Sistema_ → _Versión mínima_.
2. `minAppVersion = "1.0.5"`.
3. Apps con `appVersion < 1.0.5` ven `MaintenanceScreen` modo update con
   botón a la tienda.
4. Apps con `appVersion >= 1.0.5` siguen funcionando normalmente.

### 4.5. "Enviar notificación solo a monitores de Castellón"

1. Panel → _Notificaciones_ → _Nueva_.
2. Selector de destinatarios → perfil `monitor` + delegación
   `mcm-castellon`.
3. Query a `/pushTokens` con esos filtros.
4. Enviar via Expo Push API a los tokens resultantes.
5. **Recordar** crear también el documento en `/notifications/{id}` para que
   aparezca en el historial dentro de la app (esto ya lo hace el panel
   actual, pero hay que cuidar que se creen ambos: el envío + el registro).

---

## 5. Validaciones que debería hacer el panel antes de guardar

| Check                                                                                                            | Severidad | Acción                                                                                            |
| ---------------------------------------------------------------------------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------- |
| `tabs` no contiene `index`                                                                                       | warning   | Aviso: "El usuario no podrá volver a Inicio". Permitir guardar.                                   |
| `tabs` está vacío                                                                                                | error     | Bloquear. La app caería al fallback.                                                              |
| `defaultCalendars` referencia un ID que ya no está en `/calendars`                                                | warning   | Avisar y ofrecer limpiar.                                                                         |
| `delegationList` tiene un id que no existe en `delegations`                                                       | warning   | Crear automáticamente la entrada con solo `label`.                                                |
| `delegations.{id}` existe pero no está en `delegationList`                                                        | warning   | Avisar: "El usuario no podrá seleccionar esta delegación".                                        |
| `notificationTopic` con caracteres raros (espacios, mayúsculas)                                                   | warning   | Auto-slugify (`"MCM Castellón"` → `"mcm-castellon"`).                                             |
| `overrides[k]` con clave malformada (no `perfil:delegacion`)                                                      | error     | Bloquear.                                                                                         |
| `minAppVersion` no es semver válido                                                                                | error     | Bloquear. La app interpretaría `0.0.0` y no bloquearía nada.                                      |
| Cambios en `/profileConfig` sin actualizar `updatedAt`                                                            | error     | El panel debe forzar `updatedAt = new Date().toISOString()` en cada guardado.                     |

---

## 6. Seed inicial

El seed inicial está en `mcm-app/firebase-seed/profileConfig.json` y ya
contiene:

- `global` con valores por defecto seguros.
- Los 3 perfiles base con tabs/homeButtons/masItems/albumTags/notificationTopics
  pre-configurados.
- Las 16 delegaciones de MCM España (sin `notificationTopic` ni
  `extraCalendars` aún — son "normales").
- `delegationList` con las 16 delegaciones ordenadas.

**El admin debe**:

1. Importar este JSON al nodo `/profileConfig` desde la consola Firebase.
2. Rellenar `data.profiles.*.defaultCalendars` con IDs reales de
   `/calendars` (vienen vacíos en el seed).
3. Añadir `notificationTopic` / `extraCalendars` / `override` a las
   delegaciones que tengan algo especial (Castellón, Madrid, etc.).

El panel puede automatizar (1) — botón _"Inicializar profileConfig"_ que
copia el seed JSON al nodo si está vacío.

---

## 7. Pantallas mínimas que debería tener el panel

```
mcmpanel
├── /                              dashboard general
├── /perfiles                       lista + edición de los 3 perfiles
│   ├── /perfiles/familia
│   ├── /perfiles/monitor
│   └── /perfiles/miembro
├── /delegaciones                   tabla + edición de delegaciones
│   ├── /delegaciones/[id]
│   └── /delegaciones/nueva
├── /overrides                      tabla de overrides perfil:delegación
├── /sistema                        global flags (defaultTab, maintenance, minAppVersion, ...)
├── /calendarios                    (existente) + ahora con info de uso por perfil
├── /albumes                        (existente) + selector de tags
├── /notificaciones
│   ├── /notificaciones/nueva       composer con selector de destinatarios
│   └── /notificaciones/historial
└── /usuarios                       inspeccionar /pushTokens, ver distribución por perfil/delegación
```

---

## 8. Reglas de seguridad recomendadas

`/profileConfig` se lee desde la app sin autenticación (es config pública).
Para escritura, restringir solo a admins:

```json
{
  "rules": {
    "profileConfig": {
      ".read": true,
      ".write": "auth != null && root.child('admins').child(auth.uid).val() === true"
    },
    "albums": {
      ".read": true,
      ".write": "auth != null && root.child('admins').child(auth.uid).val() === true"
    },
    "calendars": {
      ".read": true,
      ".write": "auth != null && root.child('admins').child(auth.uid).val() === true"
    },
    "pushTokens": {
      ".read": "auth != null && root.child('admins').child(auth.uid).val() === true",
      ".write": true,
      "$tokenId": {
        ".validate": "newData.hasChildren(['token', 'platform', 'registeredAt'])"
      }
    },
    "notifications": {
      ".read": true,
      ".write": "auth != null && root.child('admins').child(auth.uid).val() === true"
    }
  }
}
```

(Adaptar al esquema de admins que ya use `mcmpanel`.)

---

## 9. Archivos del cliente referenciados

Si el agente del panel quiere ver cómo lo consume la app cliente:

| Pieza                  | Archivo                                            |
| ---------------------- | -------------------------------------------------- |
| Tipos TS               | `mcm-app/types/profileConfig.ts`                   |
| Catálogo de IDs        | `mcm-app/constants/profileCatalog.ts`              |
| Resolver puro          | `mcm-app/utils/resolveProfileConfig.ts`            |
| Fallback hardcoded     | `mcm-app/constants/defaultProfileConfig.ts`        |
| Seed JSON              | `mcm-app/firebase-seed/profileConfig.json`         |
| Provider Firebase      | `mcm-app/contexts/ProfileConfigContext.tsx`        |
| Hook combinado         | `mcm-app/hooks/useResolvedProfileConfig.ts`        |
| Pantalla de onboarding | `mcm-app/app/onboarding.tsx`                       |
| Pantalla de bloqueo    | `mcm-app/components/MaintenanceScreen.tsx`         |
| Token + topics         | `mcm-app/services/pushNotificationService.ts`      |
| Diseño técnico         | `mcm-app/TODO_SISTEMA_PERFILES.md`                 |

---

## 10. Checklist para el agente que adapte mcmpanel

- [ ] Pantalla de edición de los 3 perfiles con multiselects contra catálogo.
- [ ] Pantalla de edición de delegaciones (CRUD + extras + override).
- [ ] Sincronización automática `delegations` ↔ `delegationList`.
- [ ] Pantalla de overrides perfil:delegación.
- [ ] Pantalla de flags globales (mantenimiento, minAppVersion, ...).
- [ ] Selector de calendarios en `defaultCalendars` poblado desde `/calendars`.
- [ ] Selector de tags en álbumes poblado con catálogo.
- [ ] Composer de notificaciones con filtro por perfil + delegación, con
      preview de recuento.
- [ ] Forzar `updatedAt` en cada escritura de `/profileConfig`.
- [ ] Validaciones del §5 antes de guardar.
- [ ] Botón "Inicializar profileConfig desde seed" si el nodo está vacío.
- [ ] Reglas de seguridad RTDB actualizadas.

---

## Apéndice A — Tipos TypeScript listos para copiar al panel

Tal cual los usa la app cliente (`mcm-app/types/profileConfig.ts`). El panel
puede pegarlos en su propio proyecto Next.js para tipar formularios,
loaders y validadores sin reinventar la rueda.

```ts
export type ProfileType = 'familia' | 'monitor' | 'miembro';

export interface ProfileBase {
  label: string;
  description: string;
  tabs: string[];
  homeButtons: string[];
  masItems: string[];
  defaultCalendars: string[];
  albumTags: string[];
  notificationTopics: string[];
}

export interface Delegation {
  label: string;
  notificationTopic?: string;
  extraCalendars?: string[];
  extraHomeButtons?: string[];
  extraMasItems?: string[];
  extraAlbumTags?: string[];
  extraTabs?: string[];
  override?: Partial<ProfileBase>;
}

export interface DelegationListItem {
  id: string;
  label: string;
}

export interface GlobalConfig {
  defaultTab: string;
  showNotificationsIcon: boolean;
  showOnboarding: boolean;
  showChangeNameButton: boolean;
  maintenanceMode: boolean;
  maintenanceMessage?: string;
  minAppVersion: string;
}

export type OverrideKey = `${ProfileType}:${string}`;

export interface ProfileConfigData {
  global: GlobalConfig;
  profiles: Record<ProfileType, ProfileBase>;
  delegations: Record<string, Delegation> & { _default: Delegation };
  delegationList: DelegationListItem[];
  overrides?: Partial<Record<OverrideKey, Partial<ProfileBase>>>;
}

export interface ProfileConfigDocument {
  updatedAt: string;
  data: ProfileConfigData;
}

// Catálogos de IDs aceptados (deben coincidir con el cliente)
export const KNOWN_TABS = [
  'index', 'cancionero', 'contigo', 'calendario', 'fotos', 'comunica', 'mas',
] as const;
export const KNOWN_HOME_BUTTONS = [
  'comunica', 'cancionero', 'fotos', 'evangelio', 'mas',
] as const;
export const KNOWN_MAS_ITEMS = [
  'comunica', 'comunica-gestion', 'jubileo',
] as const;
export const KNOWN_ALBUM_TAGS = [
  'all', 'general', 'encuentros', 'interno', 'monitores', 'miembros',
] as const;
export const KNOWN_NOTIFICATION_TOPICS = [
  'general', 'eventos', 'familias', 'monitores', 'miembros',
] as const;
```

---

## Apéndice B — Ejemplo completo: añadir delegación con calendario y topic

**Contexto**: el admin quiere dar de alta MCM Sevilla. Tiene calendario
propio (`sevilla-local`) y debe recibir notificaciones segmentadas. Las
familias de Sevilla, además, deben ver una tab extra "Comunica" que el resto
de familias no ve.

### Estado en `/profileConfig/data` antes

```json
{
  "delegations": {
    "_default": { "label": "General" },
    "mcm-castellon": { "label": "MCM Castellón" }
  },
  "delegationList": [
    { "id": "mcm-castellon", "label": "MCM Castellón" }
  ],
  "overrides": {}
}
```

### Estado tras guardar desde el panel

```jsonc
{
  "delegations": {
    "_default": { "label": "General" },
    "mcm-castellon": { "label": "MCM Castellón" },
    "mcm-sevilla": {
      "label": "MCM Sevilla",
      "notificationTopic": "sevilla",
      "extraCalendars": ["sevilla-local"]
    }
  },
  "delegationList": [
    { "id": "mcm-castellon", "label": "MCM Castellón" },
    { "id": "mcm-sevilla", "label": "MCM Sevilla" }
  ],
  "overrides": {
    "familia:mcm-sevilla": {
      "tabs": ["index", "cancionero", "contigo", "calendario", "fotos", "comunica", "mas"]
    }
  }
}
```

**Pre-requisitos**: el calendario `sevilla-local` debe existir ya en
`/calendars`. El panel debería avisar si no es así.

**Resultado en el cliente** para una `familia` de Sevilla:

- Tabs visibles: `index, cancionero, contigo, calendario, fotos, comunica, mas`.
- Calendarios pre-seleccionados: los del perfil familia + `sevilla-local`.
- Push token registra `topics: ['general', 'eventos', 'familias', 'sevilla']`.
- Backend del panel puede enviar a "monitores de Sevilla" con
  `where('profileType', '==', 'monitor').where('delegationId', '==', 'mcm-sevilla')`.

**Importante**: tras escribir el cambio, actualizar también
`/profileConfig/updatedAt` con `new Date().toISOString()`. Si el panel usa
`update()` con varias paths a la vez, puede hacerlo en una sola
transacción:

```ts
await update(ref(db), {
  'profileConfig/data/delegations/mcm-sevilla': { /* ... */ },
  'profileConfig/data/delegationList': [/* ... */],
  'profileConfig/data/overrides/familia:mcm-sevilla': { /* ... */ },
  'profileConfig/updatedAt': new Date().toISOString(),
});
```

---

## Apéndice C — Trampas comunes

1. **Olvidar `updatedAt`**: si el panel modifica `data.*` pero no toca
   `updatedAt`, las apps con caché no verán los cambios hasta que algo más
   altere el timestamp. Solución: forzar el update siempre, idealmente desde
   un wrapper `saveProfileConfig()` único.

2. **Editar `delegations` sin tocar `delegationList`**: la delegación
   existirá técnicamente pero el usuario no podrá seleccionarla en el
   onboarding. Solución: cuando el admin crea una delegación nueva, añadirla
   automáticamente a `delegationList` (con un toggle "ocultar del selector"
   para casos especiales).

3. **IDs con typos en arrays del perfil**: la app descarta IDs desconocidos
   en silencio (warning solo en dev). El admin pensará que "no funciona" sin
   pista. Solución: usar multiselect cerrado contra el catálogo, no input
   libre.

4. **`notificationTopic` con espacios o mayúsculas**: backend que filtra por
   `topics` no encontrará coincidencia (el array contiene el string tal cual).
   Solución: auto-slugify al guardar.

5. **Borrar un calendario referenciado en `defaultCalendars`**: la app
   simplemente lo ignora (no crashea), pero el admin pensará que el cambio
   "no aplica". Solución: avisar antes de borrar un calendario y ofrecer
   limpiar las referencias.

6. **`maintenanceMode = true` sin avisar**: bloquea TODA la app. Solución:
   confirmación explícita al activarlo + mostrar timestamp del último
   `updatedAt` y quién lo activó.

7. **`minAppVersion` mal formado**: la función del cliente
   (`isAppVersionSupported`) es tolerante a NaN y trata strings inválidos
   como `0.0.0` (sin bloqueo). Pero el admin no se enterará de que el bloqueo
   no se está aplicando. Solución: validar semver con regex en el panel
   antes de guardar (`/^\d+\.\d+\.\d+(-[\w.]+)?(\+[\w.]+)?$/`).

8. **Overrides huérfanos**: dejar entradas en `overrides` que apuntan a
   delegaciones eliminadas. No rompe nada (el cliente los ignora) pero
   ensucia. Solución: limpiar `overrides[k]` cuando se borra una delegación.

9. **Asumir que un usuario tiene `profileType` definido**: la app permite
   _saltar_ el onboarding (queda como `miembro` + `_default` con
   `onboardingCompleted: false`). Esos tokens entran a `/pushTokens` con
   `profileType` válido pero `onboardingCompleted` no se guarda en el token.
   El panel solo ve `profileType` y `delegationId`, lo cual es suficiente
   para segmentar — pero conviene saber que esos usuarios "saltadores" están
   contados como `miembro` por defecto.

10. **No pre-computar `topics` desde el panel**: el array `topics` lo escribe
    siempre la app cliente al cambiar perfil/delegación. **El panel no debe
    sobreescribirlo** desde la edición de `/pushTokens` — solo leerlo para
    queries.

---

## Apéndice D — Glosario rápido

| Término               | Significado                                                                                                                |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| **Perfil** (profile)  | Tipo de usuario: `familia`, `monitor`, `miembro`. Fijo. Define la experiencia base.                                        |
| **Delegación**        | Localización dentro de MCM (Castellón, Madrid, ...). Variable. Aporta extras o sobreescribe la experiencia.                 |
| **Resolver**          | Función pura del cliente que combina perfil + delegación + overrides → config final que la UI consume.                      |
| **Aditivo** (`extraX`)| Campo que se concatena al array del perfil base.                                                                            |
| **Override**          | Campo que reemplaza por completo el del perfil base.                                                                        |
| **Override específico**| Entrada en `overrides["perfil:delegacion"]` — máxima granularidad, gana sobre el override de la delegación.                |
| **Topic**             | Etiqueta arbitraria que se publica en `/pushTokens.topics` para que el backend pueda filtrar destinatarios.                 |
| **Catálogo**          | Lista cerrada de IDs aceptados por el cliente (`KNOWN_TABS`, etc.). IDs fuera del catálogo se descartan en sanitización.    |
| **Seed**              | JSON inicial (`firebase-seed/profileConfig.json`) que se importa a Firebase la primera vez. Sirve también de fallback.      |
| **`updatedAt`**       | Timestamp ISO en la raíz del documento. La app refresca caché solo cuando cambia. Hay que tocarlo en cada escritura.        |
| **`maintenanceMode`** | Kill switch global que muestra `MaintenanceScreen` en toda la app.                                                          |
| **`minAppVersion`**   | Kill switch que fuerza actualización si la versión instalada es inferior. `0.0.0` = desactivado.                            |
