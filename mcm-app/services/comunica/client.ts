// services/comunica/client.ts
//
// La interfaz `ComunicaApi` (lo que la app puede pedir) y el cliente real, que
// habla por HTTP con `mcm-comunica-api`. El servidor falso (`fake/`) implementa
// la MISMA interfaz: las pantallas no saben con cuál hablan, y ninguna importa
// ni uno ni otro directamente — pasan por `getComunicaApi()` (`index.ts`).
//
// Todo lo que llega se valida con los esquemas de `contract.ts`. Una respuesta
// con forma rota es un error tipado (`bad_response`), no un `undefined` que
// revienta tres pantallas más allá.

import { z } from 'zod';
import {
  DELEGATION_HEADER,
  delegationForRequest,
  isTeamPath,
} from './delegation';
import {
  EventsResponse,
  EventRollWriteResult,
  EventRollWrite,
  EventRoll,
  type CodeRequest,
  type DeviceRegistration,
  NoContent,
  CoordinationHome,
  CoordinationSummary,
  FollowUpsResponse,
  type FollowUpWrite,
  FollowUpWriteResult,
  MeetingsResponse,
  type MeetingWrite,
  MeetingWriteResult,
  MonitorDetail,
  MonitorsRoll,
  type MonitorsRollKind,
  type MonitorsRollWrite,
  MonitorsRollWriteResult,
  type SessionTodayWrite,
  SessionTodayResult,
  type Stage,
  type ExchangeRequest,
  WebPass,
  type WebPassRequest,
  CodeResponse,
  ErrorBody,
  type ErrorCode,
  GroupDetail,
  GroupsResponse,
  HealthNote,
  type MembershipGroupWrite,
  type NoticeWrite,
  NoticeWriteResult,
  ParticipantProfile,
  PeopleIndex,
  PersonalData,
  type ScarfWrite,
  WriteResult,
  MeResponse,
  RollDetail,
  type RollWrite,
  RollWriteResult,
  RefreshResponse,
  TodayResponse,
  type VerifyRequest,
  VerifyResponse,
  type DocumentUploadFields,
  MonitorProfile,
  type MonitorProfileWrite,
  MyProfiles,
  CalendarData,
} from './contract';
import { logger } from '@/utils/logger';

export interface ReadOptions {
  /** El `?fresh=1` del pull-to-refresh: el servidor no tira de su caché. */
  fresh?: boolean;
}

export interface ComunicaApi {
  // Acceso (plan 02). Sin sesión.
  requestCode(body: CodeRequest): Promise<CodeResponse>;
  verify(body: VerifyRequest): Promise<VerifyResponse>;
  refresh(refreshToken: string): Promise<RefreshResponse>;
  logout(refreshToken: string): Promise<void>;
  /** Un enlace del plugin (`acceso_magico` o `token`) por una sesión (plan 10). */
  exchange(body: ExchangeRequest): Promise<VerifyResponse>;
  /** Pase de 2 minutos para abrir una página del plugin con la sesión (plan 10). */
  webPass(body: WebPassRequest): Promise<WebPass>;

  getMe(): Promise<MeResponse>;
  getGroups(opts?: ReadOptions): Promise<GroupsResponse>;
  getToday(opts?: ReadOptions): Promise<TodayResponse>;
  getRoll(
    sessionId: string,
    groupId: string,
    opts?: ReadOptions,
  ): Promise<RollDetail>;
  saveRoll(
    sessionId: string,
    groupId: string,
    body: RollWrite,
  ): Promise<RollWriteResult>;
  getHealth(personId: string): Promise<HealthNote>;

  // Grupos y fichas (plan 05).
  getPeople(opts?: ReadOptions): Promise<PeopleIndex>;
  getGroupDetail(groupId: string, opts?: ReadOptions): Promise<GroupDetail>;
  getPerson(personId: string, opts?: ReadOptions): Promise<ParticipantProfile>;
  /** Nunca se guarda: solo con conexión. */
  getPersonal(personId: string): Promise<PersonalData>;
  createNotice(personId: string, body: NoticeWrite): Promise<NoticeWriteResult>;
  setScarf(personId: string, body: ScarfWrite): Promise<WriteResult>;
  assignGroup(
    membershipId: string,
    body: MembershipGroupWrite,
  ): Promise<WriteResult>;

