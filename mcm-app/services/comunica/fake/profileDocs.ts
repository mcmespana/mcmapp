// services/comunica/fake/profileDocs.ts
//
// «Documentos» y «Calendario» en el servidor falso (plan 16, familias). Va aparte de `index.ts` y comparte con él el estado a través de `ctx`. Se porta como el
// servidor de verdad (`comunicaMiddleware:src/app/profile-docs*.ts`):
//
//   · Todas las rutas empiezan por `allowedProfile` (plan 11). Un documento ajeno, borrado o inexistente es 403 (nunca «no es tuyo»).
//   · Subir: el archivo se mira ANTES de escribir (no vacío, hasta 4 MB, extensión de la lista y no SVG): `validation` con `empty_file`, `file_too_big` o
//     `bad_file_type`. Mismo `clientId` = el mismo documento, sin duplicar. Editar: solo lo que llega; un archivo nuevo cambia el archivo. Borrar: lógico.
//   · El calendario: las sesiones de los eventos con inscripción NO cancelada (con las cuatro marcas y sin marcar), los eventos con plaza y los abiertos a
//     inscripción (con la audiencia del perfil, sin ocultos y sin los que ya tienen plaza). Una sesión sin inscripción activa a su evento: 403.
//
// El estado vive POR datos (`WeakMap`): `reset()` del falso lo deja como al principio.

import {
  CalendarData,
  DocumentResponse,
  DocumentsResponse,
  SessionResponse,
  WriteResult,
  type DocumentDetail,
  type Mark,
  type RouteName,
} from '../contract';
import { ComunicaApiError, type ComunicaApi, type UploadFile } from '../client';
import type { FakeData, PersonaId } from './fixtures';
import { EVENTS, eventIsFor } from './profileEvents';
import { allowedProfile } from './profiles';
import { activeRegistration, registrationsOf } from './registrations';
import { fileProblem, FILE_ERRORS } from '@/utils/comunica/files';
import { windowState } from '@/utils/comunica/eventWindow';
import { addDays, madridInstant } from '@/utils/comunica/madrid';

export interface DocsCtx {
  data: () => FakeData;
  gate: (route: RouteName, write?: boolean) => Promise<void>;
  persona: () => PersonaId;
  roles: () => readonly string[];
  today: () => string;
  now: () => Date;
  nowIso: () => string;
  seen: Map<string, unknown>;
  bumpWrites: (n?: number) => void;
  controls: () => { profilesDown: boolean; newChildNext: boolean };
}

export type ProfileDocKeys =
  | 'getProfileDocuments'
  | 'getProfileDocument'
  | 'createProfileDocument'
  | 'updateProfileDocument'
  | 'deleteProfileDocument'
  | 'documentFileSource'
  | 'getProfileCalendar'
  | 'getProfileSession';
type DocsApi = Pick<ComunicaApi, ProfileDocKeys>;

const forbidden = () =>
  new ComunicaApiError(
    'forbidden',
    'No tienes acceso a esto',
    403,
    'document_out_of_scope',
  );
const validation = (reason: string, message: string) =>
  new ComunicaApiError('validation', message, 422, reason);

interface FakeDoc {
  id: string;
  name: string;
  fileName: string | null;
  status: { key: string; label: string } | null;
  /** Días desde «hoy». */
  activeOn: number | null;
  expiresOn: number | null;
  description: string | null;
  category: { key: string; label: string } | null;
  sharedLink: string | null;
  /** El tamaño del archivo (para el falso). */
  size?: number;
}

const ACTIVE = { key: 'Active', label: 'Activo' };
const DRAFT = { key: 'Draft', label: 'Borrador' };
const doc = (d: Partial<FakeDoc> & Pick<FakeDoc, 'id' | 'name'>): FakeDoc => ({
  fileName: null,
  status: ACTIVE,
  activeOn: -10,
  expiresOn: null,
  description: null,
  category: null,
  sharedLink: null,
  ...d,
});

