# PLAN_TAGS.md — Etiquetas del cantoral

> **Estado:** ✅ **Fase 2 (app) implementada** el 2026-08-13 sobre el diseño de
> Claude Design **variante 1d** ("etiquetas desde el header del cantoral").
> La documentación viva de lo que hay es
> [`../funcionalidades/ETIQUETAS.md`](../funcionalidades/ETIQUETAS.md); este
> plan se conserva como registro del razonamiento de diseño.
>
> ⏳ **Falta la fase 1 en `mcmapp-cantoral`** (directiva `{tags:}` en el
> generador + `tags.json` → `songs/tags`). Hasta que llegue, la app no muestra
> nada: sin canciones etiquetadas el botón del header ni se pinta. Ver §6 de
> `ETIQUETAS.md` para el contrato exacto que espera la app.
>
> **Decisiones de §7, resueltas al ejecutar:** (1) etiquetas **compartidas**,
> curadas desde el repo; (2) **emoji sí**, opcional por etiqueta; (3) el
> etiquetado **desde la app** NO entra todavía (sigue en fase 4).
>
> **Desviaciones respecto a este plan** (todas del diseño 1d, que se hizo
> después): la entrada principal es el **botón 🏷️ del header** y una nube
> completa en una hoja, no la fila de destacadas en la portada (§4.2, que
> metía una tercera fila horizontal compitiendo por el scroll); y el
> `SegmentedControl` "Por categoría / A–Z" se sustituye por la **barra amarilla
> de contexto** (una sola capa nueva sobre la lista en vez de dos).
>
> **Repos implicados:** `mcmapp` (este) + `mcmapp-cantoral` (fuente de verdad
> del contenido; normalmente **no** está en el scope de la sesión, hay que
> pedir `add_repo`).
>
> Creado: 2026-08-12. Ejecutado (app): 2026-08-13.

---

## 1. Qué se quiere

Poder etiquetar canciones con etiquetas **libres, transversales y añadidas con
el tiempo**: "viejunas", "domingo de ramos", "infantiles", "animación"… y poder
ver de un tirón todas las canciones de una etiqueta, **agrupadas por categoría**
(porque una etiqueta útil es precisamente la que cruza categorías).

Tres propiedades que definen el diseño y que no son negociables:

1. **Libres**: se inventan sobre la marcha, sin declararlas antes en ningún
   sitio. Un vocabulario cerrado mata la funcionalidad.
2. **Transversales**: una etiqueta no vive dentro de una categoría. Es
   ortogonal al árbol actual del cantoral.
3. **Poco sitio**: el cantoral en móvil ya está lleno (barra flotante, buscador
   nativo, píldora de tono, puntos de multimedia, swipe). Cualquier UI nueva
   compite por píxeles que no hay.

---

## 2. Tesis de diseño

> **Una etiqueta no es un filtro, es una puerta de entrada al cantoral.**

Si se trata como filtro, acaba siendo un modal de checkboxes que nadie abre y
que además exige conocer de antemano el vocabulario. Si se trata como puerta —
algo a lo que se **entra** desde la búsqueda, desde la portada del cantoral y
desde la propia canción — se usa sola.

Consecuencia práctica: **el punto de entrada principal es el buscador que ya
existe**, no una UI nueva. Es lo único que resuelve el problema real de las
etiquetas libres, que es que **nadie recuerda qué etiquetas hay**.

---

## 3. Modelo de datos

### 3.1 Dónde viven las etiquetas

`songs/data` en Firebase lo **sobrescribe entero** cada push a `main` de
`mcmapp-cantoral` (PUT completo — ver
[`PLAN_INTEGRACIONES.md` §Integración E](PLAN_INTEGRACIONES.md)). Por tanto:

- ❌ **No** escribir etiquetas directamente en Firebase desde el panel: se
  pierden en el siguiente push.
- ✅ Las etiquetas **nacen en el repo del cantoral** y llegan a Firebase por el
  camino normal del contenido. Así van versionadas en git, revisables en un
  diff, y no hay nodo nuevo que proteger en `database.rules.json`.

### 3.2 Pertenencia — directiva `{tags:}` en el `.cho`

