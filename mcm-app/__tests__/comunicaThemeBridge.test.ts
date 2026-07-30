// Contrato App ↔ Comunica: lo que el WebView inyecta en la web embebida.
// Documentado en docs/contratos/COMUNICA_WEBVIEW.md — si esto cambia, hay que
// avisar al lado web (PHP) antes de mergear.

import { themeBridgeJS, COMUNICA_URL } from '@/hooks/useComunicaWebView';

describe('themeBridgeJS', () => {
  it('marca <html> con el tema y escribe la cookie mcm_theme', () => {
    const js = themeBridgeJS('dark', '#121316');
    expect(js).toContain('"dark"');
    expect(js).toContain('r.dataset.mcmTheme=t');
    expect(js).toContain("r.classList.toggle('dark', t==='dark')");
    expect(js).toContain('r.style.colorScheme=t');
    expect(js).toContain("document.cookie='mcm_theme='+t");
    expect(js).toContain('path=/');
    expect(js).toContain('samesite=Lax');
  });

  it('propaga el color de fondo al meta theme-color', () => {
    expect(themeBridgeJS('dark', '#121316')).toContain('"#121316"');
    expect(themeBridgeJS('light', '#FFFFFF')).toContain('"#FFFFFF"');
  });

  it('no rompe si la web no tiene head accesible (todo en try/catch)', () => {
    const js = themeBridgeJS('light', '#FFFFFF');
    expect(js.startsWith('(function(){try{')).toBe(true);
    expect(js.endsWith('}catch(e){}})();true;')).toBe(true);
  });

  it('la URL base marca que se está dentro de la app', () => {
    expect(COMUNICA_URL).toContain('?app=1');
  });
});
