#!/usr/bin/env node
/**
 * Genera los iconos MONOCROMOS de Android a partir del logo:
 *
 *   node scripts/generate-notification-icon.js
 *
 * Salida en `assets/images/`:
 *   notification-icon.png  96×96    → icono pequeño de notificación
 *                                      (plugin `expo-notifications` → `icon`)
 *   monochrome-icon.png    1024×1024 → `android.adaptiveIcon.monochromeImage`
 *                                      (iconos temáticos de Android 13+)
 *
 * Por qué hace falta: Android pinta estos dos iconos SOLO con el canal alfa
 * (cada píxel opaco sale de un color plano). `adaptive-icon.png` es la «M»
 * BLANCA y opaca con las rayas azules encima, así que su silueta era la forma
 * entera, lisa: en la barra de estado salía una mancha blanca sin logo. Aquí
 * se quedan opacos solo los píxeles blancos y las rayas pasan a transparentes,
 * de modo que la silueta es la «M» del logo con sus cortes.
 *
 * El monocromo del launcher conserva la geometría del foreground adaptativo
 * (mismo lienzo, mismo encuadre: ya cabe en la zona segura de 66 dp). El de
 * notificación se recorta al logo y se deja con 2 dp de margen (80 de 96 px),
 * que es lo que piden las guías de Android para el icono pequeño.
 */

const path = require('path');
const sharp = require('sharp');

const IMAGES = path.join(__dirname, '..', 'assets', 'images');
const SOURCE = path.join(IMAGES, 'adaptive-icon.png');

/**
 * Canal rojo de las rayas azules del logo (#31AADF → 49). Es el canal que más
 * separa el azul del blanco: entre los dos, el antialiasing se reparte en
 * alfa intermedio en vez de cortarse en seco.
 */
const STRIPE_RED = 49;

const NOTIFICATION_SIZE = 96;
const NOTIFICATION_CONTENT = 80;

/** Alfa de la silueta: opaco donde el logo es blanco, nada en las rayas. */
function silhouette({ data, info }) {
  const out = Buffer.alloc(info.width * info.height * 4);
  for (let i = 0; i < info.width * info.height; i++) {
    const r = data[i * 4];
    const a = data[i * 4 + 3];
    const whiteness = Math.min(
      1,
      Math.max(0, (r - STRIPE_RED) / (255 - STRIPE_RED)),
    );
    out[i * 4] = 255;
    out[i * 4 + 1] = 255;
    out[i * 4 + 2] = 255;
    out[i * 4 + 3] = Math.round(a * whiteness);
  }
  return out;
}

/** Caja de los píxeles con algo de alfa. */
function alphaBox(buf, width, height) {
  let left = width;
  let top = height;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (buf[(y * width + x) * 4 + 3] > 0) {
        if (x < left) left = x;
        if (x > right) right = x;
        if (y < top) top = y;
        if (y > bottom) bottom = y;
      }
    }
  }
  return { left, top, width: right - left + 1, height: bottom - top + 1 };
}

async function main() {
  const raw = await sharp(SOURCE)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height } = raw.info;
  const mask = silhouette(raw);
  const asRaw = { raw: { width, height, channels: 4 } };

  await sharp(mask, asRaw)
    .png()
    .toFile(path.join(IMAGES, 'monochrome-icon.png'));

  const box = alphaBox(mask, width, height);
  await sharp(mask, asRaw)
    .extract(box)
    .resize(NOTIFICATION_CONTENT, NOTIFICATION_CONTENT, {
      fit: 'contain',
      background: { r: 255, g: 255, b: 255, alpha: 0 },
    })
    .extend({
      top: (NOTIFICATION_SIZE - NOTIFICATION_CONTENT) / 2,
      bottom: (NOTIFICATION_SIZE - NOTIFICATION_CONTENT) / 2,
      left: (NOTIFICATION_SIZE - NOTIFICATION_CONTENT) / 2,
      right: (NOTIFICATION_SIZE - NOTIFICATION_CONTENT) / 2,
      background: { r: 255, g: 255, b: 255, alpha: 0 },
    })
    .png()
    .toFile(path.join(IMAGES, 'notification-icon.png'));

  process.stdout.write('OK: notification-icon.png y monochrome-icon.png\n');
}

main().catch((error) => {
  process.stderr.write(`${error.stack ?? error}\n`);
  process.exit(1);
});