Misma familia que la directiva propia `{arr:}` ya existente
([`ARREGLOS.md`](../funcionalidades/ARREGLOS.md)):

```
{title: Alma misionera}
{tags: viejunas, animacion, envio}
```

- Una sola directiva `{tags:}` por canción, valores separados por comas.
- Se normaliza a **slug** (minúsculas, sin acentos, guiones):
  `Domingo de Ramos` → `domingo-de-ramos`.
- El generador la vuelca a `tags: string[]` en cada entrada de
  `songs-vX.json`.

### 3.3 Catálogo — `tags.json` en el repo del cantoral

Metadatos **opcionales** de cada etiqueta:

```jsonc
{
  "viejunas": {
    "label": "Viejunas",
    "emoji": "🕰️",
    "orden": 1,
    "destacada": true,
    "alias": ["viejuna", "antiguas"]
  },
  "domingo-de-ramos": { "label": "Domingo de Ramos", "emoji": "🌿" }
}
```

| Campo | Para qué |
| ----- | -------- |
| `label` | Nombre bonito con acentos y mayúsculas |
| `emoji` | Icono del chip (ver §6, por qué emoji y no color) |
| `orden` | Orden en la fila de destacadas |
| `destacada` | Si sale en la portada del cantoral o solo en el listado completo |
| `alias` | Slugs que se colapsan sobre esta etiqueta (higiene del vocabulario) |

> ⚠️ **El catálogo es opcional y esa es la pieza clave.** Una etiqueta que
> aparece en un `.cho` y **no** está en `tags.json` funciona igual: se muestra
> con el slug capitalizado y sin emoji. Se declara el día que la etiqueta se
> consolide, no antes. Sin esto se pierde el requisito de "etiquetas libres
> para ir añadiendo como me venga bien".

El generador publica el catálogo resuelto (declaradas + descubiertas, con el
recuento de canciones de cada una) en `songs/tags`, junto a `songs/data`.

### 3.4 En la app

Cambios mínimos, **todo OTA-safe**:

- `SongEntry` (`mcm-app/utils/filterSongsData.ts`) gana `tags?: string[]`.
- El índice inverso (etiqueta → canciones) se construye en un `useMemo` sobre
  `songsData`. Con ~1.500 canciones es instantáneo; **no hace falta** nodo
  nuevo de Firebase, ni `useFirebaseData` nuevo, ni caché nueva, ni tocar
  `database.rules.json`.
- Ojo: `filterSongsData` descarta las canciones `pendiente`/`borrador`, así que
  los recuentos de la app pueden diferir de los del generador. El recuento
  visible **se calcula en la app**, sobre los datos ya filtrados.

### 3.5 Relación con `liturgicalTime` / `album` / `rhythm`

Ya existen tres campos de texto libre en `types/songMedia.ts` que son
**proto-etiquetas** (valor único, sin índice). Si las etiquetas nacen sin
plan, "Adviento" acaba existiendo en dos sitios.

**Decisión: en la fase 1 no se tocan.** Más adelante (§5, fase 4) se proyecta
`liturgicalTime` al espacio de etiquetas como **etiqueta de sistema** —
derivada, no editable, generada — en vez de duplicarla a mano en los `.cho`.

---

## 4. Flujo de usuario

### 4.1 La búsqueda entiende etiquetas ★ (lo más importante)

Al escribir "viejun" en el buscador que **ya existe**, encima de los resultados
aparece una fila con `🕰️ Viejunas · 34 canciones`. Se toca y se entra a la
etiqueta.

- **Coste de espacio: cero.** El buscador ya está (nativo en iOS/Android vía
  `headerSearchBarOptions`, custom en web).
- Resuelve el problema del vocabulario libre: no hay que aprenderse las
  etiquetas, se escribe lo que se le ocurra a uno y la app dice si existe algo
  parecido.
- Además, los `label` de las etiquetas de una canción se añaden a su
  `searchableText` (`SongListScreen.tsx`), así que buscar "ramos" saca también
  las canciones etiquetadas aunque no lleven la palabra en el título.

