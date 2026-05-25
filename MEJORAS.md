# MEJORAS.md — Análisis técnico transversal de la MCM App

> Documento guía para el desarrollo de la app. Cubre rendimiento, arquitectura, calidad de código, tests, UX/UI, accesibilidad, seguridad, observabilidad, offline, i18n, DX/CI, build/OTA, backend y documentación.
>
> **Fecha del análisis:** 2026-05-21 · **Stack:** Expo 55 · React Native 0.83 · React 19.2 · TypeScript · Firebase RTDB · ChordSheetJS · heroui-native.
>
> **Cómo leerlo:** cada hallazgo lleva archivo:línea para que se pueda localizar. Las recomendaciones están ordenadas por impacto/esfuerzo dentro de cada sección. La sección final **"Lo que NO se ha cubierto en este análisis"** explica los temas que requerirían un análisis aparte para no quedar superficiales.

---

## ✅ Ya implementado

| ID  | Mejora                                        | Commit / fecha      |
| --- | --------------------------------------------- | ------------------- |
| 1.7 | `freezeOnBlur: true` en stacks de `cancionero.tsx` y `mas.tsx` | Previo al análisis |
| 1.8 | HelloWave: 2 reps (600 ms) + skip tras primer arranque (`seenWelcomeOnce`) | 2026-05-25 |
| 1.9 | `React.memo` en `SongSearch`, `AlbumCard`, `EventItem` | 2026-05-25 |
| 1.11a | `SettingsContext`: eliminado `useEffect` redundante de guardado al desmontar | 2026-05-25 |

---

## Resumen ejecutivo por áreas

| Área                                | Estado actual                           | Acciones más relevantes                                   |
| ----------------------------------- | --------------------------------------- | --------------------------------------------------------- |
| **1. Rendimiento / fluidez**        | Funciona; varios puntos optimizables    | Firebase `updatedAt` primero, memo ChordPro, freezeOnBlur |
| **2. Arquitectura y mantenibilidad** | Archivos muy grandes (`SelectedSongsScreen` 1750 líneas) | Extraer componentes/hooks, agrupar providers              |
| **3. Calidad de código / TS**       | TS strict OK; lint con warnings y 99 `console.*` | `prettier/prettier` a `error`, logger central             |
| **4. Tests**                        | Hay 7 ficheros (no "ninguno" como dice TODO/CLAUDE) | Subir cobertura en `hooks/`, añadir tests de pantallas    |
| **5. UX / UI / Design System**      | Sistema rico (DESIGN.md) pero tokens no migrados | Migrar `radii`/`shadows`/tipografía a tokens en componentes |
| **6. Accesibilidad**                | Cobertura mayor de lo documentado en TODO | Auditar pantallas pendientes y semántica de listas       |
| **7. Seguridad y privacidad**       | Sin reglas de Firebase versionadas en repo | Añadir `database.rules.json` al repo + CI de validación   |
| **8. Observabilidad / errores**     | Sin crash reporting; 99 `console.*`     | Integrar Sentry o Crashlytics, logger central, niveles    |
| **9. Offline / red**                | Patrón sólido (`useFirebaseData`)       | Reintentos, indicador global más claro, sincronización background |
| **10. Internacionalización**        | Castellano hardcoded                    | Decidir si se quiere multilenguaje (catalán, portugués…)  |
| **11. DX / CI / lint**              | Husky solo `prettier`, no hay CI de PRs | Workflow lint+typecheck+test en PRs, lint-staged con eslint |
| **12. Build y OTA**                 | EAS bien configurado, OTA preview      | Documentar promoción preview→production                  |
| **13. Backend Firebase**            | Solo `purgeExpiredShares`; push pending | Completar backend de notificaciones (NOTIFICACIONES.md)   |
| **14. Documentación**               | Muy buena (CLAUDE.md, AGENTS.md, etc.) pero con datos obsoletos | Sincronizar AGENTS.md y CLAUDE.md con realidad actual    |

