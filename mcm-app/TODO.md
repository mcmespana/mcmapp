# TODO — MCM App · Checklist de mantenimiento y mejoras

> Lista de tareas pendientes para mantener y mejorar la app.
> Agentes IA: consultad esta lista antes de trabajar. Marcad como completadas las tareas que terminéis.

---

## Prioridad alta

- [x] **Cantoral — arreglos `{arr:}` por long-press en vivo (admin)**: ✅ hecho. Cuando `isAdmin`, long-press sobre una línea del visor abre una hoja para escribir el arreglo; se inserta `{arr: ...}` encima de esa línea, se ve al instante (render en vivo) y se propone a `songs/ediciones` (contentOld/contentNew). JS inyectado en el WebView (`hooks/useSongProcessor.ts`) que manda el índice de la línea original a RN vía `postMessage`/`onMessage` (`components/SongDisplay.tsx`). El mapeo fila↔línea es transpose-invariante (`injectRowLineIndices`/`renderableRowLineIndices` en `utils/arrangements.ts`, con tests). UI: `components/ArrangementInputModal.tsx`.
- [ ] **Cantoral — mostrar campos multimedia al usuario final**: hoy `rhythm`, `album`, `source`, `videoEmbed`, `youtubeLinks` y `audioLinks` solo son **editables por el admin** (`SecretPanelModal`) y NO se muestran en el visor. Diseñar y exponer estos datos al usuario final (cabecera de canción / hoja de detalles / reproductor embebido) cuando se decida el diseño.
- [ ] Revisar diseño en iPads y arreglarlo
- [ ] **Command Palette v2: deep-link a contenidos** — el palette actual (`CommandPalette.tsx`) solo navega a tabs/pantallas top-level. Para saltar a una canción concreta o a un punto dentro de los stacks anidados hay que exponer un `navigation ref` (p.ej. `CancioneroNavRefContext`). Después indexar canciones (`songs/data`), reflexiones (`compartiendo/data`) y eventos del calendario.

---

## Modernización pendiente

- [ ] **Extender `useContextMenu` a otras listas**: el hook ya existe (`hooks/useContextMenu.ts`) y se usa en `SongListItem`. Pendiente aplicarlo a:
  - Notificaciones (`app/notifications.tsx`) — marcar leída / eliminar
  - Reflexiones (`app/screens/ReflexionesScreen.tsx`) — editar / copiar / compartir
  - Contactos (`app/screens/ContactosScreen.tsx`) — llamar / WhatsApp / copiar teléfono
  - Playlist (`app/screens/SelectedSongsScreen.tsx`) — subir / bajar / quitar

---

## Notificaciones push — mejoras pendientes (alineación con MCM Panel)

> Contexto: ver `NOTIFICACIONES_CONTRATO.md` (raíz). La app ya tolera el formato del
> panel (alias de rutas + `actionButtons[]`). Estas mejoras requieren build nativo o
> trabajo nuevo y por eso quedaron fuera de la entrega OTA de 2026-06-02.

- [ ] **NSE iOS para imágenes en la notificación del sistema** — hoy `richContent.image`
  - `mutableContent` NO pintan imagen en iOS (no hay Notification Service Extension);
    la imagen solo se ve in-app vía `data.imageUrl`. Añadir NSE (Android ya funciona).
    ⚠️ Código nativo → requiere build de producción y commit con `[skip-ota]`.
- [ ] **Deep link a un evento/actividad concreto** — hoy el destino navegable es
      `/(tabs)/mas`; no hay ruta estable tipo `/(tabs)/mas/evento/<id>`. Registrar una
      ruta con parámetro `eventId` y propagarla para que una notificación abra el evento
      directamente (Jubileo, visitapapa26, `activities/<nombre>`).
- [ ] **Channels Android por tipo/prioridad** — hoy solo existe el channel `default`
      (importancia MAX), así que `priority` no diferencia el display. Crear channels
      (`urgente`, `eventos`…) para heads-up/sonido diferenciados y permitir que el panel
      mande `channelId`. ⚠️ Puede requerir build nativo.
- [ ] **Usar `data.category` en el centro de notificaciones** — hoy se guarda pero no
      dispara color/icono/agrupación/filtro. Diseñar el tratamiento visual por categoría
      y converger el vocabulario con el panel (`eventos` vs `evento`, `cancionero` vs
      `cantoral`).
- [ ] **(Panel) Corregir el contrato** — que el MCM Panel use las rutas reales,
      segmente por `topics`/`profileType`/`delegationId` (no `userType`/`delegacion`) y
      desacople `categoryId` (solo iOS) de `data.category`. Detalle en
      `NOTIFICACIONES_CONTRATO.md`.

---

## Mantenimiento

- [ ] **Ampliar cobertura de tests**: ya hay 7 ficheros en `__tests__/` (`chordNotation`, `filterSongsData`, `formatText`, `resolveProfileConfig`, `songUtils`, `useFirebaseData`, `useNetworkStatus`). Priorizar lo que falta: `useSongProcessor`, `useChoirSession`, `useResolvedProfileConfig`, y al menos una pantalla con render snapshot.

---

## Prioridad baja

