/**
 * Las pantallas de familia con el CABLEADO REAL (plan 11, tareas 5-8): el proveedor del área, el de «a quién se ve», los hooks y el servidor falso.
 *
 *   · «¿A quién ves?»: una tarjeta por hijo y la propia al final; sin hijos, el texto de siempre; con un destino, «apuntar».
 *   · «Viendo a»: solo con hijos; «Ver como…» cambia de persona.
 *   · La portada: el familiar a secas solo tiene «Tus pagos»; el miembro, las cinco secciones; viendo a un hijo, «Inscripciones» y «Datos de Lucía».
 *   · El saludo se oculta con su × y se recuerda.
 *   · «Hay que elegir»: un enlace de familia a quien es solo familiar con varios hijos y no ha elegido nunca va primero a «¿A quién ves?».
 */
/* eslint-disable react/display-name, @typescript-eslint/no-require-imports, import/first */
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Text } from 'react-native';
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
jest.mock('expo-image', () => ({
  Image: {
    clearDiskCache: jest.fn().mockResolvedValue(true),
    clearMemoryCache: jest.fn().mockResolvedValue(true),
  },
}));

import ComunicaAreaProvider from '@/components/comunica/comun/ComunicaAreaProvider';
import MemberHome from '@/components/comunica/inicio/MemberHome';
import ActiveProfileBar from '@/components/comunica/perfiles/ActiveProfileBar';
import ProfilesScreen from '@/components/comunica/perfiles/ProfilesScreen';
import { ActiveProfileProvider } from '@/hooks/comunica/useActiveProfile';
import { mustPickProfileFirst } from '@/hooks/comunica/useComunicaLinks';
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
const texts = (tree: ReactTestRenderer) =>
  tree.root
    .findAllByType(Text)
    .map((t) => [t.props.children].flat().join(''))
    .join(' | ');
const touchable = (tree: ReactTestRenderer, label: string) => {
  const b = tree.root
    .findAll(
      (n) =>
        typeof n.props.onPress === 'function' &&
        n.props.accessibilityLabel === label,
      { deep: false },
    )
    .at(0);
  if (!b) throw new Error(`No hay nada que tocar con «${label}»`);
  return b;
};
const press = async (tree: ReactTestRenderer, label: string) => {
  await act(async () => {
    touchable(tree, label).props.onPress();
  });
};
const has = (tree: ReactTestRenderer, label: string) =>
  tree.root.findAll(
    (n) =>
      typeof n.props.onPress === 'function' &&
      n.props.accessibilityLabel === label,
    { deep: false },
  ).length > 0;
const hasLike = (tree: ReactTestRenderer, re: RegExp) =>
  tree.root.findAll(
    (n) =>
      typeof n.props.onPress === 'function' &&
      typeof n.props.accessibilityLabel === 'string' &&
      re.test(n.props.accessibilityLabel),
    { deep: false },
  ).length > 0;
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
  be = memoryBackend(),
) {
  __resetSessionForTests();
  __resetComunicaApiForTests();
  setStorageBackend(be);
  getComunicaApi();
  const fake = getFakeServer() as FakeServer;
  fake.setControls({ latencyMs: 0 });
  const s = fake.issueSession(persona);
  await signIn(s, s.me);
  return { fake, be, me: s.me, ...(await mount(screen)) };
}
async function mount(screen: React.ReactElement) {
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
  return { qc, tree };
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
  mockParams = {};
  __resetComunicaApiForTests();
  __resetSessionForTests();
  jest.clearAllMocks();
});

