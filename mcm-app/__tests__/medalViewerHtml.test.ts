import fs from 'fs';
import path from 'path';

import {
  MODEL_VIEWER_URL,
  buildMedalViewerHtml,
} from '@/components/medallas/medalViewerHtml';
import { LAB_MEDALS, MEDALLAS_CDN } from '@/components/medallas/labMedals';

describe('buildMedalViewerHtml', () => {
  const src = 'https://cdn.jsdelivr.net/gh/x/y@main/medallas-3d/a.glb';

  it('carga el visor con versión fijada y el modelo pedido', () => {
    const html = buildMedalViewerHtml({ src });
    expect(MODEL_VIEWER_URL).toMatch(/@google\/model-viewer@\d+\.\d+\.\d+\//);
    expect(html).toContain(`src="${MODEL_VIEWER_URL}"`);
    expect(html).toContain(`src="${src}"`);
  });

  it('avisa a la app tanto en nativo como en web', () => {
    const html = buildMedalViewerHtml({ src });
    expect(html).toContain('ReactNativeWebView.postMessage');
    expect(html).toContain('window.parent.postMessage');
    expect(html).toContain("send('loaded')");
    expect(html).toContain("send('error')");
  });

  it('entra girando por defecto y quieta si se pide', () => {
    expect(buildMedalViewerHtml({ src })).toContain('spin();');
    const still = buildMedalViewerHtml({ src, spinIn: false });
    expect(still).not.toContain('spin();');
    expect(still).toContain('camera-orbit="0deg');
  });

  it('una URL no puede romper el atributo ni meter etiquetas', () => {
    const html = buildMedalViewerHtml({
      src: 'https://x/a.glb"><script>alert(1)</script>',
    });
    expect(html).not.toContain('<script>alert(1)');
    expect(html).toContain('&quot;&gt;&lt;script&gt;');
  });
});

describe('LAB_MEDALS', () => {
  it('cada medalla es un .glb de la carpeta medallas-3d del repo', () => {
    const ids = new Set<string>();
    for (const m of LAB_MEDALS) {
      expect(ids.has(m.id)).toBe(false);
      ids.add(m.id);
      expect(m.glbUrl).toBe(`${MEDALLAS_CDN}${m.id}.glb`);
    }
  });

  it('el .glb que se pide existe de verdad en el repo', () => {
    for (const m of LAB_MEDALS) {
      const file = path.join(
        __dirname,
        '..',
        '..',
        'medallas-3d',
        `${m.id}.glb`,
      );
      expect(fs.existsSync(file)).toBe(true);
    }
  });
});
