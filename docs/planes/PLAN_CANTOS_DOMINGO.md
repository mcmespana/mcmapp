# PLAN_CANTOS_DOMINGO — «Cantos para este domingo»

> Estado (2026-11-16): **fases 1-4 HECHAS** (día litúrgico, motor, pantalla y
> entrada en el cantoral, tarjeta en Inicio). **Pendientes: Fase 0** (contar
> etiquetas; necesita acceso a Firebase o al repo del cantoral), **Fase 5**
> (estribillo del salmo) y **Fase 6** (temas, opcional). El plan sigue VIVO:
> no se mueve a `archivo/`. Doc viva de lo hecho:
> [`funcionalidades/CANTOS_DOMINGO.md`](../funcionalidades/CANTOS_DOMINGO.md).
> Función nueva del cantoral: abrir el cantoral el jueves y que te proponga una
> misa entera para el domingo (entrada, salmo, aleluya, ofertorio, santo,
> comunión, salida), con el tiempo litúrgico bien puesto, sin repetir siempre
> las mismas, y que con un toque pase a «Tu selección» y de ahí al coro.
> Todo es **OTA** (ver §9). Las 🔒 están al final, ya contestadas.
>
> **Sin la Fase 0 el motor funciona pero «a ciegas»**: no se sabe cuántas
> canciones llevan etiqueta de tiempo o de fiesta; sin ellas todo es neutro y
> propone por rotación (no falla). El vocabulario de `SEASON_TAGS`
> (`constants/massMoments.ts`) es la forma acordada, no una medición.
>
> **Diferencias entre lo escrito y lo hecho** (donde el código real mandó):
> - Lo recordado por fecha guarda el **filename** elegido por momento, no un
>   índice (`{ [fecha]: { [momento]: filename | 'quitado' } }`): un índice se
>   desplazaba solo cuando una elección anterior liberaba una canción.
> - `categoryHint` de «Pasar a Tu selección» es la **categoría** de la que sale
>   la canción (como al importar de un coro), no el momento.
> - «Subir a mi coro» abre el paso de guardar con el nombre por defecto de
>   siempre («Canciones 21 nov»), no «Eucaristía domingo 22 nov»; y no hay
>   botón «Hoy» en el selector de fechas (solo Anterior / Siguiente).
> - El filtro de Cuaresma es más estricto que §4.3: además de la aclamación,
>   **ninguna canción con «aleluya» en el título** sale en ningún momento.
> - La tarjeta de Inicio se enciende con el id `cantos-domingo` en
>   `homeButtons` (opt-in): hasta que se añada en `/profileConfig` de Firebase
>   no sale a nadie (el seed y el fallback de la app ya lo traen).
> - `getLiturgicalInfo` vive ahora en `utils/liturgicalDay.ts`; el badge lo
>   reexporta. Se añadió `LiturgicalColors.white`.

---

## 1. De dónde sale y qué NO es

Quien prepara los cantos de su parroquia o de su coro hace cada semana lo
mismo: mirar qué domingo toca, abrir cinco categorías y elegir una de cada
evitando la de la semana pasada. La app ya tiene las tres piezas que hacen falta
para ahorrárselo, solo que no se hablan:

- **el calendario litúrgico** empaquetado en la app (`mcm-app/assets/calendario-liturgico.json`),
- **las lecturas** que trae el scraper cada noche (`seccion_oracion/lecturas/<fecha>`),
- **el cantoral** con sus categorías por momento y sus etiquetas `{tags:}`.

No es: un recomendador «inteligente», ni una llamada a un LLM desde el móvil, ni
un nodo nuevo de Firebase escrito desde la app. Las fases 1-4 son **reglas
deterministas sobre datos que ya hay**; el cruce temático lectura↔canción es
opcional y va precalculado fuera de la app (§8).

---

## 2. Qué señal del día hay de verdad (inventario)

### 2.1 Calendario litúrgico (en la app, sin red) ✅ la señal buena

`mcm-app/assets/calendario-liturgico.json` (ventana de 5 años generada por
`npm run liturgical:window` desde `-completo.json`, candado en
`__tests__/liturgicalWindow.test.ts`). Por año civil trae:

| Campo | Qué es | Sirve para |
| ----- | ------ | ---------- |
| `tiempos[]` `{id, nombre, inicio, fin}` | `adviento`, `navidad`, `cuaresma`, `semana_santa`, `pascua`, `ordinario` | **El tiempo litúrgico** del día |
| `fechas_especiales[]` `{id, fecha, nombre}` | 22 móviles/fijas: Ramos, Triduo, Resurrección, Ascensión (jue y dom), Pentecostés, Trinidad, Corpus (jue y dom), Cristo Rey, Navidad, Sagrada Familia, Epifanía, Bautismo, Candelaria, Ceniza, Sta. María Madre de Dios | La **fiesta** del día |
| `domingos_adviento[4]`, `domingos_cuaresma[5]` | fechas | Número de domingo en esos tiempos, Gaudete/Laetare |
| `pascua` | fecha | Número de domingo de Pascua (II-VII) |
| `ciclo_dominical` | `A`/`B`/`C` | Ciclo del leccionario (⚠️ ver abajo) |

