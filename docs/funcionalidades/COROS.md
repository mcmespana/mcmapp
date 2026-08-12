# COROS.md — Coros, playlists compartidas y coro en vivo

> Rediseño de agosto de 2026. Sustituye al modelo anterior, en el que todo
> giraba alrededor de un **código de 4 dígitos** que había que memorizar,
> dictar y volver a inventarse cada vez.

## La idea en una frase

**Las playlists cuelgan de un coro.** Eliges tu coro una vez («Coro
Consolación Castellón») y a partir de ahí importar la lista del domingo es un
toque, subir la tuya es otro, y el coro en vivo se entra por el nombre del
coro, no por un número.

Los códigos y los QR **siguen existiendo** como opción secundaria: para el
que no está en ningún coro, para un ensayo puntual, o para compartir por
WhatsApp una lista suelta.

---

## Modelo de datos (Firebase RTDB)

```
/choirs/{choirId}                       ← el coro (el índice, ligero)
  v: 1
  name: "Coro Consolación Castellón"
  nameKey: "coro-consolacion-castellon" ← para detectar duplicados al crear
  createdAt, updatedAt
  createdBy: { deviceId, name? }        ← quién lo creó (para el panel)
  playlists:
    "1234":                             ← clave = código de la playlist
      name: "Eucaristía domingo 7 ago"
      createdAt, updatedAt              ← `updatedAt` ORDENA la lista
      songCount: 12
      by: "David"                       ← quien la subió (si tiene nombre)
      ownerDeviceId: "..."              ← para no pedirle contraseña al dueño

/playlistShares/{code}                  ← el CONTENIDO (sin duplicar)
  v: 2, songs: [...], name, createdAt, updatedAt, expiresAt (+6 meses)
  choirId?, choirName?, by?, ownerDeviceId?

/choirSessions/{choirId | code}         ← coro EN VIVO (tiempo real)
  master: { deviceId, name?, lastSeen }
  choirId?, choirName?
  playlist: [...], current: {...} | null
  createdAt, startedAt, updatedAt, lastActivity
  expiresAt = startedAt + 24 h          ← NO se estira al publicar
```

**El contenido no se duplica**: `/choirs` es solo un índice para poder pintar
el histórico de un coro con una lectura ligera. Las canciones siguen viviendo
en `/playlistShares/{code}`, igual que antes, así que **todos los códigos y QR
antiguos siguen funcionando**.

### `choirId`: por qué tiene esa forma

Es el nombre en slug más un sufijo aleatorio: `consolacion-castellon-4f2a`
(ver `utils/choirIds.ts`). Se lee en una URL, es una clave válida de RTDB y —lo
importante— **siempre lleva un guion**, así que nunca se puede confundir con un
código de 4 dígitos. Gracias a eso `/choirSessions/<clave>` puede guardar
indistintamente sesiones de coro (clave = id del coro) y sesiones sueltas
(clave = 4 dígitos) sin ambigüedad.

---

## Flujos en la app

Todo pasa por la hoja del coro (`components/playlist/ChoirSheet.tsx`), a un
toque desde el icono de coro de la cabecera de «Tu selección».

| Paso     | Qué hace |
| -------- | -------- |
| `choose` | Lista de coros existentes + «Crear un coro nuevo» |
| `create` | Nombre del coro (avisa si ya existe uno igual, ignorando acentos) |
| `home`   | **Importar la última** (acción destacada), ver histórico, guardar, y el estado del coro en vivo |
| `browse` | Histórico: nombre, fecha relativa, nº de canciones y el código en pequeñito |
| `save`   | **Actualizar «X»** vs **subir como nueva** |

### Importar

- **Importar la última**: un toque desde el coro. No hay que abrir la lista ni
  saber cómo se llama.
- **Desde un enlace** (`?p=1234`, `?coro=<id>`) o un QR: **reemplaza
  directamente** la selección y deja un toast de **10 segundos con «Deshacer»**
  que restaura tanto las canciones como el enlace con la nube. Venir de un
  enlace y encontrarte un diálogo de tres botones antes de ver nada era la peor
  parte del flujo anterior.
- **Desde un archivo `.mcm`**: es el único sitio donde se sigue preguntando
  «reemplazar o añadir», porque un archivo suele ser un trozo de repertorio que
  quieres juntar con lo tuyo.

### Guardar (el caso «he cambiado 3 canciones»)

La app **recuerda el enlace** entre tu selección y su copia en la nube
(`hooks/usePlaylistLink.ts`, persistido): código, coro, nombre y una **firma**
de la lista (`playlistSignature`). Con eso:

- La cabecera dice «☁️ Guardada en Coro X · hace 2 h» o «✏️ Cambios sin guardar
  en «Eucaristía 7 ago»», y al tocarla lleva directo a guardar.
