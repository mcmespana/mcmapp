/**
 * Inscripciones con el CABLEADO REAL (plan 14): el proveedor del área, «a quién se ve», los hooks y el servidor falso.
 *
 *   · Alta corta: bloqueos sin campos, preguntas y pago, errores en su campo, con tarjeta el pago detrás, el IBAN nunca fuera del formulario.
 *   · «Mis inscripciones»: el orden, «Otros eventos» plegado, vacío, tocar abre la ficha.
 *   · La ficha: el pago en una línea y la acción por su estado, tutores, cancelar con confirmación y con el plazo cerrado entre medias.
 *   · Modificar: lo contestado sale marcado y solo se guarda lo permitido.
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
jest.mock('expo-web-browser', () => ({ openBrowserAsync: jest.fn() }));
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
import RegistrationDetailScreen from '@/components/comunica/inscripciones/RegistrationDetailScreen';
import RegistrationEditScreen from '@/components/comunica/inscripciones/RegistrationEditScreen';
import RegistrationsScreen from '@/components/comunica/inscripciones/RegistrationsScreen';
import SignupScreen from '@/components/comunica/inscripciones/SignupScreen';
import { consumeLegacyOpen } from '@/services/comunica/legacy';
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
const has = (tree: ReactTestRenderer, label: string) =>
  labelled(tree, label).length > 0;
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
  opts: { activeId?: string; controls?: Partial<FakeServer['controls']> } = {},
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
const IBAN = 'ES9121000418450200051332';
const signup = (id: string) => <SignupScreen eventId={id} />;
const reg = (id: string, p: { note?: string; waiting?: boolean } = {}) => (
  <RegistrationDetailScreen registrationId={id} {...p} />
);
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
const choose = async (tree: ReactTestRenderer, label: string) => {
  const b = tree.root.findAll(
    (n) =>
      typeof n.props.onPress === 'function' &&
      n.props.accessibilityRole === 'radio' &&
      String(n.props.accessibilityLabel).startsWith(label),
  )[0];
  if (!b) throw new Error(`No hay opción «${label}»`);
  await act(async () => {
    b.props.onPress();
  });
};
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
/** Una opción dentro de UN grupo (los de «Sí / No» se repiten: preguntas y necesidades especiales). */
const chooseIn = async (
  tree: ReactTestRenderer,
  group: string,
  label: string,
) => {
  const g = tree.root.findAll(
    (n) =>
      n.props.accessibilityRole === 'radiogroup' &&
      n.props.accessibilityLabel === group,
  )[0];
  const b = g.findAll(
    (n) =>
      typeof n.props.onPress === 'function' &&
      n.props.accessibilityLabel === label,
  )[0];
  await act(async () => {
    b.props.onPress();
  });
};
const checked = (tree: ReactTestRenderer, label: string) =>
  tree.root.findAll(
    (n) =>
      n.props.accessibilityRole === 'radio' &&
      n.props.accessibilityState?.checked === true &&
      String(n.props.accessibilityLabel).startsWith(label),
  ).length > 0;
const answerAll = async (tree: ReactTestRenderer) => {
  await choose(tree, 'Sí');
  await choose(tree, 'Coche propio');
};

describe('el alta corta: bloqueos, sin un solo campo', () => {
  it('plaza ya cogida: «Lucía ya tiene su plaza» y nada que rellenar', async () => {
    const { tree } = await setup('family', signup('pev-sesiones'), {
      activeId: LUCIA,
    });
    await until(() => texts(tree).includes('Lucía ya tiene su plaza'));
    expect(texts(tree)).toContain(
      'Lucía ya tiene una inscripción activa para esta actividad. No hace falta repetirla.',
    );
    expect(texts(tree)).toContain('Inscribes a Lucía en');
    expect(has(tree, 'Apuntar a Lucía')).toBe(false);
  });
  it('audiencia o plazo: su título y su texto', async () => {
    const a = await setup('family', signup('pev-otra-del'), {
      activeId: LUCIA,
    });
    await until(() => texts(a.tree).includes('Esta actividad no es para ti'));
    expect(has(a.tree, 'Apuntar a Lucía')).toBe(false);
    const b = await setup('family', signup('pev-cerrada'), { activeId: LUCIA });
    await until(() => texts(b.tree).includes('La inscripción no está abierta'));
    expect(texts(b.tree)).toContain('El plazo de inscripción terminó el');
  });
  it('formulario avanzado: la nota y «Ir al formulario de inscripción» abre web.tsx con la URL del CRM', async () => {
    const { tree } = await setup('family', signup('pev-fwa'), {
      activeId: LUCIA,
    });
    await until(() =>
      texts(tree).includes('Esta actividad tiene su propio formulario'),
    );
    expect(texts(tree)).toContain('Te lo abrimos con tus datos ya puestos.');
    await press(tree, 'Ir al formulario de inscripción');
    await until(() => mockRouter.push.mock.calls.length > 0);
    expect(mockRouter.push).toHaveBeenCalledWith('/comunica/web');
    expect(consumeLegacyOpen()).toMatchObject({
      title: 'Inscripción',
      url: expect.stringContaining('crm.example.org'),
    });
    // Nunca por `openLegacy` (es una página del CRM, no del plugin).
    expect(mockOpenLegacy).not.toHaveBeenCalled();
  });
});