describe('«¿A quién ves?»', () => {
  it('una tarjeta por hijo y la propia al final; el hijo sin nombre sale como «Participante»', async () => {
    const { tree } = await setup('family', <ProfilesScreen />);
    await until(() => texts(tree).includes('Lucía Messeguer'));
    const t = texts(tree);
    expect(t).toContain('¿A quién quieres ver?');
    expect(t).toContain(
      'Elige a quién quieres ver. Puedes cambiar desde arriba cuando quieras.',
    );
    expect(t).toContain('Participante');
    expect(t.indexOf('Lucía Messeguer')).toBeLessThan(
      t.indexOf('Marta Villarroya'),
    );
    expect(t.indexOf('Participante')).toBeLessThan(
      t.indexOf('Marta Villarroya'),
    );
    expect(has(tree, 'Lucía Messeguer. Elegir')).toBe(true);
    expect(hasLike(tree, /^Marta Villarroya, yo/)).toBe(true);
  });

  it('elegir a un hijo lo deja como activo y vuelve a la portada (sin destino)', async () => {
    const { tree } = await setup('family', <ProfilesScreen />);
    await until(() => has(tree, 'Lucía Messeguer. Elegir'));
    await press(tree, 'Lucía Messeguer. Elegir');
    expect(mockRouter.replace).toHaveBeenCalledWith('/comunica');
    await until(() =>
      has(tree, 'Lucía Messeguer, viéndolo ahora. Seguir aquí'),
    );
  });

  it('con un evento o una inscripción de destino, «¿A quién quieres apuntar?»', async () => {
    mockParams = {
      internalpage: 'single_stic_events',
      action: 'detail',
      id: 'abcdef0123456789',
    };
    const { tree } = await setup('family', <ProfilesScreen />);
    await until(() => texts(tree).includes('Lucía Messeguer'));
    expect(texts(tree)).toContain('¿A quién quieres apuntar?');
    expect(texts(tree)).toContain(
      'Elige a quién y te llevamos directo a la actividad.',
    );
  });

  it('sin hijos: el texto de siempre y la tarjeta propia; con un hijo recién vinculado, aparece al abrirla (fresh)', async () => {
    const { tree } = await setup('familyNone', <ProfilesScreen />);
    await until(() =>
      texts(tree).includes('Todavía no tienes participantes vinculados'),
    );
    expect(texts(tree)).toContain(
      'Si crees que falta alguien, contacta con tu referente.',
    );
    expect(hasLike(tree, /^Carmen Ibáñez, yo/)).toBe(true);
    // El hijo recién vinculado llega con `fresh=1`, que es lo que pide la pantalla al abrirse.
    const fam = await setup('family', <ProfilesScreen />);
    fam.fake.setControls({ newChildNext: true });
    await act(async () => {
      fam.tree.unmount();
    });
    const again = await mount(<ProfilesScreen />);
    await until(() => texts(again.tree).includes('Mateo Villarroya'));
  });
});

describe('«Viendo a»', () => {
  it('con hijos sale; sin ellos no; «Ver como…» cambia de persona', async () => {
    const mom = await setup('monitorMom', <ActiveProfileBar />);
    await until(() => has(mom.tree, 'Viendo a Yo misma. Cambiar de persona'));
    await press(mom.tree, 'Viendo a Yo misma. Cambiar de persona');
    expect(texts(mom.tree)).toContain('Ver como…');
    expect(texts(mom.tree)).toContain('Inés Gil');
    expect(texts(mom.tree)).toContain('Ver todos los perfiles…');
    await press(mom.tree, 'Inés Gil');
    await until(() => has(mom.tree, 'Viendo a Inés Gil. Cambiar de persona'));
    // Sin hijos, la barra no se pinta.
    const none = await setup('memberNoKids', <ActiveProfileBar />);
    await wait(150);
    expect(texts(none.tree)).not.toContain('Viendo a');
  });
});