Ya lo consume `getLiturgicalInfo(dateStr)` en
`mcm-app/components/contigo/LiturgicalBadge.tsx` (devuelve nombre + color
litúrgico), y lo usan Contigo y su badge.

**Huecos reales del calendario** (todos se cubren en la app o en el generador,
sin red):

1. **No hay «domingo N».** Ni «XXXIII del Tiempo Ordinario» ni «IV de Pascua».
   Se calcula (§4.1): TO antes de Cuaresma cuenta desde el Bautismo; TO después
   de Pentecostés cuenta **hacia atrás desde Cristo Rey = XXXIV**.
2. **`ciclo_dominical` va por año CIVIL y está mal desde Adviento.** El año
   litúrgico empieza el 1.er domingo de Adviento: el 2026-11-29 ya es ciclo
   **B**, pero el JSON de 2026 dice `A` hasta el 31 de diciembre. Hoy no lo usa
   nadie en la app (comprobado con `grep`), por eso no se ha notado. Se calcula
   bien en `utils/liturgicalDay.ts` y no se lee el campo.
3. **Faltan las solemnidades de fecha fija que pueden caer en domingo:**
   Inmaculada (8 dic), San José (19 mar), San Pedro y San Pablo (29 jun),
   Santiago (25 jul, España), Transfiguración (6 ago), Asunción (15 ago),
   Exaltación de la Cruz (14 sep), Todos los Santos (1 nov), Dedicación de
   Letrán (9 nov). Ejemplo real: el **2026-11-01 fue domingo y Todos los
   Santos**, y el calendario lo da como TO XXXI. Se añaden en el generador
   (`scraper-lecturas/generador-calendario-liturgico/generar-calendario-liturgico.js`)
   y se regenera la ventana. Es un JSON empaquetado: **OTA**.
4. **El color litúrgico no está en el JSON**: lo deriva `getLiturgicalInfo`.
   Suficiente.

### 2.2 Lecturas del scraper (Firebase, con caché) ✔️ útil pero secundaria

`scraper-lecturas/` corre a las 00:05 UTC (GitHub Action) y deja en
`seccion_oracion/lecturas/<YYYY-MM-DD>/` los nodos `evangelio`, `lectura1`,
`lectura2`, `salmo` e `info`, con el patrón `activo` + `<fuente>Campo`.

| Fuente | Fechas | Qué escribe |
| ------ | ------ | ----------- |
| Dominicos | **hoy … +30 días** | citas y textos de las 3 lecturas + salmo + evangelio |
| Vatican News | +1 … +14 | comentario del evangelio |
| Vida Nueva | **solo hoy** | evangelio completo + `info` con `DiaLiturgico` («Domingo V de Cuaresma…») y `Titulo` |
| limpieza | — | borra lo anterior a hoy −30 |

Consecuencias para esta función:

- **Las citas del domingo que viene están siempre** (Dominicos va +30 días):
  primera lectura, salmo, segunda lectura, evangelio. Se leen con el hook que ya
  existe, `mcm-app/hooks/useDailyReadings.ts` (`readings.salmo.cita`,
  `readings.evangelio.cita`…), que además cachea por fecha en AsyncStorage.
- **El nombre litúrgico del día NO está para fechas futuras**: `info.DiaLiturgico`
  solo lo pone Vida Nueva y solo para hoy. Por eso el nombre del domingo sale
  del calendario (§2.1), no del scraper. Si la fecha objetivo es hoy y hay
  `info.diaLiturgico`, se puede preferir como texto (cosmético).
- **No hay tiempo litúrgico, color ni fiesta en el scraper.** No hace falta
  añadirlos: el calendario de la app los da mejor y sin red.
- **El estribillo del salmo se tira**: `strip_salmo_response`
  (`scraper-lecturas/utils/citations.py`) corta «R/. El Señor es mi pastor,
  nada me falta» y solo guarda «Salmo 22, 1-3…». Ese estribillo es justo lo
  que permite encontrar en el cantoral el salmo de ese domingo (los salmos
  cantados se titulan por su estribillo). **Esto sí conviene añadirlo** al
  scraper como campo nuevo (`dominicosRespuesta` en el nodo `salmo`), §7.
- No hay temas de las lecturas. Solo texto. Ver §8.

### 2.3 El cantoral (Firebase `songs/data`, con caché) — los momentos YA son categorías

El momento de la misa **no hay que inventarlo con etiquetas: es la categoría.**
Las claves de `songs/data` son las de `CATEGORY_CODES`
(`mcm-app/utils/offlinePlaylist.ts`) y `getCategoryFromFirebaseCategory`
(`mcm-app/utils/songUtils.ts`):

`entrada` · `salmos` · `aleluya` · `ofertorio` · `santo` · `comunion` ·
`salida` · `adoracion` · `himnos` (+ cualquier otra cae en `catZotros`).

Señal de **tiempo litúrgico de cada canción**, dos sitios:

- **`tags: string[]`** (directiva `{tags:}`, normalizada por `slugifyTag`,
  catálogo opcional en `songs/tags`) — `docs/funcionalidades/ETIQUETAS.md`. Ya
  hay ejemplos de vocabulario litúrgico en la propia doc (`domingo-de-ramos`).
- **`liturgicalTime?: string`** — campo de texto libre (`types/songMedia.ts`),
  se ve en la ficha como «T. litúrgico». ETIQUETAS.md §5 ya dejó escrito que
  un día se proyectaría al espacio de etiquetas como etiqueta de sistema.

**Cuántas canciones tienen hoy etiqueta de tiempo litúrgico o de momento: no lo
sé, y no lo he podido contar.** En este repo no hay ningún `songs.json` (vive
solo en Firebase, ETIQUETAS.md §2.1), el seed (`mcm-app/firebase-seed/`) no
trae canciones, la URL real de la base solo está en `.env.local` (que no se
toca) y esta sesión no tiene acceso al repo `mcmapp-cantoral`. La única cifra
documentada es el tamaño: **258 `.cho`** (PLAN_HOJA_CANCION §1, octubre 2026).
La Fase 0 saca el número de verdad antes de escribir UI.

### 2.4 Resumen

| Señal | ¿Hay? | De dónde |
| ----- | ----- | -------- |
| Tiempo litúrgico del día | ✅ | calendario empaquetado |
| Fiesta móvil (Ramos, Pentecostés, Corpus, Cristo Rey…) | ✅ | calendario |
| Solemnidad fija en domingo (Todos los Santos, Inmaculada…) | ❌ → añadir | generador del calendario (Fase 1) |
| Domingo N y ciclo A/B/C correcto | ❌ → calcular | `utils/liturgicalDay.ts` (Fase 1) |
| Citas de lecturas del domingo | ✅ | scraper (Dominicos, +30 días) |
| Estribillo del salmo | ❌ → añadir | scraper (Fase 5) |
| Temas de las lecturas | ❌ | precalculado fuera (Fase 6, opcional) |
| Momento de cada canción | ✅ | categoría |
| Tiempo litúrgico de cada canción | ⚠️ cobertura desconocida | `tags` + `liturgicalTime` |

---

## 3. Qué ve el usuario

### 3.1 Entrada principal: una fila en la home del cantoral

En `CategoriesScreen`, la lista ya empieza con la fila «Tu selección» (y en
iPad, su hero). Debajo, **una fila más**, mismo estilo de fila que las
categorías (no una tarjeta nueva):

> **Cantos para el domingo** · 22 nov · Cristo Rey  ›

- Icono `IconSymbol` (nada de emoji como icono, design.md §8) y un **punto** del
  color litúrgico (no una franja: `noEdgeStripes`). Texto sobre color con
  `onColor`.
- Si el cantoral aún no ha cargado, la fila no aparece (como el botón 🏷️, que
  no existe si no hay etiquetas).

### 3.2 La pantalla «Cantos para el domingo»

Ruta nueva del stack del cantoral: `app/(tabs)/cancionero/domingo.tsx` →
re-exporta `app/screens/SundaySongsScreen.tsx`. Nombre de pantalla
`'SundaySongs'` en `CANTORAL_SLUGS` (`utils/eventRoutes.ts`), se abre con
`openCantoral('SundaySongs', { fecha })`. La `fecha` va como texto
(`YYYY-MM-DD`), nunca un objeto.

De arriba abajo (todo dentro de la lista, `ListHeaderComponent`: el header es
transparente y lo que va fuera de la lista se pinta bajo la barra de estado,
ETIQUETAS.md §3.3):

1. **Cabecera del día**: «Domingo 22 de noviembre» (h2), debajo «XXXIV del
   Tiempo Ordinario · Jesucristo, Rey del Universo · Ciclo A» y el punto de
   color. Un selector discreto **‹ domingo anterior · siguiente ›** (y «Hoy» si
   hoy es una fecha especial entre semana: Jueves Santo, Ascensión en jueves…).
2. **Las lecturas, en una línea plegable**: «Ez 34 · Sal 22 · 1 Co 15 · Mt 25»;
   al tocar, enlaza a Contigo → evangelio de esa fecha. Si no hay red ni caché,
   la línea no sale (no es imprescindible).
3. **Una sección por momento**, con `SectionHeader`: Entrada, Salmo, Aleluya
   (o «Aclamación» en Cuaresma, §4.3), Ofertorio, Santo, Comunión, Salida.
   Cada sección muestra **una** canción sugerida en una fila como las del
   cantoral (`SongListItem`: título, autor, píldora de tono), con:
   - tocar → abre la canción (`openCantoral('SongDetail', songRouteParams(...))`);
   - **«Cambiar»** (botón de icono, ↻) → la siguiente candidata del ranking,
     en el sitio, con `h.select`;
   - **mantener / menú** → «Elegir otra…» abre la lista completa de candidatas
     de ese momento ordenada por puntuación, con la razón en pequeño
     («Cuaresma», «Cristo Rey», «hace 5 semanas»);
   - **quitar** el momento (no todas las misas cantan salida).
4. **Pie con la acción principal** (`AppPrimaryButton`): **«Pasar a Tu
   selección»**, y una secundaria **«Subir a mi coro»** si hay coro elegido.