describe('el alta corta: rellenar y enviar', () => {
  it('con precio: las preguntas, «¿Cómo pagas?» con el precio y los medios del CRM', async () => {
    const { tree } = await setup('family', signup('pev-convi'), {
      activeId: LUCIA,
    });
    await until(() => has(tree, 'Apuntar a Lucía'));
    const t = texts(tree);
    expect(t).toContain('Inscribes a Lucía en');
    expect(t).toContain('¿Vas a dormir en el albergue?');
    expect(t).toContain('Elige una opción (2)');
    expect(t).toContain('¿Cómo pagas?');
    expect(t).toContain('45,00 €');
    expect(t).toContain('Domiciliación');
    expect(t).toContain('Tarjeta');
    expect(t).toContain('Necesidades especiales');
  });
  it('si falta algo no se envía: el error en su campo', async () => {
    const { tree, fake } = await setup('family', signup('pev-convi'), {
      activeId: LUCIA,
    });
    await until(() => has(tree, 'Apuntar a Lucía'));
    await press(tree, 'Apuntar a Lucía');
    expect(texts(tree)).toContain(
      'Contesta a todas las preguntas de la actividad.',
    );
    await answerAll(tree);
    await press(tree, 'Apuntar a Lucía');
    expect(texts(tree)).toContain('Elige cómo vas a pagar.');
    expect(fake.writeCount).toBe(0);
  });
  it('con tarjeta: a la ficha con «Listo» y el pago detrás (plan 15: hoy, su formulario)', async () => {
    const { tree, fake } = await setup('family', signup('pev-convi'), {
      activeId: LUCIA,
    });
    await until(() => has(tree, 'Apuntar a Lucía'));
    await answerAll(tree);
    await choose(tree, 'Tarjeta');
    await press(tree, 'Apuntar a Lucía');
    await until(() => mockRouter.replace.mock.calls.length > 0);
    const arg = mockRouter.replace.mock.calls[0][0];
    expect(arg).toMatchObject({
      pathname: '/comunica/inscripciones/[registrationId]',
      params: { note: 'signed' },
    });
    const rid = arg.params.registrationId as string;
    expect(fake.writeCount).toBe(1);
    await until(() => mockOpenLegacy.mock.calls.length > 0);
    expect(mockOpenLegacy).toHaveBeenCalledWith(
      { internalpage: 'single_stic_payment_form', id: `pay-${rid}` },
      'Pago',
      LUCIA,
    );
  });
  it('si el CRM no genera el pago, se paga por la inscripción (lista de pagos hasta el plan 15)', async () => {
    const { tree } = await setup('family', signup('pev-convi'), {
      activeId: LUCIA,
      controls: { noCardPayment: true },
    });
    await until(() => has(tree, 'Apuntar a Lucía'));
    await answerAll(tree);
    await choose(tree, 'Tarjeta');
    await press(tree, 'Apuntar a Lucía');
    await until(() => mockOpenLegacy.mock.calls.length > 0);
    expect(mockOpenLegacy).toHaveBeenCalledWith(
      { internalpage: 'list_stic_payments' },
      'Pagos',
      LUCIA,
    );
  });
  it('domiciliación: un IBAN malo no envía nada; uno bueno sí, y NUNCA queda fuera del formulario', async () => {
    const { tree, fake, qc, be } = await setup('family', signup('pev-convi'), {
      activeId: LUCIA,
    });
    await until(() => has(tree, 'Apuntar a Lucía'));
    await answerAll(tree);
    await choose(tree, 'Domiciliación');
    await type(tree, 'IBAN', 'ES00 1234');
    await press(tree, 'Apuntar a Lucía');
    expect(texts(tree)).toContain('El IBAN no parece válido.');
    expect(fake.writeCount).toBe(0);
    await type(tree, 'IBAN', IBAN);
    await press(tree, 'Apuntar a Lucía');
    await until(() => mockRouter.replace.mock.calls.length > 0);
    expect(fake.writeCount).toBe(1);
    // Con domiciliación no se abre el pago con tarjeta.
    expect(mockOpenLegacy).not.toHaveBeenCalled();
    // El IBAN no está en ninguna caché, almacén ni log.
    const all = JSON.stringify([
      dehydrateArea(qc),
      be.dump(),
      qc
        .getQueryCache()
        .getAll()
        .map((q) => q.state.data),
      mockRouter.replace.mock.calls,
    ]);
    expect(all).not.toContain('ES91');
    expect(all).not.toContain('2100 0418');
    expect(JSON.stringify(fake.data)).not.toContain('ES91');
  });
  it('si no se pudo anotar el pago, la plaza queda y el aviso lo dice', async () => {
    const { tree } = await setup('family', signup('pev-convi'), {
      activeId: LUCIA,
      controls: { paymentFails: true },
    });
    await until(() => has(tree, 'Apuntar a Lucía'));
    await answerAll(tree);
    await choose(tree, 'Tarjeta');
    await press(tree, 'Apuntar a Lucía');
    await until(() => mockRouter.replace.mock.calls.length > 0);
    expect(mockRouter.replace.mock.calls[0][0].params.note).toBe(
      'payment_error',
    );
    expect(mockOpenLegacy).not.toHaveBeenCalled();
  });
  it('otro móvil ya la cogió: al enviar sale el bloqueo (el servidor es el guard)', async () => {
    const { tree, fake } = await setup('family', signup('pev-convi'), {
      activeId: LUCIA,
    });
    await until(() => has(tree, 'Apuntar a Lucía'));
    await answerAll(tree);
    await choose(tree, 'Tarjeta');
    fake.setControls({ alreadyRegisteredElsewhere: true });
    await press(tree, 'Apuntar a Lucía');
    await until(() => !has(tree, 'Apuntar a Lucía'));
    expect(texts(tree)).toContain('No hace falta repetirla.');
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });
  it('con el CRM caído: el aviso y, al volver, el mismo botón guarda UNA sola inscripción', async () => {
    const { tree, fake } = await setup('family', signup('pev-convi'), {
      activeId: LUCIA,
      controls: { crmDown: true },
    });
    await until(() => has(tree, 'Apuntar a Lucía'));
    await answerAll(tree);
    await choose(tree, 'Tarjeta');
    await press(tree, 'Apuntar a Lucía');
    await until(() =>
      texts(tree).includes(
        'No hemos podido guardar la inscripción. Inténtalo otra vez en un rato.',
      ),
    );
    expect(fake.writeCount).toBe(0);
    fake.setControls({ crmDown: false });
    await press(tree, 'Apuntar a Lucía');
    await until(() => mockRouter.replace.mock.calls.length > 0);
    expect(fake.writeCount).toBe(1);
  });
  it('sin conexión (con el formulario en pantalla): el botón apagado y por qué', async () => {
    const { tree, fake, qc } = await setup('family', signup('pev-convi'), {
      activeId: LUCIA,
    });
    await until(() => has(tree, 'Apuntar a Lucía'));
    await answerAll(tree);
    await choose(tree, 'Tarjeta');
    fake.setControls({ offline: true });
    await act(async () => {
      await qc.refetchQueries({ queryKey: ['comunica', 'signup'] });
    });
    await until(() =>
      texts(tree).includes('Necesitas conexión para apuntarte'),
    );
    await press(tree, 'Apuntar a Lucía');
    await wait(50);
    expect(fake.writeCount).toBe(0);
  });
  it('sin precio y sin preguntas: «Apuntarme» a secas (uno mismo) y listo', async () => {
    const { tree, fake } = await setup('monitorMom', signup('pev-sinc'));
    await until(() => has(tree, 'Apuntarme'));
    expect(texts(tree)).toContain('Te inscribes a');
    expect(texts(tree)).not.toContain('¿Cómo pagas?');
    await press(tree, 'Apuntarme');
    await until(() => mockRouter.replace.mock.calls.length > 0);
    expect(fake.writeCount).toBe(1);
  });
});

