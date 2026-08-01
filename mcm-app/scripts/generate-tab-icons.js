#!/usr/bin/env node
/**
 * Genera los PNG de iconos de la barra de tabs flotante.
 *
 * `expo-native-compact-tabs` pinta los iconos desde imágenes (`ImageSource`),
 * no acepta SF Symbols ni fuentes de iconos. Este script coge el mismo glifo
 * de MaterialIcons que ya usa cada tab en `constants/tabsCatalog.ts`
 * (campo `androidIcon`) y lo rasteriza a PNG, de modo que la barra nueva se ve
 * exactamente igual que la de Android de siempre y no hace falta que nadie
 * dibuje assets a mano.
 *
 * Salida (por cada tab, en `assets/tab-icons/<tab>/`):
 *   icon.png / icon@2x.png / icon@3x.png       ← icono base
 *   frame-1..3.png (+@2x/@3x)                  ← fotogramas de la animación
 *
 * Los iconos salen BLANCOS sobre transparente a propósito: la barra nativa los
 * tiñe con `tintColor` / `inactiveTintColor`, igual que hace UIKit con los
 * template images.
 *
 * Uso:  node scripts/generate-tab-icons.js
 * Las imágenes se commitean, así que solo hay que volver a lanzarlo si se añade
 * un tab o se cambia su icono.
 */

const fs = require('fs');
const path = require('path');
const opentype = require('opentype.js');
const sharp = require('sharp');

const ROOT = path.join(__dirname, '..');
const FONT = path.join(
  ROOT,
  'node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/MaterialIcons.ttf',
);
const GLYPHMAP = path.join(
  ROOT,
  'node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/MaterialIcons.json',
);
const OUT_DIR = path.join(ROOT, 'assets/tab-icons');

/** Lado del icono en puntos. 28pt es la medida habitual de un tab item. */
const SIZE_PT = 28;
const DENSITIES = [1, 2, 3];

/**
 * El glifo base ocupa el 82% del lienzo para que el fotograma más grande
 * (x1.20) siga cabiendo sin recortarse.
 */
const BASE_FILL = 0.82;
/** Escalas de los fotogramas intermedios: pequeño rebote al seleccionar. */
const FRAME_SCALES = [1.1, 1.2, 1.09];

function loadTabs() {
  // El catálogo es TypeScript, así que en vez de importarlo se extraen los
  // pares (name, androidIcon) con una lectura simple del fichero. Evita meter
  // ts-node solo para esto.
  const src = fs.readFileSync(
    path.join(ROOT, 'constants/tabsCatalog.ts'),
    'utf8',
  );
  const tabs = [];
  const re = /name:\s*'([^']+)'[\s\S]*?androidIcon:\s*'([^']+)'/g;
  let match;
  while ((match = re.exec(src)) !== null) {
    tabs.push({ name: match[1], icon: match[2] });
  }
  return tabs;
}

function svgFor(font, glyphMap, iconName, scale) {
  const codepoint = glyphMap[iconName];
  if (codepoint === undefined) {
    throw new Error(`MaterialIcons no tiene el glifo "${iconName}"`);
  }

  // Se dibuja a un tamaño de referencia grande y luego se centra con la caja
  // real del glifo, que no coincide con la métrica de la fuente.
  const REF = 1000;
  const path0 = font.getPath(String.fromCharCode(codepoint), 0, 0, REF);
  const box = path0.getBoundingBox();
  const glyphW = box.x2 - box.x1;
  const glyphH = box.y2 - box.y1;

  const target = SIZE_PT * BASE_FILL * scale;
  const factor = target / Math.max(glyphW, glyphH);
  const offsetX = (SIZE_PT - glyphW * factor) / 2 - box.x1 * factor;
  const offsetY = (SIZE_PT - glyphH * factor) / 2 - box.y1 * factor;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE_PT}" height="${SIZE_PT}" viewBox="0 0 ${SIZE_PT} ${SIZE_PT}">
  <g transform="translate(${offsetX} ${offsetY}) scale(${factor})">
    <path d="${path0.toPathData(3)}" fill="#FFFFFF"/>
  </g>
</svg>`;
}

async function writePng(svg, dir, basename) {
  for (const density of DENSITIES) {
    const px = SIZE_PT * density;
    const suffix = density === 1 ? '' : `@${density}x`;
    await sharp(Buffer.from(svg))
      .resize(px, px)
      .png({ compressionLevel: 9 })
      .toFile(path.join(dir, `${basename}${suffix}.png`));
  }
}

async function main() {
  const font = opentype.parse(fs.readFileSync(FONT).buffer);
  const glyphMap = JSON.parse(fs.readFileSync(GLYPHMAP, 'utf8'));
  const tabs = loadTabs();

  if (tabs.length === 0) {
    throw new Error('No se ha podido leer ningún tab de tabsCatalog.ts');
  }

  fs.rmSync(OUT_DIR, { recursive: true, force: true });

  for (const tab of tabs) {
    const dir = path.join(OUT_DIR, tab.name);
    fs.mkdirSync(dir, { recursive: true });

    await writePng(svgFor(font, glyphMap, tab.icon, 1), dir, 'icon');
    for (let i = 0; i < FRAME_SCALES.length; i++) {
      await writePng(
        svgFor(font, glyphMap, tab.icon, FRAME_SCALES[i]),
        dir,
        `frame-${i + 1}`,
      );
    }

    console.log(`✓ ${tab.name} (${tab.icon})`);
  }

  console.log(`\n${tabs.length} tabs → ${path.relative(ROOT, OUT_DIR)}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
