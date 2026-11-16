# Contrato — Pañuelo virtual (App ↔ Panel)

> Qué nodos de Firebase usa el pañuelo virtual, qué forma tienen y quién los
> escribe. Cómo funciona la funcionalidad:
> [`../funcionalidades/PANUELO.md`](../funcionalidades/PANUELO.md).
> La fuente de verdad de los tipos es `mcm-app/types/panuelo.ts`; el saneado,
> `mcm-app/utils/panuelo.ts`. Si este documento y el código discrepan, manda
> el código.

## Resumen

| Nodo                                 | Quién escribe                             | Quién lee                   |
| ------------------------------------ | ----------------------------------------- | --------------------------- |
| `/panuelo`                           | Panel                                     | Todo el mundo               |
| `/users/{uid}/panuelo`               | La app del dueño; el Panel (repartir)     | Solo el dueño               |
| `/profileConfig/data/global/panuelo` | Panel / consola                           | Todo el mundo               |
| `/panueloTrades/{code}`              | _Futuro_ — las dos partes del intercambio | _Futuro_                    |
| `/panueloAwards/{personId}`          | _Futuro (F2)_ — solo la Cloud Function    | La cuenta atada a esa ficha |

## 1. `/panuelo` — el catálogo de piezas

Sigue el patrón de siempre, `{ updatedAt, data }`, y la app lo lee con
`useFirebaseData('panuelo', …)`. **Hay que tocar `updatedAt` al cambiar algo**:
es lo que la app mira para saber si vuelve a descargar.

```json
{
  "updatedAt": 1800000000000,
  "data": {
    "items": {
      "parche-pascua": {
        "kind": "parche",
        "name": "Pascua Joven",
        "origin": "Pascua Joven · Abril 2027",
        "description": "Un parche para quien vivió la Pascua.",
        "rarity": "especial",
        "size": 1,
        "order": 30,
        "secret": false,
        "tradeable": false,
        "look": {
          "kind": "parche",
          "shape": "shield",
          "bg": "#9D1E74",
          "border": "#FCD200",
          "ink": "#FCD200",
          "glyph": "cross",
          "text": "Pascua"
        },
        "grant": {
          "type": "code",
          "hash": "<sha256>",
          "from": 1800000000000,
          "to": 1800600000000
        }
      }
    }
  }
}
```

El catálogo del repo es `mcm-app/firebase-seed/panuelo.json` (es el nodo
`data`). **Se sube pieza a pieza** con `npm run panuelo:subir -- <id>`
(`mcm-app/scripts/panuelo-subir.js`), que escribe solo
`/panuelo/data/items/<id>` y `/panuelo/updatedAt`. Importar el fichero
entero en `/panuelo/data` desde la consola **reemplaza el catálogo** (lo que
el Panel u otra persona hubiera añadido se pierde): solo vale con el nodo
vacío. Antes de subir, `npm test -- panueloSeed` comprueba que ninguna pieza
se descarta ni pierde nada al sanearse.

### Campos de una pieza

| Campo         | Tipo    | Oblig. | Notas                                                                                                                                                                 |
| ------------- | ------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| _clave_       | string  | Sí     | El `id`. `kebab-case`, de 1 a 64 caracteres `[a-z0-9-]`. **No se renombra ni se reutiliza**: es con lo que cada persona guarda que la tiene                           |
| `kind`        | string  | Sí     | `chapa` · `pin` · `cinta` · `parche` · `medalla` · `pulsera` · `troncho`                                                                                              |
| `name`        | string  | Sí     |                                                                                                                                                                       |
| `look`        | objeto  | Sí     | Cómo se dibuja. Depende de `kind` (abajo)                                                                                                                             |
| `origin`      | string  | No     | De dónde viene: «Pascua Joven · Abril 2027»                                                                                                                           |
| `description` | string  | No     |                                                                                                                                                                       |
| `rarity`      | string  | No     | `comun` (por defecto) · `especial` · `unica`                                                                                                                          |
| `size`        | número  | No     | Multiplicador, de 0,7 a 1,5                                                                                                                                           |
| `order`       | número  | No     | Orden en la colección; a igualdad, por nombre                                                                                                                         |
| `secret`      | boolean | No     | No se enseña (ni en silueta) hasta que se consigue                                                                                                                    |
| `tradeable`   | boolean | No     | Si se puede intercambiar. Ausente: sí las pulseras y las chapas comunes, no lo demás. **Medallas, piezas `unica` y piezas por asistencia nunca**, aunque digan `true` |
| `grant`       | objeto  | No     | Cómo se consigue (abajo). Ausente = solo repartiéndola a mano                                                                                                         |

