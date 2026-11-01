// services/comunica/fake/myDetails.ts
//
// «Mis datos» de familias en el servidor falso (plan 12 «Datos»):
// `GET/PATCH /v1/profiles/:pid/details` y `GET/PUT /v1/profiles/:pid/health`.
// Va aparte de `index.ts`, como los perfiles del 11, y se porta como el
// servidor de verdad (`comunicaMiddleware:src/app/profile-details*.ts`):
//
//   · `pid` permitido en CADA petición (`allowedProfile` del 11): si no, 403
//     (exista o no). Con el CRM caído, `crm_unavailable`, nunca datos vacíos.
//   · Las secciones las decide el servidor: `member`, las siete; `child` y
//     `guardian`, sin `mcm`. Un `PATCH` con `mcm` de otra audiencia,
//     `validation`.
//   · El `PATCH` es estricto, valida formatos y opciones, solo escribe lo que
//     cambia (lo cuenta por campo, para los tests) y devuelve lo releído.
//   · Las autorizaciones solo se escriben si llegan (nunca un «sin contestar»
//     convertido en «no»). `identityFill`, solo lo que está vacío.
//   · La salud va por su ruta, sin caché, y nunca en el resultado.
//
// Personas inventadas (por id, ver `fixturesFamilies.ts`): el monitor y la
// monitora con hija tienen el correo de Gmail (aviso); Elena, miembro sin ser
// monitora, la nota suave y la etapa COM; Lucía, las tres autorizaciones sin
// contestar; el hijo sin nombre, soporte y expedición del DNI; Teresa, sin
// documento (para «completar para pagar»). El estado vive POR datos
// (`WeakMap`): `reset()` del falso lo deja como al principio.

import {
  DetailsWriteResult,
  HealthResponse,
  type HealthInfo,
  HealthWrite,
  PersonDetails,
  PersonDetailsWrite,
  type Role,
  type RouteName,
  WriteResult,
} from '../contract';
import { ComunicaApiError, type ComunicaApi } from '../client';
import type { FakeData, PersonaId } from './fixtures';
import { isValidDocument } from '@/utils/comunica/documentId';

export interface MyDetailsCtx {
  data: () => FakeData;
  gate: (route: RouteName, write?: boolean) => Promise<void>;
  persona: () => PersonaId;
  /** Los papeles de equipo de quien llama. */
  roles: () => readonly Role[];
  /** ¿Puede quien llama ver a `pid`? (plan 11; lanza con el CRM caído). */
  allowedProfile: (pid: string) => boolean;
  today: () => string;
  nowIso: () => string;
  seen: Map<string, unknown>;
  bumpWrites: (n?: number) => void;
}

export type MyDetailsKeys =
  | 'getProfileDetails'
  | 'updateProfileDetails'
  | 'getProfileHealth'
  | 'updateProfileHealth';
type MyDetailsApi = Pick<ComunicaApi, MyDetailsKeys>;

/** Lo que el falso enseña para los tests. */
export interface MyDetailsFake {
  /** Cuántas veces se ha escrito cada campo (`contact.mobile`…). */
  detailWrites(): Readonly<Record<string, number>>;
}

type Stored = Omit<
  PersonDetails,
  'generatedAt' | 'sections' | 'emailNote' | 'photoUrl' | 'options' | 'mcm'
> & {
  mcm: NonNullable<PersonDetails['mcm']>;
  photo: number | null;
  health: HealthInfo;
};

interface State {
  people: Map<string, Stored>;
  writes: Record<string, number>;
}

