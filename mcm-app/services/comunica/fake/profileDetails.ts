// services/comunica/fake/profileDetails.ts
//
// «Mis datos» y «Datos de Lucía» en el servidor falso (plan 12, familias). Va aparte de `index.ts` y comparte con él el estado a través de `ctx`. Se
// porta como el servidor de verdad (`comunicaMiddleware:src/app/profile-details*.ts`):
//
//   · Todas las rutas empiezan por `allowedProfile` (plan 11): `pid` es quien ha entrado o uno de sus hijos; si no, 403.
//   · Secciones por audiencia: `member`, las siete; el hijo y el familiar a secas, sin `mcm`. Un `PATCH` con `mcm` de quien no la tiene, `validation`.
//   · `emailNote`: monitor con correo que no es `@movimientoconsolacion.com` → aviso; miembro que no es monitor → nota suave; si no, `null`.
//   · El `PATCH` es estricto, solo escribe lo que cambia (cuenta las escrituras POR CAMPO, `detailWrites()`), valida formatos y opciones, y responde
//     con los datos releídos. Los consentimientos solo cambian los que llegan. `identityFill` solo escribe lo vacío, y el documento con su letra.
//   · La salud va aparte (`/health`); nunca sale en los datos.
//   · Mismo `clientId` = mismo resultado, sin volver a escribir.
//
// El estado vive POR datos (`WeakMap`): `reset()` del falso lo deja como al principio.

import {
  HealthWrite,
  PersonDetails,
  PersonDetailsWrite,
  DetailsWriteResult,
  ProfileHealth,
  WriteResult,
  type HealthInfo,
  type Role,
  type RouteName,
} from '../contract';
import { ComunicaApiError, type ComunicaApi } from '../client';
import type { FakeData, PersonaId } from './fixtures';
import { allowedProfile, FAKE_CHILDREN, FAKE_NEW_CHILD } from './profiles';
import { isValidDocument } from '@/utils/comunica/documentId';
import {
  EMAIL_PATTERN,
  YEAR_MAX,
  YEAR_MIN,
} from '@/utils/comunica/personDetails';

export interface DetailsCtx {
  data: () => FakeData;
  gate: (route: RouteName, write?: boolean) => Promise<void>;
  persona: () => PersonaId;
  roles: () => readonly Role[];
  nowIso: () => string;
  seen: Map<string, unknown>;
  bumpWrites: (n?: number) => void;
  controls: () => { profilesDown: boolean; newChildNext: boolean };
}

export type DetailsKeys =
  | 'getProfileDetails'
  | 'updateProfileDetails'
  | 'getProfileHealth'
  | 'updateProfileHealth'
  | 'detailWrites';
type DetailsApi = Pick<ComunicaApi, Exclude<DetailsKeys, 'detailWrites'>>;

/** Lo que el falso enseña a los tests: cuántas veces se escribió cada campo (`email`, `consents.photos`, `health.allergies`…). */
export interface DetailsLog {
  detailWrites(): Readonly<Record<string, number>>;
}

type Stored = Omit<PersonDetails, 'generatedAt' | 'sections' | 'emailNote'>;

const forbidden = () =>
  new ComunicaApiError('forbidden', 'No tienes acceso a esto', 403);
const validation = (reason: string, message: string) =>
  new ComunicaApiError('validation', message, 422, reason);

export const FAKE_OPTIONS: PersonDetails['options'] = {
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
  shirtSize: ['4', '8', '12', 'S', 'M', 'L', 'XL'].map((v) => ({
    value: v,
    label: v,
  })),
  localMcm: [
    { value: 'castellon', label: 'MCM Castellón' },
    { value: 'granada', label: 'MCM Granada' },
    { value: 'madird', label: 'MCM Madrid' },
    { value: 'otros', label: 'Otros' },
  ],
  region: [
    { value: 'andalucia', label: 'Andalucía' },
    { value: 'madrid', label: 'Comunidad de Madrid' },
    { value: 'valencia', label: 'Comunitat Valenciana' },
  ],
};

const blank = (): Stored => ({
  identity: {
    firstName: '',
    lastName: '',
    documentType: null,
    documentNumber: null,
    birthDate: null,
  },
  gender: null,
  documentSupportNumber: null,
  documentIssueDate: null,
  contact: { email: null, mobile: null, emergencyPhone: null },
  address: {
    street: null,
    city: null,
    province: null,
    postalCode: null,
    region: null,
  },
  photoUrl: null,
  mcm: null,
  consents: { dataProtection: null, healthData: null, photos: null },
  options: FAKE_OPTIONS,
});

const MCM_BLANK = {
  stage: null,
  comLevel: null,
  shirtSize: null,
  groupName: null,
  localMcm: null,
  scarf: null,
  lcIncorporationYear: null,
  memberSince: null,
};