describe('«Mis inscripciones»', () => {
  it('lo abierto primero, lo cerrado después, el título de arriba y lo oculto plegado en «Otros eventos»', async () => {
    const { tree } = await setup('family', <RegistrationsScreen />, {
      activeId: LUCIA,
    });
    await until(() =>
      texts(tree).includes('Sesiones semanales MIC 4.º-6.º EP'),
    );
    const t = texts(tree);
    expect(t).toContain(
      'Aquí están las actividades y eventos a los que te has apuntado.',
    );
    expect(t).toContain('Rechazada');
    expect(t).toContain('Curso de Catequesis MIC');
    expect(t.indexOf('Sesiones semanales')).toBeLessThan(
      t.indexOf('Día de la familia'),
    );
    expect(t).toContain('Otros eventos (1)');
    expect(t).not.toContain('Retiro de confirmación');
    await press(tree, 'Otros eventos, 1');
    expect(texts(tree)).toContain('Retiro de confirmación');
  });
  it('la curso escolar y la clase de cada tarjeta', async () => {
    const { tree } = await setup('family', <RegistrationsScreen />, {
      activeId: NICO,
    });
    await until(() => texts(tree).includes('Merienda de bienvenida'));
    expect(texts(tree)).toContain('2.º ESO · Clase A');
  });
  it('tocar la tarjeta abre su ficha', async () => {
    const { tree } = await setup('family', <RegistrationsScreen />, {
      activeId: LUCIA,
    });
    await until(() =>
      texts(tree).includes('Sesiones semanales MIC 4.º-6.º EP'),
    );
    const card = tree.root.findAll(
      (n) =>
        n.props.accessibilityHint === 'Abre la inscripción' &&
        String(n.props.accessibilityLabel).includes('Sesiones semanales'),
    )[0];
    await act(async () => {
      card.props.onPress();
    });
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: '/comunica/inscripciones/[registrationId]',
      params: { registrationId: 'reg-lucia-sesiones' },
    });
  });
  it('vacía: el texto de un hijo y la salida a las actividades abiertas', async () => {
    const { tree, fake, qc } = await setup('family', <RegistrationsScreen />, {
      activeId: LUCIA,
    });
    await until(() => texts(tree).includes('Sesiones semanales'));
    (fake as { getProfileRegistrations: unknown }).getProfileRegistrations =
      async () => ({
        generatedAt: '2026-11-01T10:00:00Z',
        items: [],
      });
    await act(async () => {
      await qc.refetchQueries({ queryKey: ['comunica', 'registrations'] });
    });
    await until(() =>
      texts(tree).includes('Todavía no hay inscripciones de Lucía'),
    );
    await pressText(tree, 'Ver actividades abiertas');
    expect(mockRouter.push).toHaveBeenCalledWith('/comunica/actividades');
  });
});

