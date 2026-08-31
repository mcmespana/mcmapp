# PLAN_DISENO.md — Unificar el diseño hacia un solo sitio

> **Estado:** 🟢 vivo, sin empezar. Creado 2026-08-31 al escribir
> [`design.md`](../../design.md).
>
> **Qué es:** la lista de incoherencias reales de diseño detectadas con
> evidencia en el código, más las mejoras que conviene meter de paso, con el
> destino elegido para cada una. **No hay que decidir nada nuevo para
> ejecutarlo** salvo donde diga 🔒.
>
> **Cuándo se ejecuta:** bolsa oportunista. Es la tarea de "me sobran tokens"
> alternativa a subir cobertura (`docs/desarrollo/COBERTURA.md`) cuando el
> usuario prefiera tocar diseño. Cada tarea es independiente y cabe en un
> commit; no hace falta hacerlas en orden salvo donde se indique.
>
> **Regla al ejecutar:** una tarea = un commit = tachar su casilla aquí. Y si
> cambia una **regla**, actualiza `design.md`; si cambia un **valor**,
> `docs/desarrollo/DESIGN.md`.

---

## Norte: hacia dónde unificamos

Cuando haya que elegir, el destino es este. No se abre debate en cada tarea:

1. **Un solo sitio para los tokens: `mcm-app/constants/*.ts`.** El resto de
   capas (CSS de `global.css`, espejos del panel) **derivan** de ahí, no
   compiten con ella.
2. **Semántica antes que nombre bonito.** Un token se llama por lo que
   significa (`brandRed`, `surfaceSunken`), no por dónde se usó primero
   (`accentYellow`) ni por su tamaño relativo (`shadows.xl`).
3. **StyleSheet es el motor de estilo de la app; `className` es la excepción.**
   149 ficheros usan `StyleSheet.create` y 5 usan `className`. No migramos a
   Tailwind: lo que hacemos es que la capa CSS **no contradiga** a la de RN.
4. **El panel mantiene su estética; solo espeja el color cuando representa a la
   app.** Detalle en `design.md` §9.
5. **Nada de "y ya que estoy".** Cada tarea toca lo suyo. Los archivos grandes
   siguen grandes (decisión del usuario, 2026-08-15).

---

## A. Incoherencias de color 🔴 (lo más peligroso)

### A1. `accent` y `danger` significan cosas distintas en RN y en CSS

**Evidencia.** `constants/colors.ts`: `brand.accent = #E15C62` (rojo MIC),
`brand.danger = #9D1E74` (morado LC). `global.css`: `--accent: #253883` (el
azul primary), `--danger: #e15c62` (el rojo). Un componente heroui con
`className="bg-danger"` sale rojo; el mismo concepto en RN sale morado.

**Impacto.** Un agente que trabaje en la capa equivocada pinta el color
equivocado y el bug es invisible en revisión de código.

**Destino.** Renombrar en la capa de marca a nombres que no se pisen:

| Hoy (`brand`)       | Propuesto                           | Por qué                                                           |
| ------------------- | ----------------------------------- | ----------------------------------------------------------------- |
| `accent` `#E15C62`  | `red` (alias `accent` deprecado)    | Es el rojo MIC, no "el acento"                                    |
| `danger` `#9D1E74`  | `purple` (alias `danger` deprecado) | Es el morado LC; no significa "peligro" en ningún sitio de la app |
| `warning` `#FCD200` | `yellow`                            | Idem                                                              |
| `success` `#A3BD31` | `green`                             | Idem                                                              |

`brand` pasa a ser una **paleta cromática institucional** (los colores del
logo), y lo semántico (peligro/éxito/aviso) vive donde ya vive y funciona:
`ToastColors` y `SwipeColors`. Alias exportados durante una versión para no
romper los ~66 usos.

**Cómo.** Añadir nombres nuevos + `/** @deprecated */` en los viejos, migrar por
lotes con `grep`, quitar los alias al final. Sin cambios visuales: mismos hex.

- [ ] A1.1 Añadir nombres nuevos y alias deprecados en `constants/colors.ts`
- [ ] A1.2 Migrar usos (`grep -rn "brand.accent\|colors.danger" app components`)
- [ ] A1.3 Alinear los comentarios de `global.css` para que digan a qué token de
      marca corresponde cada variable CSS
- [ ] A1.4 Retirar alias + nota en `design.md` §3 (quitar la advertencia de trampa)

