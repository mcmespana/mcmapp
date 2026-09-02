- [x] **H11. ❌ MI DIAGNÓSTICO ERA FALSO — y de paso salió una mejora real.**
      Dije que tres pares claro/oscuro estaban "del revés" porque el hex de
      modo oscuro era más oscuro que el de modo claro. **Eso no significa
      nada**: cada uno se mide contra SU fondo. Medidos bien, estaban
      deliberadamente igualados —placeholder 2,92 en claro y 2,84 en oscuro;
      leyenda 2,16 y 2,67— o sea que alguien los eligió con cuidado. No había
      ningún ternario intercambiado.

      Lo que sí era verdad, y no lo era por el motivo que yo decía: **2,9:1 y
                      2,2:1 están por debajo del mínimo legible** (4,5:1 para texto), y esto
                      es el buscador y la leyenda del **cantoral**, la pantalla más usada de
                      la app, que se lee a menudo a contraluz.

                      Arreglado subiendo `Colors.light.textMuted` de `#8E8E93` a `#6E6E73`, el
                      primer gris de la escala que pasa (4,54:1 sobre el gris de los campos,
                      5,07 sobre blanco). En oscuro `#8E8E93` ya pasaba y se queda. Los 10
                      sitios tenues migrados al token.

                      Blindado con tests de contraste en `designTokens.test.ts`, y con un
                      aviso en `design.md` §5 para que nadie repita mi error de comparar los
                      dos hex entre sí.

## Hallazgos nuevos (de la pasada del 2026-08-31)

# PLAN_DISENO.md — Unificar el diseño hacia un solo sitio

> **Estado:** 🟡 en curso. Creado 2026-08-31 al escribir
> [`design.md`](../../design.md); primera pasada ejecutada el mismo día
> (§A1, §A4, §A5 parcial, §D, §E, §F, §G1, §G2, §H1 parcial, §H7 parcial).
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

### ✅ A1. HECHO (2026-08-31) — con el alcance corregido por el código

**Evidencia.** `constants/colors.ts`: `brand.accent = #E15C62` (rojo MIC),
`brand.danger = #9D1E74` (morado LC). `global.css`: `--accent: #253883` (el
azul primary), `--danger: #e15c62` (el rojo). Un componente heroui con
`className="bg-danger"` sale rojo; el mismo concepto en RN sale morado.

> **Lo que el código dijo al ejecutarlo.** El plan proponía renombrar `accent`
> también, y estaba mal: mirando los 27 usos, `colors.accent` SÍ se usa como
> acento (`accentColor` de `EventItem`, CTAs, badges). Los que mentían eran los
> otros: `colors.success` pinta la pantalla de Reflexiones y `colors.warning`
> las estrellas de valoración — no son estados. Y `brand.danger` tenía **cero
> usos**.
>
> Y `global.css` no había que renombrarlo en absoluto: esos nombres son el
> contrato de HeroUI, no nuestro vocabulario. Lo que faltaba era **decirlo**.

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

**Cómo se hizo.** Renombrado y migrados los 26 usos en el mismo commit (no hizo
falta alias: eran pocos y tsc los caza todos). Sin cambios visuales: mismos hex.

- [x] A1.1 Renombrar en `constants/colors.ts` + docblock con la regla de nombres
- [x] A1.2 Migrar los usos
- [x] A1.3 Cabecera de `global.css` mapeando cada variable a su token de marca
- [x] A1.4 `design.md` §3 reescrito: la trampa que queda es solo la de las capas

### A2. Dos amarillos casi iguales sin regla

`brand.warning #FCD200`, `TabHeaderColors.visitapapa #FCD200`,
`UIColors.accentYellow #f4c11e`, `TabHeaderColors.cancionero #f4c11e`. Dos hex
distintos a 4 puntos de diferencia y ninguna regla de cuándo usar cuál. Además
`#F4C11E` aparece **hardcodeado 15 veces** en mayúsculas, evitando el token.

**Destino.** `#FCD200` = amarillo **de marca** (COM). `#f4c11e` = amarillo **de
cantoral** (identidad de sección). Se documenta así y se colapsan los usos
hardcodeados al token correspondiente.