/** Lo que cada perfil tiene en el CRM. */
const SEED: Record<string, FakeDoc[]> = {
  'f-hijo-lucia': [
    doc({
      id: 'doc-aut',
      name: 'Autorización de salida',
      fileName: 'autorizacion.pdf',
      activeOn: -20,
      expiresOn: 200,
      description: 'Firmada por los padres.',
      category: { key: 'authorization', label: 'Autorización' },
    }),
    doc({
      id: 'doc-dni',
      name: 'Foto del DNI',
      fileName: 'dni.png',
      activeOn: -40,
    }),
    doc({
      id: 'doc-sin',
      name: 'Pendiente de escanear',
      status: DRAFT,
      activeOn: -3,
    }),
    doc({
      id: 'doc-borrador',
      name: 'Ficha médica',
      fileName: 'ficha.docx',
      status: DRAFT,
      activeOn: -5,
    }),
    doc({
      id: 'doc-cad',
      name: 'Certificado antiguo',
      fileName: 'certificado.jpeg',
      activeOn: -400,
      expiresOn: -30,
    }),
  ],
  'f-per-familia': [
    doc({
      id: 'doc-marta',
      name: 'Mi DNI',
      fileName: 'dni-marta.pdf',
      activeOn: -60,
    }),
  ],
  'f-per-miembro': [
    doc({
      id: 'doc-jaime',
      name: 'Certificado de delitos sexuales',
      fileName: 'delitos.pdf',
      activeOn: -90,
    }),
  ],
};

interface State {
  docs: Map<string, FakeDoc[]>;
  counter: number;
}
const states = new WeakMap<FakeData, State>();