**Una pieza mal escrita se descarta entera** (no rompe el resto): `kind`
desconocido, sin nombre, `look` incompleto, color que no es hex.

### `look` según la clase

Los colores son siempre hex (`#rgb` o `#rrggbb`). Las imágenes, URL `https`
con CORS abierto. `glyph` y `shape` son nombres de forma: `heart`, `star`,
`cross`, `moon`, `flame`, `drop`, `sun`, `mountain`, `tent`, `shell`, `note`,
`leaf`, `bolt`, `crown`, `fish`, `circle`, `shield`, `arrow`, `rect`, `card`
(tarjeta de pie, para un pin rectangular).

| Clase     | Obligatorio              | Opcional                                                                            |
| --------- | ------------------------ | ----------------------------------------------------------------------------------- |
| `chapa`   | `bg`                     | `ring`, `ink`, `glyph` o `logo: true`, `text` y `textBottom` (≤ 24), `image`, `glb` |
| `pin`     | `shape`, `enamel`        | `enamel2` (degradado), `metal`, `image`, `glb`                                      |
| `cinta`   | `colors` (1–7)           | —                                                                                   |
| `parche`  | `shape`¹, `bg`, `border` | `ink`, `glyph`, `text` (≤ 14)                                                       |
| `medalla` | `ribbon` (1–7 colores)   | `metal`, `glyph` o `logo: true`, `image`, `glb`                                     |
| `pulsera` | `colors` (1–6)           | `pattern` (`chevron` · `stripes` · `solid`), `text` (≤ 16), `ink`                   |
| `troncho` | —                        | `leather`, `ink`, `image` (miniatura), `glb`                                        |

¹ La forma de un parche solo puede ser `circle`, `shield`, `arrow` o `rect`.
`metal`: `oro` (por defecto) · `plata` · `cobre` · `negro`.

`glb` es el modelo a tamaño completo de una medalla, chapa, pin o troncho
(ver `medallas-3d/README.md` y `piezas-3d/README.md`): con él, la ficha
ofrece «Verla de cerca». La `image` de una chapa lleva el dibujo hasta el
86 % del radio; la de un pin es cuadrada y ocupa la caja de su forma.

**El troncho** va por delante, sobre el nudo: se apunta en `layout` como
`{ u: 0, v: 0, rot: 0 }` (llevarlo puesto o no), no ocupa hueco y nunca se
intercambia, diga lo que diga `tradeable`.

### `grant` — cómo se consigue

```json
{ "type": "all",    "from": 1800000000000, "to": 1800600000000 }
{ "type": "code",   "hash": "<sha256 hex>", "from": …, "to": … }
{ "type": "manual" }
{ "type": "attendance", "events": ["<id de evento del CRM>", "…"], "marks": ["yes", "partial"], "minDays": 1 }
```

`from` y `to` (ms) son opcionales: fuera de la ventana la pieza no se puede
conseguir.

**`attendance`** — por ir a un evento (te pasan lista). Sin `from`/`to`:
**manda la asistencia**, sin plazos (llega cuando se marca, se quita si se
corrige). La concede el servidor en `/panueloAwards` (§5), nunca el móvil.

| Campo     | Oblig. | Notas                                                                                                                          |
| --------- | ------ | ------------------------------------------------------------------------------------------------------------------------------ |
| `events`  | Sí     | 1–50 ids de evento del CRM (cadenas opacas, sin repetir). Con ir a uno basta. Sin eventos, la pieza se queda **sin concesión** |
| `marks`   | No     | Qué marcas cuentan: `yes` · `partial` · `no_justified` · `no_unjustified`. Por defecto `["yes", "partial"]`                    |
| `minDays` | No     | Días distintos con marca **en un mismo evento**, como mínimo. Por defecto 1                                                    |

