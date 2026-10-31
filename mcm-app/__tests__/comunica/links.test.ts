import fs from 'fs';
import path from 'path';
import {
  classifyComunicaLink,
  decideLegacyNavigation,
  destinationQuery,
  nativeHrefFor,
  parseDestination,
  PLUGIN_PAGES,
  publicPageUrl,
} from '@/services/comunica/links';
import { redirectSystemPath } from '@/app/+native-intent';
import {
  consumePendingNativeLink,
  subscribeNativeLink,
} from '@/services/comunica/pendingLink';
import {
  consumePendingComunicaAuthUrl,
  setPendingComunicaAuthUrl,
} from '@/utils/pendingComunicaLink';

const O = 'https://comunica.movimientoconsolacion.com';

// Copia de `pages/` del plugin (comunicaAreaPrivada) a 24/10/2026. Si el
// plugin estrena una página, se añade aquí y a `PLUGIN_PAGES`.
const PLUGIN_PAGE_FILES = [
  'custom_html',
  'list_stic_attendances',
  'list_stic_documents',
  'list_stic_events',
  'list_stic_payment_commitments',
  'list_stic_payments',
  'list_stic_registrations',
  'list_stic_sessions',
  'single_stic_activities_calendar',
  'single_stic_comunica_laico',
  'single_stic_comunica_monitor',
  'single_stic_comunica_perfil',
  'single_stic_coordinacion',
  'single_stic_documents',
  'single_stic_events',
  'single_stic_home',
  'single_stic_mis_grupos',
  'single_stic_pasar_lista',
  'single_stic_pasar_lista_evento',
  'single_stic_pasar_lista_ficha',
  'single_stic_pasar_lista_grupos',
  'single_stic_pasar_lista_marcar',
  'single_stic_pasar_lista_monitor',
  'single_stic_pasar_lista_monitores',
  'single_stic_pasar_lista_resumen',
  'single_stic_pasar_lista_reuniones',
  'single_stic_password_change',
  'single_stic_payment_commitments',
  'single_stic_payment_error',
  'single_stic_payment_form',
  'single_stic_payments',
  'single_stic_profile',
  'single_stic_profile_selection',
  'single_stic_registrations',
  'single_stic_sessions',
  'single_stic_tutor_profile',
  'single_stic_unsubscribe',
];

afterEach(() => {
  consumePendingNativeLink();
  consumePendingComunicaAuthUrl();
});

describe('mapa de páginas', () => {
  it('cubre todas las páginas del plugin', () => {
    expect(PLUGIN_PAGE_FILES.filter((p) => !(p in PLUGIN_PAGES))).toEqual([]);
  });
  it('las desactivadas van a «Tu cuenta», nunca a un error', () => {
    expect(
      nativeHrefFor({ internalpage: 'single_stic_password_change' }),
    ).toEqual({ pathname: '/comunica/yo' });
  });
  it('Grupos y fichas y la ficha son nativas (plan 05)', () => {
    expect(nativeHrefFor({ internalpage: 'single_stic_mis_grupos' })).toEqual({
      pathname: '/comunica/grupos',
    });
    expect(
      nativeHrefFor({
        internalpage: 'single_stic_pasar_lista_ficha',
        id: 'abc12345-ff',
      }),
    ).toEqual({
      pathname: '/comunica/grupos/persona/[personId]',
      params: { personId: 'abc12345-ff' },
    });
    expect(
      nativeHrefFor({ internalpage: 'single_stic_pasar_lista_ficha' }),
    ).toEqual({ pathname: '/comunica/grupos' });
  });
  it('destino con las formas del plugin', () => {
    expect(
      parseDestination({
        internalpage: 'single_stic_events',
        action: 'detail',
        id: 'abc12345-ff',
        from: 'list',
        x: 'y',
      }),
    ).toEqual({
      internalpage: 'single_stic_events',
      action: 'detail',
      id: 'abc12345-ff',
      from: 'list',
    });
    expect(
      parseDestination({
        internalpage: 'single_stic_events',
        action: 'borrar',
        id: '<script>',
      }),
    ).toEqual({ internalpage: 'single_stic_events' });
    expect(parseDestination({ internalpage: '../../etc' })).toBeNull();
    expect(destinationQuery({ internalpage: 'a_b', id: '0123456789' })).toBe(
      'internalpage=a_b&id=0123456789',
    );
  });
});

describe('qué es cada enlace', () => {
  it('entrar con el enlace del correo nativo', () => {
    expect(classifyComunicaLink(`${O}/app/acceso?acceso_app=abc`)).toEqual({
      kind: 'appAccess',
      linkToken: 'abc',
    });
  });
  it('página con token y destino', () => {
    expect(
      classifyComunicaLink(
        `${O}/ap/?acceso_magico=Zm9v&internalpage=list_stic_payments`,
      ),
    ).toEqual({
      kind: 'page',
      destination: { internalpage: 'list_stic_payments' },
      auth: { magic: 'Zm9v', token: undefined },
    });
    expect(
      classifyComunicaLink(`${O}/?internalpage=single_stic_home`),
    ).toMatchObject({ kind: 'page' });
  });
  it('actividad pública y resto del dominio', () => {
    expect(
      classifyComunicaLink(`${O}/actividades/?e=convivencia-otono`),
    ).toEqual({ kind: 'event', slug: 'convivencia-otono' });
    expect(classifyComunicaLink(`${O}/formulario-alta/?x=1`)).toEqual({
      kind: 'other',
      url: `${O}/formulario-alta/`,
    });
  });
  it('lo raro no se carga', () => {
    expect(
      classifyComunicaLink('https://malo.example/ap/?internalpage=x'),
    ).toBeNull();
    expect(classifyComunicaLink('javascript:alert(1)')).toBeNull();
    expect(
      classifyComunicaLink(`${O}/ap/?acceso_magico=<script>`),
    ).toMatchObject({ auth: null });
    expect(classifyComunicaLink(`${O}/%22onload%3D/`)).toEqual({
      kind: 'other',
      url: `${O}/`,
    });
    // Rutas de la propia app: no se secuestran.
    expect(classifyComunicaLink('/notifications')).toBeNull();
  });
});

