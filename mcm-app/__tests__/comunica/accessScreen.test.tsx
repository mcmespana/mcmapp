/**
 * «Entra en tu área» cuando el correo no existe (plan 02; igual que la web desde el 31/10/2026, `docs/ACCESO.md` §2 del plugin):
 *
 *   · Un correo que no está en Comunica SE DICE: aviso con el correo tecleado, el campo RELLENO para corregir la errata y debajo la tarjeta del DNI.
 *   · Por DNI: sin ficha y sin correo, cada uno con su mensaje (y la sin-correo, con el enlace a la oficina técnica).
 *   · El freno por red (`too_many_misses`) avisa de esperar; una caída del CRM NO dice que no existe ni ofrece el DNI.
 *   · Lo que el servidor falso hace de verdad (correo desconocido, DNI sin correo, tope a los 8 fallos).
 */
/* eslint-disable react/display-name, @typescript-eslint/no-require-imports, import/first */
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Linking, Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { HeroUINativeProvider } from 'heroui-native';

const mockRouter = { push: jest.fn(), back: jest.fn(), replace: jest.fn() };
jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  useRouter: () => mockRouter,
  useLocalSearchParams: () => ({}),
}));
jest.mock('@expo/vector-icons', () => {
  const stub = () => null;
  return { MaterialIcons: stub, Ionicons: stub };
});
jest.mock('@expo/vector-icons/MaterialIcons', () => () => null);
jest.mock('@/hooks/useColorScheme', () => ({ useColorScheme: () => 'light' }));
jest.mock('@/hooks/useTabBarClearance', () => {
  const f = (extra = 0) => 100 + extra;
  return { __esModule: true, default: f, useTabBarClearance: f };
});
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: null }),
}));

import AccessScreen from '@/components/comunica/acceso/AccessScreen';
import {
  ACCESS_TEXT,
  accessErrorText,
  codeRequestProblem,
  OFFICE_EMAIL,
} from '@/components/comunica/acceso/copy';
import { getCodeHandoff } from '@/components/comunica/acceso/handoff';
import {
  __resetComunicaApiForTests,
  getComunicaApi,
  getFakeServer,
} from '@/services/comunica';
import { ComunicaApiError } from '@/services/comunica/client';
import type { FakeServer } from '@/services/comunica/fake';
import {
  FAKE_MISS_LIMIT,
  FAKE_NO_EMAIL_DNI,
} from '@/services/comunica/fake/fixtures';
import { __resetSessionForTests } from '@/services/comunica/session';
import { memoryBackend, setStorageBackend } from '@/services/comunica/storage';

const err = (
  code: ConstructorParameters<typeof ComunicaApiError>[0],
  reason?: string,
  retryAfter?: number,
) => new ComunicaApiError(code, 'x', 422, reason, retryAfter);

describe('lo que se dice según el fallo', () => {
  it('correo sin ficha: aviso con el correo y la salida del DNI', () => {
    expect(codeRequestProblem(err('validation', 'no_match'), 'email')).toEqual({
      kind: 'email_miss',
      text: 'Ese correo no está en Comunica.',
      office: false,
    });
  });

  it('DNI sin ficha: su mensaje, sin tarjeta del DNI', () => {
    expect(codeRequestProblem(err('validation', 'no_match'), 'dni')).toEqual({
      kind: 'text',
      text: 'No encontramos a nadie con ese documento.',
      office: false,
    });
  });

  it('DNI con ficha sin correo: escribe a la oficina técnica (con enlace)', () => {
    expect(codeRequestProblem(err('validation', 'no_email'), 'dni')).toEqual({
      kind: 'text',
      text: 'Te encontramos, pero no tenemos un correo tuyo: escribe a la oficina técnica.',
      office: true,
    });
  });

  it('demasiados fallos desde esa red: espera o escríbenos (con enlace)', () => {
    const p = codeRequestProblem(
      err('rate_limited', 'too_many_misses', 1800),
      'email',
    );
    expect(p).toMatchObject({ kind: 'text', office: true });
    expect(p.text).toMatch(/Espera unos minutos o escríbenos/);
  });

  it('el tope de envíos sin motivo sigue siendo «Espera N minutos», sin enlace', () => {
    const p = codeRequestProblem(err('rate_limited', undefined, 1200), 'email');
    expect(p).toEqual({
      kind: 'text',
      text: 'Demasiados intentos. Espera 20 minutos.',
      office: false,
    });
  });

  it('una caída del CRM NO dice que no existe ni manda al DNI', () => {
    for (const via of ['email', 'dni'] as const) {
      const p = codeRequestProblem(err('crm_unavailable', 'crm_error'), via);
      expect(p.kind).toBe('text');
      expect(p.text).toMatch(/no responde/);
      expect(p.text).not.toMatch(/no está en Comunica|nadie/);
    }
  });

  it('sin red y lo desconocido, como siempre', () => {
    expect(codeRequestProblem(err('network'), 'email').text).toMatch(
      /Sin conexión/,
    );
    expect(codeRequestProblem(new Error('x'), 'dni').text).toMatch(
      /No se ha podido/,
    );
  });

  it('la cuenta de la app sin ficha sigue con su texto (no es el del correo tecleado)', () => {
    expect(accessErrorText(err('validation', 'no_match'))).toMatch(
      /cuenta de la app/,
    );
  });
});

