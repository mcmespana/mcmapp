# Plan de unificación de UI + componentes nativos

> Objetivo: que todas las pantallas compartan el mismo estilo y usen, donde se
> pueda, componentes **nativos de iOS/Android** (headers, búsqueda, botones de
> barra con liquid glass) en vez de reimplementaciones custom que "van cada una
> a su bola". Fecha de análisis: 2026-06-20.

## 1. Diagnóstico (con evidencia del código)

Hoy conviven **varios sistemas en paralelo**. Conteos reales sobre `app/` +
`components/`:

### 1.1. Headers — 3 paradigmas distintos

| Paradigma | Dónde | Nativo |
| --- | --- | --- |
| Header **nativo** (`native-stack`) | Cantoral (`cancionero.tsx`), `SongListScreen` (con large title + search nativos), Oración, Evangelio | ✅ |
| **Floating glass custom** (hecho a mano) | Contigo (revisión, bookmarks, índice), eventos (`GlassHeader.ios`) | ❌ |
| `headerShown:false` + cabecera propia | `index` (Inicio), `mas`, `SongDetail`, `eventStackScreens` | ❌ |

→ 9 pantallas con `headerShown:false`. Resultado: el back/título/acciones se
ven y se comportan distinto en cada zona. Solo el cantoral (y lo ya convertido)
tiene el efecto liquid-glass real de iOS 26.

### 1.2. Primitivas de botón — 4 mezcladas

| Primitiva | Nº de ficheros |
| --- | --- |
| `TouchableOpacity` (RN) | 52 |
| `Pressable` (RN) | 38 |
| `Button` (heroui) | 21 |
| `PressableFeedback` (heroui) | 24 |

→ No hay una convención. Cada pantalla elige una, con feedback de pulsación
distinto (unas con opacidad, otras con highlight, otras nada). Ninguna en el
cuerpo es "nativa" (eso es imposible para contenido), pero **deberían compartir
un único componente** para sentirse iguales.

### 1.3. Inputs de texto — todo RN crudo

- `TextInput` (RN): **14 ficheros**.
- `TextField` (heroui): **0**.

→ Búsquedas, formularios y modales usan `TextInput` pelado con estilos
repetidos. La búsqueda del cantoral ya es **nativa** (`headerSearchBarOptions`);
el resto no.

### 1.4. Paletas de color fragmentadas (esto es lo que más "va a su bola")

- **Marca** (`constants/colors.ts`): 66 referencias.
- **Contigo** tiene su **propia paleta "warm"** (cremas/beige) — no usa los
  colores de marca salvo puntualmente. Es un tema devocional aparte.
- **Eventos** derivan el color **por evento** (`tintColor` de cada evento).

→ Tres sistemas de color coexistiendo. Contigo y Eventos divergen del resto a
propósito, pero **no hay una regla** que diga cuándo se permite divergir.

### 1.5. Tokens de diseño infrautilizados

- Existen tokens: `colors.ts`, `spacing.ts`, `typography.ts`, `uiStyles.ts`
  (`radii`, `shadows`).
- Pero **69 ficheros hardcodean `borderRadius`** y solo **44** importan el token
  `radii`. Igual con spacing/colores.

→ Los tokens están, pero no se respetan, así que cada pantalla reinventa
medidas y radios.

### 1.6. Poco uso de lo NATIVO (iOS y Android)

Más allá de los headers, apenas se usan APIs nativas que darían consistencia y
el look del sistema gratis:

- **Búsqueda nativa** (`headerSearchBarOptions`): solo en cantoral (recién
  puesto).
- **Large title nativo**: solo cantoral.
- **Bar button items** (con liquid glass): solo headers ya convertidos.
- **Switch nativo**: se evita por un bug de heroui en modales (ver CLAUDE.md) →
  toggles custom.
- **Menús contextuales nativos** (long-press), **section lists nativas**,
  **pull-to-refresh nativo**, **`Menu`/`ActionSheet` nativos**: prácticamente sin
  usar; se reimplementan con modales/bottom-sheets custom.
- La **tab bar** sí es nativa en iOS (`NativeTabs`). Bien.

---

## 2. Plan por fases (priorizado por impacto/riesgo)

> Regla para todas las fases: **pantalla a pantalla**, verificando en el
> dispositivo antes de pasar a producción (no a ciegas), porque muchos headers
> custom son diseños deliberados y convertirlos puede perder identidad.

### Fase 1 — Headers nativos unificados (en curso, mayor impacto visible)

Convertir los `headerShown:false` a header nativo de `native-stack` (back +
título + acciones como bar items → liquid glass en iOS 26). Ya hecho: cantoral
(base + búsqueda), Oración, Evangelio.