describe('la ficha de una inscripción', () => {
  it('pendiente con tarjeta: aviso de «sin confirmar», el pago en una línea, «Pagar 20,00 € con tarjeta» y los tutores', async () => {
    const { tree } = await setup('family', reg('reg-nico-card'), {
      activeId: NICO,
    });
    await until(() => texts(tree).includes('Pagar 20,00 € con tarjeta'));
    const t = texts(tree);
    expect(t).toContain('Todavía no está confirmada.');
    expect(t).toContain('Lleva gafas y necesita sentarse delante.');
    expect(t).toContain('20,00 € · Pendiente de pagar');
    expect(t).toContain('Personas de contacto');
    expect(t).toContain('Madre · 600111222 · marta@ejemplo.org');
    expect(t).toContain('Personas');
    await press(tree, 'Pagar 20,00 € con tarjeta');
    expect(mockOpenLegacy).toHaveBeenCalledWith(
      { internalpage: 'single_stic_payment_form', id: 'pay-pend-1' },
      'Pago',
      NICO,
    );
  });
  it('llamar a un tutor abre el teléfono', async () => {
    const { Linking } = require('react-native');
    const spy = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    const { tree } = await setup('family', reg('reg-nico-card'), {
      activeId: NICO,
    });
    await until(() => has(tree, 'Llamar a Marta Villarroya'));
    await press(tree, 'Llamar a Marta Villarroya');
    expect(spy).toHaveBeenCalledWith('tel:600111222');
    spy.mockRestore();
  });
  it('pagada: «Pagado · Tarjeta · fecha» con «Ver el pago» y sin botón de pagar; ya celebrado', async () => {
    const { tree } = await setup('family', reg('reg-lucia-pasada'), {
      activeId: LUCIA,
    });
    await until(() => texts(tree).includes('Pagado'));
    expect(texts(tree)).toContain('110,00 € · Pagado · Tarjeta ·');
    expect(texts(tree)).toContain('Ya celebrado');
    expect(texts(tree)).not.toContain('Pagar 110,00');
    await pressLike(tree, /^Ver el pago\./);
    expect(mockOpenLegacy).toHaveBeenCalledWith(
      {
        internalpage: 'single_stic_payments',
        action: 'detail',
        id: 'pay-lucia-110',
      },
      'Pago',
      LUCIA,
    );
  });
  it('devuelto: «No se pudo cobrar» con su aviso rojo y se puede pagar; con el plazo cerrado, el motivo', async () => {
    const { tree } = await setup('family', reg('reg-nico-devuelto'), {
      activeId: NICO,
    });
    await until(() => texts(tree).includes('110,00 € · No se pudo cobrar'));
    expect(texts(tree)).toContain(
      'Este pago no se pudo cobrar. Puedes pagarlo con tarjeta o hablar con tu delegación.',
    );
    expect(has(tree, 'Pagar 110,00 € con tarjeta')).toBe(true);
    expect(texts(tree)).toContain('El plazo de inscripción ya ha terminado.');
    expect(has(tree, 'Cancelar mi inscripción')).toBe(false);
    expect(has(tree, 'Modificar mis datos')).toBe(false);
  });
  it('por transferencia: «¿Ya lo has pagado?»', async () => {
    const { tree } = await setup('family', reg('reg-nico-transfer'), {
      activeId: NICO,
    });
    await until(() =>
      texts(tree).includes('35,00 € · Pendiente de pagar · Transferencia'),
    );
    expect(texts(tree)).toContain(
      '¿Ya lo has pagado? Tu delegación lo marcará en cuanto lo vea.',
    );
  });
  it('recién vuelto del pago: «esperando al banco» y no se ofrece pagar otra vez', async () => {
    const { tree } = await setup(
      'family',
      reg('reg-nico-card', { waiting: true }),
      { activeId: NICO },
    );
    await until(() =>
      texts(tree).includes('Estamos esperando la confirmación del banco.'),
    );
    expect(has(tree, 'Pagar 20,00 € con tarjeta')).toBe(false);
  });
  it('rechazada: su aviso y nada que pagar ni cambiar', async () => {
    const { tree } = await setup('family', reg('reg-lucia-rechazada'), {
      activeId: LUCIA,
    });
    await until(() =>
      texts(tree).includes('Esta inscripción está en estado «Rechazada».'),
    );
    expect(has(tree, 'Cancelar mi inscripción')).toBe(false);
  });
  it('domiciliada: «Se cobra por domiciliación el …» y sin pagar', async () => {
    const { tree } = await setup('family', reg('reg-nico-dd'), {
      activeId: NICO,
    });
    await until(() =>
      texts(tree).includes('60,00 € · Se cobra por domiciliación el'),
    );
    expect(texts(tree)).not.toContain('Pagar 60,00');
  });
  it('tras apuntarse: «Listo: Lucía ya tiene su plaza.»', async () => {
    const { tree } = await setup(
      'family',
      reg('reg-lucia-sesiones', { note: 'signed' }),
      { activeId: LUCIA },
    );
    await until(() => texts(tree).includes('Listo: Lucía ya tiene su plaza.'));
  });
  it('otra persona o una inscripción ajena: «Esta inscripción ya no está disponible»', async () => {
    const { tree } = await setup('family', reg('reg-lucia-sesiones'), {
      activeId: NICO,
    });
    await until(() =>
      texts(tree).includes('Esta inscripción ya no está disponible'),
    );
  });
  it('sin conexión y sin datos (la ficha no se guarda): «Necesitas conexión para ver la inscripción»', async () => {
    const { tree } = await setup('family', reg('reg-lucia-sesiones'), {
      activeId: LUCIA,
      controls: { failRoute: 'profileRegistration' },
    });
    await until(() =>
      texts(tree).includes('Necesitas conexión para ver la inscripción'),
    );
  });
  it('la ficha nunca llega al disco', async () => {
    const { tree, qc, be } = await setup('family', reg('reg-nico-card'), {
      activeId: NICO,
    });
    await until(() => texts(tree).includes('Personas de contacto'));
    const saved = JSON.stringify([dehydrateArea(qc), be.dump()]);
    for (const secret of [
      '600111222',
      'marta@ejemplo.org',
      'pay-pend-1',
      'gafas',
    ])
      expect(saved).not.toContain(secret);
  });
});