Las elecciones del usuario (cambios y quitados) se recuerdan **por fecha en el
dispositivo** (§6), así que volver el sábado enseña lo que dejó el jueves.

### 3.3 Qué puede hacer con la lista

- **Pasar a Tu selección**: `replaceAll` de `SelectedSongsContext` con las
  canciones en orden de misa y `categoryHint` = momento, y el mismo toast de
  **10 s con «Deshacer»** que ya usan los imports de coro (COROS.md
  «Importar»). Si la selección no está vacía, ese deshacer es la red: no hay
  diálogo de tres botones (la peor parte del flujo antiguo, según COROS.md).
- **Subir a mi coro**: pasa a Tu selección y abre directamente el paso `save`
  de la hoja del coro (`seleccion?hoja=coro`), con nombre propuesto
  «Eucaristía domingo 22 nov». Todo lo demás (contraseña `coco`, actualizar
  vs. subir como nueva, enlace `?coro=`) ya existe en `usePlaylistSharing`.
- **Compartir** (WhatsApp, PDF, QR): no se duplica aquí; está en el menú «⋯»
  de Tu selección. Una vez pasada la lista, es un toque.

### 3.4 Tarjeta en Inicio el fin de semana (Fase 4, 🔒 decisión 4)

De **viernes a domingo**, si el perfil tiene el tab `cancionero`, una tarjeta
en Inicio: «Cantos para el domingo · Cristo Rey» → abre la pantalla con
`fromOutside: true`. Estilo de tarjeta de contenido (`radii.lg`,
`shadows.card`), una sola, sin rejilla. `app/(tabs)/(inicio)/index.tsx` es
gigante (1.474 líneas) y **se queda gigante** (CLAUDE.md regla 13): la tarjeta
va como componente aparte en `components/home/SundaySongsCard.tsx` y en el
índice solo se monta.

---

## 4. El algoritmo (determinista, puro, testeable)

Todo vive en lógica pura sin React: `utils/liturgicalDay.ts` y
`utils/sundaySongs.ts`. La pantalla solo pinta.

### 4.1 El día objetivo — `utils/liturgicalDay.ts`

```ts
type SeasonId = 'adviento' | 'navidad' | 'cuaresma' | 'semana_santa' | 'pascua' | 'ordinario';

interface LiturgicalDay {
  fecha: string;            // YYYY-MM-DD
  season: SeasonId;
  feastId?: string;         // 'cristo_rey', 'pentecostes', 'todos_los_santos'…
  sundayNumber?: number;    // 34
  cycle: 'A' | 'B' | 'C';   // calculado por año litúrgico, NO el campo del JSON
  name: string;             // «XXXIV Domingo del Tiempo Ordinario»
  feastName?: string;       // «Jesucristo, Rey del Universo»
  colorHex: string;         // de LiturgicalColors
}

targetSunday(hoy: string): string      // hoy si es domingo; si no, el siguiente
liturgicalDayOf(fecha: string): LiturgicalDay
```

- **`targetSunday`**: domingo → hoy; lunes-sábado → el siguiente. (El sábado
  por la tarde ya es la vigilia del domingo: «siguiente» lo cubre.)
- **Domingo N**: Adviento y Cuaresma por índice en `domingos_adviento` /
  `domingos_cuaresma`; Pascua = `(fecha − pascua)/7 + 1` (II-VII; la
  Ascensión trasladada y Pentecostés salen como fiesta); TO tramo 1 =
  semanas desde el Bautismo + 1 (el domingo siguiente al Bautismo es el II);
  TO tramo 2 = `34 − semanas hasta Cristo Rey`.
- **Ciclo**: el del año civil del 1.er domingo de Adviento que abre el año
  litúrgico + 1 (`(añoLit) % 3`: 1→A, 2→B, 0→C, la misma regla del
  generador). Test con 2026-11-22 → A y 2026-11-29 → B.
- `getLiturgicalInfo` de `LiturgicalBadge.tsx` pasa a llamar a esta utilidad
  (o al revés, la utilidad absorbe su lógica de color y el badge la importa),
  para que Contigo y el cantoral no digan dos cosas distintas del mismo día.

### 4.2 Qué es cada canción — vocabulario cerrado

`constants/massMoments.ts` (catálogo, sin lógica):

```ts
// Momento → categorías de las que bebe (la primera es la propia) + etiquetas
// que convierten en candidata a una canción de otra categoría.
export const MASS_MOMENTS = [
  { id: 'entrada',   label: 'Entrada',   categories: ['entrada'],   tags: ['entrada'] },
  { id: 'salmo',     label: 'Salmo',     categories: ['salmos'],    tags: [] },
  { id: 'aleluya',   label: 'Aleluya',   categories: ['aleluya'],   tags: ['aclamacion'] },
  { id: 'ofertorio', label: 'Ofertorio', categories: ['ofertorio'], tags: ['ofertorio'] },
  { id: 'santo',     label: 'Santo',     categories: ['santo'],     tags: [] },
  { id: 'comunion',  label: 'Comunión',  categories: ['comunion', 'adoracion'], tags: ['comunion'] },
  { id: 'salida',    label: 'Salida',    categories: ['salida'],    tags: ['envio', 'mariana'] },
] as const;

// Etiqueta (slug) o texto de liturgicalTime → tiempo/fiesta de la canción.
export const SEASON_TAGS: Record<string, SeasonId | FeastId> = {
  adviento: 'adviento', navidad: 'navidad', cuaresma: 'cuaresma',
  'semana-santa': 'semana_santa', 'domingo-de-ramos': 'domingo_ramos',
  pascua: 'pascua', pentecostes: 'pentecostes', 'espiritu-santo': 'pentecostes',
  corpus: 'corpus_christi_domingo', 'cristo-rey': 'cristo_rey', …
};
```