### 4.2 Fila de etiquetas destacadas en la portada del cantoral

En `CategoriesScreen`, bajo "🔎 Buscar una canción" y "Tu selección": una fila
horizontal de chips con las etiquetas `destacada: true`, y un chip final
`Todas las etiquetas →` que abre un `BottomSheet` con la lista completa
ordenada por recuento.

- Es lo que hace que las etiquetas **existan** para quien no las busca.
- **Solo destacadas**: 40 chips ahí es ruido, no descubrimiento.
- Patrón ya resuelto en el repo: `renderFilterChips()` de
  `app/(tabs)/calendario.tsx` (ScrollView horizontal de chips toggleables).

### 4.3 La pantalla de una etiqueta = `SongListScreen` con categoría virtual

Igual que los pseudo-IDs existentes `__ALL__` y `__SELECTED_SONGS__`, se añade
`__TAG__:<slug>`. Se hereda gratis la lista, el buscador, el swipe para añadir
a la playlist, los headers y el estado vacío.

**Agrupada por categoría, con cabeceras de sección, en el orden normal del
cantoral.** Precisamente porque una etiqueta es transversal, la categoría es el
contexto que falta. La lógica de agrupar por categoría ya existe en el memo
`categorized` de `SelectedSongsScreen`.

Un `SegmentedControl` (`components/ui/SegmentedControl.tsx`, ya existe) en el
header para `Por categoría / A-Z`. Por defecto: **por categoría**.

### 4.4 Cruzar etiquetas sin UI de filtros

Dentro de la pantalla de una etiqueta, una fila de chips con las etiquetas que
**coexisten** en ese resultado:

```
también aquí:  infantiles (12) · animación (5) · envío (3)
```

Se toca y se afina (AND). Se vuelve a tocar y se sale.

Es refinamiento progresivo: **nunca se ofrece una etiqueta que daría cero
resultados**, no hay modal, no hay booleanos, y se maneja con un pulgar. Muy
superior a un panel de filtros con checkboxes, que es la solución por defecto
si esto no se piensa.

### 4.5 Etiquetas en el detalle de canción

Chips discretos bajo el título/autor, y también en `SongMediaSheet` (que ya es
la "ficha" de la canción, junto a álbum / tiempo litúrgico / ritmo). Tocar un
chip lleva a la pantalla de esa etiqueta.

Este es el bucle que sostiene el sistema: se abre una canción, se ve que es
"viejuna", pica la curiosidad, se ven las otras 33.

### 4.6 Lo que NO se hace

- ❌ **Etiquetas en las filas de la lista.** `SongListItem` ya lleva píldora de
  tono con transposición, puntos de multimedia y dos direcciones de swipe.
  Meter chips ahí la revienta. En la búsqueda global el contexto útil ya es la
  categoría, que se muestra.
- ❌ **Modal de filtros con checkboxes.** Ver §4.4.
- ❌ **Nodo nuevo de Firebase.** Ver §3.1.

### 4.7 Móvil vs tablet/escritorio

| | Móvil | Tablet / web ancho |
| --- | --- | --- |
| Entrada principal | Buscador (§4.1) | Buscador + rail lateral persistente |
| Etiquetas destacadas | Fila horizontal de chips | Rail lateral con todas |
| Multi-etiqueta | Refinamiento progresivo (§4.4) | Multi-selección real (AND de varias a la vez) |
| Extra | — | `CommandPalette` (⌘K) indexa las etiquetas como comandos: ya tiene un array `keywords[]` pensado para esto |

El cantoral ya tiene layout hero + grid en pantalla ancha
(`useResponsiveLayout`), así que el rail cabe sin rediseñar nada.

---

## 5. Quién pone las etiquetas

El grueso se gestiona en `mcmapp-cantoral` (editar los `.cho` y `tags.json`).
Pero conviene dejar apuntado esto, porque decide si la funcionalidad se usa o
se muere:

> **Etiquetar en un editor de texto, en una sesión aparte, no pasa nunca.
> Etiquetar mientras usas el cantoral, sí.**

