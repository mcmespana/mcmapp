/**
 * Un enlace de Comunica con la sesión abierta (plan 10 §3 y plan 02): el
 * caso delicado es el de OTRA persona. Antes de cambiar se intenta subir lo
 * pendiente; si queda algo, se avisa de cuánto se pierde; nunca se acepta
 * solo (ni en web). Y los avisos del canje dicen lo que ha pasado.
 */
/* eslint-disable import/first */
import { Platform } from 'react-native';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
  usePathname: () => '/comunica',
}));
jest.mock('@/contexts/AppToastContext', () => ({
  useToast: () => ({ toast: { show: jest.fn() } }),
}));

import {
  __resetComunicaApiForTests,
  getComunicaApi,
  getFakeServer,
} from '@/services/comunica';
import { ComunicaApiError } from '@/services/comunica/client';
import { createOutbox } from '@/services/comunica/outbox';
import {
  __resetSessionForTests,
  getSessionState,
  signIn,
} from '@/services/comunica/session';
import { memoryBackend, setStorageBackend } from '@/services/comunica/storage';
import {
  CHOOSE_TEXT,
  confirmSwitch,
  exchangeErrorText,
  handleComunicaLink,
  shouldReturnToGate,
  type LinkDeps,
} from '@/hooks/comunica/useComunicaLinks';

const linkFor = (magic: string) =>
  ({ kind: 'page', destination: null, auth: { magic } }) as const;

async function signedInAs(persona: 'monitor' | 'coordination') {
  __resetSessionForTests();
  __resetComunicaApiForTests();
  setStorageBackend(memoryBackend());
  getComunicaApi();
  const fake = getFakeServer()!;
  fake.setControls({ latencyMs: 0 });
  const t = fake.issueSession(persona);
  await signIn(t, t.me);
  return { fake, me: t.me };
}

function deps(over: Partial<LinkDeps> = {}) {
  const calls = { toasts: [] as string[], asked: [] as string[] };
  const d: LinkDeps = {
    push: jest.fn(),
    toast: (l) => calls.toasts.push(l),
    openLegacy: jest.fn(),
    confirm: async (_t, body) => {
      calls.asked.push(body);
      return false;
    },
    outbox: null,
    clearQueries: jest.fn(),
    ...over,
  };
  return { d, calls };
}

describe('enlace de otra persona con la sesión abierta', () => {
  it('con cola que no sube: lo intenta, avisa de lo que se pierde y no cambia si se cancela', async () => {
    const { me } = await signedInAs('coordination');
    const handler = jest
      .fn()
      .mockRejectedValue(new ComunicaApiError('crm_unavailable', 'x', 503));
    const outbox = createOutbox({
      personId: me.personId,
      handlers: { roll: handler },
      schedule: () => {},
    });
    await outbox.enqueue({
      key: 'roll:s:g',
      kind: 'roll',
      payload: {},
      clientId: 'c',
    });
    await outbox.flush();
    handler.mockClear();
    const { d, calls } = deps({ outbox });
    await handleComunicaLink(linkFor('magico-valido'), d);
    // Se ha intentado subir antes de preguntar.
    expect(handler).toHaveBeenCalled();
    expect(calls.asked).toHaveLength(1);
    expect(calls.asked[0]).toMatch(/un cambio sin subir/);
    expect(calls.asked[0]).toMatch(/se pierde/);
    // Cancelar: sigue dentro quien estaba, y su cola intacta.
    expect(getSessionState().me?.personId).toBe(me.personId);
    expect(outbox.entries()).toHaveLength(1);
    expect(d.clearQueries).not.toHaveBeenCalled();
  });

  it('si lo pendiente sube, pregunta sin aviso de pérdida y entra como la otra', async () => {
    const { me } = await signedInAs('coordination');
    const handler = jest
      .fn()
      .mockRejectedValueOnce(new ComunicaApiError('crm_unavailable', 'x', 503))
      .mockResolvedValue({});
    const outbox = createOutbox({
      personId: me.personId,
      handlers: { roll: handler },
      schedule: () => {},
    });
    await outbox.enqueue({
      key: 'k',
      kind: 'roll',
      payload: {},
      clientId: 'c',
    });
    await outbox.flush();
    const asked: string[] = [];
    const { d } = deps({
      outbox,
      confirm: async (_t, body) => {
        asked.push(body);
        return true;
      },
    });
    await handleComunicaLink(linkFor('magico-valido'), d);
    expect(outbox.entries().every((e) => e.status === 'applied')).toBe(true);
    expect(asked).toHaveLength(1);
    expect(asked[0]).not.toMatch(/se pierde/);
    expect(getSessionState().me?.personId).not.toBe(me.personId);
    expect(d.clearQueries).toHaveBeenCalled();
  });

  it('en web, sin `confirm`, nunca se acepta solo', async () => {
    const os = Platform.OS;
    Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true });
    const g = globalThis as { confirm?: unknown };
    const saved = g.confirm;
    delete g.confirm;
    await expect(confirmSwitch('t', 'b')).resolves.toBe(false);
    g.confirm = () => true;
    await expect(confirmSwitch('t', 'b')).resolves.toBe(true);
    g.confirm = saved;
    Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
  });
});