- **Falta**: Revisión, Favoritos e índice de Contigo; sub-pantallas de eventos
  (Horario, Materiales, Grupos…) y `EventHomeScreen`; `MasHome`; barra superior
  de Inicio.
- **Decisión de producto**: el "floating glass" de Contigo/eventos es un diseño
  hecho a propósito. Hay que decidir por pantalla: ¿header nativo plano (más
  consistente) o conservar el flotante (más identidad)? Mi recomendación:
  nativo en las que son "lista + detalle" (Revisión, Materiales, Horario…) y
  conservar flotante solo donde el diseño aporta (hero de evento).
- **Nota Inicio**: el grid de tarjetas **no** puede ser nativo (es contenido de
  diseño); solo su barra superior.
- Esfuerzo: medio-alto (muchas pantallas). Riesgo: medio (verificar visual).

### Fase 2 — Unificación de componentes (censo del 2026-06-21)

Censo real (`app/` + `components/`):

| Categoría | Hoy | Problema |
| --- | --- | --- |
| Pulsables | `TouchableOpacity` 52 · `Pressable` 38 · heroui `Button` 21 · `PressableFeedback` 24 | 4 primitivas mezcladas → feedback distinto |
| Inputs | `TextInput` crudo 14 · heroui `TextField` 0 | cada uno reinventa estilo |
| Overlays | `Modal` RN 30 · `BottomSheet` 29 | dos sistemas para lo mismo |
| Toggles | 13 custom (por el bug del `Switch` heroui en modales) | inconsistentes |

**Plan (por lotes revertibles, validando en dispositivo):**

1. **`AppIconButton`** (nuevo) — botón-icono con la **cápsula** estándar (el look
   glass de los headers). Unifica botones de acción sueltos. **Resuelve el
   "Inicio híbrido"**: los botones de Inicio pasan a usarlo manteniendo la
   animación del badge.
2. **Convención de pulsación**: contenido → `PressableFeedback` (heroui); barras
   de navegación → bar items nativos. Prohibido `TouchableOpacity`/`Pressable`
   sueltos nuevos. Migración incremental de los existentes.
3. **`AppTextField`** (nuevo) — envuelve `TextInput` con tokens
   (`radii`/`spacing`/colores). Migrar los 14 usos.
4. **Búsqueda nativa** (`headerSearchBarOptions`) extendida a otras listas (ya en
   cantoral).
5. **Overlays** (fase posterior, mayor riesgo): converger 30 `Modal` + 29
   `BottomSheet` hacia el `BottomSheet`/`Dialog` de heroui. Revisar el bug del
   `Switch` antes de tocar toggles.

- Esfuerzo: alto (90+ ficheros) pero mecánico e incremental. Riesgo: bajo-medio.
- Orden sugerido: (1) `AppIconButton` + Inicio híbrido → (3) `AppTextField` →
  (2) migración pulsables → (5) overlays.

### Fase 3 — Inputs y búsqueda nativos/consistentes

- Búsqueda: extender `headerSearchBarOptions` a otras listas que hoy filtran con
  `TextInput` custom.
- Formularios/modales: crear un `AppTextField` único (envuelve `TextInput` con
  los tokens) y migrar los 14 usos sueltos.
- Esfuerzo: medio. Riesgo: bajo.

### Fase 4 — Sistema de color: decidir y unificar

- Decisión de producto (necesito tu input): ¿Contigo y Eventos **deben** seguir
  la paleta de marca, o su identidad propia (warm / color por evento) es
  intencional y se queda?
- Si se unifica: mover la paleta "warm" y los `tintColor` de eventos a
  `constants/colors.ts` como **temas con nombre** (no colores sueltos), para que
  toda divergencia sea explícita y reutilizable.
- Esfuerzo: medio. Riesgo: bajo-medio.

### Fase 5 — Enforcement de tokens

- Refactor para usar `radii`/`spacing`/`typography` en vez de números mágicos,
  y (opcional) regla de ESLint que avise de `borderRadius`/`padding` hardcoded.
- Esfuerzo: alto pero incremental. Riesgo: muy bajo.

---

## 3. Orden recomendado

1. **Fase 1** (headers) — es lo que más se nota y ya está empezado.
2. **Fase 2** (primitiva única de botón) en paralelo, incremental.
3. **Fase 3** (inputs/search).
4. **Fase 4** (color) — necesita decisión de producto antes.
5. **Fase 5** (tokens) — continuo, de fondo.

## 3.bis. Inventario por pantalla (Fase 1) — revisión del 2026-06-20

