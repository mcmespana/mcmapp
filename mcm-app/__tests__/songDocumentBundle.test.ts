/**
 * La vista previa del admin del cantoral (`mcm-sheet.js`) tiene que pintar
 * EXACTAMENTE lo que pinta la app. Si esto falla, alguien ha cambiado uno de
 * los dos lados sin el otro.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import vm from 'vm';
import { renderHook, waitFor } from '@testing-library/react-native';
import { Platform } from 'react-native';
import { migrateSongSettings } from '@/contexts/SettingsContext';
import { useSongProcessor } from '@/hooks/useSongProcessor';
import { PREVIEW_DEFAULTS, renderPreview } from '@/utils/songDocumentBundle';

const SONG = `{title: Prueba}
{soc}
[G]Seas quien seas y como [D]seas,
[C]esta es tu casa.
{eoc}

Hay muchas [C]formas de o[G]rar,
tantas como per[Em]sonas.

{chorus}
`;

describe('mcm-sheet.js (vista previa del admin)', () => {
  it('trae los mismos valores por defecto que la app', () => {
    const app = migrateSongSettings({});
    expect(PREVIEW_DEFAULTS).toEqual({
      notation: app.notation,
      chordsVisible: app.chordsVisible,
      compact: app.compactView,
      verseNumbers: app.verseNumbers,
      chorusStyle: app.chorusStyle,
      chorusLabel: app.chorusLabel,
      airy: app.airy,
      fontSize: app.fontSize,
      fontFamily: app.fontFamily,
    });
  });

  it('pinta el mismo HTML que la app (en web) con los mismos ajustes', async () => {
    const os = Platform.OS;
    Platform.OS = 'web';
    try {
      const d = PREVIEW_DEFAULTS;
      const { result } = await renderHook(() =>
        useSongProcessor({
          originalChordPro: SONG,
          currentTranspose: 2,
          chordsVisible: d.chordsVisible,
          compact: true,
          verseNumbers: d.verseNumbers,
          chorusStyle: d.chorusStyle,
          chorusLabel: d.chorusLabel,
          airy: d.airy,
          currentFontSizeEm: d.fontSize,
          currentFontFamily: d.fontFamily,
          notation: 'EN',
          author: 'TSNC',
          key: 'G',
          capo: 2,
        }),
      );
      await waitFor(() => expect(result.current.isLoadingSong).toBe(false));
      const preview = renderPreview(SONG, {
        transpose: 2,
        compact: true,
        notation: 'EN',
        author: 'TSNC',
        key: 'G',
        capo: 2,
      });
      expect(preview.error).toBeNull();
      expect(preview.html).toBe(result.current.songHtml);
      expect(preview.sheetInfo).toEqual(result.current.sheetInfo);
    } finally {
      Platform.OS = os;
    }
  });

  it('un ChordPro roto da la pantalla de error, no una excepción', () => {
    const r = renderPreview('{title: Rota\n[G');
    expect(r.error).not.toBeNull();
    expect(r.html).toContain('Hay un error procesando esta canción');
  });
});

describe('npm run build:sheet-bundle', () => {
  it('empaqueta sin React Native y el paquete pinta en un navegador', () => {
    // Si alguien mete un import de React Native (o de algo que lo arrastre)
    // en la hoja, el paquete deja de construirse o de funcionar: aquí salta.
    const out = path.join(os.tmpdir(), `mcm-sheet-${process.pid}.js`);
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('esbuild').buildSync({
      entryPoints: [path.join(__dirname, '../utils/songDocumentBundle.ts')],
      bundle: true,
      format: 'iife',
      platform: 'browser',
      outfile: out,
      tsconfig: path.join(__dirname, '../tsconfig.json'),
      define: { __DEV__: 'false', 'process.env.NODE_ENV': '"production"' },
      logLevel: 'silent',
    });
    const sandbox: { MCMSheet?: { render: typeof renderPreview } } = {};
    vm.runInNewContext(fs.readFileSync(out, 'utf8'), {
      globalThis: sandbox,
      window: sandbox,
    });
    fs.unlinkSync(out);
    const r = sandbox.MCMSheet!.render(SONG, { notation: 'EN' });
    expect(r.error).toBeNull();
    expect(r.html).toBe(renderPreview(SONG, { notation: 'EN' }).html);
  });
});
