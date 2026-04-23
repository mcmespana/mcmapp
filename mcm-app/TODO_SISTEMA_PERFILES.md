# Sistema de Perfiles de Usuario — Diseño técnico

> Documento de diseño para personalizar la experiencia de la app MCM según perfil de usuario y delegación local.
> **Estado**: ✅ Fases 0–8 completadas · **Fecha última revisión**: abril 2026
>
> **Cambios de la revisión abril 2026**
>
> - Pseudocódigo de resolución corregido (orden de merge, ver §5).
> - Bloque `global` ampliado a los 6 flags actuales + `minAppVersion` + `maintenanceMode`.
> - Se añaden overrides a nivel delegación (`delegations.*.override` y `extraX` aditivos).
> - Dependencia circular entre providers resuelta con hook `useResolvedProfileConfig()`.
> - Sin migración de usuarios: onboarding en primer arranque, fallback = `miembro` + `_default` si se salta.
> - Eliminada la pretensión de "tiempo real con listener"; basta con re-fetch al abrir la app (patrón `useFirebaseData` existente).
> - Fase 0 ejecutada: JSON seed, tipos, resolver, catálogo y fallback hardcoded creados.

---

## Índice

1. [Resumen](#1-resumen)
2. [Decisiones de arquitectura](#2-decisiones-de-arquitectura)
3. [Almacenamiento: qué va dónde](#3-almacenamiento-qué-va-dónde)
4. [Estructura en Firebase: nodo /profileConfig](#4-estructura-en-firebase-nodo-profileconfig)
5. [Sistema de resolución de config](#5-sistema-de-resolución-de-config)
6. [Personalización por área](#6-personalización-por-área)
7. [Push notifications](#7-push-notifications)
8. [Flujo de usuario](#8-flujo-de-usuario)
9. [Impacto en código existente](#9-impacto-en-código-existente)
10. [Login futuro opcional](#10-login-futuro-opcional)
11. [Ejemplos prácticos](#11-ejemplos-prácticos)

---

## 1. Resumen

La app necesita personalizar la experiencia según dos ejes:

| Eje            | Opciones                          | Ejemplo                                                                         |
| -------------- | --------------------------------- | ------------------------------------------------------------------------------- |
| **Perfil**     | Familia · Monitor/a · Miembro MCM | Un monitor ve secciones de grupos y materiales extra                            |
| **Delegación** | ~15 delegaciones locales          | Alguien de Castellón recibe notificaciones locales y ve calendarios específicos |

Esto afecta a: **tabs visibles**, **botones del home**, **calendarios pre-seleccionados**, **álbumes de fotos**, **secciones del menú "Más"** y **notificaciones push**.

Además, se pueden dar **combinaciones específicas** — por ejemplo, "las familias de Castellón ven una tab extra que otras familias no ven".

---

## 2. Decisiones de arquitectura

### 2.1. Config-driven desde Firebase (remota)

**Decisión**: Toda la configuración de perfiles vive en un nodo de Firebase Realtime Database (`/profileConfig`). La app la descarga, la cachea en local, y la usa para decidir qué mostrar.

**Por qué**:

- Puedes cambiar qué ve cada perfil/delegación **sin hacer deploy** de la app
- Funciona con el patrón `useFirebaseData` que ya tenéis (descarga + caché en AsyncStorage)
- El panel admin (`mcmpanel`) puede editarlo
- Si Firebase no está disponible → se usa un fallback hardcoded en la app

**Latencia de propagación**: los cambios se aplican **la siguiente vez que se abra la app** (patrón `useFirebaseData` con comparación de `updatedAt`). No se usa un listener `onValue` permanente — no es necesario para este caso de uso.

### 2.2. Feature flags fusionados (un solo sistema)

**Decisión**: El actual `constants/featureFlags.ts` + `FeatureFlagsContext.tsx` se absorben dentro del nuevo sistema de perfiles. No hay dos sistemas controlando visibilidad.

**Cómo**: La config remota incluye un bloque `global` que reemplaza los feature flags actuales. El `ProfileConfigContext` nuevo reemplaza al `FeatureFlagsContext`.

**Resultado**: UN solo contexto, UN solo sitio donde mirar.

### 2.3. Delegación por defecto + overrides

**Decisión**: La mayoría de delegaciones son idénticas. Se define una config `_default` y solo las delegaciones especiales (2-3) definen overrides.

**Ventaja**: Añadir una delegación nueva = añadir solo su nombre a la lista. No hay que copiar config.

---

## 3. Almacenamiento: qué va dónde

| Dato                       | Dónde                              | Clave                    | Notas                                           |
| -------------------------- | ---------------------------------- | ------------------------ | ----------------------------------------------- |
| Tipo de perfil             | AsyncStorage                       | `@user_profile`          | Parte del UserProfile ampliado                  |
| ID de delegación           | AsyncStorage                       | `@user_profile`          | Reemplaza el campo `location` actual            |
| Nombre del usuario         | AsyncStorage                       | `@user_profile`          | Opcional, se mantiene                           |
| Onboarding completado      | AsyncStorage                       | `@user_profile`          | Flag booleano                                   |
| Config de perfiles         | Firebase RTDB + caché AsyncStorage | `/profileConfig`         | Se descarga con `useFirebaseData`               |
| Push token + metadata      | Firebase RTDB                      | `/pushTokens/{deviceId}` | Se amplía con profileType y delegationId        |
| Qué tabs/secciones mostrar | **No se almacena**                 | —                        | Se computa en tiempo real a partir de la config |

**Principio clave**: En una reinstalación, el usuario reconfigura desde cero. No pasa nada. Lo único persistente en la nube es la metadata del push token (para segmentar notificaciones).

---

## 4. Estructura en Firebase: nodo /profileConfig

```
/profileConfig
├── updatedAt: "2026-04-23T00:00:00.000Z"
└── data
    ├── global                          ← Reemplaza featureFlags.ts por completo
    │   ├── defaultTab: "index"
    │   ├── showNotificationsIcon: true
    │   ├── showOnboarding: true        ← antes showUserProfilePrompt
    │   ├── showChangeNameButton: false
    │   ├── maintenanceMode: false
    │   ├── maintenanceMessage: ""      ← opcional
    │   └── minAppVersion: "0.0.0"      ← kill switch; 0.0.0 = sin bloqueo
    │
    ├── profiles
    │   ├── familia
    │   │   ├── label, description
    │   │   ├── tabs, homeButtons, masItems
    │   │   ├── defaultCalendars, albumTags
    │   │   └── notificationTopics
    │   ├── monitor      (misma estructura)
    │   └── miembro      (misma estructura)
    │
    ├── delegations
    │   ├── _default                    ← Usado para toda delegación no listada
    │   │   └── label: "General"
    │   │
    │   └── castellon                   ← Ejemplo con todas las opciones
    │       ├── label: "Castellón"
    │       ├── notificationTopic: "castellon"
    │       ├── extraCalendars: ["castellon-local"]
    │       ├── extraHomeButtons: []    ← aditivos opcionales
    │       ├── extraMasItems: []
    │       ├── extraAlbumTags: []
    │       ├── extraTabs: []
    │       └── override:               ← reemplaza campos completos para TODOS los
    │           tabs: [...]              perfiles de esta delegación (opcional)
    │
    ├── delegationList                  ← Lista ordenada para el selector del onboarding
    │   └── [{ id, label }, ...]        (hasta ~15)
    │
    └── overrides                       ← Combinaciones perfil:delegación específicas
        └── "familia:castellon":
            tabs: [...]                 ← reemplaza solo para familias de Castellón
```

### Notas sobre la estructura

- **`global`**: Contiene **todos los antiguos feature flags** + `showOnboarding`, `maintenanceMode`, `maintenanceMessage` y `minAppVersion`. El fichero `constants/featureFlags.ts` se puede eliminar tras la fase 8.
- **`profiles`**: Config base por perfil. Arrays de IDs que referencian tabs, botones, calendarios, etc. existentes en la app. Los IDs se validan contra `constants/profileCatalog.ts` (ver §12).
- **`delegations._default`**: Fallback para cualquier delegación no listada. Solo hace falta crear entrada si la delegación tiene algo especial.
- **`delegations.{id}`**: Dos niveles de personalización por delegación:
  - `extraX` (aditivos) → se concatenan a los arrays del perfil. Ideal para añadir 1-2 items.
  - `override` (reemplazos) → reemplaza campos enteros. Útil cuando una delegación cambia radicalmente algo para todos sus perfiles.
- **`overrides["perfil:delegacion"]`**: máxima granularidad. Reemplaza campos solo para esa combinación concreta (ej. "las familias de Castellón ven una tab extra").
- **`delegationList`**: Lista separada para el UI del onboarding/settings — permite reordenar y añadir delegaciones sin tocar `delegations`.
- **`minAppVersion`**: si `appVersion < minAppVersion` la app bloquea con pantalla "Actualiza". Comparación semver (`utils/resolveProfileConfig.ts → isAppVersionSupported`). Por defecto `0.0.0` = desactivado.

---

## 5. Sistema de resolución de config

El hook `useResolvedProfileConfig()` resuelve la config final en este orden (ver implementación real en `utils/resolveProfileConfig.ts`):

```
1. Arrancar desde el perfil base (profiles[profileType])
         ↓
2. Aplicar delegación:
   a. extraTabs, extraHomeButtons, extraMasItems,
      extraCalendars, extraAlbumTags, notificationTopic
      → se CONCATENAN a los arrays del perfil (deduplicado)
   b. delegations[id].override (Partial<ProfileBase>)
      → REEMPLAZA campos enteros (afecta a todos los perfiles en esa delegación)
         ↓
3. Aplicar override específico overrides["<perfil>:<delegacion>"]
   → REEMPLAZA campos enteros (máxima granularidad)
         ↓
4. Sanitizar contra catálogo (constants/profileCatalog.ts):
   IDs desconocidos se descartan con warning; si el array queda vacío
   se usa el del perfil base como red de seguridad.
         ↓
5. Añadir los campos `global` al objeto resultado.
         ↓
6. Resultado: ResolvedProfileConfig plano, listo para consumir.
```

### Pseudocódigo (versión real)

```typescript
export function resolveProfileConfig(
  config: ProfileConfigData,
  profileType: ProfileType,
  delegationId: string | null,
): ResolvedProfileConfig {
  const profile = config.profiles[profileType];
  const id = delegationId ?? '_default';
  const delegation = config.delegations[id] ?? config.delegations._default;

  // 1. Clon del perfil base
  let merged: ProfileBase = { ...profile, /* arrays clonados */ };

  // 2a. Aditivos de la delegación
  if (delegation.extraTabs)         merged.tabs          = uniq([...merged.tabs, ...delegation.extraTabs]);
  if (delegation.extraHomeButtons)  merged.homeButtons   = uniq([...merged.homeButtons, ...delegation.extraHomeButtons]);
  if (delegation.extraMasItems)     merged.masItems      = uniq([...merged.masItems, ...delegation.extraMasItems]);
  if (delegation.extraCalendars)    merged.defaultCalendars = uniq([...merged.defaultCalendars, ...delegation.extraCalendars]);
  if (delegation.extraAlbumTags)    merged.albumTags     = uniq([...merged.albumTags, ...delegation.extraAlbumTags]);
  if (delegation.notificationTopic) merged.notificationTopics = uniq([...merged.notificationTopics, delegation.notificationTopic]);

  // 2b. Override a nivel delegación (todos los perfiles)
  merged = { ...merged, ...(delegation.override ?? {}) };

  // 3. Override específico profile:delegation
  const specific = config.overrides?.[`${profileType}:${id}`];
  merged = { ...merged, ...(specific ?? {}) };

  // 4. Sanitización (filtra IDs desconocidos + fallback si queda vacío)
  //    → usa KNOWN_TABS, KNOWN_HOME_BUTTONS, KNOWN_MAS_ITEMS,
  //      KNOWN_ALBUM_TAGS, KNOWN_NOTIFICATION_TOPICS

  // 5. Añadir campos globales al resultado plano
  return {
    ...config.global,        // defaultTab, showNotificationsIcon, showOnboarding, …
    profileType, delegationId: id,
    profileLabel: profile.label,
    delegationLabel: delegation.label,
    tabs: merged.tabs,
    homeButtons: merged.homeButtons,
    masItems: merged.masItems,
    defaultCalendars: merged.defaultCalendars,
    albumTags: merged.albumTags,
    notificationTopics: merged.notificationTopics,
  };
}
```

### Fallback hardcoded

El fichero `firebase-seed/profileConfig.json` es la **fuente única** de verdad para el seed de Firebase **y** para el fallback en código. `constants/defaultProfileConfig.ts` lo importa y expone:

- `DEFAULT_PROFILE_CONFIG_DATA` — el nodo `data` completo.
- `DEFAULT_RESOLVED_PROFILE_CONFIG` — ya resuelto para `miembro` + `_default` (listo para render inmediato sin red).

Si un usuario salta el onboarding, la app asume `profileType = 'miembro'` y `delegationId = _default`, y muestra un banner sutil en Home invitando a personalizar desde Ajustes.

---

## 6. Personalización por área

### 6.1. Tabs (barra inferior)

La config del perfil define un array `tabs` con los IDs de tabs visibles.

| Perfil  | Tabs                                                    |
| ------- | ------------------------------------------------------- |
| Familia | index, cancionero, calendario, fotos, mas               |
| Monitor | index, cancionero, calendario, fotos, mas               |
| Miembro | index, cancionero, calendario, fotos, **comunica**, mas |

**Implementación**: En `app/(tabs)/_layout.tsx`, filtrar `TABS_CONFIG` con los tabs del perfil resuelto. Si un tab no está en la lista, se renderiza con `href: null` (patrón actual de expo-router para ocultar tabs).

### 6.2. Home screen (botones)

La config define `homeButtons` — array de IDs de botones. La Home filtra los `navigationItems` según esta lista.

### 6.3. Menú "Más"

La config define `masItems` — array de IDs de secciones. MasHomeScreen filtra sus items según esta lista.

### 6.4. Calendarios

Los calendarios ya existen en Firebase en el nodo `/calendars` con sus IDs, nombres, URLs y colores. El perfil no crea calendarios nuevos — solo dice **cuáles pre-seleccionar** de los que ya existen.

- `defaultCalendars` del perfil → IDs de calendarios a marcar como visibles por defecto
- `extraCalendars` de la delegación → se añaden a los del perfil
- El usuario **siempre puede** activar/desactivar calendarios manualmente en la pantalla de Calendario
- Cambiar perfil/delegación **resetea** la selección a los defaults (o no — decisión de UX)

**Integración con `useCalendarConfigs.ts`**: Al inicializar `visibleCalendars`, si el usuario no tiene settings guardados (primera vez o tras cambio de perfil), se usan los `defaultCalendars` del perfil resuelto en vez del `defaultSelected` del propio calendario.

### 6.5. Álbumes de fotos

**Estado actual**: Los álbumes en Firebase (`/albums`) no tienen tags — se muestran todos a todos.

**Propuesta**: Añadir un campo opcional `tags` a cada álbum en Firebase:

```
/albums/data/[n]
├── id: "encuentro-2026"
├── title: "Encuentro Nacional 2026"
├── imageUrl: "..."
├── albumUrl: "..."
├── tags: ["general", "encuentros"]    ← NUEVO (opcional)
```

**Reglas de visibilidad**:

| albumTags del perfil        | tags del álbum          | ¿Se muestra?         |
| --------------------------- | ----------------------- | -------------------- |
| `["all"]`                   | cualquiera (o sin tags) | ✅ Sí                |
| `["general", "encuentros"]` | `["general"]`           | ✅ Sí (intersección) |
| `["general"]`               | `["interno"]`           | ❌ No                |
| cualquiera                  | sin tags / no definido  | ✅ Sí (= "general")  |

**Beneficio**: Álbumes sin tags siguen siendo visibles para todos (retrocompatible). Solo necesitas etiquetar los álbumes que quieras restringir.

### 6.6. Notificaciones push (ver sección 7)

---

## 7. Push Notifications

### 7.1. ¿FCM Topics o metadata en RTDB?

**Decisión: seguir con metadata en RTDB** (lo que ya tenéis, ampliado).

**Razones**:

- Ya usáis Expo Push (no FCM directo). FCM Topics requeriría cambiar la infraestructura de envío
- La escala es pequeña (~15 delegaciones × 3 perfiles). No necesitáis la escalabilidad de FCM Topics
- El panel admin (`mcmpanel`) ya va a consultar RTDB para enviar notificaciones
- Añadir topics sería una capa más de complejidad sin beneficio claro a esta escala
- Si en el futuro la app crece mucho, se puede migrar a FCM Topics sin cambiar la app (solo el backend)

### 7.2. Ampliar registro de push token

Cuando el usuario elige/cambia perfil o delegación, se actualiza el token en Firebase:

```
/pushTokens/{deviceId}
├── token: "ExponentPushToken[...]"
├── platform: "ios"
├── registeredAt: "2026-01-15T10:30:00.000Z"
├── lastActive: "2026-03-10T08:00:00.000Z"
├── appVersion: "1.0.1"
├── deviceInfo: { model, osVersion }
├── profileType: "monitor"              ← NUEVO
├── delegationId: "castellon"           ← NUEVO
└── topics: ["general", "eventos",      ← NUEVO (pre-computado para queries fáciles)
             "monitores", "castellon"]
```

**El array `topics`** es la unión de los `notificationTopics` del perfil + el `notificationTopic` de la delegación. Se pre-computa al guardar para que el backend pueda hacer queries simples:

```
// Enviar a todos los de Castellón:
query pushTokens where delegationId === "castellon"

// Enviar a todos los monitores:
query pushTokens where profileType === "monitor"

// Enviar a monitores de Castellón:
query pushTokens where profileType === "monitor" AND delegationId === "castellon"

// Enviar a topic "general" (todos):
query pushTokens where topics contains "general"
```

### 7.3. Cuándo se actualiza el token

- Al completar el onboarding (primera vez)
- Al cambiar perfil o delegación en Settings
- En el heartbeat periódico (ya existente en `usePushNotifications.ts`)

---

## 8. Flujo de usuario

### 8.1. Primera apertura (onboarding)

```
App se abre
    ↓
¿onboardingCompleted === true?
    ├── SÍ → Cargar perfil de AsyncStorage, mostrar app normal
    └── NO → Mostrar pantalla de onboarding
                ↓
         [Paso 1] "¿Quién eres?"
         → Familia / Monitor/a / Miembro MCM
                ↓
         [Paso 2] "¿De qué delegación?"
         → Lista de delegaciones (desde profileConfig.delegationList)
                ↓
         Guardar en AsyncStorage:
           - profileType
           - delegationId
           - onboardingCompleted: true
                ↓
         Actualizar push token en Firebase con profileType + delegationId
                ↓
         App se renderiza con config personalizada
```

### 8.2. Cambio de perfil/delegación (Settings)

```
Ajustes → "Cambiar perfil" / "Cambiar delegación"
    ↓
Selector (mismo UI que onboarding)
    ↓
Actualizar AsyncStorage
    ↓
Actualizar push token en Firebase
    ↓
React Context se actualiza → toda la app se re-renderiza con la nueva config
    ↓
(Opcional) Resetear selección de calendarios a los defaults del nuevo perfil
```

### 8.3. Skip del onboarding

Si el usuario cierra/salta el onboarding:

- `profileType = 'miembro'` (asumimos perfil más "completo" por defecto).
- `delegationId = '_default'`.
- `onboardingCompleted = false` (para poder mostrar un banner de invitación).

La Home muestra un banner sutil ("Personaliza tu experiencia — Ajustes") hasta que el usuario complete el onboarding desde Ajustes. No hay pantalla bloqueante.

---

## 9. Impacto en código existente

### 9.1. Archivos a crear

| Archivo                                | Descripción                                                                                                   | Estado         |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------- | -------------- |
| `types/profileConfig.ts`               | Tipos TS del sistema (`ProfileType`, `ProfileBase`, `ProfileConfigData`, `ResolvedProfileConfig`, etc.)        | ✅ Fase 0 hecho |
| `constants/profileCatalog.ts`          | Catálogo de IDs conocidos (`KNOWN_TABS`, `KNOWN_HOME_BUTTONS`, `KNOWN_MAS_ITEMS`, `KNOWN_ALBUM_TAGS`, …)       | ✅ Fase 0 hecho |
| `utils/resolveProfileConfig.ts`        | Resolver puro + `isAppVersionSupported` semver                                                                 | ✅ Fase 0 hecho |
| `firebase-seed/profileConfig.json`     | Seed inicial listo para importar a Firebase. Misma estructura que el fallback                                   | ✅ Fase 0 hecho |
| `firebase-seed/README.md`              | Instrucciones para subirlo a Firebase                                                                          | ✅ Fase 0 hecho |
| `constants/defaultProfileConfig.ts`    | Fallback hardcoded (importa el JSON seed). Exporta también `DEFAULT_RESOLVED_PROFILE_CONFIG`                   | ✅ Fase 0 hecho |
| `contexts/ProfileConfigContext.tsx`    | Contexto que descarga `/profileConfig` con `useFirebaseData` + refetch al foreground                            | Fase 2         |
| `hooks/useResolvedProfileConfig.ts`    | Hook puro que combina `ProfileConfigContext` + `UserProfileContext` (rompe el ciclo de providers)              | Fase 2         |
| `app/onboarding.tsx`                   | Pantalla de onboarding (Stack, no tab). Selector de perfil + delegación                                        | Fase 3         |

### 9.2. Archivos a modificar

| Archivo                                 | Cambio                                                                                                                                                |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `contexts/UserProfileContext.tsx`       | Eliminar `location`, añadir `profileType: string \| null`, `delegationId: string \| null`, `onboardingCompleted: boolean`. Nombre pasa a ser opcional |
| `contexts/FeatureFlagsContext.tsx`      | **Eliminar** — absorbido por ProfileConfigContext                                                                                                     |
| `constants/featureFlags.ts`             | **Eliminar o mantener solo como referencia** — reemplazado por `defaultProfileConfig.ts`                                                              |
| `app/_layout.tsx`                       | Reemplazar `FeatureFlagsProvider` por `ProfileConfigProvider`. Añadir lógica de onboarding (redirigir si no completado)                               |
| `app/(tabs)/_layout.tsx`                | Cambiar `useFeatureFlags()` por `useProfileConfig()` para filtrar tabs visibles                                                                       |
| `app/(tabs)/index.tsx`                  | Filtrar `navigationItems` según `homeButtons` del perfil resuelto                                                                                     |
| `app/screens/MasHomeScreen.tsx`         | Filtrar items según `masItems` del perfil resuelto                                                                                                    |
| `hooks/useCalendarConfigs.ts`           | Integrar `defaultCalendars` del perfil al inicializar selección                                                                                       |
| `app/(tabs)/fotos.tsx`                  | Filtrar álbumes según `albumTags` del perfil vs `tags` del álbum                                                                                      |
| `services/pushNotificationService.ts`   | Ampliar `saveTokenToFirebase` con `profileType`, `delegationId`, `topics`                                                                             |
| `notifications/usePushNotifications.ts` | Llamar a `saveTokenToFirebase` cuando cambie el perfil/delegación                                                                                     |
| `components/SettingsPanel.tsx`          | Añadir opciones de cambiar perfil y delegación                                                                                                        |

### 9.3. Orden de providers en \_layout.tsx

```
ErrorBoundary
└── ProfileConfigProvider         ← NUEVO: descarga /profileConfig (raw)
    └── AppSettingsProvider
        └── UserProfileProvider   ← contiene profileType + delegationId
            └── NotificationsProvider
                └── InnerLayout   ← usa useResolvedProfileConfig() para combinar
```

**Romper el ciclo de providers** — El resolver es una **función pura**; no hace falta que un provider consuma a otro:

- `ProfileConfigProvider` expone `{ rawConfig, loading, offline }`.
- `UserProfileProvider` expone `{ profileType, delegationId, onboardingCompleted }`.
- El hook `useResolvedProfileConfig()` lee ambos contextos y devuelve un `ResolvedProfileConfig` memoizado. No es un provider.

Mientras `rawConfig` está cargando, el hook devuelve `DEFAULT_RESOLVED_PROFILE_CONFIG` (fallback) — ningún componente ve `null`.

---

## 10. Login futuro opcional

El sistema de perfiles local es **compatible con un login futuro**:

```
SIN LOGIN (actual)                    CON LOGIN (futuro)
────────────────────                  ────────────────────
Perfil → AsyncStorage                 Perfil → Firebase Auth user doc
Config → Firebase RTDB (pública)      Config → misma Firebase RTDB
Push token → Firebase RTDB            Push token → misma Firebase RTDB
                                      + sincronización entre dispositivos
                                      + datos privados del usuario
```

**El login sería una capa adicional, no un reemplazo**:

- Usuario sin login: perfil local, push con metadata. Funciona perfectamente.
- Usuario con login: su perfil se sincroniza a la nube. Si cambia de dispositivo, recupera su configuración.
- La app siempre lee del contexto local (que puede estar alimentado por AsyncStorage O por Firebase Auth).

**No hay que preparar nada especial ahora**. El `UserProfileContext` seguirá siendo el punto de lectura. Lo único que cambiaría con login es de dónde se hidratan los datos (AsyncStorage → Firebase user doc).

---

## 11. Ejemplos prácticos

### Ejemplo 1: "Quiero que los monitores de Madrid vean una sección extra en Más"

1. En Firebase, en `/profileConfig/data/overrides`, crear:
   ```json
   "monitor:madrid": {
     "masItems": ["jubileo", "materiales", "grupos", "contactos", "formacion-madrid"]
   }
   ```
2. La app se actualiza automáticamente (Firebase real-time o siguiente fetch).
3. No requiere deploy.

### Ejemplo 2: "Quiero añadir una nueva delegación: Sevilla"

1. En Firebase, en `/profileConfig/data/delegationList`, añadir:
   ```json
   { "id": "sevilla", "label": "Sevilla" }
   ```
2. Si Sevilla es "normal" (sin nada especial): ya está. Usa `_default`.
3. Si Sevilla tiene calendario propio, añadir en `delegations`:
   ```json
   "sevilla": {
     "label": "Sevilla",
     "notificationTopic": "sevilla",
     "extraCalendars": ["sevilla-local"]
   }
   ```
4. Asegurarse de que el calendario `sevilla-local` existe en el nodo `/calendars`.

### Ejemplo 3: "Quiero ocultar un álbum de fotos a las familias"

1. En el álbum en Firebase (`/albums/data/[n]`), añadir:
   ```json
   "tags": ["interno"]
   ```
2. El perfil "familia" tiene `albumTags: ["general", "encuentros"]` → no incluye "interno" → no ve ese álbum.
3. Los perfiles "monitor" y "miembro" tienen `albumTags: ["all"]` → ven todo.

### Ejemplo 4: "Quiero que TODOS vean una nueva tab (activarla globalmente)"

1. En Firebase, editar cada perfil en `/profileConfig/data/profiles` y añadir el tab a su array `tabs`.
2. O más rápido: si es temporal, usar un override global (evaluar si añadir esta capacidad).

### Ejemplo 5: "Quiero desactivar temporalmente las notificaciones para todos"

1. En `/profileConfig/data/global`, poner:
   ```json
   "showNotificationsIcon": false
   ```
2. Toda la app oculta el icono de notificaciones.

---

## 12. Catálogo de IDs "ground truth"

Para robustez, la app mantiene una lista de IDs válidos en `constants/profileCatalog.ts`. El resolver descarta IDs desconocidos con warning en dev — así un error en el panel admin no rompe la UI:

- `KNOWN_TABS`: `index`, `cancionero`, `contigo`, `calendario`, `fotos`, `comunica`, `mas`.
- `KNOWN_HOME_BUTTONS`: `comunica`, `cancionero`, `fotos`, `evangelio`, `mas`.
- `KNOWN_MAS_ITEMS`: `comunica`, `comunica-gestion`, `jubileo`.
- `KNOWN_ALBUM_TAGS`: `all`, `general`, `encuentros`, `interno`, `monitores`, `miembros`.
- `KNOWN_NOTIFICATION_TOPICS`: `general`, `eventos`, `familias`, `monitores`, `miembros`.

Al añadir un tab/botón/sección nueva a la app, **actualiza también este catálogo**.

---

## Plan de implementación — 8 fases

Cada fase es un commit/PR independiente y **no rompe la app** si se queda ahí: se mantiene compatibilidad hasta la fase 8.

### ✅ Fase 0 — Preparación (hecho)

- [x] Tipos (`types/profileConfig.ts`)
- [x] Catálogo de IDs (`constants/profileCatalog.ts`)
- [x] Resolver puro + semver (`utils/resolveProfileConfig.ts`)
- [x] Seed JSON para Firebase (`firebase-seed/profileConfig.json`)
- [x] Instrucciones de subida (`firebase-seed/README.md`)
- [x] Fallback hardcoded (`constants/defaultProfileConfig.ts`)

**Pendientes de usuario**:

- [ ] Subir `firebase-seed/profileConfig.json` al nodo `/profileConfig` en Firebase.
- [ ] Rellenar la lista real de delegaciones en `delegationList`.
- [ ] Rellenar los IDs reales de `defaultCalendars` por perfil (del nodo `/jubileo/calendarios`).

### ✅ Fase 1 — `UserProfileContext` ampliado (hecho)

`profileType`, `delegationId`, `onboardingCompleted` añadidos. Campo `location` eliminado.

### ✅ Fase 2 — Contexto y hook (hecho)

- `contexts/ProfileConfigContext.tsx` descarga `/profileConfig` con `useFirebaseData`.
- `hooks/useResolvedProfileConfig.ts` combina config + UserProfile en un `ResolvedProfileConfig` memoizado.

### ✅ Fase 3 — Onboarding (hecho)

- `app/onboarding.tsx` con 2 pasos (perfil + delegación). "Saltar" asume `miembro` + `_default`.
- Redirect desde `app/_layout.tsx` cuando `profileType === null` y `showOnboarding === true`.
- Banner sutil en Home si se saltó el onboarding.

### ✅ Fase 4 — Tabs / Home / Más adaptados (hecho)

`useResolvedProfileConfig()` se usa en `app/(tabs)/_layout.tsx`, `app/(tabs)/index.tsx` y `app/screens/MasHomeScreen.tsx` para filtrar tabs, botones del home e items del menú.

### ✅ Fase 5 — Calendarios y fotos (hecho)

- `hooks/useCalendarConfigs.ts`: semilla inicial desde `resolved.defaultCalendars` (fallback a `defaultSelected`).
- `app/(tabs)/fotos.tsx`: intersección `album.tags ∩ resolved.albumTags`. Álbum sin tags = visible (retrocompatible).

### ✅ Fase 6 — Push tokens (hecho)

- `services/pushNotificationService.ts`: `saveTokenToFirebase` y `updateLastActive` aceptan `TokenProfileMetadata`.
- `notifications/usePushNotifications.ts`: re-publica la metadata al cambiar perfil/delegación.

### ✅ Fase 7 — Settings UI + bloqueos remotos (hecho)

- `components/SettingsPanel.tsx`: sección "Tu perfil en MCM" con chips y selectores para perfil + delegación.
- `components/MaintenanceScreen.tsx`: pantalla de bloqueo para `maintenanceMode` y `minAppVersion`.

### ✅ Fase 8 — Limpieza (hecho)

Eliminados: `contexts/FeatureFlagsContext.tsx`, `constants/featureFlags.ts`, `__tests__/featureFlags.test.ts`, `FEATURE_FLAGS_OTA.md`, `components/UserProfileModal.tsx`. `CLAUDE.md` y este documento actualizados.

### Testing pendiente

- [ ] iOS nativo (NativeTabs)
- [ ] Android
- [ ] Web
- [ ] Offline en primera instalación (sin red → fallback seed)
- [ ] Cambio en caliente desde Firebase → aplicar al siguiente arranque
- [ ] Cambio de perfil/delegación en Ajustes → token actualizado con topics nuevos
