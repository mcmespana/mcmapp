/**
 * Guardarraíl del catálogo del pañuelo (`firebase-seed/panuelo.json`).
 *
 * Ese fichero lo edita una IA cuando el propietario pide «una chapa para el
 * evento tal» (`docs/funcionalidades/PANUELO.md`, «Asignar una pieza a un
 * evento») y luego se sube pieza a pieza con `npm run panuelo:subir`. La app
 * sanea todo lo que llega y **descarta en silencio** lo mal escrito: este test
 * hace que eso se vea aquí, con el porqué, y no en el móvil de nadie.
 *
 *   npm test -- panueloSeed
 */
import seed from '@/firebase-seed/panuelo.json';
import { PANUELO_ITEM_ID, sanitizeCatalog } from '@/utils/panuelo';

type RawItem = Record<string, unknown> & {
  look?: Record<string, unknown>;
  grant?: Record<string, unknown>;
};
const raw = (seed as { items: Record<string, RawItem> }).items;
const clean = sanitizeCatalog(seed);
const ids = Object.keys(raw);

describe('firebase-seed/panuelo.json', () => {
  it('tiene piezas', () => {
    expect(ids.length).toBeGreaterThan(0);
  });

  it.each(ids)(
    '«%s»: id con formato y, si lo repite dentro, el mismo',
    (id) => {
      expect(id).toMatch(PANUELO_ITEM_ID);
      if ('id' in raw[id]) expect(raw[id].id).toBe(id);
    },
  );

  it('no repite ningún id (JSON.parse se quedaría con el último sin avisar)', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const text: string = require('fs').readFileSync(
      require.resolve('@/firebase-seed/panuelo.json'),
      'utf8',
    );
    const keys = [...text.matchAll(/^ {4}"([^"]+)": \{$/gm)].map((m) => m[1]);
    expect(keys.length).toBe(ids.length);
  });

  it.each(ids)('«%s»: no se descarta al sanear', (id) => {
    expect(clean[id]).toBeDefined();
  });

  it.each(ids)('«%s»: no pierde nada del dibujo al sanear', (id) => {
    const look = raw[id].look ?? {};
    const kept = (clean[id]?.look ?? {}) as Record<string, unknown>;
    const lost = Object.keys(look).filter((k) => kept[k] === undefined);
    // Un color que no es hex o una imagen que no es https se caen solos.
    expect({ id, lost }).toEqual({ id, lost: [] });
  });

  it.each(ids)('«%s»: no pierde su forma de conseguirse', (id) => {
    const grant = raw[id].grant;
    if (!grant) return;
    expect(clean[id]?.grant?.type).toBe(grant.type);
  });

  const attendance = ids.filter((id) => raw[id].grant?.type === 'attendance');

  it.each(attendance.length ? attendance : ['(ninguna)'])(
    '«%s» (por asistencia): eventos sin repetir y nunca intercambiable',
    (id) => {
      if (id === '(ninguna)') return;
      const events = raw[id].grant?.events as unknown[];
      expect(Array.isArray(events) && events.length > 0).toBe(true);
      expect(new Set(events).size).toBe(events.length);
      expect(events.every((e) => typeof e === 'string' && e.trim() === e)).toBe(
        true,
      );
      expect(raw[id].tradeable).not.toBe(true);
    },
  );
});
