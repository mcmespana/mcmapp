import AsyncStorage from '@react-native-async-storage/async-storage';
import { createFakeServer } from '@/services/comunica/fake';
import { FAKE_CODE } from '@/services/comunica/fake/fixtures';
import {
  __resetComunicaApiForTests,
  getComunicaApi,
} from '@/services/comunica';
import {
  __resetSessionForTests,
  configureSession,
  currentAccessToken,
  getAccessToken,
  getSessionState,
  initSession,
  memorySecretStore,
  onSessionEnd,
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

// El llavero de este binario (`expo-secure-store`), en memoria: el de Jest no
// guarda nada.
const mockKeychain = new Map<string, string>();
jest.mock('expo-secure-store', () => ({
  AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 0,
  getItemAsync: async (k: string) => mockKeychain.get(k) ?? null,
  setItemAsync: async (k: string, v: string) => {
    mockKeychain.set(k, v);
  },
  deleteItemAsync: async (k: string) => {
    mockKeychain.delete(k);
  },
}));

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

  it('salir revoca y borra los cajones (de punta a punta: areaProvider.test)', async () => {
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

  it('salir apaga lo de la sesión ANTES de borrar el móvil', async () => {
    const { fake } = setup();
    const t = fake.issueSession('monitor');
    await signIn(t, t.me);
    const order: string[] = [];
    onSessionEnd(() => order.push('fin de sesión'));
    const be = memoryBackend();
    setStorageBackend({
      ...be,
      removeItem: async (k) => {
        order.push('borrar');
        await be.removeItem(k);
      },
    });
    await writeDrawer(t.me.personId, 'outbox', [{ key: 'x' }]);
    await signOut();
    expect(order[0]).toBe('fin de sesión');
    expect(order).toContain('borrar');
  });

  it('un refresco en vuelo al salir no reescribe el token ni lo usa', async () => {
    __resetSessionForTests();
    setStorageBackend(memoryBackend());
    const secrets = memorySecretStore();
    let finish: (v: unknown) => void = () => {};
    configureSession({
      refresh: () => new Promise((r) => (finish = r as never)),
      logout: async () => {},
      secrets,
    });
    const fake = createFakeServer({ latencyMs: 0 });
    const t = fake.issueSession('monitor');
    await signIn({ ...t, expiresIn: 0 }, t.me);
    const pending = getAccessToken();
    await new Promise((r) => setTimeout(r, 0));
    await signOut();
    finish({ accessToken: 'nuevo', refreshToken: 'rotado', expiresIn: 900 });
    expect(await pending).toBeNull();
    expect(await secrets.get('@comunica/refresh')).toBeNull();
    expect(currentAccessToken()).toBeNull();
  });

  it('lo que empezó con A no se repite con el token de B', async () => {
    const { fake, api } = setup();
    const a = fake.issueSession('monitor');
    await signIn(a, a.me);
    // Una llamada de A se queda colgada en el servidor…
    fake.setControls({ latencyMs: 50 });
    const call = api.getMe().catch((e) => e);
    fake.setControls({ latencyMs: 0 });
    // …mientras A sale y entra B.
    await signOut();
    const b = fake.issueSession('coordination');
    await signIn(b, b.me);
    // Sin la época, la llamada de A llegaba al servidor con el token de B y
    // volvía contestada como B.
    expect(await call).toMatchObject({
      code: 'unauthenticated',
      reason: 'session_changed',
    });
    expect(getSessionState().me?.personId).toBe(b.me.personId);
  });

  it('un 401 sin con qué refrescar acaba la sesión (revocada)', async () => {
    const { fake, api, secrets } = setup();
    const t = fake.issueSession('monitor');
    await signIn(t, t.me);
    await secrets.remove('@comunica/refresh');
    fake.revokeAll();
    await expect(api.getMe()).rejects.toMatchObject({
      code: 'unauthenticated',
    });
    expect(getSessionState()).toMatchObject({
      status: 'signedOut',
      reason: 'revoked',
    });
  });
});

// Guardarraíl (plan 02 «Tests»): con el servidor DE VERDAD, el refresco no
// pasa nunca por AsyncStorage. Usa el cableado real de `getComunicaApi()`
// (qué almacén de secretos elige) y el cliente HTTP con un `fetch` falso.
describe('con el servidor de verdad', () => {
  const realFetch = global.fetch;
  afterEach(() => {
    global.fetch = realFetch;
    delete process.env.EXPO_PUBLIC_COMUNICA_API;
    __resetComunicaApiForTests();
    __resetSessionForTests();
  });

  it('el token de refresco no toca AsyncStorage (ni al entrar ni al refrescar)', async () => {
    __resetSessionForTests();
    __resetComunicaApiForTests();
    process.env.EXPO_PUBLIC_COMUNICA_API = 'https://api.example.org';
    const me = {
      personId: 'p1',
      name: 'Lucía',
      delegation: { id: 'd1', name: 'Villaclara' },
      roles: ['monitor'],
      scope: 'delegation',
      canSeeHealth: false,
    };
    let refreshes = 0;
    global.fetch = jest.fn(async (url: string) => {
      const json = String(url).endsWith('/v1/auth/refresh')
        ? {
            accessToken: `acc-${++refreshes}`,
            refreshToken: `REFRESCO-ROTADO-${refreshes}`,
            expiresIn: 900,
          }
        : { generatedAt: '2026-10-24T10:00:00+02:00', me };
      return { ok: true, status: 200, json: async () => json } as Response;
    }) as never;
    const api = getComunicaApi();
    (AsyncStorage.setItem as jest.Mock).mockClear();
    await signIn(
      { accessToken: 'a0', refreshToken: 'REFRESCO-INICIAL', expiresIn: 0 },
      me as never,
    );
    await api.getMe(); // caducado: refresca y rota
    expect(refreshes).toBe(1);
    const written = (AsyncStorage.setItem as jest.Mock).mock.calls
      .map((c) => `${c[0]}=${c[1]}`)
      .join('\n');
    expect(written).not.toMatch(/REFRESCO-/);
    // Y sí guarda quién es (no es secreto).
    expect(written).toMatch(/session-person/);
    // El de refresco, rotado, vive en el llavero.
    expect(mockKeychain.get('comunica_refresh')).toBe('REFRESCO-ROTADO-1');
  });
});