---

## 1. Rendimiento y fluidez

> Esta es la sección más detallada. Es la que motivó el documento originalmente.

### 1.1 Firebase: descarga el nodo entero aunque no haya cambiado nada

**Archivo:** `mcm-app/hooks/useFirebaseData.ts:44-69`

`get(ref(db, path))` baja `{ data, updatedAt, hidden }` completo y luego compara `updatedAt` con el cacheado. Si `songs` pesa varios MB, lo descarga cada arranque aunque no haya cambios.

**Propuesta** (bajo riesgo, alto impacto):

```ts
// 1. Bajar SOLO updatedAt (~ pocos bytes)
const metaSnap = await get(ref(db, `${path}/updatedAt`));
const remoteUpdatedAt = String(metaSnap.val() ?? '0');

// 2. Bajar el resto solo si cambió
if (!localUpdatedAt || localUpdatedAt !== remoteUpdatedAt) {
  const dataSnap = await get(ref(db, `${path}/data`));
  // …guardar en AsyncStorage…
}
const hiddenSnap = await get(ref(db, `${path}/hidden`));
```

Hacer las tres llamadas en `Promise.all`. La ganancia en `songs` y `albums` (los nodos grandes) es sustancial.

### 1.2 WebView del cantoral: se reconstruye en cada interacción

**Archivos:** `mcm-app/components/SongDisplay.tsx:78`, `mcm-app/hooks/useSongProcessor.ts:439-454`

`useSongProcessor` regenera el HTML completo cada vez que cambia `currentTranspose`, `chordsVisible`, `currentFontSizeEm`, `currentFontFamily`, `notation`, `isDark`, `isFullscreen`, `topInset`, `bottomInset`. Después `SongDisplay` lo pasa por `source={{ html: songHtml }}` y el WebView se **recrea entero** → parpadeo de 200–500 ms.

**Propuestas:**

a) **Cambios de estilo vía `injectedJavaScript` / `postMessage`**: WebView estable, aplicar `.font-XX`, `.theme-dark`, `.chords-hidden`, `.notation-es/en` con clases en `<body>`. Solo cambiar tono justifica regenerar HTML.

b) **Mientras tanto, separar dependencias del efecto**: cosas que cambian estructura (transpose, chordsVisible) vs cosas que son puro CSS (`fontSize`, `fontFamily`, `isDark`, insets). Dividirlo ya reduce reparseos.

### 1.3 ChordPro se parsea en cada apertura sin caché

**Archivo:** `mcm-app/hooks/useSongProcessor.ts:90-95, 107-122`

- `new ChordProParser().parse(processedChordPro)` se ejecuta en cada render del efecto.
- Además, para calcular `displayKey` se hace un **segundo parseo** (`new ChordProParser().parse('{key: ...}\n[...]')`).

**Propuesta:**

- Memoizar el `Song` parseado por `originalChordPro + currentTranspose`.
- Para `displayKey`, usar la utilidad existente `utils/transposeKey.ts` en vez de instanciar otro parser.
- A largo plazo: **preprocesar `.cho` en build time** (Metro Transformer).

### 1.4 Listas sin virtualización en Grupos y Contactos

**Archivos:**

- `mcm-app/app/screens/GruposScreen.tsx:131-465` — múltiples `ScrollView` con `.map()` anidados (categorías → grupos → miembros) en cuatro variantes.
- `mcm-app/app/screens/ContactosScreen.tsx:98-160` — `ScrollView` + `.map()`.
- `mcm-app/app/screens/ReflexionesScreen.tsx:194-245` — `ScrollView` + `.map()` (probablemente OK por volumen actual).

`CategoriesScreen`, `SongListScreen`, `SelectedSongsScreen` sí usan `FlatList`.

