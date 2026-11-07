/**
 * Pagos con el CABLEADO REAL (plan 15): el proveedor del área, «a quién se ve», los hooks y el servidor falso (con su pasarela simulada).
 *
 *   · «Pagos»: los bloques, el chip solo cuando dice algo, «Para Lucía» solo viéndose a sí mismo, vacío, sin conexión; nada al disco.
 *   · La ficha: un devuelto con su motivo, la tarjeta con su nº de operación, la cuenta enmascarada, «¿Ya lo has pagado?», «Comprobando el pago».
 *   · «Pagar»: los rebotes, el resumen, «otra cantidad» (coma o punto, sin tope, más del doble pide confirmar), doble toque, el resultado y el intento en curso.
 *   · La hoja de la pasarela: lo que corta, lo que abre fuera, lo que deja pasar, y que no inyecta nada.
 */
/* eslint-disable react/display-name, @typescript-eslint/no-require-imports, import/first */
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { HeroUINativeProvider } from 'heroui-native';
import { QueryClient } from '@tanstack/react-query';

const mockRouter = { push: jest.fn(), back: jest.fn(), replace: jest.fn() };
let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  useRouter: () => mockRouter,
  usePreventRemove: jest.fn(),
  useLocalSearchParams: () => mockParams,
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
const mockToast = jest.fn();
jest.mock('@/contexts/AppToastContext', () => ({
  useToast: () => ({ toast: { show: mockToast } }),
}));
jest.mock('expo-image', () => {
  const Image = () => null;
  Image.clearDiskCache = jest.fn().mockResolvedValue(true);
  Image.clearMemoryCache = jest.fn().mockResolvedValue(true);
  return { Image };
});
const mockOpenAuth = jest.fn();
jest.mock('expo-web-browser', () => ({
  openBrowserAsync: jest.fn(),
  openAuthSessionAsync: (...a: unknown[]) => mockOpenAuth(...a),
}));
// La WebView del banco: se guardan sus propiedades para «navegar» desde el test.
let mockWebView: Record<string, unknown> | null = null;
jest.mock('react-native-webview', () => ({
  WebView: (props: Record<string, unknown>) => {
    mockWebView = props;
    return null;
  },
}));
// Esperas del sondeo y de «cerrar a medias» cortas, para no tardar segundos de verdad.
jest.mock('@/utils/comunica/cardAttempt', () => {
  const actual = jest.requireActual('@/utils/comunica/cardAttempt');
  return {
    ...actual,
    CANCELLED_CHECKS_MS: [0, 15, 15],
    confirmDelay: (n: number, elapsed: number) =>
      elapsed >= 180000 ? null : 20,
  };
});
jest.mock('expo-linking', () => ({ openURL: jest.fn() }));
jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn() }));
const mockConfirm = jest.fn();
jest.mock('@/components/comunica/comun/confirm', () => ({
  confirmAction: (...a: unknown[]) => mockConfirm(...a),
}));
const mockOpenLegacy = jest.fn();
jest.mock('@/hooks/comunica/useOpenLegacy', () => ({
  useOpenLegacy: () => mockOpenLegacy,
}));
const mockOpenFile = jest.fn();
jest.mock('@/services/comunica/eventFiles', () => ({
  openEventFile: (...a: unknown[]) => mockOpenFile(...a),
}));

import ComunicaAreaProvider from '@/components/comunica/comun/ComunicaAreaProvider';
import CardGatewaySheet from '@/components/comunica/pagos/CardGatewaySheet';
import PaymentDetailScreen from '@/components/comunica/pagos/PaymentDetailScreen';
import PayScreen from '@/components/comunica/pagos/PayScreen';
import PaymentsScreen from '@/components/comunica/pagos/PaymentsScreen';
import { dehydrateArea } from '@/services/comunica/persist';
import { ActiveProfileProvider } from '@/hooks/comunica/useActiveProfile';
import {
  __resetComunicaApiForTests,
  getComunicaApi,
  getFakeServer,
} from '@/services/comunica';
import type { FakeServer } from '@/services/comunica/fake';
import type { PersonaId } from '@/services/comunica/fake/fixtures';
import { __resetSessionForTests, signIn } from '@/services/comunica/session';
import { memoryBackend, setStorageBackend } from '@/services/comunica/storage';