El vocabulario exacto sale de la Fase 0 (lo que de verdad hay en `songs/tags`)
y se pacta con el repo del cantoral; lo de arriba es la forma.

Por cada canción de `filterSongsData(songs)`:

- **momentos**: su categoría, más los que le añadan sus etiquetas.
- **tiempos/fiestas**: sus `tags` que estén en `SEASON_TAGS`, más
  `liturgicalTime` pasado por `foldForSearch` y buscado contra las mismas
  claves (fallback de solo lectura, 🔒 decisión 1).
- Las canciones con alguna **etiqueta oculta** por el usuario
  (`useHiddenTags`) se excluyen si tiene activado
  `settings.hideHiddenTagSongs` — mismo criterio que las categorías.

### 4.3 Reglas litúrgicas duras (filtros, no puntos)

1. **Cuaresma y Semana Santa: nada de «Aleluya».** El momento se llama
   «Aclamación antes del Evangelio» y solo admite canciones etiquetadas
   `aclamacion` o `cuaresma` dentro de `aleluya`; si no hay ninguna, el
   momento sale vacío con «Sin aclamación de Cuaresma en el cantoral», no con
   un aleluya.
2. **Una canción marcada con un tiempo fuerte distinto no entra**: un villancico
   (`navidad`) no se sugiere en Pascua; uno de Cuaresma no en Navidad. Las que
   no tienen tiempo son **neutras** y valen siempre.
3. **Una canción no se repite** en dos momentos de la misma misa.
4. Si el día tiene fiesta y hay canciones de esa fiesta, **la fiesta manda**
   sobre el tiempo (Pentecostés > Pascua; Cristo Rey > TO).

### 4.4 Puntuación y variedad

Para cada momento, candidatas = canciones del momento que pasan §4.3.

| Señal | Puntos |
| ----- | ------ |
| Etiqueta de la fiesta del día | +5 |
| Etiqueta del tiempo del día | +3 |
| Neutra (sin tiempo) | 0 |
| (Fase 5) Salmo: el estribillo del día casa con el título | +10 |
| (Fase 6) Cada tema compartido con las lecturas | +2 |

**Variedad sin historial y sin red** (🔒 decisión 2): dentro de cada tramo de
puntuación el desempate es una **rotación determinista por fecha**:

```
orden = sortBy(-puntos, hash(filename + momento) rotado por nºSemana(fecha))
```

- Misma fecha → misma propuesta **en todos los móviles** (el director del coro
  y el guitarrista ven la misma misa sin compartir nada).
- Domingo siguiente → otra canción del mismo tramo; una canción vuelve a salir
  cuando el tramo da la vuelta (con 20 entradas neutras, cada ~20 semanas).
- «Cambiar» = siguiente del ranking; no aleatorio, así que «Cambiar» dos veces
  y volver es predecible.

Lo que **no** se hace en la Fase 2: penalizar lo que tu coro cantó la semana
pasada. Se puede añadir luego leyendo la última playlist del coro
(`/choirs/{id}`), pero rompe la propiedad «todos ven lo mismo» y cuesta red.

### 4.5 Salida de `sundaySongs.ts`

```ts
interface MomentSuggestion {
  moment: MassMomentId;
  label: string;                 // 'Aclamación' en Cuaresma
  candidates: { filename: string; categoryKey: string; score: number; reasons: string[] }[];
  emptyReason?: string;
}
suggestMass(day: LiturgicalDay, songs: SongsData, opts?): MomentSuggestion[]
```

La pantalla elige `candidates[índiceElegido]`, donde el índice sale del estado
guardado por fecha (§6) o es 0.

---

## 5. Diseño (design.md)

- Territorio **institucional** (cantoral): nada del dorado de Contigo aunque
  se hable de liturgia. El color litúrgico solo en el **punto** de la cabecera
  (y en la tarjeta de Inicio), con `LiturgicalColors` y `onColor`.
- Filas: las del cantoral (`SongListItem`), no tarjetas dentro de tarjetas.
  Secciones con `SectionHeader`. Carga: `ListSkeleton`. Sin cantoral cargado
  y sin caché: `EmptyState`.
- Botones de icono con `PressableFeedback`, ≥44 pt, `accessibilityLabel`
  («Cambiar el canto de entrada»). Haptics con `h.select` / `h.add`.
- Copy corto: «Cantos para el domingo», «Cambiar», «Pasar a Tu selección».
  Nada de «¡Tu misa perfecta!».
