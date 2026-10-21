# 03 — Traducción del diseño del área privada a la app

> **Estado:** 🟢 listo para ejecutar en `nuevoComunicaChulo` (la tarea 1 se
> puede hacer ya, no toca la app) · **Depende de:** nada · **Tamaño:** M ·
> Índice y reglas comunes: [`README.md`](README.md).
>
> 🔒 Dos decisiones del propietario en la página de decisiones:
> `diseno` (cómo se traduce; este plan sigue la recomendación, «pantalla a
> pantalla») y `territorio` (qué color lleva el área nativa; §2). Mientras no
> estén, se puede hacer todo menos la tarea 3.

## Para qué

El propietario quiere **conservar el área privada**: «ha quedado guapo», las
mismas pantallas y el mismo concepto, rehechos en Expo, con alguna decisión
para que encajen con el resto de la app. Este plan dice qué se queda, qué
cambia y con qué piezas, para que los planes 04-09 no lo decidan cada uno a su
manera.

## Las dos leyes y quién gana

- `comunicaAreaPrivada/design.md` — la ley del área privada: la tarjeta como
  unidad de registro (§6.1), un solo botón principal (§6.2), chips por clave
  (§6.1), «si alguien ve algo que no ve todo el mundo, se le dice por qué»
  (§6.4), fechas en lenguaje humano, nada de «ETIQUETA: valor».
- `mcmapp/design.md` — la ley de la app: legibilidad primero, «que se sienta
  del sistema» (§1), territorios (§2), componentes aprobados (§7), reflejos que
  se rechazan (§8), checklist (§10).

**Regla:** del área privada se conserva **qué se enseña y en qué orden** (la
información, la jerarquía, las palabras, los estados). De la app se toma
**cómo se toca y se mueve** (navegación, cabeceras, hojas, gestos, componentes,
tokens). Si chocan en algo visible, gana la app y se apunta aquí.

## 1. Catálogo de pantallas (tarea 1, antes de construir nada)

Un documento `docs/planes/area-nativa/catalogo/` con una ficha por pantalla del
plugin que entra en la fase 1 (inventario en `ANALISIS_AREA_PRIVADA_NATIVA.md`
§4):

- **Capturas** a 375 px, en claro y en oscuro, con datos inventados:
  - Pasar Lista, Grupos y fichas, ficha, resumen: los artboards de
    `comunicaAreaPrivada/design/pasar-lista/` (`Main`, `Marcar`, `Grupos`,
    `Ficha`, `Resumen`, `Estados`) y el render con los dobles de
    `tests/PasarListaRenderTest.php`, como hicieron los planes 035 y 042 del
    plugin.
  - Equipo, eventos, grupos de actividad, acceso: los arneses
    `tests/manual/render-*.php` (`render-equipo`, `render-events`,
    `render-grupos-actividad`, `render-acceso`).
  - Si la sesión no tiene PHP, los artboards bastan para Pasar Lista; para lo
    demás, se piden capturas al propietario.
- Por pantalla, una tabla corta: **se queda igual** (información, orden,
  textos, estados), **cambia por ser app** (con la regla de §3 que aplica) y
  **dudas**.
- El propietario lo revisa antes de que empiecen los planes 04-09 (decisión
  `diseno`).

## 2. El color del área nativa (🔒 `territorio`)

Hoy chocan dos identidades:

| | Área privada (web) | App |
|---|---|---|
| Color | Azul Comunica `#1c6fb3` → violeta `#6c4b9e` → magenta `#9d1e74` | Azul MCM `#253883`, plano |
| Degradado | La firma: «uno por pantalla, dos como mucho», en el botón principal, la barra de identidad, avatares y cápsula de fecha | Prohibido fuera de Contigo (`design.md` §8) |
| Pestaña Comunica | — | Ya va en morado LC (`TabHeaderColors.comunica`, `brand.purple` «Morado LC — Comunica») |

La app ya admite **territorios** con acento propio (`design.md` §2: el de un
evento lleva su `tintColor`). Opciones para el propietario:

- **A · Territorio «Comunica» (recomendado).** Estructura, tokens no cromáticos
  y componentes de la app; acento de Comunica (el morado que ya usa la pestaña,
  o el azul Comunica para texto y enlaces); el degradado de marca **solo en la
  acción principal** de cada pantalla («Guardar lista»), como en la web: uno
  por pantalla. Exige añadir los colores de Comunica a `constants/colors.ts` y
  una fila al §2 de `design.md`, porque es un territorio nuevo (`design.md` §1
  pide preguntar antes).
- **B · Institucional puro.** Azul MCM plano y sin degradado: el área se parece
  al resto de la app y menos a la web que la gente ya conoce.
- **C · Calcado de la web.** Degradados y cristal como en el plugin: choca con
  la ley de la app y con el «que se sienta del sistema».