const METRICS = {
  frame: { x: 0, y: 0, width: 375, height: 812 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};
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
/** Todo el texto pintado (también el de componentes anidados dentro de un `Text`). */
const texts = (tree: ReactTestRenderer) => {
  const out: string[] = [];
  const walk = (n: unknown) => {
    if (!n) return;
    if (typeof n === 'string') return void out.push(n);
    if (Array.isArray(n)) return n.forEach(walk);
    const node = n as { children?: unknown[] };
    node.children?.forEach(walk);
  };
  walk(tree.toJSON());
  return out.join(' | ');
};
/** Pulsar lo que se lee como `text` (un botón sin etiqueta de accesibilidad propia). */
const pressText = async (tree: ReactTestRenderer, text: string) => {
  const b = tree.root.findAll(
    (n) => typeof n.props.onPress === 'function' && plain(n) === text,
  )[0];
  if (!b) throw new Error(`No hay nada que tocar con el texto «${text}»`);
  await act(async () => {
    b.props.onPress();
  });
};
const labelled = (tree: ReactTestRenderer, label: string) =>
  tree.root.findAll(
    (n) =>
      typeof n.props.onPress === 'function' &&
      n.props.accessibilityLabel === label,
  );
const press = async (tree: ReactTestRenderer, label: string) => {
  const b = labelled(tree, label).at(0);
  if (!b) throw new Error(`No hay nada que tocar con «${label}»`);
  await act(async () => {
    b.props.onPress();
  });
};
const until = async (fn: () => boolean, ms = 3000) => {
  for (let i = 0; i < ms / 25; i++) {
    if (fn()) return;
    await wait(25);
  }
  throw new Error('No ha pasado a tiempo');
};

const trees: ReactTestRenderer[] = [];
const clients: QueryClient[] = [];

async function setup(
  persona: PersonaId,
  screen: React.ReactElement,
  opts: {
    activeId?: string;
    controls?: Partial<FakeServer['controls']>;
    /** Antes de montar: preparar el falso o el almacén (p. ej. un intento que quedó a medias). */
    before?: (c: {
      fake: FakeServer;
      be: ReturnType<typeof memoryBackend>;
      personId: string;
    }) => Promise<void>;
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
  await opts.before?.({ fake, be, personId: s.me.personId });
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

const LUCIA = 'f-hijo-lucia';
const NICO = 'f-hijo-sin-nombre';
const MARTA = 'f-per-familia';
const payments = () => <PaymentsScreen />;
const detail = (id: string) => <PaymentDetailScreen id={id} />;
const pay = (p: { pago?: string; inscripcion?: string }) => (
  <PayScreen {...p} />
);
const pressLike = async (tree: ReactTestRenderer, re: RegExp) => {
  const b = tree.root.findAll(
    (n) =>
      typeof n.props.onPress === 'function' &&
      typeof n.props.accessibilityLabel === 'string' &&
      re.test(n.props.accessibilityLabel),
  )[0];
  if (!b) throw new Error(`No hay nada que tocar con ${re}`);
  await act(async () => {
    b.props.onPress();
  });
};
const hasLike = (tree: ReactTestRenderer, re: RegExp) =>
  tree.root.findAll(
    (n) =>
      typeof n.props.onPress === 'function' &&
      typeof n.props.accessibilityLabel === 'string' &&
      re.test(n.props.accessibilityLabel),
  ).length > 0;
const type = async (tree: ReactTestRenderer, label: string, value: string) => {
  const f = tree.root.findAll(
    (n) =>
      typeof n.props.onChangeText === 'function' &&
      n.props.accessibilityLabel === label,
  )[0];
  if (!f) throw new Error(`No hay campo «${label}»`);
  await act(async () => {
    f.props.onChangeText(value);
  });
};

beforeEach(() => {
  mockWebView = null;
  mockConfirm.mockReset();
});

describe('«Pagos»', () => {
  it('viendo a un hijo: sus bloques, el chip solo donde dice algo y «Pagar con tarjeta» solo donde se puede', async () => {
    const { tree } = await setup('family', payments(), { activeId: LUCIA });
    await until(() => texts(tree).includes('Campamento de verano'));
    const t = texts(tree);
    expect(t).toContain('Pendiente de pagar');
    expect(t).toContain('Pagado');
    expect(t).toContain('110,00 €');
    // Un devuelto: su etiqueta del CRM en rojo. Confirmando: «Comprobando el pago».
    expect(t).toContain('Rechazado');
    expect(t).toContain('Comprobando el pago');
    // Un hijo: sin «Para …».
    expect(t).not.toContain('Para Lucía');
    // Transferencia con su medio; tarjeta pendiente sin medio.
    expect(t).toContain('Transferencia');
    expect(hasLike(tree, /^Pagar con tarjeta: Campamento de verano$/)).toBe(
      true,
    );
    expect(hasLike(tree, /^Pagar con tarjeta: Comedor$/)).toBe(true);
    // Mientras el banco confirma, no se ofrece pagar otra vez.
    expect(hasLike(tree, /^Pagar con tarjeta: Salida a la montaña$/)).toBe(
      false,
    );
    // Lo pagado, sin botón.
    expect(
      hasLike(tree, /^Pagar con tarjeta: Campamento del año pasado$/),
    ).toBe(false);
    // Lo de su hermano no sale.
    expect(t).not.toContain('Pascua joven');
  });
  it('viéndose a sí mismo: todo lo que paga, con «Para Lucía»', async () => {
    const { tree } = await setup('family', payments(), { activeId: MARTA });
    await until(() => texts(tree).includes('Campamento de verano'));
    const t = texts(tree);
    expect(t).toContain('Para Lucía');
    expect(t).toContain('Cuota de actividades');
    expect(t).toContain('Pascua joven');
  });
  it('lo que se cobrará por domiciliación va a su bloque, sin botón', async () => {
    const { tree } = await setup('family', payments(), { activeId: NICO });
    await until(() => texts(tree).includes('Pascua joven'));
    expect(texts(tree)).toContain('Se cobrará por domiciliación');
    expect(hasLike(tree, /^Pagar con tarjeta: Pascua joven$/)).toBe(false);
  });
  it('las notas de la vuelta de la web: «Pago hecho…» y el KO', async () => {
    const a = await setup('family', <PaymentsScreen note="pagado" />, {
      activeId: LUCIA,
    });
    await until(() =>
      texts(a.tree).includes(
        'Pago hecho. Si aún lo ves pendiente, el banco está terminando de confirmarlo.',
      ),
    );
    const b = await setup('family', <PaymentsScreen note="error" />, {
      activeId: LUCIA,
    });
    await until(() =>
      texts(b.tree).includes(
        'No hemos podido completar el pago. No se ha realizado ningún cargo.',
      ),
    );
  });
  it('tocar una tarjeta abre su ficha; «Pagar con tarjeta» va a pagar ese pago', async () => {
    const { tree } = await setup('family', payments(), { activeId: LUCIA });
    await until(() => texts(tree).includes('Campamento de verano'));
    await pressLike(tree, /^Pagar con tarjeta: Campamento de verano$/);
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: '/comunica/pagos/pagar',
      params: { pago: 'pay-transfer-110' },
    });
    const card = tree.root.findAll(
      (n) =>
        n.props.accessibilityHint === 'Abre el pago' &&
        String(n.props.accessibilityLabel).includes('Campamento de verano'),
    )[0];
    await act(async () => {
      card.props.onPress();
    });
    expect(mockRouter.push).toHaveBeenLastCalledWith({
      pathname: '/comunica/pagos/[id]',
      params: { id: 'pay-transfer-110' },
    });
  });
  it('sin pagos: el texto con el nombre del hijo', async () => {
    const { tree, fake, qc } = await setup('family', payments(), {
      activeId: LUCIA,
    });
    await until(() => texts(tree).includes('Campamento de verano'));
    (fake as { getProfilePayments: unknown }).getProfilePayments =
      async () => ({ generatedAt: '2026-11-01T10:00:00Z', payments: [] });
    await act(async () => {
      await qc.refetchQueries({ queryKey: ['comunica', 'pagos'] });
    });
    await until(() => texts(tree).includes('Lucía no tiene ningún pago'));
    expect(texts(tree)).toContain('Cuando te apuntes a algo que cueste dinero');
  });
  it('sin conexión y sin lo de esta sesión: «Necesitas conexión para ver tus pagos»', async () => {
    const { tree } = await setup('family', payments(), {
      activeId: LUCIA,
      controls: { failRoute: 'profilePayments' },
    });
    await until(() =>
      texts(tree).includes('Necesitas conexión para ver tus pagos'),
    );
  });
  it('NADA de Pagos llega al disco (ni importes, ni conceptos, ni cuenta)', async () => {
    const { tree, qc, be } = await setup('family', payments(), {
      activeId: LUCIA,
    });
    await until(() => texts(tree).includes('Campamento de verano'));
    const keys = qc
      .getQueryCache()
      .getAll()
      .map((q) => q.queryKey.join('/'));
    expect(keys.some((k) => k.includes('pagos'))).toBe(true);
    const saved = JSON.stringify([dehydrateArea(qc), be.dump()]);
    for (const secret of [
      'Campamento',
      '11000',
      '110,00',
      'pay-transfer-110',
      'Fondos insuficientes',
    ])
      expect(saved).not.toContain(secret);
    expect(
      dehydrateArea(qc).queries.some((q) =>
        q.queryKey.join('/').includes('pagos'),
      ),
    ).toBe(false);
  });
  it('si la app se cerró a mitad de un pago: se comprueba, se dice UNA vez y se borra el registro local', async () => {
    const { tree, be, me } = await setup('family', payments(), {
      activeId: NICO,
      before: async ({ fake, be: store, personId }) => {
        const a = await fake.createCardAttempt(NICO, {
          clientId: '11111111-1111-4111-8111-111111111111',
          source: { payment: 'pay-pend-1' },
          amountCents: 2000,
          channel: 'sheet',
        });
        await fake.checkCardAttempt(NICO, a.attemptId, { returned: 'ok' });
        await store.setItem(
          `@comunica/${personId}/payattempt`,
          JSON.stringify({
            attemptId: a.attemptId,
            pid: NICO,
            source: { payment: 'pay-pend-1' },
            at: Date.now(),
          }),
        );
      },
    });
    await until(() => texts(tree).includes('Pago hecho.'));
    await until(
      () => be.dump()[`@comunica/${me.personId}/payattempt`] === 'null',
    );
  });
});

describe('la ficha de un pago', () => {
  it('un devuelto: el motivo, la cuenta enmascarada y «Pagar 15,00 € con tarjeta»', async () => {
    const { tree } = await setup('family', detail('pay-rejected'), {
      activeId: LUCIA,
    });
    await until(() => texts(tree).includes('Comedor'));
    const t = texts(tree);
    expect(t).toContain('Este recibo no se pudo cobrar: Fondos insuficientes.');
    expect(t).toContain('Ocurrió el');
    expect(t).toContain(
      'Puedes pagarlo con tarjeta o hablar con tu delegación.',
    );
    expect(t).toContain('Cuenta');
    expect(t).toContain('1332');
    expect(t).not.toMatch(/\d{4}\s*\d{4}\s*\d{4}\s*\d{4}/);
    expect(t).toContain('15,00 €');
    expect(texts(tree)).toContain('Rechazado · Domiciliación');
    expect(hasLike(tree, /^Pagar 15,00 € con tarjeta$/)).toBe(true);
  });
  it('tarjeta pagada: su nº de operación y sin botón de pagar', async () => {
    const { tree } = await setup('family', detail('pay-lucia-110'), {
      activeId: LUCIA,
    });
    await until(() => texts(tree).includes('Nº de operación'));
    expect(texts(tree)).toContain('260930123456');
    expect(texts(tree)).toContain('Pagado · Tarjeta');
    expect(hasLike(tree, /^Pagar /)).toBe(false);
  });
  it('transferencia pendiente: «¿Ya lo has pagado?» y se puede pagar con tarjeta', async () => {
    const { tree } = await setup('family', detail('pay-transfer-110'), {
      activeId: LUCIA,
    });
    await until(() => texts(tree).includes('Campamento de verano'));
    expect(texts(tree)).toContain(
      '¿Ya lo has pagado? Tu delegación lo marcará en cuanto lo vea.',
    );
    await pressLike(tree, /^Pagar 110,00 € con tarjeta$/);
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: '/comunica/pagos/pagar',
      params: { pago: 'pay-transfer-110' },
    });
  });
  it('«Especie»: su etiqueta y su descripción', async () => {
    const { tree } = await setup('family', detail('pay-especie'), {
      activeId: LUCIA,
    });
    await until(() => texts(tree).includes('Material del campamento'));
    expect(texts(tree)).toContain('Especie');
    expect(texts(tree)).toContain('Dos paquetes de folios y pegamento');
  });
  it('mientras el banco confirma: «Comprobando el pago» y no se ofrece pagar', async () => {
    const { tree } = await setup('family', detail('pay-confirming'), {
      activeId: LUCIA,
    });
    await until(() => texts(tree).includes('Salida a la montaña'));
    expect(texts(tree)).toContain('Comprobando el pago');
    expect(texts(tree)).toContain(
      'Estamos esperando la confirmación del banco.',
    );
    expect(hasLike(tree, /^Pagar /)).toBe(false);
  });
  it('de otra familia o de otro perfil: «Este pago ya no está disponible»', async () => {
    const { tree } = await setup('family', detail('pay-other-1'), {
      activeId: LUCIA,
    });
    await until(() => texts(tree).includes('Este pago ya no está disponible'));
    expect(texts(tree)).not.toContain('Cuota de otra familia');
    const b = await setup('family', detail('pay-pend-1'), { activeId: LUCIA });
    await until(() =>
      texts(b.tree).includes('Este pago ya no está disponible'),
    );
  });
  it('sin conexión y sin datos: «Necesitas conexión para ver tus pagos»', async () => {
    const { tree } = await setup('family', detail('pay-rejected'), {
      activeId: LUCIA,
      controls: { failRoute: 'profilePayment' },
    });
    await until(() =>
      texts(tree).includes('Necesitas conexión para ver tus pagos'),
    );
  });
});

