/**
 * `utils/sentry.web.ts` — la versión WEB de `utils/sentry.ts`, sin SDK.
 *
 * Guardarraíl doble: (1) que exporte lo mismo que la nativa, porque Metro la
 * sustituye por sufijo y un nombre que falte rompe el bundle web sin que
 * ningún test nativo lo vea; (2) que no vuelva a importar Sentry, que es
 * justo lo que quita (~865 KB del bundle web).
 */
import fs from 'fs';
import path from 'path';

jest.mock('@sentry/react-native', () => ({
  init: jest.fn(),
  wrap: jest.fn((c) => c),
  captureMessage: jest.fn(),
  captureException: jest.fn(),
}));

/* eslint-disable @typescript-eslint/no-require-imports */
const nativa = require('@/utils/sentry');
const web = require('@/utils/sentry.web');
/* eslint-enable @typescript-eslint/no-require-imports */

it('exporta exactamente lo mismo que utils/sentry.ts', () => {
  expect(Object.keys(web).sort()).toEqual(Object.keys(nativa).sort());
});

it('no hace nada: apagada y con el componente raíz tal cual', () => {
  const Root = () => null;
  expect(web.isSentryEnabled).toBe(false);
  expect(web.wrapRoot(Root)).toBe(Root);
  expect(() => web.initSentry()).not.toThrow();
});

it('no importa ningún paquete de Sentry', () => {
  const src = fs.readFileSync(
    path.join(__dirname, '..', 'utils', 'sentry.web.ts'),
    'utf8',
  );
  expect(src).not.toMatch(/(import|require)\b[^\n]*['"]@sentry\//);
});