- [ ] **Accesibilidad — completar cobertura restante**: ya cubren `accessibilityLabel` Home, Notificaciones, Cantoral (Categories/SongList/Detail/Fullscreen/Selected), Calendario (parcial vía Contigo), Contactos, Visitas, Grupos, Apps, EventHome, Profundiza, varios bottom sheets y modales. Falta auditar Fotos (`AlbumListScreen`), Materiales, Horario, Comida, MasHome y los componentes `AlbumCard`/`EventItem`.

---

## Inconsistencias del Design System

- [ ] **Tipografía no conectada a componentes**: `constants/typography.ts` define h1/h2/body/caption/button pero la mayoría de componentes usan fontSize inline. El archivo solo se importa en 5 sitios.
- [ ] **Falta token para modal borderRadius**: los modales usan 8px o 12px según el componente. `radii.sm=8` y `radii.md=12` están disponibles pero no aplicados en los modales existentes.
- [ ] **Peso de fuente inconsistente**: section labels usan `fontWeight: '800'`, títulos de cards `'700'`, botones `'500'`/`'700'`. No hay guía clara de qué peso usar en cada nivel.
- [ ] **Migrar componentes existentes a tokens**: `radii.*` y `shadows.*` están definidos pero los componentes siguen usando valores inline. Migrar gradualmente.

---

## Ideas para la Home Screen

La home actual es un grid de botones estático. Opciones para hacerla más útil:

### Opción A: Home con contenido dinámico (recomendada)

- Próximo evento del calendario (tarjeta destacada arriba)
- Accesos rápidos más compactos
- Canción del día (si el cantoral está activo)
- Wordle pendiente con indicador más claro
- Último contenido actualizado (materiales, reflexiones)

### Opción B: Home tipo dashboard

- Saludo personalizado (si UserProfile tiene nombre)
- Fecha de hoy + próximo evento
- Cards apiladas con preview de contenido

### Opción C: Home minimalista

- Logo MCM grande arriba
- Lista simple de secciones con subtítulo
- Barra de búsqueda global

---

## Mejoras técnicas — rendimiento

> Análisis técnico transversal completo en **`/MEJORAS.md`** (raíz del monorepo). Cada item de abajo tiene su sección con archivo:línea y propuesta concreta.

**Quick wins (bajo esfuerzo, bajo riesgo) — empezar por aquí:**

- [x] **Firebase: descargar `updatedAt` antes que `data`** en `hooks/useFirebaseData.ts`. Cuando hay caché local, primero se comprueba `updatedAt` + `hidden` (pocos bytes) y `data` sólo se baja si cambió. Ver MEJORAS.md §1.1.
- [x] **Memoizar parser ChordPro** en `hooks/useSongProcessor.ts` y eliminar el segundo parser temporal usado para `displayKey` (ahora vía `utils/transposeKey.ts`). Ver MEJORAS.md §1.3.
- [x] **`freezeOnBlur: true`** en los stacks anidados de `cancionero` y `mas`. Ver MEJORAS.md §1.7.
- [x] **`expo-image` en `AlbumCard`**: ya está instalado (`package.json:42`) pero nadie lo importa. Reemplazar `ImageBackground` y añadir `placeholder`/`transition`. Ver MEJORAS.md §1.5.
- [x] **`React.memo` en `SongSearch`, `AlbumCard`, `EventItem`**. Ver MEJORAS.md §1.9.
- [x] **Eliminar `lodash`** de `package.json` (0 importaciones). Ver MEJORAS.md §1.10.
- [x] **Reducir `HelloWave`** a 2 repeticiones (600 ms) o saltarlo tras el primer arranque. Ver MEJORAS.md §1.8.

**Iteraciones siguientes (más esfuerzo, más impacto):**

- [ ] **React Compiler** — activar `babel-plugin-react-compiler` (soportado en React 19). Memoiza automáticamente. Ver MEJORAS.md §1.6.
- [x] **`GruposScreen` → `SectionList`** y **`ContactosScreen` → `FlatList`**. Hecho 2026-05-24: GruposScreen rediseñado (buscador siempre visible, "Encuéntrame" por `UserProfile.name`, badge "tú", filtro interno en grupos grandes); ContactosScreen virtualizado con buscador.
- [x] **WebView estable con `postMessage`** para aplicar fuente/tamaño/tema/visibilidad de acordes sin recrear el HTML. Hecho 2026-05-24: `useSongProcessor` separa estructura/estilo y devuelve `styleState`; el bridge `window.__SONG_BRIDGE__` aplica CSS vars + clases sin recargar. Nota: cambios de tono y notación EN/ES siguen regenerando HTML (modifican el contenido).
- [x] **Pre-procesado ChordPro** — adaptado a caché de módulo (FIFO de 64 entradas en `useSongProcessor.ts`). Reabrir una canción ya no la reparsea. El plan original de Metro Transformer no aplica: las canciones viven en Firebase, no en el bundle.

**A valorar:**

- [ ] Auditar si `react-native-render-html` compensa (solo se usa en `FormattedContent.tsx`). Si BBCode simple bastara, ahorraría peso de bundle. Ver MEJORAS.md §1.10.
- [ ] Cómo medir antes/después (cold start, transpose, bytes de red, memoria) → MEJORAS.md "Lo que NO se ha cubierto" §1.

