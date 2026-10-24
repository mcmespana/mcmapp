import AsyncStorage from '@react-native-async-storage/async-storage';
import { createFakeServer } from '@/services/comunica/fake';
import { FAKE_CODE } from '@/services/comunica/fake/fixtures';
import {
  __resetSessionForTests,
  configureSession,
  currentAccessToken,
  getAccessToken,
  getSessionState,
  initSession,
  memorySecretStore,
  signIn,
  signOut,
  withSession,
} from '@/services/comunica/session';
import {
  memoryBackend,
  readDrawer,
  setStorageBackend,
  writeDrawer,
} from '@/services/comunica/storage';
import { ComunicaApiError } from '@/services/comunica/client';

function setup() {
  __resetSessionForTests();
  setStorageBackend(memoryBackend());
  const secrets = memorySecretStore();
  const fake = createFakeServer(
    { latencyMs: 0 },
    { getAccessToken: currentAccessToken },
  );
  configureSession({
    refresh: (r) => fake.refresh(r),
    logout: (r) => fake.logout(r),
    secrets,
  });
  return { fake, api: withSession(fake), secrets };
}

describe('acceso en el servidor falso', () => {
  it('código: pide, entra; el código malo y el caducado no', async () => {
    const { fake } = setup();
    expect(await fake.requestCode({ email: 'monitor@ejemplo.org' })).toEqual({
      sentTo: 'm•••@ejemplo.org',
    });
    // Un correo que no existe recibe la MISMA respuesta.
    expect(await fake.requestCode({ email: 'nadie@ejemplo.org' })).toEqual({
      sentTo: 'n•••@ejemplo.org',
    });
    await expect(
      fake.verify({ email: 'monitor@ejemplo.org', code: '000000' }),
    ).rejects.toMatchObject({ reason: 'bad_code' });
    const ok = await fake.verify({
      email: 'monitor@ejemplo.org',
      code: FAKE_CODE,
    });
    expect('accessToken' in ok && ok.me.roles).toEqual(['monitor']);
    await expect(
      fake.verify({ email: 'coordinacion@ejemplo.org', code: FAKE_CODE }),
    ).rejects.toMatchObject({ reason: 'code_expired' });
  });

  it('un correo de dos fichas pide elegir', async () => {
    const { fake } = setup();
    await fake.requestCode({ email: 'dos@ejemplo.org' });
    const r = await fake.verify({ email: 'dos@ejemplo.org', code: FAKE_CODE });
    expect('choose' in r && r.choose).toHaveLength(2);
    const pid = 'choose' in r ? r.choose[1].personId : '';
    const chosen = await fake.verify({
      email: 'dos@ejemplo.org',
      code: FAKE_CODE,
      personId: pid,
    });
    expect('me' in chosen && chosen.me.personId).toBe(pid);
  });

  it('límites, DNI y enlace', async () => {
    const { fake } = setup();
    await expect(
      fake.requestCode({ email: 'limite@ejemplo.org' }),
    ).rejects.toMatchObject({ code: 'rate_limited', retryAfter: 1200 });
    await fake.requestCode({ dni: '12345678z' });
    expect(
      'me' in (await fake.verify({ dni: '12345678Z', code: FAKE_CODE })),
    ).toBe(true);
    expect('me' in (await fake.verify({ linkToken: 'enlace-valido' }))).toBe(
      true,
    );
    await expect(
      fake.verify({ linkToken: 'enlace-caducado' }),
    ).rejects.toMatchObject({ reason: 'link_expired' });
  });
});

describe('sesión', () => {
  it('sin sesión, las lecturas dan 401', async () => {
    const { api } = setup();
    await expect(api.getMe()).rejects.toMatchObject({
      code: 'unauthenticated',
    });
  });

  it('con sesión, lee; ante un 401 refresca una vez y repite', async () => {
    const { fake, api } = setup();
    const t = fake.issueSession('coordination');
    await signIn(t, t.me);
    expect((await api.getMe()).me.roles).toContain('coordination');
    // El de acceso caduca: el siguiente pide refresco solo.
    jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 16 * 60_000);
    expect((await api.getToday()).generatedAt).toBeTruthy();
    jest.restoreAllMocks();
    expect(getSessionState().status).toBe('signedIn');
  });

  it('el refresco rota y uno reutilizado revoca la sesión', async () => {
    const { fake } = setup();
    const t = fake.issueSession('monitor');
    const r1 = await fake.refresh(t.refreshToken);
    expect(r1.refreshToken).not.toBe(t.refreshToken);
    await expect(fake.refresh(t.refreshToken)).rejects.toBeInstanceOf(
      ComunicaApiError,
    );
    await expect(fake.refresh(r1.refreshToken)).rejects.toMatchObject({
      code: 'unauthenticated',
    });
  });

  it('si el servidor revoca, se acaba la sesión sin borrar la cola', async () => {
    const { fake } = setup();
    const t = fake.issueSession('monitor');
    await signIn(t, t.me);
    await writeDrawer(t.me.personId, 'outbox', [{ key: 'x' }]);
    fake.revokeAll();
    expect(await getAccessToken(true)).toBeNull();
    expect(getSessionState()).toMatchObject({
      status: 'signedOut',
      reason: 'revoked',
    });
    expect(await readDrawer(t.me.personId, 'outbox')).toEqual([{ key: 'x' }]);
  });

  it('salir revoca y borra todo lo del área', async () => {
    const { fake, secrets } = setup();
    const t = fake.issueSession('monitor');
    await signIn(t, t.me);
    await writeDrawer(t.me.personId, 'queries', { a: 1 });
    await signOut();
    expect(await readDrawer(t.me.personId, 'queries')).toBeNull();
    expect(await secrets.get('@comunica/refresh')).toBeNull();
    await expect(fake.refresh(t.refreshToken)).rejects.toMatchObject({
      code: 'unauthenticated',
    });
  });

  it('al arrancar, con sesión guardada se entra sin red', async () => {
    const { fake, secrets } = setup();
    const t = fake.issueSession('monitor');
    await signIn(t, t.me);
    __resetSessionForTests();
    configureSession({
      refresh: () => Promise.reject(new ComunicaApiError('network', 'x')),
      logout: async () => {},
      secrets,
    });
    await initSession();
    expect(getSessionState()).toMatchObject({
      status: 'signedIn',
      me: { personId: t.me.personId },
    });
  });

  // Guardarraíl (plan 02 «Tests»): con el servidor de verdad, el refresco no
  // pasa nunca por AsyncStorage.
  it('el token de refresco no toca AsyncStorage con un almacén de secretos', async () => {
    const { fake } = setup();
    const t = fake.issueSession('monitor');
    (AsyncStorage.setItem as jest.Mock).mockClear();
    await signIn(t, t.me);
    const written = (AsyncStorage.setItem as jest.Mock).mock.calls.map((c) =>
      String(c[1]),
    );
    expect(written.some((v) => v.includes(t.refreshToken))).toBe(false);
  });
});