- [x] A2 Migrados los hardcodeos de `#f4c11e` a `UIColors.accentYellow`.
- [x] A2-bis Regla documentada en `colors.ts` y en el inventario: `#FCD200` es
      el de MARCA (estrellas, categorías, tab de la Visita del Papa) y
      `#f4c11e` el del CANTORAL (su tab, su FAB, el destacado ámbar).

### A3. Tres dorados para Contigo

`TabHeaderColors.contigo #B8860B` (el que ve el usuario en la cabecera) vs
`WARM_LIGHT.accent #C4922A` vs `WARM_DARK.accent #DAA520`. La cabecera no es
del mismo dorado que la pantalla que abre.

**Destino.** La cabecera usa el acento del tema activo: `warm(isDark).accent`.
`TabHeaderColors.contigo` queda solo como fallback estático y se iguala a
`#C4922A`.

- [ ] A3 Unificar (verificar en dispositivo: cambia un color visible)

### ✅ A4. HECHO (2026-08-31) — `colors.ts` se contradecía a sí mismo

Su cabecera dice _"fuente única de verdad — no definir colores en otros
archivos"_, y `components/contigo/theme.ts` define 20 colores. La excepción es
correcta y está decidida; lo que falla es el comentario.

- [x] A4 Docblock reescrito con las dos excepciones sancionadas (paleta de
      Contigo, `tintColor` por evento) y la regla de nombres.

### A5. Faltan neutros y por eso se hardcodean

**Evidencia.** 1.363 hex literales en `app/` + `components/`. Los más repetidos
**no son colores de marca**, son grises del sistema iOS que no existen como
token: `#8E8E93` (68), `#1C1C1E` (63), `#2C2C2E` (44), `#F2F2F7` (29),
`#636366` (25), `#AEAEB2` (23), `#3A3A3C` (21), `#E5E5EA` (13), `#C7C7CC` (12).
La gente no hardcodea por vicio: hardcodea porque **no hay token que usar**.

**Destino.** ⚠️ El diagnóstico de arriba se quedaba corto, y al ejecutarlo se
vio por qué: los hex no eran colores sueltos, eran **pares claro/oscuro**
escritos a mano —`isDark ? '#F5F5F7' : '#1C1C1E'` aparecía 27 veces— porque el
ROL no existía como token. Y al copiarse habían derivado: dos grises distintos
para el mismo papel, dos ámbar de destacado, el verde de Carismochito como
constante duplicada en tres ficheros.

Así que no se añadió un `Surfaces` aparte (habría sido una segunda familia para
lo mismo, justo lo que se está quitando): se completó `Colors.light`/`Colors.dark`,
que ya era la capa de roles.

- [x] A5.1 `Colors` completado con `textStrong`, `textSecondary`, `textMuted`,
      `link`, `backgroundSunken` y `separator`. Más `themeColors(isDark)`,
      `SystemGray`, `HighlightColors`, `CarismoColors` y `LiturgicalColors`.
- [x] A5.2 Primera tanda: 202 ternarios + 126 literales + 50 de la paleta de
      Contigo. **De 1.363 hex a 793.**
- [x] A5.3 `__tests__/noNewHardcodedColors.test.ts`: **trinquete** con tope por
      directorio que solo puede bajar (allowlist: blanco y negro puros; los
      ficheros que DEFINEN tokens quedan fuera). Prohibirlos de golpe era
      imposible con 570 de deuda; esto impide que el número suba y obliga a
      bajar el tope cuando se migra. Verificado que se pone rojo al añadir uno.
      Además `components/ui/` tiene su propio tope, porque es lo que todo lo
      demás copia.
- [x] A5.4 Segunda tanda: el destacado ámbar (27 literales → `HighlightColors`
      en `PlaylistRow`, `SongListItem`, `TransposeBottomSheet`,
      `SongFontBottomSheet` y `TagChip`), con la deriva `#3A2800`/`#3A2D0A`
      unificada.