  // Coordinación (plan 06).
  getCoordination(opts?: ReadOptions): Promise<CoordinationHome>;
  getCoordinationSummary(opts?: ReadOptions): Promise<CoordinationSummary>;
  getMonitorsRoll(
    params: MonitorsRollParams,
    opts?: ReadOptions,
  ): Promise<MonitorsRoll>;
  saveMonitorsRoll(
    sessionId: string,
    body: MonitorsRollWrite,
  ): Promise<MonitorsRollWriteResult>;
  getMeetings(opts?: ReadOptions): Promise<MeetingsResponse>;
  createMeeting(body: MeetingWrite): Promise<MeetingWriteResult>;
  getMonitor(monitorId: string, opts?: ReadOptions): Promise<MonitorDetail>;
  /** Nunca se guarda: lo que una persona escribió sobre otra. */
  getFollowUps(monitorId: string): Promise<FollowUpsResponse>;
  createFollowUp(
    monitorId: string,
    body: FollowUpWrite,
  ): Promise<FollowUpWriteResult>;
  createSessionToday(
    eventId: string,
    body: SessionTodayWrite,
  ): Promise<SessionTodayResult>;

  // Pasar lista en un evento (plan 07).
  getEvents(opts?: ReadOptions): Promise<EventsResponse>;
  getEventRoll(eventId: string, opts?: ReadOptions): Promise<EventRoll>;
  saveEventRoll(
    eventId: string,
    body: EventRollWrite,
  ): Promise<EventRollWriteResult>;
  // Avisos en el móvil (plan 08).
  registerDevice(body: DeviceRegistration): Promise<WriteResult>;
  /** Al salir: se borra este móvil (solo el tuyo). */
  unregisterDevice(deviceId: string): Promise<void>;
  // Mis datos de monitor (plan 09).
  getMyMonitorProfile(opts?: ReadOptions): Promise<MonitorProfile>;
  updateMyMonitorProfile(body: MonitorProfileWrite): Promise<WriteResult>;
  /**
   * Subir un título o certificado (multipart). Va DIRECTO, con conexión: el
   * archivo nunca se guarda en la cola del móvil.
   */
  uploadMyDocument(
    fields: DocumentUploadFields,
    file: UploadFile,
  ): Promise<WriteResult>;
  // Familias (plan 11). Todo lo de `pid` cuelga de `/v1/profiles/:pid/…`.
  /** Quién ha entrado y sus hijos. `fresh` al abrir «¿A quién ves?». */
  getMyProfiles(opts?: ReadOptions): Promise<MyProfiles>;
  /** El calendario de `pid` (plan 16; la portada saca de aquí su agenda). */
  getProfileCalendar(pid: string, opts?: ReadOptions): Promise<CalendarData>;
  /**
   * Cómo pedir una foto (`photoUrl`): con el servidor de verdad, la URL con el
   * token; con el falso, su imagen inventada. Ninguna pantalla importa el falso.
   */
  photoSource(url: string): PhotoSource;
}

/** Qué lista de monitores: la semanal (de una etapa) o la de una reunión. */
export interface MonitorsRollParams {
  kind: MonitorsRollKind;
  stage?: Stage;
  session?: string;
}

/**
 * Un archivo elegido en el móvil para subir: la ruta local (nativo) o el
 * `Blob` del navegador (web). No es del contrato: es cómo viaja el `file`.
 */
export interface UploadFile {
  uri: string;
  name: string;
  mimeType: string;
  size: number;
  /** En web, el `File` que da el selector. */
  blob?: Blob;
}

/** Lo que entiende `expo-image` como `source`. */
export interface PhotoSource {
  uri: string;
  headers?: Record<string, string>;
  /** La URL lleva la versión (`?v=`): sirve de clave de caché. */
  cacheKey?: string;
}

/** Lo que puede fallar: los códigos del contrato, más los de la app. */
export type ApiErrorCode = ErrorCode | 'network' | 'bad_response';