describe('«Pagar»: los rebotes', () => {
  it('sin pago ni inscripción no hay pantalla de pago (nunca un donativo)', async () => {
    const { tree, fake } = await setup('family', pay({}), { activeId: LUCIA });
    await until(() => texts(tree).includes('No hay nada que pagar aquí'));
    expect(texts(tree)).toContain(
      'Lo que tengas pendiente de pagar está en Pagos.',
    );
    expect(fake.writeCount).toBe(0);
  });
  it('un pago que no está pendiente', async () => {
    const { tree } = await setup('family', pay({ pago: 'pay-lucia-110' }), {
      activeId: LUCIA,
    });
    await until(() => texts(tree).includes('Este pago no está pendiente'));
    expect(texts(tree)).toContain(
      'Puede que ya esté pagado o que se cobre por domiciliación. Míralo en Pagos.',
    );
  });
  it('una inscripción sin nada que pagar', async () => {
    const { tree } = await setup(
      'family',
      pay({ inscripcion: 'reg-lucia-sesiones' }),
      { activeId: LUCIA },
    );
    await until(() => texts(tree).includes('No hay nada que pagar aquí'));
  });
  it('al pagador sin documento: «Te faltan datos» y «Completar mis datos» (en SU perfil, para pagar)', async () => {
    const { tree, me } = await setup(
      'familyNone',
      pay({ pago: 'pay-carmen-1' }),
      { activeId: undefined },
    );
    await until(() => texts(tree).includes('Te faltan datos para poder pagar'));
    expect(texts(tree)).toContain(
      'Necesitamos tu nombre, apellidos, correo y documento de identidad.',
    );
    await pressText(tree, 'Completar mis datos');
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: '/comunica/datos',
      params: { yo: '1', completar: 'pago' },
    });
    void me;
  });
  it('sin conexión y sin datos: «Necesitas conexión para pagar»', async () => {
    const { tree } = await setup('family', pay({ pago: 'pay-transfer-110' }), {
      activeId: LUCIA,
      controls: { failRoute: 'cardCheckout' },
    });
    await until(() => texts(tree).includes('Necesitas conexión para pagar'));
  });
});