- [ ] **A5.5. Aquí se acaba lo mecánico.** Lo que queda ya NO se puede
      sustituir a ciegas: son hex cuyo valor coincide con un token pero cuyo
      PAPEL no (el mismo `#1C1C1E` es `SystemGray.dark.gray6` en una superficie
      y "texto casi negro" en modo claro). Cambiar un literal por un token con
      nombre equivocado es peor que dejarlo, porque el nombre miente — que es
      justo lo que este plan vino a arreglar (§Norte 2). A partir de aquí toca
      abrir el fichero y decidir. Los que más tienen:
      `TransposeBottomSheet` (34), `SongFontBottomSheet` (34),
      `contigo/oracion` (25), `contigo/evangelio` (23), `onboarding` (20).

### A6. Colores sin nombre y sin dueño

`#7AB3FF` (27 usos), `#7A5A00` (14), `#1a1a1a` (15). Nadie sabe qué son.

- [x] A6 Identificados y tokenizados casi todos: `#7AB3FF`/`#253883` era el par
      de **enlace**, `#F5F5F7`/`#1C1C1E` el de **texto fuerte**,
      `#A0A0A8`/`#6B6B70` el de **texto secundario**, `#7A5A00`/`#FFF4DA` el
      **destacado ámbar** y `#9DE86B`/`#1B9E4B` el verde de **Carismochito**.
- [ ] A6-bis Queda `#1a1a1a` (19 usos): es un negro de fondo para exportar PDF
      y webviews, no un color de UI. Decidir si merece token o se queda.