export class ComunicaApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  readonly reason?: string;
  /** Con `rate_limited`: segundos que hay que esperar. */
  readonly retryAfter?: number;

  constructor(
    code: ApiErrorCode,
    message: string,
    status = 0,
    reason?: string,
    retryAfter?: number,
  ) {
    super(message);
    this.name = 'ComunicaApiError';
    this.code = code;
    this.status = status;
    this.reason = reason;
    this.retryAfter = retryAfter;
  }

  /** Vale la pena reintentar: el CRM o la red, no la petición. */
  get retryable(): boolean {
    return this.code === 'crm_unavailable' || this.code === 'network';
  }
}

export const isComunicaApiError = (e: unknown): e is ComunicaApiError =>
  e instanceof ComunicaApiError;

/**
 * Sin cuerpo de error del contrato, el código sale del estado HTTP. Un 400 es
 * la petición (no se arregla insistiendo); lo que no esté aquí (500, 502…) se
 * toma por CRM caído y se reintenta.
 */
const STATUS_CODE: Record<number, ErrorCode> = {
  400: 'validation',
  401: 'unauthenticated',
  403: 'forbidden',
  404: 'not_found',
  409: 'conflict',
  422: 'validation',
  429: 'rate_limited',
  503: 'crm_unavailable',
};

/** Cuántas veces se reintenta una LECTURA que falla por red o CRM caído. */
const READ_RETRIES = 1;

export interface HttpClientOptions {
  baseUrl: string;
  /** El token de acceso de la sesión (lo pone el plan 02). */
  getToken?: () => string | null | Promise<string | null>;
  fetchImpl?: typeof fetch;
}