### A2. Dos amarillos casi iguales sin regla

`brand.warning #FCD200`, `TabHeaderColors.visitapapa #FCD200`,
`UIColors.accentYellow #f4c11e`, `TabHeaderColors.cancionero #f4c11e`. Dos hex
distintos a 4 puntos de diferencia y ninguna regla de cuándo usar cuál. Además
`#F4C11E` aparece **hardcodeado 15 veces** en mayúsculas, evitando el token.

**Destino.** `#FCD200` = amarillo **de marca** (COM). `#f4c11e` = amarillo **de
cantoral** (identidad de sección). Se documenta así y se colapsan los usos
hardcodeados al token correspondiente.

- [ ] A2 Documentar la regla en `colors.ts` y migrar los 15 hardcodeos

### A3. Tres dorados para Contigo

`TabHeaderColors.contigo #B8860B` (el que ve el usuario en la cabecera) vs
`WARM_LIGHT.accent #C4922A` vs `WARM_DARK.accent #DAA520`. La cabecera no es
del mismo dorado que la pantalla que abre.

**Destino.** La cabecera usa el acento del tema activo: `warm(isDark).accent`.
`TabHeaderColors.contigo` queda solo como fallback estático y se iguala a
`#C4922A`.

- [ ] A3 Unificar (verificar en dispositivo: cambia un color visible)

### A4. `colors.ts` se contradice a sí mismo

Su cabecera dice _"fuente única de verdad — no definir colores en otros
archivos"_, y `components/contigo/theme.ts` define 20 colores. La excepción es
correcta y está decidida; lo que falla es el comentario.

- [ ] A4 Reescribir el docblock nombrando las dos excepciones sancionadas
      (paleta de Contigo, `tintColor` por evento). 5 minutos.

### A5. Faltan neutros y por eso se hardcodean

**Evidencia.** 1.363 hex literales en `app/` + `components/`. Los más repetidos
**no son colores de marca**, son grises del sistema iOS que no existen como
token: `#8E8E93` (68), `#1C1C1E` (63), `#2C2C2E` (44), `#F2F2F7` (29),
`#636366` (25), `#AEAEB2` (23), `#3A3A3C` (21), `#E5E5EA` (13), `#C7C7CC` (12).
La gente no hardcodea por vicio: hardcodea porque **no hay token que usar**.

**Destino.** Añadir una escala `SystemGray` (los 6 grises de Apple, claro y
oscuro) y `Surfaces` (`base/raised/sunken` por modo) a `constants/colors.ts`, y
migrar. Esto solo, bien hecho, se lleva por delante más de la mitad de los
1.363 hardcodeos.

- [ ] A5.1 Definir `SystemGray` + `Surfaces` en `colors.ts`
- [ ] A5.2 Migrar por tandas (empezar por los ficheros con más hex:
      `SongFontBottomSheet` 50, `TransposeBottomSheet` 42, `contigo/evangelio`
      38, `contigo/oracion` 36, `playlist/PlaylistRow` 30)
- [ ] A5.3 Regla de lint o test que falle ante un hex nuevo en `app/` +
      `components/` fuera de una allowlist

### A6. Colores sin nombre y sin dueño

`#7AB3FF` (27 usos), `#7A5A00` (14), `#1a1a1a` (15). Nadie sabe qué son.

- [ ] A6 Identificar, nombrar y tokenizar (o justificar por escrito)

---

## B. Dos motores de estilo conviviendo sin regla

**Evidencia.** 149 ficheros con `StyleSheet.create`, 5 con `className`, 42 que
importan `heroui-native`. `global.css` mantiene ~70 variables CSS que la
práctica totalidad de la app no lee nunca — pero que **sí** leen los componentes
de heroui, que están en 42 ficheros. Ni es Tailwind ni deja de serlo.

**Destino (§Norte 3).** No migramos. Se declara por escrito que
`StyleSheet` es el motor y `className` solo aparece dentro de componentes
heroui o en web; y se hace que `global.css` **derive** de `constants/colors.ts`
en vez de repetir hex a mano.

- [ ] B1 Documentar la regla en `AGENTS.md` de `mcm-app/` (ya está en
      `design.md` §Norte, falta en la guía corta)
- [ ] B2 Generar las variables de `global.css` desde `colors.ts` con un script
      (`npm run tokens:css`) para que no se puedan desincronizar. Alternativa
      barata si el script se complica: un test que compare ambos ficheros y
      falle al divergir.

