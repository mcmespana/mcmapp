# CLAUDE.md — MCM App (Expo/React Native)

> Referencia técnica para agentes IA. Léelo completo antes de hacer cambios.

## Resumen del proyecto

MCM App es la aplicación de MCM España (Misioneros y Misioneras Claretianos). Proporciona cantoral/cancionero con acordes, calendario de eventos, fotos, grupos, reflexiones, materiales, juego Wordle y notificaciones push.

**Stack:** Expo 55 · React Native 0.83 · React 19.2 · TypeScript · Firebase Realtime Database · **heroui-native** · ChordSheetJS

## Comandos de desarrollo

```bash
# Desde mcm-app/
npm start              # Servidor de desarrollo (escáner QR)
npm run web            # App en navegador
npm run android        # App en Android
npm run ios            # App en iOS
npm run lint           # ESLint
npm run format         # Prettier
npm test               # Jest (sin tests escritos aún)
npx tsc --noEmit       # Verificar tipos TypeScript
```

### Builds EAS (IMPORTANTE)

**NUNCA uses `npx eas-cli build` directamente.** Usa siempre los scripts npm que limpian los symlinks de skills de Claude Code (`.agent/`, `.agents/`) antes de comprimir. Sin esto, EAS falla en Windows con error `EPERM: operation not permitted, symlink`.

```bash
# Desde mcm-app/
npm run eas:build:ios -- --profile development    # Build iOS development (instalar en dispositivo)
npm run eas:build:ios -- --profile production      # Build iOS producción (App Store)
npm run eas:build:android -- --profile development # Build Android development
npm run eas:build:android -- --profile production  # Build Android producción (Play Store)
npm run eas:build -- --profile production          # Build ambas plataformas
```

**Perfiles disponibles en `eas.json`:**

- `development` — Dev client, distribución interna (instalar en dispositivo físico)
- `preview` — Build de preview, APK en Android
- `production` — Build de producción (App Store / Play Store)
- `development-simulator` — Dev client para simulador iOS

## Estructura de archivos