// ── La pantalla, con el servidor falso ──────────────────────────────────────

const METRICS = {
  frame: { x: 0, y: 0, width: 375, height: 812 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};
const texts = (tree: ReactTestRenderer) =>
  tree.root
    .findAllByType(Text)
    .map((t) => [t.props.children].flat().join(''))
    .join(' | ');
const byLabel = (tree: ReactTestRenderer, label: string, prop: string) =>
  tree.root.findAll(
    (n) =>
      typeof n.props[prop] === 'function' &&
      n.props.accessibilityLabel === label,
  );
const has = (tree: ReactTestRenderer, label: string, prop = 'onPress') =>
  byLabel(tree, label, prop).length > 0;
const press = async (tree: ReactTestRenderer, label: string) => {
  const b = byLabel(tree, label, 'onPress').at(0);
  if (!b) throw new Error(`No hay nada que tocar con «${label}»`);
  await act(async () => {
    b.props.onPress();
  });
};
const type = async (tree: ReactTestRenderer, label: string, value: string) => {
  const f = byLabel(tree, label, 'onChangeText').at(0);
  if (!f) throw new Error(`No hay campo «${label}»`);
  await act(async () => {
    f.props.onChangeText(value);
  });
};
const valueOf = (tree: ReactTestRenderer, label: string) =>
  byLabel(tree, label, 'onChangeText').at(0)?.props.value;
/** Escribe el correo o el DNI y pulsa «Recibir código». */
const send = async (tree: ReactTestRenderer, label: string, value: string) => {
  await type(tree, label, value);
  await press(tree, 'Recibir código');
  await act(async () => {
    await new Promise((r) => setTimeout(r, 10));
  });
};

let tree: ReactTestRenderer;
let fake: FakeServer;

beforeEach(async () => {
  jest.clearAllMocks();
  __resetSessionForTests();
  __resetComunicaApiForTests();
  setStorageBackend(memoryBackend());
  getComunicaApi();
  fake = getFakeServer() as FakeServer;
  fake.setControls({ latencyMs: 0 });
  await act(async () => {
    tree = create(
      <SafeAreaProvider initialMetrics={METRICS}>
        <HeroUINativeProvider>
          <AccessScreen />
        </HeroUINativeProvider>
      </SafeAreaProvider>,
    );
  });
});
afterEach(async () => {
  await act(async () => {
    tree.unmount();
  });
  __resetComunicaApiForTests();
  __resetSessionForTests();
});

describe('«Entra en tu área»', () => {
  it('un correo que existe pasa a escribir el código, sin avisos', async () => {
    await send(tree, 'Tu correo', 'monitor@ejemplo.org');
    expect(mockRouter.push).toHaveBeenCalledTimes(1);
    const { params } = mockRouter.push.mock.calls[0][0];
    expect(getCodeHandoff(params.k)).toEqual({
      via: 'email',
      value: 'monitor@ejemplo.org',
      sentTo: 'm•••@ejemplo.org',
    });
    expect(texts(tree)).not.toContain('no está en Comunica');
  });

  it('un correo que no existe: aviso con el correo, el campo relleno y la tarjeta del DNI abierta debajo', async () => {
    await send(tree, 'Tu correo', 'ana@noexiste.test');
    expect(mockRouter.push).not.toHaveBeenCalled();
    const t = texts(tree);
    expect(t).toContain('Ese correo no está en Comunica.');
    expect(t).toContain('ana@noexiste.test');
    expect(t).toContain('Revisa que esté bien escrito.');
    expect(t).toContain('¿Te diste de alta con otro correo?');
    expect(has(tree, 'Buscarme por mi DNI')).toBe(true);
    // El campo sigue relleno para corregir la errata.
    expect(valueOf(tree, 'Tu correo')).toBe('ana@noexiste.test');
    // El aviso es un aviso (lo lee el lector de pantalla) y la acción principal sigue siendo una.
    expect(
      tree.root.findAll((n) => n.props.accessibilityRole === 'alert').length,
    ).toBeGreaterThan(0);
    expect(has(tree, 'Recibir código')).toBe(true);
  });

  it('corregir la errata y volver a mandar entra por el camino normal y limpia el aviso', async () => {
    await send(tree, 'Tu correo', 'monitor@ejemplo.og');
    expect(texts(tree)).toContain('Ese correo no está en Comunica.');
    await send(tree, 'Tu correo', 'monitor@ejemplo.org');
    expect(mockRouter.push).toHaveBeenCalledTimes(1);
    expect(texts(tree)).not.toContain('Ese correo no está en Comunica.');
  });

  it('«Buscarme por mi DNI» abre el DNI, quita el aviso y, al volver al correo, sigue puesto', async () => {
    await send(tree, 'Tu correo', 'ana@noexiste.test');
    await press(tree, 'Buscarme por mi DNI');
    expect(has(tree, 'Tu DNI o NIE', 'onChangeText')).toBe(true);
    expect(texts(tree)).not.toContain('Ese correo no está en Comunica.');
    expect(texts(tree)).not.toContain('¿Te diste de alta con otro correo?');
    await press(tree, 'Entrar con el correo');
    expect(valueOf(tree, 'Tu correo')).toBe('ana@noexiste.test');
  });

  it('por DNI sin ficha: «No encontramos a nadie con ese documento.», sin tarjeta del DNI', async () => {
    await press(tree, 'Entrar con el DNI');
    await send(tree, 'Tu DNI o NIE', '99999999R');
    expect(texts(tree)).toContain('No encontramos a nadie con ese documento.');
    expect(texts(tree)).not.toContain('¿Te diste de alta con otro correo?');
    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  it('por DNI sin correo en la ficha: su mensaje y el enlace a la oficina técnica', async () => {
    const open = jest
      .spyOn(Linking, 'openURL')
      .mockImplementation(async () => undefined);
    await press(tree, 'Entrar con el DNI');
    await send(tree, 'Tu DNI o NIE', FAKE_NO_EMAIL_DNI);
    expect(texts(tree)).toContain(ACCESS_TEXT.noEmailOnFile);
    const link = byLabel(
      tree,
      `${ACCESS_TEXT.writeUs}: ${OFFICE_EMAIL}`,
      'onPress',
    ).at(0);
    expect(link).toBeDefined();
    await act(async () => {
      link!.props.onPress();
    });
    expect(open).toHaveBeenCalledWith(`mailto:${OFFICE_EMAIL}`);
  });

  it('por DNI con ficha: manda el código y enseña el correo tapado', async () => {
    await press(tree, 'Entrar con el DNI');
    await send(tree, 'Tu DNI o NIE', '12345678z');
    const { params } = mockRouter.push.mock.calls[0][0];
    expect(getCodeHandoff(params.k)).toMatchObject({
      via: 'dni',
      value: '12345678Z',
      sentTo: 'm•••@ejemplo.org',
    });
  });

  it('a los 8 fallos, el aviso de esperar con enlace; ni se ofrece el DNI', async () => {
    for (let i = 0; i < FAKE_MISS_LIMIT; i++)
      await send(tree, 'Tu correo', `quien${i}@noexiste.test`);
    expect(texts(tree)).toContain('Ese correo no está en Comunica.');
    await send(tree, 'Tu correo', 'monitor@ejemplo.org');
    expect(texts(tree)).toContain(ACCESS_TEXT.tooManyMisses);
    expect(texts(tree)).not.toContain('¿Te diste de alta con otro correo?');
    expect(has(tree, `${ACCESS_TEXT.writeUs}: ${OFFICE_EMAIL}`)).toBe(true);
    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  it('con el CRM caído NO dice que no existe ni manda al DNI', async () => {
    fake.setControls({ failRoute: 'code' });
    await send(tree, 'Tu correo', 'monitor@ejemplo.org');
    expect(texts(tree)).toMatch(/no responde/);
    expect(texts(tree)).not.toContain('no está en Comunica');
    expect(texts(tree)).not.toContain('¿Te diste de alta con otro correo?');
    expect(has(tree, 'Buscarme por mi DNI')).toBe(false);
  });
});
