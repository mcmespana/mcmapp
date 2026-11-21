# 02 · Datos, sin conexión y catálogo

> Parte del plan [`README.md`](README.md). Cubre: «descargas todo el cantoral
> en local», «asegurar que nunca se actualiza si ya tienes el dato en local;
> la primera descarga asegurarla bien», «subcategorías fáciles en el
> songs.json», los bloques (packs) de villancicos, los repertorios y el modo
> Navidad. Rutas de código relativas a `mcm-app/` de MCM App (el fork las
> hereda).

---

## 1. Cómo funciona hoy (MCM App, comprobado en el código)

- `useFirebaseData('songs', 'songs')` lee `songs/updatedAt` (y
  `songs/hidden`) **cada vez que se monta** una pantalla del cantoral; si el
  texto no es **idéntico** al guardado, baja `songs/data` entero.
- Se guarda en **AsyncStorage** (`songs_data`, `songs_updatedAt`), una fila
  de ~300-400 KB. Sin límite de tamaño: en Android una fila de más de ~2 MB
  no se puede leer (Comunica ya se protege; el cantoral no).
- **No hay canciones empaquetadas**: la primera vez sin internet sale
  «Sin conexión» y la app está vacía (`CategoriesScreen.tsx:687`).
- Dos reintentos (400 ms y 1,2 s), sin tiempo máximo ni progreso.
- 🐞 **`SuggestSongModal.tsx:82` escribe `songs/updatedAt = Date.now()`** al
  sugerir una canción: cada sugerencia obliga a **todos los móviles** a bajar
  el cantoral entero otra vez (y en milisegundos, cuando el CI escribe
  segundos). Es un bug de MCM App: se arregla allí ya (ver §8) y en el fork
  no se hereda.
- El generador del cantoral **ya publica** `subcategories`, `subcategory`,
  `alsoIn` y `duration`; la app los ignora. El orden de las categorías sale
  de ordenar `categoryTitle` por la letra («A. …»); `indice.json` tiene
  `order` pero no se emite.

## 2. Qué lee y qué escribe el fork

Objetivo del usuario: **solo leer `songs`** (las reglas, con paciencia). La
realidad mínima:

| Nodo | Lee | Escribe | Para qué |
| ---- | --- | ------- | -------- |
| `songs/updatedAt`, `songs/data` | ✅ | — | El cantoral |
| `songs/tags/*` | ✅ | — | Etiquetas |
| `songs/packs/*` (nuevo, lo publica el cantoral) | ✅ | — | Bloques de villancicos |
| `songs/cantoralConfig/*` (nuevo, lo publica el cantoral) | ✅ | — | Modo Navidad, evento, avisos predefinidos |
| `songs/meta` (nuevo, opcional) | ✅ | — | Huella del catálogo (§3.4) |
| `songs/editor/url`, `users/<uid>/isAdmin` | ✅ | — | Solo admin (admin por código, ver `06`) |
| `seccion_oracion/lecturas/<fecha>` | ✅ | — | «Lecturas del domingo» al montar el repertorio (se queda, D-14). Es el único nodo fuera de `songs` que lee el cantoral de hoy |
| `songs/fallitos`, `songs/solicitudes` | — | ✅ (push) | «Informar de un fallito» / «Sugerir canción» (se quedan, D-14) |
| `choirSessions/<clave>` | ✅ | ✅ | Directo por la nube (`04`) |
| `choirs`, `playlistShares/<código>` | ✅ | ✅ | Coros y repertorios compartidos (como MCM App) |

Todo lo de directo y coros **ya está permitido** por las reglas de hoy
(`choirSessions/$code` y `playlistShares/$code` con `.write: true` por clave;
`choirs` legible como lista): **no hace falta tocar reglas para empezar**.
Lo nuevo vive bajo `songs/` (solo lectura para las apps, lo escribe el CI
del cantoral con su token) o dentro de `choirSessions/<clave>/…`.

Un guardarraíl en el fork lo hace cumplir: **un test que falla si aparece un
`ref(db, …)` fuera de la lista de arriba**.

## 3. El catálogo local (lo nuevo)

### 3.1 Semilla empaquetada — nunca vacío

