/**
 * Guardarraíl del plan 01 §7: ninguna consulta con `persist: false` (la salud)
 * llega al almacén del móvil. Y los textos del acceso.
 */
import { QueryClient } from '@tanstack/react-query';
import { dehydrateArea } from '@/services/comunica/persist';
import {
  accessErrorText,
  looksLikeDni,
  looksLikeEmail,
} from '@/components/comunica/acceso/copy';
import { ComunicaApiError } from '@/services/comunica/client';

describe('caché guardada', () => {
  it('solo lo marcado persist: true, nunca la salud', async () => {
    const qc = new QueryClient();
    await qc.fetchQuery({
      queryKey: ['comunica', 'groups'],
      queryFn: async () => ({ a: 1 }),
      meta: { persist: true },
    });
    await qc.fetchQuery({
      queryKey: ['comunica', 'health', 'p1'],
      queryFn: async () => ({ text: 'alergia' }),
      meta: { persist: false },
    });
    await qc.fetchQuery({
      queryKey: ['comunica', 'otra'],
      queryFn: async () => 1,
    });
    const saved = JSON.stringify(dehydrateArea(qc));
    expect(saved).toContain('groups');
    expect(saved).not.toContain('alergia');
    expect(saved).not.toContain('otra');
    qc.clear();
  });
});

describe('acceso', () => {
  it('reconoce DNI/NIE y correos', () => {
    expect(looksLikeDni('12345678z')).toBe(true);
    expect(looksLikeDni('X1234567L')).toBe(true);
    expect(looksLikeDni('1234')).toBe(false);
    expect(looksLikeEmail('a@b.es')).toBe(true);
    expect(looksLikeEmail('a@b')).toBe(false);
  });
  it('mensajes de error', () => {
    expect(
      accessErrorText(
        new ComunicaApiError('rate_limited', '', 429, undefined, 1200),
      ),
    ).toBe('Demasiados intentos. Espera 20 minutos.');
    expect(
      accessErrorText(
        new ComunicaApiError('validation', '', 422, 'code_expired'),
      ),
    ).toMatch(/caducado/);
    expect(accessErrorText(new ComunicaApiError('network', ''))).toMatch(
      /conexión/,
    );
  });
});