Y la fontanería ya está montada: modo admin (`isAdmin` en `SettingsContext`),
`SecretPanelModal`, y sobre todo la cola `songs/ediciones` que
`sincronizaCambiosDeFirebase.py` vuelca de vuelta a los `.cho`. Es **el mismo
circuito** que ya se usó para los arreglos con long-press
([`ARREGLOS.md`](../funcionalidades/ARREGLOS.md)).

Propuesta: una acción **"Etiquetas"** en el menú de long-press de la lista
(el `BottomSheet` de "Añadir a la lista" / "Compartir"), con **autocompletado
sobre las etiquetas existentes** — que además es lo que frena la degeneración
del vocabulario (`viejunas` / `viejuna` / `antiguas`). Las etiquetas se van
poniendo solas mientras se prepara una celebración.

Queda como **decisión 3** de §7: si entra en la fase 1 o solo se etiqueta desde
el repo.

---

## 6. Detalles menores ya decididos

- **Emoji, no color.** Las categorías ya usan emoji final (existe
  `EMOJI_REGEX` en `CategoriesScreen`) y el tab del cantoral es amarillo
  (`TabHeaderColors.cancionero`): meter N colores de etiqueta se pelearía con
  la identidad del tab.
- **Slug vs label.** El slug es el identificador estable (lo que va en el
  `.cho` y en el índice); el label solo es presentación. Renombrar una etiqueta
  = cambiar el `label` del catálogo, sin tocar los `.cho`.
- **`alias`** absorbe los duplicados inevitables sin reescribir ficheros.

---

## 7. Decisiones pendientes (preguntar antes de ejecutar)

| # | Decisión | Por qué importa |
| - | -------- | --------------- |
| 1 | **¿Etiquetas compartidas o también personales?** El plan asume **compartidas** y curadas desde el repo. | Unas etiquetas personales por usuario son otra cosa distinta (AsyncStorage, patrón `SelectedSongsContext`) y se dejarían para después. |
| 2 | **¿Emoji por etiqueta, confirmado?** Recomendación en §6. | Afecta al catálogo y al diseño de los chips. |
| 3 | **¿Entra el etiquetado desde la app (§5) en la fase 1**, o solo desde el repo? | Es lo que hace que las etiquetas se pongan de verdad, pero añade UI de admin y cola de ediciones a la primera entrega. |

---

## 8. Fases

| Fase | Qué | Repos | OTA |
| ---- | --- | ----- | --- |
| **1** | Directiva `{tags:}` + `tags.json` + generador → `songs/data.tags` y `songs/tags` | `mcmapp-cantoral` | — |
| **2** | `SongEntry.tags`, índice inverso, búsqueda con etiquetas (§4.1), fila de destacadas (§4.2), pantalla `__TAG__:` agrupada por categoría (§4.3) | `mcmapp` | ✅ Sí |
| **3** | Refinamiento progresivo (§4.4), chips en el detalle (§4.5), rail de tablet/escritorio (§4.7) | `mcmapp` | ✅ Sí |
| **4** | Etiquetado desde la app (§5, si decisión 3 = sí) · `liturgicalTime` como etiqueta de sistema (§3.5) | ambos | ✅ Sí |

Todo es OTA-safe: no hay dependencias nativas nuevas.

**Tests a extender:** `__tests__/filterSongsData.test.ts` (normalización de
slugs, tolerancia a etiquetas fuera del catálogo), `songUtils.test.ts`
(construcción del índice inverso y recuentos sobre datos ya filtrados).

---

## 9. Sobre meter a Claude Design

- **No hace falta** para §4.1, §4.2 y §4.5: son patrones que ya existen en la
  app (chips de `calendario.tsx`, `BottomSheet`, `SongMediaSheet`) y se
  replican.
- **Sí conviene** para (a) **la pantalla de resultados de una etiqueta** —
  cabeceras de sección + chips de refinamiento + segmented control conviviendo
  en el poco alto que deja la barra flotante — y (b) **el layout de
  tablet/escritorio con rail lateral**. Ahí hay decisiones de densidad reales.

**Orden recomendado:** ejecutar la fase 2, y meter a Design sobre la pantalla
ya existente, no sobre un mockup en el aire.