- [x] **A6-ter. Resuelto: no hacían el mismo papel, el nombre lo escondía.**
      `activePrimary` (#007bff) no está en FABs ni en "elementos activos" como
      decía su comentario: está en el **HTML que genera `useSongProcessor`**,
      pintando los acordes del cantoral. Es otro contexto y otro color.
      Renombrados a `chordBlue` y `chordSecondaryText`, que es lo que son.
      De paso, cuatro claves de `UIColors` no las usaba nadie
      (`activePrimaryDark`, `textLight`, `textDark`, `backgroundLight`):
      borradas. Un token muerto es una respuesta plausible a la pregunta
      equivocada.

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

- [x] B1 Regla documentada en `mcm-app/AGENTS.md` (regla 0) y en `design.md`.
- [x] B2 Hecho por la vía barata y mejor: `__tests__/designTokens.test.ts`
      compara `global.css` con `constants/colors.ts` y falla al divergir. Un
      generador habría sido más frágil (esas variables las lee HeroUI).

---

## 🟡 C. Tipografía y pesos — primera pasada hecha

**Evidencia.** `constants/typography.ts` existía y **solo lo importaban 6
ficheros**, con 666 `fontSize` a mano por toda la app.

> **La causa no era desidia, era que el token no servía.** La escala declaraba
> siete tamaños (10/13/15/16/22/28/34) y los cinco más usados del repo —12 (100
> usos), 14 (71), 11 (71), 17 (22), 18 (25)— **no estaban**. Un token que no
> cubre tu caso no se usa: se rodea. Eso explica los 666 mucho mejor que
> cualquier regla que se pudiera haber escrito en un documento.

**Destino.** Escala completa con los nombres de iOS (de donde vienen los
tamaños), y un token solo trae `fontWeight` cuando el rol lo implica — así se
puede sobrescribir sin sorpresas y migrar un `fontSize` suelto no cambia el
peso.

- [x] C1 Escala ampliada: `h3` 18, `title` 17, `subhead` 14, `footnote` 12,
      `micro` 11. `h1` normalizado de `'bold'` a `'700'` (idéntico en RN).
- [x] C2 Migrados 345 `fontSize` (de 666 a 321; de 6 ficheros importando el
      token a 96). Solo los tokens SIN peso propio, que son
      byte-equivalentes; los que llevan peso se migraron únicamente donde el
      peso declarado coincidía.
- [x] C3 Trinquete de `fontSize` en `__tests__/noNewMagicNumbers.test.ts`.
- [x] C4 Mirados. **Y otra vez el token era el raro, no el código.** A 15 px la
      app usa 600 o 700 en **53 sitios** y el 500 que declaraba `button` en
      **3**. Igual con 17 y 18 px, que van a 700. Y había una incoherencia de
      escalera: `h2` (22 px) a 800 era más gordo que `h1` (28 px) a 700 — peso
      subiendo al bajar de tamaño.

      Ajustados los pesos del token a lo que la app hace (`h2`/`h3` 700,
                  `button` 600) en vez de reescribir 100 sitios contra una escala que me
                  había inventado yo. Con eso, 45 sitios más pasaron a token sin cambiar
                  de aspecto: **de 321 a 276**.

                  Cambian de peso 5 sitios que heredaban del token sin declarar el suyo
                  (`ComidaScreen`, `ScreenHero` compacto, `ThemedText` subtitle,
                  `notificationsStyles`): 600→700 y 500→600. Van en la dirección de lo que
                  ya hace el resto de la app.

- [ ] C6 Quedan 276. Son tamaños fuera de escala (26, 20, 30, 9, 48…) o
      combinaciones con un peso que no es el del token. Ahí ya no hay regla
      general que aplicar: es abrir y decidir.
- [x] C5 Casillas de `TODO.md` actualizadas.

---

## ✅ D. HECHO (2026-08-31) — Los nombres de sombra mentían

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

- [x] D1 Renombradas a `card` / `raised` / `hero` / `overlay` (sin alias: eran
      20 usos y tsc los caza).
- [x] D2 `overlay` bajada de 0.30 a 0.22. **Falta verlo en dispositivo** —
      afecta a toasts y FABs.
- [x] D3 Advertencia fuera de `design.md`; el orden lo blinda ahora un test.

---

## ✅ E. HECHO (2026-08-31) — Radios: nueve escalones para seis decisiones

`lg 14`, `xl 18`, `pill 20`, `xxl 22` son cuatro valores en 8px de rango. Nadie
distingue 18 de 22 a ojo, pero sí duda al elegir — y esa duda acaba en
`borderRadius: 16` hardcodeado (**69 ficheros hardcodean `borderRadius`** y solo
44 importan `radii`).

**Destino.** 🔒 → el usuario delegó la decisión ("lo que sea más coherente,
lógico y normal", 2026-08-31). Lo normal en un sistema de diseño es que los
radios vayan en la misma rejilla de 4 px que el spacing, así que:

```
xs 4 · sm 8 · md 12 · lg 16 · xl 20 · full 28 · pillFull 999
```

`lg` pasa de 14 a 16, y `xl 18` + `pill 20` + `xxl 22` se funden en `xl 20`.

- [x] E1 Colapsado de nueve escalones a siete y migrados los usos.
- [x] E2 Migrados **de 300 a 122** en 69 ficheros: 114 que coincidían exacto
      con la escala (byte-idénticos) y 64 de los valores que la escala colapsó
      —14, 18, 22—. Estos últimos se migraron a propósito: dejarlos a mano
      creaba el peor de los mundos, la misma card con 14 px si el fichero
      hardcodeaba y 16 si usaba el token.
- [x] E3 Revisados. **El `10` (23 usos) NO es deuda: es geometría.**
      `SegmentedControl` tiene `borderRadius: 10, padding: 2` — radio interior
      = exterior menos el hueco. Ponerle 8 o 12 dejaría las esquinas torcidas.
      Convertido en regla en `design.md` §5 en vez de en tarea.
- [ ] E4 Quedan por mirar los sueltos de verdad: 3, 6, 100, 5, 2, 13, 26, 30, 19. El `100` es "haz un círculo" y solo funciona porque los elementos son
      pequeños; lo correcto es `radii.pillFull` (999). Hay trinquete
      (`noNewMagicNumbers`) para que no crezcan.

---

## 🟡 F. Responsive — la fuente ya es única; faltan las anchuras

**Era peor de lo que decía este plan.** No era "una constante legacy": había
**dos hooks** con umbrales distintos, y el que documentaba `DESIGN.md`
(`useResponsive`, 640/768/1024/1280) tenía **cero usos** — solo seguía vivo
porque tenía un test. El real es `useResponsiveLayout` (7 pantallas,
480/720/1024). Y por encima, `EventHomeScreen` se había hecho su propio
`WIDE_BREAKPOINT = 700` y `onboarding` usa dos `screenW >= 640` sueltos.

- [x] F1 Borrado `useResponsive` y su test; el guardarraíl útil (que los cortes
      salgan del fichero de constantes) portado al test del hook real.
- [x] F2 `constants/breakpoints.ts` declara los números que la app usa de
      verdad, y `useResponsiveLayout` los importa.
- [x] F3 Fuera `wideLayoutMinWidth` y `WIDE_BREAKPOINT`.
- [x] **F4. ❌ NO SE TOCA — decisión del usuario (2026-08-31):** _"no
      destruyas el layout del iPad, me gusta como está"_. Las cuatro anchuras
      se quedan como están. No lo propongas otra vez.

      Enunciado original, para referencia:
                      **Las dos escaleras de anchura máxima.** `readableMaxWidth`/
                      `contentMaxWidth` del hook (640/760 y 760/980) conviven con
                      `maxContentWidth`/`maxContentWidthWide` de `PageContainer` (960/1200):
                      la misma app limita el contenido a **cuatro anchos distintos** según en
                      qué pantalla estés. Unificarlas cambia el layout en tablet y web, así que
                      hay que verlo en un dispositivo. Destino propuesto: una sola escalera, la
                      del hook, y que `PageContainer` la use.

- [ ] F5 Los dos `screenW >= 640` de `onboarding.tsx`.

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

- [x] G1.1 Creado `src/lib/brandTokens.ts` (espejo, misma convención que
      `profileCatalog.ts`).
- [x] G1.2 Usado en el selector de color de calendarios —que ofrecía veinte
      pasteles con tres colores de MCM enterrados en medio— y en el acento por
      defecto de las encuestas.
- [x] G1.3 Documentado en `mcmpanel/CLAUDE.md`.
- [ ] G1.4 Falta la **previsualización de notificaciones**: sigue pintándose con
      la paleta del panel.

### G2. El panel es oscuro-only pero se declara conmutable

`tailwind.config.ts` tiene `darkMode: ["class"]`, pero `index.css` define los
tokens **solo** en `:root` y no hay bloque `.dark`. shadcn asume claro por
defecto: cualquier componente nuevo copiado de la documentación asume una
inversión que aquí no existe.

**Destino.** Declararlo: el panel es **oscuro y solo oscuro**. Quitar
`darkMode` de la config o dejar constancia en un comentario, y anotarlo en
`mcmpanel/design.md` para que ningún agente intente "añadir modo claro".

- [x] G2 Declarado oscuro-only en `tailwind.config.ts` y en `index.css`, con el
      aviso de que shadcn asume claro y de no añadir tema claro por iniciativa
      propia.

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
- [~] **H2. `EmptyState`.** Al ir a adoptarlo salió que **no cumplía su propio
  contrato**: vive en `components/ui/`, donde `design.md` §2 exige ser
  agnóstico de paleta, pero solo lo era a medias — `accentColor` tocaba el
  icono y el CTA, mientras el título y el subtítulo se cogían del tema
  institucional. O sea que en Contigo salían grises fríos sobre crema, y
  por eso estaba "pendiente de verificar" desde hacía meses.
  Añadidos `titleColor` y `subtitleColor` (por defecto, lo de antes: cero
  cambio para los 11 sitios que ya lo usan), y migrados los dos vacíos de
  Contigo que lo esperaban: **marcadores** y **evangelio**.
- [ ] H2-bis Lo que queda son vacíos DENTRO de hojas y desplegables
      (`ChoirSheet` ×3, `ShareQrModal`). **No migrar sin más**: el padding de
      `EmptyState` los desbordaría, igual que pasaba con `CommandPalette`.
      O se les da una variante compacta al componente, o se quedan.
- [x] **H3. Jerarquía de la Home** — ❌ **NO HAY NADA QUE HACER.** Este ítem
      partía de una nota obsoleta de `TODO.md` ("la home actual es un grid de
      botones estático"). Es falso desde hace tiempo: la Home ya tiene
      `ScreenHero`, próximos eventos agrupados por cercanía con skeleton y
      `EmptyState`, banner de encuestas, avisos de actualización, campana con
      contador, accesos rápidos filtrados por perfil y dos columnas en pantalla
      ancha. O sea, la "Opción A" ya está hecha. `TODO.md` corregido.
      Lo único que sigue sin estar: canción del día y último contenido
      actualizado. 🔒 si algún día se quieren, son decisión de producto.
- [~] **H4. Contraste de marca en oscuro — era un bug, no una mejora.** Medido:
  sobre `#2C2C2E`, `brand.text` da **1,10:1**, `primary` **1,31** y
  `purple` **1,91**. Y `primary` se usaba como color de iconos, bordes y
  etiquetas de botón en **toda la pantalla de Notificaciones**, que sí es
  mode-aware — o sea que en modo oscuro esa pantalla tenía los controles
  prácticamente invisibles.

      Arreglado usando `themeColors(isDark).link` (el azul de marca en claro,
      `#7AB3FF` en oscuro) en `notifications.tsx`, `NotificationListItem`,
      `NotificationDetail` y `notificationsStyles`. No hizo falta paleta nueva:
      el rol ya existía, solo que se llamaba "link" y nadie lo asociaba con
      iconos y botones. Ahora está documentado como lo que es, el `tintColor`
      de iOS.

      La regla y la tabla de qué color de marca vale en qué fondo están en
      `design.md` §3.

- [ ] H4-bis Barrer el resto de usos de marca como primer plano fuera de
      Notificaciones: `ErrorBoundary`, `SongControls`, `FormattedContent`,
      `GruposScreen`, `SurveyScreen`. Los tres primeros son mode-aware, así que
      pueden tener el mismo problema; hay que mirarlos uno a uno porque algunos
      son rellenos (y ahí el color de marca está bien).
- [ ] **H5. Un `Chip` canónico.** Mezcla de `Chip` de heroui y pills custom
      (pendiente en `PLAN_UI_NATIVA.md` §5). Un solo componente con prop de
      color.
- [ ] **H6. Densidad de la lista de canciones.** Es la pantalla más usada de la
      app y hoy compite con `SongFontBottomSheet` (50 hex) y
      `TransposeBottomSheet` (42) por ser lo menos tokenizado del repo. Al
      migrarla (A5.2), revisar de paso altura de fila y jerarquía
      título/subtítulo/pill de tono.
- [x] **H7-a. Que el propio `design.md` se pueda verificar** —
      `__tests__/designTokens.test.ts`: comprueba que `global.css` usa los
      valores de `constants/colors.ts` (claro y oscuro), que no hay dos tokens
      de marca con el mismo hex, que ningún token de marca se llame como un
      estado, y que spacing/radios/sombras siguen siendo escalas monótonas.
- [x] **H7-b. La regla del hex nuevo** — hecha en §A5.3. Vercel mide su
      design.md con escenarios de evaluación. El equivalente barato aquí: un
      test que compruebe las invariantes mecánicas (cero hex nuevos, tokens no
      duplicados entre capas, `global.css` sincronizado con `colors.ts`). Cierra
      el bucle de A5.3 y B2.

---

## Orden sugerido si hay un hueco grande

**Pasada completa hecha el 2026-08-31.** Cerrado: §A1, A2, A4, A5, A6, A6-ter,
B, C (parcial), D, E1–E3, F1–F3, G1, G2, H1, H3, H7, H11. Descartados con
motivo: §F4 (decisión del usuario) y §H8 (el contraste lo desaconseja).

Lo que queda, en el orden en que lo haría:

1. **H9** — verificar en dispositivo lo que cambió. Es lo único que bloquea dar
   la pasada por buena, y son 6 pantallas.
2. **C4** — los 321 `fontSize` que quedan. Revisión uno a uno, no mecánica.
3. **A5.5** y **E4** — lo que queda de hex y radios sueltos. Igual: hay que
   abrir el fichero.
4. **A2-bis**, **G1.4**, **H1-bis** — cortos.
5. **H2**, **H4**, **H5**, **H6**, **H10** — mejoras, sin prisa.

**No propongas** §F4 (anchuras / layout de iPad) ni §H8 (capas en oscuro): los
dos están decididos que no, con su motivo escrito arriba.

---

## Hallazgos nuevos (de la pasada del 2026-08-31)

- [ ] **H11. 🔴 Tres pares claro/oscuro parecen estar del revés.** Al barrer los
      ternarios aparecieron pares donde el color de MODO OSCURO es más OSCURO
      que el de modo claro, que es justo al revés de lo que pide el modo:

      | Dónde | Par (`isDark ? oscuro : claro`) | Contraste real |
                          | --- | --- | --- |
                          | `SongListScreen` (placeholder de búsqueda, ×4) | `#636366` : `#8E8E93` | oscuro ≈ 2,0:1 · claro ≈ 3,5:1 |
                          | `SongListScreen` (texto tenue, ×3) | `#6C6C70` : `#B0B0B5` | oscuro ≈ 2,2:1 · claro ≈ 2,2:1 |
                          | `PlaylistRow`, `SongListItem`, `CommandPalette` (×3) | `#636366` : `#A0A0A8` | oscuro ≈ 2,0:1 |

                          Puede ser deliberado (un placeholder tenue lo es a propósito) o puede ser
                          que alguien intercambiara las ramas del ternario al copiar. Lo que no
                          encaja es que en **los dos** modos quede por debajo de 3:1 y que el modo
                          oscuro salga peor que el claro, cuando el resto de la app hace lo
                          contrario. Está en la pantalla más usada de la app, así que **hay que
                          mirarlo en un dispositivo antes de tocarlo**; no se cambió nada.
                          Si resulta ser un bug, el arreglo es `themeColors(isDark).textMuted`.

Cosas que aparecieron **al ejecutar**, no al planificar. Ninguna es urgente y
ninguna se tocó, porque todas necesitan verse en un dispositivo.

- [x] **H8. ❌ DECIDIDO QUE NO (2026-08-31).** Lo iba a hacer y el test de
      contraste lo desaconsejó: si a las cards oscuras se les da su color
      propio (`#3A3A3C`), el texto terciario encima cae a **3,48:1** y deja de
      cumplir. O sea que no es un cambio de una línea: arrastra subir también
      el terciario, y entonces ya no es "terciario". Lo de ahora —plano con
      hairline— es coherente y se lee. Hay un test que lo deja anotado
      (`designTokens.test.ts`, "avisa de que el terciario NO vale sobre una
      card oscura") para que salte si alguien lo intenta.

      Enunciado original, para referencia:
                      **En modo oscuro no hay capas de superficie.** 38 sitios pintan las
                      cards con `#2C2C2E`, que es exactamente `Colors.dark.background`: la card
                      y el fondo son el mismo color, y solo se distinguen por el borde. El token
                      correcto (`Colors.dark.card`, `#3A3A3C`) existe y no se usa. Cambiarlo es
                      una línea, pero se ve en media app, así que hay que mirarlo en un
                      dispositivo. Lo mismo con `backgroundSunken` (`#1C1C1E`), que en la
                      práctica se escribe como `#2C2C2E`, o sea igual que el fondo.
                      La migración de agosto se dejó **byte-idéntica** a propósito para no
                      colar este cambio de tapadillo.

- [ ] **H9. Verificar en dispositivo lo que sí cambió.** Son tres cosas
      pequeñas y deliberadas: la sombra de toasts y FABs (0.30 → 0.22), los
      radios (`lg` 14→16, destacadas 18→20, hero 22→20) y el gris secundario
      unificado en el par con más contraste.
- [ ] **H10. `Colors.dark.text` es `#FFFFFF` puro.** Blanco puro sobre `#2C2C2E`
      es más duro de lo necesario; el resto de la app ya se había ido a
      `#F5F5F7` por su cuenta en 27 sitios. Candidato a unificar, con la misma
      verificación.
