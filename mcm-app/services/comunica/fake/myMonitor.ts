// services/comunica/fake/myMonitor.ts
//
// «Mis datos de monitor» en el servidor falso (plan 09 «Datos»). Va aparte de
// `index.ts`, como Coordinación, y comparte con él el estado a través de
// `ctx`. Se porta como el plugin (`single_stic_comunica_monitor.php`,
// `prefix_comunica_save_contact`, `comunica_upload_certificate`):
//
//   · Solo con papel `monitor`; si no, `forbidden` (la acompañante de prueba).
//   · El `PATCH` es estricto (una clave de más, `validation`), solo escribe lo
//     que cambia y no duplica con el mismo `clientId`.
//   · Subir: PDF, JPG o PNG de 1 byte a 6 MB; guarda el archivo en memoria
//     (nombre, tamaño y tipo, nunca el contenido) y pone su «archivo subido».
//   · Personas de prueba: el monitor eligió «Manual» y no ha subido el
//     certificado (para ver el aviso); coordinación, «Automático» con títulos.
//
// El estado vive POR datos (`WeakMap`): `reset()` del falso, que regenera
// los datos, lo deja también como al principio.

import {
  type DocumentKind,
  DocumentUploadFields,
  MonitorProfile,
  type MonitorProfileEditable,
  MonitorProfileWrite,
  type Role,
  type RouteName,
  WriteResult,
} from '../contract';
import { ComunicaApiError, type ComunicaApi } from '../client';
import type { FakeData, PersonaId } from './fixtures';
import { fileProblem } from '@/utils/comunica/monitorProfile';

type MonitorFiles = MonitorProfile['files'];

export interface MonitorProfileCtx {
  data: () => FakeData;
  gate: (route: RouteName, write?: boolean) => Promise<void>;
  persona: () => PersonaId;
  roles: () => readonly Role[];
  nowIso: () => string;
  seen: Map<string, unknown>;
  bumpWrites: (n?: number) => void;
}

/** Las rutas de este fichero (y `uploads`, para los tests). */
export type MineKeys =
  | 'getMyMonitorProfile'
  | 'updateMyMonitorProfile'
  | 'uploadMyDocument'
  | 'uploads';
type MonitorProfileApi = Pick<ComunicaApi, Exclude<MineKeys, 'uploads'>>;

/** Lo que el falso enseña de lo subido. */
export interface UploadsLog {
  /** Nombre, tamaño y tipo de cada archivo subido (nunca el contenido). */
  uploads(): readonly FakeUpload[];
}

/** Lo que el falso recuerda de cada archivo subido (nunca el contenido). */
export interface FakeUpload {
  personId: string;
  kind: DocumentKind;
  name: string;
  size: number;
  mimeType: string;
}

interface Stored {
  editable: MonitorProfileEditable;
  files: MonitorFiles;
}

interface State {
  profiles: Map<string, Stored>;
  uploads: FakeUpload[];
}

const forbidden = () =>
  new ComunicaApiError('forbidden', 'No tienes acceso a esto', 403);
const validation = (reason: string, message: string) =>
  new ComunicaApiError('validation', message, 422, reason);

/** Cursos y congresos inventados (los de verdad los da el servidor). */
export const FAKE_MAT_COURSES = [
  { value: '2013', label: 'MAT Consolación 2013 - Villaclara' },
  { value: '2018', label: 'MAT Consolación 2018 - Puerto Alto' },
  { value: '2022', label: 'MAT Consolación 2022 - Monteverde' },
  { value: '2024', label: 'MAT Consolación 2024 - Valdelagua' },
  { value: 'otra_escuela', label: 'Otra escuela' },
];
export const FAKE_CONGRESSES = [
  { value: '2016_villaclara', label: '2016 - Villaclara' },
  { value: '2019_monteverde', label: '2019 - Monteverde' },
  { value: '2022_puerto', label: '2022 - Puerto Alto' },
  { value: '2025_valdelagua', label: '2025 - Valdelagua' },
  { value: '2026_valdelagua', label: '2026-27 - Valdelagua' },
];

const EMPTY: MonitorProfileEditable = {
  monitorSince: null,
  monitorOf: null,
  preMonitors1: null,
  preMonitors2: null,
  preMonitorsYear: null,
  mat: null,
  matCourse: null,
  dat: null,
  fa: null,
  datYearAndSchool: null,
  faYearAndSchool: null,
  foodHandling: null,
  congresses: [],
  academicBackground: null,
  volunteeringDescription: null,
  volunteeringPrograms: null,
  sexOffenceCertificateMode: null,
};
const NO_FILES: MonitorFiles = {
  sexOffenceCertificate: false,
  mat: false,
  dat: false,
  otherTraining: false,
};