// Las opciones del servidor de verdad (CAMPOS.md §1, §2 y §4), abreviadas
// donde no hace falta la lista entera para probar.
const same = (xs: string[]) => xs.map((x) => ({ value: x, label: x }));
export const FAKE_DETAIL_OPTIONS: PersonDetails['options'] = {
  gender: [
    { value: 'male', label: 'Hombre' },
    { value: 'female', label: 'Mujer' },
  ],
  documentType: [
    { value: 'nif', label: 'NIF' },
    { value: 'nie', label: 'NIE' },
    { value: 'cif', label: 'CIF' },
    { value: 'passport', label: 'Pasaporte' },
  ],
  stage: [
    { value: 'mic', label: 'MIC' },
    { value: 'com', label: 'COM' },
    { value: 'lc', label: 'LC' },
    { value: 'lc_incorporated', label: 'LC Incorporado' },
    { value: 'asesora', label: 'Asesora' },
    { value: 'apoyo', label: 'Monitor/a Apoyo' },
  ],
  comLevel: [
    { value: 'conocimiento', label: 'I - Conocimiento' },
    { value: 'incorporacion', label: 'II - Incorporación' },
    { value: 'crecimiento', label: 'III - Crecimiento' },
    { value: 'opcion_responsable', label: 'IV - Opción Responsable' },
  ],
  shirtSize: same(['8', '10', '12', '14', 'XS', 'S', 'M', 'L', 'XL', 'XXL']),
  localMcm: [
    { value: 'castellon', label: 'MCM Castellón' },
    { value: 'madird', label: 'MCM Madrid' },
    { value: 'vila-real', label: 'MCM Vila-real' },
    { value: 'zaragoza', label: 'MCM Zaragoza' },
    { value: 'otros', label: 'Otros' },
  ],
  region: [
    { value: 'aragon', label: 'Aragón' },
    { value: 'madrid', label: 'Comunidad de Madrid' },
    { value: 'valencia', label: 'Comunitat Valenciana' },
    { value: 'murcia', label: 'Región de Murcia' },
  ],
};