**Propuesta:** `ContactosScreen` → `FlatList`. `GruposScreen` → `SectionList` con `GrupoItem` y `MiembroRow` como `React.memo`.

### 1.5 `expo-image` instalado pero no usado para las portadas

**Archivos:** `mcm-app/components/AlbumCard.tsx:34`, `mcm-app/package.json:42`

`expo-image` está en `dependencies` pero **ninguna** parte del código lo importa. `AlbumCard` usa `ImageBackground` de RN sin caché en disco, sin `placeholder` ni `transition`.

**Propuesta:** reemplazar por `<Image>` de `expo-image` con `placeholder` (blurhash) y `transition={200}`.

### 1.6 `babel.config.js` vacío — falta `react-compiler`

**Archivo:** `mcm-app/babel.config.js:1-7`

React 19 + Babel 7.25 soportan `babel-plugin-react-compiler`. La app ya está en React 19.2.

**Propuesta:** instalar `babel-plugin-react-compiler` y añadirlo al `plugins`. Validar en `npm run lint` y benchmark de arranque. Revisar orden con reanimated si hay warnings.

### ~~1.7 Stacks anidados sin `freezeOnBlur`~~ ✅ HECHO

**Archivos:** `mcm-app/app/_layout.tsx:182-202`, stacks internos de `cancionero.tsx` y `mas.tsx`.

`freezeOnBlur: true` ya estaba aplicado en ambos stacks antes del análisis. Las pantallas no visibles se congelan al cambiar de tab, liberando CPU/memoria.

### ~~1.8 Splash post-launch de 900 ms (HelloWave)~~ ✅ HECHO

**Archivos:** `mcm-app/components/HelloWave.tsx:22`, `mcm-app/app/_layout.tsx:116-121`

Reducido a 2 repeticiones × 300 ms (600 ms). Además, el splash se salta por completo en arranques posteriores al primero mediante el flag `seenWelcomeOnce` en AsyncStorage.

### ~~1.9 Componentes sin `React.memo` que sí lo necesitan~~ ✅ HECHO

- `mcm-app/components/SongSearch.tsx` — envuelto en `React.memo`.
- `mcm-app/components/AlbumCard.tsx` — envuelto en `React.memo`.
- `mcm-app/components/EventItem.tsx` — envuelto en `React.memo` (ya usaba `useMemo` para estilos).

`SongListItem.tsx:45` ya usaba `React.memo` como referencia de buen patrón.

### 1.10 Dependencias muertas o pesadas

- `lodash` (`^4.17.21`) — **0 importaciones**. Eliminar.
- `react-native-render-html` (`^6.3.4`) — solo en `FormattedContent.tsx`. Si BBCode simple bastara, ahorraría peso.

### 1.11 Otros (parcialmente resuelto)

- ~~`mcm-app/contexts/SettingsContext.tsx:85-117` — dos `useEffect` guardan settings (uno redundante).~~ ✅ HECHO — eliminado el tercer `useEffect` de guardado al desmontar; el segundo ya persiste los settings en cada cambio.
- `mcm-app/app/_layout.tsx:51-83` — **pendiente**: 12 providers anidados. Considerar agrupar contextos relacionados (ej. `UserProfile` + `ProfileConfig`) para reducir re-renders en cascada. Cambio de mayor envergadura, no trivial.

### 1.12 Plan recomendado (rendimiento)