Mientras no se decida, los planes 04-09 usan los tokens de la app y dejan el
acento en una sola constante del área (`components/comunica/comun/theme.ts`),
para que el cambio sea de un fichero.

## 3. Reglas de traducción

| En el área privada | En la app |
|---|---|
| Menú y portada con bloques | Portada «Hoy» nativa (plan 04) con lo de hoy arriba y accesos debajo; nada de menú hamburguesa |
| Barra de navegación propia y «Volver» | Cabecera nativa del `Stack` (botón atrás del sistema, gesto de volver en iOS, botón atrás en Android) |
| Buscador en la página | `headerSearchBarOptions` (buscador nativo de la cabecera) |
| Botón «Refrescar» / `?refrescar=1` | Deslizar para refrescar del sistema |
| Ventanas modales y desplegables | `BottomSheet` de la app (hojas), confirmaciones con `Alert` nativo |
| Pestañas de la página (por grupos / cursos / A-Z) | `SegmentedControl` |
| Barra pegada «Guardar lista» | `BottomActionBar`: fija abajo, por encima de la barra flotante (`useTabBarClearance`) y del teclado |
| Tarjeta de registro (`stic-rec-*`) | `RecordCard`: misma anatomía (cápsula de fecha, título, líneas, chip, acción) con radios y sombras de la app; **sin** botón que repita lo que hace tocar la tarjeta |
| Cápsula de fecha | `DateCapsule` (día grande + mes en tres letras) |
| Chip de estado | `StatusChip`: color por **clave** interna, neutro ante la duda; ojo con `no_attended` y `not_paid` |
| Chips «Coordinación» / «Acompañamiento» | `RoleChip`: solo lo excepcional, uno como mucho, sin frase explicativa |
| Fila de persona con foto y marcas | `PersonRow` + `PersonBadges` (salud sin decir cuál, sin fotos, no se va solo) |
| Los 4 estados de una marca y sus colores | `MarkControl`: mismos iconos y significado (`PASAR-LISTA.md` §6); colores desde tokens de la app (el verde de éxito, el ámbar, el rojo de error), nunca hex nuevos |
| Gesto largo en una fila | Pulsación larga nativa + `h.select`; la misma opción también en un menú visible (accesibilidad) |
| Iconos SVG a trazo | `IconSymbol` (SF Symbols / Material) |
| Overlay «Cargando…» | Esqueletos de `AreaState` (plan 01) |
| Avisos de «guardado» | `UploadStatus` y toast de la app; háptico `h.formSuccess` al guardar |
| Inter (tipografía del área) | La tipografía del sistema, la de la app (`design.md` §4) |
| Escritorio a dos columnas | `PageContainer` + `useResponsiveLayout` (≥ 720) en iPad y web |

Lo que **no** cambia: los textos y palabras del área («chavales», «Sin
registro», «Han venido todos»), el orden de la información en cada pantalla,
los estados y sus significados, las reglas de qué se enseña a quién.

## 4. Componentes del área (`components/comunica/comun/`)

`RecordCard`, `DateCapsule`, `StatusChip`, `PersonRow`, `PersonBadges`,
`RoleChip`, `MarkControl`, `BottomActionBar`, y `theme.ts` con el acento del
área. Todos reciben color por prop o lo toman de `theme.ts` (nunca de
`brand` directamente), con `accessibilityLabel`, área táctil ≥ 44 pt y
`fontScale` ×1,3 sin recortes.

## 5. Tareas

| # | Tarea | Cómo se comprueba |
|---|---|---|
| 1 | Catálogo de pantallas (§1) | El propietario lo revisa; una ficha por pantalla de la fase 1 |
| 2 | `theme.ts` del área con los tokens de la app (provisional) | `designTokens` y `noNewMagicNumbers` en verde |
| 3 | 🔒 Aplicar la decisión `territorio`: colores en `constants/colors.ts`, fila en `design.md` §2, `theme.ts` | Revisión del propietario con capturas en claro y oscuro |
| 4 | Componentes de §4, cada uno con su test y su captura en todos sus estados | Capturas web a 375 px, claro y oscuro; tests de accesibilidad (etiquetas) |
| 5 | Página de muestra solo en desarrollo (`comunica/_muestra`) con todos los componentes, para revisarlos de un vistazo | Captura de la página entera |

## 6. Tests

Cada componente: render con sus variantes y comprobación de `accessibilityLabel`.
`StatusChip`: test de que `no_attended` y `not_paid` no salen en verde.
`MarkControl`: la secuencia del gesto principal (sin marcar → vino → falta)
vive en `utils/comunica/` y se prueba allí (plan 04).

## 7. Preguntas abiertas

- `territorio` (arriba). Lo demás se decide al revisar el catálogo.