describe('cancelar y modificar desde la ficha', () => {
  it('cancelar pide confirmación con sus textos; «No, mantenerla» no cambia nada', async () => {
    mockConfirm.mockResolvedValueOnce(false);
    const { tree, fake } = await setup('family', reg('reg-lucia-sesiones'), {
      activeId: LUCIA,
    });
    await until(() => has(tree, 'Cancelar mi inscripción'));
    await press(tree, 'Cancelar mi inscripción');
    expect(mockConfirm).toHaveBeenCalledWith(
      '¿Cancelar tu inscripción?',
      'Tu plaza quedará libre.',
      'Sí, cancelar',
      true,
      'No, mantenerla',
    );
    expect(fake.writeCount).toBe(0);
  });
  it('confirmada: «Inscripción cancelada.» en el listado y la inscripción queda cancelada (no se borra)', async () => {
    mockConfirm.mockResolvedValueOnce(true);
    const { tree, fake } = await setup('family', reg('reg-lucia-sesiones'), {
      activeId: LUCIA,
    });
    await until(() => has(tree, 'Cancelar mi inscripción'));
    await press(tree, 'Cancelar mi inscripción');
    await until(() => mockRouter.replace.mock.calls.length > 0);
    expect(mockRouter.replace).toHaveBeenCalledWith({
      pathname: '/comunica/inscripciones',
      params: { note: 'cancelled' },
    });
    expect(
      (await fake.getProfileRegistration(LUCIA, 'reg-lucia-sesiones')).status
        .label,
    ).toBe('Cancelada');
  });
  it('un curso se modifica pero no se cancela, con su motivo', async () => {
    const { tree } = await setup('family', reg('reg-lucia-curso'), {
      activeId: LUCIA,
    });
    await until(() => has(tree, 'Modificar mis datos'));
    expect(has(tree, 'Cancelar mi inscripción')).toBe(false);
    expect(texts(tree)).toContain(
      'Para darte de baja del curso, habla con tu delegación.',
    );
  });
  it('el plazo se cerró entre medias: no se ha cambiado nada y lo dice', async () => {
    mockConfirm.mockResolvedValueOnce(true);
    const { tree, fake } = await setup('family', reg('reg-lucia-sesiones'), {
      activeId: LUCIA,
    });
    await until(() => has(tree, 'Cancelar mi inscripción'));
    (fake as { cancelRegistration: unknown }).cancelRegistration = async () => {
      const { ComunicaApiError } = require('@/services/comunica/client');
      throw new ComunicaApiError('conflict', 'x', 409, 'window_closed');
    };
    await press(tree, 'Cancelar mi inscripción');
    await until(() => texts(tree).includes('no se ha cambiado nada'));
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });
});

