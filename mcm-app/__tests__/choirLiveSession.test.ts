/**
 * Reglas del "coro en vivo" tras el rediseño:
 *
 *  - la sesión cuelga del **coro** (la clave del nodo es el id del coro), pero
 *    se siguen aceptando códigos sueltos de 4 dígitos;
 *  - **caduca 24 h después de empezar** y no se estira publicando;
 *  - **el mismo usuario puede tomar el mando desde otro dispositivo** sin
 *    contraseña; cualquier otra persona sí la necesita.
 */
import {
  CHOIR_SESSION_TTL_MS,
  isSameLeader,
  isSessionKey,
  isSessionLive,
  type ChoirSession,
} from '@/services/choirSessionService';

const baseSession = (over: Partial<ChoirSession> = {}): ChoirSession =>
  ({
    v: 1,
    master: { deviceId: 'dev-1', name: 'David', lastSeen: 0 },
    playlist: [],
    current: null,
    createdAt: 0,
    startedAt: 0,
    updatedAt: 0,
    lastActivity: 0,
    expiresAt: CHOIR_SESSION_TTL_MS,
    ...over,
  }) as ChoirSession;

describe('isSessionKey', () => {
  it('acepta códigos de 4 dígitos y ids de coro', () => {
    expect(isSessionKey('1234')).toBe(true);
    expect(isSessionKey('consolacion-castellon-4f2a')).toBe(true);
  });

  it('rechaza cualquier otra cosa', () => {
    expect(isSessionKey('12')).toBe(false);
    expect(isSessionKey('sinGuion')).toBe(false);
    expect(isSessionKey('')).toBe(false);
  });
});

describe('caducidad a las 24 h', () => {
  it('viva justo antes de las 24 h', () => {
    expect(isSessionLive(baseSession(), CHOIR_SESSION_TTL_MS - 1)).toBe(true);
  });

  it('muerta justo en las 24 h', () => {
    expect(isSessionLive(baseSession(), CHOIR_SESSION_TTL_MS)).toBe(false);
  });

  it('una sesión antigua sin `expiresAt` se mide desde que empezó', () => {
    const legacy = baseSession({
      expiresAt: undefined as any,
      startedAt: 1000,
    });
    expect(isSessionLive(legacy, 1000 + CHOIR_SESSION_TTL_MS - 1)).toBe(true);
    expect(isSessionLive(legacy, 1000 + CHOIR_SESSION_TTL_MS + 1)).toBe(false);
  });

  it('no hay sesión → no está viva', () => {
    expect(isSessionLive(null)).toBe(false);
  });
});

describe('quién puede tomar el mando sin contraseña', () => {
  it('el mismo dispositivo, siempre', () => {
    expect(isSameLeader(baseSession(), { deviceId: 'dev-1' })).toBe(true);
  });

  it('el mismo usuario desde otro móvil (mismo nombre de perfil)', () => {
    expect(
      isSameLeader(baseSession(), { deviceId: 'otro', name: '  david  ' }),
    ).toBe(true);
  });

  it('otra persona, no', () => {
    expect(isSameLeader(baseSession(), { deviceId: 'otro', name: 'Ana' })).toBe(
      false,
    );
  });

  it('sin nombre en el perfil no basta con que el líder tampoco lo tenga', () => {
    const anon = baseSession({
      master: { deviceId: 'dev-1', lastSeen: 0 },
    });
    expect(isSameLeader(anon, { deviceId: 'otro' })).toBe(false);
  });

  it('si no hay sesión, no hay a quién quitarle el mando', () => {
    expect(isSameLeader(null, { deviceId: 'quien-sea' })).toBe(true);
  });
});
