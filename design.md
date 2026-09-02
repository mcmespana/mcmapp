---
title: MCM — design.md
purpose: Guía autoritativa de diseño para agentes que construyen interfaz en el ecosistema MCM.
scope: mcmapp (manda) · mcmpanel (territorio propio, ver §9)
audience: agentes IA. Las personas también pueden leerlo, pero está escrito para que un agente lo cargue entero antes de tocar UI.
authority: Este archivo manda sobre el criterio propio del agente. Los tokens del código mandan sobre este archivo.
---

# design.md — Sistema de diseño MCM para agentes

Esto no es un catálogo. El catálogo exhaustivo (todos los valores, todos los
componentes) es [`docs/desarrollo/DESIGN.md`](docs/desarrollo/DESIGN.md), y
describe **lo que hay**. Este archivo prescribe **lo que haces**: el criterio,
el orden de prioridad, los antipatrones y la API aprobada.

Léelo entero antes de escribir la primera línea de UI. No lo hojees.

---

## 1. Tu trabajo

Estás construyendo para una comunidad religiosa. Quien usa esto abre la app en
un banco de iglesia, en un autobús camino de un encuentro, con una mano y a
contraluz. No es un dashboard de métricas ni una landing de producto.

El resultado tiene que leerse como **institucional cálido**: serio pero
cercano. Orden y confianza sin frialdad; calidez sin infantilismo.

Tres cosas se notan antes que ninguna otra y son las que decides primero:

1. **Que se lea.** Contraste alto, tamaño real, jerarquía obvia a un metro.
2. **Que se reconozca.** Los colores de marca y las formas ya existentes; nada
   de identidad nueva inventada por el camino.
3. **Que se sienta del sistema.** iOS parece iOS, Android parece Android. La
   app no impone su propio lenguaje de interacción sobre el del teléfono.

Lo demás —densidad, decoración, efectos— viene después y cede el sitio.

### Orden de prioridad cuando algo entra en conflicto

Cuando dos requisitos chocan, protege en este orden y sacrifica de abajo arriba:

1. **Legibilidad y accesibilidad.** Contraste, `fontScale`, área táctil ≥44 pt,
   `accessibilityLabel`. Nunca se sacrifica.
2. **Paridad de comportamiento entre plataformas.** Que iOS, Android y web
   hagan lo mismo, aunque no se vean idénticos.
3. **Tokens existentes.** Antes de un valor nuevo, siempre uno que ya existe.
4. **Coherencia con la pantalla vecina.** Copiar el patrón de al lado gana a
   inventar uno mejor en solitario.
5. **Identidad del territorio** (§2).
6. **Refinamiento visual.** Sombras, glass, gradientes, microanimación.

Si para conseguir el 6 tienes que romper el 3, no lo haces: dejas el
refinamiento fuera y lo anotas en
[`docs/planes/PLAN_DISENO.md`](docs/planes/PLAN_DISENO.md).

### Pregunta antes de seguir solo si

- El cambio introduce un **color, una fuente o una forma que no existe** en los
  tokens y no es reconducible a ninguno.
- El cambio altera la **identidad de un territorio** (llevar la paleta cálida
  fuera de Contigo, o la institucional dentro).
- El cambio **rompe un contrato de datos** con el panel o con Firebase.

Todo lo demás lo decides tú con este documento. Una pregunta agrupada es mejor
que cinco sueltas; ninguna pregunta es mejor que una que este archivo ya
responde.

---

## 2. Territorios

La app **no es una sola paleta**. Son tres territorios con tokens compartidos y
paletas distintas, y la divergencia es deliberada — está decidida y cerrada
(`PLAN_UI_NATIVA.md` §4, 2026-07-22). No la "corrijas".