- `fontScale` grande: la fila del momento pasa a dos líneas; probar con
  `useLargeText`.
- Antes de cerrar la fase de UI: checklist de design.md §10 y
  `designTokens`, `noNewMagicNumbers`, `noEdgeStripes` en verde.

---

## 6. Sin red

| Pieza | Sin red | Por qué |
| ----- | ------- | ------- |
| Día litúrgico, ciclo, domingo N | ✅ siempre | JSON empaquetado |
| Sugerencias | ✅ si el cantoral se abrió alguna vez | `useFirebaseData('songs', 'songs', filterSongsData)` cachea en AsyncStorage y deduplica por clave: **no hay descarga nueva** |
| Elecciones del usuario por fecha | ✅ | AsyncStorage `@mcm_sunday_songs_v1` = `{ [fecha]: { [momento]: índice \| 'quitado' } }`, podado a ±60 días al abrir (mismo patrón que `pruneDailyReadingsCache`) |
| Línea de lecturas | ⚠️ solo si está en caché | `useDailyReadings(fecha)`; si no hay, la línea no se pinta |
| Pasar a Tu selección | ✅ | local |
| Subir a mi coro | ❌ | necesita Firebase; el flujo actual ya avisa |

Mejora barata opcional: cuando Contigo carga lecturas, que precargue también
las del domingo siguiente (una lectura más de `useDailyReadings`). No se hace
en la Fase 3: la pantalla funciona sin ellas.

Todo esto lo cumple también la web (no hay nada nativo); el `.web` no necesita
variante.

---

## 7. Cambios en el scraper (Fase 5)

Uno solo, pequeño, y no bloquea nada:

- `scrapers/base.py`: `EvangelioData.salmo_respuesta: Optional[str]`.
- `scrapers/dominicos.py` (y `vida_nueva.py` si la trae): guardar el texto que
  hoy tira `strip_salmo_response` en `utils/citations.py` — añadir una
  `extract_salmo_response(raw)` hermana que devuelva lo de después de `R/.`.
- `to_salmo_payload`: `"<fuente>Respuesta"`.
- App: `useDailyReadings` añade `salmo.respuesta` (opcional, tolerante a que
  no exista para fechas antiguas).
- Tests: `scraper-lecturas/tests/test_citations.py` y `test_dominicos.py` con
  el fixture de domingo que ya hay (`tests/fixtures/dominicos_sunday.html`
  trae «R/. Este es el día en que actuó el Señor…»).

Lo que **no** se añade al scraper: tiempo litúrgico, color, fiesta ni domingo N
— el calendario de la app ya los da sin red y para cualquier fecha; meterlos en
el scraper sería una segunda fuente que puede contradecir a la primera.

Emparejar salmo del día ↔ canción (en `sundaySongs.ts`): `foldForSearch` del
estribillo contra el título y contra etiquetas `salmo-NN`. ⚠️ La numeración
del leccionario español es la **griega/Vulgata** («Sal 22, El Señor es mi
pastor», que en la Biblia hebrea es el 23): si el cantoral etiqueta por número,
tiene que ser con la del leccionario. Por eso el estribillo es mejor llave que
el número.

---

## 8. Cruce temático lectura ↔ canción (Fase 6, OPCIONAL)

Solo si las fases 1-4 se usan y se echa en falta. Dos piezas, las dos fuera
del móvil:

1. **Etiquetas de tema en las canciones**, curadas a mano en `mcmapp-cantoral`
   con el editor del admin (catálogo en bloque, ETIQUETAS.md §6):
   `misericordia`, `pan-de-vida`, `envio`, `luz`, `pastor`, `agua`,
   `perdon`, `confianza`, `reino`, `servicio`… (15-25, no más).
2. **Tabla «domingo del leccionario → temas»**, precalculada: el leccionario
   dominical se repite cada 3 años, así que es **finita** (~3 × 60 domingos y
   solemnidades). Clave `(ciclo, tiempo, domingoN | fiesta)` → `["pastor",
   "reino"]`. Se genera una vez fuera de la app (a mano, o con un script/LLM
   en el ordenador de quien la mantiene y **revisada por una persona**),
   se commitea como JSON y se empaqueta: `mcm-app/assets/leccionario-temas.json`
   (OTA, sin red). Alternativa si se quiere editar sin release: nodo
   `songs/leccionarioTemas` publicado por el mismo CI del cantoral (mismo
   permiso que `songs/tags`, sin escribir desde la app).

`sundaySongs.ts` suma +2 por tema compartido y añade la razón («Buen Pastor»).
Nada de embeddings ni de llamadas a un LLM desde el móvil.

---

## 9. Fases

Cada fase es un commit (o pocos), se puede parar entre fases, y **todas son
OTA** salvo lo que no toca la app (scraper, cantoral). Ninguna añade
dependencias nativas: calendario y tabla de temas son JSON empaquetados (van en
el bundle JS), el resto es TypeScript sobre contextos que ya existen.

### Fase 0 — Inventario de etiquetas (sin código de app) ⏳ PENDIENTE