/** Lo que cada persona de prueba tiene en el CRM (por id de ficha). */
const SEEDS: Record<string, (s: Stored) => void> = {
  // Familiar con dos hijos: su DNI y sus tres autorizaciones.
  'f-per-familia': (s) => {
    s.identity.documentType = 'nif';
    s.identity.documentNumber = '12345678Z';
    s.identity.birthDate = '1980-02-14';
    s.gender = 'female';
    s.contact = {
      email: 'marta@ejemplo.org',
      mobile: '600111222',
      emergencyPhone: '600333444',
    };
    s.address = {
      street: 'Calle Mayor 3',
      city: 'Villaclara',
      province: 'Castellón',
      postalCode: '12001',
      region: 'valencia',
    };
    s.consents = { dataProtection: true, healthData: true, photos: true };
  },
  // La hija con las tres autorizaciones SIN CONTESTAR (null): que guardar no las convierta en «no».
  'f-hijo-lucia': (s) => {
    s.identity.birthDate = '2014-05-05';
    s.gender = 'female';
    s.address.city = 'Villaclara';
  },
  // El hijo sin nombre, con soporte y expedición del DNI.
  'f-hijo-sin-nombre': (s) => {
    s.identity.documentType = 'nif';
    s.identity.documentNumber = '87654321X';
    s.documentSupportNumber = 'BAA123456';
    s.documentIssueDate = '2021-03-15';
    s.consents = { dataProtection: true, healthData: false, photos: null };
  },
  'f-per-familia-uno': (s) => {
    s.identity.documentType = 'nif';
    s.identity.documentNumber = '12345678Z';
    s.contact.email = 'pablo@ejemplo.org';
  },
  'f-hijo-nico': (s) => {
    s.identity.birthDate = '2012-09-30';
    s.gender = 'male';
  },
  // Quien paga y no tiene DNI ni correo: el rebote del pago.
  'f-per-familia-ninguno': (s) => {
    s.identity.firstName = 'Carmen';
    s.identity.lastName = 'Ibáñez Roca';
  },
  // Monitora y madre: correo de Gmail (aviso), con su bloque MCM.
  'f-per-monitora-madre': (s) => {
    s.identity.documentType = 'nif';
    s.identity.documentNumber = '12345678Z';
    s.contact = {
      email: 'laura@gmail.com',
      mobile: '611222333',
      emergencyPhone: null,
    };
    s.mcm = {
      ...MCM_BLANK,
      stage: 'com',
      comLevel: 'crecimiento',
      scarf: 'green',
      shirtSize: 'M',
      groupName: 'Los Búhos',
      memberSince: 2009,
    };
    s.consents = { dataProtection: true, healthData: true, photos: true };
  },
  'f-hija-ines': (s) => {
    s.identity.birthDate = '2016-01-20';
    s.gender = 'female';
  },
  // Miembro que no es monitor: nota suave; LC Incorporado (enseña el año).
  'f-per-miembro': (s) => {
    s.identity.documentType = 'nie';
    s.identity.documentNumber = 'X1234567L';
    s.contact.email = 'jaime@gmail.com';
    s.mcm = {
      ...MCM_BLANK,
      stage: 'lc_incorporated',
      lcIncorporationYear: 2018,
      scarf: 'red',
      localMcm: 'castellon',
    };
    s.consents = { dataProtection: true, healthData: null, photos: null };
  },
};

interface State {
  stored: Map<string, Stored>;
  health: Map<string, HealthInfo>;
  writes: Record<string, number>;
}
const states = new WeakMap<FakeData, State>();

