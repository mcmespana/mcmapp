# ETIQUETAS.md — Etiquetas del cantoral (`{tags:}`)

> Etiquetas **libres, transversales y añadidas con el tiempo** para las
> canciones del cantoral: "viejunas", "domingo de ramos", "infantiles",
> "animación"… y poder ver de un tirón todas las canciones de una etiqueta,
> **agrupadas por categoría**.
>
> Diseño y decisiones: [`../planes/archivo/PLAN_TAGS.md`](../planes/archivo/PLAN_TAGS.md)
> (variante **1d**, "etiquetas desde el header del cantoral") — 🗄️ archivado,
> el plan está ejecutado; **este documento es la referencia viva**.
>
> Repos implicados: **`mcmapp`** (esta app) y **`mcmapp-cantoral`** (fuente de
> verdad del contenido). Los dos ✅ implementados — ver §6.

---

## 1. La tesis

> **Una etiqueta no es un filtro, es una puerta de entrada al cantoral.**

Si se trata como filtro acaba siendo un modal de checkboxes que nadie abre y
que además exige conocer de antemano el vocabulario. Por eso **no hay panel de
filtros**: hay una puerta (el botón 🏷️ del header), una nube donde se ve todo
lo que existe, y refinamiento progresivo dentro del resultado.

Tres propiedades que no son negociables:

1. **Libres** — se inventan sobre la marcha. Una etiqueta que aparece en un
   `.cho` y **no** está declarada en el catálogo funciona igual: se muestra con
   el slug capitalizado y sin emoji.
2. **Transversales** — no viven dentro de una categoría, la cruzan. Por eso la
   pantalla de una etiqueta va **agrupada por categoría**.
3. **Poco sitio** — el cantoral en móvil ya está lleno. Todo lo nuevo son
   **tres piezas**: un botón de header, una hoja y una barra de contexto.

---

## 2. Dónde viven las etiquetas

`songs/data` en Firebase lo **sobrescribe entero** cada push a `main` de
`mcmapp-cantoral`. Por tanto las etiquetas **no** se escriben desde el panel:
nacen en el repo del cantoral y llegan por el camino normal del contenido
(versionadas en git, revisables en un diff, sin nodo nuevo que proteger en
`database.rules.json`).

### 2.1 Pertenencia — directiva `{tags:}` en el `.cho`

Misma familia que la directiva propia `{arr:}` ([`ARREGLOS.md`](ARREGLOS.md)):

```
{title: Alma misionera}
{tags: viejunas, animacion, envio}
```

- Una sola directiva `{tags:}` por canción, valores separados por comas.
- El generador la vuelca a `tags: string[]` en cada entrada de `songs-vX.json`.
- La app **vuelve a normalizar** todo lo que le llega (`slugifyTag`), así que
  `Domingo de Ramos`, `domingo-de-ramos` y `DOMINGO DE RAMOS` son la misma
  etiqueta aunque el generador no normalice.

### 2.2 Catálogo — `songs/tags` en Firebase

Metadatos **opcionales**, publicados por el generador junto a `songs/data`:

```jsonc
// songs/tags/data
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
| `emoji` | Icono del chip (emoji y no color: el tab del cantoral ya es amarillo) |
| `orden` | Orden manual entre destacadas (reservado; hoy la nube ordena por uso) |
| `destacada` | Reservado para la fila de destacadas de una fase posterior |
| `alias` | Slugs que se colapsan sobre esta etiqueta (higiene del vocabulario) |

`normalizeTagCatalog` tolera además el mapa envuelto (`{ "tags": {...} }`),
claves sin normalizar y entradas que sean solo el label
(`{ "viejunas": "Viejunas" }`). Un catálogo roto degrada a "no hay catálogo",
que es un estado perfectamente válido.

> ⚠️ **El catálogo es opcional y esa es la pieza clave.** Se declara una
> etiqueta el día que se consolida, no antes.

---

## 3. Qué ve el usuario

### 3.1 Botón 🏷️ en el header del cantoral

En `CategoriesScreen`, a la derecha, junto a la lupa —los dos son "entrar a
buscar algo"— como bar item nativo, para que iOS le dé su cápsula liquid-glass.

> **Si no hay ninguna canción etiquetada, el botón no existe.** Nada de un
> botón que abre una hoja vacía. Se enciende solo en cuanto llega la primera
> canción con `{tags:}`.

### 3.2 La hoja de etiquetas

Un `BottomSheet` con **todas** las etiquetas con al menos una canción,
**ordenadas por uso**, como chips en línea: relleno suave, emoji si lo hay y
el número en su propia pastilla. Refinada en octubre de 2026 (antes los chips
variaban 1 pt de tamaño según el uso, que no se notaba). Una rejilla de dos
columnas se probó y se descartó: desperdiciaba el ancho.

**«Editar»** permite **ocultar** etiquetas que no van contigo (p. ej. las de
otra casa). Una etiqueta oculta desaparece de la hoja, de las candidatas para
combinar y de la ficha de la canción; **sus canciones siguen** en sus
categorías y en el buscador. Es una preferencia del dispositivo
(`hooks/useHiddenTags.ts`, AsyncStorage `@mcm_hidden_tags_v1`), no se sube a
ningún sitio. En modo edición cada chip lleva «−» para ocultarla; las ocultas salen al
final, apagadas y con «+», para recuperarlas.

**«Editar» tiene dos modos** (un selector Ocultar / Destacar arriba de la hoja):

- **Ocultar** — lo de arriba. Debajo de las ocultas hay una casilla
  **«Esconder también sus canciones de las categorías»**
  (`settings.hideHiddenTagSongs`, apagada de serie): pensada para quien no
  quiere un cantoral lleno de canciones de otro carisma (salesianos,
  Consolació…). Con ella, las canciones con alguna etiqueta oculta dejan de
  salir **en las categorías**, pero siguen en el buscador y en la
  propia pantalla de la etiqueta: esconder no es borrar. La lista lo dice con
  un «2 escondidas · Ver» discreto junto al recuento, que las enseña en esa
  visita (`components/song-tags/HiddenSongsNote.tsx`).
- **Destacar** (★, `settings.featuredTags`) — las etiquetas que más usas, las
  **destacadas**. Salen como atajo arriba del cantoral y, **discretas, en las
  filas de las listas**: una pastilla pequeña junto al autor («🕰️ Viejunas»,
  «+1» si hay más). Solo las que marcas, nunca todas: sin ninguna ★, las filas
  no cambian. (Se llamó «A mano» hasta el 2026-10-10.) Ojo: no es el campo
  `destacada` del catálogo (§2.2), que lo pone el admin para todos; esto es
  una preferencia de cada móvil.

Lo mismo se elige en el paso **«Tus etiquetas»** del onboarding del cantoral
(saltable, y se repite con el «?» del header), que explica para qué sirve
esconder. La lógica pura está en `utils/songTags.ts`
(`withoutHiddenTagSongs`, `featuredTagsOf`) y la de las listas en
`hooks/useSongListTags.ts`.

### 3.3 La pantalla de una etiqueta

Es `SongListScreen` con la **categoría virtual `__TAG__:<slug>`**, hermana de
los pseudo-IDs `__ALL__` y `__SELECTED_SONGS__`. Se hereda gratis la lista, el
buscador nativo, el swipe para añadir a la playlist, la píldora de tono y el
estado vacío.

- **Agrupada por categoría**, como una lista agrupada de Ajustes de iOS: cada
  categoría es una tarjeta con las esquinas redondeadas y su cabecera encima,
  sobre el fondo — con el emoji y el nombre tal como se ven en el cantoral
  («🤲 Ofertorio», no «E. OFERTORIO 🤲») y su recuento. Precisamente porque una
  etiqueta es transversal, la categoría es el contexto que falta.
- **Fila de refinamiento** como cabecera de la lista (se va con el scroll):
  «Combinar con» + las candidatas con un «+». Las etiquetas activas solo
  aparecen ahí cuando hay **más de una** (con ✕ para soltarlas); con una sola,
  el título ya lo dice y soltarla es lo mismo que volver atrás.
- El header lleva su propio 🏷️ para saltar a otra etiqueta sin volver atrás.
- El contador dice `34 canciones · 7 categorías`.

> **Hasta octubre de 2026 la barra era una franja amarilla fija encima de la
> lista**, y en iOS se pintaba debajo de la barra de estado, con el chip encima
> del reloj: el header es transparente y la lista compensa su alto con
> `contentInsetAdjustmentBehavior`, pero una `View` hermana de la lista no. Lo
> que vaya encima de una lista con header transparente, va DENTRO de la lista
> (`ListHeaderComponent`).

### 3.4 Cruzar etiquetas sin UI de filtros

Las candidatas de la barra son las que **coexisten** en el resultado actual,
con su recuento dentro del cruce: **nunca se ofrece una etiqueta que daría
cero resultados**. Se toca y se afina (AND); se toca la ✕ y se suelta. Soltar
la última equivale a salir de la pantalla.

El cruce vive en **estado local**, no en la ruta: cada refinamiento es un
cambio dentro de la misma pantalla, así que "atrás" siempre devuelve al
cantoral y no a un cruce intermedio.

### 3.5 El buscador entiende las etiquetas

Los labels y los slugs de las etiquetas de una canción se añaden a su
`searchableText`, así que buscar "ramos" saca también las canciones etiquetadas
aunque no lleven la palabra en el título. **Coste de espacio: cero.**

### 3.6 Etiquetas en la ficha de la canción

En `SongMediaSheet` (la ficha, junto a álbum / tiempo litúrgico / ritmo) salen
los chips de las etiquetas de esa canción; tocar uno abre su pantalla. Este es
el bucle que sostiene el sistema: se abre una canción, se ve que es "viejuna",
pica la curiosidad y se ven las otras 33.

### 3.7 Lo que NO se hace

- ❌ **Todas las etiquetas en las filas de la lista.** `SongListItem` ya lleva
  píldora de tono con transposición, puntos de multimedia y dos direcciones de
  swipe. Desde octubre de 2026 salen **solo las que el usuario marca con ★**,
  en una línea apagada bajo el autor (§3.2).
- ❌ **Modal de filtros con checkboxes.** Ver §3.4.
- ❌ **Nodo nuevo de Firebase escrito desde el panel.** Ver §2.

---

## 4. Implementación en la app

| Pieza | Fichero |
| ----- | ------- |
| Modelo y utilidades puras | `mcm-app/utils/songTags.ts` |
| Catálogo + índice inverso | `mcm-app/hooks/useSongTags.ts` |
| Chip (3 variantes) | `mcm-app/components/song-tags/TagChip.tsx` |
| Nube de etiquetas | `mcm-app/components/song-tags/TagCloudSheet.tsx` |
| Fila de refinamiento | `mcm-app/components/song-tags/TagContextBar.tsx` |
| Ocultar canciones · ★ en las filas | `mcm-app/hooks/useSongListTags.ts` + `components/song-tags/HiddenSongsNote.tsx` |
| Botón del header | `mcm-app/app/screens/CategoriesScreen.tsx` |
| Pantalla `__TAG__:` | `mcm-app/app/screens/SongListScreen.tsx` |
| Chips en la ficha | `mcm-app/components/song-media/SongMediaSheet.tsx` |
| Tests | `mcm-app/__tests__/songTags.test.ts` |

Notas:

- El índice inverso se construye con un `useMemo` sobre los datos ya
  descargados. **No** hay `useFirebaseData` nuevo para las canciones ni caché
  nueva. La lectura de `songs/tags` tampoco necesitaba regla (`songs` ya es
  `.read: true`); en `database.rules.json` solo se ha añadido el **permiso de
  escritura** de `songs/tags`, con la misma bandera que `songs/data`, porque lo
  publica el mismo CI del repo del cantoral.
- `filterSongsData` descarta las canciones `pendiente`/`borrador`: **los
  recuentos que se ven son los de la app**, no los del generador.
- Solo se muestran etiquetas con al menos una canción. Una etiqueta declarada
  en el catálogo pero sin usar todavía no es descubrimiento, es ruido.
- Todo es **OTA-safe**: no hay dependencias nativas nuevas.

---

## 5. Relación con `liturgicalTime` / `album` / `rhythm`

Son tres campos de texto libre de `types/songMedia.ts` que funcionan como
proto-etiquetas (valor único, sin índice). **Por ahora no se tocan.** Más
adelante se puede proyectar `liturgicalTime` al espacio de etiquetas como
etiqueta de sistema —derivada, no editable, generada— en vez de duplicarla a
mano en los `.cho`.

---

## 6. El otro lado: `mcmapp-cantoral` ✅

Implementado también (agosto 2026). Lo que hay allí:

1. **`{tags:}` en el generador** — `scripts/chordpro.py` la parsea como una
   directiva más de cabecera (se quita de `content`) y `crear_songs_json.py`
   la vuelca a `tags: string[]`. Al generar imprime un **informe de etiquetas**
   marcando las que aún no están declaradas: el momento barato de cazar un typo
   es cuando la etiqueta aparece por primera vez.
2. **`songs/tags.json`** — el catálogo, versionado en git.
3. **`update_firebase.py`** publica el catálogo **resuelto** (declaradas +
   descubiertas, con recuento) en `songs/tags`, en el mismo push que ya sube
   `songs/data`.
4. **Editor visual del admin** — se etiqueta desde donde uno ya está:
   - editor de canción → pestaña **➕ Datos extra**, con autocompletado;
   - **catálogo en bloque** (poner/quitar en las marcadas) + filtro por
     etiqueta;
   - **al importar**, sugerencias por canción (título · sección · letra) y una
     fila de etiquetas para todo el lote;
   - pestaña **🏷 Etiquetas** para gestionar el vocabulario: nombre, emoji,
     destacada, alias, fundir (como alias o reescribiendo) y renombrar el slug.
5. **Vuelta desde la app** — `sincronizaCambiosDeFirebase.py` entiende
   `tagsNew`/`tagsOld`, así que la fase 4 (etiquetar desde la propia app) ya
   tiene el circuito montado.

Contrato completo: `docs/CAMPOS_CANCIONES.md` §6 de `mcmapp-cantoral`.

Contrato mínimo que espera la app:

```jsonc
// songs/data/<categoria>/songs[i]
{ "title": "12. Alma misionera", "tags": ["viejunas", "envio"] }

// songs/tags
{ "updatedAt": "2026-08-13T10:00:00Z", "data": { "viejunas": { "label": "Viejunas", "emoji": "🕰️" } } }
```

Si el nodo `songs/tags` no existe, no pasa nada: las etiquetas se pintan con el
slug capitalizado.