describe('«Pagar»: el resumen y «otra cantidad»', () => {
  it('el resumen: quién paga, para quién, el concepto y el importe; el botón repite el importe', async () => {
    const { tree } = await setup('family', pay({ pago: 'pay-transfer-110' }), {
      activeId: LUCIA,
    });
    await until(() => hasLike(tree, /^Pagar /));
    const t = texts(tree);
    expect(t).toContain('Marta Villarroya Pons');
    expect(t).toContain('Lucía');
    expect(t).toContain('Campamento de verano');
    expect(t).toContain('110,00 €');
    expect(t).toContain(
      'Pagarás en la página del banco: la app no guarda los datos de tu tarjeta.',
    );
    expect(hasLike(tree, /^Pagar 110 euros$/)).toBe(true);
    expect(texts(tree)).toContain('Pagar 110,00 €');
  });
  it('«Pagar otra cantidad»: «20,5» → «Pagar 20,50 €»; «abc» y «1.234» no valen y apagan el botón', async () => {
    const { tree } = await setup('family', pay({ pago: 'pay-transfer-110' }), {
      activeId: LUCIA,
    });
    await until(() => hasLike(tree, /^Pagar otra cantidad$/));
    await pressLike(tree, /^Pagar otra cantidad$/);
    expect(texts(tree)).toContain('¿Cuánto vas a pagar?');
    await type(tree, '¿Cuánto vas a pagar?', '20,5');
    expect(texts(tree)).toContain('Pagar 20,50 €');
    expect(texts(tree)).toContain('Indicado: 110,00 €. Pagarás: 20,50 €.');
    await type(tree, '¿Cuánto vas a pagar?', 'abc');
    expect(texts(tree)).toContain('Escribe solo el importe, como 35 o 35,50');
    await type(tree, '¿Cuánto vas a pagar?', '1.234');
    expect(texts(tree)).toContain(
      'Escribe el importe con coma para los céntimos: 1234 o 1234,00',
    );
    expect(hasLike(tree, /^Pagar 110 euros$/)).toBe(false);
  });
  it('más del doble de lo indicado pide confirmar; «Corregir» no abre nada', async () => {
    mockConfirm.mockResolvedValueOnce(false);
    const { tree, fake } = await setup(
      'family',
      pay({ pago: 'pay-transfer-110' }),
      { activeId: LUCIA },
    );
    await until(() => hasLike(tree, /^Pagar otra cantidad$/));
    await pressLike(tree, /^Pagar otra cantidad$/);
    await type(tree, '¿Cuánto vas a pagar?', '350');
    await pressLike(tree, /^Pagar 350 euros$/);
    expect(mockConfirm).toHaveBeenCalledWith(
      '¿Es correcto?',
      'Vas a pagar 350,00 €, más de lo indicado (110,00 €). ¿Es correcto?',
      'Pagar 350,00 €',
      false,
      'Corregir',
    );
    await wait(50);
    expect(fake.writeCount).toBe(0);
    expect(texts(tree)).not.toContain('Banco de prueba');
  });
});

