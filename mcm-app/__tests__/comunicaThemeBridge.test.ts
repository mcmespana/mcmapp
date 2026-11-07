// Contrato App ↔ Comunica: lo que el WebView inyecta en la web embebida.
// Documentado en docs/contratos/COMUNICA_WEBVIEW.md — si esto cambia, hay que
// avisar al lado web (PHP) antes de mergear.

import {
  themeBridgeJS,
  safeAreaBridgeJS,
  COMUNICA_URL,
} from '@/hooks/useComunicaWebView';

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

describe('safeAreaBridgeJS', () => {
  const android = (
    over: Partial<Parameters<typeof safeAreaBridgeJS>[0]> = {},
  ) =>
    safeAreaBridgeJS({
      top: 44,
      bottom: 110,
      widthDp: 390,
      applyPadding: true,
      ...over,
    });

  it('publica las dos variables CSS con los insets', () => {
    const js = android();
    expect(js).toContain("r.style.setProperty('--mcm-app-inset-top'");
    expect(js).toContain("r.style.setProperty('--mcm-app-inset-bottom'");
    expect(js).toContain('var TOP=44,BOT=110');
  });

  it('en Android mueve el body con el padding de los insets', () => {
    const js = android({ applyPadding: true });
    expect(js).toContain('APPLY=true');
    expect(js).toContain('padding-top:var(--mcm-app-inset-top)!important');
    expect(js).toContain(
      'padding-bottom:var(--mcm-app-inset-bottom)!important',
    );
  });

  it('en iOS solo publica las variables (el hueco lo pone contentInset)', () => {
    expect(android({ applyPadding: false })).toContain('APPLY=false');
  });

  it('deja que la web reserve el hueco ella misma con data-mcm-insets="self"', () => {
    expect(android()).toContain("r.getAttribute('data-mcm-insets')==='self'");
  });

  it('es idempotente: reutiliza siempre el mismo <style> por id', () => {
    const js = android();
    expect(js).toContain("document.getElementById('mcm-app-safe-area')");
    // Se reescribe el contenido del que ya existe en vez de añadir otro.
    expect(js).toContain('el.textContent=');
    expect(js.match(/createElement\('style'\)/g)).toHaveLength(1);
  });

  it('convierte dp a px CSS con el ancho real del viewport', () => {
    const js = android({ widthDp: 390 });
    expect(js).toContain('var W=390');
    expect(js).toContain('window.innerWidth/W');
    // Fuera de un rango razonable se ignora la proporción (viewport raro).
    expect(js).toContain('if(!isFinite(s)||s<=0.2||s>5)s=1;');
  });

  it('no rompe si la web no tiene head accesible (todo en try/catch)', () => {
    const js = android();
    expect(js.startsWith('(function(){try{')).toBe(true);
    expect(js.endsWith('}catch(e){}})();true;')).toBe(true);
  });
});
