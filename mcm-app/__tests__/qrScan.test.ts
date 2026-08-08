import { describeMismatch, parseScannedQr } from '@/utils/qrScan';

describe('parseScannedQr', () => {
  it('lee el QR de una playlist en la nube', () => {
    expect(parseScannedQr('https://mcm.expo.app/playlist?p=1234')).toEqual({
      kind: 'code',
      target: 'playlist',
      code: '1234',
    });
  });

  it('lee el QR de una sesión de coro', () => {
    expect(parseScannedQr('https://mcm.expo.app/coro?c=0704')).toEqual({
      kind: 'code',
      target: 'choir',
      code: '0704',
    });
  });

  it('acepta el alias ?code= de las pantallas puente', () => {
    expect(parseScannedQr('https://mcm.expo.app/playlist?code=0000')).toEqual({
      kind: 'code',
      target: 'playlist',
      code: '0000',
    });
  });

  it('lee el QR offline con la playlist embebida y lo desescapa', () => {
    const payload = '1~D5~A42t2';
    const result = parseScannedQr(
      `mcmapp://playlist?d=${encodeURIComponent(payload)}`,
    );
    expect(result).toEqual({ kind: 'offline', payload });
  });

  it('el payload offline manda sobre el código si vienen los dos', () => {
    expect(parseScannedQr('mcmapp://playlist?d=1~D5&p=1234')).toEqual({
      kind: 'offline',
      payload: '1~D5',
    });
  });

  it('acepta un código suelto de 4 dígitos, sin flujo concreto', () => {
    expect(parseScannedQr(' 1234 ')).toEqual({
      kind: 'code',
      target: null,
      code: '1234',
    });
  });

  it('ignora QR que no son de la app', () => {
    expect(parseScannedQr('https://www.youtube.com/watch?v=abc')).toBeNull();
    expect(parseScannedQr('WIFI:S:MiRed;T:WPA;P:1234;;')).toBeNull();
    expect(parseScannedQr('https://otracosa.com/algo?p=1234')).toBeNull();
    expect(parseScannedQr('')).toBeNull();
  });

  it('ignora códigos mal formados dentro de un enlace nuestro', () => {
    expect(parseScannedQr('https://mcm.expo.app/playlist?p=12')).toBeNull();
    expect(parseScannedQr('https://mcm.expo.app/coro?c=abcd')).toBeNull();
    expect(parseScannedQr('https://mcm.expo.app/playlist')).toBeNull();
  });
});

describe('describeMismatch', () => {
  const playlistCode = {
    kind: 'code',
    target: 'playlist',
    code: '1234',
  } as const;
  const choirCode = { kind: 'code', target: 'choir', code: '1234' } as const;
  const loose = { kind: 'code', target: null, code: '1234' } as const;
  const offline = { kind: 'offline', payload: '1~D5' } as const;

  it('deja pasar el QR del flujo correcto', () => {
    expect(describeMismatch(playlistCode, 'playlist')).toBeNull();
    expect(describeMismatch(choirCode, 'choir')).toBeNull();
    expect(describeMismatch(offline, 'playlist')).toBeNull();
  });

  it('un código suelto vale para cualquiera de los dos flujos', () => {
    expect(describeMismatch(loose, 'playlist')).toBeNull();
    expect(describeMismatch(loose, 'choir')).toBeNull();
  });

  it('avisa cuando el QR es del otro flujo', () => {
    expect(describeMismatch(choirCode, 'playlist')).toMatch(/coro/i);
    expect(describeMismatch(playlistCode, 'choir')).toMatch(/playlist/i);
    expect(describeMismatch(offline, 'choir')).toMatch(/playlist/i);
  });
});
