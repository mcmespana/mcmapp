# MCM App — Design System

## North Star: "Institucional Cálido"

Serio pero cercano. Colores institucionales claros sobre fondos blancos, tipografía del sistema legible, esquinas redondeadas suaves y efectos glass en iOS. Diseñado para una comunidad religiosa: transmitir confianza y orden sin perder calidez.

## Territorios visuales

La app convive en dos territorios visuales con tokens compartidos:

| Territorio        | Dónde                         | Paleta                                | Formas                                 | Tipografía                   |
| ----------------- | ----------------------------- | ------------------------------------- | -------------------------------------- | ---------------------------- |
| **Institucional** | Todo excepto Contigo          | `brand` + `TabHeaderColors`           | Radios 8–18, sombras sutiles           | Sistema                      |
| **Contigo (cálido)** | `(tabs)/contigo/*` + `components/contigo/*` | `WARM_LIGHT/DARK` (dorado, beige) | Radios 20–22, sombras prominentes, gradientes | Sistema + Palatino (lecturas) |

**Compartido entre ambos**: la escala de spacing, los radios base, el sistema de Glass (iOS/Android/Web), los componentes UI extraídos (`components/ui/`), los hooks de tema/responsive, las animaciones canónicas.

Regla: el resto de la app NO adopta la paleta cálida de Contigo — sí adopta sus patrones estructurales (radii, sombras, componentes, microinteracciones).

## Colores

### Paleta de marca

- **Primary (`#253883`):** Azul oscuro — identidad MCM, fondos de cabecera, botones principales.
- **Secondary (`#95d2f2`):** Azul claro — acentos secundarios, decoraciones.
- **Accent (`#E15C62`):** Rojo MIC — llamadas a la acción, badges, notificaciones.
- **Info (`#31AADF`):** Celeste — enlaces, elementos informativos.
- **Success (`#A3BD31`):** Verde COM — confirmaciones, estados positivos.
- **Warning (`#FCD200`):** Amarillo COM — alertas, tab Cantoral.
- **Danger (`#9D1E74`):** Morado LC — errores, tab Comunica.
- **Text (`#002B81`):** Azul COM — texto principal en modo claro.

### Colores de tabs (cabecera)

Cada tab tiene un color propio que se muestra en la barra superior (iOS) y el header:

```
cancionero:  #f4c11e   (Amarillo Cantoral)
calendario:  #31AADF   (Celeste)
fotos:       #E15C62   (Rojo MIC)
comunica:    #9D1E74dd (Morado LC, 87% opacidad)
```

### Colores de UI (`UIColors` en `constants/colors.ts`)

```
activePrimary:      #007bff   (Azul — elementos activos, FABs)
activePrimaryDark:  #0056b3   (Azul oscuro — bordes FAB activos)
accentYellow:       #f4c11e   (Amarillo — FAB principal)
secondaryText:      #6c757d   (Gris — texto secundario)
modalOverlay:       rgba(0,0,0,0.5)
border:             #E0E0E0   (Gris claro — bordes generales)
```

### Modo claro / oscuro (`Colors` en `constants/colors.ts`)

```
             Claro          Oscuro
text:        #11181C        #FFFFFF
background:  #ffffff        #2C2C2E
card:        #FFFFFF        #3A3A3C
tint:        #0a7ea4        #ffffff
icon:        #687076        #C5C5C7
shadow:      #000000        #000000
```

### Colores de toast (`ToastColors` en `constants/colors.ts`)

```
success:  #4CAF50   (Material Green)
error:    #F44336   (Material Red)
warning:  #FF9800   (Material Orange)
info:     #2196F3   (Material Blue)
```

Texto siempre blanco sobre fondo de color. Estos son distintos de los colores de marca (success/danger) a propósito — siguen Material Design para feedback visual estándar.

### Colores semánticos (`constants/colors.ts`)

Tokens centralizados para evitar magic numbers en componentes:

```
StateColors             selectedBgLight/Dark, hoverOverlay(Dark), pressedOverlay(Dark)
EmotionColors           joy / sadness / anger / fear / disgust (Contigo)
EmotionColorsSoft       versiones suaves de las emociones (chips, fondos)
FeedbackCategoryColors  bug / idea / praise (AppFeedbackModal)
```

### Paleta cálida de Contigo

Definida en `components/contigo/theme.ts` (NO en `constants/colors.ts` — es específica de la sección Contigo):

```
WARM_LIGHT
  bg #FAF6F0, bgDeep #F2EAD9, bgCard #FFFFFF
  accent #C4922A (dorado), accentLight rgba(196,146,42,0.10), accentMid 0.22
  blue #2563EB, green #3A7D44, purple #7C3AED, fire #EA580C
  text #1C1610, textSec #7A6550, textMuted #B5A08A
  border rgba(196,146,42,0.13), shadow rgba(100,70,20,0.08)

WARM_DARK: paralelo, fondos #1A1712/#100F0C/#26221C, accent #DAA520
```

## Tipografía

- **Fuente:** Sistema nativo (San Francisco en iOS, Roboto en Android). No se usa fuente custom para UI.
- **Fuente monoespaciada:** SpaceMono-Regular (solo para código/acordes).
- **Iconos:** MaterialIcons (`@expo/vector-icons`), SF Symbols en iOS.

| Nivel    | Tamaño | Peso   | Uso                                                       |
| -------- | ------ | ------ | --------------------------------------------------------- |
| h0       | 34px   | 800    | Títulos hero (Contigo, ScreenHero) · letterSpacing -1.4   |
| h1       | 28px   | bold   | Títulos de pantalla                                       |
| h2       | 22px   | 600    | Subtítulos, secciones                                     |
| body     | 16px   | normal | Texto general                                             |
| caption  | 13px   | normal | Texto auxiliar, metadatos                                 |
| button   | 15px   | 500    | Botones, labels de acción                                 |
| overline | 10px   | 600    | Kicker uppercase con tracking 0.5 (SectionHeader, kicker) |
| serif    | —      | —      | `Palatino` (iOS) / `serif` (Android) — lecturas litúrgicas |

- El sistema soporta escala de fuente (`fontScale`) que multiplica los tamaños base.
- Peso extra-bold (`800`) se usa en labels de sección, badges y el logo.
- `letterSpacing` negativo (`-0.4`) en el logo text; positivo (`0.3`–`1.0`) en labels uppercase.
- `typography.serif` solo se usa en `components/contigo/ReadingCard.tsx` y donde haya texto contemplativo largo — no en UI general.

## Espaciado

Escala fija de 5 niveles:

```
xs:  4px
sm:  8px
md:  16px   (padding horizontal por defecto)
lg:  24px   (separación entre secciones)
xl:  32px   (padding inferior de scroll)
```

Padding horizontal de página: `16px` (spacing.md).
Gaps entre elementos: generalmente `7px`–`8px` (sm), `3px`–`5px` para contenido denso.

## Formas y bordes

### Border radius (`radii` en `constants/uiStyles.ts`)

El sistema usa radios redondeados suaves, no pill-shaped salvo casos puntuales:

| Token            | Valor | Uso                                       |
| ---------------- | ----- | ----------------------------------------- |
| `radii.xs`       | 4px   | Badges pequeños                           |
| `radii.sm`       | 8px   | Botones, inputs                           |
| `radii.md`       | 12px  | Toasts, modales, date boxes               |
| `radii.lg`       | 14px  | Cards de contenido, eventos               |
| `radii.xl`       | 18px  | Cards destacadas (Home)                   |
| `radii.pill`     | 20px  | Chips, pills de acción                    |
| `radii.xxl`      | 22px  | Cards hero (Contigo, GlassCard, TeaserCard) |
| `radii.full`     | 28px  | FABs, icon circles (56x56)                |
| `radii.pillFull` | 999   | Badges/dots circulares, citation pills    |

