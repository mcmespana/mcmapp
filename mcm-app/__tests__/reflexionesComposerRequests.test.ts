/**
 * El «+» de Compartiendo abre el compositor SIN navegar.
 *
 * Hasta noviembre de 2026 el «+» del grupo flotante hacía `router.push` a la
 * misma pantalla con un `openFormNonce` nuevo. Cada toque apilaba otra copia
 * idéntica de Compartiendo, que nacía con el nonce ya puesto y por eso nunca
 * abría el formulario: «le das al más e infinitamente vuelve al mismo sitio».
 *
 * Ahora el layout pide el compositor con `requestReflexionComposer()` y la
 * pantalla enfocada lo abre. Este test vigila las dos mitades: que el canal
 * funcione y que ningún layout vuelva a abrirlo navegando.
 */
import fs from 'fs';
import path from 'path';
import {
  onReflexionComposerRequest,
  requestReflexionComposer,
} from '@/utils/reflexionesComposerRequests';

const ROOT = path.join(__dirname, '..');
const LAYOUTS = [
  'app/(tabs)/mas/_layout.tsx',
  'app/(tabs)/visitapapa/_layout.tsx',
];

describe('petición del compositor', () => {
  it('sin nadie escuchando, avisa de que no la ha atendido nadie', () => {
    expect(requestReflexionComposer()).toBe(false);
  });

  it('la recibe quien escucha, y deja de recibirla al soltarla', () => {
    const listener = jest.fn();
    const off = onReflexionComposerRequest(listener);
    expect(requestReflexionComposer()).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);
    off();
    expect(requestReflexionComposer()).toBe(false);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe.each(LAYOUTS)('%s', (rel) => {
  const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');

  it('el «+» pide el compositor antes de nada', () => {
    const onAdd = src.slice(src.indexOf('onAdd='));
    expect(onAdd).toMatch(
      /^onAdd=\{\(\) => \{\s*if \(requestReflexionComposer\(\)\) return;/,
    );
  });

  it('nadie vuelve al nonce que apilaba pantallas', () => {
    expect(src).not.toMatch(/openFormNonce/);
  });
});

it('la pantalla escucha solo mientras está enfocada', () => {
  const src = fs.readFileSync(
    path.join(ROOT, 'app/screens/ReflexionesScreen.tsx'),
    'utf8',
  );
  const focus = src.slice(src.indexOf('useFocusEffect('));
  expect(focus.slice(0, 800)).toContain('onReflexionComposerRequest(');
});
