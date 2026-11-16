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
- **Texto** — el ChordPro tal cual, con atajos para estribillo, «repite
  estribillo» y nota.
- **Datos** — título, autor, tono, cejilla, nota y la ficha multimedia (álbum,
  ritmo, tiempo litúrgico, fuente, vídeo, más vídeos, audios).
- **Vista** — la canción pintada con la hoja real del cantoral.

Los acordes se enseñan en la notación de cada uno (Do Re Mi o C D E) y se
guardan en cifrado inglés, que es como está el cantoral; al escribir uno vale
cualquiera de las dos («Sol7», «lam», «G»).

## Dónde se guarda (y por qué así)

```
app ──1──► Firebase  songs/data/<cat>/songs/<i>/<campo> + songs/updatedAt   (se ve YA en todos los móviles)
    ──2──► admin del cantoral (NAS)  POST /api/app/song/save   → escribe el .cho, commit y push
                 └─ si no contesta ─► cola  songs/ediciones     → el cantoral la aplica solo (workflow)
```

1. **Firebase primero**: una urgencia se arregla al momento, con o sin el NAS.
2. **El repo del cantoral es la fuente de verdad**: la edición se manda al
   admin del cantoral desplegado en el NAS, que la aplica al `.cho` con la
   misma lógica de siempre (`apply_edition`), hace commit y push. El CI del
   cantoral regenera `songs.json`.
3. **Si el NAS no contesta** (o aún no está configurado), la edición se queda
   en `songs/ediciones` como hacía el panel secreto, y el workflow del cantoral
   la recoge. No se pierde nada.

**Sin secretos en la app**: al NAS se le manda el pase de Firebase de quien ha
entrado (`Authorization: Bearer`), y él comprueba `users/<uid>/isAdmin` leyendo
ese nodo con el propio pase. Se descartó el middleware de Comunica (Vercel): no
tiene un clon del repo ni la IA, y el admin del NAS ya tiene las dos cosas, la
clave de despliegue y los conversores.

**Canción nueva** solo va por el NAS (`/api/app/song/new`): hace falta el repo
para darle número y fichero. Aparece en la app cuando el CI publica, en un par
de minutos. De dónde sale la letra:

- **Foto** (cámara o galería, hasta cuatro páginas) → `/api/app/song/read`, la
  misma IA del «✨ Añadir canción» del admin. Solo se ofrece si el NAS dice que
  la tiene (`/api/app/status → ai`).
- **Texto pegado** → `/api/app/song/convert` (acordes encima de la letra o
  ChordPro).
- **En blanco**.

Luego se repasa en el mismo editor y se guarda.

## Puesta en marcha (una vez)

1. En el NAS: actualizar el admin del cantoral (rama con `/api/app/*`), poner
   `FIREBASE_URL` en `cantoral-admin.env` y relanzar
   (`mcmapp-cantoral/deploy/ugreen-nas/README.md`, «Editor de canciones desde
   la app»).
2. En Firebase (consola): `songs/editor/url = "https://…ts.net"` (la URL del
   Funnel). Sin este nodo la app funciona igual, pero todo va por la cola y no
   hay canciones nuevas ni fotos. Para desarrollo vale
   `EXPO_PUBLIC_CANTORAL_ADMIN_URL`.
3. `users/<uid>/isAdmin = true` a quien deba editar.

## Reglas de Firebase

Hoy `songs/data` se escribe con la bandera `legacyPanelWrites`. El día que se
cierre, hay que dejar escribir `songs/data` y `songs/updatedAt` a los
administradores (`auth != null && root.child('users').child(auth.uid).child('isAdmin').val() === true`)
o el paso 1 fallará y el editor no guardará. Va con la Integración D.

## Piezas

| Archivo | Qué es |
| ------- | ------ |
| `utils/songEditor.ts` | Puro y con tests: línea ↔ letra + acordes, mover/añadir/quitar, partir en filas, cabecera ↔ cuerpo, «Sol7» → `G7`, y la edición (`…Old`/`…New`) |
| `services/songEditorService.ts` | Los dos destinos del guardado y las llamadas al NAS |
| `components/song-editor/` | `ChordGrid`, `ChordPickerSheet`, `NewSongStart` |
| `mcmapp-cantoral/scripts/admin/server.py` | `/api/app/*` (contrato en su README) |

## Pendiente

Sin probar en móvil ni contra el NAS real: el arrastre está comprobado en web.
El editor de arreglos por pulsación larga sigue igual, ahora para los
administradores de verdad.
