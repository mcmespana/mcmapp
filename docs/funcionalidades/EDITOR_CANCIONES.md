# EDITOR_CANCIONES.md — Editar el cantoral desde la app

> Noviembre de 2026. Sustituye al «panel secreto» de la contraseña `coco`, que
> ya no existe. Solo JS: sale por OTA.

## Quién lo ve

Solo los **administradores**: quien ha entrado en la app (Google/Apple) y tiene
`users/<uid>/isAdmin = true` en la base de datos (`hooks/useAdminStatus.ts`).
Los demás no ven ninguna de las dos entradas. Se designan desde el Panel (o a
mano en la consola de Firebase).

| Entrada | Qué abre |
| ------- | -------- |
| Menú de una canción (botón flotante) → **Editar canción** | El editor con esa canción |
| Cantoral → **⋯** → **Nueva canción** | El editor en blanco, tras elegir de dónde sale la letra |

Ruta: `/cancionero/editar` (`app/screens/SongEditorScreen.tsx`), a pantalla
completa con su X y su «Guardar».

## Las cuatro pestañas

- **Acordes** — la letra en ancho fijo, partida en filas que caben, con cada
  acorde en una pastilla sobre su sílaba (`components/song-editor/ChordGrid.tsx`).
  Tocar la letra pone un acorde ahí; **arrastrar una pastilla la mueve** (también
  a otra fila de la misma línea); tocarla la selecciona y sale una barra para
  moverla letra a letra, cambiarla o quitarla. La letra no se edita aquí, a
  propósito.
- **Texto** — el ChordPro tal cual, **en colores** como el editor del admin
  del cantoral (acordes, estribillos, notas, arreglos), con atajos para
  estribillo, estrofa, «repite estribillo» y nota. Marca en rojo lo que está
  mal y lo lista con su línea: corchetes o llaves sin cerrar, estribillos o
  estrofas sin cerrar (o cerrados sin abrir, o cruzados) y corchetes que no
  parecen un acorde (p. ej. `[Do]`: el cantoral va en cifrado inglés). La
  pestaña dice cuántos avisos hay («Texto · 2»). No impide guardar.
  `utils/chordProLint.ts` + `components/song-editor/ChordProTextEditor.tsx`.
- **Datos** — título, autor, tono, cejilla, nota y la ficha multimedia (álbum,
  ritmo, tiempo litúrgico, fuente, vídeo, más vídeos, audios).
- **Vista** — la canción pintada con la hoja real del cantoral.

Los acordes se enseñan en la notación de cada uno (Do Re Mi o C D E) y se
guardan en cifrado inglés, que es como está el cantoral; al escribir uno vale
cualquiera de las dos («Sol7», «lam», «G»).

## Qué pasa al guardar

```
app ──► admin del cantoral (NAS) ──► GitHub (commit + push) ──► GitHub Actions ──► Firebase ──► las apps
        POST /api/app/*              repo mcmapp-cantoral       genera songs.json   songs/data    al volver a abrir
```

- **La app no escribe en GitHub ni en Firebase.** Todo se manda al admin del
  cantoral desplegado en el NAS, que escribe el `.cho`, hace el commit y el
  push. El workflow del cantoral regenera `songs.json` y lo sube a Firebase.
  Las apps lo bajan **la próxima vez que se abren** (un par de minutos después
  del guardado).
- **Quien edita ve su cambio al momento** en su móvil: la canción editada se
  guarda encima de la del catálogo durante 48 h (`utils/songOverrides.ts`).
- **Si el NAS no contesta**, el cambio se queda **en el móvil**
  (`@song_editor_outbox`) y se envía solo al volver a abrir el editor o la app,
  o con «Enviar ahora» en el aviso del editor. Lo que el cantoral rechaza de
  verdad (no eres administrador, canción inexistente) no se encola: sale el
  error.
- Tras «Guardar» sale una pantalla que lo dice con esas palabras: **Enviado al
  cantoral** (tú ya lo ves · se está publicando · los demás al abrir la app) o
  **Guardado en este móvil** (el cantoral no contesta, se enviará solo).
- **Sin secretos en la app**: al NAS se le manda el pase de Firebase de quien ha
  entrado (`Authorization: Bearer`) y él comprueba `users/<uid>/isAdmin`. Se
  descartó el middleware de Comunica (Vercel): no tiene el repo ni la IA.

## Qué se puede hacer

| Acción | Dónde | Sin NAS |
| ------ | ----- | ------- |
| Editar letra, acordes y datos | Menú de la canción → Editar canción | Se queda en el móvil y se envía luego |
| Enlaces y ficha: vídeo, más vídeos, audios, Spotify, Drive, otros enlaces, álbum, ritmo, tiempo litúrgico, fuente, etiquetas | Pestaña Datos | Igual |
| Canción nueva (foto con IA, texto pegado o en blanco) | Cantoral → ⋯ → Nueva canción | La foto y el texto pegado necesitan el NAS; en blanco se queda en el móvil |
| **Ordenar las canciones de una categoría** | Cantoral → ⋯ → Ordenar canciones (`SongReorderScreen`) | No: necesita el NAS |

Ordenar renumera los ficheros de la categoría (`/api/app/category/reorder`),
igual que arrastrar en el admin: las playlists guardadas que apunten al nombre
viejo de un fichero dejan de encontrarlo, como ya pasa hoy desde el admin.

Lo que solo se hace desde el admin del cantoral: mover de categoría,
subcategoría, «también en», duración y borrar.

## Deuda anotada

El NAS es un punto único: con él apagado no hay canciones nuevas por foto ni
reordenar, y lo editado espera en UN móvil (si se pierde ese móvil, se pierde).
Hacerlo resistente (p. ej. que la cola viva en Firebase y la aplique el
workflow del cantoral, o un segundo camino directo a GitHub) está en
`docs/planes/BACKLOG.md` §2.D.

## Piezas

| Archivo | Qué es |
| ------- | ------ |
| `utils/songEditor.ts` | Puro y con tests: línea ↔ letra + acordes, mover/añadir/quitar, partir en filas, cabecera ↔ cuerpo, «Sol7» → `G7`, y la edición (`…Old`/`…New`) |
| `services/songEditorService.ts` | Las llamadas al NAS y la cola en el móvil (`flushOutbox`) |
| `utils/songOverrides.ts` | Lo recién editado, visto ya en el móvil de quien edita |
| `components/song-editor/` | `ChordGrid`, `ChordPickerSheet`, `NewSongStart`, `LinksField`, `SavedPanel` |
| `app/screens/SongReorderScreen.tsx` | Ordenar una categoría |
| `mcmapp-cantoral/scripts/admin/server.py` | `/api/app/*` (contrato en su README) |

## Pendiente

Puesta en marcha del NAS: `docs/NAS_EDITOR_PUESTA_EN_MARCHA.md` (se borra al hacerla).

Sin probar en móvil ni contra el NAS real: el arrastre está comprobado en web.
El editor de arreglos por pulsación larga sigue igual, ahora para los
administradores de verdad.