export function detailsRoutes(ctx: DetailsCtx): DetailsApi & DetailsLog {
  const state = (): State => {
    const d = ctx.data();
    let s = states.get(d);
    if (!s) {
      s = { stored: new Map(), health: new Map(), writes: {} };
      states.set(d, s);
    }
    return s;
  };
  const nameOf = (id: string): { first: string; last: string } => {
    const person = ctx.data().people.find((p) => p.id === id);
    if (person) return { first: person.firstName, last: person.lastName };
    const kid = [...Object.values(FAKE_CHILDREN).flat(), FAKE_NEW_CHILD].find(
      (c) => c?.id === id,
    );
    return { first: kid?.firstName ?? '', last: kid?.lastName ?? '' };
  };
  const storedOf = (id: string, self: boolean): Stored => {
    const s = state();
    let st = s.stored.get(id);
    if (!st) {
      st = blank();
      const n = nameOf(id);
      st.identity.firstName = n.first;
      st.identity.lastName = n.last;
      SEEDS[id]?.(st);
      // Quien no es miembro no tiene bloque MCM (aunque el CRM lo guarde).
      if (!self) st.mcm = null;
      s.stored.set(id, st);
    }
    return st;
  };
  const isMemberAudience = (self: boolean) =>
    self && ctx.roles().includes('member');
  const emailNoteOf = (st: Stored, self: boolean) => {
    const mcmMail = (st.contact.email ?? '')
      .toLowerCase()
      .includes('@movimientoconsolacion.com');
    if (self && ctx.roles().includes('monitor') && !mcmMail)
      return 'mcm_email_warning' as const;
    if (isMemberAudience(self) && !ctx.roles().includes('monitor'))
      return 'mcm_email_soft' as const;
    return null;
  };
  const view = (id: string, self: boolean): PersonDetails => {
    const st = storedOf(id, self);
    const member = isMemberAudience(self);
    return PersonDetails.parse({
      generatedAt: ctx.nowIso(),
      sections: member
        ? [
            'identity',
            'contact',
            'address',
            'photo',
            'mcm',
            'health',
            'consents',
          ]
        : ['identity', 'contact', 'address', 'photo', 'health', 'consents'],
      ...st,
      mcm: member ? (st.mcm ?? { ...MCM_BLANK }) : null,
      emailNote: emailNoteOf(st, self),
    });
  };
  const count = (key: string) => {
    const w = state().writes;
    w[key] = (w[key] ?? 0) + 1;
  };

  return {
    detailWrites: () => state().writes,

    async getProfileDetails(pid) {
      await ctx.gate('profileDetails');
      const who = allowedProfile(ctx as never, pid);
      return view(who.id, who.self);
    },

    async updateProfileDetails(pid, body) {
      await ctx.gate('updateProfileDetails', true);
      const who = allowedProfile(ctx as never, pid);
      const parsed = PersonDetailsWrite.safeParse(body);
      if (!parsed.success)
        throw validation('bad_body', 'Los datos no tienen la forma esperada');
      const w = parsed.data;
      // Mismo `clientId`: no se escribe otra vez; se devuelven los datos releídos.
      if (ctx.seen.has(w.clientId))
        return DetailsWriteResult.parse({
          clientId: w.clientId,
          status: 'applied',
          details: view(who.id, who.self),
        });
      const st = storedOf(who.id, who.self);
      const c = w.changes;
      if (c.mcm && !isMemberAudience(who.self))
        throw validation(
          'section_not_allowed',
          'Esa sección no es de esta persona',
        );

      // Formatos y opciones, antes de escribir nada.
      const oneOf = (
        list: { value: string }[],
        v: string | null | undefined,
        label: string,
      ) => {
        if (v != null && v !== '' && !list.some((o) => o.value === v))
          throw validation('bad_option', `«${label}» no es una opción válida`);
      };
      if (
        c.contact?.email != null &&
        c.contact.email !== '' &&
        !EMAIL_PATTERN.test(c.contact.email)
      )
        throw validation('bad_email', 'El correo electrónico no es válido');
      if (
        c.address?.postalCode != null &&
        c.address.postalCode !== '' &&
        !/^\d{5}$/.test(c.address.postalCode)
      )
        throw validation(
          'bad_postal_code',
          'El código postal son cinco cifras',
        );
      for (const y of [c.mcm?.lcIncorporationYear, c.mcm?.memberSince])
        if (y != null && (y < YEAR_MIN || y > YEAR_MAX))
          throw validation('bad_year', 'No es un año válido');
      oneOf(FAKE_OPTIONS.gender, c.gender, 'Género');
      oneOf(FAKE_OPTIONS.region, c.address?.region, 'Comunidad Autónoma');
      oneOf(FAKE_OPTIONS.stage, c.mcm?.stage, 'Etapa');
      oneOf(FAKE_OPTIONS.comLevel, c.mcm?.comLevel, 'Nivel COM');
      oneOf(FAKE_OPTIONS.shirtSize, c.mcm?.shirtSize, 'Talla');
      oneOf(FAKE_OPTIONS.localMcm, c.mcm?.localMcm, 'MCM Local');
      const fill = c.identityFill;
      if (fill) {
        const idn = st.identity;
        const taken: [unknown, string, string][] = [
          [fill.firstName, idn.firstName, 'Nombre'],
          [fill.lastName, idn.lastName, 'Apellidos'],
          [fill.documentType, idn.documentType ?? '', 'Tipo de documento'],
          [
            fill.documentNumber,
            idn.documentNumber ?? '',
            'Número de documento',
          ],
        ];
        for (const [v, now, label] of taken)
          if (v !== undefined && now.trim() !== '')
            throw validation(
              'identity_already_set',
              `«${label}» ya está en tu ficha y no se cambia desde aquí`,
            );
        oneOf(
          FAKE_OPTIONS.documentType,
          fill.documentType,
          'Tipo de documento',
        );
        const type = fill.documentType ?? idn.documentType;
        if (
          fill.documentNumber !== undefined &&
          !isValidDocument(type, fill.documentNumber)
        )
          throw validation(
            'bad_document',
            'El número de documento no es válido',
          );
      }

      // Solo se escribe lo que cambia.
      let changed = 0;
      const put = <T>(
        key: string,
        current: T,
        next: T | undefined,
        set: (v: T) => void,
      ) => {
        if (
          next === undefined ||
          JSON.stringify(current) === JSON.stringify(next)
        )
          return;
        set(next);
        count(key);
        changed += 1;
      };
      put('gender', st.gender, c.gender, (v) => (st.gender = v));
      put(
        'documentSupportNumber',
        st.documentSupportNumber,
        c.documentSupportNumber,
        (v) => (st.documentSupportNumber = v),
      );
      put(
        'documentIssueDate',
        st.documentIssueDate,
        c.documentIssueDate,
        (v) => (st.documentIssueDate = v),
      );
      for (const k of ['email', 'mobile', 'emergencyPhone'] as const)
        put(k, st.contact[k], c.contact?.[k], (v) => (st.contact[k] = v));
      for (const k of [
        'street',
        'city',
        'province',
        'postalCode',
        'region',
      ] as const)
        put(k, st.address[k], c.address?.[k], (v) => (st.address[k] = v));
      if (c.mcm && st.mcm === null) st.mcm = { ...MCM_BLANK };
      if (c.mcm && st.mcm) {
        const m = st.mcm;
        for (const k of [
          'stage',
          'comLevel',
          'shirtSize',
          'groupName',
          'localMcm',
          'scarf',
          'lcIncorporationYear',
          'memberSince',
        ] as const)
          put(
            `mcm.${k}`,
            m[k],
            c.mcm[k],
            (v) => ((m as Record<string, unknown>)[k] = v),
          );
      }
      // Las autorizaciones: solo las que llegan (nunca se toca una que no se ha mandado).
      for (const k of ['dataProtection', 'healthData', 'photos'] as const) {
        const next = c.consents?.[k];
        if (next === undefined) continue;
        count(`consents.${k}`);
        changed += st.consents[k] === next ? 0 : 1;
        st.consents[k] = next;
      }
      if (fill) {
        for (const [k, v] of Object.entries(fill)) {
          if (v === undefined) continue;
          count(`identity.${k}`);
          changed += 1;
          if (k === 'firstName') st.identity.firstName = v;
          if (k === 'lastName') st.identity.lastName = v;
          if (k === 'documentType') st.identity.documentType = v;
          if (k === 'documentNumber')
            st.identity.documentNumber = v.toUpperCase();
        }
      }
      if (changed > 0) ctx.bumpWrites(1);
      ctx.seen.set(w.clientId, true);
      return DetailsWriteResult.parse({
        clientId: w.clientId,
        status: 'applied',
        details: view(who.id, who.self),
      });
    },

    async getProfileHealth(pid) {
      await ctx.gate('profileHealth');
      const who = allowedProfile(ctx as never, pid);
      const h = state().health.get(who.id) ?? {
        foodIntolerances: who.id === 'f-hijo-lucia' ? 'Sin gluten' : null,
        allergies: null,
        illnesses: null,
        treatments: null,
        other: null,
      };
      return ProfileHealth.parse({ generatedAt: ctx.nowIso(), health: h });
    },

    async updateProfileHealth(pid, body) {
      await ctx.gate('updateProfileHealth', true);
      const who = allowedProfile(ctx as never, pid);
      const parsed = HealthWrite.safeParse(body);
      if (!parsed.success)
        throw validation('bad_body', 'Los datos no tienen la forma esperada');
      const w = parsed.data;
      if (ctx.seen.has(w.clientId))
        return WriteResult.parse({ clientId: w.clientId, status: 'applied' });
      const s = state();
      const current: HealthInfo = s.health.get(who.id) ?? {
        foodIntolerances: who.id === 'f-hijo-lucia' ? 'Sin gluten' : null,
        allergies: null,
        illnesses: null,
        treatments: null,
        other: null,
      };
      const next = { ...current };
      let changed = 0;
      for (const [k, v] of Object.entries(w.health) as [
        keyof HealthInfo,
        string | null,
      ][]) {
        if (v === undefined || v === next[k]) continue;
        if (v != null && v.length > 2000)
          throw validation('value_too_long', 'El texto es demasiado largo');
        next[k] = v;
        count(`health.${k}`);
        changed += 1;
      }
      s.health.set(who.id, next);
      if (changed > 0) ctx.bumpWrites(1);
      ctx.seen.set(w.clientId, true);
      return WriteResult.parse({ clientId: w.clientId, status: 'applied' });
    },
  };
}

export { forbidden as detailsForbidden };