describe('«Pagar»: la pasarela y el resultado', () => {
  const open = async (
    id = 'pay-transfer-110',
    activeId = LUCIA,
    controls = {},
  ) => {
    const s = await setup('family', pay({ pago: id }), { activeId, controls });
    await until(() => hasLike(s.tree, /^Pagar \d/));
    return s;
  };
  it('«Pagar» en la pasarela: se da por pagado SOLO porque el servidor lo dice; vuelve a Pagos', async () => {
    const { tree, fake } = await open();
    await pressLike(tree, /^Pagar 110 euros$/);
    await until(() => texts(tree).includes('Banco de prueba'));
    await press(tree, 'Pagar');
    await until(() => texts(tree).includes('Pago hecho.'));
    expect(
      (await fake.getProfilePayment(LUCIA, 'pay-transfer-110')).status,
    ).toBe('paid');
    await pressText(tree, 'Volver a Pagos');
    expect(mockRouter.replace).toHaveBeenCalledWith({
      pathname: '/comunica/pagos',
      params: {},
    });
  });
  it('desde una inscripción: «Pago hecho. Ya tienes tu plaza.» y «Ver la inscripción» con su nota', async () => {
    const { tree } = await open('pay-pend-1', NICO);
    await pressLike(tree, /^Pagar 20 euros$/);
    await until(() => texts(tree).includes('Banco de prueba'));
    await press(tree, 'Pagar');
    await until(() => texts(tree).includes('Pago hecho. Ya tienes tu plaza.'));
    await pressText(tree, 'Ver la inscripción');
    expect(mockRouter.replace).toHaveBeenCalledWith({
      pathname: '/comunica/inscripciones/[registrationId]',
      params: { registrationId: 'reg-nico-card', note: 'paid' },
    });
  });
  it('un importe distinto: lo que se paga es lo que queda como pagado', async () => {
    const { tree, fake } = await open();
    await pressLike(tree, /^Pagar otra cantidad$/);
    await type(tree, '¿Cuánto vas a pagar?', '50');
    await pressLike(tree, /^Pagar 50 euros$/);
    await until(() => texts(tree).includes('Banco de prueba'));
    await press(tree, 'Pagar');
    await until(() => texts(tree).includes('Pago hecho.'));
    expect(
      (await fake.getProfilePayment(LUCIA, 'pay-transfer-110')).amountCents,
    ).toBe(5000);
  });
  it('«Rechazar»: «No hemos podido completar el pago»; «Reintentar el pago» crea OTRO intento y paga el mismo pago', async () => {
    const { tree, fake } = await open();
    await pressLike(tree, /^Pagar 110 euros$/);
    await until(() => texts(tree).includes('Banco de prueba'));
    await press(tree, 'Rechazar');
    await until(() =>
      texts(tree).includes('No hemos podido completar el pago'),
    );
    expect(texts(tree)).toContain('No se ha realizado ningún cargo.');
    expect(fake.writeCount).toBe(1);
    await pressText(tree, 'Reintentar el pago');
    await until(() => texts(tree).includes('Banco de prueba'));
    expect(fake.writeCount).toBe(2);
    await press(tree, 'Pagar');
    await until(() => texts(tree).includes('Pago hecho.'));
    expect(
      (await fake.getProfilePayment(LUCIA, 'pay-transfer-110')).status,
    ).toBe('paid');
  });
  it('cerrar a medias pide confirmar; «Seguir pagando» no cierra; «Salir» comprueba y dice «No has terminado el pago»', async () => {
    const { tree } = await open();
    await pressLike(tree, /^Pagar 110 euros$/);
    await until(() => texts(tree).includes('Banco de prueba'));
    mockConfirm.mockResolvedValueOnce(false);
    await press(tree, 'Cerrar');
    expect(mockConfirm).toHaveBeenCalledWith(
      '¿Dejar el pago?',
      'Si ya has pagado, no pasa nada: lo verás como pagado en unos minutos.',
      'Salir',
      false,
      'Seguir pagando',
    );
    expect(texts(tree)).toContain('Banco de prueba');
    mockConfirm.mockResolvedValueOnce(true);
    await press(tree, 'Cerrar');
    await until(() => texts(tree).includes('No has terminado el pago'));
    expect(texts(tree)).toContain('No se ha cobrado nada.');
    expect(
      hasLike(tree, /^Volver a intentarlo$/) ||
        texts(tree).includes('Volver a intentarlo'),
    ).toBe(true);
  });
  it('el banco tarda: «Pago hecho» sin confirmar, se sigue preguntando y acaba en «Pago hecho.»; mientras, no se ofrece pagar', async () => {
    const { tree, fake } = await open('pay-transfer-110', LUCIA, {
      cardConfirmsAfter: 2,
    });
    await pressLike(tree, /^Pagar 110 euros$/);
    await until(() => texts(tree).includes('Banco de prueba'));
    await press(tree, 'Pagar');
    await until(() =>
      texts(tree).includes(
        'Si aún lo ves pendiente, el banco está terminando de confirmarlo.',
      ),
    );
    expect(
      (await fake.getProfilePayment(LUCIA, 'pay-transfer-110')).canPayByCard,
    ).toBe(false);
    await until(() => texts(tree).includes('Pago hecho.'), 5000);
    expect(
      (await fake.getProfilePayment(LUCIA, 'pay-transfer-110')).status,
    ).toBe('paid');
  });
  it('doble toque: un solo intento', async () => {
    const { tree, fake } = await open();
    const b = tree.root.findAll(
      (n) =>
        typeof n.props.onPress === 'function' &&
        n.props.accessibilityLabel === 'Pagar 110 euros',
    )[0];
    await act(async () => {
      b.props.onPress();
      b.props.onPress();
      b.props.onPress();
    });
    await until(() => texts(tree).includes('Banco de prueba'));
    expect(fake.writeCount).toBe(1);
  });
  it('sin conexión (con el resumen en pantalla): el botón no hace nada y dice por qué', async () => {
    const { tree, fake, qc } = await open();
    fake.setControls({ offline: true });
    await act(async () => {
      await qc.refetchQueries({ queryKey: ['comunica', 'pagos'] });
    });
    await until(() => texts(tree).includes('Necesitas conexión para pagar'));
    await pressLike(tree, /^Pagar 110 euros$/);
    await wait(50);
    expect(fake.writeCount).toBe(0);
  });
  it('el intento en curso va a disco SIN importes y se borra al terminar', async () => {
    const { tree, be, me } = await open();
    await pressLike(tree, /^Pagar 110 euros$/);
    await until(() => texts(tree).includes('Banco de prueba'));
    const key = `@comunica/${me.personId}/payattempt`;
    await until(() => !!be.dump()[key] && be.dump()[key] !== 'null');
    const saved = be.dump()[key];
    expect(saved).toContain('att-1');
    expect(saved).toContain('pay-transfer-110');
    expect(saved).not.toMatch(/11000|110,00|3500|amount/i);
    await press(tree, 'Pagar');
    await until(() => texts(tree).includes('Pago hecho.'));
    await until(() => be.dump()[key] === 'null');
  });
});

