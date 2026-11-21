/**
 * `updatedAt` se compara como fecha, no como texto: si no, cualquier
 * diferencia (también un valor más viejo u otra unidad) re-baja el nodo entero.
 */
import { isRemoteUpdatedAtNewer, updatedAtToMs } from '@/utils/updatedAt';

describe('updatedAtToMs', () => {
  it('entiende milisegundos, segundos e ISO', () => {
    expect(updatedAtToMs(1700000000000)).toBe(1700000000000);
    expect(updatedAtToMs('1700000000000')).toBe(1700000000000);
    expect(updatedAtToMs('1700000000')).toBe(1700000000000);
    expect(updatedAtToMs(1700000000)).toBe(1700000000000);
    expect(updatedAtToMs('2026-04-30T12:00:00.000Z')).toBe(
      Date.parse('2026-04-30T12:00:00.000Z'),
    );
  });

  it('devuelve null con lo que no es una fecha', () => {
    expect(updatedAtToMs('fixture')).toBeNull();
    expect(updatedAtToMs('')).toBeNull();
    expect(updatedAtToMs(null)).toBeNull();
    expect(updatedAtToMs(undefined)).toBeNull();
    expect(updatedAtToMs(NaN)).toBeNull();
  });
});

describe('isRemoteUpdatedAtNewer', () => {
  it('solo es nuevo si el remoto es mayor', () => {
    expect(isRemoteUpdatedAtNewer('1', '2')).toBe(true);
    expect(isRemoteUpdatedAtNewer('2', '2')).toBe(false);
    expect(isRemoteUpdatedAtNewer('2', '1')).toBe(false);
  });

  it('normaliza segundos y milisegundos (el CI del cantoral escribe segundos)', () => {
    expect(isRemoteUpdatedAtNewer('1700000000000', 1700000000)).toBe(false);
    expect(isRemoteUpdatedAtNewer('1700000000000', 1700000001)).toBe(true);
  });

  it('compara ISO con ISO y con milisegundos', () => {
    expect(
      isRemoteUpdatedAtNewer(
        '2026-04-30T12:00:00.000Z',
        '2026-05-01T12:00:00.000Z',
      ),
    ).toBe(true);
    expect(
      isRemoteUpdatedAtNewer(
        '2026-05-01T12:00:00.000Z',
        String(Date.parse('2026-04-30T12:00:00.000Z')),
      ),
    ).toBe(false);
  });

  it('con un formato raro vuelve a «distinto = nuevo»', () => {
    expect(isRemoteUpdatedAtNewer('fixture', '5')).toBe(true);
    expect(isRemoteUpdatedAtNewer('fixture', 'fixture')).toBe(false);
  });
});
