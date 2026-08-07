#!/usr/bin/env node
/**
 * Recorta `assets/calendario-liturgico-completo.json` (318 KB, años
 * 2025-2100) a una ventana rodante de 5 años (año actual −1 … actual +3) y la
 * escribe en `assets/calendario-liturgico.json` — el fichero que SÍ importa
 * `components/contigo/LiturgicalBadge.tsx` (Metro lo inlinea en el bundle
 * JS; el `-completo` no tiene ningún import, así que no pesa nada).
 *
 * El año anterior se incluye porque en enero se consultan fechas de
 * diciembre y los `tiempos` litúrgicos cruzan el año civil (Navidad empieza
 * el 25 de diciembre del año anterior).
 *
 * Uso: node scripts/generate-liturgical-window.js
 * Cadencia: una vez al año — el test de vigencia
 * (__tests__/liturgicalWindow.test.ts) avisa cuando toca volver a correrlo.
 */

const fs = require('fs');
const path = require('path');

const SOURCE = path.join(
  __dirname,
  '..',
  'assets',
  'calendario-liturgico-completo.json',
);
const OUTPUT = path.join(
  __dirname,
  '..',
  'assets',
  'calendario-liturgico.json',
);

const now = new Date().getFullYear();
const years = [now - 1, now, now + 1, now + 2, now + 3];

const complete = JSON.parse(fs.readFileSync(SOURCE, 'utf8'));

const windowData = {};
for (const year of years) {
  const key = String(year);
  if (complete[key]) {
    windowData[key] = complete[key];
  } else {
    console.warn(`[liturgical-window] año ${key} no existe en el completo`);
  }
}

// Claves ordenadas para que el diff sea estable entre ejecuciones.
const ordered = {};
for (const key of Object.keys(windowData).sort()) {
  ordered[key] = windowData[key];
}

fs.writeFileSync(OUTPUT, JSON.stringify(ordered, null, 2) + '\n');

console.log(
  `[liturgical-window] escrito ${OUTPUT} con los años ${Object.keys(ordered).join(', ')} (${fs.statSync(OUTPUT).size} bytes)`,
);
