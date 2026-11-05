/**
 * «Forma de pago» con el CABLEADO REAL (05/11/2026): el proveedor del área, «a quién se ve», los hooks y el servidor falso.
 *
 *   · La pantalla: sin nada guardado y con IBAN guardado (se ve `ES93 •••• 8644` y NUNCA el entero); IBAN y titular solo con domiciliación; el IBAN llega vacío;
 *     un único botón principal; el contexto de un menor.
 *   · Validar en el cliente (módulo 97, SEPA, titular) sin escribir nada; guardar con los mensajes EXACTOS del plugin (guardado, parcial, error).
 *   · Si la ficha no se puede leer: ni formulario ni «todavía no has indicado»; sin red, «Necesitas conexión».
 *   · Las entradas: «Datos de Lucía», Pagos y «Tu perfil».
 *   · NADA de esto llega al disco.
 */
/* eslint-disable react/display-name, @typescript-eslint/no-require-imports, import/first */
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { HeroUINativeProvider } from 'heroui-native';
import { QueryClient } from '@tanstack/react-query';

const mockRouter = { push: jest.fn(), back: jest.fn(), replace: jest.fn() };
jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  useRouter: () => mockRouter,
  usePreventRemove: jest.fn(),
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
jest.mock('@/components/tabs/useTabScroll', () => ({
  useTabScroll: (_n: string, extra = 0) => ({
    scrollRef: { current: null },
    onScroll: undefined,
    contentPaddingBottom: 100 + extra,
  }),
}));
const mockScrollToTop = jest.fn();
jest.mock('@/components/tabs/tabBarController', () => ({
  scrollToTop: (...a: unknown[]) => mockScrollToTop(...a),
}));
jest.mock('@/components/BottomSheet', () => {
  const { Text: T, View: V } = require('react-native');
  return ({
    visible,
    title,
    children,
  }: {
    visible: boolean;
    title: string;
    children: React.ReactNode;
  }) =>
    visible ? (
      <V>
        <T>{title}</T>
        {children}
      </V>
    ) : null;
});
jest.mock('@/components/comunica/comun/DateTimeField', () => () => null);
const mockToast = jest.fn();
jest.mock('@/contexts/AppToastContext', () => ({
  useToast: () => ({ toast: { show: mockToast } }),
}));
jest.mock('expo-image', () => ({
  Image: {
    clearDiskCache: jest.fn().mockResolvedValue(true),
    clearMemoryCache: jest.fn().mockResolvedValue(true),
  },
}));
const mockConfirm = jest.fn();
jest.mock('@/components/comunica/comun/confirm', () => ({
  confirmAction: (...a: unknown[]) => mockConfirm(...a),
}));

import ComunicaAreaProvider from '@/components/comunica/comun/ComunicaAreaProvider';
import AreaPrimaryButton from '@/components/comunica/comun/AreaPrimaryButton';
import ProfileDataScreen from '@/components/comunica/datos/ProfileDataScreen';
import MemberHome from '@/components/comunica/inicio/MemberHome';
import PaymentMethodScreen from '@/components/comunica/pagos/PaymentMethodScreen';
import PaymentsScreen from '@/components/comunica/pagos/PaymentsScreen';
import { ActiveProfileProvider } from '@/hooks/comunica/useActiveProfile';
import {
  __resetComunicaApiForTests,
  getComunicaApi,
  getFakeServer,
} from '@/services/comunica';
import type { FakeServer } from '@/services/comunica/fake';
import type { PersonaId } from '@/services/comunica/fake/fixtures';
import {
  FAKE_IBAN_A,
  FAKE_IBAN_B,
} from '@/services/comunica/fake/profilePaymentMethod';
import { dehydrateArea } from '@/services/comunica/persist';
import { __resetSessionForTests, signIn } from '@/services/comunica/session';
import { memoryBackend, setStorageBackend } from '@/services/comunica/storage';

