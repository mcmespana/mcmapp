# Sistema de Perfiles de Usuario — Diseño técnico

> Documento de diseño para personalizar la experiencia de la app MCM según perfil de usuario y delegación local.
> **Estado**: diseño · **Fecha**: marzo 2026

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

| Eje | Opciones | Ejemplo |
|-----|----------|---------|
| **Perfil** | Familia · Monitor/a · Miembro MCM | Un monitor ve secciones de grupos y materiales extra |
| **Delegación** | ~15 delegaciones locales | Alguien de Castellón recibe notificaciones locales y ve calendarios específicos |

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

### 2.2. Feature flags fusionados (un solo sistema)

**Decisión**: El actual `constants/featureFlags.ts` + `FeatureFlagsContext.tsx` se absorben dentro del nuevo sistema de perfiles. No hay dos sistemas controlando visibilidad.

**Cómo**: La config remota incluye un bloque `global` que reemplaza los feature flags actuales. El `ProfileConfigContext` nuevo reemplaza al `FeatureFlagsContext`.

**Resultado**: UN solo contexto, UN solo sitio donde mirar.

### 2.3. Delegación por defecto + overrides

**Decisión**: La mayoría de delegaciones son idénticas. Se define una config `_default` y solo las delegaciones especiales (2-3) definen overrides.

**Ventaja**: Añadir una delegación nueva = añadir solo su nombre a la lista. No hay que copiar config.

---

## 3. Almacenamiento: qué va dónde

| Dato | Dónde | Clave | Notas |
|------|-------|-------|-------|
| Tipo de perfil | AsyncStorage | `@user_profile` | Parte del UserProfile ampliado |
| ID de delegación | AsyncStorage | `@user_profile` | Reemplaza el campo `location` actual |
| Nombre del usuario | AsyncStorage | `@user_profile` | Opcional, se mantiene |
| Onboarding completado | AsyncStorage | `@user_profile` | Flag booleano |
| Config de perfiles | Firebase RTDB + caché AsyncStorage | `/profileConfig` | Se descarga con `useFirebaseData` |
| Push token + metadata | Firebase RTDB | `/pushTokens/{deviceId}` | Se amplía con profileType y delegationId |
| Qué tabs/secciones mostrar | **No se almacena** | — | Se computa en tiempo real a partir de la config |

**Principio clave**: En una reinstalación, el usuario reconfigura desde cero. No pasa nada. Lo único persistente en la nube es la metadata del push token (para segmentar notificaciones).

---

## 4. Estructura en Firebase: nodo /profileConfig

```
/profileConfig
├── updatedAt: "2026-03-10T12:00:00.000Z"
└── data
    ├── global                          ← Reemplaza featureFlags.ts
    │   ├── defaultTab: "index"
    │   ├── showNotificationsIcon: true
    │   └── maintenanceMode: false
    │
    ├── profiles
    │   ├── familia
    │   │   ├── label: "Familia"
    │   │   ├── description: "Padres y familiares"
    │   │   ├── tabs: ["index", "cancionero", "calendario", "fotos", "mas"]
    │   │   ├── homeButtons: ["cantoral", "calendario", "fotos", "wordle", "ayuda"]
    │   │   ├── masItems: ["jubileo", "materiales"]
    │   │   ├── defaultCalendars: ["mcm-europa"]
    │   │   ├── albumTags: ["general", "encuentros"]
    │   │   └── notificationTopics: ["general", "eventos"]
    │   │
    │   ├── monitor
    │   │   ├── label: "Monitor/a"
    │   │   ├── description: "Monitores y catequistas"
    │   │   ├── tabs: ["index", "cancionero", "calendario", "fotos", "mas"]
    │   │   ├── homeButtons: ["cantoral", "calendario", "fotos", "grupos", "wordle", "ayuda"]
    │   │   ├── masItems: ["jubileo", "materiales", "grupos", "contactos"]
    │   │   ├── defaultCalendars: ["mcm-europa", "monitores"]
    │   │   ├── albumTags: ["all"]
    │   │   └── notificationTopics: ["general", "eventos", "monitores"]
    │   │
    │   └── miembro
    │       ├── label: "Miembro MCM"
    │       ├── description: "Miembros del movimiento"
    │       ├── tabs: ["index", "cancionero", "calendario", "fotos", "comunica", "mas"]
    │       ├── homeButtons: ["cantoral", "calendario", "fotos", "comunica", "compartiendo", "wordle"]
    │       ├── masItems: ["jubileo", "materiales", "grupos", "contactos", "profundiza"]
    │       ├── defaultCalendars: ["mcm-europa", "miembros"]
    │       ├── albumTags: ["all"]
    │       └── notificationTopics: ["general", "eventos", "miembros"]
    │
    ├── delegations
    │   ├── _default                    ← Se usa para toda delegación sin override
    │   │   └── label: "General"
    │   │
    │   ├── castellon
    │   │   ├── label: "Castellón"
    │   │   ├── notificationTopic: "castellon"
    │   │   └── extraCalendars: ["castellon-local"]
    │   │
    │   └── madrid
    │       ├── label: "Madrid"
    │       ├── notificationTopic: "madrid"
    │       └── extraCalendars: ["madrid-local"]
    │
    ├── delegationList                  ← Lista ordenada para el selector del onboarding
    │   ├── 0: { id: "castellon", label: "Castellón" }
    │   ├── 1: { id: "madrid", label: "Madrid" }
    │   ├── 2: { id: "barcelona", label: "Barcelona" }
    │   ├── 3: { id: "valencia", label: "Valencia" }
    │   └── ... (hasta ~15)
    │
    └── overrides                       ← Combinaciones perfil:delegación específicas
        └── "familia:castellon"
            └── tabs: ["index", "cancionero", "calendario", "fotos", "comunica", "mas"]
            (↑ las familias de Castellón también ven la tab Comunica)
```