- **Qué**: contar, sobre un export real de `songs/data` + `songs/tags`,
  canciones por categoría, cuántas tienen etiqueta de tiempo/fiesta, cuántas
  `liturgicalTime` y con qué valores, y qué slugs litúrgicos existen. Script de
  un solo uso en el scratchpad (no se commitea) o el «informe de etiquetas»
  que ya imprime el generador de `mcmapp-cantoral`.
- **Salida**: tabla en este plan (§2.3) y el vocabulario definitivo de
  `SEASON_TAGS`. Si menos de ~3 canciones por momento llevan cada tiempo
  fuerte, **curar antes de la Fase 3** en el admin del cantoral (etiquetado en
  bloque), o la función sugiere siempre neutras — que tampoco es malo, pero
  hay que saberlo.
- **Archivos**: `docs/planes/PLAN_CANTOS_DOMINGO.md` (solo este).
- **Modelo**: Haiku (contar) — necesita a alguien con acceso a Firebase o al
  repo del cantoral.
- **OTA**: n/a.

### Fase 1 — Día litúrgico completo ✅ HECHA (2026-11-16)

- **Qué**: `utils/liturgicalDay.ts` (§4.1); `getLiturgicalInfo` unificado con
  ella; solemnidades fijas añadidas al generador y ventana regenerada.
- **Archivos**:
  - nuevo `mcm-app/utils/liturgicalDay.ts`
  - `mcm-app/components/contigo/LiturgicalBadge.tsx` (delegar)
  - `scraper-lecturas/generador-calendario-liturgico/generar-calendario-liturgico.js`
  - `mcm-app/assets/calendario-liturgico-completo.json`,
    `mcm-app/assets/calendario-liturgico.json` (regenerados con
    `npm run liturgical:window`)
- **Tests**: nuevo `mcm-app/__tests__/liturgicalDay.test.ts` — `targetSunday`
  (lunes→domingo, domingo→mismo); domingo N en los cinco tiempos con fechas
  reales (2026-01-18 = II TO, 2026-11-15 = XXXIII TO, 2026-11-22 = Cristo
  Rey/XXXIV, 2026-11-29 = I Adviento, 2026-03-15 = IV Cuaresma/Laetare,
  2026-04-26 = IV Pascua); ciclo A→B en Adviento; 2026-11-01 = Todos los
  Santos. `liturgicalWindow.test.ts` sigue verde.
- **Modelo**: Sonnet.
- **OTA**: ✅ solo JS (el JSON va en el bundle).

### Fase 2 — Motor de sugerencias ✅ HECHA (2026-11-16)

- **Qué**: `constants/massMoments.ts` + `utils/sundaySongs.ts` (§4.2-4.5).
- **Archivos**: nuevos `mcm-app/constants/massMoments.ts`,
  `mcm-app/utils/sundaySongs.ts`; reutiliza `slugifyTag`, `foldForSearch`,
  `withoutHiddenTagSongs` de `utils/songTags.ts` y `filterSongsData`.
- **Tests**: nuevo `mcm-app/__tests__/sundaySongs.test.ts` con un `SongsData`
  de juguete (`utils/devFirebaseFixtures.ts` como modelo): sin Aleluya en
  Cuaresma; villancico fuera de Pascua; fiesta > tiempo; sin repetidas entre
  momentos; **misma fecha → mismo resultado**; fecha +7 → otra canción del
  mismo tramo; categoría vacía → `emptyReason`; ocultas fuera.
- **Modelo**: **Opus** (es el corazón: reglas litúrgicas + determinismo; un
  error aquí se ve cada domingo).
- **OTA**: ✅ solo JS.

### Fase 3 — Pantalla y entrada en el cantoral ✅ HECHA (2026-11-16)

- **Qué**: §3.1-3.3 y §6.
- **Archivos**:
  - nuevo `mcm-app/app/screens/SundaySongsScreen.tsx`
  - nuevo `mcm-app/app/(tabs)/cancionero/domingo.tsx` (re-export) y su
    `Stack.Screen` en `mcm-app/app/(tabs)/cancionero/_layout.tsx`
  - `mcm-app/utils/eventRoutes.ts` (`CANTORAL_SLUGS.SundaySongs = 'domingo'`)
  - `mcm-app/app/screens/CategoriesScreen.tsx` (fila de entrada)
  - nuevo `mcm-app/hooks/useSundaySongs.ts` (canciones cacheadas + día +
    estado por fecha en AsyncStorage + poda)
  - `mcm-app/contexts/SelectedSongsContext.tsx` solo si `replaceAll` necesita
    algo (en principio no)
  - nuevo `docs/funcionalidades/CANTOS_DOMINGO.md` (doc viva) + fila en la
    tabla de `CLAUDE.md` raíz + `docs/README.md`
  - `mcm-app/CHANGELOG.md` (pantalla nueva)
- **Tests**: `__tests__/router/` siguen verdes (la ruta es carpeta del stack);
  nuevo `__tests__/useSundaySongs.test.ts` (estado por fecha, poda, sin red con
  AsyncStorage mockeado); un test de render ligero de la pantalla que
  compruebe «Pasar a Tu selección» → `replaceAll` en orden de misa.
