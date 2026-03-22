# Changelog — MCM App

> Registro de cambios importantes. Agentes IA: documentad aquí los cambios significativos.
> NO documentar: ajustes cosméticos, typos, refactors sin cambio funcional.

## Formato

```
## [fecha] — Descripción breve
- Qué cambió y por qué
- Archivos principales afectados
```

---

## 2026-03-22 — Nueva sección "Contigo" (Evangelio del Día + Mi Rato de Oración)

- **Nueva sección principal**: tab "Contigo" entre Cantoral y Calendario con el subtítulo "Propuestas para la oración de cada día"
- **Evangelio del Día**: pantalla `EvangelioScreen` que consume los datos del scraper desde Firebase (`seccion_oracion/lecturas/{date}/evangelio` e `info`). Navegación por días (±30 días), vista Lectura/Comentario, tracker de lectura (AsyncStorage)
- **Mi Rato de Oración**: pantalla `OracionScreen` con registro de duración y emoción predominante. Historial mensual con mini-calendario de puntos coloreados por emoción
- **Calendario litúrgico local**: hook `useLiturgicalCalendar` que determina tiempo litúrgico y color para cualquier fecha usando `assets/calendario-liturgico.json` (determinista, sin red)
- **Habit tracker semanal**: vista de la semana actual con dots para Evangelio y Oración; navegación entre semanas; racha de días consecutivos
- **Examen del Día**: placeholder reservado, deshabilitado (Fase 2)
- **Feature flag**: `contigo: true` en `constants/featureFlags.ts`
- **Firebase**: el hook `useDailyReadings` lee de `seccion_oracion/lecturas/{date}` usando el campo `activo` como prefijo de fuente (preparado para múltiples fuentes)
- Archivos nuevos: `app/(tabs)/contigo.tsx`, `app/screens/EvangelioScreen.tsx`, `app/screens/OracionScreen.tsx`, `hooks/useContigoHabits.ts`, `hooks/useDailyReadings.ts`, `hooks/useLiturgicalCalendar.ts`, `components/contigo/` (5 componentes)
- Archivos modificados: `app/(tabs)/_layout.tsx`, `app/_layout.tsx`, `constants/featureFlags.ts`, `constants/colors.ts`

## 2026-03-20 — Fix z-index cantoral + sistema de archivos .mcm para playlists

- **Bug fix**: botón "Importar playlist" y otros elementos en la pantalla de selección quedaban ocultos detrás del menú liquid glass en iOS. Aumentado `paddingBottom` y `marginBottom` en `SelectedSongsScreen` y snackbars
- **Nueva extensión .mcm**: las playlists ahora se exportan como archivos `.mcm` (JSON internamente) en vez de `.json`. Esto permite que solo MCM App abra estos archivos
- **Asociación de archivos en iOS y Android**: configurado `CFBundleDocumentTypes` + `UTExportedTypeDeclarations` (iOS) e `intentFilters` (Android) en `app.json` para que el sistema operativo reconozca archivos `.mcm` y los abra con la app
- **Importación desde archivos externos**: nuevo hook `useIncomingPlaylist` que escucha URLs entrantes cuando la app se abre desde un archivo `.mcm` (WhatsApp, Files, etc.) e importa la playlist automáticamente
- **SelectedSongsProvider movido al root layout** para que el handler de archivos entrantes funcione desde cualquier pantalla
- Compatibilidad retroactiva: la importación sigue aceptando `.json` y `.mcmsongs` además de `.mcm`
- Archivos: `app/screens/SelectedSongsScreen.tsx`, `app/_layout.tsx`, `app/(tabs)/cancionero.tsx`, `app.json`, `hooks/useIncomingPlaylist.ts`, `app/screens/CategoriesScreen.tsx`

## 2026-03-15 — Fix navegación en tabs Más y Cantoral

- **Bug fix**: al pulsar el tab "Más" o "Cantoral" estando dentro de una sub-pantalla del stack, la pantalla se quedaba bloqueada sin responder
- Añadido listener `tabPress` que hace `popToTop()` en el stack navigator interno cuando se re-pulsa el tab
- Archivos: `app/(tabs)/mas.tsx`, `app/(tabs)/cancionero.tsx`

## 2026-03-10 — Rediseño visual completo del Cantoral

