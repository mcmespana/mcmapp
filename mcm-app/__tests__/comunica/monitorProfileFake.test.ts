/**
 * «Mis datos de monitor» (plan 09, tarea 1): el contrato y el servidor falso.
 *
 *   · El `PATCH` es estricto: ni `files` ni claves desconocidas.
 *   · Sin papel de monitor, 403.
 *   · Lo guardado se vuelve a leer; lo que no cambia no se reescribe.
 *   · Subir pone el «archivo subido»; lo grande, vacío o HEIC, `validation`.
 *   · Con el CRM caído las escrituras fallan como `crm_unavailable`.
 */
import { createFakeServer } from '@/services/comunica/fake';
import { ComunicaApiError, createHttpClient } from '@/services/comunica/client';
import {
  MonitorProfile,
  MonitorProfileWrite,
  ROUTES,
} from '@/services/comunica/contract';
import { DOCUMENT_MAX_BYTES } from '@/utils/comunica/monitorProfile';

const CLIENT = (n: number) =>
  `3b241101-e2bb-4255-8caf-${String(n).padStart(12, '0')}`;
const server = (patch = {}) => createFakeServer({ latencyMs: 0, ...patch });
const pdf = (size = 1000, name = 'certificado.pdf') => ({
  uri: `file:///cache/${name}`,
  name,
  mimeType: name.endsWith('.pdf')
    ? 'application/pdf'
    : name.endsWith('.png')
      ? 'image/png'
      : name.endsWith('.heic')
        ? 'image/heic'
        : 'image/jpeg',
  size,
});

const code = async (p: Promise<unknown>) =>
  p.then(
    () => 'ok',
    (e: ComunicaApiError) => `${e.code}:${e.reason ?? ''}`,
  );

describe('contrato de Mis datos de monitor', () => {
  it('las rutas están en el catálogo con su persist', () => {
    expect(ROUTES.myMonitor).toMatchObject({
      method: 'GET',
      path: '/v1/me/monitor',
      persist: true,
    });
    expect(ROUTES.updateMyMonitor).toMatchObject({
      method: 'PATCH',
      persist: false,
    });
    expect(ROUTES.uploadMyDocument).toMatchObject({
      method: 'POST',
      path: '/v1/me/documents',
      persist: false,
    });
  });

  it('el PATCH no admite `files` ni claves desconocidas', () => {
    const ok = { clientId: CLIENT(1), changes: { monitorSince: 2019 } };
    expect(MonitorProfileWrite.safeParse(ok).success).toBe(true);
    expect(
      MonitorProfileWrite.safeParse({
        clientId: CLIENT(1),
        changes: { files: { mat: true } },
      }).success,
    ).toBe(false);
    expect(
      MonitorProfileWrite.safeParse({
        clientId: CLIENT(1),
        changes: { ajmcm_mat_c: 'titulado' },
      }).success,
    ).toBe(false);
    expect(MonitorProfileWrite.safeParse({ ...ok, extra: 1 }).success).toBe(
      false,
    );
    // El año, de cuatro cifras.
    expect(
      MonitorProfileWrite.safeParse({
        clientId: CLIENT(1),
        changes: { monitorSince: 19 },
      }).success,
    ).toBe(false);
  });
});