const METRICS = {
  frame: { x: 0, y: 0, width: 375, height: 812 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};
const LUCIA = 'f-hijo-lucia';
const NICO = 'f-hijo-nico';
const MARTA = 'f-per-familia';

const wait = (ms: number) =>
  act(async () => {
    await new Promise((r) => setTimeout(r, ms));
  });
const plain = (n: unknown): string => {
  if (typeof n === 'string') return n;
  if (n && typeof n === 'object' && 'children' in n)
    return (n as { children: unknown[] }).children.map(plain).join('');
  return '';
};
/** Cada `Text` pintado, con lo anidado dentro ya unido («Es **tu** forma…» sale en uno). */
const lines = (tree: ReactTestRenderer) =>
  tree.root.findAllByType(Text).map((t) => plain(t));
const texts = (tree: ReactTestRenderer) => lines(tree).join(' | ');
const labelled = (tree: ReactTestRenderer, label: string, prop: string) =>
  tree.root.findAll(
    (n) =>
      typeof n.props[prop] === 'function' &&
      n.props.accessibilityLabel === label,
    { deep: false },
  );
const has = (tree: ReactTestRenderer, label: string, prop = 'onPress') =>
  labelled(tree, label, prop).length > 0;
const press = async (tree: ReactTestRenderer, label: string) => {
  const b = labelled(tree, label, 'onPress').at(0);
  if (!b) throw new Error(`No hay nada que tocar con «${label}»`);
  await act(async () => {
    b.props.onPress();
  });
};
const field = (tree: ReactTestRenderer, label: string) => {
  const f = labelled(tree, label, 'onChangeText').at(0);
  if (!f) throw new Error(`No hay campo «${label}»`);
  return f;
};
const type = async (tree: ReactTestRenderer, label: string, value: string) => {
  const f = field(tree, label);
  await act(async () => {
    f.props.onChangeText(value);
  });
};
const until = async (fn: () => boolean, ms = 3000) => {
  for (let i = 0; i < ms / 25; i++) {
    if (fn()) return;
    await wait(25);
  }
  throw new Error('No ha pasado a tiempo');
};
const ready = (tree: ReactTestRenderer) =>
  until(() => texts(tree).includes('¿Cómo quieres pagar?'));
/** Todo lo que se ha pintado, con sus props de texto (placeholder, value, etiquetas…): aquí no puede aparecer un IBAN entero. */
const everything = (tree: ReactTestRenderer) => {
  const out: string[] = [];
  const walk = (n: unknown) => {
    if (n == null) return;
    if (typeof n === 'string') return void out.push(n);
    if (Array.isArray(n)) return n.forEach(walk);
    const node = n as { props?: Record<string, unknown>; children?: unknown[] };
    for (const v of Object.values(node.props ?? {}))
      if (typeof v === 'string') out.push(v);
    node.children?.forEach(walk);
  };
  walk(tree.toJSON());
  return out.join('\n');
};

const trees: ReactTestRenderer[] = [];
const clients: QueryClient[] = [];

async function setup(
  persona: PersonaId,
  screen: React.ReactElement = <PaymentMethodScreen />,
  opts: {
    activeId?: string;
    controls?: Partial<FakeServer['controls']>;
    before?: (c: { fake: FakeServer }) => void;
  } = {},
) {
  __resetSessionForTests();
  __resetComunicaApiForTests();
  const be = memoryBackend();
  setStorageBackend(be);
  getComunicaApi();
  const fake = getFakeServer() as FakeServer;
  fake.setControls({ latencyMs: 0, ...opts.controls });
  const s = fake.issueSession(persona);
  await signIn(s, s.me);
  // A quién se ve: lo recordado por la persona (el hijo elegido).
  if (opts.activeId)
    await be.setItem(
      `@comunica/${s.me.personId}/profile`,
      JSON.stringify({ activeId: opts.activeId, chosen: true }),
    );
  opts.before?.({ fake });
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(
      <SafeAreaProvider initialMetrics={METRICS}>
        <HeroUINativeProvider>
          <ComunicaAreaProvider client={qc}>
            <ActiveProfileProvider>{screen}</ActiveProfileProvider>
          </ComunicaAreaProvider>
        </HeroUINativeProvider>
      </SafeAreaProvider>,
    );
  });
  trees.push(tree);
  clients.push(qc);
  return { fake, be, qc, tree, me: s.me };
}