describe('la reserva por el navegador', () => {
  it('si la hoja no abre: «Abrir en el navegador» crea otro intento (`browser`), abre la sesión de autenticación y el servidor decide', async () => {
    const real = {
      launchUrl: 'https://mw.example.org/v1/card-launch/x',
      returnUrlPrefix: 'https://mw.example.org/v1/card-return/x/',
      expiresAt: '2026-11-01T11:00:00Z',
    };
    const { tree, fake } = await setup(
      'family',
      pay({ pago: 'pay-transfer-110' }),
      { activeId: LUCIA },
    );
    await until(() => hasLike(tree, /^Pagar 110 euros$/));
    const original = fake.createCardAttempt.bind(fake);
    const channels: string[] = [];
    // Intentos con la forma del servidor de verdad (con `launchUrl`), sobre el estado del falso.
    (fake as { createCardAttempt: unknown }).createCardAttempt = async (
      pid: string,
      body: { channel: string },
    ) => {
      channels.push(body.channel);
      const r = await original(pid, body as never);
      return { attemptId: r.attemptId, ...real };
    };
    mockOpenAuth.mockImplementation(async () => ({
      type: 'success',
      url: 'mcmapp://comunica/pagos/vuelta?intento=att-2&r=ok',
    }));
    await pressLike(tree, /^Pagar 110 euros$/);
    await until(() => !!mockWebView);
    await act(async () => {
      (mockWebView!.onError as () => void)();
    });
    await until(() =>
      texts(tree).includes('No se ha podido abrir la pasarela del banco'),
    );
    await pressLike(tree, /^Abrir en el navegador$/);
    await until(() => texts(tree).includes('Pago hecho.'));
    expect(channels).toEqual(['sheet', 'browser']);
    expect(mockOpenAuth).toHaveBeenCalledWith(
      real.launchUrl,
      'mcmapp://comunica/pagos/vuelta',
    );
    expect(
      (await fake.getProfilePayment(LUCIA, 'pay-transfer-110')).status,
    ).toBe('paid');
  });
});