### Bordes

```
Separador estándar:    1px solid #E0E0E0
Card border:           1px solid rgba(0,0,0,0.06–0.07)
Card border (dark):    1px solid rgba(255,255,255,0.08–0.09)
Accent border left:    4px solid [calColor]  (event cards)
Outlined button:       1.5px solid [accentColor + 30]
Dashed border:         1.5px dashed [iconColor + 40]
```

## Sombras y elevación

### Presets de sombra (`shadows` en `constants/uiStyles.ts`)

| Token          | iOS (opacity/radius) | Android     | Uso                                                 |
| -------------- | -------------------- | ----------- | --------------------------------------------------- |
| `shadows.sm`   | 0.06 / radius 3      | elevation 1 | Cards de contenido, eventos                         |
| `shadows.md`   | 0.12 / radius 6      | elevation 3 | Cards elevadas, paneles                             |
| `shadows.lg`   | 0.3 / radius 8       | elevation 8 | Toasts, FABs, overlays                              |
| `shadows.xl`   | 0.18 / radius 12     | elevation 6 | Hero cards, teaser destacado                        |
| `shadows.warm` | 0.18 / radius 10     | elevation 4 | Sombra tintada cálida (Contigo, futuros heroes)     |
| `shadows.cool` | 0.18 / radius 10     | elevation 4 | Sombra tintada fría (institucional destacado)       |

Todas las sombras tienen variante `web` con `boxShadow` equivalente. `shadows.warm`/`cool` aportan color: cálida `#64461E` (marrón), fría `#253883` (primary).

### Sombra de texto

```
textShadowColor:  rgba(0, 0, 0, 0.5)
textShadowOffset: {0, 1}
textShadowRadius: 2
```

## Glass Morphism (cross-platform)

La decisión LiquidGlass-vs-BlurView-vs-fallback está centralizada en
`components/ui/GlassSurface(.ios).tsx`. Los componentes glass de alto nivel
(`GlassHeader`, `GlassFAB`, `GlassTabBarBackground`, `GlassCard`) delegan en él.

### `GlassSurface` — abstracción canónica

| Plataforma | Implementación                                                                     |
| ---------- | ---------------------------------------------------------------------------------- |
| iOS 18+    | `GlassView` de `expo-glass-effect` (`glassEffectStyle: "clear" \| "regular"`)       |
| iOS <18    | `BlurView` de `expo-blur` con `tint` y `intensity` dinámicos por brillo            |
| Web        | Fondo translúcido + CSS `backdrop-filter: blur(...)` (cross-browser con `-webkit-`) |
| Android    | Fondo sólido tintado con borde sutil (sin emular blur — RN Android no lo soporta cheap) |

Props clave:
- `tintColor` — color de fondo (auto-decide alpha+blurTint según brillo)
- `variant` — `clear` (más translúcido, tab bar), `regular` (default), `material`
- `blurTint` — override del tint de `BlurView` (ej. `systemChromeMaterial` para tab bar iOS <18)
- `bottomBorder` — añade hairline inferior (separador de header)

Brillo de color: `(r*299 + g*587 + b*114) / 1000` → si > 180, tint claro y alpha `F0` (94%); si no, tint oscuro y alpha `D0` (82%).

### `GlassCard`

Card con compound API (`GlassCard.Header/Body/Footer`). En iOS aplica `GlassSurface` real; en Android/web es una card sólida con sombra (`shadows.md` por defecto). Usar para cards "premium" cuando se quiera dar protagonismo (no para cualquier card).

### `GlassFAB`

FAB de 56×56 con icono opcional + `label` opcional (lo convierte en pill). Resolución por plataforma:
- iOS: `GlassFAB.ios.tsx` con `GlassSurface` real
- Android/Web: `GlassFAB.tsx` con fondo sólido tintado + `shadows.lg`

## Animaciones

Tokens en `constants/animations.ts`:

```
durations  quick: 150 · base: 250 · slow: 300 · hero: 800
easings    standard (RN default) · cubic (contemplativo) · bouncy (celebración) · exit
```