- **Rediseño completo de la sección Cantoral** con estética moderna inspirada en Liquid Glass / iOS 18+
- **CategoriesScreen**: nuevo diseño con tarjetas redondeadas, emojis por categoría, contador de canciones, barra de búsqueda rápida integrada, fondo iOS-style (#F2F2F7)
- **SongListScreen**: barra de búsqueda moderna, cabecera con título y contador, mejor separación visual
- **SongListItem**: badges pill para tonalidad (key) y capo con colores temáticos, indicador verde de canción seleccionada, metadatos mejorados
- **SongDetailScreen**: fondo adaptado a dark mode, padding optimizado
- **SongControls**: menú FAB rediseñado con popup card flotante, iconos Material Design, indicadores de estado activo con colores azules, animación de rotación del FAB, separadores visuales entre secciones
- **SongFontPanel**: nuevo diseño con controles +/- para tamaño, porcentaje visible, botones de tipografía con checkmark activo, handle de arrastre
- **TransposePanel**: display de transposición actual, botones con colores semánticos (verde subir, rojo bajar), handle de arrastre
- **SongFullscreenScreen**: controles con esquinas redondeadas (borderRadius 16), slider con fondo oscuro, header oculto en modo fullscreen
- **SelectedSongsScreen**: barra de herramientas compacta con pill buttons, empty state con icono grande y descripción clara, modal de exportación con diseño moderno
- **BottomSheet**: esquinas más redondeadas (20px), backdrop adaptado a dark mode
- **cancionero.tsx**: título simplificado a "Cantoral", header shadow deshabilitado, tipografía con letter-spacing negativo
- Soporte completo de dark mode en todas las pantallas con paleta consistente
- Cross-platform: sombras adaptadas a web (boxShadow) y nativas (shadow*/elevation)
- Archivos afectados: `app/(tabs)/cancionero.tsx`, `app/screens/CategoriesScreen.tsx`, `app/screens/SongListScreen.tsx`, `app/screens/SongDetailScreen.tsx`, `app/screens/SongFullscreenScreen.tsx`, `app/screens/SelectedSongsScreen.tsx`, `components/SongControls.tsx`, `components/SongDisplay.tsx`, `components/SongListItem.tsx`, `components/SongFontPanel.tsx`, `components/TransposePanel.tsx`, `components/BottomSheet.tsx`

---

## 2026-03-06 — Actualización a Expo SDK 55

- **Expo SDK 54 → 55**: actualizado expo, react (19.1→19.2), react-native (0.81→0.83), y todos los paquetes expo-*
- **New Architecture obligatoria**: eliminado flag `newArchEnabled` de `app.json` (ya es el comportamiento por defecto en SDK 55)
- **Eliminado `edgeToEdgeEnabled`**: ya no es una opción válida en SDK 55 (edge-to-edge es el comportamiento por defecto)
- **expo-file-system**: migrado a `expo-file-system/legacy` donde se usa la API clásica (`cacheDirectory`, `EncodingType`), ya que la API principal ahora usa `File`/`Directory`/`Paths`
- **expo-notifications**: actualizado cleanup pattern de `removeNotificationSubscription()` a `subscription.remove()`
- **expo-glass-effect**: actualizado `GlassStyle` de `'light'`/`'dark'` a `'regular'`/`'clear'`
- **NativeTabs**: actualizado imports de `Icon`/`Label` a `NativeTabs.Trigger.Icon`/`NativeTabs.Trigger.Label`
- **Nuevos plugins en app.json**: `@react-native-community/datetimepicker`, `expo-font`, `expo-image`, `expo-sharing`, `expo-web-browser`
- Archivos principales: `package.json`, `app.json`, `app/(tabs)/_layout.tsx`, `app/(tabs)/cancionero.tsx`, `components/ui/GlassHeader.ios.tsx`, `hooks/useNetworkStatus.ts`, `notifications/usePushNotifications.ts`, `app/screens/SelectedSongsScreen.tsx`

---

## 2026-03-03 — Mejoras del cliente de notificaciones, dark mode, accesibilidad y rendimiento

### Notificaciones — mejoras del cliente

- **NotificationsContext**: nuevo contexto (`contexts/NotificationsContext.tsx`) con suscripción en tiempo real a Firebase via `subscribeToNotifications()`, badge actualizado en foreground
- **Modal de detalle**: nueva pantalla modal para ver notificaciones completas (body, imagen, botón de acción) en `app/notifications.tsx`
- **Marcar todas como leídas**: botón en header + función `markAllNotificationsAsRead` en servicio
- **iOS action buttons**: mapeado de `actionIdentifier` (view, view_event, view_photos) a rutas internas en `usePushNotifications.ts`
- **useUnreadNotificationsCount**: simplificado, ahora delega al NotificationsContext

### Dark mode

- **ErrorBoundary.tsx**: usa `Appearance.getColorScheme()` para colores dinámicos (está fuera de providers)
- **SongFullscreenScreen.tsx**: fondo dinámico con `useColorScheme`
- **ComidaWebScreen.tsx**: overlay de carga y botón "Volver" adaptativos, ActivityIndicator usa tema correcto
- **MonitoresWebScreen.tsx**: overlay de carga adaptativo, ActivityIndicator usa tema correcto
- **WordleScreen.tsx**: teclado y barras de estadísticas con colores adaptativos
- **ReflexionesScreen.tsx**: tarjetas grupales con fondo y texto adaptativos en modo oscuro

### Rendimiento

- **Home (`app/(tabs)/index.tsx`)**: `ContextualDecoration` envuelto en `React.memo()`, animaciones con `useRef` en vez de `useState`

### Accesibilidad

- `accessibilityLabel` y `accessibilityRole` en botones de Home (notificaciones, ajustes, grid), pantalla de notificaciones (back, mark read, swipe, detalle)

### Infraestructura

- **Pre-commit hooks**: husky + lint-staged en raíz del monorepo para formateo automático con Prettier
- **Dependencias actualizadas**: todas las dependencias al máximo dentro de Expo SDK 54 (`npm update`)

### Pendiente para próxima sesión

- Upgrade a Expo SDK 55 (requiere `npx expo install --fix` + testing)
- Firebase 11→12 (major version, revisar guía de migración)

---

## 2026-03-01 — Mantenimiento general y reorganización de documentación

### Cambios funcionales

- **Cantoral activado**: `cancionero: true` en `constants/featureFlags.ts`
- **ErrorBoundary global**: nuevo `components/ErrorBoundary.tsx`, envuelve toda la app en `_layout.tsx`
- **Splash screen más rápido**: reducido de 1.5s a 0.9s (3 repeticiones en HelloWave)

### Limpieza de código

- Eliminados componentes muertos: `ReportBugsModalNew.tsx`, `ReportBugsModalFixed.tsx`, `ReportBugsModalSimple.tsx`, `.bak`, `.broken`, `.complex`
- Eliminados scripts de debug: `test-calendar-fix.js`, `test-firebase.js`, `test-new-logic.js`
- Eliminado `jest.config.js` y dependencias de test (jest-expo, @testing-library/\*, react-test-renderer)
- Eliminado `dotenv` de dependencies (solo se usaba en script eliminado)
- Movido `eslint-config-expo` de dependencies a devDependencies
- Script `npm test` cambiado a placeholder hasta que se configuren tests

### Documentación

- Creado `CLAUDE.md` en raíz del monorepo (orientación para agentes)
- Reescrito `mcm-app/CLAUDE.md` con referencia técnica completa
- Creado `CHANGELOG.md` y `TODO.md`
- Simplificado `README.md` para humanos con chuletas de comandos
- Consolidado 4 archivos `NOTIS_*.md` + `PANEL_NOTIFICACIONES_NEXTJS.md` → `NOTIFICACIONES.md`
- Eliminado `agents.md` (duplicado de `AGENTS.md`)

## 2025-11 — Estado conocido al crear esta documentación

- App publicada en stores (Android + iOS) y web
- Cantoral (`cancionero`) desactivado via feature flag (`cancionero: false`)
- Tab "Comunica" desactivada y movida a `app/(tabsdesactivados)/`
- Sistema de notificaciones push: cliente implementado, backend (panel Next.js) pendiente
- 4 componentes ReportBugsModal\* sin usar (reemplazados por AppFeedbackModal)
- No hay tests de Jest escritos
- Contraseña del panel secreto hardcodeada ("coco" en SecretPanelModal.tsx)