### Notas sobre la estructura

- **`profiles`**: Config base para cada perfil. Contiene arrays de IDs que referencian tabs, botones, calendarios, etc. ya existentes en la app.
- **`delegations._default`**: Se aplica automáticamente a cualquier delegación no listada explícitamente. Solo necesitas definir las especiales.
- **`delegations.{id}.extraCalendars`**: Se **añaden** a los `defaultCalendars` del perfil (no los reemplazan).
- **`delegationList`**: Lista separada para el UI del onboarding/settings. Así puedes reordenarla, añadir o quitar delegaciones sin tocar la lógica.
- **`overrides`**: Clave con formato `"perfil:delegacion"`. Los campos definidos aquí **sobreescriben** la config base del perfil para esa combinación específica. Solo defines los campos que cambian.
- **`global`**: Flags que aplican a todos los perfiles por igual (el equivalente al actual `featureFlags.ts`).

---

## 5. Sistema de resolución de config

El hook `useProfileConfig()` resuelve la config final en este orden:

```
1. Cargar config global
         ↓
2. Cargar config base del perfil (ej: "monitor")
         ↓
3. Aplicar extras de la delegación (ej: "castellon")
   - extraCalendars → se AÑADEN a defaultCalendars
   - notificationTopic → se AÑADE a notificationTopics
         ↓
4. Aplicar override si existe para "monitor:castellon"
   - Los campos del override REEMPLAZAN los del perfil base
         ↓
5. Resultado: objeto plano listo para consumir
```

### Pseudocódigo

```typescript
function resolveProfileConfig(
  config: ProfileConfigData,   // todo el nodo /profileConfig/data
  profileType: ProfileType,
  delegationId: string,
): ResolvedConfig {
  const global = config.global;
  const profile = config.profiles[profileType];
  const delegation = config.delegations[delegationId] || config.delegations._default;
  const override = config.overrides?.[`${profileType}:${delegationId}`];

  // Base del perfil
  let resolved: ResolvedConfig = {
    tabs: profile.tabs,
    homeButtons: profile.homeButtons,
    masItems: profile.masItems,
    defaultCalendars: [
      ...profile.defaultCalendars,
      ...(delegation.extraCalendars || []),    // Delegación AÑADE calendarios
    ],
    albumTags: profile.albumTags,
    notificationTopics: [
      ...profile.notificationTopics,
      ...(delegation.notificationTopic ? [delegation.notificationTopic] : []),
    ],
    ...global,
  };

  // Override sobreescribe campos específicos
  if (override) {
    resolved = { ...resolved, ...override };
  }

  return resolved;
}
```

### Fallback hardcoded

Si Firebase no está disponible en la primera carga (sin caché), la app usa un fallback hardcoded equivalente a la config del perfil "familia" sin delegación. Esto reemplaza al actual `constants/featureFlags.ts`.

```typescript
// constants/defaultProfileConfig.ts
export const DEFAULT_PROFILE_CONFIG: ResolvedConfig = {
  tabs: ['index', 'cancionero', 'calendario', 'fotos', 'mas'],
  homeButtons: ['cantoral', 'calendario', 'fotos', 'wordle', 'ayuda'],
  masItems: ['jubileo', 'materiales'],
  defaultCalendars: ['mcm-europa'],
  albumTags: ['all'],
  notificationTopics: ['general', 'eventos'],
  defaultTab: 'index',
  showNotificationsIcon: true,
};
```

---

## 6. Personalización por área

### 6.1. Tabs (barra inferior)

La config del perfil define un array `tabs` con los IDs de tabs visibles.

| Perfil | Tabs |
|--------|------|
| Familia | index, cancionero, calendario, fotos, mas |
| Monitor | index, cancionero, calendario, fotos, mas |
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