| Paso | Tarea                                                       | Impacto | Esfuerzo |
| ---- | ----------------------------------------------------------- | ------- | -------- |
| 1    | `useFirebaseData`: cargar `updatedAt` antes de `data`       | Alto    | Bajo     |
| 2    | Memoizar parser ChordPro + eliminar segundo parser de `key` | Alto    | Bajo     |
| 3    | `freezeOnBlur` en stacks anidados                           | Medio   | Trivial  |
| 4    | `expo-image` en `AlbumCard` con `placeholder`               | Medio   | Bajo     |
| 5    | `babel-plugin-react-compiler`                               | Medio   | Bajo     |
| 6    | `React.memo` en `SongSearch`, `AlbumCard`, `EventItem`      | Bajo    | Trivial  |
| 7    | Quitar `lodash`                                             | Bajo    | Trivial  |
| 8    | `HelloWave`: 600 ms o saltar tras primer launch             | Bajo    | Trivial  |
| 9    | `GruposScreen` → `SectionList`; `ContactosScreen` → `FlatList` | Medio | Medio    |
| 10   | WebView con `postMessage` para estilo                       | Alto    | Alto     |
| 11   | Preprocesado `.cho` en build (Metro Transformer)            | Alto    | Alto     |

---

## 2. Arquitectura y mantenibilidad

### 2.1 Archivos demasiado grandes

Tamaño en líneas (medido):

- `mcm-app/app/screens/SelectedSongsScreen.tsx` — **1.750 líneas**
- `mcm-app/components/NotificationsBottomSheet.tsx` — 908
- `mcm-app/app/screens/WordleScreen.tsx` — 776
- `mcm-app/components/SecretPanelModal.tsx` — 660
- `mcm-app/app/screens/SongListScreen.tsx` — 600
- `mcm-app/app/screens/GruposScreen.tsx` — 599
- `mcm-app/app/screens/CategoriesScreen.tsx` — 597
- `mcm-app/components/SettingsBottomSheet.tsx` — 594
- `mcm-app/app/screens/SongFullscreenScreen.tsx` — 553

**Propuesta:** romper en componentes/hooks. Para `SelectedSongsScreen` en particular conviene extraer subcomponentes (item, header, modal export, modal de coro), un hook `useChoirActions`, y la lógica de URLs/sharing como utils. Reduce coste cognitivo y facilita memoización selectiva.

### 2.2 Providers anidados

**Archivo:** `mcm-app/app/_layout.tsx:51-83`

12 providers anidados. No es un problema técnico grave pero combinar contextos afines (ej. `UserProfile` + `ProfileConfig` que casi siempre se consumen juntos) reduce re-renders en cascada y mejora la legibilidad.

### 2.3 `AGENTS.md` desactualizado

**Archivo:** `mcm-app/AGENTS.md`

Menciona `FeatureFlagsProvider` en la jerarquía de providers, pero ese sistema fue **reemplazado por el sistema de Perfiles** (ver `CLAUDE.md` actual). Hay que sincronizarlo para que los agentes IA no apliquen patrones obsoletos.

### 2.4 `CLAUDE.md` y `TODO.md` con datos obsoletos sobre tests

Ambos dicen que no hay tests escritos. **Hay 7** (`mcm-app/__tests__/*.test.ts`). Actualizar la frase.

---

## 3. Calidad de código y TypeScript

### 3.1 `prettier/prettier` está como `warn` (no `error`)

**Archivo:** `mcm-app/eslint.config.js:11`

`'prettier/prettier': 'warn'` deja pasar problemas de formato. Recomendado: `'error'` en CI (y opcionalmente `'warn'` en local).

### 3.2 99 `console.log/warn/error` repartidos por el código

Sin filtro por entorno. En producción son ruido y pueden filtrar datos. Propuesta: logger centralizado (`utils/logger.ts`) que respete niveles (`dev`/`prod`) y opcionalmente envíe a Sentry.

### 3.3 `tsconfig` excluye `__tests__`

**Archivo:** `mcm-app/tsconfig.json:21`

Los tests no se incluyen en la comprobación de tipos. Considerar un `tsconfig.test.json` que sí los incluya y un script `tsc --noEmit -p tsconfig.test.json`.

### 3.4 Imports y nombres

Patrón en general bien, alias `@/` consistente. Pequeños desvíos en `app/screens/*` que mezclan `../` y `@/`.

---

## 4. Tests

### 4.1 Estado actual real

