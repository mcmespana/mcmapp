import { resolveComunicaApiTarget } from '@/services/comunica';

describe('EXPO_PUBLIC_COMUNICA_API', () => {
  it('sin variable: falso en desarrollo, apagado en producción', () => {
    expect(resolveComunicaApiTarget(undefined, true)).toEqual({ kind: 'fake' });
    expect(resolveComunicaApiTarget(undefined, false)).toEqual({ kind: 'off' });
    expect(resolveComunicaApiTarget('  ', false)).toEqual({ kind: 'off' });
  });

  it('fake y URL', () => {
    expect(resolveComunicaApiTarget('fake', false)).toEqual({ kind: 'fake' });
    expect(resolveComunicaApiTarget('https://api.example.org', false)).toEqual({
      kind: 'http',
      baseUrl: 'https://api.example.org',
    });
  });

  it('http solo en desarrollo; lo raro apaga', () => {
    expect(resolveComunicaApiTarget('http://localhost:8787', true).kind).toBe(
      'http',
    );
    expect(resolveComunicaApiTarget('http://localhost:8787', false).kind).toBe(
      'off',
    );
    expect(resolveComunicaApiTarget('cualquiera', true).kind).toBe('off');
  });
});
