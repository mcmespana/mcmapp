// Plan 08, tarea 4: a dónde lleva un aviso del área (puro) y el guardarraíl de
// que cada destino existe como pantalla.

import fs from 'fs';
import path from 'path';
import {
  isComunicaNotice,
  NOTICE_PATHNAMES,
  parseComunicaNotice,
  queriesForNotice,
  routeForComunicaNotice,
} from '@/utils/comunica/noticeRoutes';

const ID = 'comunica:3b241101-e2bb-4255-8caf-000000000001';
const notice = (patch: Record<string, unknown> = {}) => ({
  source: 'comunica',
  v: 1,
  id: ID,
  type: 'rollcall_due',
  groupId: 'f-grp-c1',
  sessionId: 'f-ses-2026-10-24',
  ...patch,
});
const ON = { nativeOn: true };
const HOME = { pathname: '/comunica' };

describe('routeForComunicaNotice', () => {
  it('«¿Has pasado lista?» → marcar ese grupo en esa sesión', () => {
    expect(routeForComunicaNotice(notice(), ON)).toEqual({
      pathname: '/comunica/pasar-lista/[groupId]',
      params: { groupId: 'f-grp-c1', sesion: 'f-ses-2026-10-24' },
    });
    // Sin sesión, la que proponga la regla de la pantalla.
    expect(
      routeForComunicaNotice(notice({ sessionId: undefined }), ON),
    ).toEqual({
      pathname: '/comunica/pasar-lista/[groupId]',
      params: { groupId: 'f-grp-c1' },
    });
  });

  it('«Novedades en tu grupo» → la ficha del grupo', () => {
    expect(
      routeForComunicaNotice(notice({ type: 'group_changed' }), ON),
    ).toEqual({
      pathname: '/comunica/grupos/[groupId]',
      params: { groupId: 'f-grp-c1' },
    });
  });

  it('«Listas sin subir» → la portada', () => {
    expect(
      routeForComunicaNotice(notice({ type: 'outbox_pending' }), ON),
    ).toEqual(HOME);
  });

  it('tipo o versión desconocidos, ids raros o sin grupo → la portada', () => {
    for (const bad of [
      notice({ type: 'nuevo_tipo' }),
      notice({ v: 2 }),
      notice({ groupId: '../../../etc/passwd' }),
      notice({ groupId: 'a b' }),
      notice({ sessionId: 'x'.repeat(200) }),
      notice({ groupId: undefined }),
      notice({ type: 'group_changed', groupId: undefined }),
      notice({ id: 'panel-123' }),
      null,
      'comunica',
      {},
    ]) {
      expect(routeForComunicaNotice(bad, ON)).toEqual(HOME);
    }
  });

  it('nunca navega a una ruta que venga en el aviso', () => {
    const r = routeForComunicaNotice(
      notice({ internalRoute: '/(tabs)/fotos', route: '/wordle' }),
      ON,
    );
    expect(r.pathname).toBe('/comunica/pasar-lista/[groupId]');
  });

  it('con el área nativa apagada, todo va a la pestaña (la WebView)', () => {
    for (const type of ['rollcall_due', 'group_changed', 'outbox_pending']) {
      expect(
        routeForComunicaNotice(notice({ type }), { nativeOn: false }),
      ).toEqual(HOME);
    }
  });
});

describe('isComunicaNotice y parseComunicaNotice', () => {
  it('distingue los del área de los del Panel', () => {
    expect(isComunicaNotice(notice())).toBe(true);
    expect(isComunicaNotice({ id: 'x', category: 'eventos' })).toBe(false);
    expect(isComunicaNotice(undefined)).toBe(false);
    // De Comunica pero de otra versión: es suyo (no va a la campana) aunque
    // no se pueda leer.
    expect(isComunicaNotice(notice({ v: 9 }))).toBe(true);
    expect(parseComunicaNotice(notice({ v: 9 }))).toBeNull();
  });
});

describe('queriesForNotice', () => {
  it('refresca la portada y, con novedades, el grupo', () => {
    expect(queriesForNotice(parseComunicaNotice(notice())!)).toContainEqual([
      'pasar-lista',
      'today',
    ]);
    expect(
      queriesForNotice(parseComunicaNotice(notice({ type: 'group_changed' }))!),
    ).toContainEqual(['grupos', 'group', 'f-grp-c1']);
    expect(
      queriesForNotice(
        parseComunicaNotice(notice({ type: 'outbox_pending' }))!,
      ),
    ).toEqual([]);
  });
});

describe('guardarraíl: cada destino de un aviso es una pantalla que existe', () => {
  const APP = path.join(__dirname, '..', '..', 'app', '(tabs)');
  const candidates = (pathname: string) => {
    const rel = pathname.replace(/^\//, '');
    return [path.join(APP, `${rel}.tsx`), path.join(APP, rel, 'index.tsx')];
  };

  it.each(NOTICE_PATHNAMES.map((p) => [p]))('%s', (pathname) => {
    expect(candidates(pathname).some((f) => fs.existsSync(f))).toBe(true);
  });
});