7 ficheros en `mcm-app/__tests__/`: `chordNotation`, `filterSongsData`, `formatText`, `resolveProfileConfig`, `songUtils`, `useFirebaseData`, `useNetworkStatus`. Infraestructura correcta (`jest-expo`, `@testing-library/react-native`).

> **Corrección a CLAUDE.md y TODO.md:** ambos dicen "sin tests" — está obsoleto.

### 4.2 Áreas con menor cobertura

- Hooks de canciones (`useSongProcessor`, `useSongFile`).
- Hooks de coro / playlist (`useChoirSession`).
- Resolver de perfiles ya cubierto, bien.
- Reducers de contexto (UserProfile, AppSettings).

### 4.3 Falta CI que ejecute tests

Ver §11. Hoy un PR puede romper tests sin que nadie se entere.

---

## 5. UX / UI / Design System

### 5.1 Tokens definidos pero no migrados

(Hereda del TODO actual.) `radii`, `shadows`, tipografía → existen en `constants/` pero los componentes siguen usando valores inline. Migrar gradualmente componente a componente.

### 5.2 Inconsistencias menores

- Pesos de fuente: `'800'`/`'700'`/`'500'` mezclados sin guía clara.
- `borderRadius` de modales: 8 o 12 según el componente.

### 5.3 Pantalla Home estática

(Hereda del TODO actual.) Opciones A/B/C ya documentadas; la **A (dinámica)** es la recomendada — próximo evento + accesos rápidos + canción del día.

### 5.4 iPad y pestaña "Más"

Ya están como **prioridad alta** en `TODO.md`. Confirmado.

---

## 6. Accesibilidad

### 6.1 Cobertura real (verificada)

Tienen `accessibilityLabel`: Home, Notificaciones, Cantoral entero (Categories/SongList/Detail/Fullscreen/Selected), Contigo, Contactos, Visitas, Grupos, Apps, EventHome, Profundiza, varios bottom sheets y modales.

### 6.2 Pendientes

Auditar: `AlbumListScreen`, `MaterialesScreen`, `HorarioScreen`, `ComidaScreen`, `MasHomeScreen`, y los componentes `AlbumCard`/`EventItem`.

### 6.3 Más allá de `accessibilityLabel`

- `accessibilityRole` (`button`, `link`, `header`, `image`) — revisar uso sistemático.
- Tamaño de target táctil mínimo (44pt iOS / 48dp Android) en pestañas y FABs.
- Soporte a Dynamic Type / fontScale — ya hay `useFontScale` y `AppSettings.fontScale`, validar que los componentes lo respetan en pantallas grandes.
- Contraste de color en modo oscuro — auditar especialmente `KeyPillColors`, `meta-badge`, gradientes sobre imágenes.

---

## 7. Seguridad y privacidad

### 7.1 Reglas de Firebase RTDB no versionadas en el repo

**Archivo:** `mcm-app/firebase.json` solo declara `functions`, no `database.rules.json`.

Las reglas se gestionan desde la consola de Firebase y no están en git. **Riesgo:** una regresión en producción (alguien abre lectura por descuido) no se detecta hasta que pasa algo. Propuesta:

- Añadir `database.rules.json` a `mcm-app/` y configurar `firebase.json` con `"database": { "rules": "database.rules.json" }`.
- Validar reglas en CI con `firebase database:rules:validate`.
- Al menos un set de pruebas con `@firebase/rules-unit-testing`.

### 7.2 Credenciales en cliente

**Archivo:** `mcm-app/.env.example` + `constants/firebase.ts`

Las claves Firebase con prefijo `EXPO_PUBLIC_` viajan al cliente — comportamiento esperado en Firebase Web SDK. No es un fallo de seguridad **per se**, pero refuerza la necesidad de buenas reglas RTDB (§7.1) y de **Firebase App Check** para evitar abuso de API key desde fuera de la app.

**Propuesta:** habilitar **Firebase App Check** con DeviceCheck/Play Integrity.

