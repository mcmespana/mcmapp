/**
 * Test de `buildReflexionUpdate` — payload multi-path que hace atómica la
 * publicación de una reflexión (`data/<key>` + `updatedAt` en un único
 * `update()`, en vez de dos `set()` separados que podían dejar la entrada
 * escrita pero invisible para otros dispositivos si el segundo fallaba).
 */
import { buildReflexionUpdate } from '@/utils/reflexiones';

describe('buildReflexionUpdate', () => {
  it('genera las dos claves exactas: data/<key> y updatedAt', () => {
    const reflexion = { id: '1', titulo: 'Hola', contenido: 'Mundo' };
    const result = buildReflexionUpdate('abc123', reflexion, 1_700_000_000_000);

    expect(Object.keys(result).sort()).toEqual(['data/abc123', 'updatedAt']);
    expect(result['data/abc123']).toBe(reflexion);
  });

  it('serializa updatedAt como string (contrato de useFirebaseData)', () => {
    const result = buildReflexionUpdate('k', {}, 1_700_000_000_000);
    expect(result.updatedAt).toBe('1700000000000');
    expect(typeof result.updatedAt).toBe('string');
  });

  it('usa la key dada tal cual en el path (push key real de Firebase)', () => {
    const result = buildReflexionUpdate('-Nabc_XYZ', { a: 1 }, 1);
    expect(result['data/-Nabc_XYZ']).toEqual({ a: 1 });
  });
});