| Territorio        | Dónde                                          | Paleta                                                   | Señas                                                                  |
| ----------------- | ---------------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------- |
| **Institucional** | Todo lo demás                                  | `brand` + `TabHeaderColors`                              | Fondos blancos, azul MCM, radios 8–18, sombras sutiles                 |
| **Contigo**       | `app/(tabs)/contigo/*`, `components/contigo/*` | `WARM_LIGHT`/`WARM_DARK` (`components/contigo/theme.ts`) | Dorado y beige, radios 20–22, gradientes permitidos, serif en lecturas |
| **Evento**        | Pantallas de un evento concreto                | `tintColor` del propio evento (`constants/events.ts`)    | Estructura institucional, acento del evento                            |

**Regla dura:** lo compartido son la **estructura y los tokens no cromáticos**
—spacing, radios, sombras, glass, tipografía, animación, componentes de
`components/ui/`—. Lo **no** compartido es el color.

- El resto de la app **no adopta** el dorado de Contigo. Sí adopta sus patrones
  (cards hero, `ProgressRing`, `TeaserCard`, `CelebrationBurst`).
- Contigo **no adopta** el azul institucional en su superficie propia.
- Un componente de `components/ui/` es agnóstico de paleta **por contrato**:
  recibe el color por prop (`tintColor`, `accentColor`, `color`). Si te ves
  metiendo un color de marca dentro de un componente de `ui/`, es que has
  elegido mal el sitio.

---

## 3. Color

### La fuente de verdad es el código, no esta tabla

```
mcm-app/constants/colors.ts          brand, Colors (light/dark), UIColors, TabHeaderColors,
                                     ToastColors, StateColors, SwipeColors, KeyPillColors,
                                     EmotionColors(+Soft), FeedbackCategoryColors
mcm-app/components/contigo/theme.ts  WARM_LIGHT / WARM_DARK / HABITS   ← excepción sancionada
mcm-app/global.css                   variables CSS de HeroUI/uniwind (capa web/className)
```

**Nunca inventes, alias ni redeclares un token.** Si necesitas un color que no
está, el trabajo es añadirlo a `constants/colors.ts` con nombre semántico y
comentario — no escribir el hex en el componente.

Los hex que aparecen en `docs/desarrollo/DESIGN.md` son documentación. Si el
código y el documento discrepan, **manda el código** y arreglas el documento.

### Marca: es una paleta cromática, no semántica

`brand` son **los colores del logo**, y se llaman por su color:
`#253883` primary (azul MCM) · `#95d2f2` secondary · `#E15C62` accent (rojo MIC) ·
`#31AADF` info · `#A3BD31` green (verde COM) · `#FCD200` yellow (amarillo COM) ·
`#9D1E74` purple (morado LC) · `#002B81` text (azul COM).

**El estado no está aquí.** Éxito, error y aviso viven donde significan eso:
`ToastColors` (Material, para toasts) y `SwipeColors` (Apple, para el swipe).
Cada uno en su contexto; no los mezcles — un toast usa `ToastColors`, punto.

Por qué importa: hasta agosto de 2026 el verde se llamaba `success` y el
amarillo `warning`, y se usaban por su nombre… para pintar la pantalla de
Reflexiones y las estrellas de valoración. `brand.danger` era morado. Ahora hay
un test que impide volver a llamar `success` a un color de marca.

Son colores institucionales heredados, no una paleta de producto. **No los
saturas, no los degradas, no los mezclas** fuera de Contigo.

### ⚠️ La trampa que queda: `global.css` no es tu vocabulario

`mcm-app/global.css` define ~70 variables CSS. **Sus nombres son el contrato de
HeroUI, no el nuestro**, y no significan lo mismo:

- `--accent` es el **azul primary**, no `brand.accent` (el rojo).
- `--danger` es el **rojo MIC**, no un morado.

Así que `className="bg-danger"` te da el rojo, y `colors.purple` te da el
morado. Comprueba en qué capa estás antes de nombrar un color. Los **valores**
sí salen de `constants/colors.ts`, y `__tests__/designTokens.test.ts` comprueba
que no se desincronizan.

### Roles por modo

`themeColors(isDark)` resuelve la capa de roles, igual que `warm(isDark)` en
Contigo: `text`, `textStrong`, `textSecondary`, `textMuted`, `link`,
`background`, `backgroundSunken`, `card`, `separator`, `icon`.

