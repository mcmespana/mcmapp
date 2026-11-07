#!/usr/bin/env node
/**
 * Genera los iconos alternativos de la app (modo Carismochito) a partir de la
 * ilustración de la mascota.
 *
 *   npm run icons:alt
 *
 * Salida en `assets/app-icons/`:
 *   carismochito.png             1024×1024 OPACO   → icono de iOS
 *   carismochito-foreground.png  1024×1024 con alfa → foreground adaptativo Android
 *
 * Por qué un script y no dos PNG a pelo: así el fondo y el encuadre se cambian
 * en una línea y se regenera todo, en vez de retocar imágenes a mano.
 *
 * Dos reglas que NO son negociables y por eso están aquí arriba:
 *   - El icono de iOS NO puede tener transparencia. Si la tiene, App Store
 *     Connect rechaza el binario al subirlo (no falla el build: falla después,
 *     que es peor).
 *   - El foreground adaptativo de Android se recorta a un círculo/squircle y
 *     además el launcher lo mueve al hacer parallax: todo lo que importa tiene
 *     que caber en el 66% central. De ahí que la mascota salga más pequeña ahí.
 */

const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

/** Verde COM de la marca (`constants/colors.ts` → success). */
const BACKGROUND = '#A3BD31';
const SIZE = 1024;
/** Alto de la mascota en el icono de iOS, en tanto por uno del lienzo. */
const IOS_SCALE = 0.82;
/** Alto en el foreground de Android. Menor: el launcher recorta y desplaza. */
const ANDROID_SCALE = 0.58;

const SOURCE = path.join(__dirname, '..', 'assets', 'carismochito.png');
const OUT_DIR = path.join(__dirname, '..', 'assets', 'app-icons');

/** Escala la mascota a `scale` del lienzo y la centra en un cuadrado. */
async function composeMascot(scale) {
  const target = Math.round(SIZE * scale);
  const mascot = await sharp(SOURCE)
    .resize({ height: target, fit: 'inside', withoutEnlargement: false })
    .toBuffer();
  const { width, height } = await sharp(mascot).metadata();
  return {
    input: mascot,
    left: Math.round((SIZE - width) / 2),
    top: Math.round((SIZE - height) / 2),
  };
}

async function main() {
  if (!fs.existsSync(SOURCE)) {
    throw new Error(`No encuentro la ilustración de origen: ${SOURCE}`);
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });

  // iOS: fondo sólido, sin canal alfa.
  await sharp({
    create: {
      width: SIZE,
      height: SIZE,
      channels: 4,
      background: BACKGROUND,
    },
  })
    .composite([await composeMascot(IOS_SCALE)])
    .flatten({ background: BACKGROUND })
    // `flatten` deja el PNG opaco pero CONSERVA el canal alfa; App Store
    // Connect rechaza igualmente el icono si el canal existe. Hay que quitarlo.
    .removeAlpha()
    .png()
    .toFile(path.join(OUT_DIR, 'carismochito.png'));

  // Android: solo la mascota, transparente. El color de fondo lo pone el
  // plugin (`backgroundColor` en app.json), no la imagen.
  await sharp({
    create: {
      width: SIZE,
      height: SIZE,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([await composeMascot(ANDROID_SCALE)])
    .png()
    .toFile(path.join(OUT_DIR, 'carismochito-foreground.png'));

  process.stdout.write(`Iconos alternativos generados en ${OUT_DIR}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.stack ?? error}\n`);
  process.exit(1);
});
