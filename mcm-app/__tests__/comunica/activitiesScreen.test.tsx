/**
 * Eventos y su ficha con el CABLEADO REAL (plan 13): el proveedor del área, «a quién se ve», los hooks y el servidor falso.
 *
 *   · «Eventos»: los dos bloques con sus títulos, lo pasado fuera, lo oculto sin plaza fuera, «Inscribirme» / «Mi inscripción» al pie.
 *   · La ficha: «Toda la información» con el cuerpo, los datos, el mapa, los adjuntos; las cinco salidas de la acción; la de otra delegación
 *     explica el motivo y no tiene «Inscribirme»; lo oculto por enlace deja apuntarse; cambiar de hijo deja la misma ficha con otro perfil.
 *   · Sin conexión «Inscribirme» no hace nada y lo dice. El enlace de la página pública va a la ficha.
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
jest.mock('expo-image', () => {
  const Image = () => null;
  Image.clearDiskCache = jest.fn().mockResolvedValue(true);
  Image.clearMemoryCache = jest.fn().mockResolvedValue(true);
  return { Image };
});
jest.mock('expo-web-browser', () => ({ openBrowserAsync: jest.fn() }));
jest.mock('expo-linking', () => ({ openURL: jest.fn() }));
jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn() }));
const mockOpenLegacy = jest.fn();
jest.mock('@/hooks/comunica/useOpenLegacy', () => ({
  useOpenLegacy: () => mockOpenLegacy,
}));
const mockOpenFile = jest.fn();
jest.mock('@/services/comunica/eventFiles', () => ({
  openEventFile: (...a: unknown[]) => mockOpenFile(...a),
}));

import ComunicaAreaProvider from '@/components/comunica/comun/ComunicaAreaProvider';
import ActivitiesScreen from '@/components/comunica/actividades/ActivitiesScreen';
import ActivityBridgeScreen from '@/components/comunica/actividades/ActivityBridgeScreen';
import EventDetailScreen from '@/components/comunica/actividades/EventDetailScreen';
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
const NO_NAME = 'f-hijo-sin-nombre';
const detail = (id: string) => <EventDetailScreen eventId={id} />;

describe('«Eventos»', () => {
  it('los dos bloques con sus títulos; lo pasado y lo oculto sin plaza, fuera', async () => {
    const { tree } = await setup('family', <ActivitiesScreen />, {
      activeId: LUCIA,
    });
    await until(() => texts(tree).includes('Convivencia COM'));
    const t = texts(tree);
    expect(t).toContain('Para apuntarte');
    expect(t).toContain('Te has apuntado');
    expect(t.indexOf('Para apuntarte')).toBeLessThan(
      t.indexOf('Te has apuntado'),
    );
    // Lo apuntado, aunque sea oculto o rechazado.
    expect(t).toContain('Sesiones semanales MIC 4.º-6.º EP');
    expect(t).toContain('Retiro de confirmación');
    expect(t).toContain('Rechazada');
    // Lo pasado, lo oculto sin plaza y lo que no es para ella.
    for (const out of [
      'Día de la familia',
      'Reunión reservada',
      'Encuentro de Burriana',
      'Formación de monitores',
      'Excursión de 5.º de Primaria',
    ])
      expect(t).not.toContain(out);
    // Acaba hoy: sigue.
    expect(t).toContain('Triduo de hoy');
  });

  it('el chip y las fechas en palabras; el plazo cerrado no se repite', async () => {
    const { tree } = await setup('family', <ActivitiesScreen />, {
      activeId: LUCIA,
    });
    await until(() => texts(tree).includes('Convivencia COM'));
    const t = texts(tree);
    expect(t).toContain('del');
    expect(t).toContain('Inscripción cerrada');
    expect(t).toContain('Inscripción no abierta');
    expect(t).toContain('Con plaza');
  });

  it('tocar la tarjeta abre la ficha; «Inscribirme» y «Mi inscripción» van a sus pantallas nativas (plan 14)', async () => {
    const { tree } = await setup('family', <ActivitiesScreen />, {
      activeId: LUCIA,
    });
    await until(() => has(tree, 'Inscribirme: Convivencia COM'));
    await press(tree, 'Inscribirme: Convivencia COM');
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: '/comunica/actividades/[eventId]/inscribirme',
      params: { eventId: 'pev-convi' },
    });
    await press(tree, 'Mi inscripción: Sesiones semanales MIC 4.º-6.º EP');
    expect(mockRouter.push).toHaveBeenLastCalledWith({
      pathname: '/comunica/inscripciones/[registrationId]',
      params: { registrationId: 'reg-lucia-sesiones' },
    });
    const open = labelled(tree, 'Abre la actividad');
    expect(open.length).toBe(0);
    const card = tree.root.findAll(
      (n) =>
        n.props.accessibilityHint === 'Abre la actividad' &&
        typeof n.props.onPress === 'function',
    )[0];
    await act(async () => {
      card.props.onPress();
    });
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: '/comunica/actividades/[eventId]',
      params: { eventId: expect.any(String) },
    });
  });

  it('fuera de plazo o cerrado no hay «Inscribirme»', async () => {
    const { tree } = await setup('family', <ActivitiesScreen />, {
      activeId: LUCIA,
    });
    await until(() => texts(tree).includes('Pascua joven'));
    expect(has(tree, 'Inscribirme: Pascua joven')).toBe(false);
    expect(has(tree, 'Inscribirme: Jornada de puertas abiertas')).toBe(false);
    expect(has(tree, 'Inscribirme: Triduo de hoy')).toBe(false);
  });

  it('sin conexión (con lo guardado) «Inscribirme» no hace nada y lo dice', async () => {
    const { tree, fake, qc } = await setup('family', <ActivitiesScreen />, {
      activeId: LUCIA,
    });
    await until(() => has(tree, 'Inscribirme: Convivencia COM'));
    fake.setControls({ offline: true });
    await act(async () => {
      await qc.refetchQueries({ queryKey: ['comunica', 'activities'] });
    });
    await until(() => texts(tree).includes('Sin conexión'));
    await press(tree, 'Inscribirme: Convivencia COM');
    expect(mockOpenLegacy).not.toHaveBeenCalled();
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ label: 'Necesitas conexión para apuntarte' }),
    );
  });

  it('sin nada que enseñar: el vacío con su salida a «Inscripciones»', async () => {
    const { tree, fake } = await setup('family', <ActivitiesScreen />, {
      activeId: LUCIA,
    });
    await until(() => texts(tree).includes('Convivencia COM'));
    await act(async () => {
      tree.unmount();
    });
    (fake as { getProfileActivities: unknown }).getProfileActivities =
      async () => ({
        generatedAt: '2026-11-01T10:00:00Z',
        toSignUp: [],
        signedUp: [],
      });
    const again = await setup('family', <ActivitiesScreen />, {
      activeId: LUCIA,
    });
    (again.fake as { getProfileActivities: unknown }).getProfileActivities =
      async () => ({
        generatedAt: '2026-11-01T10:00:00Z',
        toSignUp: [],
        signedUp: [],
      });
    await act(async () => {
      await again.qc.refetchQueries({ queryKey: ['comunica', 'activities'] });
    });
    await until(() =>
      texts(again.tree).includes('No hay actividades próximas ahora mismo'),
    );
    expect(texts(again.tree)).toContain('Ver mis inscripciones');
  });
});

describe('la ficha', () => {
  it('con información de la web: todo en su sitio', async () => {
    const { tree } = await setup('family', detail('pev-convi'), {
      activeId: LUCIA,
    });
    await until(() => texts(tree).includes('Toda la información'));
    const t = texts(tree);
    expect(t).toContain('Convivencia COM');
    expect(t).toContain('Un fin de semana para convivir');
    expect(t).toContain('3 días');
    expect(t).toContain('Hasta el');
    expect(t).toContain('Casa de colonias El Pinar');
    expect(t).toContain('Sábado 10:00 a domingo 18:00');
    expect(t).toContain('60 plazas');
    expect(t).toContain('45 €');
    // El cuerpo: títulos, párrafo, aviso, listas, botones, vídeo, pie de foto.
    for (const s of [
      'Qué vamos a hacer',
      'Qué llevar',
      'Las plazas son limitadas',
      'Saco y esterilla',
      'Mejor de cabeza',
      'Llegada y acogida',
      'El año pasado',
      'Ver el vídeo',
      'Más información',
    ])
      expect(t).toContain(s);
    expect(t).toContain('PDF');
    expect(t).not.toContain('Sobre esta actividad');
    expect(has(tree, 'Ver la página pública de la actividad')).toBe(true);
    expect(has(tree, 'Ver en el mapa: Casa de colonias El Pinar')).toBe(true);
  });

  it('el cuerpo: un teléfono llama, un correo escribe, un documento y un adjunto se abren con sesión', async () => {
    const { Linking } = require('react-native');
    const spy = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    const { tree } = await setup('family', detail('pev-convi'), {
      activeId: LUCIA,
    });
    await until(() => texts(tree).includes('Toda la información'));
    const links = tree.root.findAll(
      (n) =>
        n.props.accessibilityRole === 'link' &&
        typeof n.props.onPress === 'function' &&
        n.type === Text,
    );
    const by = (s: string) => links.find((l) => plain(l).includes(s))!;
    await act(async () => {
      by('600 111 222').props.onPress();
    });
    expect(spy).toHaveBeenCalledWith('tel:+34600111222');
    await act(async () => {
      by('comunica@movimientoconsolacion.com').props.onPress();
    });
    expect(spy).toHaveBeenCalledWith(
      'mailto:comunica@movimientoconsolacion.com',
    );
    await press(tree, 'Autorización de salida');
    await until(() => mockOpenFile.mock.calls.length === 1);
    expect(mockOpenFile.mock.calls[0][0]).toMatchObject({
      uri: expect.stringContaining('data:image/svg+xml'),
    });
    await press(tree, 'Autorización de salida. PDF');
    await until(() => mockOpenFile.mock.calls.length === 2);
    expect(mockOpenFile.mock.calls[1][1]).toBe('Autorización de salida');
    spy.mockRestore();
  });

  it('sin información de la web: «Sobre esta actividad» con la descripción, nunca las dos', async () => {
    const { tree } = await setup('family', detail('pev-sinc'), {
      activeId: LUCIA,
    });
    await until(() => texts(tree).includes('Sobre esta actividad'));
    expect(texts(tree)).toContain('Primera merienda del curso.');
    expect(texts(tree)).not.toContain('Toda la información');
    // Plazas 0 y precio 0 no salen.
    expect(texts(tree)).not.toContain('0 plazas');
    expect(texts(tree)).not.toContain('0 €');
  });

  it('abierta: «Inscribirme en esta actividad», la única principal; lleva al alta corta', async () => {
    const { tree } = await setup('family', detail('pev-convi'), {
      activeId: LUCIA,
    });
    await until(() => has(tree, 'Inscribirme en esta actividad'));
    await press(tree, 'Inscribirme en esta actividad');
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: '/comunica/actividades/[eventId]/inscribirme',
      params: { eventId: 'pev-convi' },
    });
  });

  it('con formulario avanzado: la nota de que se abre con sus datos', async () => {
    const { tree } = await setup('family', detail('pev-fwa'), {
      activeId: LUCIA,
    });
    await until(() =>
      texts(tree).includes(
        'La inscripción se hace en el formulario de la actividad',
      ),
    );
  });

  it('de otra delegación: el motivo, «Ver otras actividades» y NADA de «Inscribirme»', async () => {
    const { tree } = await setup('family', detail('pev-otra-del'), {
      activeId: LUCIA,
    });
    await until(() => texts(tree).includes('Esta actividad no es para ti'));
    expect(texts(tree)).toContain(
      'Esta actividad es solo para la delegación de Burriana.',
    );
    expect(has(tree, 'Inscribirme en esta actividad')).toBe(false);
    await press(tree, 'Ver otras actividades');
    expect(mockRouter.replace).toHaveBeenCalledWith('/comunica/actividades');
  });

  it('fuera de plazo: «La inscripción no está abierta» con la fecha; sin botón principal', async () => {
    const { tree } = await setup('family', detail('pev-no-abre'), {
      activeId: LUCIA,
    });
    await until(() => texts(tree).includes('La inscripción no está abierta'));
    expect(texts(tree)).toContain('La inscripción se abre el');
    expect(has(tree, 'Inscribirme en esta actividad')).toBe(false);
    const c = await setup('family', detail('pev-cerrada'), { activeId: LUCIA });
    await until(() =>
      texts(c.tree).includes('El plazo de inscripción terminó el'),
    );
  });

  it('con plaza: «Lucía ya tiene una inscripción» y «Ver su inscripción» va DIRECTO a la inscripción', async () => {
    const { tree } = await setup('family', detail('pev-sesiones'), {
      activeId: LUCIA,
    });
    await until(() =>
      texts(tree).includes(
        'Lucía ya tiene una inscripción para esta actividad.',
      ),
    );
    expect(has(tree, 'Inscribirme en esta actividad')).toBe(false);
    await press(tree, 'Ver su inscripción');
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: '/comunica/inscripciones/[registrationId]',
      params: { registrationId: 'reg-lucia-sesiones' },
    });
  });

  it('ya celebrada: «Esta actividad ya se ha celebrado.»', async () => {
    const { tree } = await setup('family', detail('pev-pasada'), {
      activeId: LUCIA,
    });
    await until(() =>
      texts(tree).includes('Esta actividad ya se ha celebrado.'),
    );
    expect(texts(tree)).toContain('Ya celebrado');
    expect(has(tree, 'Inscribirme en esta actividad')).toBe(false);
  });

  it('lo oculto sin plaza, abierto por enlace, deja apuntarse', async () => {
    const { tree } = await setup('family', detail('pev-oculta-sin'), {
      activeId: NO_NAME,
    });
    await until(() => has(tree, 'Inscribirme en esta actividad'));
  });

  it('un evento que ya no existe: «Esta actividad ya no está disponible» con salida', async () => {
    const { tree } = await setup('family', detail('nope'), { activeId: LUCIA });
    await until(() =>
      texts(tree).includes('Esta actividad ya no está disponible'),
    );
    await pressText(tree, 'Ver eventos');
    expect(mockRouter.replace).toHaveBeenCalledWith('/comunica/actividades');
  });

  it('cambiar de hijo deja la misma ficha con el otro perfil', async () => {
    const { tree } = await setup('family', detail('pev-sesiones'), {
      activeId: LUCIA,
    });
    await until(() => texts(tree).includes('Lucía ya tiene una inscripción'));
    await press(tree, 'Viendo a Lucía Messeguer. Cambiar de persona');
    await press(tree, 'Participante');
    await until(() => has(tree, 'Inscribirme en esta actividad'));
    expect(texts(tree)).not.toContain('Lucía ya tiene una inscripción');
    // Se queda en la ficha: no vuelve a la portada.
    expect(mockRouter.replace).not.toHaveBeenCalledWith('/comunica');
  });

  it('sin conexión con lo guardado: «Inscribirme» apagado y dice por qué', async () => {
    const { tree, fake, qc } = await setup('family', detail('pev-convi'), {
      activeId: LUCIA,
    });
    await until(() => has(tree, 'Inscribirme en esta actividad'));
    fake.setControls({ offline: true });
    await act(async () => {
      await qc.refetchQueries({ queryKey: ['comunica', 'activities'] });
    });
    await until(() =>
      texts(tree).includes('Necesitas conexión para apuntarte'),
    );
    await press(tree, 'Inscribirme en esta actividad');
    await wait(50);
    expect(mockOpenLegacy).not.toHaveBeenCalled();
  });
});

describe('el enlace público (`/actividades/?e=`)', () => {
  it('con sesión busca el evento con el perfil que se ve y va a su ficha (replace)', async () => {
    await setup('family', <ActivityBridgeScreen slug="convivencia-com" />, {
      activeId: LUCIA,
    });
    await until(() => mockRouter.replace.mock.calls.length > 0);
    expect(mockRouter.replace).toHaveBeenCalledWith({
      pathname: '/comunica/actividades/[eventId]',
      params: { eventId: 'pev-convi' },
    });
  });
  it('un slug que no existe: «Esta actividad ya no está disponible»', async () => {
    const { tree } = await setup(
      'family',
      <ActivityBridgeScreen slug="no-existe" />,
      { activeId: LUCIA },
    );
    await until(() =>
      texts(tree).includes('Esta actividad ya no está disponible'),
    );
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });
});

describe('guardarraíles', () => {
  it('ningún componente de actividades usa render-html ni WebView', () => {
    const fs = require('fs');
    const path = require('path');
    const dir = path.join(
      __dirname,
      '..',
      '..',
      'components/comunica/actividades',
    );
    for (const f of fs.readdirSync(dir)) {
      const src = fs.readFileSync(path.join(dir, f), 'utf8');
      expect(src).not.toMatch(
        /react-native-render-html|react-native-webview|dangerouslySetInnerHTML/,
      );
    }
  });
  it('los archivos y los documentId no pasan por el logger', () => {
    const fs = require('fs');
    const path = require('path');
    for (const f of [
      'services/comunica/eventFiles.ts',
      'hooks/comunica/useActivities.ts',
    ]) {
      const src = fs.readFileSync(path.join(__dirname, '..', '..', f), 'utf8');
      for (const m of src.match(/logger\.\w+\([^)]*\)/g) ?? [])
        expect(m).not.toMatch(/documentId|uri|source|src/);
    }
  });
});