afterEach(async () => {
  await act(async () => {
    for (const tree of trees.splice(0)) {
      try {
        tree.unmount();
      } catch {
        /* ya desmontado */
      }
    }
  });
  for (const qc of clients.splice(0)) qc.clear();
  __resetComunicaApiForTests();
  __resetSessionForTests();
  jest.clearAllMocks();
});

const SAVED_LISTO = 'Listo: tu forma de pago está guardada.';
const WORKS_IN_COURSE =
  'Hay un recibo que ya está en curso (en remesa o devuelto): ese no se cambia, y tesorería lo revisará con vosotros.';
const PARTIAL =
  'Tu forma de pago está guardada, pero no hemos podido cambiar la cuenta en algún pago pendiente. Avisa a tesorería de tu delegación para que lo revise.';
const GENERIC = 'No hemos podido guardarlo. Inténtalo de nuevo en un momento.';
const BAD_IBAN =
  'Ese IBAN no parece válido. Revisa que lo hayas copiado entero.';
const UNREADABLE =
  'No hemos podido leer tu forma de pago ahora mismo. Vuelve a intentarlo en un momento.';

describe('la pantalla', () => {
  it('sin nada guardado: lo dice, ofrece las tres formas y NO enseña IBAN ni titular hasta elegir domiciliación', async () => {
    const { tree, me } = await setup('familyNone');
    await ready(tree);
    const t = texts(tree);
    expect(t).toContain(
      'Con ella se cobran tus cuotas y las actividades a las que te apuntes.',
    );
    expect(t).toContain('Todavía no has indicado cómo pagas.');
    expect(t).toContain(
      'Si tienes recibos domiciliados que todavía no han pasado al banco, se cambiarán a la cuenta nueva. Lo que ya se ha cobrado, o está en una remesa, no se toca.',
    );
    for (const o of ['Domiciliación bancaria', 'Transferencia', 'Bizum'])
      expect(has(tree, o)).toBe(true);
    expect(has(tree, 'Efectivo')).toBe(false);
    expect(has(tree, 'IBAN', 'onChangeText')).toBe(false);
    expect(has(tree, 'Titular de la cuenta', 'onChangeText')).toBe(false);

    await press(tree, 'Domiciliación bancaria');
    expect(field(tree, 'IBAN').props.value).toBe('');
    expect(field(tree, 'IBAN').props.placeholder).toBe(
      'ES00 0000 0000 0000 0000 0000',
    );
    expect(texts(tree)).toContain(
      'La cuenta en la que se cargarán los recibos.',
    );
    // El titular, por defecto, el nombre de quien paga.
    expect(field(tree, 'Titular de la cuenta').props.value).toBe(me.name);
  });

  it('con IBAN guardado: se ve `ES93 •••• 8644` y NUNCA el entero; el campo llega vacío', async () => {
    const { tree } = await setup('family');
    await ready(tree);
    expect(texts(tree)).toContain(
      'Ahora mismo: Domiciliación bancaria · ES93 •••• 8644 · titular: Marta Villarroya Pons.',
    );
    expect(field(tree, 'IBAN').props.value).toBe('');
    expect(field(tree, 'IBAN').props.placeholder).toBe('ES93 •••• 8644');
    expect(texts(tree)).toContain(
      'Déjalo vacío si no quieres cambiar la cuenta.',
    );
    expect(field(tree, 'Titular de la cuenta').props.value).toBe(
      'Marta Villarroya Pons',
    );
    const all = everything(tree);
    expect(all).not.toContain(FAKE_IBAN_A);
    expect(all).not.toContain('2516218644');
    expect(all).not.toContain('0049 4898');
  });

  it('IBAN y titular solo con domiciliación: al elegir otra forma se van, y vuelven', async () => {
    const { tree } = await setup('family');
    await ready(tree);
    expect(has(tree, 'IBAN', 'onChangeText')).toBe(true);
    await press(tree, 'Transferencia');
    expect(has(tree, 'IBAN', 'onChangeText')).toBe(false);
    expect(has(tree, 'Titular de la cuenta', 'onChangeText')).toBe(false);
    await press(tree, 'Bizum');
    expect(has(tree, 'IBAN', 'onChangeText')).toBe(false);
    await press(tree, 'Domiciliación bancaria');
    expect(has(tree, 'IBAN', 'onChangeText')).toBe(true);
  });

  it('una sola acción principal, «Guardar»', async () => {
    const { tree } = await setup('family');
    await ready(tree);
    expect(tree.root.findAllByType(AreaPrimaryButton)).toHaveLength(1);
    expect(has(tree, 'Guardar')).toBe(true);
  });

  it('viendo a un menor: es la de quien ha entrado, no la del menor, y lo dice con su nombre', async () => {
    const { tree } = await setup('family', <PaymentMethodScreen />, {
      activeId: LUCIA,
    });
    await ready(tree);
    expect(lines(tree)).toContain(
      'Es tu forma de pago, no la de Lucía: con ella se cobran las actividades de Lucía.',
    );
    // La cuenta que se ve es la de Marta, no una de la hija.
    expect(texts(tree)).toContain('ES93 •••• 8644');
    expect(texts(tree)).not.toContain('Con ella se cobran tus cuotas');
  });

  it('cargando no pinta el formulario; sin conexión y sin datos, «Necesitas conexión»', async () => {
    const off = await setup('family', <PaymentMethodScreen />, {
      controls: { offline: true },
    });
    await until(() =>
      texts(off.tree).includes('Necesitas conexión para ver tu forma de pago'),
    );
    expect(texts(off.tree)).toContain(
      'Por seguridad, no se guarda en el móvil.',
    );
    expect(has(off.tree, 'Guardar')).toBe(false);
    expect(has(off.tree, 'IBAN', 'onChangeText')).toBe(false);
  });

  it('si la ficha no se puede leer: ni formulario ni «todavía no has indicado»; se puede reintentar', async () => {
    const { tree, fake } = await setup('familyNone', <PaymentMethodScreen />, {
      controls: { failRoute: 'paymentMethod' },
    });
    await until(() => lines(tree).includes(UNREADABLE));
    const t = texts(tree);
    expect(t).not.toContain('Todavía no has indicado');
    expect(t).not.toContain('¿Cómo quieres pagar?');
    expect(has(tree, 'Guardar')).toBe(false);
    expect(has(tree, 'Domiciliación bancaria')).toBe(false);
    expect(tree.root.findAllByType(AreaPrimaryButton)).toHaveLength(0);

    fake.setControls({ failRoute: null });
    await press(tree, 'Reintentar');
    await ready(tree);
    expect(has(tree, 'Guardar')).toBe(true);
  });
});

