# MCM App — Design System

## North Star: "Institucional Cálido"

Serio pero cercano. Colores institucionales claros sobre fondos blancos, tipografía del sistema legible, esquinas redondeadas suaves y efectos glass en iOS. Diseñado para una comunidad religiosa: transmitir confianza y orden sin perder calidez.

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

## Tipografía

- **Fuente:** Sistema nativo (San Francisco en iOS, Roboto en Android). No se usa fuente custom para UI.
- **Fuente monoespaciada:** SpaceMono-Regular (solo para código/acordes).
- **Iconos:** MaterialIcons (`@expo/vector-icons`), SF Symbols en iOS.

| Nivel   | Tamaño | Peso   | Uso                       |
| ------- | ------ | ------ | ------------------------- |
| h1      | 28px   | bold   | Títulos de pantalla       |
| h2      | 22px   | 600    | Subtítulos, secciones     |
| body    | 16px   | normal | Texto general             |
| caption | 13px   | normal | Texto auxiliar, metadatos |
| button  | 15px   | 500    | Botones, labels de acción |

- El sistema soporta escala de fuente (`fontScale`) que multiplica los tamaños base.
- Peso extra-bold (`800`) se usa en labels de sección, badges y el logo.
- `letterSpacing` negativo (`-0.4`) en el logo text; positivo (`0.3`–`1.0`) en labels uppercase.

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

El sistema usa radios redondeados suaves, no pill-shaped:

| Token        | Valor | Uso                         |
| ------------ | ----- | --------------------------- |
| `radii.xs`   | 4px   | Badges pequeños             |
| `radii.sm`   | 8px   | Botones, inputs             |
| `radii.md`   | 12px  | Toasts, modales, date boxes |
| `radii.lg`   | 14px  | Cards de contenido, eventos |
| `radii.xl`   | 18px  | Cards destacadas (Home)     |
| `radii.pill` | 20px  | Chips, pills de acción      |
| `radii.full` | 28px  | FABs, icon circles (56x56)  |

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

| Token        | iOS (opacity/radius) | Android     | Uso                         |
| ------------ | -------------------- | ----------- | --------------------------- |
| `shadows.sm` | 0.06 / radius 3      | elevation 1 | Cards de contenido, eventos |
| `shadows.md` | 0.12 / radius 6      | elevation 3 | Cards elevadas, paneles     |
| `shadows.lg` | 0.3 / radius 8       | elevation 8 | Toasts, FABs, overlays      |

Nota: algunos componentes legacy aún usan sombras inline. SettingsPanel usa `shadowColor: primary (#253883)` — sombra tintada.

### Sombra de texto

```
textShadowColor:  rgba(0, 0, 0, 0.5)
textShadowOffset: {0, 1}
textShadowRadius: 2
```

## Glass Morphism (iOS)

Efecto exclusivo de iOS, con dos niveles:

### LiquidGlass (iOS 18+)

- Usa `expo-glass-effect` con `GlassView`
- `glassEffectStyle: "regular"`
- Background con opacidad dinámica:
  - Colores claros (brightness > 180): `color + F0` (94%)
  - Colores oscuros: `color + D0` (82%)

### BlurView (iOS < 18, fallback)

- `expo-blur` con `BlurView`
- `tint: "light"` o `"dark"` según brillo del color
- `intensity: 80` (oscuro) a `100` (claro)

### Tab bar glass

- `GlassView` con `glassEffectStyle: "clear"`
- Fallback: `BlurView` con `tint: "systemChromeMaterial"`, `intensity: 100`

### Separador glass

- Borde inferior `hairlineWidth` con `rgba(0, 0, 0, 0.1)`

## Animaciones

| Patrón              | Duración | Driver | Notas                       |
| ------------------- | -------- | ------ | --------------------------- |
| Toast show/hide     | 300ms    | native | translateY + opacity        |
| Selection highlight | 250ms    | native | Fade de fondo               |
| Notification ping   | 800ms    | native | Loop: scale 1→1.8 + opacity |
| Splash (HelloWave)  | 900ms    | —      | 3 repeticiones              |

- Siempre `useNativeDriver: true` para rendimiento.
- No se usan curvas de easing custom; se usa el default de React Native (`easeInOut`).

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

## Responsive

- Breakpoint: `windowWidth >= 700` → layout de dos columnas
- Max-width contenido: `900px` centrado
- Padding wide: `24px` (spacing.lg)
- Layout: `flexDirection: 'row'` con `gap: 24px`

## Plataforma

| Aspecto        | iOS                        | Android/Web            |
| -------------- | -------------------------- | ---------------------- |
| Tab bar        | NativeTabs (liquid glass)  | Tabs tradicionales     |
| Header         | GlassHeader con blur/glass | Header estándar        |
| FAB            | GlassFAB con BlurView      | FAB con elevation      |
| Barra de color | TopColorBar (4–8px)        | No se muestra          |
| Iconos         | SF Symbols                 | MaterialIcons          |
| Safe area      | edges: ['top']             | Gestionado por sistema |

## Reglas

- Los colores de marca son institucionales — no saturar ni usar gradientes.
- El contraste debe ser alto: texto oscuro en fondos claros. Verificar en modo oscuro.
- Las sombras son sutiles en cards (opacity < 0.1), solo prominentes en toasts/FABs.
- Glass morphism es exclusivo de iOS; Android/Web usan fondos sólidos.
- Los radios de borde son suaves (8–18px) para cards, circulares solo para FABs e iconos.
- Las animaciones usan native driver y son discretas (250–300ms). Nada bouncy.
- Fuente del sistema siempre — no cargar fuentes custom para UI general.
- Respetar la escala de fuente (`fontScale`) multiplicando los tamaños base.