describe('los avisos del canje', () => {
  it('cada fallo dice lo suyo (no todo es «caducado»)', () => {
    expect(
      exchangeErrorText(
        new ComunicaApiError('validation', 'x', 422, 'link_expired'),
      ),
    ).toMatch(/caducado/);
    expect(exchangeErrorText(new ComunicaApiError('network', 'x'))).toMatch(
      /conexión/,
    );
    expect(exchangeErrorText(new Error('boom'))).not.toMatch(/caducado/);
  });

  it('un enlace caducado y uno de varias personas avisan', async () => {
    await signedInAs('monitor');
    const { d, calls } = deps();
    await handleComunicaLink(linkFor('no-existe'), d);
    expect(calls.toasts).toEqual([
      'El enlace ha caducado. Entra con un código.',
    ]);
    // El falso no da enlaces de varias personas: se simula la respuesta.
    const api = getComunicaApi();
    jest.spyOn(api, 'exchange').mockResolvedValueOnce({ choose: [] } as never);
    await handleComunicaLink(linkFor('magico-valido'), d);
    expect(calls.toasts[1]).toBe(CHOOSE_TEXT);
  });
});

describe('sesión revocada a mitad de pila', () => {
  it('vuelve a la puerta solo si se revoca y se está dentro de Comunica', () => {
    const revoked = { status: 'signedOut', reason: 'revoked' };
    expect(shouldReturnToGate(revoked, '/comunica/grupos/persona/p1')).toBe(
      true,
    );
    expect(shouldReturnToGate(revoked, '/comunica')).toBe(false);
    expect(shouldReturnToGate(revoked, '/cancionero')).toBe(false);
    expect(
      shouldReturnToGate(
        { status: 'signedOut', reason: 'signedOut' },
        '/comunica/yo',
      ),
    ).toBe(false);
  });

  it('si hay que elegir a quién (plan 11), va a «¿A quién?» con el destino', async () => {
    const { d } = deps({ mustChoose: async () => true });
    await handleComunicaLink(
      {
        kind: 'page',
        destination: { internalpage: 'single_stic_events', id: 'ev1' },
        auth: null,
      },
      d,
    );
    expect(d.push).toHaveBeenCalledWith({
      pathname: '/comunica/perfiles',
      params: { destino: 'internalpage=single_stic_events&id=ev1' },
    });
    expect(d.openLegacy).not.toHaveBeenCalled();
  });

  it('si no hay que elegir, abre el destino como siempre', async () => {
    const { d } = deps({ mustChoose: async () => false });
    await handleComunicaLink(
      {
        kind: 'page',
        destination: { internalpage: 'list_stic_payments' },
        auth: null,
      },
      d,
    );
    expect(d.push).not.toHaveBeenCalled();
    expect(d.openLegacy).toHaveBeenCalled();
  });

  it('la ficha de un evento ya es nativa (plan 13)', async () => {
    const { d } = deps({ mustChoose: async () => false });
    await handleComunicaLink(
      {
        kind: 'page',
        destination: { internalpage: 'single_stic_events', id: 'ev1' },
        auth: null,
      },
      d,
    );
    expect(d.push).toHaveBeenCalledWith({
      pathname: '/comunica/actividades/[eventId]',
      params: { eventId: 'ev1' },
    });
    expect(d.openLegacy).not.toHaveBeenCalled();
  });
});