```
app/
├── _layout.tsx                 # Root layout: providers + Stack navigator
├── (tabs)/
│   ├── _layout.tsx             # Tabs: plataforma iOS (NativeTabs) vs Android/Web (Tabs)
│   ├── index.tsx               # Home: grid de botones de navegación
│   ├── cancionero.tsx          # Cantoral: stack navigator interno (Categories → Songs → Detail → Fullscreen)
│   ├── calendario.tsx          # Calendario: eventos ICS
│   ├── fotos.tsx               # Galería de fotos
│   └── mas.tsx                 # Más opciones (JubileoHome, Grupos, Materiales, etc.)
├── (tabsdesactivados)/
│   └── comunica.tsx            # Tab desactivada (movida fuera de tabs activos)
├── screens/                    # 20 pantallas individuales
│   ├── CategoriesScreen.tsx    # Lista de categorías del cantoral
│   ├── SongListScreen.tsx      # Lista de canciones por categoría
│   ├── SongDetailScreen.tsx    # Detalle de canción con acordes
│   ├── SongFullscreenScreen.tsx # Modo presentación
│   ├── SelectedSongsScreen.tsx # Playlist de canciones seleccionadas
│   ├── JubileoHomeScreen.tsx   # Menú del Jubileo
│   ├── MasHomeScreen.tsx       # Menú "Más"
│   ├── GruposScreen.tsx        # Grupos
│   ├── MaterialesScreen.tsx    # Materiales (BBCode → HTML)
│   ├── ProfundizaScreen.tsx    # Profundiza (BBCode → HTML)
│   ├── HorarioScreen.tsx       # Horario
│   ├── ContactosScreen.tsx     # Contactos
│   ├── VisitasScreen.tsx       # Visitas
│   ├── ReflexionesScreen.tsx   # Reflexiones (lectura + escritura en Firebase)
│   ├── WordleScreen.tsx        # Juego Wordle
│   ├── ComidaScreen.tsx        # Comida
│   ├── ComidaWebScreen.tsx     # Comida versión web
│   ├── MonitoresWebScreen.tsx  # Monitores
│   ├── AppsScreen.tsx          # Apps recomendadas
│   └── MaterialPagesScreen.tsx # Páginas de materiales
├── wordle.tsx                  # Entrada al Wordle desde root stack
├── notifications.tsx           # Pantalla de notificaciones
├── +not-found.tsx              # 404
└── +html.tsx                   # Template HTML para web

components/                     # ~40 componentes
├── ui/                         # Componentes base por plataforma
│   ├── TabScreenWrapper.ios.tsx  # Wrapper de tabs con barra de color (iOS)
│   ├── GlassHeader.ios.tsx       # Header glass para iOS
│   ├── GlassFAB.ios.tsx          # FAB con glass effect (iOS)
│   ├── TopColorBar.ios.tsx       # Barra de color superior (iOS)
│   ├── IconSymbol.tsx / .ios.tsx  # Iconos por plataforma
│   └── TabBarBackground.tsx / .ios.tsx
├── Song*.tsx                   # SongControls, SongDisplay, SongFontPanel, SongListItem, SongSearch
├── Toast.tsx                   # Sistema de toasts
├── SettingsPanel.tsx           # Panel de ajustes (Home)
├── AppFeedbackModal.tsx        # Modal de feedback/bugs
├── UserProfileModal.tsx        # Modal de perfil de usuario
├── FormattedContent.tsx        # Renderizador de BBCode → HTML
├── AddToHomeBanner.tsx         # Banner PWA "añadir a inicio"
├── VersionDisplay.tsx          # Muestra versión de la app
└── [otros]

contexts/                       # Estado global (React Context, NO Redux)
├── FeatureFlagsContext.tsx     # Feature flags (tabs, UI toggles)
├── AppSettingsContext.tsx      # Font scale, tema (→ AsyncStorage)
├── UserProfileContext.tsx     # Nombre, ubicación (→ AsyncStorage)
├── SettingsContext.tsx         # Ajustes del cantoral (→ AsyncStorage)
└── SelectedSongsContext.tsx   # Playlist temporal (in-memory)

hooks/                          # Custom hooks
├── firebaseApp.ts             # Singleton de Firebase App
├── useFirebaseData.ts         # CLAVE: fetch genérico con caché offline
├── useSongProcessor.ts        # ChordPro → HTML
├── useCalendarEvents.ts       # ICS → eventos
├── useCalendarConfigs.ts      # Configuraciones de calendarios
├── useColorScheme.ts          # Tema claro/oscuro
├── useStatusBarTheme.ts       # StatusBar por ruta
├── useCurrentTabColor.ts      # Color del tab actual
├── useFontScale.ts            # Escala de fuente
├── useNetworkStatus.ts        # Estado de red
├── useWordleGame.ts           # Lógica del Wordle
├── useWordleStats.ts          # Estadísticas Wordle
├── useWordleLeaderboard.ts    # Leaderboard Wordle
├── useWordleWords.ts          # Palabras del Wordle
└── useUnreadNotificationsCount.ts

constants/
├── featureFlags.ts            # IMPORTANTE: controla qué tabs/features se muestran
├── colors.ts                  # Colores de marca + TabHeaderColors
├── firebase.ts                # Config Firebase (lee de env vars)
├── spacing.ts                 # Espaciado
├── typography.ts              # Tipografía
└── iconAssets.ts              # Precarga de iconos

utils/
├── chordNotation.ts           # Conversión acordes EN ↔ ES
├── filterSongsData.ts         # Filtra canciones borrador/pendiente
├── songUtils.ts               # Limpieza de títulos, mapeo de categorías
├── formatText.ts              # BBCode → HTML
└── fontUtils.ts               # Utilidades de fuentes

services/
└── pushNotificationService.ts # Servicio de notificaciones push

notifications/
├── NotificationHandler.ts     # Handler global de notificaciones
└── usePushNotifications.ts    # Hook de notificaciones push

types/
└── notifications.ts           # Tipos de notificaciones
```

## Arquitectura de navegación