describe('modificar mi inscripción', () => {
  const edit = (id: string) => <RegistrationEditScreen registrationId={id} />;
  it('lo contestado sale marcado; sin tocar nada se guarda lo mismo y vuelve a la ficha con «Cambios guardados»', async () => {
    const { tree, fake } = await setup('family', edit('reg-nico-convi'), {
      activeId: NICO,
    });
    await until(() => texts(tree).includes('Tu inscripción a'));
    expect(texts(tree)).toContain('Convivencia COM');
    expect(checked(tree, 'Sí')).toBe(true);
    expect(checked(tree, 'Coche propio')).toBe(true);
    await choose(tree, 'No');
    await press(tree, 'Guardar cambios');
    await until(() => mockRouter.replace.mock.calls.length > 0);
    expect(mockRouter.replace).toHaveBeenCalledWith({
      pathname: '/comunica/inscripciones/[registrationId]',
      params: { registrationId: 'reg-nico-convi', note: 'saved' },
    });
    expect(
      (await fake.getProfileRegistration(NICO, 'reg-nico-convi')).answers[0],
    ).toBe('No');
  });
  it('las necesidades especiales llevan descripción solo con «Sí» y se guardan', async () => {
    const { tree, fake } = await setup('family', edit('reg-nico-convi'), {
      activeId: NICO,
    });
    await until(() => texts(tree).includes('Necesidades especiales'));
    expect(texts(tree)).not.toContain('Descripción de las necesidades');
    await chooseIn(tree, 'Necesidades especiales', 'Sí');
    await until(() => texts(tree).includes('Descripción de las necesidades'));
    await type(tree, 'Descripción de las necesidades', 'Celíaco');
    await press(tree, 'Guardar cambios');
    await until(() => mockRouter.replace.mock.calls.length > 0);
    const d = await fake.getProfileRegistration(NICO, 'reg-nico-convi');
    expect(d).toMatchObject({
      specialNeeds: '1',
      specialNeedsDescription: 'Celíaco',
    });
    // Solo respuestas y necesidades: nada más cambia (el pago sigue como estaba).
    expect(d.payment).toMatchObject({ state: 'pending', amount: 45 });
  });
  it('una ficha sin derechos (plazo cerrado, pasada): «Esta inscripción ya no se puede cambiar» con su motivo', async () => {
    const { tree } = await setup('family', edit('reg-nico-devuelto'), {
      activeId: NICO,
    });
    await until(() =>
      texts(tree).includes('Esta inscripción ya no se puede cambiar'),
    );
    expect(texts(tree)).toContain('El plazo de inscripción ya ha terminado.');
    expect(has(tree, 'Guardar cambios')).toBe(false);
    const past = await setup('family', edit('reg-lucia-pasada'), {
      activeId: LUCIA,
    });
    await until(() =>
      texts(past.tree).includes('Esta inscripción ya no se puede cambiar'),
    );
  });
  it('el plazo se cerró entre medias: vuelve a la ficha con «no se ha cambiado nada»', async () => {
    const { tree, fake } = await setup('family', edit('reg-nico-convi'), {
      activeId: NICO,
    });
    await until(() => has(tree, 'Guardar cambios'));
    (fake as { updateRegistration: unknown }).updateRegistration = async () => {
      const { ComunicaApiError } = require('@/services/comunica/client');
      throw new ComunicaApiError('conflict', 'x', 409, 'window_closed');
    };
    await press(tree, 'Guardar cambios');
    await until(() => mockRouter.replace.mock.calls.length > 0);
    expect(mockRouter.replace.mock.calls[0][0].params.note).toBe('closed');
  });
  it('sin conexión: «Guardar cambios» apagado y por qué', async () => {
    const { tree, fake, qc } = await setup('family', edit('reg-nico-convi'), {
      activeId: NICO,
    });
    await until(() => has(tree, 'Guardar cambios'));
    fake.setControls({ offline: true });
    await act(async () => {
      await qc.refetchQueries({ queryKey: ['comunica', 'registrations'] });
    });
    await until(() => texts(tree).includes('Necesitas conexión para guardar'));
    await press(tree, 'Guardar cambios');
    await wait(50);
    expect(fake.writeCount).toBe(0);
  });
});

