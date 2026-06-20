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

### Fase 2 — Una sola primitiva de pulsación

Elegir **un** componente estándar (propuesta: `PressableFeedback` de heroui, o
un wrapper propio `AppPressable`) y migrar los `TouchableOpacity`/`Pressable`
sueltos a él, para que todo el feedback de pulsación sea idéntico.

- Empezar por un `AppButton`/`AppIconButton` compartido y usarlo en cabeceras y
  tarjetas.
- Esfuerzo: alto (52+38 ficheros), pero mecánico e incremental. Riesgo: bajo.

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
| **Revisión** (`revision`) | ⚠️ funcional | **navegador de fechas** (cerrar + ‹ día ›) | NO convertir a ciegas: el stepper de fecha es funcional. Requiere diseño (¿fecha como título + ‹›?) y verificación visual. |
| **Índice de Contigo** (`index`) | ⚠️ dashboard | título grande "Contigo" + fecha + badge litúrgico + bookmarks | Es un **dashboard** (como Inicio). Header nativo perdería el título cálido + fecha. Decidir si merece la pena. |
| **EventHomeScreen** | ⚠️ funcional | **campana de suscripción** (opt-in a eventos) | NO romper: la campana es la feature nueva de notificaciones. Hero del evento = diseño con identidad. Conservar flotante o mover campana a bar item con cuidado. |
| Sub-pantallas de evento (Horario, Materiales, Grupos, Visitas, Contactos, Profundiza…) | ⏳ pendiente | `GlassHeader.ios` compartido | Conversión **centralizada** posible (vía `eventStackScreens`), pero verificar. Candidatas a nativo (son lista/detalle). |
| **Inicio** (`index`) | ⚠️ dashboard | barra superior: **campana notificaciones** + ajustes + grid de colores | El grid NO puede ser nativo (contenido). Solo la barra superior, y lleva la campana de notificaciones (funcional). |
| `MasHome` | ⏳ pendiente | `headerShown:false` + cabecera propia | Revisar; lleva navegación a eventos. |

> **Conclusión**: las "conversiones limpias" (back + título simple) ya están casi
> todas hechas. Lo que queda son **cabeceras con función** (steppers, campanas,
> acciones) o **dashboards** (Inicio, índice Contigo). Esas **no** se deben
> convertir a ciegas: o se conserva su diseño, o se rediseñan con verificación
> visual pantalla a pantalla. Hacerlo "del tirón" a producción degradaría
> funcionalidad.

## 4. Decisiones de producto pendientes (bloquean algunas fases)

- [ ] ¿Contigo y Eventos mantienen su paleta propia o se alinean a marca? (Fase 4)
- [ ] ¿Qué pantallas de Contigo/eventos pasan a header nativo plano y cuáles
      conservan el floating glass? (Fase 1)
- [ ] ¿Componente estándar de pulsación: `PressableFeedback` (heroui) o wrapper
      propio? (Fase 2)