```
RootLayout (Stack)
├── (tabs) ← Bottom Tabs
│   ├── index (Home)           ← Grid de botones
│   ├── cancionero             ← Stack interno: Categories → SongsList → SongDetail → SongFullscreen
│   ├── calendario             ← Eventos ICS
│   ├── fotos                  ← Galería
│   └── mas                    ← Stack interno: MasHome → Jubileo/Grupos/Materiales/etc.
├── wordle                     ← Juego
└── notifications              ← Lista de notificaciones
```

**Tabs implementación dual:**

- **iOS**: `NativeTabs` (expo-router/unstable-native-tabs) para liquid glass
- **Android/Web**: `Tabs` tradicionales (expo-router)
- Config centralizada en `TABS_CONFIG` array en `app/(tabs)/_layout.tsx`

## Feature flags

Archivo: `constants/featureFlags.ts`

```typescript
// Estado actual:
tabs: {
  index: true,
  mas: true,
  cancionero: true,     // ← ACTIVO
  calendario: true,
  fotos: true,
  comunica: false,      // ← DESACTIVADO — tab movida a (tabsdesactivados)/
}
```

Los flags controlan tanto la visibilidad de los tabs como los botones en la Home. Se pueden cambiar via OTA update (ver `FEATURE_FLAGS_OTA.md`).

## Firebase

### Configuración

- Credenciales en `.env.local` (no commiteado), template en `.env.example`
- Todas las variables con prefijo `EXPO_PUBLIC_`
- Config en `constants/firebase.ts`, app inicializada en `hooks/firebaseApp.ts`

### Estructura de la base de datos

```
Firebase Realtime Database
├── songs
│   ├── updatedAt: timestamp
│   └── data: { categorías con canciones en formato ChordPro }
├── albums
│   ├── updatedAt: timestamp
│   └── data: { álbumes }
└── jubileo
    ├── horario    → { updatedAt, data }
    ├── materiales → { updatedAt, data }  (contenido BBCode)
    ├── visitas    → { updatedAt, data }
    ├── profundiza → { updatedAt, data }  (contenido BBCode)
    ├── grupos     → { updatedAt, data }
    ├── contactos  → { updatedAt, data }
    ├── compartiendo → { updatedAt, data }  (reflexiones — lectura/escritura)
    └── calendarios  → { updatedAt, data }  (URLs de archivos ICS)
```

### Patrón de datos

Todo usa `useFirebaseData<T>(path, cacheKey, transform?)`:

1. Carga desde AsyncStorage (caché local)
2. Muestra datos cacheados inmediatamente
3. Consulta Firebase por `updatedAt`
4. Si cambió, descarga `data` y actualiza caché
5. Único punto de escritura: `ReflexionesScreen` (reflexiones)

## Colores de marca

```typescript
primary: '#253883'; // Azul oscuro (fondo principal)
secondary: '#95d2f2'; // Azul claro
accent: '#E15C62'; // Rojo MIC
info: '#31AADF'; // Celeste
success: '#A3BD31'; // Verde COM
warning: '#FCD200'; // Amarillo COM
danger: '#9D1E74'; // Morado LC
```

## Convenciones de código

- **TypeScript** estricto con path alias `@/`
- **Prettier**: comillas simples, trailing commas, 80 chars, punto y coma
- **ESLint**: config de Expo + Prettier
- **Componentes**: funciones con export default, StyleSheet al final del archivo
- **Nombres**: PascalCase componentes, camelCase hooks/utils, kebab-case archivos de assets
- **Importaciones**: usar `@/` siempre, no rutas relativas largas
- **Plataforma**: usar `Platform.OS` para diferencias, archivos `.ios.tsx` para componentes iOS-only

## Patrones comunes

### Añadir nuevo tab

1. Crear archivo en `app/(tabs)/nuevoTab.tsx`
2. Añadir objeto a `TABS_CONFIG` en `app/(tabs)/_layout.tsx`
3. Añadir flag en `constants/featureFlags.ts` (interface + default)
4. Definir color en `TabHeaderColors` si aplica (en `constants/colors.ts`)
5. Usar `TabScreenWrapper` en el componente del tab
6. Documentar en CHANGELOG.md

