/**
 * Guardarraíl del visor 3D del pañuelo.
 *
 * El visor (three.js + `panuelo-3d/src/`) se empaqueta con esbuild en
 * `panuelo-3d/dist/viewer.bundle.json` y ESE fichero es lo que la app mete en
 * el WebView. Es un artefacto commiteado: si alguien toca el visor, los
 * trazados (`constants/panueloGlyphs.ts`), los colores de la tela
 * (`PanueloColors`) o las reglas de colocación y no lo regenera, la app sigue
 * enseñando el visor viejo y nadie se entera hasta abrir el pañuelo.
 *
 * Si esto te ha salido en rojo: `npm run build:panuelo` y commitea el JSON.
 */
import fs from 'fs';

import {
  buildPanueloCommandScript,
  buildPanueloViewerHtml,
  scriptSafeJson,
} from '@/components/panuelo/panueloViewerHtml';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { buildPanueloViewer, OUT } = require('../scripts/build-panuelo-viewer');

describe('bundle del visor', () => {
  it('el commiteado es el que sale de las fuentes de hoy', async () => {
    const fresh: string = await buildPanueloViewer();
    const committed: string = JSON.parse(fs.readFileSync(OUT, 'utf8')).js;
    // Sin volcar medio mega por pantalla si no coinciden.
    expect(committed.length).toBe(fresh.length);
    expect(committed === fresh).toBe(true);
  }, 60_000);
});

describe('la página del visor', () => {
  const state = { color: 'green' as const, items: [] };

  it('lleva el canvas, el estado inicial y el visor dentro (sin red)', () => {
    const html = buildPanueloViewerHtml({ state, mode: 'edit' });
    expect(html).toContain('<canvas id="panuelo">');
    expect(html).toContain('"mode":"edit"');
    expect(html).not.toMatch(/<script[^>]+src=/);
  });

  it('un nombre con </script> no cierra la etiqueta', () => {
    const nasty = '</script><script>alert(1)</script>';
    expect(scriptSafeJson({ nasty })).not.toContain('</script');
    const html = buildPanueloViewerHtml({
      state: {
        color: 'green',
        items: [
          {
            id: 'x',
            kind: 'chapa',
            look: { kind: 'chapa', bg: '#fff', text: nasty },
            u: 0,
            v: 0.2,
            rot: 0,
          },
        ],
      },
    });
    // Dos etiquetas de script: el estado y el visor. Ni una más.
    expect(html.match(/<script>/g)).toHaveLength(2);
    expect(html.match(/<\/script>/g)).toHaveLength(2);
  });

  it('una orden es una sola llamada y termina en true (WebView de Android)', () => {
    const script = buildPanueloCommandScript({ type: 'focus', id: 'a"b' });
    expect(script).toMatch(/^window\.__panuelo && window\.__panuelo\(/);
    expect(script.trim().endsWith('true;')).toBe(true);
  });
});