**Úsalos.** Un `isDark ? '#F5F5F7' : '#1C1C1E'` escrito a mano es exactamente lo
que llenó la app de 1.363 hex literales: se copia, y al copiarse deriva.

Si de verdad necesitas un gris concreto y no un rol, está `SystemGray` (los seis
de Apple, en sus dos modos).

### Modo oscuro

**Los colores de marca no tienen variante oscura**: se usan tal cual, así que el
contraste hay que comprobarlo a mano. Contigo sí tiene su par completo.

Todo lo que escribas se comprueba en los dos modos. Un color que solo se define
dentro de una rama `isDark` es un bug esperando.

---

## 4. Tipografía

Fuente del **sistema** siempre (San Francisco / Roboto). No hay fuente de marca
y no se añade ninguna. `SpaceMono` solo para acordes y código. `typography.serif`
(Palatino) **solo** para lectura contemplativa larga dentro de Contigo.

Escala en `constants/typography.ts` — úsala en vez de `fontSize` suelto:

| Token      | px  | Peso | Para                                           |
| ---------- | --- | ---- | ---------------------------------------------- |
| `h0`       | 34  | 800  | Hero de pantalla. Uno por pantalla, como mucho |
| `h1`       | 28  | bold | Título de pantalla                             |
| `h2`       | 22  | 600  | Sección                                        |
| `body`     | 16  | —    | Texto                                          |
| `caption`  | 13  | —    | Metadato, ayuda                                |
| `button`   | 15  | 500  | Acción                                         |
| `overline` | 10  | 600  | Kicker uppercase, tracking 0.5                 |

Reglas de peso (hoy inconsistentes en el código; esta es la dirección):
**800 solo en `h0`, kickers y badges. 700 en títulos de card. 600 en secciones.
500 en acciones. Normal en cuerpo.** Nada por debajo de `caption` para texto que
haya que leer de verdad.

`fontScale` se respeta multiplicando los tamaños base — no lo ignores ni lo
capes por debajo de ×1.3.

---

## 5. Medida, forma y profundidad

**Spacing** — escala de 5, sin valores intermedios:
`xs 4 · sm 8 · md 16 · lg 24 · xl 32`. Padding horizontal de página = `md`.
Separación entre bloques = `lg`. Si necesitas 10 o 20, estás compensando otro
error de layout.

**Radios** (`radii` en `constants/uiStyles.ts`), alineados a la misma rejilla de
4 px que el spacing: `xs 4` badges · `sm 8` botones, inputs y controles ·
`md 12` modales, toasts y sheets · `lg 16` cards de contenido · `xl 20` cards
destacadas, chips y heroes · `full 28` FABs · `pillFull 999` **solo** badges
circulares.
Elige de la lista. Un `borderRadius: 18` es una respuesta incorrecta.

**Sombras** (`shadows`) — se llaman por su función, y el nombre sí dice la
intensidad: `card` < `raised` < `hero` < `overlay`. Más `warm`/`cool`, tintadas,
para destacar sin subir peso.

Sombra de card por encima de opacity 0.1 = mal. Sombra de color solo vía
`warm`/`cool`, o tintada con un color dinámico del propio contenido (esa es la
única excepción aceptada a "nada de colores duros", junto con el blanco y el
negro puros).

**Foco** (`focusRing`): 2 px en `brand.info`. El foco **no puede distinguirse
solo por color** — con teclado, en web y en iPad, hace falta que se vea el
grosor.

---

## 6. Glass, plataforma y movimiento

**Glass** está centralizado en `components/ui/GlassSurface(.ios).tsx`. Todo lo
demás (`GlassHeader`, `GlassFAB`, `GlassCard`, `GlassTabBarBackground`) delega
en él. **No vuelvas a llamar a `isLiquidGlassAvailable()` en un componente
nuevo**; no repliques la cascada iOS 18 / BlurView / backdrop-filter / sólido.
Android no emula blur: fondo sólido tintado y ya.