### Añadir pantalla nueva

1. Crear en `app/screens/NombreScreen.tsx`
2. Añadir a la navegación correspondiente (tabs layout o root layout)
3. Usar `@/` para importaciones

### Fetch de datos Firebase

```typescript
const { data, loading, offline } = useFirebaseData<TipoData>(
  'ruta/firebase',
  'clave-cache',
  funcionTransformOptional,
);
```

## Documentación de cambios

**Agentes: documentad cambios importantes en `CHANGELOG.md`**

Documentar SÍ:

- Nuevas pantallas o funcionalidades
- Cambios en navegación o feature flags
- Nuevas dependencias o actualizaciones mayores
- Cambios en estructura de Firebase
- Fixes de bugs significativos
- Cambios de arquitectura

Documentar NO:

- Ajustes de estilo menores (colores, padding, márgenes)
- Correcciones de typos
- Refactors internos sin cambio funcional

## Archivos clave (referencia rápida)

| Qué necesitas           | Archivo                                                  |
| ----------------------- | -------------------------------------------------------- |
| Entry point             | `app/_layout.tsx`                                        |
| Configuración de tabs   | `app/(tabs)/_layout.tsx`                                 |
| Home screen             | `app/(tabs)/index.tsx`                                   |
| Feature flags           | `constants/featureFlags.ts`                              |
| Colores                 | `constants/colors.ts`                                    |
| Firebase config         | `constants/firebase.ts`                                  |
| Firebase app singleton  | `hooks/firebaseApp.ts`                                   |
| Fetch de datos          | `hooks/useFirebaseData.ts`                               |
| Procesador de canciones | `hooks/useSongProcessor.ts`                              |
| Parser de calendario    | `hooks/useCalendarEvents.ts`                             |
| BBCode → HTML           | `utils/formatText.ts`                                    |
| Notificaciones          | `notifications/` + `services/pushNotificationService.ts` |
| Env vars template       | `.env.example`                                           |

## Identificadores de la app

- **iOS Bundle ID**: `com.familiaconsolacion.mcmapp`
- **Android Package**: `com.mcmespana.mcmapp`
- **Apple Team ID**: `5P53S6QB23`
- **EAS Project ID**: `aa9f2d3a-b74a-4169-bad4-e851015e30c6`
- **App version**: 1.0.1
- **Runtime version**: 1.0.1

## HeroUI Native — UI Library

La app usa **heroui-native v1.0.0** (reemplaza react-native-paper desde marzo 2026). Es una biblioteca de componentes React Native construida sobre **Uniwind** (Tailwind CSS v4 para RN).

> **Para cualquier tarea de UI con HeroUI Native, usa siempre el skill `heroui-native`** — tiene acceso a la documentación completa de todos los componentes.
>
> Docs locales en `.heroui-docs/native/` (generadas con `npx heroui-cli@latest agents-md --native`)

### Configuración básica

```tsx
// app/_layout.tsx — jerarquía de providers OBLIGATORIA
<GestureHandlerRootView style={{ flex: 1 }}>
  <SafeAreaProvider>
    <HeroUINativeProvider>{/* tu app */}</HeroUINativeProvider>
  </SafeAreaProvider>
</GestureHandlerRootView>
```

**global.css** (Tailwind v4 entry point):

```css
@import 'tailwindcss';
@import 'uniwind';
@import 'heroui-native/styles';
@source './node_modules/heroui-native/lib';
```

**metro.config.js** extendido con `withUniwindConfig`.

### 37 componentes disponibles

