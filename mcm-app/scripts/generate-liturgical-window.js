#!/usr/bin/env node
/**
 * Genera `assets/calendario-liturgico.json` como una VENTANA RODANTE del
 * calendario litúrgico completo (`assets/calendario-liturgico-completo.json`).
 *
 * Por qué: `components/contigo/LiturgicalBadge.tsx` importa el JSON de forma
 * estática, así que Metro lo inlinea en el bundle. La tabla completa cubre
 * 2025→2100 (318 KB) y las consultas solo tocan el año de la fecha mostrada:
 * cada OTA descargaba y cada arranque evaluaba ~300 KB de datos que no se usarán
 * en décadas. La ventana deja el mismo comportamiento con ~4% del peso.
 *
 * Se incluye también el año ANTERIOR: en enero se consultan fechas de diciembre,
 * y los tiempos litúrgicos (Adviento) cruzan el año civil.
 *
 * Cadencia: una vez al año. `__tests__/liturgicalWindow.test.ts` pone el CI en
 * rojo cuando la ventana está a punto de caducar, con el comando a ejecutar.
 *
 * Uso: npm run liturgical:window
 */
const fs = require('fs');
const path = require('path');

const ASSETS = path.join(__dirname, '..', 'assets');
const FULL = path.join(ASSETS, 'calendario-liturgico-completo.json');
const OUT = path.join(ASSETS, 'calendario-liturgico.json');

/** Años hacia atrás y hacia delante que entran en la ventana. */
const YEARS_BACK = 1;
const YEARS_FORWARD = 3;

function main() {
  const full = JSON.parse(fs.readFileSync(FULL, 'utf8'));
  const current = new Date().getFullYear();

  const window = {};
  const missing = [];
  for (let y = current - YEARS_BACK; y <= current + YEARS_FORWARD; y++) {
    const key = String(y);
    if (full[key]) window[key] = full[key];
    else missing.push(key);
  }

  if (missing.length) {
    console.error(
      `La tabla completa no cubre estos años: ${missing.join(', ')}.\n` +
        'Hay que regenerar/ampliar calendario-liturgico-completo.json antes de continuar.',
    );
    process.exit(1);
  }

  // Sin newline final y con 2 espacios: así el fichero es idempotente entre
  // ejecuciones del mismo año (correrlo dos veces no debe dar diff).
  fs.writeFileSync(OUT, JSON.stringify(window, null, 2) + '\n', 'utf8');

  const years = Object.keys(window);
  const bytes = fs.statSync(OUT).size;
  console.log(
    `calendario-liturgico.json: ${years.length} años (${years[0]}–${years[years.length - 1]}), ` +
      `${(bytes / 1024).toFixed(1)} KB ` +
      `(la tabla completa son ${(fs.statSync(FULL).size / 1024).toFixed(1)} KB).`,
  );
}

main();
