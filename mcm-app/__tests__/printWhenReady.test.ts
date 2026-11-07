/**
 * Impresión del PDF de la playlist en web (`utils/printWhenReady`): espera a
 * la hoja y a la fuente antes de `print()`, con un tope.
 */
import { printWhenReady } from '@/utils/printWhenReady';

function fakeWindow(opts: { complete?: boolean; fonts?: Promise<unknown> }) {
  const listeners: (() => void)[] = [];
  return {
    w: {
      document: {
        readyState: opts.complete ? 'complete' : 'loading',
        fonts: opts.fonts ? { ready: opts.fonts } : undefined,
      },
      addEventListener: (_: 'load', cb: () => void) => listeners.push(cb),
      focus: jest.fn(),
      print: jest.fn(),
    },
    load: () => listeners.forEach((cb) => cb()),
  };
}

const flush = () => new Promise((r) => setImmediate(r));

beforeEach(() => jest.useFakeTimers({ doNotFake: ['setImmediate'] }));
afterEach(() => jest.useRealTimers());

it('no imprime hasta que llegan la hoja (load) y las fuentes', async () => {
  let fontsReady!: () => void;
  const fonts = new Promise<void>((r) => (fontsReady = r));
  const { w, load } = fakeWindow({ fonts });
  const done = printWhenReady(w, 3000);
  await flush();
  expect(w.print).not.toHaveBeenCalled();
  load();
  await flush();
  expect(w.print).not.toHaveBeenCalled();
  fontsReady();
  await done;
  expect(w.focus).toHaveBeenCalled();
  expect(w.print).toHaveBeenCalledTimes(1);
});

it('si algo no llega nunca, imprime igualmente al llegar al tope', async () => {
  const { w } = fakeWindow({ fonts: new Promise(() => {}) });
  const done = printWhenReady(w, 3000);
  await flush();
  expect(w.print).not.toHaveBeenCalled();
  jest.advanceTimersByTime(3000);
  await done;
  expect(w.print).toHaveBeenCalledTimes(1);
});

it('ya cargada y sin API de fuentes, imprime enseguida', async () => {
  const { w } = fakeWindow({ complete: true });
  await printWhenReady(w, 3000);
  expect(w.print).toHaveBeenCalledTimes(1);
});

it('una ventana cerrada (print lanza) no rompe', async () => {
  const { w } = fakeWindow({ complete: true });
  w.print.mockImplementation(() => {
    throw new Error('closed');
  });
  await expect(printWhenReady(w, 3000)).resolves.toBeUndefined();
});