- **Modelo**: Sonnet.
- **OTA**: ✅ solo JS.

### Fase 4 — Tarjeta en Inicio el fin de semana ✅ HECHA (2026-11-16)

- **Archivos**: nuevo `mcm-app/components/home/SundaySongsCard.tsx`;
  `mcm-app/app/(tabs)/(inicio)/index.tsx` (montarla, nada más); si se quiere
  apagar por perfil, id nuevo en `KNOWN_HOME_BUTTONS`
  (`constants/profileCatalog.ts`) + `firebase-seed/profileConfig.json` +
  Firebase. CHANGELOG.
- **Tests**: la regla «vie-dom y con tab cancionero» como función pura
  (`shouldShowSundayCard(fecha, tabs)`) en `sundaySongs.test.ts`.
- **Modelo**: Sonnet (Haiku si ya está el componente y es solo montarlo).
- **OTA**: ✅ solo JS.

### Fase 5 — Estribillo del salmo (scraper + app) ⏳ PENDIENTE

- **Qué**: §7.
- **Archivos**: `scraper-lecturas/scrapers/base.py`,
  `scraper-lecturas/scrapers/dominicos.py`, `scraper-lecturas/utils/citations.py`,
  `scraper-lecturas/README.md` (estructura del nodo), tests del scraper;
  `mcm-app/hooks/useDailyReadings.ts`, `mcm-app/utils/sundaySongs.ts`
  (+10 al salmo que casa) y sus tests.
- **Despliegue**: el scraper se despliega solo al llegar a `main` (Action
  nocturna); lanzar una vez `--backfill-dominicos` para rellenar los 30 días.
  La app tolera que el campo no esté.
- **Modelo**: Sonnet.
- **OTA**: ✅ la parte de app es solo JS.

### Fase 6 — Temas (OPCIONAL, §8) ⏳ PENDIENTE

- **Archivos**: etiquetas de tema en `mcmapp-cantoral` (otro repo);
  nuevo `mcm-app/assets/leccionario-temas.json` (o nodo
  `songs/leccionarioTemas` + `useFirebaseData`); `utils/sundaySongs.ts`;
  tests.
- **Modelo**: Opus para diseñar la tabla y el vocabulario con el usuario;
  Haiku para rellenar/revisar filas una vez fijado el formato.
- **OTA**: ✅ solo JS (si es asset) / sin release (si es nodo).

**Resumen OTA**: Fases 1-6 → `OTA: ✅ — solo JS.` No hay `[skip-ota]` en
ningún commit de este plan.

---

## 10. Riesgos y cómo se miran

- **Pocas etiquetas** → sugerencias «neutras» siempre. Se ve en la Fase 0 y se
  cura en el admin del cantoral, no en la app.
- **Una regla litúrgica mal** (un aleluya en Cuaresma) es lo que quema la
  confianza en la función: por eso son filtros duros y cada uno tiene su test.
- **Calendario sin solemnidades fijas** → domingo mal nombrado: Fase 1.
- **Dos verdades del día** (Contigo vs. cantoral): `getLiturgicalInfo` y
  `liturgicalDay` comparten código desde la Fase 1.
- **La ventana del calendario caduca** → ya hay candado
  (`liturgicalWindow.test.ts`).

---

## 11. 🔒 Decisiones del usuario

> **Todas contestadas el 2026-11-16** (las recomendadas). Se mantiene el
> razonamiento original debajo de cada una.

1. ✅ **¿De dónde sale el tiempo litúrgico de una canción?** → **c**: las
   etiquetas son la fuente de verdad y `liturgicalTime` se lee solo como
   respaldo (sin escribirlo ni migrarlo). No obliga a re-etiquetar hoy y va en
   la dirección que ya marcó ETIQUETAS.md §5.

2. ✅ **¿Todos ven la misma sugerencia para el mismo domingo?** → **La misma**
   (rotación determinista por fecha, sin red ni historial). Es lo que permite
   que un coro hable de «la misa que propone la app» sin compartir nada. La
   variedad personal (no repetir lo que tu coro cantó) queda para después.

3. ✅ **¿Qué momentos salen?** → **Los siete con categoría propia**: Entrada,
   Salmo, Aleluya/Aclamación, Ofertorio, Santo, Comunión (también de
   Adoración) y Salida. Señor ten piedad, Gloria, Paz y Cordero solo si un día
   existen etiquetas para ellos; no se inventan categorías.

4. ✅ **¿Tarjeta en Inicio de viernes a domingo?** → **Sí**, solo con el tab
   del cantoral en el perfil y apagable por perfil (id `cantos-domingo` en
   `homeButtons`). Es la forma de que la función se descubra.

5. ✅ **«Pasar a Tu selección»: ¿reemplaza o añade?** → **Reemplaza con 10 s de
   «Deshacer»**, igual que importar del coro. Una misa es una lista entera.

6. ✅ **¿Se hace la fase temática (§8)?** → **No por ahora**: primero las fases
   1-4 y ver si se usan. Si se hace, tabla curada por domingo del leccionario
   empaquetada en la app, revisada por una persona.