---

## C. Tipografía y pesos

Ya anotado en `mcm-app/TODO.md` §Inconsistencias; aquí queda el destino.

**Evidencia.** `constants/typography.ts` existe y casi nadie lo importa;
`fontSize` inline por todas partes. Pesos sin regla: `800` en labels, `700` en
títulos de card, `500`/`700` en botones.

**Destino.** La escala de pesos de `design.md` §4: **800** solo `h0`, kickers y
badges · **700** títulos de card · **600** secciones · **500** acciones ·
normal cuerpo.

- [ ] C1 Migrar `fontSize` inline a `typography.*` (por tandas, empezando por
      `components/ui/`, que es lo que todo lo demás copia)
- [ ] C2 Aplicar la escala de pesos
- [ ] C3 Cerrar las dos casillas correspondientes de `TODO.md`

---

## D. Los nombres de sombra mienten

**Evidencia.** `shadows.lg` = opacity 0.3 / elevation 8. `shadows.xl` = opacity
0.18 / elevation 6. El orden de nombres (`sm < md < lg < xl`) **no** es el
orden de intensidad (`sm < md < xl < lg`). Un agente que pida "la más fuerte"
elige `xl` y se equivoca.

Además `shadows.lg` con opacity 0.3 choca de frente con el norte declarado de
"sombras sutiles".

**Destino.** Renombrar por función, no por tamaño:
`shadows.card` (hoy `sm`) · `shadows.raised` (`md`) · `shadows.hero` (`xl`) ·
`shadows.overlay` (`lg`, y bajar de 0.3 a ~0.22) · `warm`/`cool` se quedan.
Alias deprecados igual que en A1.

- [ ] D1 Renombrar + alias
- [ ] D2 Bajar `overlay` a 0.22 y verificar toasts/FABs en dispositivo
- [ ] D3 Quitar la advertencia de `design.md` §5

---

## E. Radios: nueve escalones para seis decisiones

`lg 14`, `xl 18`, `pill 20`, `xxl 22` son cuatro valores en 8px de rango. Nadie
distingue 18 de 22 a ojo, pero sí duda al elegir — y esa duda acaba en
`borderRadius: 16` hardcodeado (**69 ficheros hardcodean `borderRadius`** y solo
44 importan `radii`).

**Destino (mejora, no incoherencia).** Colapsar a seis con nombre de uso:
`sm 8` control · `md 12` overlay · `lg 14` card · `xl 20` destacado/chip ·
`hero 22` · `pillFull 999`. `xs 4` se mantiene para badges, `full 28` para FABs.
`xl 18` se funde con `pill 20`.

- [ ] E1 Colapsar + alias
- [ ] E2 Migrar los 69 ficheros con `borderRadius` inline

🔒 **Confirmar con el usuario antes de ejecutar E**: cambia radios visibles
(18→20) en cards destacadas. Es un cambio pequeño pero se ve.

---

## F. Responsive con dos sistemas

`breakpoints` (`sm/md/lg/xl`) conviven con `wideLayoutMinWidth = 700`, marcado
como legacy y todavía vivo en Home.

- [ ] F Migrar Home a `useResponsive()` y borrar `wideLayoutMinWidth`

---

## G. Panel ↔ App: ir de la manita

Ver `design.md` §9 y `mcmpanel/design.md`. El panel es **oscuro tipo consola**
(cian `197 89% 61%`, teal `166 67% 51%`, glows, gradientes) y **no usa ni un
solo color de marca MCM** salvo como valores por defecto sueltos en cuatro
ficheros de secciones (calendarios, encuestas). Eso está **bien** como estética
de herramienta interna. Lo que no está bien es lo otro:

### G1. El panel pinta lo de la app con su propia paleta

Cuando el panel muestra un color de calendario, el `tintColor` de un evento, un
color de perfil o una previsualización de notificación/encuesta, el admin está
viendo algo que **no se parece** a lo que verá la persona en el móvil.

**Destino.** `src/lib/brandTokens.ts` en `mcmpanel`, **espejo** de
`mcm-app/constants/colors.ts` — exactamente la misma convención que ya existe
con `profileCatalog.ts`. Las superficies de previsualización usan ese espejo.

- [ ] G1.1 Crear `src/lib/brandTokens.ts` (espejo, con la nota de "espejo de…"
      arriba, como `profileCatalog.ts`)
