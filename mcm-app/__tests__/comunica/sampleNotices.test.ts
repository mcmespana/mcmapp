// Plan 08, tarea 5: «Simular aviso» del Laboratorio Alpha. Cada tipo da un
// `data` del contrato, con ids del servidor falso, que lleva a su pantalla.

import { ComunicaPushData } from '@/services/comunica/contract';
import { createFakeServer } from '@/services/comunica/fake';
import { sampleNoticeData } from '@/services/comunica/sampleNotices';
import { routeForComunicaNotice } from '@/utils/comunica/noticeRoutes';

const SATURDAY_17 = new Date('2026-10-24T15:00:00Z');

describe('sampleNoticeData', () => {
  const fake = createFakeServer({ latencyMs: 0 });

  it('«¿Has pasado lista?» → marcar un grupo suyo en una sesión pasada', () => {
    const data = sampleNoticeData(fake, 'rollcall_due', SATURDAY_17);
    expect(ComunicaPushData.safeParse(data).success).toBe(true);
    const group = fake.data.groups.find((g) => g.id === data.groupId)!;
    expect(group).toBeDefined();
    const session = fake.data.sessions.find((s) => s.id === data.sessionId)!;
    expect(session.date <= '2026-10-24').toBe(true);
    expect(routeForComunicaNotice(data, { nativeOn: true }).pathname).toBe(
      '/comunica/pasar-lista/[groupId]',
    );
  });

  it('«Novedades» → la ficha del grupo; «Listas sin subir» → la portada', () => {
    const changed = sampleNoticeData(fake, 'group_changed');
    expect(ComunicaPushData.safeParse(changed).success).toBe(true);
    expect(routeForComunicaNotice(changed, { nativeOn: true }).pathname).toBe(
      '/comunica/grupos/[groupId]',
    );
    const outbox = sampleNoticeData(fake, 'outbox_pending');
    expect(routeForComunicaNotice(outbox, { nativeOn: true })).toEqual({
      pathname: '/comunica',
    });
  });
});