describe('validar antes de enviar', () => {
  it('sin elegir forma: «Elige cómo quieres pagar.» y no se escribe nada', async () => {
    const { tree, fake } = await setup('familyNone');
    await ready(tree);
    await press(tree, 'Guardar');
    expect(texts(tree)).toContain('Elige cómo quieres pagar.');
    expect(fake.writeCount).toBe(0);
  });

  it.each([
    ['dígitos de control malos', 'ES0000000000000000000000'],
    ['de un país que no es SEPA (Brasil)', 'BR1800360305000010009795493C1'],
    ['demasiado corto', 'ES1234'],
    ['vacío y sin ninguno guardado', ''],
  ])(
    'IBAN %s: el error sale en su campo y no se escribe nada',
    async (_n, iban) => {
      const { tree, fake } = await setup('familyNone');
      await ready(tree);
      await press(tree, 'Domiciliación bancaria');
      await type(tree, 'IBAN', iban);
      await press(tree, 'Guardar');
      expect(texts(tree)).toContain(BAD_IBAN);
      expect(fake.writeCount).toBe(0);
      // Al volver a escribir, el error se va.
      await type(tree, 'IBAN', FAKE_IBAN_A);
      expect(texts(tree)).not.toContain(BAD_IBAN);
    },
  );

  it('con un IBAN bueno y sin titular (ni guardado): «Escribe el nombre del titular de la cuenta.»', async () => {
    const { tree, fake } = await setup('familyNone');
    await ready(tree);
    await press(tree, 'Domiciliación bancaria');
    await type(tree, 'IBAN', FAKE_IBAN_A);
    await type(tree, 'Titular de la cuenta', '   ');
    await press(tree, 'Guardar');
    expect(texts(tree)).toContain(
      'Escribe el nombre del titular de la cuenta.',
    );
    expect(fake.writeCount).toBe(0);
  });

  it('con otra forma, lo que haya escrito en el IBAN no estorba', async () => {
    const { tree, fake } = await setup('familyNone');
    await ready(tree);
    await press(tree, 'Domiciliación bancaria');
    await type(tree, 'IBAN', 'basura');
    await press(tree, 'Bizum');
    await press(tree, 'Guardar');
    await until(() => texts(tree).includes(SAVED_LISTO));
    expect(fake.writeCount).toBeGreaterThan(0);
  });
});