### 7.3 Datos de usuario en AsyncStorage

`UserProfile`, `AppSettings`, etc. en AsyncStorage sin cifrar. Para datos puramente UI es aceptable. Si en algún momento se guarda algo sensible (token de notif, datos personales), considerar `expo-secure-store`.

### 7.4 Política de privacidad / GDPR

No he visto pantalla de política/consentimiento. Para distribución en stores europeas y notificaciones push, suele requerirse. Validar con el equipo.

---

## 8. Observabilidad y manejo de errores

### 8.1 No hay crash reporting

No hay Sentry / Crashlytics / Bugsnag. El `ErrorBoundary.tsx` solo muestra UI cuando algo rompe, pero el evento **no se reporta** a ningún sitio. Cualquier crash en producción es invisible.

**Propuesta:** integrar **Sentry** (`@sentry/react-native`) — funciona bien con Expo, captura JS y nativos, agrupa por release/version. Alternativa: Crashlytics (más fricción con Expo managed).

### 8.2 Logger central

99 `console.log/warn/error` en código. Propuesta:

- `utils/logger.ts` con niveles (`debug`/`info`/`warn`/`error`) y "transports" (consola en dev, Sentry en prod).
- ESLint rule `no-console` activada con excepciones controladas.

### 8.3 Métricas de uso

No hay analytics. Sin datos de uso es complicado priorizar:
- ¿Qué tabs se usan más?
- ¿Qué canciones se abren más?
- ¿Cuántos usuarios completan el onboarding vs lo saltan?
- ¿Se usa la sesión de coro? ¿Cuánto?

**Propuesta:** Firebase Analytics (gratis, mismo proyecto) o PostHog (autoalojable). Eventos clave: `app_open`, `tab_view`, `song_open`, `playlist_create`, `notification_received`, `onboarding_complete`.

### 8.4 Indicador de versión / build

`VersionDisplay.tsx` ya existe. Verificar que muestra `runtimeVersion` + `Updates.updateId` (útil para tickets de soporte).

---

## 9. Offline / red

### 9.1 Patrón actual: sólido

`useFirebaseData` ya hace caché en AsyncStorage y carga inmediato del cacheado. Hay `useNetworkStatus` y `OfflineBanner`.

### 9.2 Mejoras posibles

- **Reintentos con backoff** cuando `get()` falla por red intermitente (hoy hay un `catch` silencioso que solo registra `console.error`).
- **Sincronización en background** (al volver a estar online tras estar offline) → emit por evento, no esperar al próximo mount.
- **Indicador global de "actualizando datos"** — ahora cada pantalla muestra su propio loader pequeño, no hay sensación de "esto está sincronizando".

### 9.3 Política de caché web (PWA)

`useRegisterServiceWorker` existe. Validar política de caché: que la app cargue siempre del caché primero y se actualice en background (stale-while-revalidate) para mejorar el cold start en PWA.

---

## 10. Internacionalización (i18n)

### 10.1 Estado

Castellano hardcoded en todas las cadenas. No hay `react-intl`, `i18next` ni `expo-localization` configurado.

### 10.2 Decisión pendiente

¿Se quiere soportar otros idiomas? Casos plausibles:
- **Catalán / euskera** (delegaciones en España).
- **Portugués** (MCM Portugal, si aplica).
- **Inglés** (visitantes internacionales).

Si la respuesta es "no por ahora", **dejar constancia explícita** en `CLAUDE.md` para que los agentes no añadan i18n por su cuenta. Si la respuesta es "sí más adelante", introducir desde ya **`i18n-js` + `expo-localization`** con un archivo `es.json` único — el coste posterior de extraer strings es ~10× mayor que hacerlo desde el principio.

---

## 11. Developer Experience / CI / Lint

### 11.1 No hay CI de PRs

**Archivo:** `.github/workflows/*.yml`