- `scripts/snapshot-cantoral.mjs` baja `songs/data`, `songs/tags`,
  `songs/packs` y `songs/cantoralConfig` por REST (lectura pública) y los
  deja en `assets/cantoral/semilla.json` + `semilla.meta.json`
  (`updatedAt`, número de canciones, sha256).
- Se lanza **antes de cada build de tienda y de cada OTA** (paso del
  workflow y de `npm run eas:build:*`). Test: la semilla existe, se parsea y
  tiene ≥ 1 categoría con canciones.
- Primer arranque: la app copia la semilla al almacén y **se usa ya**, con o
  sin internet. Luego mira si hay algo más nuevo.

### 3.2 Almacén en ficheros, no en AsyncStorage

- `expo-file-system`: `catalogo/actual.json`, `catalogo/actual.meta.json` y
  `catalogo/anterior.json` (para volver atrás si la nueva viene rota).
- Escritura **atómica**: se escribe `nuevo.json.tmp`, se valida, se mueve a
  `actual.json`, y solo entonces se escribe `meta` con su `updatedAt`.
  Un corte a mitad deja el catálogo anterior intacto.
- En memoria: un almacén único (`CatalogStore`) que sustituye a
  `useFirebaseData('songs')` en el fork. Las pantallas leen de ahí, nunca de
  Firebase.

### 3.3 Cuándo se actualiza (y cuándo NO)

1. Al arrancar (tras el primer pintado) y al volver a primer plano, **como
   mucho cada 15 min**, y con «tirar para actualizar» en Inicio.
2. Se lee **solo** `songs/updatedAt` (bytes). Comparación **numérica**:
   solo si `remoto > local` se baja `songs/data`. Igual o menor → nada.
   (Hoy es «distinto», y por eso el bug de §1 obliga a re-bajar.)
3. **También durante un directo** (decisión D-21: no se congela): si llega
   un cantoral nuevo, se aplica al momento. La canción que se está viendo
   se repinta **en el mismo sitio** (misma canción, posición y tono) con un
   aviso discreto «Canción actualizada»; nunca se salta de canción ni se
   pierde el repertorio. Así se puede corregir un acorde desde el admin a
   mitad de los villancicos y llega a todos. (Sin internet, el cantoral nuevo
   llega desde el equipo base o el maestro por la wifi local, ver `04` §5.6.)
4. Descarga con **tiempo máximo** (20 s), **reintentos con espera
   creciente** (1, 3, 9 s…) y, si se baja por REST, **progreso**.
5. Validación antes de aceptar: JSON correcto, categorías con canciones,
   no menos del 80 % de canciones que la anterior (salvo que `songs/meta`
   diga otra cosa), y sha256 si existe `songs/meta`.
6. Al aplicar: aviso discreto «Cantoral actualizado · 3 canciones nuevas» con
   la lista (diferencia calculada contra la anterior).

Tests (puros, con el reloj y la red inyectados): no baja si es igual; no baja
si es menor; baja si es mayor; en directo aplica sin cambiar la canción
actual ni su posición; corte a mitad deja la anterior; validación rechaza un
catálogo vacío.

### 3.4 Petición al repo del cantoral (pequeña)

- `update_firebase.py` publica también `songs/meta = { updatedAt, sha256,
  count, bytes }`. Opcional pero barato: da integridad y el tamaño para la
  barra de progreso.
- `crear_songs_json.py` emite el `order` de `indice.json` en cada categoría,
  para no depender de la letra del título.

## 4. Subcategorías, «también en», marcado y duración

Es **la Fase 1 de `mcmapp-cantoral/docs/PROMPT_APP_NAVIDAD.md`**, que está
escrita con detalle y no se ha ejecutado en ninguna app. Resumen:

- **Subcategorías**: la categoría trae `subcategories` (mapa por slug con
  `title`, `order`, y opcionales `short`, `emoji`, `description`); la canción,
  `subcategory`. Lista agrupada con cabeceras pegajosas, filtro por chips,
  insignia fuera de contexto. Función pura `groupBySubcategory`.
- **«También en» (`alsoIn`)**: una canción se ve en otras categorías sin
  duplicarse. Función pura `songsForCategory`. Favoritos, búsqueda,
  ediciones y repertorios usan siempre la **categoría de casa** + `filename`.