- [ ] G1.2 Usarlo en los selectores de color de calendarios y en las
      previsualizaciones de encuestas y notificaciones
- [ ] G1.3 Documentar el espejo en `mcmpanel/CLAUDE.md` (tabla de archivos clave)

### G2. El panel es oscuro-only pero se declara conmutable

`tailwind.config.ts` tiene `darkMode: ["class"]`, pero `index.css` define los
tokens **solo** en `:root` y no hay bloque `.dark`. shadcn asume claro por
defecto: cualquier componente nuevo copiado de la documentación asume una
inversión que aquí no existe.

**Destino.** Declararlo: el panel es **oscuro y solo oscuro**. Quitar
`darkMode` de la config o dejar constancia en un comentario, y anotarlo en
`mcmpanel/design.md` para que ningún agente intente "añadir modo claro".

- [ ] G2 Declarar oscuro-only y limpiar la config

### G3. Vocabulario

Comprobar que "perfil", "delegación", "evento", "arreglo", "playlist" y
"encuesta" se llaman igual en las dos superficies y en `docs/contratos/`.

- [ ] G3 Auditoría rápida de vocabulario

---

## H. Mejoras de diseño detectadas de paso

No son incoherencias: son cosas que, mirándolas, están mejor de otra manera.
Ninguna es urgente.

- [ ] **H1. Estados de foco.** No hay anillo de foco definido globalmente
      (`DESIGN.md` lo admite: _"focus ring no definido"_). En web y con teclado
      externo eso es un agujero de accesibilidad. Definir
      `focusRing` en `uiStyles.ts` (2px, `brand.info`, offset 2) y aplicarlo en
      `AppTextField`, `AppPrimaryButton` y `SegmentedControl`.
- [ ] **H2. `EmptyState` no llega a los ~20 sitios que lo reinventan.** Es la
      tarea de diseño con mejor relación coherencia/esfuerzo que queda viva
      (cola en `PLAN_UI_NATIVA.md` §5). Cuando alguien pregunte "¿qué hago de
      diseño?", esto primero.
- [ ] **H3. Jerarquía de la Home.** Hoy es un grid estático de botones; las tres
      opciones ya pensadas están en `mcm-app/TODO.md` §Ideas para la Home. La
      recomendación desde diseño es la **Opción A** (contenido dinámico:
      próximo evento arriba, accesos rápidos más compactos abajo): es la única
      que aprovecha el `h0` y da a la pantalla de entrada una jerarquía real en
      vez de una rejilla plana — justo lo que `design.md` §8 llama antipatrón.
      🔒 Decisión de producto del usuario.
- [ ] **H4. Contraste de marca en modo oscuro.** Los colores de marca no tienen
      variante oscura y se usan tal cual sobre `#2C2C2E`. `brand.text #002B81`
      sobre fondo oscuro es ilegible. Auditar los pares reales y añadir
      `brandDark` donde haga falta (no una paleta entera: solo los que fallan).
- [ ] **H5. Un `Chip` canónico.** Mezcla de `Chip` de heroui y pills custom
      (pendiente en `PLAN_UI_NATIVA.md` §5). Un solo componente con prop de
      color.
- [ ] **H6. Densidad de la lista de canciones.** Es la pantalla más usada de la
      app y hoy compite con `SongFontBottomSheet` (50 hex) y
      `TransposeBottomSheet` (42) por ser lo menos tokenizado del repo. Al
      migrarla (A5.2), revisar de paso altura de fila y jerarquía
      título/subtítulo/pill de tono.
- [ ] **H7. Que el propio `design.md` se pueda verificar.** Vercel mide su
      design.md con escenarios de evaluación. El equivalente barato aquí: un
      test que compruebe las invariantes mecánicas (cero hex nuevos, tokens no
      duplicados entre capas, `global.css` sincronizado con `colors.ts`). Cierra
      el bucle de A5.3 y B2.

---

## Orden sugerido si hay un hueco grande

1. **A4** (5 min) → **A1** (la trampa activa) → **A5** (el volumen)
2. **D** y **C** (mecánicas, seguras, sin verificación en dispositivo)
3. **B2** + **H7** (para que no vuelva a desincronizarse)
4. **G1** (cross-repo: hace falta `mcmpanel` en el scope de la sesión)
5. **E** y **H3** solo tras preguntar (🔒)