describe('enlaces que llegan (+native-intent)', () => {
  it('una página del área con destino: al tab, para los dos modos', () => {
    expect(
      redirectSystemPath({
        path: `${O}/ap/?internalpage=list_stic_payments`,
        initial: true,
      }),
    ).toBe('/(tabs)/comunica');
    expect(consumePendingNativeLink()).toMatchObject({ kind: 'page' });
    expect(consumePendingComunicaAuthUrl()).toBe(
      `${O}/ap/?internalpage=list_stic_payments&app=1`,
    );
  });
  it('el acceso_magico sigue llegando a la WebView como hoy', () => {
    redirectSystemPath({
      path: `${O}/app/acceso?acceso_magico=XYZ`,
      initial: true,
    });
    expect(consumePendingComunicaAuthUrl()).toBe(
      `${O}/ap/?acceso_magico=XYZ&app=1`,
    );
  });
  it('acceso_app solo al área nativa', () => {
    redirectSystemPath({
      path: `${O}/app/acceso?acceso_app=tok`,
      initial: true,
    });
    expect(consumePendingNativeLink()).toEqual({
      kind: 'appAccess',
      linkToken: 'tok',
    });
    expect(consumePendingComunicaAuthUrl()).toBeNull();
  });
});

describe('con la app ya abierta en el área nativa', () => {
  it('el hueco del legado no se queda con el token (se rellena antes)', () => {
    // El manejador nativo vacía el hueco del legado nada más llegar, como
    // `useComunicaLinks`.
    const seen: string[] = [];
    const off = subscribeNativeLink((l) => {
      seen.push(l.kind);
      consumePendingComunicaAuthUrl();
    });
    redirectSystemPath({
      path: `${O}/ap/?token=abcDEF123&internalpage=list_stic_payments`,
      initial: false,
    });
    off();
    expect(seen).toEqual(['page']);
    expect(consumePendingComunicaAuthUrl()).toBeNull();
  });

  it('el hueco del legado caduca a los 2 minutos', () => {
    const now = Date.now();
    const spy = jest.spyOn(Date, 'now').mockReturnValue(now);
    setPendingComunicaAuthUrl(`${O}/ap/?token=abc&app=1`);
    spy.mockReturnValue(now + 2 * 60_000 + 1);
    expect(consumePendingComunicaAuthUrl()).toBeNull();
    spy.mockRestore();
  });

  it('la actividad pública se abre en web.tsx (antes caía en el portal entero)', () => {
    expect(
      publicPageUrl(classifyComunicaLink(`${O}/actividades/?e=foro-2026`)),
    ).toBe(`${O}/actividades/?e=foro-2026`);
    expect(publicPageUrl(classifyComunicaLink(`${O}/formularios/x`))).toBe(
      `${O}/formularios/x`,
    );
    expect(
      publicPageUrl(
        classifyComunicaLink(`${O}/ap/?internalpage=list_stic_payments`),
      ),
    ).toBeNull();
  });
});

describe('dentro del legado', () => {
  it('lo nativo se abre en nativo; lo ajeno, fuera', () => {
    expect(
      decideLegacyNavigation(
        `${O}/ap/?internalpage=single_stic_password_change`,
      ),
    ).toEqual({ allow: false, native: { pathname: '/comunica/yo' } });
    expect(
      decideLegacyNavigation(`${O}/ap/?internalpage=list_stic_payments`),
    ).toEqual({ allow: true });
    expect(decideLegacyNavigation('https://redsys.es/pago')).toEqual({
      allow: false,
      external: 'https://redsys.es/pago',
    });
  });
});

// Guardarraíl (plan 10 §7): nadie abre la WebView del legado por su cuenta:
// todo pasa por la puerta, `web.tsx` o el stack de «Más» de siempre.
it('solo la puerta, web.tsx y Más importan ComunicaScreen', () => {
  const root = path.join(__dirname, '..', '..');
  const walk = (d: string): string[] =>
    fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => {
      const p = path.join(d, e.name);
      if (e.isDirectory()) return e.name === 'node_modules' ? [] : walk(p);
      return /\.tsx?$/.test(e.name) ? [p] : [];
    });
  const users = ['app', 'components', 'hooks']
    .flatMap((d) => walk(path.join(root, d)))
    .filter((f) =>
      /screens\/ComunicaScreen['"]/.test(fs.readFileSync(f, 'utf8')),
    )
    .map((f) => path.relative(root, f).split(path.sep).join('/'))
    .sort();
  expect(users).toEqual([
    'app/(tabs)/comunica/index.tsx',
    'app/(tabs)/comunica/web.tsx',
    'app/(tabs)/mas/comunica.tsx',
  ]);
});