- **Marcado** `<i>` (2ª voz), `<u>` (altas/bajas), `<b>` (énfasis) y
  anotaciones `[*CLAP]` (no se transportan). Va en `songSheet`/
  `songDocument`, que es zona espejo.
- **Duración** `duration: "m:ss"`: insignia en la hoja y suma en repertorios.

**Crear una subcategoría** (lo que pidió el usuario: «posibles y fáciles de
crear»): ya es fácil en el repo del cantoral — una entrada en
`songs/indice.json` y `{subcategoria: slug}` en cada `.cho`, o desde el admin
(🗂 Dónde sale). La app no necesita cambios para una subcategoría nueva.

⚠️ **Dependencia entre apps**: `APP_MARKUP = True` en el cantoral manda las
etiquetas a **las dos apps** (mismo `songs/data`). Si MCM App no las sabe
pintar, verá «&lt;i&gt;» literal. Por eso **el marcado tiene que estar en
MCM App (por OTA) antes de activar el flag**: está en el Paquete MCM App
(`mcm-app/TODO.md`).

## 5. Repertorios (lo que en MCM App es «Tu selección»)

MCM App tiene **una** lista (`@mcm_playlist_v2`). El fork tiene **varios
repertorios** con nombre, fecha, evento y coro.

```ts
type Repertorio = {
  id: string; name: string;
  event?: string; date?: string;        // como los packs
  choir?: { id: string; name: string };
  targetMinutes?: number;
  items: Array<
    | { type?: 'song'; category: string; filename: string;   // de casa
        key?: string; capo?: number; transpose?: number;
        notes?: string; duration?: string }
    | { type: 'break'; title: string; minutes?: number }
  >;
  source?: { kind: 'pack' | 'cloud' | 'live' | 'file'; ref: string };
  updatedAt: number;
};
```

- Es el formato de los **packs** del cantoral (`songs/packs`), así un bloque
  de villancicos **es** un repertorio de solo lectura que se puede duplicar.
- Almacén: un fichero por repertorio (`repertorios/<id>.json`).
- **Compartir sin romper MCM App**: en `/playlistShares/<código>` se sigue
  escribiendo el `songs: [...]` v2 que lee MCM App (filename, transpose,
  capoOverride, order, categoryHint) y **se añade** `v: 3, items: [...]`
  con lo nuevo (pausas, notas, evento). MCM App ignora lo que no conoce;
  el fork lee `items` si existe y `songs` si no.
- `.mcm` v3 con la misma regla.

## 6. Bloques de villancicos (`songs/packs`)

Formato resuelto ya definido en `PROMPT_APP_NAVIDAD.md` (Fase 2):

```jsonc
"songs/packs": { "updatedAt": "...", "data": {
  "hucha-2026-manana-1": {
    "title": "Mañana 1", "event": "Villancicos Solidarios 2026 · Edificio Hucha",
    "date": "2026-12-19", "targetMinutes": 60, "totalSeconds": 3540,
    "items": [
      { "category": "navidad", "filename": "00.himno….cho", "title": "…",
        "key": "Am", "capo": 1, "notes": "🎺", "duration": "3:20" },
      { "type": "break", "title": "Presentación de la hucha", "minutes": 3 }
    ] } } }
```

Trabajo en el repo del cantoral (no en la app):

1. `scripts/packs.py publish`: resuelve `categoría/slug` → `filename` y
   publica `songs/packs`. Workflow que lo lanza al cambiar `packs/**`.
2. **Los bloques de 2025 tienen todas las canciones sin enlazar**
   (`"song": null`) porque **la categoría Navidad está vacía**: hay que
   importar los villancicos (Word de las nuevas 19-66 + cantoral de 2008)
   desde el admin. Ver la ruta crítica en [`07-tiendas-y-villancicos.md`](07-tiendas-y-villancicos.md).

## 7. Modo Navidad y configuración remota (`songs/cantoralConfig`)