---

## Calidad de código y mantenibilidad

- [ ] **Trocear ficheros enormes**: `SelectedSongsScreen.tsx` (1.750 líneas), `NotificationsBottomSheet.tsx` (908), `WordleScreen.tsx` (776), `SecretPanelModal.tsx` (660). Extraer subcomponentes, hooks y utilidades. Ver MEJORAS.md §2.1.
- [ ] **`prettier/prettier` a `error`** en `eslint.config.js`. Hoy es warn y deja pasar formato roto. Ver MEJORAS.md §3.1.
- [ ] **Añadir script `typecheck`** en `package.json`: `"typecheck": "tsc --noEmit"`. Hoy se recomienda en `CLAUDE.md` pero no existe. Ver MEJORAS.md §11.4.
- [ ] **Logger centralizado** (`utils/logger.ts`) que sustituya los 99 `console.*` del código y conecte con Sentry en producción. Ver MEJORAS.md §3.2 y §8.2.
- [ ] **Agrupar providers afines** en `app/_layout.tsx` (12 anidados). Por ejemplo, combinar `UserProfile` + `ProfileConfig`. Ver MEJORAS.md §2.2.

---

## Seguridad y observabilidad

- [ ] **Versionar reglas de Firebase RTDB** en `mcm-app/database.rules.json` + entrada en `firebase.json`. Hoy las reglas solo viven en la consola → riesgo de regresión silenciosa. Ver MEJORAS.md §7.1.
- [ ] **Firebase App Check** (DeviceCheck/Play Integrity) para evitar abuso de las API keys públicas (`EXPO_PUBLIC_*`). Ver MEJORAS.md §7.2.
- [ ] **Crash reporting** — integrar Sentry (`@sentry/react-native`). Hoy `ErrorBoundary` muestra UI pero no reporta. Ver MEJORAS.md §8.1.
- [ ] **Analítica de uso** — Firebase Analytics o PostHog, con eventos clave (`app_open`, `tab_view`, `song_open`, `playlist_create`, `notification_received`). Sin esto no se puede priorizar por datos reales. Ver MEJORAS.md §8.3.
- [ ] **Política de privacidad / consentimiento** — revisar si está pendiente para stores europeas / notificaciones push. Ver MEJORAS.md §7.4.

---

## DX / CI / Build

- [ ] **Workflow de CI en pull requests** (`.github/workflows/ci.yml`) con `lint + typecheck + test`. Hoy solo hay deploy a producción/preview. Ver MEJORAS.md §11.1.
- [ ] **Extender `lint-staged`** para correr eslint además de prettier en pre-commit. Ver MEJORAS.md §11.2.
- [ ] **Documentar criterios de promoción OTA preview → production** (quién valida, cómo se hace rollback). Ver MEJORAS.md §12.2.

---

## Offline / red / PWA

- [ ] **Reintentos con backoff** en `useFirebaseData` cuando `get()` falla por red intermitente (hoy se traga el error). Ver MEJORAS.md §9.2.
- [ ] **Sincronización en background** al volver a estar online (no esperar al próximo mount). Ver MEJORAS.md §9.2.
- [ ] **Auditar política de caché PWA** (`useRegisterServiceWorker`): stale-while-revalidate, cabeceras correctas. Ver MEJORAS.md §9.3.

---

## Backend Firebase

- [ ] **Completar backend de notificaciones push** — solo hay `purgeExpiredShares`. Falta función Cloud que lea trigger y use FCM Admin (NOTIFICACIONES.md). Idempotencia y audiencias por perfil/delegación. Ver MEJORAS.md §13.2.
- [ ] **Cleanup adicional**: reflexiones antiguas, notificaciones por usuario antiguas. Ver MEJORAS.md §13.3.
- [ ] **Valorar Firestore** para `songs` y `compartiendo` cuando el dataset crezca (paginación, queries indexadas). Mantener RTDB para configuración y datos pequeños. Ver MEJORAS.md §13.1.

---

## Internacionalización

- [ ] **Decisión i18n**: ¿castellano monolingüe o se quiere catalán/euskera/portugués/inglés? Si "no por ahora", dejarlo explícito en CLAUDE.md para que ningún agente lo añada. Si "sí más adelante", introducir `i18n-js` + `expo-localization` ya con un único `es.json`. Ver MEJORAS.md §10.

---

## Documentación a sincronizar

- [ ] **`AGENTS.md` obsoleto**: menciona `FeatureFlagsProvider` que ya no existe (reemplazado por `ProfileConfigProvider` + `UserProfileProvider`). Ver MEJORAS.md §14.2.
- [ ] **`mcm-app/CLAUDE.md`**: corregir frase "Jest (sin tests escritos aún)" — hay 7. Ver MEJORAS.md §14.2.
- [ ] **ADR mínimo** (Architecture Decision Records) en algún sitio: por qué RTDB vs Firestore, por qué heroui-native vs Paper, por qué no react-query, etc. Ver MEJORAS.md §14.3.