Tras revisar el código una a una, **no todas las cabeceras son convertibles "a
ciegas"**: muchas llevan funcionalidad propia (steppers de fecha, campanas,
acciones de evento). Clasificación:

| Pantalla | Estado | Tipo de cabecera | Acción |
| --- | --- | --- | --- |
| Cantoral base (`CategoriesScreen`) | ✅ hecho | nativa: título pequeño + 2 bar items cristal | — |
| Dentro de categoría (`SongListScreen`) | ✅ hecho | nativa + búsqueda nativa (`__ALL__`) | — |
| Oración | ✅ hecho | nativa (back + título) | — |
| Evangelio | ✅ hecho | nativa (back + guardar/ajustes) | — |
| **Favoritos** (`bookmarks`) | ✅ hecho | nativa (back + título; contador al cuerpo) | — |
| **Revisión** (`revision`) | ✅ hecho | navegador de fechas (‹ día ›) como **título custom dentro de la barra nativa** + cerrar nativo | — |
| **Índice de Contigo** (`index`) | ✅ hecho | título pequeño nativo "Contigo" + badge litúrgico y favoritos en headerRight; fecha al cuerpo | — |
| **EventHomeScreen** | ✅ hecho | header nativo (back nativo) + **campana SIEMPRE en el hero** (consistente entre Jubileo y Visita Papa) + auto-suscripción opt-out | — |
| Sub-pantallas de evento (Horario, Materiales, Grupos, Visitas, Contactos, Profundiza…) | ✅ ya eran nativas | `eventScreenOptions` + `GlassHeader` de fondo. Back ahora **nativo** (sin cápsula doble) + solo icono | — |
| **Inicio** (`index`) | ✅ híbrido | barra superior con `GlassActionGroup` (cápsula glass, campana animada intacta) + grid | El grid NO es nativo (contenido de diseño). |
| `MasHome` | ⏸️ dashboard (custom) | `ScreenHero` "Más" | Beneficio bajo; se mantiene. |
| **Calendario** | ✅ hecho | stack con header nativo **transparente** + "Calendario" + botón calendarios en headerRight | — |
| **Eventos Pasados** | ✅ hecho | header transparente (stack de Más) + texto legible en oscuro | — |
| **Canción** (`SongDetail`) | ✅ hecho | header nativo transparente (heredado) + **letra full-bleed** que scrollea bajo el header; FAB glass | Pulido fino del glass pendiente (ver TODO). |
| Sub-pantallas de evento (hero) | ⏸️ pendiente | "floating header" opaco (`FloatingHeaderBackground`) | Transparentes como el cantoral = cambio mayor (cada hero su inset). Ver TODO. |

> **Conclusión (2026-06-21)**: Fase 1 prácticamente completa. Queda **pulido fino
> del glass de iOS 26** (con dispositivo delante) y, si se quiere, unificar los
> headers "floating" de evento. El grueso pendiente es la **Fase 2 (componentes)**.

## 5. Fase 2 — cola de trabajo (componentes ya creados y por crear)

Ya creados (reutilizar): `GlassActionGroup`, `AppIconButton`, `AppTextField`,
`EmptyState`, `ScreenHero`.

- [ ] Migrar los **~13 `TextInput`** restantes a `AppTextField` (hecho:
      SuggestSongModal). Lote a lote: AppFeedbackModal, ReportBugsModal,
      SuggestSong (✓), CodeInput, PasswordPrompt, Arrangement, Evaluation,
      Grupos, Reflexiones, Revisión, SelectedSongs, SecretPanel (admin, último).
- [ ] **`AppPrimaryButton`** (CTA "Enviar/Guardar/Aceptar") — ~10 modales cada
      uno con su botón. Crear y migrar.
- [ ] **`SegmentedControl`** — unificar Mes/Agenda (Calendario), toggles de
      ajustes, Evangelio, SongFullscreen (4-5 versiones distintas).
- [ ] **`EmptyState`** — adoptarlo en los ~20 sitios que reinventan "no hay…".
- [ ] **Chips/pills** — estandarizar (mezcla de heroui `Chip` + pills custom).
- [ ] **Tokens** (`radii`/`shadows`/`typography`) — migrar números mágicos.

## 4. Decisiones de producto pendientes (bloquean algunas fases)

- [ ] ¿Contigo y Eventos mantienen su paleta propia o se alinean a marca? (Fase 4)
- [ ] ¿Qué pantallas de Contigo/eventos pasan a header nativo plano y cuáles
      conservan el floating glass? (Fase 1)
- [ ] ¿Componente estándar de pulsación: `PressableFeedback` (heroui) o wrapper
      propio? (Fase 2)