```jsonc
"songs/cantoralConfig": { "updatedAt": "...", "data": {
  "mode": "navidad",                       // o "normal"
  "from": "2026-11-28", "to": "2027-01-07",
  "featuredCategory": "navidad",
  "event": { "title": "Villancicos Solidarios", "place": "Edificio Hucha",
             "date": "2026-12-19", "packs": ["hucha-2026-manana-1", "…"],
             "liveKey": "villancicos-2026-xxxx" },
  "livePresets": [ { "id": "fuerte", "text": "¡Más fuerte!", "kind": "destello" }, "…" ],
  "reactions": ["🔥", "🙌", "👏", "😂", "🎄", "❤️"],
  "maintenance": false,
  "minAppVersion": "1.0.0"                 // propios del fork: los de /profileConfig son de MCM App
} }
```

- Sale de un fichero versionado en el repo del cantoral
  (`config/cantoral.json`), publicado por el mismo workflow: todo lo del
  cantoral vive en el mismo sitio y con historia.
- La app lo trata igual que el catálogo (semilla, fichero, comparación
  numérica). Fuera de `from`–`to` vuelve sola a `normal`.
- **El modo Navidad es funcional**: Navidad primero con subcategorías,
  tarjeta del evento con sus bloques, «Unirme al directo» destacado y los
  avisos predefinidos de villancicos. Ningún cambio estético obligado.

## 8. Arreglos para MCM App que salen de aquí (importables ya)

| Qué | Por qué | Dónde |
| --- | ------- | ----- |
| Quitar `setWithRetry('songs/updatedAt', …)` de `SuggestSongModal` | Re-descarga forzada a todo el mundo en cada sugerencia | `components/SuggestSongModal.tsx:82` |
| Comparar `updatedAt` numéricamente | Un valor más viejo no debe forzar descarga | `hooks/useFirebaseData.ts` |
| Publicar `current` del coro por campos, no entero | El cambio de tono borra la letra a los seguidores (ver `04`) | `SongDetailScreen.tsx:661-666, 703-707` |
| Documentar la caducidad real (12 h + 12 h) | `COROS.md` dice 24 h | `docs/funcionalidades/COROS.md` |

Son bugs de MCM App. **✅ Arreglados en `main` el 21/11/2026** (antes del
fork, así que el fork ya nace con ellos): `SuggestSongModal` ya no toca
`songs/updatedAt` (test guardarraíl `songsUpdatedAtGuard`), `updatedAt` se
compara como fecha normalizando s/ms/ISO (`utils/updatedAt.ts`), el líder
publica siempre el `current` completo (`choirCurrentForSong`) y los textos
dicen 12 h. Junto con
los textos «24 h» del coro (dura 12 h + 12 h con actividad; `COROS.md` ya
corregido) y la Fase 1 de Navidad (§4), forman el **Paquete MCM App**.

Como el fork nace con el mismo código, **se arreglan donde se llegue
antes** y se llevan al otro repo con un parche (`DIVERGENCIAS.md` §4): en el
fork, el de `SuggestSongModal` cae en la Fase 0 y el de `current` en la
Fase 3. La Fase 1 de Navidad en MCM App es el plan B del 19/12 (si la tienda
tardara, los villancicos se ven en MCM App), así que conviene hacerla allí
antes del evento.

## 9. Tareas

| # | Tarea | Repo | Modelo |
| - | ----- | ---- | ------ |
| 2.0 | Arreglos de §8 (documentados en `mcm-app/TODO.md`) | donde llegue antes; parche al otro | Sonnet |
| 2.1 | Fase 1 de `PROMPT_APP_NAVIDAD` (subcategorías, alsoIn, marcado, duración) — lógica pura y hoja (zona espejo) + UI en cada app | las dos (en MCM App, antes del 19/12) | Opus |
| 2.2 | `songs/meta` + `order` en el generador; `packs.py publish` + workflow; `config/cantoral.json` publicado | mcmapp-cantoral | Sonnet |
| 2.3 | `CatalogStore` (semilla, ficheros, atómico, comparación numérica, se aplica en directo sin mover la canción) + tests | fork | Opus |
| 2.4 | `snapshot-cantoral.mjs` en el build y su test | fork | Sonnet |
| 2.5 | Repertorios múltiples + compartir v3 compatible + `.mcm` v3 | fork | Opus |
| 2.6 | Bloques (`songs/packs`) como repertorios de solo lectura | fork | Sonnet |
| 2.7 | `cantoralConfig` y modo Navidad | fork | Sonnet |
| 2.8 | Guardarraíl «solo estos nodos» | fork | Sonnet |