**Nativo antes que custom.** En este orden: API nativa del sistema → componente
de `components/ui/` → componente de `heroui-native` → algo tuyo. Header nativo,
large title nativo, `headerSearchBarOptions`, menú contextual nativo,
pull-to-refresh nativo. Un header custom solo donde aporte identidad (hero de
evento), no por costumbre.

**Pulsación**: `PressableFeedback` de heroui. `TouchableOpacity` y `Pressable`
sueltos **nuevos** están prohibidos (decisión cerrada, `PLAN_UI_NATIVA.md` §4).

**Movimiento** — tokens en `constants/animations.ts`:
`quick 150` microinteracción · `base 250` UI · `slow 300` toast y modal ·
`hero 800` loops. Curvas: `motionEasings.out` por defecto, `inOut` para morph,
`sheet` para sheets. Muelles (`springs`) siempre que haya intervenido un dedo:
un muelle conserva la velocidad del gesto, una curva la reinicia.
**Nunca `ease-in` en algo que entra.** Siempre native driver. Bouncy solo para
celebración.

---

## 7. Componentes: la API aprobada

Antes de escribir un componente, busca aquí. Reinventar uno de estos es un
error de revisión, no una preferencia.

| Necesitas                  | Usa                                                           |
| -------------------------- | ------------------------------------------------------------- |
| Capa glass                 | `GlassSurface`                                                |
| Card destacada             | `GlassCard` (compound Header/Body/Footer)                     |
| Card estándar              | Card local con `radii.lg` + `shadows.sm`                      |
| Card con preview y CTA     | `TeaserCard`                                                  |
| Hero de pantalla           | `ScreenHero`                                                  |
| Cabecera de sección        | `SectionHeader`                                               |
| Métrica compacta           | `StatCard`                                                    |
| Progreso circular          | `ProgressRing`                                                |
| "No hay nada aquí"         | `EmptyState` — **siempre**, ~20 sitios lo reinventan          |
| Campo de texto             | `AppTextField` (props `error`, `accentColor`)                 |
| CTA principal              | `AppPrimaryButton` (prop `color`)                             |
| Botón de icono             | `AppIconButton`                                               |
| Grupo de acciones en barra | `GlassActionGroup`                                            |
| Segmentado / toggle        | `SegmentedControl`                                            |
| FAB                        | `GlassFAB`                                                    |
| Barra de color de tab      | `TopColorBar` / `TabTintBar`                                  |
| Ancho máximo en web        | `PageContainer`                                               |
| Icono                      | `IconSymbol` (SF Symbols en iOS, Material en Android)         |
| Feedback positivo          | `CelebrationBurst`                                            |
| Layout responsive          | hook `useResponsiveLayout()` — **es el único**, no crees otro |

Componentes de `components/ui/` reciben color por prop. Si el tuyo necesita
saber en qué territorio está, va mal diseñado.

**Pantalla ancha** (web y tablet): pantallas internas dentro de
`PageContainer`. Dos columnas con el `isWide` de `useResponsiveLayout()`
(≥ 720). Los cortes salen de `constants/breakpoints.ts` — no escribas un
número de ancho a mano, y no te hagas un `WIDE_BREAKPOINT` propio: ya pasó.

---

## 8. Rechaza los reflejos del diseño generado

Esto es lo que un modelo produce por defecto y aquí no se envía:

- **Gradientes decorativos** y glows fuera de Contigo. El azul MCM es plano.
- **Emoji como iconografía** de UI. Iconos vía `IconSymbol`.
- **Cards dentro de cards.** Un nivel de superficie por bloque.
- **Rejilla de tarjetas genérica** como respuesta a cualquier pantalla, sin
  jerarquía ni contenido que la justifique.
- **Filas de métricas** que repiten el mismo tile cuatro veces porque queda
  bonito, no porque haya cuatro datos que importen.
- **Texto gris pequeño** para prosa importante. Si merece leerse, es `body`.
- **Uppercase con tracking** fuera de `overline`.
- **Un color nuevo "que pega mejor"**. Si no está en `constants/colors.ts`, no
  existe.