describe('la hoja de la pasarela (WebView)', () => {
  const attempt = {
    attemptId: 'a1',
    launchUrl: 'https://mw.example.org/v1/card-launch/a1',
    returnUrlPrefix: 'https://mw.example.org/v1/card-return/a1/',
    expiresAt: '2026-11-01T11:00:00Z',
  };
  const sheet = async () => {
    const onResult = jest.fn();
    const onRetry = jest.fn();
    const onBrowser = jest.fn();
    const s = await setup(
      'family',
      <CardGatewaySheet
        attempt={attempt}
        amountLabel="35,00 €"
        onResult={onResult}
        onRetry={onRetry}
        onBrowser={onBrowser}
      />,
    );
    await until(() => !!mockWebView);
    return { ...s, onResult, onRetry, onBrowser };
  };
  const nav = (url: string, over: object = {}) =>
    (mockWebView!.onShouldStartLoadWithRequest as (r: object) => boolean)({
      url,
      isTopFrame: true,
      ...over,
    });

  it('no inyecta nada, va en incógnito, sin cookies compartidas y sin ventanas nuevas', async () => {
    await sheet();
    expect(mockWebView).toMatchObject({
      incognito: true,
      sharedCookiesEnabled: false,
      setSupportMultipleWindows: false,
      source: { uri: attempt.launchUrl },
    });
    for (const k of [
      'injectedJavaScript',
      'injectedJavaScriptBeforeContentLoaded',
      'onMessage',
    ])
      expect(Object.keys(mockWebView!)).not.toContain(k);
  });
  it('la URL de vuelta se corta y se lee `ok`/`ko`; solo una vez', async () => {
    const { onResult } = await sheet();
    expect(nav(`${attempt.returnUrlPrefix}ok`)).toBe(false);
    expect(onResult).toHaveBeenCalledWith('ok');
    nav(`${attempt.returnUrlPrefix}ko`);
    nav(`${attempt.returnUrlPrefix}ok`);
    expect(onResult).toHaveBeenCalledTimes(1);
  });
  it('un `ko`', async () => {
    const { onResult } = await sheet();
    expect(nav(`${attempt.returnUrlPrefix}ko?x=1`)).toBe(false);
    expect(onResult).toHaveBeenCalledWith('ko');
  });
  it('la página del banco carga; basura tras el prefijo, también; lo de un iframe no cuenta', async () => {
    const { onResult } = await sheet();
    expect(nav('https://bank.example.org/pay')).toBe(true);
    expect(nav(`${attempt.returnUrlPrefix}basura`)).toBe(true);
    expect(nav(`${attempt.returnUrlPrefix}ok`, { isTopFrame: false })).toBe(
      true,
    );
    expect(onResult).not.toHaveBeenCalled();
  });
  it('un esquema que no es http(s) (la app del banco, Bizum) se abre fuera y no se carga', async () => {
    const { Linking } = require('react-native');
    const spy = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    await sheet();
    expect(nav('bizum://pay?x=1')).toBe(false);
    expect(spy).toHaveBeenCalledWith('bizum://pay?x=1');
    expect(nav('intent://x#Intent;end')).toBe(false);
    spy.mockRestore();
  });
  it('de reserva, el cambio de navegación con la vuelta (redirecciones en Android)', async () => {
    const { onResult } = await sheet();
    await act(async () => {
      (mockWebView!.onNavigationStateChange as (n: object) => void)({
        url: `${attempt.returnUrlPrefix}ok`,
      });
    });
    expect(onResult).toHaveBeenCalledWith('ok');
  });
  it('si falla: el aviso con «Reintentar» (intento nuevo) y «Abrir en el navegador»', async () => {
    const { tree, onRetry, onBrowser } = await sheet();
    await act(async () => {
      (mockWebView!.onHttpError as () => void)();
    });
    await until(() =>
      texts(tree).includes('No se ha podido abrir la pasarela del banco'),
    );
    await pressText(tree, 'Reintentar');
    expect(onRetry).toHaveBeenCalled();
    await press(tree, 'Abrir en el navegador');
    expect(onBrowser).toHaveBeenCalled();
  });
  it('la cabecera: «Cerrar», «Pago con tarjeta» y el dominio; cerrar pide confirmar', async () => {
    const { tree, onResult } = await sheet();
    expect(texts(tree)).toContain('Pago con tarjeta');
    expect(texts(tree)).toContain('mw.example.org');
    mockConfirm.mockResolvedValueOnce(true);
    await press(tree, 'Cerrar');
    await until(() => onResult.mock.calls.length > 0);
    expect(onResult).toHaveBeenCalledWith('closed');
  });
  it('una pasarela simulada con un servidor que NO es el falso es un error y no se pinta', async () => {
    const services = require('@/services/comunica');
    const spies: jest.SpyInstance[] = [];
    const { tree } = await setup(
      'family',
      <CardGatewaySheet
        attempt={{ attemptId: 'a', simulated: true }}
        amountLabel="35,00 €"
        onResult={jest.fn()}
        onRetry={jest.fn()}
        onBrowser={jest.fn()}
      />,
      {
        // Después de entrar con el falso, la hoja ve un servidor que ya no lo es.
        before: async () => {
          spies.push(
            jest.spyOn(services, 'getFakeServer').mockReturnValue(null),
          );
        },
      },
    );
    await until(() =>
      texts(tree).includes('No se ha podido abrir la pasarela del banco'),
    );
    expect(texts(tree)).not.toContain('Banco de prueba');
    spies.forEach((s) => s.mockRestore());
  });
});