| albumTags del perfil | tags del álbum | ¿Se muestra? |
|----------------------|----------------|------------|
| `["all"]` | cualquiera (o sin tags) | ✅ Sí |
| `["general", "encuentros"]` | `["general"]` | ✅ Sí (intersección) |
| `["general"]` | `["interno"]` | ❌ No |
| cualquiera | sin tags / no definido | ✅ Sí (= "general") |

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

Si el usuario cierra/salta el onboarding, se usa la config fallback (equivalente a "Familia" sin delegación). Puede configurar desde Settings en cualquier momento.

---

## 9. Impacto en código existente

### 9.1. Archivos a crear

| Archivo | Descripción |
|---------|-------------|
| `constants/defaultProfileConfig.ts` | Config fallback hardcoded (reemplaza conceptualmente a `featureFlags.ts`) |
| `contexts/ProfileConfigContext.tsx` | Nuevo contexto que descarga y resuelve la config (reemplaza a `FeatureFlagsContext`) |
| `hooks/useProfileConfig.ts` | Hook que expone la config resuelta + helpers |
| `app/onboarding.tsx` | Pantalla de onboarding (Stack screen, no tab) |

### 9.2. Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `contexts/UserProfileContext.tsx` | Eliminar `location`, añadir `profileType: string \| null`, `delegationId: string \| null`, `onboardingCompleted: boolean`. Nombre pasa a ser opcional |
| `contexts/FeatureFlagsContext.tsx` | **Eliminar** — absorbido por ProfileConfigContext |
| `constants/featureFlags.ts` | **Eliminar o mantener solo como referencia** — reemplazado por `defaultProfileConfig.ts` |
| `app/_layout.tsx` | Reemplazar `FeatureFlagsProvider` por `ProfileConfigProvider`. Añadir lógica de onboarding (redirigir si no completado) |
| `app/(tabs)/_layout.tsx` | Cambiar `useFeatureFlags()` por `useProfileConfig()` para filtrar tabs visibles |
| `app/(tabs)/index.tsx` | Filtrar `navigationItems` según `homeButtons` del perfil resuelto |
| `app/screens/MasHomeScreen.tsx` | Filtrar items según `masItems` del perfil resuelto |
| `hooks/useCalendarConfigs.ts` | Integrar `defaultCalendars` del perfil al inicializar selección |
| `app/(tabs)/fotos.tsx` | Filtrar álbumes según `albumTags` del perfil vs `tags` del álbum |
| `services/pushNotificationService.ts` | Ampliar `saveTokenToFirebase` con `profileType`, `delegationId`, `topics` |
| `notifications/usePushNotifications.ts` | Llamar a `saveTokenToFirebase` cuando cambie el perfil/delegación |
| `components/SettingsPanel.tsx` | Añadir opciones de cambiar perfil y delegación |

### 9.3. Orden de providers en _layout.tsx

```
ErrorBoundary
└── ProfileConfigProvider         ← NUEVO (reemplaza FeatureFlagsProvider)
    └── AppSettingsProvider
        └── UserProfileProvider
            └── NotificationsProvider
                └── InnerLayout
```

> **Nota**: `ProfileConfigProvider` necesita envolver a `UserProfileProvider` porque la resolución de config depende del `profileType` y `delegationId`. Alternativamente, `ProfileConfigProvider` puede estar dentro de `UserProfileProvider` y consumir el contexto de usuario. Evaluar cuál es más limpio.

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

## Checklist de implementación (orden sugerido)

- [ ] Definir tipos TypeScript para toda la estructura de config
- [ ] Crear `constants/defaultProfileConfig.ts` con el fallback
- [ ] Ampliar `UserProfileContext` con `profileType`, `delegationId`, `onboardingCompleted`
- [ ] Crear `ProfileConfigContext` que descargue `/profileConfig` y resuelva config
- [ ] Crear hook `useProfileConfig()` para consumo fácil
- [ ] Crear pantalla de onboarding (selección de perfil + delegación)
- [ ] Integrar en `_layout.tsx` (provider + redirección a onboarding)
- [ ] Subir estructura inicial de `/profileConfig` a Firebase
- [ ] Adaptar `_layout.tsx` de tabs para filtrar según perfil
- [ ] Adaptar Home para filtrar botones según perfil
- [ ] Adaptar MasHome para filtrar items según perfil
- [ ] Integrar calendarios del perfil en `useCalendarConfigs`
- [ ] Añadir campo `tags` a álbumes en Firebase + filtrar en fotos
- [ ] Ampliar push token con `profileType` + `delegationId` + `topics`
- [ ] Añadir cambio de perfil/delegación en Settings
- [ ] Eliminar `FeatureFlagsContext` y `featureFlags.ts` (o marcar como deprecated)
- [ ] Testing completo en iOS + Android + Web