| Patrón                  | Duración (token) | Driver | Notas                              |
| ----------------------- | ---------------- | ------ | ---------------------------------- |
| Toast show/hide         | slow (300ms)     | native | translateY + opacity               |
| Selection highlight     | base (250ms)     | native | Fade de fondo (SongListItem)       |
| Notification ping       | hero (800ms)     | native | Loop: scale 1→1.8 + opacity        |
| Splash (HelloWave)      | 900ms            | —      | 3 repeticiones                     |
| Contigo breathing       | 2100ms (custom)  | native | Cubic in-out, 3 ciclos, auto-skip  |
| CelebrationBurst        | hero + 100       | native | 12 partículas, stagger 18ms, bouncy|

- Siempre `useNativeDriver: true` para rendimiento.
- Para curvas custom usar `easings.*` antes de improvisar (cubic para contemplativo, bouncy para confirmaciones).
- UI general: durations.base/slow. Microinteracciones web/hover: durations.quick.

## Componentes clave

### Cards

- Fondo blanco (claro) / `#3A3A3C` (oscuro)
- Borde 1px semitransparente
- Sombra sutil (opacity 0.04–0.07)
- Border radius 14–18px
- Padding `md` (16px) + extras

### Botones

- **Primarios:** Sin estilo pill; radius 8px, texto medium (500)
- **Outlined:** Border 1.5px con color accent + 30% opacidad, radius 12px
- **Chips/Pills:** Radius 20px, fondo tintado (color + 10–15% opacidad)
- **FABs:** 56x56, circular (radius 28px), sombra prominente

### Toast

- Barra inferior, radius 12px, sombra fuerte (elevation 8)
- Colores Material Design estándar
- Icono + mensaje + botón cerrar
- Auto-dismiss a 4s con animación slide-up

### Badges

- "NUEVO": radius 6px, fondo accent al 15%, texto 9px weight 800, uppercase
- Calendar badge: radius 4px, fondo calColor al 18%, texto 8px

### Inputs

- Border radius 12px (AppFeedbackModal)
- Focus ring no definido globalmente

## Componentes UI compartidos (`components/ui/`)

Catálogo de componentes agnósticos de paleta, listos para usar en cualquier pantalla. La mayoría se extrajeron de `components/contigo/` para que el resto de la app aproveche sus patrones sin heredar la paleta cálida.

| Componente            | Para qué                                                                          |
| --------------------- | --------------------------------------------------------------------------------- |
| `GlassSurface`        | Capa glass (iOS) / fallback cross-platform — base de los demás Glass*             |
| `GlassCard`           | Card destacada (compound: Header/Body/Footer)                                     |
| `GlassHeader`         | Header con glass — iOS                                                            |
| `GlassFAB`            | FAB cross-platform — recibe `icon`, `label?`, `tintColor`                         |
| `GlassTabBarBackground` | Background del tab bar — iOS                                                   |
| `TopColorBar`         | Barra fina de color bajo el status bar — cross-platform                          |
| `ProgressRing`        | Anillo de puntos (sin SVG) — recibe `done/total/size/color`                       |
| `TeaserCard`          | Card con barra superior + kicker + título + preview con fade + CTA + done badge   |
| `StatCard`            | Tile compacto: icono · valor grande · label uppercase                             |
| `EmptyState`          | Placeholder canónico (icono/emoji + título + subtítulo + CTA opcional)            |
| `ScreenHero`          | Hero de pantalla (h0 + subtítulo + kicker + slot derecho)                         |
| `SectionHeader`       | Label uppercase + acción opcional                                                 |
| `PageContainer`       | Wrap con max-width centrado en web (no-op en native)                              |
| `CelebrationBurst`    | Burst de 12 partículas + emoji escalando — feedback positivo                      |
| `IconSymbol`          | Icono cross-platform (SF Symbols iOS / Material Android)                          |