describe('la portada de familia', () => {
  it('el familiar a secas con dos hijos: «Tus pagos», sus hijos con «Ver su ficha», y nada de Eventos', async () => {
    const { tree } = await setup('family', <MemberHome />);
    await until(() => texts(tree).includes('Tus pagos'));
    const t = texts(tree);
    expect(t).toContain('Hola, Marta 👋');
    expect(t).toContain('Aquí están tus datos y lo que se cobra de tu cuenta.');
    expect(t).toContain('A quién tienes a tu cargo');
    expect(t).toContain('Tus pagos y recibos, con su estado.');
    expect(t).not.toContain('Eventos');
    expect(t).not.toContain('Mis inscripciones');
    expect(has(tree, 'Lucía Messeguer. Ver su ficha')).toBe(true);
    expect(t).toContain('Mis datos');
    // Con dos hijos y sin haber elegido, la barra «Viendo a» sale (con ella misma).
    expect(has(tree, 'Viendo a Yo misma. Cambiar de persona')).toBe(true);
  });

  it('un miembro sin hijos: las cinco secciones, sin barra y con «Mis datos»', async () => {
    const { tree } = await setup('memberNoKids', <MemberHome />);
    await until(() => texts(tree).includes('Actividades'));
    const t = texts(tree);
    for (const s of [
      'Eventos',
      'Mis inscripciones',
      'Calendario',
      'Pagos',
      'Documentos',
      'Mis datos',
    ])
      expect(t).toContain(s);
    expect(t).toContain('Tu espacio personal. Elige una sección para empezar.');
    expect(t).not.toContain('Viendo a');
    expect(t).not.toContain('A quién tienes a tu cargo');
  });

  it('con un solo hijo entra viéndolo: «Inscripciones», «Datos de Nicolás» y su nombre en la barra', async () => {
    const { tree } = await setup('familyOne', <MemberHome />);
    await until(() => texts(tree).includes('Datos de Nicolás'));
    const t = texts(tree);
    expect(t).toContain(
      'Aquí ves los datos de Nicolás y le inscribes a las actividades.',
    );
    expect(t).toContain('Inscripciones');
    expect(t).not.toContain('Mis inscripciones');
    expect(has(tree, 'Viendo a Nicolás Soler. Cambiar de persona')).toBe(true);
  });

  it('la monitora con una hija: «Mis datos de monitor» viéndose a sí misma, y debajo de lo del equipo no sale el saludo', async () => {
    const { tree } = await setup('monitorMom', <MemberHome />);
    await until(() => texts(tree).includes('Mis datos de monitor'));
    const emb = await mount(<MemberHome embedded />);
    await until(() => texts(emb.tree).includes('Actividades'));
    expect(texts(emb.tree)).not.toContain('Hola, Laura');
  });

  it('el saludo se oculta con su × y se recuerda por persona', async () => {
    const be = memoryBackend();
    const first = await setup('memberNoKids', <MemberHome />, be);
    await until(() => texts(first.tree).includes('Hola, Jaime'));
    await press(first.tree, 'Ocultar el saludo (volverá dentro de un mes)');
    expect(texts(first.tree)).not.toContain('Hola, Jaime');
    await wait(50);
    const saved = be.dump()[`@comunica/${first.me.personId}/home`];
    expect(JSON.parse(saved!).greetingHiddenUntil).toBeGreaterThan(Date.now());
    await act(async () => {
      first.tree.unmount();
    });
    const again = await mount(<MemberHome />);
    await until(() => texts(again.tree).includes('Actividades'));
    expect(texts(again.tree)).not.toContain('Hola, Jaime');
  });

  it('si el CRM no contesta a los hijos, debajo de lo del equipo no sale nada (y no rompe la portada)', async () => {
    const { fake, tree } = await setup('monitorMom', <MemberHome embedded />);
    await until(() => texts(tree).includes('Actividades'));
    const down = await (async () => {
      fake.setControls({ profilesDown: true });
      await act(async () => {
        tree.unmount();
      });
      return mount(<MemberHome embedded />);
    })();
    await wait(200);
    expect(texts(down.tree)).not.toContain('Actividades');
  });
});

describe('«hay que elegir» en los enlaces (FAM-a1)', () => {
  it('solo familiar con dos hijos que no ha elegido: sí para un evento o un pago; no para otra cosa', async () => {
    await setup('family', <></>);
    expect(
      await mustPickProfileFirst({ internalpage: 'single_stic_events' }),
    ).toBe(true);
    expect(
      await mustPickProfileFirst({ internalpage: 'list_stic_payments' }),
    ).toBe(true);
    expect(
      await mustPickProfileFirst({ internalpage: 'single_stic_pasar_lista' }),
    ).toBe(false);
  });
  it('con la elección hecha a un hijo, pasa; a sí misma, un evento (que no es suyo) vuelve a preguntar y un pago, no', async () => {
    const be = memoryBackend();
    const { me } = await setup('family', <></>, be);
    await be.setItem(
      `@comunica/${me.personId}/profile`,
      JSON.stringify({ activeId: 'f-hijo-lucia', chosen: true }),
    );
    expect(
      await mustPickProfileFirst({ internalpage: 'single_stic_events' }),
    ).toBe(false);
    await be.setItem(
      `@comunica/${me.personId}/profile`,
      JSON.stringify({ activeId: me.personId, chosen: true }),
    );
    expect(
      await mustPickProfileFirst({ internalpage: 'single_stic_events' }),
    ).toBe(true);
    expect(
      await mustPickProfileFirst({ internalpage: 'list_stic_payments' }),
    ).toBe(false);
  });
  it('un miembro, quien tiene un solo hijo o quien no tiene hijos, nunca pregunta; sin conexión, tampoco', async () => {
    for (const persona of [
      'memberNoKids',
      'familyOne',
      'familyNone',
      'monitorMom',
    ] as const) {
      await setup(persona, <></>);
      expect({
        persona,
        pick: await mustPickProfileFirst({
          internalpage: 'single_stic_events',
        }),
      }).toEqual({ persona, pick: false });
    }
    const { fake } = await setup('family', <></>);
    fake.setControls({ profilesDown: true });
    expect(
      await mustPickProfileFirst({ internalpage: 'single_stic_events' }),
    ).toBe(false);
  });
});