| Categoría       | Componentes                                                                                                                                                         |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Botones**     | `Button`, `CloseButton`, `LinkButton`                                                                                                                               |
| **Formularios** | `TextField`, `TextArea`, `Input`, `InputGroup`, `InputOTP`, `SearchField`, `Select`, `Checkbox`, `RadioGroup`, `ControlField`, `Label`, `Description`, `FieldError` |
| **Layout**      | `Card`, `Separator`, `Surface`                                                                                                                                      |
| **Feedback**    | `Alert`, `Spinner`, `Skeleton`, `SkeletonGroup`                                                                                                                     |
| **Navegación**  | `Accordion`, `ListGroup`, `Tabs`                                                                                                                                    |
| **Overlays**    | `Toast` (vía `useToast`), `Dialog`, `BottomSheet`, `Popover`                                                                                                        |
| **Media**       | `Avatar`                                                                                                                                                            |
| **Controles**   | `Switch`, `Slider`                                                                                                                                                  |
| **Colecciones** | `Menu`, `TagGroup`                                                                                                                                                  |
| **Utilidades**  | `PressableFeedback`, `ScrollShadow`                                                                                                                                 |
| **Data**        | `Chip`                                                                                                                                                              |

### Patrones clave

**Compound components** (todos usan esta estructura):

```tsx
<Card>
  <Card.Header>…</Card.Header> {/* opcional */}
  <Card.Body>…</Card.Body> {/* contenido principal */}
  <Card.Footer>…</Card.Footer> {/* opcional */}
</Card>
```

**Toast** (imperativo, NO estado):

```tsx
const { toast } = useToast(); // requiere estar dentro de HeroUINativeProvider
toast.show({ variant: 'success', label: 'Mensaje' });
toast.show({
  variant: 'danger',
  label: 'Error',
  actionLabel: 'Cerrar',
  onActionPress: ({ hide }) => hide(),
});
```

**Button** (variantes semánticas):

```tsx
<Button variant="primary" onPress={...}>
  <Button.Label>Texto</Button.Label>
</Button>
// Variantes: primary | secondary | tertiary | danger | danger-soft | ghost | outline
```

**TextField** (reemplaza TextInput de Paper con floating label):

```tsx
<TextField>
  <TextField.Label>Título</TextField.Label>
  <TextField.Input value={val} onChangeText={setVal} />
  <TextField.Description>Ayuda</TextField.Description>
</TextField>
```

**Accordion** (custom en esta app — ver ProfundizaScreen.tsx):

```tsx
// Usamos accordion custom con TouchableOpacity + useState en vez de HeroUI Accordion
// para mayor control sobre el estilo de los items con color dinámico
```

**Avatar** (reemplaza Avatar.Text de Paper):

```tsx
<Avatar>
  <Avatar.Fallback name="Juan García" /> {/* genera iniciales */}
</Avatar>
```

**Switch** (de heroui-native, no RN nativo):

```tsx
<Switch isSelected={val} onChange={setVal} />
```

**Chip**:

```tsx
<Chip variant="solid" color="success">
  Texto
</Chip>
```

### Theming con Taiwind/Uniwind

Los colores de tema se definen en `global.css` con variables CSS:

```css
@theme {
  --color-primary: hsl(228, 58%, 33%); /* #253883 */
  --color-success: hsl(73, 56%, 46%); /* #A3BD31 */
  /* etc. */
}
```

Acceder a colores en componentes:

```tsx
import { useThemeColor } from 'heroui-native';
const accent = useThemeColor('accent');
```

### MCP Server

Configurado en `.mcp.json`:

```json
{
  "mcpServers": {
    "heroui-native": {
      "command": "npx",
      "args": ["-y", "@heroui/native-mcp@latest"]
    }
  }
}
```

Para activar en Claude Code: `claude mcp add heroui-native -- npx -y @heroui/native-mcp@latest`

### Actualizar documentación local

```bash
# Desde mcm-app/
npx heroui-cli@latest agents-md --native --output AGENTS.md
```

## Notas importantes

- `ReportBugsModal.tsx` es usado por `SongControls.tsx` — NO eliminar (las variantes *Fixed, *New, \*Simple ya fueron eliminadas)
- `ErrorBoundary.tsx` envuelve toda la app en `_layout.tsx`
- Splash screen: HelloWave con 3 repeticiones (900ms total)
- Feature flag `cancionero: true` — cantoral activo
- Sistema de notificaciones push: ver `NOTIFICACIONES.md` en la raíz del monorepo