export function profileDocsRoutes(ctx: DocsCtx): DocsApi {
  const state = (): State => {
    const d = ctx.data();
    let s = states.get(d);
    if (!s) {
      s = { docs: new Map(), counter: 0 };
      states.set(d, s);
    }
    return s;
  };
  const docsOf = (pid: string): FakeDoc[] => {
    const s = state();
    let list = s.docs.get(pid);
    if (!list) {
      list = (SEED[pid] ?? []).map((d) => ({ ...d }));
      s.docs.set(pid, list);
    }
    return list;
  };
  const day = (n: number | null) =>
    n == null ? null : addDays(ctx.today(), n);
  const summary = (d: FakeDoc) => ({
    id: d.id,
    name: d.name,
    fileName: d.fileName,
    status: d.status,
    activeOn: day(d.activeOn),
    expiresOn: day(d.expiresOn),
  });
  const detail = (d: FakeDoc): DocumentDetail => ({
    ...summary(d),
    description: d.description,
    category: d.category,
    sharedLink: d.sharedLink,
  });
  const own = (pid: string, id: string): FakeDoc => {
    const d = docsOf(pid).find((x) => x.id === id);
    if (!d) throw forbidden();
    return d;
  };
  /** Mira el archivo ANTES de escribir nada, como el servidor. */
  const checkFile = (file: UploadFile) => {
    const p = fileProblem({ name: file.name, size: file.size });
    if (!p) return;
    throw validation(
      p === FILE_ERRORS.empty
        ? 'empty_file'
        : p === FILE_ERRORS.tooBig
          ? 'file_too_big'
          : 'bad_file_type',
      p,
    );
  };
  const nameOk = (name: string | undefined) => {
    if (name !== undefined && (name.trim() === '' || name.length > 200))
      throw validation('bad_name', 'El nombre no es válido');
  };

  // ── Calendario ──
  const SESSIONS = 24;
  const sessionsOf = (pid: string) => {
    // Un curso de ~24 sesiones semanales (los sábados) a las 17:30 de Madrid, con las cuatro marcas y sin marcar.
    if (!activeRegistration(ctx.data(), pid, 'pev-curso')) return [];
    const marks: Mark[] = [
      'yes',
      'yes',
      'partial',
      'no_justified',
      'no_unjustified',
      null,
    ];
    const start = addDays(ctx.today(), -70);
    return Array.from({ length: SESSIONS }, (_, i) => {
      const d = addDays(start, i * 7);
      const startsAt = madridInstant(d, '17:30');
      const endsAt = madridInstant(d, '19:00');
      const past = new Date(startsAt).getTime() <= ctx.now().getTime();
      return {
        id: `ses-${pid}-${i + 1}`,
        name: `Sesión ${i + 1}`,
        eventId: 'pev-curso',
        eventName: 'Curso de Catequesis MIC',
        startsAt,
        endsAt,
        attendance: past ? marks[i % marks.length] : null,
      };
    });
  };

  return {
    async getProfileDocuments(pid) {
      await ctx.gate('profileDocuments');
      const who = allowedProfile(ctx as never, pid);
      return DocumentsResponse.parse({
        generatedAt: ctx.nowIso(),
        documents: docsOf(who.id).map(summary),
      });
    },

    async getProfileDocument(pid, id) {
      await ctx.gate('profileDocument');
      const who = allowedProfile(ctx as never, pid);
      return DocumentResponse.parse({
        generatedAt: ctx.nowIso(),
        document: detail(own(who.id, id)),
      });
    },

    async createProfileDocument(pid, fields, file) {
      await ctx.gate('createProfileDocument', true);
      const who = allowedProfile(ctx as never, pid);
      if (ctx.seen.has(fields.clientId))
        return WriteResult.parse(ctx.seen.get(fields.clientId));
      nameOk(fields.name);
      checkFile(file);
      const s = state();
      s.counter += 1;
      const id = `doc-nuevo-${s.counter}`;
      docsOf(who.id).push({
        id,
        name: fields.name.trim(),
        fileName: file.name,
        status: ACTIVE,
        activeOn: 0,
        expiresOn: null,
        description: fields.description?.trim() || null,
        category: null,
        sharedLink: null,
        size: file.size,
      });
      ctx.bumpWrites(1);
      const result = WriteResult.parse({
        clientId: fields.clientId,
        status: 'applied',
        crmIds: [id],
      });
      ctx.seen.set(fields.clientId, result);
      return result;
    },

    async updateProfileDocument(pid, id, fields, file) {
      await ctx.gate('updateProfileDocument', true);
      const who = allowedProfile(ctx as never, pid);
      if (ctx.seen.has(fields.clientId))
        return WriteResult.parse(ctx.seen.get(fields.clientId));
      const d = own(who.id, id);
      nameOk(fields.name);
      if (file) checkFile(file);
      if (fields.name !== undefined) d.name = fields.name.trim();
      if (fields.description !== undefined)
        d.description = fields.description.trim() || null;
      if (file) {
        d.fileName = file.name;
        d.size = file.size;
      }
      ctx.bumpWrites(1);
      const result = WriteResult.parse({
        clientId: fields.clientId,
        status: 'applied',
      });
      ctx.seen.set(fields.clientId, result);
      return result;
    },

    async deleteProfileDocument(pid, id, clientId) {
      await ctx.gate('deleteProfileDocument', true);
      const who = allowedProfile(ctx as never, pid);
      if (ctx.seen.has(clientId))
        return WriteResult.parse(ctx.seen.get(clientId));
      own(who.id, id);
      // Borrado lógico: deja de salir.
      const list = docsOf(who.id);
      list.splice(
        list.findIndex((x) => x.id === id),
        1,
      );
      ctx.bumpWrites(1);
      const result = WriteResult.parse({ clientId, status: 'applied' });
      ctx.seen.set(clientId, result);
      return result;
    },

    documentFileSource(pid, id) {
      // El falso no sirve bytes de verdad: una dirección inventada y estable. La descarga se simula en los tests.
      return {
        uri: `https://fake.invalid/v1/profiles/${pid}/documents/${id}/file`,
        cacheKey: `doc-${id}`,
      };
    },

    async getProfileCalendar(pid) {
      await ctx.gate('profileCalendar');
      const who = allowedProfile(ctx as never, pid);
      const regs = registrationsOf(ctx.data(), who.id).filter(
        (r) => !r.cancelled,
      );
      const evOf = (id: string) => EVENTS.find((e) => e.id === id);
      const asEvent = (e: (typeof EVENTS)[number]) => ({
        id: e.id,
        name: e.name,
        startDate: addDays(ctx.today(), e.start ?? 0),
        endDate: e.end == null ? null : addDays(ctx.today(), e.end),
      });
      const registeredEvents = regs
        .map((r) => evOf(r.eventId))
        .filter((e): e is NonNullable<typeof e> => !!e && e.start != null)
        .map(asEvent);
      const open = EVENTS.filter(
        (e) =>
          e.start != null &&
          !e.hidden &&
          !regs.some((r) => r.eventId === e.id) &&
          eventIsFor(ctx.roles(), who.id, who.self, e) &&
          (e.end ?? e.start) >= 0 &&
          windowState(
            {
              opensOn: e.opens == null ? null : addDays(ctx.today(), e.opens),
              closesOn:
                e.closes == null ? null : addDays(ctx.today(), e.closes),
            },
            ctx.today(),
          ) === 'open',
      ).map(asEvent);
      return CalendarData.parse({
        generatedAt: ctx.nowIso(),
        sessions: sessionsOf(who.id),
        registeredEvents,
        openEvents: open,
      });
    },

    async getProfileSession(pid, id) {
      await ctx.gate('profileSession');
      const who = allowedProfile(ctx as never, pid);
      const s = sessionsOf(who.id).find((x) => x.id === id);
      if (!s) throw forbidden();
      return SessionResponse.parse({
        generatedAt: ctx.nowIso(),
        session: {
          ...s,
          description: 'Sesión semanal: lectura, oración y un rato de juego.',
        },
      });
    },
  };
}