describe('guardarraíles', () => {
  it('ninguna escritura de inscripciones usa la cola y ningún cuerpo lleva personas', () => {
    const fs = require('fs');
    const path = require('path');
    const root = path.join(__dirname, '..', '..');
    for (const f of [
      'hooks/comunica/useRegistrations.ts',
      'components/comunica/inscripciones/SignupScreen.tsx',
      'components/comunica/inscripciones/RegistrationEditScreen.tsx',
    ]) {
      const src = fs.readFileSync(path.join(root, f), 'utf8');
      expect(src).not.toMatch(/enqueue|outbox/i);
    }
    const util = fs.readFileSync(
      path.join(root, 'utils/comunica/signupForm.ts'),
      'utf8',
    );
    expect(util).not.toMatch(/personId|payerId|payer/);
  });
  it('el IBAN y la URL del formulario avanzado no pasan por el logger', () => {
    const fs = require('fs');
    const path = require('path');
    const root = path.join(__dirname, '..', '..');
    for (const f of [
      'hooks/comunica/useRegistrations.ts',
      'components/comunica/inscripciones/SignupScreen.tsx',
      'utils/comunica/iban.ts',
      'utils/comunica/signupForm.ts',
    ]) {
      const src = fs.readFileSync(path.join(root, f), 'utf8');
      expect(src).not.toMatch(/logger\./);
      expect(src).not.toMatch(/console\./);
    }
  });
});