Solo hay deploy web a `production` y OTA preview en `preview`. **No** hay workflow que ejecute `lint + typecheck + test` en pull requests. Riesgo: cualquier PR puede romper la build o los tests sin que nadie lo vea.

**Propuesta:** añadir `.github/workflows/ci.yml`:

```yaml
on:
  pull_request:
    branches: [main, production, preview]
jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'npm', cache-dependency-path: mcm-app/package-lock.json }
      - run: npm ci
        working-directory: ./mcm-app
      - run: npx tsc --noEmit
        working-directory: ./mcm-app
      - run: npm run lint
        working-directory: ./mcm-app
      - run: npm test -- --ci
        working-directory: ./mcm-app
```

### 11.2 `lint-staged` solo formatea

**Archivo:** `package.json` raíz.

`lint-staged` corre `prettier --write` y nada más. No corre ESLint ni Typescript. Propuesta:

```json
"lint-staged": {
  "mcm-app/**/*.{js,jsx,ts,tsx}": ["prettier --write", "eslint --max-warnings=0 --fix"],
  "mcm-app/**/*.{json,md}": ["prettier --write"]
}
```

### 11.3 Husky pre-commit sin tests

Es deliberado (no quieres bloquear cada commit). Bien. Pero conviene tener `npm test` rápido en CI (§11.1).

### 11.4 `npx tsc --noEmit` no está como script

Está en CLAUDE.md como recomendación, pero **no existe** como script de npm. Añadir:

```json
"typecheck": "tsc --noEmit"
```

---

## 12. Build, EAS y OTA

### 12.1 EAS bien configurado

`mcm-app/eas.json` tiene `development`, `preview`, `production`, `development-simulator`. `package.json` envuelve `eas build` con limpieza de symlinks de Claude Code. Bien.

### 12.2 OTA: criterios de promoción

Hay workflow `ota-preview.yml` que despliega OTA en `preview`. Falta documentar:
- **Cuándo** se promociona `preview` → `production`.
- Quién valida.
- Cómo se hace **rollback** rápido.

Propuesta: añadir esa guía corta a `CHANGELOG.md` o un `RELEASE.md` aparte.

### 12.3 `runtimeVersion`

CLAUDE.md dice `1.0.1`. Confirmar política: cuándo se sube `runtimeVersion` (cambio nativo) vs cuándo basta con OTA (cambio JS).

---

## 13. Backend Firebase y datos

### 13.1 Estructura RTDB

`songs/`, `albums/`, `jubileo/*` son nodos grandes que se descargan completos. Para queries reales (paginación, filtros) RTDB tiene limitaciones.

**A valorar a medio plazo:** Firestore para colecciones grandes (`songs`, `compartiendo`/reflexiones) — permite paginación y queries indexadas. Mantener RTDB para datos pequeños y configuración (`profileConfig`, `jubileo/horario`).

No urgente: el patrón actual `cache + updatedAt` mitiga el problema. Solo crítico cuando el dataset crezca.

### 13.2 Backend de notificaciones push pendiente

`NOTIFICACIONES.md` documenta que el cliente está listo y el backend pendiente. La carpeta `functions/` solo tiene `purgeExpiredShares`. Falta:
- Función Cloud que reciba un trigger (ej. una entrada en `/notifications/queue`) y use **FCM Admin** para enviar a topics/tokens.
- Idempotencia (no enviar duplicados).
- Audiencias por perfil/delegación (cruce con `profileConfig`).

### 13.3 Cleanup de datos antiguos

`purgeExpiredShares` cubre playlist/coro. Considerar añadir:
- Purgar `compartiendo/data` con `expiresAt` o más antiguas que X.
- Purgar `notifications` antiguas por usuario.

---

## 14. Documentación

### 14.1 Documentos del repo