describe('servidor falso: Mis datos de monitor', () => {
  it('el monitor eligió «Manual» y no tiene certificado (el aviso)', async () => {
    const p = await server().getMyMonitorProfile();
    expect(MonitorProfile.safeParse(p).success).toBe(true);
    expect(p.sexOffenceCertificateMode).toBe('manual');
    expect(p.files.sexOffenceCertificate).toBe(false);
    expect(p.options.matCourses.length).toBeGreaterThan(0);
  });

  it('coordinación: «Automático» y con títulos', async () => {
    const p = await server({ persona: 'coordination' }).getMyMonitorProfile();
    expect(p.sexOffenceCertificateMode).toBe('automatic');
    expect(p.files.mat).toBe(true);
  });

  it('sin papel de monitor, 403', async () => {
    const s = server({ persona: 'accompaniment' });
    expect(await code(s.getMyMonitorProfile())).toBe('forbidden:');
    expect(
      await code(
        s.updateMyMonitorProfile({
          clientId: CLIENT(2),
          changes: { foodHandling: true },
        }),
      ),
    ).toBe('forbidden:');
  });

  it('guarda, se vuelve a leer y no reescribe lo que no cambia', async () => {
    const s = server();
    const before = s.writeCount;
    await s.updateMyMonitorProfile({
      clientId: CLIENT(3),
      changes: { monitorSince: 2019, matCourse: '2022', congresses: [] },
    });
    expect(s.writeCount).toBe(before + 1);
    const p = await s.getMyMonitorProfile();
    expect(p.monitorSince).toBe(2019);
    expect(p.matCourse).toBe('2022');
    expect(p.congresses).toEqual([]);
    // Lo mismo otra vez: nada que escribir.
    await s.updateMyMonitorProfile({
      clientId: CLIENT(4),
      changes: { monitorSince: 2019 },
    });
    expect(s.writeCount).toBe(before + 1);
    // El mismo `clientId`: no duplica.
    await s.updateMyMonitorProfile({
      clientId: CLIENT(3),
      changes: { monitorSince: 2000 },
    });
    expect((await s.getMyMonitorProfile()).monitorSince).toBe(2019);
  });

  it('rechaza un curso que no existe y una forma rota', async () => {
    const s = server();
    expect(
      await code(
        s.updateMyMonitorProfile({
          clientId: CLIENT(5),
          changes: { matCourse: 'inventado' },
        }),
      ),
    ).toBe('validation:bad_option');
    expect(
      await code(
        s.updateMyMonitorProfile({
          clientId: CLIENT(6),
          changes: { files: { mat: true } },
        } as never),
      ),
    ).toBe('validation:bad_body');
  });

  it('subir pone el «archivo subido» y guarda solo nombre, tamaño y tipo', async () => {
    const s = server();
    await s.uploadMyDocument(
      { clientId: CLIENT(7), kind: 'sex_offence_certificate' },
      pdf(),
    );
    expect((await s.getMyMonitorProfile()).files.sexOffenceCertificate).toBe(
      true,
    );
    expect(s.uploads()).toEqual([
      expect.objectContaining({
        kind: 'sex_offence_certificate',
        name: 'certificado.pdf',
        size: 1000,
      }),
    ]);
  });

  it('lo vacío, lo de más de 4 MB y lo que no es PDF/JPG/PNG no entra', async () => {
    const s = server();
    const up = (n: number, f: ReturnType<typeof pdf>) =>
      code(s.uploadMyDocument({ clientId: CLIENT(n), kind: 'mat' }, f));
    expect(await up(8, pdf(0))).toBe('validation:empty_file');
    expect(await up(9, pdf(DOCUMENT_MAX_BYTES + 1))).toBe(
      'validation:file_too_big',
    );
    expect(await up(10, pdf(10, 'foto.heic'))).toBe('validation:bad_file_type');
    expect(await up(11, pdf(DOCUMENT_MAX_BYTES, 'foto.jpg'))).toBe('ok');
  });

  it('con el CRM caído las escrituras fallan y la lectura sigue', async () => {
    const s = server({ crmDown: true });
    expect(await code(s.getMyMonitorProfile())).toBe('ok');
    expect(
      await code(
        s.updateMyMonitorProfile({
          clientId: CLIENT(12),
          changes: { foodHandling: true },
        }),
      ),
    ).toBe('crm_unavailable:');
    expect(
      await code(
        s.uploadMyDocument({ clientId: CLIENT(13), kind: 'mat' }, pdf()),
      ),
    ).toBe('crm_unavailable:');
  });

  it('reset() vuelve a los datos de partida', async () => {
    const s = server();
    await s.updateMyMonitorProfile({
      clientId: CLIENT(14),
      changes: { monitorSince: 1999 },
    });
    s.reset();
    s.setControls({ latencyMs: 0 });
    expect((await s.getMyMonitorProfile()).monitorSince).toBe(2021);
    expect(s.uploads()).toEqual([]);
  });
});

describe('cliente HTTP de Mis datos de monitor', () => {
  const ok = (body: unknown) =>
    ({ ok: true, status: 200, json: async () => body }) as Response;

  it('el PATCH va en JSON y el archivo en multipart, sin Content-Type a mano', async () => {
    const f = jest
      .fn()
      .mockResolvedValue(ok({ clientId: CLIENT(20), status: 'applied' }));
    const c = createHttpClient({
      baseUrl: 'https://api.test',
      getToken: () => 'tok',
      fetchImpl: f,
    });
    await c.updateMyMonitorProfile({
      clientId: CLIENT(20),
      changes: { monitorSince: 2019 },
    });
    const [url, init] = f.mock.calls[0];
    expect(url).toBe('https://api.test/v1/me/monitor');
    expect(init.method).toBe('PATCH');
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(init.body)).toEqual({
      clientId: CLIENT(20),
      changes: { monitorSince: 2019 },
    });

    await c.uploadMyDocument(
      { clientId: CLIENT(20), kind: 'mat' },
      pdf(1000, 'mat.pdf'),
    );
    const [url2, init2] = f.mock.calls[1];
    expect(url2).toBe('https://api.test/v1/me/documents');
    expect(init2.method).toBe('POST');
    expect(init2.body).toBeInstanceOf(FormData);
    expect(init2.headers['Content-Type']).toBeUndefined();
    expect(init2.headers.Authorization).toBe('Bearer tok');
  });
});