export function createHttpClient({
  baseUrl,
  getToken,
  fetchImpl,
}: HttpClientOptions): ComunicaApi {
  const doFetch =
    fetchImpl ?? ((...a: Parameters<typeof fetch>) => fetch(...a));
  const root = baseUrl.replace(/\/+$/, '');

  async function request<S extends z.ZodType>(
    method: 'GET' | 'PUT' | 'POST' | 'PATCH' | 'DELETE',
    path: string,
    schema: S,
    body?: unknown,
    retries = 0,
  ): Promise<z.infer<S>> {
    const token = getToken ? await getToken() : null;
    // La delegación de trabajo (plan 17), solo en lo de equipo.
    const delegation = isTeamPath(path)
      ? delegationForRequest(method !== 'GET')
      : null;
    // Un archivo va en multipart: el `Content-Type` (con su frontera) lo pone
    // `fetch`, y el cuerpo no se pasa a JSON.
    const isForm = typeof FormData !== 'undefined' && body instanceof FormData;
    let res: Response;
    try {
      res = await doFetch(`${root}${path}`, {
        method,
        headers: {
          Accept: 'application/json',
          ...(body !== undefined && !isForm
            ? { 'Content-Type': 'application/json' }
            : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(delegation ? { [DELEGATION_HEADER]: delegation } : {}),
        },
        body:
          body === undefined
            ? undefined
            : isForm
              ? (body as FormData)
              : JSON.stringify(body),
      });
    } catch {
      if (retries > 0) return request(method, path, schema, body, retries - 1);
      throw new ComunicaApiError('network', 'Sin conexión con el servidor');
    }

    let json: unknown = null;
    try {
      json = await res.json();
    } catch {
      json = null;
    }

    if (!res.ok) {
      const parsed = ErrorBody.safeParse(json);
      const code = parsed.success
        ? parsed.data.error.code
        : (STATUS_CODE[res.status] ?? 'crm_unavailable');
      const err = new ComunicaApiError(
        code,
        parsed.success ? parsed.data.error.message : `HTTP ${res.status}`,
        res.status,
        parsed.success ? parsed.data.error.reason : undefined,
        parsed.success ? parsed.data.error.retryAfter : undefined,
      );
      if (err.retryable && retries > 0) {
        return request(method, path, schema, body, retries - 1);
      }
      if (code === 'forbidden') {
        // Un 403 que la app no esperaba suele ser un fallo de alcance: ids,
        // nunca nombres (`01-cimientos.md` §6).
        logger.warn('[comunica] 403', method, path);
      }
      throw err;
    }

    const parsed = schema.safeParse(json);
    if (!parsed.success) {
      logger.error(
        '[comunica] respuesta con forma rota',
        method,
        path,
        parsed.error.issues.slice(0, 3),
      );
      throw new ComunicaApiError(
        'bad_response',
        'Respuesta inesperada del servidor',
        res.status,
      );
    }
    return parsed.data;
  }

  const q = (opts?: ReadOptions) => (opts?.fresh ? '?fresh=1' : '');
  const isOwnUrl = (url: string) => url.startsWith(`${root}/`);
  const enc = encodeURIComponent;

  return {
    requestCode: (body) => request('POST', '/v1/auth/code', CodeResponse, body),
    verify: (body) => request('POST', '/v1/auth/verify', VerifyResponse, body),
    refresh: (refreshToken) =>
      request('POST', '/v1/auth/refresh', RefreshResponse, { refreshToken }),
    logout: async (refreshToken) => {
      await request('POST', '/v1/auth/logout', z.unknown(), { refreshToken });
    },
    exchange: (body) =>
      request('POST', '/v1/auth/exchange', VerifyResponse, body),
    // El pase nunca se registra: es una llave de 2 minutos.
    webPass: (body) => request('POST', '/v1/web-pass', WebPass, body),
    getMe: () => request('GET', '/v1/me', MeResponse, undefined, READ_RETRIES),
    getGroups: (opts) =>
      request(
        'GET',
        `/v1/groups${q(opts)}`,
        GroupsResponse,
        undefined,
        READ_RETRIES,
      ),
    getToday: (opts) =>
      request(
        'GET',
        `/v1/today${q(opts)}`,
        TodayResponse,
        undefined,
        READ_RETRIES,
      ),
    getRoll: (sid, gid, opts) =>
      request(
        'GET',
        `/v1/sessions/${enc(sid)}/groups/${enc(gid)}/roll${q(opts)}`,
        RollDetail,
        undefined,
        READ_RETRIES,
      ),
    // Las escrituras no se reintentan aquí: las reintenta la cola (plan 01),
    // con el mismo `clientId`.
    saveRoll: (sid, gid, body) =>
      request(
        'PUT',
        `/v1/sessions/${enc(sid)}/groups/${enc(gid)}/roll`,
        RollWriteResult,
        body,
      ),
    // La salud no se reintenta ni se registra: o llega, o «sin conexión».
    getHealth: (id) =>
      request('GET', `/v1/people/${enc(id)}/health`, HealthNote),
    getPeople: (opts) =>
      request(
        'GET',
        `/v1/people${q(opts)}`,
        PeopleIndex,
        undefined,
        READ_RETRIES,
      ),
    getGroupDetail: (gid, opts) =>
      request(
        'GET',
        `/v1/groups/${enc(gid)}${q(opts)}`,
        GroupDetail,
        undefined,
        READ_RETRIES,
      ),
    getPerson: (id, opts) =>
      request(
        'GET',
        `/v1/people/${enc(id)}${q(opts)}`,
        ParticipantProfile,
        undefined,
        READ_RETRIES,
      ),
    getPersonal: (id) =>
      request('GET', `/v1/people/${enc(id)}/personal`, PersonalData),
    createNotice: (id, body) =>
      request('POST', `/v1/people/${enc(id)}/notices`, NoticeWriteResult, body),
    setScarf: (id, body) =>
      request('PUT', `/v1/people/${enc(id)}/scarf`, WriteResult, body),
    assignGroup: (mid, body) =>
      request('PUT', `/v1/memberships/${enc(mid)}/group`, WriteResult, body),
    getCoordination: (opts) =>
      request(
        'GET',
        `/v1/coordination${q(opts)}`,
        CoordinationHome,
        undefined,
        READ_RETRIES,
      ),
    getCoordinationSummary: (opts) =>
      request(
        'GET',
        `/v1/coordination/summary${q(opts)}`,
        CoordinationSummary,
        undefined,
        READ_RETRIES,
      ),
    getMonitorsRoll: (params, opts) => {
      const query = [
        `kind=${enc(params.kind)}`,
        params.stage ? `stage=${enc(params.stage)}` : '',
        params.session ? `session=${enc(params.session)}` : '',
        opts?.fresh ? 'fresh=1' : '',
      ]
        .filter(Boolean)
        .join('&');
      return request(
        'GET',
        `/v1/coordination/monitors-roll?${query}`,
        MonitorsRoll,
        undefined,
        READ_RETRIES,
      );
    },
    saveMonitorsRoll: (sid, body) =>
      request(
        'PUT',
        `/v1/sessions/${enc(sid)}/monitors-roll`,
        MonitorsRollWriteResult,
        body,
      ),
    getMeetings: (opts) =>
      request(
        'GET',
        `/v1/coordination/meetings${q(opts)}`,
        MeetingsResponse,
        undefined,
        READ_RETRIES,
      ),
    createMeeting: (body) =>
      request('POST', '/v1/meetings', MeetingWriteResult, body),
    getMonitor: (id, opts) =>
      request(
        'GET',
        `/v1/monitors/${enc(id)}${q(opts)}`,
        MonitorDetail,
        undefined,
        READ_RETRIES,
      ),
    // Como la salud: no se reintenta ni se guarda; o llega, o «sin conexión».
    getFollowUps: (id) =>
      request('GET', `/v1/monitors/${enc(id)}/follow-ups`, FollowUpsResponse),
    createFollowUp: (id, body) =>
      request(
        'POST',
        `/v1/monitors/${enc(id)}/follow-ups`,
        FollowUpWriteResult,
        body,
      ),
    createSessionToday: (eventId, body) =>
      request(
        'POST',
        `/v1/events/${enc(eventId)}/sessions/today`,
        SessionTodayResult,
        body,
      ),
    getEvents: (opts) =>
      request(
        'GET',
        `/v1/events${q(opts)}`,
        EventsResponse,
        undefined,
        READ_RETRIES,
      ),
    getEventRoll: (id, opts) =>
      request(
        'GET',
        `/v1/events/${enc(id)}/roll${q(opts)}`,
        EventRoll,
        undefined,
        READ_RETRIES,
      ),
    saveEventRoll: (id, body) =>
      request('PUT', `/v1/events/${enc(id)}/roll`, EventRollWriteResult, body),
    // Por la cola (el alta) o directa con tope (el borrado, al salir).
    registerDevice: (body) => request('POST', '/v1/devices', WriteResult, body),
    unregisterDevice: async (deviceId) => {
      await request('DELETE', `/v1/devices/${enc(deviceId)}`, NoContent);
    },
    getMyMonitorProfile: (opts) =>
      request(
        'GET',
        `/v1/me/monitor${q(opts)}`,
        MonitorProfile,
        undefined,
        READ_RETRIES,
      ),
    updateMyMonitorProfile: (body) =>
      request('PATCH', '/v1/me/monitor', WriteResult, body),
    uploadMyDocument: (fields, file) =>
      request(
        'POST',
        '/v1/me/documents',
        WriteResult,
        uploadForm(fields, file),
      ),
    getMyProfiles: (opts) =>
      request(
        'GET',
        `/v1/me/profiles${q(opts)}`,
        MyProfiles,
        undefined,
        READ_RETRIES,
      ),
    getProfileCalendar: (pid, opts) =>
      request(
        'GET',
        `/v1/profiles/${enc(pid)}/calendar${q(opts)}`,
        CalendarData,
        undefined,
        READ_RETRIES,
      ),
    photoSource: (url) => {
      // `expo-image` pide la foto él solo: el token va en la cabecera, y SOLO
      // si la foto es de nuestro servidor (una `photoUrl` de otro dominio no se
      // lleva la sesión). Si aún no hay token de acceso, sin cabecera (dará 401
      // y saldrán las iniciales).
      const token = isOwnUrl(url) ? getToken?.() : null;
      return typeof token === 'string'
        ? {
            uri: url,
            headers: { Authorization: `Bearer ${token}` },
            cacheKey: url,
          }
        : { uri: url, cacheKey: url };
    },
  };
}

/** El multipart de `POST /v1/me/documents`: `clientId`, `kind` y `file`. */
export function uploadForm(
  fields: DocumentUploadFields,
  file: UploadFile,
): FormData {
  const form = new FormData();
  form.append('clientId', fields.clientId);
  form.append('kind', fields.kind);
  if (file.blob) {
    form.append('file', file.blob, file.name);
  } else {
    // React Native sube el archivo desde su ruta con esta forma.
    form.append('file', {
      uri: file.uri,
      name: file.name,
      type: file.mimeType,
    } as unknown as Blob);
  }
  return form;
}