Hook `useResponsive()` en `hooks/useResponsive.ts` complementa los componentes anteriores cuando se necesita lógica de layout responsive.

## Responsive

Tokens en `constants/breakpoints.ts`:

```
breakpoints           sm 640 · md 768 · lg 1024 · xl 1280
maxContentWidth       960  (pantallas internas)
maxContentWidthWide   1200 (Home / dashboards)
wideLayoutMinWidth    700  (legacy — usado en Home para activar 2 columnas)
```

Hook `useResponsive()` en `hooks/useResponsive.ts`:

```ts
const { width, isSm, isMd, isLg, isXl, isWide, isWeb } = useResponsive();
```

Patrones recomendados:
- **Pantallas internas con scroll** → envolver con `<PageContainer>` para centrar y limitar ancho en web.
- **Layouts de dos columnas** → activar cuando `isWeb && isMd` (ej. MasHomeScreen). Native mantiene una columna.
- **Hover/cursor** → `PressableFeedback` de HeroUI ya gestiona cursor en web.

## Plataforma

| Aspecto        | iOS                                  | Android/Web                                |
| -------------- | ------------------------------------ | ------------------------------------------ |
| Tab bar        | NativeTabs (liquid glass)            | Tabs tradicionales                         |
| Header         | GlassHeader → GlassSurface (glass)   | Solid header con TabHeaderColors           |
| FAB            | GlassFAB.ios → GlassSurface (glass)  | GlassFAB.tsx con fondo sólido + shadows.lg |
| Barra de color | TopColorBar.ios (4–8px under header) | TopColorBar.tsx (cross-platform)           |
| Card destacada | GlassCard → GlassSurface             | GlassCard con sombra elevada (sin glass)   |
| Iconos         | SF Symbols (via IconSymbol)          | MaterialIcons (via IconSymbol)             |
| Safe area      | edges: ['top']                       | Gestionado por sistema                     |
| Responsive     | Mobile portrait (sin breakpoints)    | Breakpoints sm/md/lg/xl activos en web     |

## Reglas

- Los colores de marca son institucionales — no saturar ni usar gradientes **fuera de Contigo**. Contigo es el único territorio donde se permiten gradientes cálidos (dorado, beige) y tipografía serif.
- El contraste debe ser alto: texto oscuro en fondos claros. Verificar en modo oscuro.
- Las sombras son sutiles en cards (opacity < 0.1), prominentes en toasts/FABs (`shadows.lg`) y hero (`shadows.xl`). Para cards destacadas con identidad usar `shadows.warm` o `shadows.cool` (tintadas).
- Glass morphism prefiere iOS (`GlassSurface.ios` con LiquidGlass/BlurView); Android tiene fondo sólido tintado, web usa `backdrop-filter`. Centralizado en `GlassSurface` — no replicar `isLiquidGlassAvailable()` en cada sitio.
- Los radios de borde son suaves (8–18px) para cards estándar, 22px para cards hero (`radii.xxl`), 999 (`radii.pillFull`) solo para badges circulares y citation pills, 28px (`radii.full`) para FABs.
- Las animaciones usan native driver y son discretas (250–300ms) en UI general. Bouncy reservado para `CelebrationBurst` y confirmaciones. Cubic para meditación/contemplativo. Usar tokens de `constants/animations.ts`.
- Fuente del sistema siempre para UI general. `typography.serif` (Palatino) solo en textos contemplativos largos dentro de Contigo.
- Respetar la escala de fuente (`fontScale`) multiplicando los tamaños base.
- En web envolver pantallas internas con `PageContainer` para evitar layouts edge-to-edge en desktop. Usar `useResponsive()` para layouts de dos columnas cuando aporten.
- Colores duros (magic numbers) NO se permiten — siempre via tokens (`constants/colors.ts`, `StateColors`, `EmotionColors`, `FeedbackCategoryColors`, `TabHeaderColors`). Las sombras tintadas con un color dinámico (ej. `item.tintColor`) son la excepción aceptada.