- Al guardar hay dos opciones explícitas: **Actualizar «X»** (machaca la del
  coro, conserva código y fecha de creación) o **Subir como nueva** (código
  nuevo automático, sin elegirlo a mano).

### Contraseña (`coco`)

Una sola contraseña para todo lo que sea machacar algo de otra persona:

| Situación | ¿Pide contraseña? |
| --------- | ----------------- |
| Actualizar una playlist que subiste **desde este dispositivo** | No |
| Actualizar la playlist de otra persona (o la tuya desde otro móvil) | **Sí** |
| Subir sobre un código ocupado | **Sí** |
| Tomar el mando del coro en vivo siendo **el mismo usuario** (mismo `deviceId`, o mismo nombre de perfil desde otro dispositivo) | No |
| Tomar el mando a **otra persona** | **Sí** |

La regla es la que pidió el usuario: *cualquiera* puede machacar o modificar
si sabe la contraseña. Lo que antes no se podía hacer de ninguna manera (subir
desde el ordenador e ir a actualizarlo desde el móvil) ahora se puede.

### Vaciar

Un botón «Vaciar» en la propia cabecera de la lista (además del menú). No
pregunta: vacía y deja 10 s de «Deshacer».

### Coro en vivo

- Se entra por el coro: **Dirigir yo** / **Unirme · dirige Juan**.
- La sesión **se cierra sola 24 h después de empezar**. Publicar canciones no
  estira ese plazo.
- Tomar el mando reinicia el contador (empiezan otras 24 h) y la playlist del
  nuevo líder pasa a ser la de la sesión.
- Unirse reemplaza tu lista por la del líder, con los mismos 10 s de deshacer.

---

## Enlaces y QR

| URL | Qué hace |
| --- | -------- |
| `https://mcm.expo.app/playlist?p=1234` | Importa esa playlist concreta |
| `https://mcm.expo.app/playlist?coro=<choirId>` | Importa **la última** playlist del coro. No caduca: el mismo QR pegado en la carpeta sirve todos los domingos |
| `https://mcm.expo.app/coro?coro=<choirId>` | Se une a la sesión en vivo de ese coro |
| `https://mcm.expo.app/coro?c=1234` | Sesión suelta por código (formato antiguo, sigue valiendo) |
| `mcmapp://playlist?d=<payload>` | Playlist offline embebida en el propio QR |

El escáner (`utils/qrScan.ts`) reconoce los cinco y avisa cuando enseñas el QR
del flujo equivocado.

---

## Panel de administración (lo que falta fuera de este repo)

El nodo `/choirs` está pensado para poder gestionarse desde `mcmpanel`:

- **Listar coros** con `name`, `createdAt`, `createdBy.deviceId/name` y número
  de playlists.
- **Borrar un coro** (`remove /choirs/{id}`). El contenido de sus playlists
  sigue en `/playlistShares` hasta que caduca a los 6 meses.
- **Renombrar** un coro (`name` + `nameKey`, que debe recalcularse con las
  mismas reglas de `choirNameKey`: sin acentos, minúsculas, guiones).
- **Retocar playlists**: cambiar `name` y, sobre todo, `updatedAt` — que es lo
  que ordena el histórico y decide cuál es «la última».

Se esperan **5-10 coros**, así que la lista se lee entera sin paginar.

## Reglas de seguridad

En `mcm-app/database.rules.json`:

- `/choirs` es de **lectura pública y enumerable** (hay que poder listarlos) y
  de escritura por coro (`$choirId`), nunca en la raíz.
- `/playlistShares` y `/choirSessions` no cambian: raíz no enumerable, acceso
  por clave.

Es el mismo nivel de confianza que ya tenían las playlists compartidas: sin
login, grupo pequeño y conocido. Ver `docs/SEGURIDAD.md`.

## Archivos principales

| Archivo | Qué es |
| ------- | ------ |
| `utils/choirIds.ts` | Id/slug/nombre de un coro (lógica pura) |
| `utils/playlistSync.ts` | Firma de la playlist, orden del histórico, fechas relativas |
| `services/choirDirectoryService.ts` | CRUD de `/choirs` y su índice de playlists |
| `services/cloudPlaylistService.ts` | Contenido en `/playlistShares` + `allocateFreeCode` |
| `services/choirSessionService.ts` | Sesión en vivo, caducidad de 24 h, identidad del líder |
| `hooks/usePlaylistSharing.ts` | Todos los flujos (importar, guardar, dirigir, deshacer, contraseña) |
| `hooks/useMyChoir.ts` / `hooks/usePlaylistLink.ts` | Estado persistido |
| `components/playlist/ChoirSheet.tsx` | La hoja de coro con sus pasos |
| `app/playlist.tsx` / `app/coro.tsx` | Pantallas puente de los deep links |