describe('guardar', () => {
  it('un IBAN nuevo: se dice qué ha pasado con lo pendiente de cobro, el campo vuelve a quedar vacío y se sube arriba', async () => {
    const { tree, fake } = await setup('family');
    await ready(tree);
    await type(tree, 'IBAN', 'es91 2100 0418 4502 0005 1332');
    // Lo que se escribe se ve agrupado de cuatro en cuatro.
    expect(field(tree, 'IBAN').props.value).toBe(
      'ES91 2100 0418 4502 0005 1332',
    );
    await press(tree, 'Guardar');
    await until(() => texts(tree).includes(SAVED_LISTO));
    expect(lines(tree)).toContain(
      `${SAVED_LISTO} Hemos puesto la cuenta nueva en 3 pagos pendientes de cobro. ${WORKS_IN_COURSE}`,
    );
    expect(texts(tree)).toContain(
      'Ahora mismo: Domiciliación bancaria · ES91 •••• 1332 · titular: Marta Villarroya Pons.',
    );
    expect(field(tree, 'IBAN').props.value).toBe('');
    expect(field(tree, 'IBAN').props.placeholder).toBe('ES91 •••• 1332');
    expect(fake.paymentMethodState(MARTA).stored.iban).toBe(FAKE_IBAN_B);
    expect(everything(tree)).not.toContain(FAKE_IBAN_B);
    expect(mockScrollToTop).toHaveBeenCalledWith('comunica');
  });

  it('solo el titular, con el IBAN vacío: se queda la cuenta que había y no se toca lo pendiente', async () => {
    const { tree, fake } = await setup('family');
    await ready(tree);
    await type(tree, 'Titular de la cuenta', 'Marta Pérez');
    await press(tree, 'Guardar');
    await until(() => lines(tree).includes(SAVED_LISTO));
    expect(texts(tree)).toContain('titular: Marta Pérez.');
    expect(fake.paymentMethodState(MARTA).stored.iban).toBe(FAKE_IBAN_A);
    expect(
      fake
        .paymentMethodState(MARTA)
        .commitments.every((c) => c.bankAccount !== FAKE_IBAN_B),
    ).toBe(true);
  });

  it('dejar la domiciliación: se avisa a tesorería y la cuenta de antes no se pierde', async () => {
    const { tree, fake } = await setup('family');
    await ready(tree);
    await press(tree, 'Transferencia');
    await press(tree, 'Guardar');
    await until(() => texts(tree).includes(SAVED_LISTO));
    expect(lines(tree)).toContain(
      `${SAVED_LISTO} Hemos avisado a tesorería de que ya no quieres domiciliar.`,
    );
    expect(texts(tree)).toContain('Ahora mismo: Transferencia.');
    expect(fake.paymentMethodState(MARTA).stored.iban).toBe(FAKE_IBAN_A);
    // Al volver a domiciliar, el IBAN guardado sigue ahí: se puede dejar vacío.
    await press(tree, 'Domiciliación bancaria');
    expect(field(tree, 'IBAN').props.placeholder).toBe('ES93 •••• 8644');
  });

  it('guardada la ficha pero no un pago: «guardado, pero…» y NO «Listo»', async () => {
    const { tree } = await setup('family', <PaymentMethodScreen />, {
      before: ({ fake }) => {
        fake.breakPaymentMethod({ failCommitments: ['com-mensual'] });
      },
    });
    await ready(tree);
    await type(tree, 'IBAN', FAKE_IBAN_B);
    await press(tree, 'Guardar');
    await until(() => lines(tree).includes(PARTIAL));
    expect(texts(tree)).not.toContain('Listo:');
    // La ficha sí se guardó.
    expect(texts(tree)).toContain('ES91 •••• 1332');
  });

  it('con el CRM caído: «No hemos podido guardarlo…», y lo escrito sigue ahí para reintentar', async () => {
    const { tree, fake } = await setup('family', <PaymentMethodScreen />, {
      controls: { crmDown: true },
    });
    await ready(tree);
    await type(tree, 'IBAN', FAKE_IBAN_B);
    await press(tree, 'Guardar');
    await until(() => lines(tree).includes(GENERIC));
    expect(field(tree, 'IBAN').props.value).toBe(
      'ES91 2100 0418 4502 0005 1332',
    );
    expect(texts(tree)).not.toContain('Listo:');
    expect(fake.paymentMethodState(MARTA).stored.iban).toBe(FAKE_IBAN_A);
    // Vuelve el CRM: el mismo «Guardar» funciona.
    fake.setControls({ crmDown: false });
    await press(tree, 'Guardar');
    await until(() => texts(tree).includes(SAVED_LISTO));
  });

  it('el reintento por un fallo del CRM lleva el MISMO `clientId`; si se cambia lo escrito, uno nuevo', async () => {
    const { tree, fake } = await setup('family', <PaymentMethodScreen />, {
      controls: { crmDown: true },
    });
    const spy = jest.spyOn(fake, 'savePaymentMethod');
    await ready(tree);
    await type(tree, 'IBAN', FAKE_IBAN_B);
    await press(tree, 'Guardar');
    await until(() => lines(tree).includes(GENERIC));
    await press(tree, 'Guardar');
    await until(() => spy.mock.calls.length === 2);
    await wait(50);
    const [a, b] = spy.mock.calls.map((c) => c[1].clientId);
    expect(a).toBe(b);
    // Otra cosa escrita: es otra petición.
    await type(tree, 'IBAN', 'DE89370400440532013000');
    await press(tree, 'Guardar');
    await until(() => spy.mock.calls.length === 3);
    expect(spy.mock.calls[2][1].clientId).not.toBe(a);
  });
});