- **Sombras ornamentales** y bordes de 2px+ para "separar". Un hairline separa.
- **Animaciones de entrada encadenadas** en listas. Distraen y cuestan frames.
- **Un header custom** donde el nativo hacía el trabajo.
- **Copy grandilocuente.** Frases cortas, verbo directo, sin exclamaciones de
  más y sin lenguaje de marketing. Es una app de comunidad, no una campaña.
- **Modo oscuro pensado después.** Se piensa a la vez o no se piensa.

---

## 9. El Panel (mcmpanel) — de la manita, no idéntico

El panel es **otro producto y tiene otro rollo, a propósito**: SPA de
administración, oscura, densa, tipo consola (cian/teal, glows, `--radius` 12px,
shadcn). No lo conviertas en la app. Su documento propio es
`design.md` del repo **mcmpanel**.

Lo que **sí** comparten, y es innegociable:

1. **Cuando el panel representa algo de la app, lo pinta con los colores de la
   app.** Colores de calendario, `tintColor` de evento, colores de perfil,
   previsualización de notificaciones y de encuestas: se renderizan con los
   tokens reales de MCM, no con la paleta neón del panel. Lo que el admin ve
   tiene que parecerse a lo que la persona verá en el móvil.
2. **Los catálogos se espejan, no se reinventan.** Ya existe la convención
   (`src/lib/profileCatalog.ts` es espejo de `constants/profileCatalog.ts`).
   Los tokens de marca siguen el mismo camino.
3. **El vocabulario es el mismo.** Un "perfil", una "delegación", un "evento" y
   un "arreglo" se llaman igual en las dos superficies y en los contratos.
4. **La forma de los datos manda sobre la estética.** `{ updatedAt, data }`,
   `updatedAt` siempre, IDs contra catálogo. Ninguna decisión visual justifica
   escribir un nodo de otra forma.

Lo que **no** comparten: paleta, densidad, tipografía de UI, glass, animación.

---

## 10. Antes de dar por buena una pantalla

- [ ] ¿Cero hex y cero números mágicos nuevos? (`grep` tu diff — blanco y negro
      puros son la única excepción). Hay un trinquete que lo comprueba:
      `__tests__/noNewMagicNumbers.test.ts`. Su tope solo baja.
- [ ] ¿Modo claro **y** oscuro?
- [ ] ¿`fontScale` grande sin romper ni recortar?
- [ ] ¿iOS, Android y web? Si diverge, ¿es deliberado y está en §6?
- [ ] ¿Áreas táctiles ≥44 pt y `accessibilityLabel` en lo interactivo?
- [ ] **Test de entornar los ojos**: desenfoca la pantalla. ¿Se ve la jerarquía
      (qué es título, qué es acción, qué es secundario) sin leer una palabra?
- [ ] ¿Se parece a la pantalla de al lado, o he inventado un dialecto?
- [ ] ¿Algún componente de §7 que debería haber usado y no usé?
- [ ] `npx tsc --noEmit && npm run lint && npm test` — y en particular
      `designTokens.test.ts` y `noNewMagicNumbers.test.ts`, que son este
      documento en verde o en rojo.

---

## 11. Mantener este archivo

- Este documento es **prescriptivo**;
  [`docs/desarrollo/DESIGN.md`](docs/desarrollo/DESIGN.md) es **descriptivo**
  (inventario completo de valores). Si añades un token, va al código y a
  `DESIGN.md`. Solo toca `design.md` si cambia **una regla o un criterio**.
- Si al aplicar este archivo te chocas con una incoherencia real del código, no
  la arregles de paso ni la ignores: anótala en
  [`docs/planes/PLAN_DISENO.md`](docs/planes/PLAN_DISENO.md), que es donde se
  ejecuta la unificación cuando hay hueco.
- Una regla nueva aquí se gana con evidencia: algo que salió mal, un patrón que
  se repitió. No se añaden reglas por si acaso — un archivo que nadie termina
  de leer no guía a nadie.