describe('guardarraíles', () => {
  const fs = require('fs');
  const path = require('path');
  const root = path.join(__dirname, '..', '..');
  const read = (f: string) => fs.readFileSync(path.join(root, f), 'utf8');
  const files = [
    'components/comunica/pagos/CardGatewaySheet.tsx',
    'components/comunica/pagos/PayScreen.tsx',
    'components/comunica/pagos/PaymentsScreen.tsx',
    'components/comunica/pagos/PaymentDetailScreen.tsx',
    'components/comunica/pagos/SimulatedGateway.tsx',
    'hooks/comunica/usePayments.ts',
    'utils/comunica/cardAttempt.ts',
  ];
  it('la hoja no inyecta JavaScript ni lee mensajes y lleva `incognito`', () => {
    const s = read('components/comunica/pagos/CardGatewaySheet.tsx');
    expect(s).not.toMatch(
      /injectedJavaScript|injectedJavaScriptBeforeContentLoaded|onMessage/,
    );
    expect(s).toMatch(/\bincognito\b/);
  });
  it('ningún fichero de pagos hace `fetch`, usa la cola ni registra la pasarela, el intento o la vuelta', () => {
    for (const f of files) {
      const s = read(f);
      expect(s).not.toMatch(/\bfetch\s*\(/);
      expect(s).not.toMatch(/enqueue|outbox/i);
      for (const m of s.match(/logger\.\w+\([^)]*\)/g) ?? [])
        expect(m).not.toMatch(/launchUrl|attemptId|returnUrl|attempt/i);
    }
  });
  it('el componente de la pasarela simulada no importa el falso', () => {
    expect(read('components/comunica/pagos/SimulatedGateway.tsx')).not.toMatch(
      /comunica\/fake|getFakeServer/,
    );
  });
  it('ninguna ruta de pagos se monta sin `pago` o `inscripcion` (no hay donativo)', () => {
    expect(read('components/comunica/pagos/PayScreen.tsx')).toMatch(
      /if \(!source\)/,
    );
    expect(read('app/(tabs)/comunica/pagos/pagar.tsx')).toMatch(
      /pago, inscripcion/,
    );
  });
});