describe('nada al disco', () => {
  it('ni la forma de pago ni el IBAN entran en lo que se guarda', async () => {
    const { tree, qc, be } = await setup('family');
    await ready(tree);
    await type(tree, 'IBAN', FAKE_IBAN_B);
    await type(tree, 'Titular de la cuenta', 'Titular Secreto');
    await press(tree, 'Guardar');
    await until(() => texts(tree).includes(SAVED_LISTO));
    const keys = qc
      .getQueryCache()
      .getAll()
      .map((q) => q.queryKey.join('/'));
    expect(keys.some((k) => k.includes('forma-pago'))).toBe(true);
    const saved = dehydrateArea(qc);
    expect(
      saved.queries.some((q) => q.queryKey.join('/').includes('forma-pago')),
    ).toBe(false);
    const dump = JSON.stringify(saved) + JSON.stringify(be.dump());
    for (const secret of [FAKE_IBAN_A, FAKE_IBAN_B, '8644', '1332'])
      expect(dump).not.toContain(secret);
  });
});

describe('las entradas', () => {
  const rowLabel =
    'Forma de pago, La tuya, Domiciliación bancaria · ES93 •••• 8644 · titular: Marta Villarroya Pons., Cambiar';

  it('«Datos de Lucía»: dice cuál es la forma de pago (la tuya, tapada) y lleva a cambiarla', async () => {
    const { tree } = await setup('family', <ProfileDataScreen pid={LUCIA} />);
    await until(() => has(tree, rowLabel));
    expect(everything(tree)).not.toContain(FAKE_IBAN_A);
    await press(tree, rowLabel);
    expect(mockRouter.push).toHaveBeenCalledWith('/comunica/forma-pago');
  });

  it('«Datos de Nicolás» de quien no ha indicado nada: «todavía no has indicado la tuya» con «Indicarla»', async () => {
    const { tree } = await setup('familyOne', <ProfileDataScreen pid={NICO} />);
    await until(() =>
      has(tree, 'Forma de pago, Todavía no has indicado la tuya., Indicarla'),
    );
  });

  it('«Mis datos» de uno mismo no lleva la fila (la forma de pago tiene su entrada en «Tu perfil»)', async () => {
    const { tree } = await setup('family', <ProfileDataScreen pid={MARTA} />);
    await until(() => texts(tree).includes('Autorizaciones legales'));
    await wait(100);
    expect(texts(tree)).not.toContain('La tuya,');
    expect(has(tree, rowLabel)).toBe(false);
  });

  it('si la ficha de pago no se puede leer, la fila no sale (no se inventa «todavía no has indicado la tuya»)', async () => {
    const { tree } = await setup(
      'familyOne',
      <ProfileDataScreen pid={NICO} />,
      {
        controls: { failRoute: 'paymentMethod' },
      },
    );
    await until(() => texts(tree).includes('Autorizaciones legales'));
    await wait(150);
    expect(texts(tree)).not.toContain('Forma de pago');
    expect(texts(tree)).not.toContain('Todavía no has indicado la tuya');
  });

  it('Pagos: un botón secundario «Cambiar forma de pago»', async () => {
    const { tree } = await setup('family', <PaymentsScreen />);
    await until(() => has(tree, 'Cambiar forma de pago'));
    // La principal de aquí no es esta: no hay ningún botón principal en Pagos.
    expect(tree.root.findAllByType(AreaPrimaryButton)).toHaveLength(0);
    await press(tree, 'Cambiar forma de pago');
    expect(mockRouter.push).toHaveBeenCalledWith('/comunica/forma-pago');
  });

  it('Pagos viendo a un hijo: también', async () => {
    const { tree } = await setup('family', <PaymentsScreen />, {
      activeId: LUCIA,
    });
    await until(() => has(tree, 'Cambiar forma de pago'));
  });

  it.each([
    ['family', 'el familiar a secas'],
    ['memberNoKids', 'un miembro sin hijos'],
    ['monitorMom', 'una monitora'],
    ['familyOne', 'un familiar con un hijo'],
  ] as [PersonaId, string][])(
    '«Tu perfil» de %s (%s): «Forma de pago» lleva a su pantalla',
    async (persona) => {
      const { tree } = await setup(persona, <MemberHome />);
      const label =
        'Forma de pago, Cómo pagas: domiciliación, transferencia o Bizum, y tu IBAN.';
      await until(() => has(tree, label));
      await press(tree, label);
      expect(mockRouter.push).toHaveBeenCalledWith('/comunica/forma-pago');
    },
  );
});
