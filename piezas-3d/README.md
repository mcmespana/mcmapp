# Piezas 3D del pañuelo (chapas, pin y troncho)

Modelos `.glb` de piezas **de verdad**, hechos a partir de fotos. Igual que
las medallas (`medallas-3d/`), se sirven desde aquí vía jsDelivr, así que **un
archivo solo está disponible cuando ya está en `main`**:

```
https://cdn.jsdelivr.net/gh/mcmespana/mcmapp@main/piezas-3d/<id>.glb
https://cdn.jsdelivr.net/gh/mcmespana/mcmapp@main/piezas-3d/thumbs/<id>.webp
```

![Las seis piezas](vista-previa.jpg)

| Archivo                    | Pieza                 | Talla   | Cómo es                                                        |
| -------------------------- | --------------------- | ------- | -------------------------------------------------------------- |
| `estoy-contigo-samuel.glb` | Estoy contigo, Samuel | mediana | Chapa de imperdible, 38 mm. Festival vocacional Samuel 2024    |
| `pin-mc.glb`               | Pin M+C               | pequeña | Pin de metal de 18 mm con resina y cierre de mariposa          |
| `jubileo-2025.glb`         | Jubileo 2025          | pequeña | Chapa de imperdible, 25 mm                                     |
| `chapa-og.glb`             | Chapa OG              | mediana | Disco de plástico amarillo de 38 mm, la del Movimiento Juvenil |
| `com-sonriente.glb`        | COM sonriente         | mediana | Chapa de imperdible, 38 mm, logo verde                         |
| `troncho.glb`              | Troncho               | —       | Tubo de cuero de 31 × 22 mm con el logo grabado                |

Nombres, textos, tallas y medidas están en [`piezas.json`](piezas.json): es la
ficha de cada pieza y se cambia ahí, sin regenerar el modelo.

## Lo que hay que saber

- **Tres tallas**: `pequena`, `mediana` y `grande` (de grande aún no hay
  ninguna). El modelo va a tamaño real, en metros.
- **El troncho funciona distinto**: va por delante del pañuelo, justo encima
  del nudo, en un sitio fijo; no se mueve ni se intercambia (`fijo: true`).
- **Todavía no están en la app.** El pañuelo virtual dibuja sus piezas a
  partir de datos (`docs/funcionalidades/PANUELO.md`); enseñar estas pide
  una clase nueva para el troncho y que la chapa acepte un `.glb`.
- Cada modelo mira a +Z, con «arriba» en +Y. Las partes van en nodos con
  nombre (`chapa`, `imperdible`, `pin`, `cierre`, `troncho`, `cosido`), por si
  el visor quiere esconder el cierre al coserla.
- Pesan entre 0,3 y 1,2 MB. No hace falta pasarlos por `gltf-transform`.

## Cómo se hacen

La forma es código y la cara es una imagen:

```bash
python3 piezas-3d/_fuente/generar.py            # todas (numpy + Pillow)
python3 piezas-3d/_fuente/generar.py pin-mc     # solo una
```

- `_fuente/generar.py`: la geometría de cada pieza y sus materiales.
- `_fuente/tex/<id>.png`: la cara, de 1024 px. Sale de una foto de la pieza
  enderezada (la elipse de la foto pasa a círculo) y limpiada: las de pocas
  tintas (Estoy contigo, OG, COM sonriente) están redibujadas con colores
  planos; el Jubileo es la foto con la luz igualada.
- `_fuente/cara_pin_mc.py`: la cara del pin M+C no sale de la foto (18 mm de
  lado no daban): es el logo «+M C» **redibujado a ojo** sobre el azul del
  pin. Con el archivo del logo se sustituye `logo()` y queda exacto.
- El grabado del troncho usa el dibujo de la chapa verde
  (`tex/troncho-logo-*.png`): es el mismo logo.

**Una chapa redonda nueva** es una imagen en `tex/` y una línea en `PIEZAS`
(con su diámetro). La mejor foto: de frente, sin flash, con luz suave y sin
dedos encima.

Las miniaturas de `thumbs/` (WebP de 512 px, fondo transparente) se sacan
del `.glb` con `<model-viewer>`, con la misma luz que el visor de medallas
(`environment-image="neutral"`, `tone-mapping="aces"`, `exposure="1.2"`).

## Lo que se puede mejorar con mejores fotos

- **Chapa OG**: la foto estaba muy inclinada y con brillos; el texto de abajo
  («CONSOLACIÓN PARA EL MUNDO») queda emborronado.
- **Pin M+C** y **troncho**: usan el logo redibujado o sacado de la foto de
  la chapa verde. Con los archivos originales de los dos logos (PNG o SVG en
  `_fuente/tex/`) quedan exactos.
- **Estoy contigo**: no se lee el texto pequeño del borde («Festival
  vocacional Samuel 2024»).