Una pieza `attendance` **nunca es intercambiable** (`tradeable` se fuerza a
`false` al sanear) y no se cose sola: espera en la caja a que la persona la
desvele y la coloque.

**El hash de un código** — el catálogo nunca guarda el código:

```
hash = sha256( "<id de la pieza>" + ":" + NORMALIZAR(código) )      → en hexadecimal
NORMALIZAR = sin tildes, solo letras y números, en mayúsculas
```

Ejemplo: la pieza `parche-pascua` con el código «Pascua 27» →
`sha256("parche-pascua:PASCUA27")`. El `id` va dentro para que el mismo código
en dos piezas no dé el mismo hash. El Panel tiene que calcularlo igual
(`hashPanueloCode` en `mcm-app/utils/panuelo.ts`).

Un enlace `mcmapp://panuelo?codigo=PASCUA27` abre el pañuelo con el código ya
escrito: es lo que tiene que llevar el QR.

## 2. `/users/{uid}/panuelo` — lo que tiene cada persona

```json
{
  "color": "green",
  "items": {
    "parche-pascua": { "at": 1800000000000, "via": "code" }
  },
  "layout": {
    "parche-pascua": { "u": -0.36, "v": 0.2, "rot": 15 }
  },
  "layoutAt": 1800000050000,
  "gone": { "pulsera-amistad": 1800000090000 },
  "history": {
    "1800000100000": {
      "color": "green",
      "at": 1800000100000,
      "layout": { "parche-pascua": { "u": -0.36, "v": 0.2, "rot": 15 } }
    }
  }
}
```

| Campo          | Notas                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `color`        | `red` · `green` · `blue` · `yellow`. Las mismas claves que los pañuelos del área privada                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `items/{id}`   | Las piezas que tiene. `at`: cuándo (ms). `via`: `all` · `code` · `manual` · `demo` · `trade` · `attendance`. Una pieza `attendance` es solo el **reflejo** de `/panueloAwards`: si no está allí, la app la quita (escribirla a mano no da nada)                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `layout/{id}`  | Dónde está cosida. `u`: de −1 a 1 entre los bordes del triángulo a esa altura. `v`: de 0 (cuello) a 1 (pico). `rot`: grados. Una pieza que se tiene y no está aquí está «en la caja»                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `layoutAt`     | Última vez que cambió el color o la colocación (ms). Entre dos móviles gana el más nuevo                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `gone/{id}`    | Piezas dadas en un intercambio: cuándo. Una pieza se tiene si `items[id].at > gone[id]`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `history/{at}` | Pañuelos anteriores («Mis pañuelos»), uno por cada cambio de etapa en el que llevaba al menos una pieza cosida. La clave es `String(at)`, los ms en que se dejó. `color`: como arriba. `at`: igual que la clave (si no coinciden, manda la clave). `layout`: lo que llevaba cosido, igual que `layout` de arriba (`u`, `v`, `rot`); **puede incluir piezas que ya no se tienen** (se llevaban entonces). **No es una imagen**: el visor lo vuelve a pintar con el catálogo. Un mapa y no una lista, para que cada móvil suba solo el suyo y el mismo `at` no se duplique. La app guarda los 12 más recientes; el resto no se borra de la nube. Un recuerdo mal formado se descarta |

### Repartir una pieza desde el Panel

Escribir **solo esa hoja**, sin tocar nada más del nodo:

```
/users/{uid}/panuelo/items/{itemId}  =  { "at": <ms>, "via": "manual" }
```

No hace falta escribir `layout`: la app le busca hueco al abrir y **presenta**
la pieza como recién conseguida. Si ya la tenía, no la pises (se perdería la
fecha original; la app se queda siempre con la más antigua).

⚠️ **Hoy el Panel no puede escribir en `/users`** (las reglas piden que quien
escribe sea el dueño). Repartir necesita una función de servidor con Admin SDK
o la autenticación real del Panel — es la Integración D
(`docs/planes/PLAN_INTEGRACIONES.md`).

## 3. `global.panuelo` — el interruptor

En `/profileConfig/data/global/panuelo`: `"off"` · `"alpha"` · `"all"`.
Ausente = `"alpha"` (solo quien enciende el Laboratorio Alpha). Ver
[`PANEL_PERFILES.md`](PANEL_PERFILES.md) §1.10-bis.