`CLAUDE.md` (raíz y mcm-app), `AGENTS.md`, `CHANGELOG.md`, `DESIGN.md`, `TABS_MAINTENANCE.md`, `NOTIFICACIONES.md`, `EVENTOS.md`, `PANEL_PERFILES.md`. Está muy bien documentado.

### 14.2 Datos obsoletos detectados

- `mcm-app/CLAUDE.md` y `mcm-app/TODO.md`: "Jest (no hay tests escritos aún)" → **falso**, hay 7.
- `mcm-app/AGENTS.md`: menciona `FeatureFlagsProvider` → reemplazado por `ProfileConfigProvider` + `UserProfileProvider`.

### 14.3 Documento de "decisiones arquitectónicas"

No existe (sí hay `DESIGN.md` para visual, `CLAUDE.md` para técnico). Un ADR mínimo (Architecture Decision Records) ayudaría a entender **por qué** se eligió RTDB en vez de Firestore, **por qué** heroui-native vs Paper, **por qué** no react-query, etc.

---

## Lo que NO se ha cubierto en este análisis

Para ser honestos: este análisis se ha hecho con lecturas dirigidas, no con instrumentación real. Las áreas siguientes requieren un análisis aparte para no quedar superficiales:

1. **Mediciones reales de rendimiento** — todos los números de la sección 1 son estimaciones. Hay que medir con Flipper / React DevTools Profiler / `Performance.now()` en dispositivos reales para validar prioridades.
2. **Auditoría profunda del WebView del cantoral** — quién consume CPU dentro del HTML (estilos, layouts, font swap) requeriría profiling de Safari/Chrome remote inspector.
3. **Wordle** (`WordleScreen.tsx`, 776 líneas) — solo se ha mirado por encima. Tiene su propia lógica de leaderboards y estadísticas que merece auditoría aparte (anti-cheat, sincronización, validación servidor).
4. **Sesión de coro** (`ChoirSessionContext`, `useChoirSession`) — no se ha auditado el modelo de concurrencia: ¿qué pasa si dos maestros publican a la vez? ¿reconciliación?
5. **PWA / web** (`useRegisterServiceWorker`, `+html.tsx`, `public/`) — no he revisado el service worker, cabeceras de caché, manifest.json, ni el comportamiento offline en web.
6. **Notificaciones push** — `NOTIFICACIONES.md` ya tiene su propio plan; no he hecho audit del lado cliente para detectar bugs concretos.
7. **Build size del bundle** — no he ejecutado `npx expo export` ni medido el tamaño real del bundle por plataforma. Habría que añadir `react-native-bundle-visualizer` para análisis.
8. **Tiempo de cold start medido en dispositivos físicos** — Android low-end (4 GB RAM) vs iPhone reciente. Necesita un ensayo manual con cronómetro.
9. **Auditoría de seguridad real** — para una auditoría completa habría que revisar las reglas RTDB **vivas** en Firebase consola, no solo decir que no están versionadas.
10. **Accesibilidad con lector de pantalla real** — VoiceOver / TalkBack con un usuario invidente o vista cerrada. El audit con `accessibilityLabel` es necesario pero no suficiente.
11. **iPad layout específico** — `useResponsiveLayout` y los breakpoints concretos por pantalla. El TODO ya lo marca como prioridad alta, pero hace falta sentarse con un iPad físico.
12. **Memoria / fugas a largo plazo** — sesiones largas (1 h+), navegando entre tabs y abriendo canciones. Necesita Xcode Instruments / Android Studio Profiler.

Si quieres priorizar alguno de estos para un análisis dedicado, dímelo y me concentro en él.

---

> **Mantenimiento de este documento:** cuando se complete una tarea, marcarla en `mcm-app/TODO.md`. Si surge un hallazgo nuevo importante, añadirlo aquí en la sección que corresponda. Los datos obsoletos detectados en §14.2 conviene corregirlos cuanto antes para que CLAUDE.md y AGENTS.md no induzcan a error a los agentes IA.
