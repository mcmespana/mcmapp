/**
 * Tests de `utils/surveyIdentity.ts`: identidad real en encuestas.
 *
 *  - `hasUserAnswered`/`markUserAnswered` sirven la dedup entre dispositivos
 *    de una misma persona autenticada (marcador en `users/<uid>/…`, aparte
 *    del anti-reenvío local por `deviceId`).
 *  - `buildIdentityFields` es puro: encuestas anónimas no llevan NADA de
 *    identidad, y `userId` solo aparece si hay sesión.
 */
import { get, set } from 'firebase/database';
import {
  userAnsweredPath,
  hasUserAnswered,
  markUserAnswered,
  buildIdentityFields,
} from '@/utils/surveyIdentity';

const snapshot = (value: unknown) => ({
  exists: () => value !== null && value !== undefined,
  val: () => value,
});

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);
});

describe('userAnsweredPath', () => {
  it('construye la ruta bajo el nodo del propio usuario', () => {
    expect(userAnsweredPath('u1', 'survey_done_encuesta-1')).toBe(
      'users/u1/surveysAnswered/survey_done_encuesta-1',
    );
  });
});

describe('hasUserAnswered', () => {
  it('true si el marcador existe', async () => {
    (get as jest.Mock).mockResolvedValueOnce(snapshot({ at: 1 }));
    await expect(hasUserAnswered('u1', 'scope')).resolves.toBe(true);
  });

  it('false si no existe', async () => {
    (get as jest.Mock).mockResolvedValueOnce(snapshot(null));
    await expect(hasUserAnswered('u1', 'scope')).resolves.toBe(false);
  });

  it('false (no lanza) si Firebase falla', async () => {
    (get as jest.Mock).mockRejectedValueOnce(new Error('sin red'));
    await expect(hasUserAnswered('u1', 'scope')).resolves.toBe(false);
  });
});

describe('markUserAnswered', () => {
  it('escribe el timestamp y, si se da, el surveyId', async () => {
    await markUserAnswered('u1', 'scope', 'encuesta-1');
    expect(set).toHaveBeenCalledWith(expect.anything(), {
      at: 1_700_000_000_000,
      surveyId: 'encuesta-1',
    });
  });

  it('sin surveyId, no incluye esa clave', async () => {
    await markUserAnswered('u1', 'scope');
    expect(set).toHaveBeenCalledWith(expect.anything(), {
      at: 1_700_000_000_000,
    });
  });
});

describe('buildIdentityFields', () => {
  it('encuesta anónima no lleva ningún campo de identidad', () => {
    expect(
      buildIdentityFields({ anonymous: true, name: 'Ana', authUid: 'u1' }),
    ).toEqual({});
  });

  it('sin sesión, no incluye userId', () => {
    const fields = buildIdentityFields({ name: 'Ana', profileType: 'monitor' });
    expect(fields).toEqual({
      userName: 'Ana',
      userProfileType: 'monitor',
      userDelegation: 'Sin delegación',
    });
    expect(fields).not.toHaveProperty('userId');
  });

  it('con sesión, incluye userId', () => {
    const fields = buildIdentityFields({
      name: 'Ana',
      authUid: 'u1',
      profileType: 'monitor',
      delegationLabel: 'Madrid',
    });
    expect(fields).toEqual({
      userName: 'Ana',
      userProfileType: 'monitor',
      userDelegation: 'Madrid',
      userId: 'u1',
    });
  });

  it('sin nombre/perfil/delegación, usa los valores por defecto', () => {
    const fields = buildIdentityFields({ name: '' });
    expect(fields).toEqual({
      userName: 'Anónimo',
      userProfileType: 'sin-perfil',
      userDelegation: 'Sin delegación',
    });
  });
});