## 4. `/panueloTrades/{code}` — intercambios

Lo escribe y lo lee **solo la app**, con sesión iniciada en los dos móviles
(`mcm-app/services/panueloTradeService.ts`, siempre el nodo entero con una
transacción). El Panel no tiene nada que hacer aquí. Forma (`PanueloTrade` en
`mcm-app/utils/panueloTrade.ts`):

```json
{
  "code": "K7WQ4M",
  "status": "proposed",
  "createdAt": 1800000000000,
  "expiresAt": 1800000600000,
  "offer": {
    "uid": "<uid>",
    "name": "Ana",
    "itemId": "pulsera-amistad",
    "have": ["pulsera-encuentro"]
  },
  "answer": { "uid": "<uid>", "name": "Luis", "itemId": "pulsera-camino" }
}
```

- `code`: 6 caracteres de `ABCDEFGHJKMNPQRSTUVWXYZ23456789` (sin 0/O ni
  1/I/L). Igual que la clave.
- `status`: `open` → `proposed` → `accepted`, o `cancelled` (desde `open` o
  `proposed`, cualquiera de las dos partes).
- `expiresAt`: `createdAt` + 10 min. Un intercambio `accepted` se queda 24 h
  para que la otra parte se recupere si cerró la app; lo demás se puede
  borrar al caducar. Cada móvil borra los suyos al abrir el pañuelo.
- `offer.have` (opcional): ids de las piezas **intercambiables** que ya tiene
  quien ofrece (no su colección entera), para que la otra persona no le
  ofrezca algo que no puede recibir.
- `name`: nombre de pila, opcional.
- `answer.itemId` ausente (o `null`) es un **regalo**.

Reglas de Firebase: `mcm-app/database.rules.json` (`panueloTrades`), cómo
desplegarlas en `docs/desarrollo/FIREBASE_REGLAS.md` §8. Cada móvil aplica
luego su mitad en su propio `/users/{uid}/panuelo` (`items/{dada}` a `null`,
`gone/{dada}`, `items/{recibida}` con `via: "trade"`, `layout`).

## 5. `/panueloAwards/{personId}` — piezas por asistencia (futuro, F2)

> **Aún no existe.** Hoy lo sustituye una simulación local del Laboratorio
> Alpha con la misma forma (`mcm-app/services/panueloAwards.ts`). Plan:
> `docs/planes/PLAN_PANUELO_ASISTENCIA.md` §4.

```json
{
  "pascua-joven-2027": {
    "at": 1807000000000,
    "via": "attendance",
    "eventId": "<id del CRM>",
    "grantedAt": 1807100000000
  }
}
```

- **Por ficha** (`personId` del CRM), no por cuenta: la pieza es del niño que
  fue, nunca del padre.
- `at`: el primer día con una marca que cuenta (mediodía UTC de ese día).
  `grantedAt`: cuándo lo escribió el servidor. `eventId`: el evento que la
  respalda.
- **Lo escribe solo la Cloud Function** (`panueloClaimAttendance`), que lo
  recalcula entero en cada reclamación con `computeAwards`
  (`mcm-app/utils/panueloAttendance.ts`): existe si y solo si la asistencia
  la respalda hoy. Ni la app ni el Panel escriben aquí.
- La app lo refleja en `/users/{uid}/panuelo/items` con `via: "attendance"`
  (`reconcileAwards`) y quita (y descose) lo que ya no esté.

## 6. Lo que el Panel tendría que ofrecer

1. **Editor de piezas** con vista previa. La vista previa se pinta con los
   colores de la app, no con los del Panel (`design.md` §9).
2. **Generar el código y su QR** de una pieza de tipo `code`. El código se
   enseña una vez y solo se guarda el hash.
3. **Repartir** una pieza a una lista de personas (los inscritos de un evento).
4. **Cuántas se han repartido** de cada pieza.
5. **Asignar una pieza a eventos** («Por asistencia»: la lista de ids de
   evento) y contar las concedidas leyendo `/panueloAwards`. Mientras no
   exista, se hace con IA editando el catálogo del repo y
   `npm run panuelo:subir`.