/** De partida, según la persona de prueba. */
function seedFor(persona: PersonaId): Stored {
  if (persona === 'monitor') {
    return {
      editable: {
        ...EMPTY,
        monitorSince: 2021,
        monitorOf: 'com',
        preMonitors1: 'finished',
        preMonitors2: 'in_progress',
        preMonitorsYear: '2020',
        mat: 'in_progress',
        congresses: ['2025_valdelagua'],
        sexOffenceCertificateMode: 'manual',
      },
      files: { ...NO_FILES },
    };
  }
  if (persona === 'coordination' || persona === 'both') {
    return {
      editable: {
        ...EMPTY,
        monitorSince: 2014,
        monitorOf: 'mic',
        preMonitors1: 'finished',
        preMonitors2: 'finished',
        preMonitorsYear: '2012',
        mat: 'certified',
        matCourse: '2018',
        dat: 'pending_certificate',
        datYearAndSchool: '2023, Escuela Valle Verde',
        foodHandling: true,
        congresses: ['2019_monteverde', '2022_puerto', '2025_valdelagua'],
        academicBackground: 'Grado en Educación Primaria',
        volunteeringDescription: 'Monitora de un grupo de MIC los sábados.',
        sexOffenceCertificateMode: 'automatic',
      },
      files: { ...NO_FILES, mat: true, otherTraining: true },
    };
  }
  return { editable: { ...EMPTY }, files: { ...NO_FILES } };
}

const KIND_FLAG: Record<DocumentKind, keyof MonitorFiles> = {
  sex_offence_certificate: 'sexOffenceCertificate',
  mat: 'mat',
  dat: 'dat',
  other_training: 'otherTraining',
};

export function monitorRoutes(
  ctx: MonitorProfileCtx,
): MonitorProfileApi & UploadsLog {
  const states = new WeakMap<FakeData, State>();
  const state = (): State => {
    const d = ctx.data();
    let s = states.get(d);
    if (!s) {
      s = { profiles: new Map(), uploads: [] };
      states.set(d, s);
    }
    return s;
  };
  /** La ficha de quien llama, o `forbidden` sin papel de monitor. */
  const mine = (): { personId: string; stored: Stored } => {
    if (!ctx.roles().includes('monitor')) throw forbidden();
    const persona = ctx.persona();
    const personId = ctx.data().personas[persona].personId;
    const s = state();
    let stored = s.profiles.get(personId);
    if (!stored) {
      stored = seedFor(persona);
      s.profiles.set(personId, stored);
    }
    return { personId, stored };
  };
  const remember = <T>(clientId: string, result: T): T => {
    ctx.seen.set(clientId, result);
    return result;
  };

  return {
    uploads: () => state().uploads,

    async getMyMonitorProfile() {
      await ctx.gate('myMonitor');
      const { stored } = mine();
      return MonitorProfile.parse({
        generatedAt: ctx.nowIso(),
        ...stored.editable,
        files: { ...stored.files },
        options: {
          matCourses: FAKE_MAT_COURSES,
          congresses: FAKE_CONGRESSES,
        },
      });
    },

    async updateMyMonitorProfile(body) {
      await ctx.gate('updateMyMonitor', true);
      const parsed = MonitorProfileWrite.safeParse(body);
      if (!parsed.success) {
        throw validation('bad_body', 'Los datos no tienen la forma esperada');
      }
      const w = parsed.data;
      const repeated = ctx.seen.get(w.clientId);
      if (repeated) return WriteResult.parse(repeated);
      const { stored } = mine();
      const c = w.changes;
      if (
        c.matCourse != null &&
        !FAKE_MAT_COURSES.some((o) => o.value === c.matCourse)
      ) {
        throw validation('bad_option', 'Ese curso no existe');
      }
      if (
        c.congresses?.some((k) => !FAKE_CONGRESSES.some((o) => o.value === k))
      ) {
        throw validation('bad_option', 'Ese congreso no existe');
      }
      // Solo se escribe lo que cambia.
      let changed = 0;
      const next = { ...stored.editable } as Record<string, unknown>;
      for (const [k, v] of Object.entries(c)) {
        if (JSON.stringify(next[k]) === JSON.stringify(v)) continue;
        next[k] = v;
        changed += 1;
      }
      if (changed > 0) {
        stored.editable = next as MonitorProfileEditable;
        ctx.bumpWrites(1);
      }
      return remember(
        w.clientId,
        WriteResult.parse({ clientId: w.clientId, status: 'applied' }),
      );
    },

    async uploadMyDocument(fields, file) {
      await ctx.gate('uploadMyDocument', true);
      const parsed = DocumentUploadFields.safeParse(fields);
      if (!parsed.success) {
        throw validation('bad_body', 'Faltan datos del archivo');
      }
      const f = parsed.data;
      const repeated = ctx.seen.get(f.clientId);
      if (repeated) return WriteResult.parse(repeated);
      const { personId, stored } = mine();
      // La misma regla que comprueba la app antes de subir.
      const problem = fileProblem(file);
      if (problem === 'empty') {
        throw validation('empty_file', 'El archivo está vacío');
      }
      if (problem === 'too_big') {
        throw validation('file_too_big', 'Ese archivo pesa más de 6 MB');
      }
      if (problem === 'bad_type') {
        throw validation('bad_file_type', 'Tiene que ser PDF, JPG o PNG');
      }
      state().uploads.push({
        personId,
        kind: f.kind,
        name: file.name,
        size: file.size,
        mimeType: file.mimeType,
      });
      stored.files = { ...stored.files, [KIND_FLAG[f.kind]]: true };
      // El Documento, su relación, su revisión y el indicador.
      ctx.bumpWrites(1);
      return remember(
        f.clientId,
        WriteResult.parse({
          clientId: f.clientId,
          status: 'applied',
          crmIds: [`f-doc-${state().uploads.length}`],
        }),
      );
    },
  };
}