const EMAIL =
  /^[a-zA-Z0-9.!#$%&’*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)+$/;

const forbidden = () =>
  new ComunicaApiError(
    'forbidden',
    'No tienes acceso a esto',
    403,
    'profile_out_of_scope',
  );
const reject = (reason: string, message: string) =>
  new ComunicaApiError('validation', message, 422, reason);

const NO_HEALTH: HealthInfo = {
  foodIntolerances: null,
  allergies: null,
  illnesses: null,
  treatments: null,
  other: null,
};
const NO_MCM: Stored['mcm'] = {
  stage: null,
  comLevel: null,
  shirtSize: null,
  groupName: null,
  localMcm: null,
  scarf: null,
  lcIncorporationYear: null,
  memberSince: null,
};

/** Un DNI inventado y válido, siempre el mismo para cada persona. */
function dniFor(id: string): string {
  let n = 0;
  for (const c of id) n = (n * 31 + c.charCodeAt(0)) % 90_000_000;
  const num = 10_000_000 + n;
  return `${num}${'TRWAGMYFPDXBNJZSQVHLCKE'[num % 23]}`;
}

/** Los datos de partida de cada persona (inventados). */
function seedFor(data: FakeData, id: string): Stored | null {
  const p = data.people.find((x) => x.id === id);
  if (!p) return null;
  const ids = data.personas;
  const slug = (p.firstName || 'participante')
    .normalize('NFD')
    .replace(/[^a-zA-Z]/g, '')
    .toLowerCase();
  const base: Stored = {
    identity: {
      firstName: p.firstName,
      lastName: p.lastName,
      documentType: 'nif',
      documentNumber: dniFor(id),
      birthDate: '1990-03-14',
    },
    gender: data.genders?.[id] ?? null,
    documentSupportNumber: null,
    documentIssueDate: null,
    contact: {
      email: `${slug}@movimientoconsolacion.com`,
      mobile: '600 123 456',
      emergencyPhone: null,
    },
    address: {
      street: 'Calle Mayor, 3',
      city: 'Villaclara',
      province: 'Castellón',
      postalCode: '12001',
      region: 'valencia',
    },
    photo: null,
    mcm: { ...NO_MCM },
    consents: { dataProtection: true, healthData: true, photos: true },
    health: { ...NO_HEALTH },
  };
  switch (id) {
    // Monitores con el correo de Gmail: el aviso del correo del MCM.
    case ids.monitor?.personId:
    case ids.monitorParent?.personId:
      return {
        ...base,
        contact: { ...base.contact, email: `${slug}.mcm@gmail.com` },
        photo: 1,
        mcm: {
          ...NO_MCM,
          stage: 'lc',
          scarf: 'blue',
          shirtSize: 'M',
          groupName: 'Grupo Betania',
          localMcm: 'castellon',
          memberSince: 2012,
        },
      };
    // Miembro sin ser monitora: la nota suave, y etapa COM (el condicional).
    case ids.member?.personId:
      return {
        ...base,
        identity: { ...base.identity, birthDate: '2008-05-05' },
        contact: { ...base.contact, email: 'elena.prieto@correo.es' },
        mcm: {
          ...NO_MCM,
          stage: 'com',
          comLevel: 'incorporacion',
          scarf: 'green',
          shirtSize: 'S',
          groupName: 'Grupo Emaús',
          localMcm: 'castellon',
          memberSince: 2019,
        },
      };
    // Lucía: las tres autorizaciones sin contestar y algo de salud.
    case 'f-fam-lucia':
      return {
        ...base,
        identity: { ...base.identity, birthDate: '2014-05-05' },
        contact: {
          email: 'familia.messeguer@correo.es',
          mobile: null,
          emergencyPhone: '600 987 654',
        },
        consents: { dataProtection: null, healthData: null, photos: null },
        health: {
          ...NO_HEALTH,
          allergies: 'Polen de olivo',
          foodIntolerances: 'Lactosa',
        },
      };
    // El hijo sin nombre: tenemos soporte y expedición del DNI.
    case 'f-fam-sin-nombre':
      return {
        ...base,
        identity: { ...base.identity, birthDate: '2017-01-20' },
        documentSupportNumber: 'BAA123456',
        documentIssueDate: '2023-06-01',
      };
    // Teresa: quien paga sin documento («completar para pagar»).
    case ids.guardianNone?.personId:
      return {
        ...base,
        identity: {
          ...base.identity,
          documentType: null,
          documentNumber: null,
        },
        contact: { ...base.contact, email: 'teresa.ruiz@correo.es' },
      };
    default:
      return {
        ...base,
        contact: {
          ...base.contact,
          email: p.firstName ? `${slug}@correo.es` : null,
        },
      };
  }
}

export function myDetailsRoutes(
  ctx: MyDetailsCtx,
): MyDetailsApi & MyDetailsFake {
  const states = new WeakMap<FakeData, State>();
  const state = (): State => {
    const d = ctx.data();
    let s = states.get(d);
    if (!s) {
      s = { people: new Map(), writes: {} };
      states.set(d, s);
    }
    return s;
  };
  const meId = () => ctx.data().personas[ctx.persona()].personId;

  /** El `pid` permitido y sus datos, o 403. */
  function who(pid: string): { id: string; self: boolean; row: Stored } {
    if (!ctx.allowedProfile(pid)) throw forbidden();
    const s = state();
    let row = s.people.get(pid);
    if (!row) {
      const seeded = seedFor(ctx.data(), pid);
      if (!seeded) throw forbidden();
      row = seeded;
      s.people.set(pid, row);
    }
    return { id: pid, self: pid === meId(), row };
  }

  /** `audienceOf` del servidor: un hijo, `child`; solo familiar, `guardian`. */
  function audienceOf(self: boolean): 'member' | 'guardian' | 'child' {
    if (!self) return 'child';
    const d = ctx.data();
    const me = meId();
    const member =
      d.members.includes(me) ||
      ctx
        .roles()
        .some((r) => ['monitor', 'coordination', 'accompaniment'].includes(r));
    const guardian = (d.families[me] ?? []).length > 0;
    return guardian && !member ? 'guardian' : 'member';
  }

  function detailsOf(pid: string): PersonDetails {
    const { self, row } = who(pid);
    const audience = audienceOf(self);
    const sections: PersonDetails['sections'] =
      audience === 'member'
        ? [
            'identity',
            'contact',
            'address',
            'photo',
            'mcm',
            'health',
            'consents',
          ]
        : ['identity', 'contact', 'address', 'photo', 'health', 'consents'];
    const isMonitor = self && ctx.roles().includes('monitor');
    const mcmMail = (row.contact.email ?? '')
      .toLowerCase()
      .includes('@movimientoconsolacion.com');
    const { health: _h, photo, ...rest } = row;
    return PersonDetails.parse({
      generatedAt: ctx.nowIso(),
      sections,
      ...rest,
      emailNote:
        isMonitor && !mcmMail
          ? 'mcm_email_warning'
          : audience === 'member' && !isMonitor
            ? 'mcm_email_soft'
            : null,
      photoUrl: photo
        ? `https://fotos.ejemplo.org/v1/profiles/${pid}/photo?v=${photo}`
        : null,
      mcm: audience === 'member' ? row.mcm : null,
      options: FAKE_DETAIL_OPTIONS,
    });
  }

  const opt = (
    list: { value: string }[],
    v: string | null | undefined,
    label: string,
  ) => {
    if (v != null && v !== '' && !list.some((o) => o.value === v)) {
      throw reject('bad_option', `«${label}» no es una opción válida.`);
    }
    return v || null;
  };
  const txt = (v: string | null | undefined) => {
    const t = (v ?? '').trim();
    return t === '' ? null : t;
  };
  const year = (v: number | null | undefined, label: string) => {
    if (v != null && (v < 1900 || v > 2100)) {
      throw reject('bad_year', `«${label}» no es un año válido.`);
    }
    return v ?? null;
  };

  /** Los cambios, validados, como `[campo, valor nuevo]`. */
  function wanted(
    ch: PersonDetailsWrite['changes'],
    row: Stored,
  ): [string, unknown][] {
    const out: [string, unknown][] = [];
    const O = FAKE_DETAIL_OPTIONS;
    if ('gender' in ch)
      out.push(['gender', opt(O.gender, ch.gender, 'Género')]);
    if ('documentSupportNumber' in ch) {
      out.push(['documentSupportNumber', txt(ch.documentSupportNumber)]);
    }
    if ('documentIssueDate' in ch) {
      out.push(['documentIssueDate', ch.documentIssueDate ?? null]);
    }
    const c = ch.contact;
    if (c) {
      if ('email' in c) {
        const e = txt(c.email);
        if (e && !EMAIL.test(e)) {
          throw reject('bad_email', 'El correo electrónico no es válido.');
        }
        out.push(['contact.email', e]);
      }
      if ('mobile' in c) out.push(['contact.mobile', txt(c.mobile)]);
      if ('emergencyPhone' in c) {
        out.push(['contact.emergencyPhone', txt(c.emergencyPhone)]);
      }
    }
    const a = ch.address;
    if (a) {
      if ('street' in a) out.push(['address.street', txt(a.street)]);
      if ('city' in a) out.push(['address.city', txt(a.city)]);
      if ('province' in a) out.push(['address.province', txt(a.province)]);
      if ('postalCode' in a) {
        const cp = txt(a.postalCode);
        if (cp && !/^\d{5}$/.test(cp)) {
          throw reject('bad_postal_code', 'El código postal son cinco cifras.');
        }
        out.push(['address.postalCode', cp]);
      }
      if ('region' in a) {
        out.push([
          'address.region',
          opt(O.region, a.region, 'Comunidad Autónoma'),
        ]);
      }
    }
    const m = ch.mcm;
    if (m) {
      if ('stage' in m) out.push(['mcm.stage', opt(O.stage, m.stage, 'Etapa')]);
      if ('comLevel' in m) {
        out.push(['mcm.comLevel', opt(O.comLevel, m.comLevel, 'Nivel COM')]);
      }
      if ('scarf' in m) out.push(['mcm.scarf', m.scarf ?? null]);
      if ('shirtSize' in m) {
        out.push(['mcm.shirtSize', opt(O.shirtSize, m.shirtSize, 'Talla')]);
      }
      if ('groupName' in m) out.push(['mcm.groupName', txt(m.groupName)]);
      if ('localMcm' in m) {
        out.push(['mcm.localMcm', opt(O.localMcm, m.localMcm, 'MCM Local')]);
      }
      if ('lcIncorporationYear' in m) {
        out.push([
          'mcm.lcIncorporationYear',
          year(m.lcIncorporationYear, 'Año de incorporación'),
        ]);
      }
      if ('memberSince' in m) {
        out.push([
          'mcm.memberSince',
          year(m.memberSince, 'Pertenezco al MCM desde'),
        ]);
      }
    }
    const k = ch.consents;
    if (k) {
      for (const f of ['dataProtection', 'healthData', 'photos'] as const) {
        if (k[f] !== undefined) out.push([`consents.${f}`, k[f]]);
      }
    }
    const fill = ch.identityFill;
    if (fill) {
      for (const f of [
        'firstName',
        'lastName',
        'documentType',
        'documentNumber',
      ] as const) {
        const v = fill[f];
        if (v === undefined) continue;
        if ((row.identity[f] ?? '').trim() !== '') {
          throw reject(
            'identity_already_set',
            'Ese dato ya está en tu ficha y no se cambia desde aquí.',
          );
        }
        const t = v.trim();
        if (t === '') throw reject('bad_identity', 'Falta un dato.');
        out.push([
          `identity.${f}`,
          f === 'documentType'
            ? opt(O.documentType, t.toLowerCase(), 'Tipo de documento')
            : t,
        ]);
      }
      if (fill.documentNumber !== undefined) {
        const type = (
          fill.documentType ??
          row.identity.documentType ??
          ''
        ).toLowerCase();
        if (!type) throw reject('bad_identity', 'Indica el tipo de documento.');
        if (!isValidDocument(type, fill.documentNumber)) {
          throw reject('bad_document', 'El número de documento no es válido.');
        }
      }
    }
    return out;
  }

  /** Lee y escribe un campo con punto (`contact.email`) de lo guardado. */
  const getAt = (row: Stored, path: string): unknown => {
    const [a, b] = path.split('.');
    return b === undefined
      ? (row as unknown as Record<string, unknown>)[a]
      : (row as unknown as Record<string, Record<string, unknown>>)[a][b];
  };
  const setAt = (row: Stored, path: string, v: unknown) => {
    const [a, b] = path.split('.');
    if (b === undefined) (row as unknown as Record<string, unknown>)[a] = v;
    else (row as unknown as Record<string, Record<string, unknown>>)[a][b] = v;
  };

  /** Solo lo que cambia: cada campo escrito suma una escritura. */
  function apply(row: Stored, list: [string, unknown][]) {
    const s = state();
    let n = 0;
    for (const [path, v] of list) {
      if (getAt(row, path) === v) continue;
      setAt(row, path, v);
      s.writes[path] = (s.writes[path] ?? 0) + 1;
      n += 1;
    }
    if (n) ctx.bumpWrites(n);
  }

  return {
    detailWrites: () => ({ ...state().writes }),

    async getProfileDetails(pid) {
      // Sin ruta propia en `ROUTES` del contrato: la de los datos personales
      // (plan 05), también `persist: false`. El mando `failRoute` la tumba.
      await ctx.gate('personal');
      return detailsOf(pid);
    },

    async updateProfileDetails(pid, body) {
      await ctx.gate('personal', true);
      const parsed = PersonDetailsWrite.safeParse(body);
      if (!parsed.success) {
        throw reject('bad_body', 'Los datos no tienen la forma esperada.');
      }
      const w = parsed.data;
      const { self, row } = who(pid);
      if (w.changes.mcm && audienceOf(self) !== 'member') {
        throw reject(
          'section_not_allowed',
          'Esa sección no es de esta persona.',
        );
      }
      // Mismo `clientId`: ya está hecho; se devuelve lo releído.
      if (!ctx.seen.has(w.clientId)) {
        apply(row, wanted(w.changes, row));
        ctx.seen.set(w.clientId, true);
      }
      return DetailsWriteResult.parse({
        clientId: w.clientId,
        status: 'applied',
        details: detailsOf(pid),
      });
    },

    async getProfileHealth(pid) {
      await ctx.gate('health');
      const { row } = who(pid);
      return HealthResponse.parse({
        generatedAt: ctx.nowIso(),
        health: { ...row.health },
      });
    },

    async updateProfileHealth(pid, body) {
      await ctx.gate('health', true);
      const parsed = HealthWrite.safeParse(body);
      if (!parsed.success) {
        throw reject('bad_body', 'Los datos no tienen la forma esperada.');
      }
      const w = parsed.data;
      const { row } = who(pid);
      if (!ctx.seen.has(w.clientId)) {
        const list: [string, unknown][] = Object.entries(w.health).map(
          ([k, v]) => [`health.${k}`, txt(v as string | null)],
        );
        apply(row, list);
        ctx.seen.set(w.clientId, true);
      }
      return WriteResult.parse({ clientId: w.clientId, status: 'applied' });
    },
  };
}
