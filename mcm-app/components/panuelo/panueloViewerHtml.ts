/**
 * La página del visor 3D del pañuelo, lista para un WebView (o un iframe en
 * web).
 *
 * El JavaScript del visor (three.js + `panuelo-3d/src/`) va DENTRO de la
 * página, no se descarga: el pañuelo se abre sin red y cada versión de la app
 * lleva su visor. Se genera con `npm run build:panuelo` y se commitea
 * (`panuelo-3d/dist/viewer.bundle.json`).
 *
 * Por qué un WebView y no `expo-gl`: es la misma decisión que con las
 * medallas (`components/medallas/medalViewerHtml.ts`). Un solo código para
 * iOS, Android y web, sale por OTA y se puede probar en un navegador.
 */
import viewerBundle from '@/panuelo-3d/dist/viewer.bundle.json';
import type { PanueloViewerState } from '@/types/panuelo';

export type PanueloViewerInit = {
  state: PanueloViewerState;
  mode?: 'view' | 'edit';
  /** Sin la vuelta de entrada (tests y capturas). */
  still?: boolean;
};

/**
 * JSON que se puede pegar dentro de un `<script>`: un `</script>` (o un
 * `<!--`) en el nombre de una pieza cerraría la etiqueta por las bravas.
 */
export function scriptSafeJson(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

/** El bundle no puede llevar un `</script` literal: cerraría su etiqueta. */
const VIEWER_JS = viewerBundle.js.replace(/<\/script/gi, '<\\/script');

export function buildPanueloViewerHtml(init: PanueloViewerInit): string {
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<style>
  html, body { margin: 0; height: 100%; background: transparent; overflow: hidden; }
  body { -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; -webkit-tap-highlight-color: transparent; }
  canvas { width: 100%; height: 100%; display: block; touch-action: none; outline: none; }
</style>
</head>
<body>
<canvas id="panuelo"></canvas>
<script>window.__PANUELO_INIT__ = ${scriptSafeJson(init)};</script>
<script>${VIEWER_JS}</script>
</body>
</html>`;
}

/** La orden que se inyecta en el WebView para hablarle al visor. */
export function buildPanueloCommandScript(command: unknown): string {
  return `window.__panuelo && window.__panuelo(${scriptSafeJson(command)}); true;`;
}
