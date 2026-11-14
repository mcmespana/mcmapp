# Contrato — Pañuelo virtual (App ↔ Panel)

> Qué nodos de Firebase usa el pañuelo virtual, qué forma tienen y quién los
> escribe. Cómo funciona la funcionalidad:
> [`../funcionalidades/PANUELO.md`](../funcionalidades/PANUELO.md).
> La fuente de verdad de los tipos es `mcm-app/types/panuelo.ts`; el saneado,
> `mcm-app/utils/panuelo.ts`. Si este documento y el código discrepan, manda
> el código.

## Resumen

| Nodo                                 | Quién escribe                             | Quién lee     |
| ------------------------------------ | ----------------------------------------- | ------------- |
| `/panuelo`                           | Panel                                     | Todo el mundo |
| `/users/{uid}/panuelo`               | La app del dueño; el Panel (repartir)     | Solo el dueño |
| `/profileConfig/data/global/panuelo` | Panel / consola                           | Todo el mundo |
| `/panueloTrades/{code}`              | _Futuro_ — las dos partes del intercambio | _Futuro_      |

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

El seed importable es `mcm-app/firebase-seed/panuelo.json` (es el nodo `data`).

### Campos de una pieza

| Campo         | Tipo    | Oblig. | Notas                                                                                                                                       |
| ------------- | ------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| _clave_       | string  | Sí     | El `id`. `kebab-case`, de 1 a 64 caracteres `[a-z0-9-]`. **No se renombra ni se reutiliza**: es con lo que cada persona guarda que la tiene |
| `kind`        | string  | Sí     | `chapa` · `pin` · `cinta` · `parche` · `medalla` · `pulsera`                                                                                |
| `name`        | string  | Sí     |                                                                                                                                             |
| `look`        | objeto  | Sí     | Cómo se dibuja. Depende de `kind` (abajo)                                                                                                   |
| `origin`      | string  | No     | De dónde viene: «Pascua Joven · Abril 2027»                                                                                                 |
| `description` | string  | No     |                                                                                                                                             |
| `rarity`      | string  | No     | `comun` (por defecto) · `especial` · `unica`                                                                                                |
| `size`        | número  | No     | Multiplicador, de 0,7 a 1,5                                                                                                                 |
| `order`       | número  | No     | Orden en la colección; a igualdad, por nombre                                                                                               |
| `secret`      | boolean | No     | No se enseña (ni en silueta) hasta que se consigue                                                                                          |
| `tradeable`   | boolean | No     | Si se puede intercambiar. Ausente: sí las pulseras, no lo demás                                                                             |
| `grant`       | objeto  | No     | Cómo se consigue (abajo). Ausente = solo repartiéndola a mano                                                                               |

**Una pieza mal escrita se descarta entera** (no rompe el resto): `kind`
desconocido, sin nombre, `look` incompleto, color que no es hex.

### `look` según la clase

Los colores son siempre hex (`#rgb` o `#rrggbb`). Las imágenes, URL `https`
con CORS abierto. `glyph` y `shape` son nombres de forma: `heart`, `star`,
`cross`, `moon`, `flame`, `drop`, `sun`, `mountain`, `tent`, `shell`, `note`,
`leaf`, `bolt`, `crown`, `fish`, `circle`, `shield`, `arrow`, `rect`.

| Clase     | Obligatorio              | Opcional                                                                     |
| --------- | ------------------------ | ---------------------------------------------------------------------------- |
| `chapa`   | `bg`                     | `ring`, `ink`, `glyph` o `logo: true`, `text` y `textBottom` (≤ 24), `image` |
| `pin`     | `shape`, `enamel`        | `enamel2` (degradado), `metal`                                               |
| `cinta`   | `colors` (1–7)           | —                                                                            |
| `parche`  | `shape`¹, `bg`, `border` | `ink`, `glyph`, `text` (≤ 14)                                                |
| `medalla` | `ribbon` (1–7 colores)   | `metal`, `glyph` o `logo: true`, `image`, `glb`                              |
| `pulsera` | `colors` (1–6)           | `pattern` (`chevron` · `stripes` · `solid`), `text` (≤ 16), `ink`            |

¹ La forma de un parche solo puede ser `circle`, `shield`, `arrow` o `rect`.
`metal`: `oro` (por defecto) · `plata` · `cobre` · `negro`.

`glb` es el modelo a tamaño completo de una medalla (ver
`medallas-3d/README.md`): con él, la ficha ofrece «Verla de cerca».

### `grant` — cómo se consigue

```json
{ "type": "all",    "from": 1800000000000, "to": 1800600000000 }
{ "type": "code",   "hash": "<sha256 hex>", "from": …, "to": … }
{ "type": "manual" }
```

`from` y `to` (ms) son opcionales: fuera de la ventana la pieza no se puede
conseguir.

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
  "gone": { "pulsera-amistad": 1800000090000 }
}
```

| Campo         | Notas                                                                                                                                                                                |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `color`       | `red` · `green` · `blue` · `yellow`. Las mismas claves que los pañuelos del área privada                                                                                             |
| `items/{id}`  | Las piezas que tiene. `at`: cuándo (ms). `via`: `all` · `code` · `manual` · `demo` · `trade`                                                                                         |
| `layout/{id}` | Dónde está cosida. `u`: de −1 a 1 entre los bordes del triángulo a esa altura. `v`: de 0 (cuello) a 1 (pico). `rot`: grados. Una pieza que se tiene y no está aquí está «en la caja» |
| `layoutAt`    | Última vez que cambió el color o la colocación (ms). Entre dos móviles gana el más nuevo                                                                                             |
| `gone/{id}`   | Piezas dadas en un intercambio: cuándo. Una pieza se tiene si `items[id].at > gone[id]`                                                                                              |

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

## 4. `/panueloTrades/{code}` — intercambios (futuro)

Todavía no lo lee ni lo escribe nadie; la forma está decidida para que el
código de la app no tenga que cambiar cuando se haga (`PanueloTrade` en
`mcm-app/utils/panueloTrade.ts`).

```json
{
  "code": "K7WQ4M",
  "status": "proposed",
  "createdAt": 1800000000000,
  "expiresAt": 1800000600000,
  "offer": { "uid": "<uid>", "name": "Ana", "itemId": "pulsera-amistad" },
  "answer": { "uid": "<uid>", "name": "Luis", "itemId": "pulsera-encuentro" }
}
```

`status`: `open` → `proposed` → `accepted`, o `cancelled`. `answer.itemId` a
`null` es un regalo. La propuesta de reglas y los pasos que faltan están en
`../funcionalidades/PANUELO.md` («Intercambios»).

## 5. Lo que el Panel tendría que ofrecer

1. **Editor de piezas** con vista previa. La vista previa se pinta con los
   colores de la app, no con los del Panel (`design.md` §9).
2. **Generar el código y su QR** de una pieza de tipo `code`. El código se
   enseña una vez y solo se guarda el hash.
3. **Repartir** una pieza a una lista de personas (los inscritos de un evento).
4. **Cuántas se han repartido** de cada pieza.
