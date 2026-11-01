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
  type AppAccountRequest,
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
  // Familias: plan 12
  PersonDetails,
  type PersonDetailsWrite,
  DetailsWriteResult,
  HealthResponse,
  type HealthWrite,
  // Familias: plan 16
  DocumentsResponse,
  DocumentResponse,
  SessionResponse,
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
  /** El pase de Firebase de la cuenta de la app (Google o Apple) por una sesión (`identidad-app`). */
  appAccount(body: AppAccountRequest): Promise<VerifyResponse>;
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
  // Familias: plan 12 («Mis datos»). Nunca se guarda nada de esto en el
  // móvil y las escrituras van directas (sin la cola), con conexión.
  /** Los datos de `pid`, sin la salud. */
  getProfileDetails(pid: string): Promise<PersonDetails>;
  /** Solo lo que cambia; responde con lo releído. */
  updateProfileDetails(
    pid: string,
    body: PersonDetailsWrite,
  ): Promise<DetailsWriteResult>;
  /** La salud de `pid`: ni se reintenta ni se registra. */
  getProfileHealth(pid: string): Promise<HealthResponse>;
  updateProfileHealth(pid: string, body: HealthWrite): Promise<WriteResult>;
  // Fin del plan 12.
  // Familias: plan 16 (documentos y calendario). Los documentos van DIRECTOS,
  // con conexión y sin cola: ni el nombre ni el archivo se quedan en el móvil.
  getProfileDocuments(
    pid: string,
    opts?: ReadOptions,
  ): Promise<DocumentsResponse>;
  getProfileDocument(pid: string, id: string): Promise<DocumentResponse>;
  /** Baja el archivo a la caché de la app (se borra al cerrar el visor). */
  getProfileDocumentFile(
    pid: string,
    id: string,
    onProgress?: (fraction: number) => void,
  ): Promise<DownloadedFile>;
  uploadProfileDocument(
    pid: string,
    fields: ProfileDocumentFields,
    file: UploadFile,
  ): Promise<WriteResult>;
  /** Solo lo que cambia (y `file` si se sustituye). */
  updateProfileDocument(
    pid: string,
    id: string,
    fields: ProfileDocumentPatch,
    file?: UploadFile,
  ): Promise<WriteResult>;
  deleteProfileDocument(
    pid: string,
    id: string,
    clientId: string,
  ): Promise<WriteResult>;
  getProfileSession(pid: string, id: string): Promise<SessionResponse>;
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

// Familias: plan 16 — los tipos del archivo que se sube y del que se baja.
export interface ProfileDocumentFields {
  clientId: string;
  name: string;
  description?: string;
}
export interface ProfileDocumentPatch {
  clientId: string;
  name?: string;
  description?: string;
}

/** Un archivo bajado a la caché de la app (o un `blob:` en web). */
export interface DownloadedFile {
  localUri: string;
  fileName: string;
  mimeType: string;
}

/**
 * Cómo se baja un archivo y dónde se deja (`openFiles.ts`, nativo y web). Va
 * inyectado para que este fichero no cargue nada nativo.
 */
export interface FileTransport {
  /** GET con cabeceras: el estado, las cabeceras y el archivo ya en la caché. */
  download(
    url: string,
    headers: Record<string, string>,
    fileName: string,
    onProgress?: (fraction: number) => void,
  ): Promise<{
    status: number;
    headers: Record<string, string>;
    uri: string;
  }>;
  /** El texto de un archivo bajado (el cuerpo de un error). */
  readText(uri: string): Promise<string>;
  /** Lo deja en la caché con ese nombre (lo usa el servidor falso). */
  saveBytes(
    bytes: Uint8Array,
    fileName: string,
    mimeType: string,
  ): Promise<string>;
  remove(uri: string): void;
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
  /** Dónde se bajan los archivos (plan 16). Sin él, no se puede abrir nada. */
  files?: FileTransport;
}

export function createHttpClient({
  baseUrl,
  getToken,
  fetchImpl,
  files,
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

  /**
   * Un archivo (plan 16): se baja con el token a la caché de la app y se
   * devuelve dónde ha quedado, con su nombre y tipo (de `Content-Disposition`
   * y `Content-Type`). Un error se lee de su cuerpo, como el de `request`.
   */
  async function download(
    path: string,
    onProgress?: (fraction: number) => void,
  ): Promise<DownloadedFile> {
    if (!files) {
      throw new ComunicaApiError('bad_response', 'No se pueden bajar archivos');
    }
    const token = getToken ? await getToken() : null;
    const fallbackName = 'documento';
    let res: Awaited<ReturnType<FileTransport['download']>>;
    try {
      res = await files.download(
        `${root}${path}`,
        token ? { Authorization: `Bearer ${token}` } : {},
        fallbackName,
        onProgress,
      );
    } catch {
      throw new ComunicaApiError('network', 'Sin conexión con el servidor');
    }
    const header = (name: string) =>
      Object.entries(res.headers).find(
        ([k]) => k.toLowerCase() === name,
      )?.[1] ?? '';
    if (res.status < 200 || res.status >= 300) {
      let body: unknown = null;
      try {
        body = JSON.parse(await files.readText(res.uri));
      } catch {
        body = null;
      }
      files.remove(res.uri);
      const parsed = ErrorBody.safeParse(body);
      throw new ComunicaApiError(
        parsed.success
          ? parsed.data.error.code
          : (STATUS_CODE[res.status] ?? 'crm_unavailable'),
        parsed.success ? parsed.data.error.message : `HTTP ${res.status}`,
        res.status,
        parsed.success ? parsed.data.error.reason : undefined,
      );
    }
    return {
      localUri: res.uri,
      fileName:
        fileNameFromDisposition(header('content-disposition')) ?? fallbackName,
      mimeType:
        header('content-type').split(';')[0].trim() ||
        'application/octet-stream',
    };
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
    appAccount: (body) =>
      request('POST', '/v1/auth/app-account', VerifyResponse, body),
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
    // Familias: plan 12. La salud, como la del 05: sin reintento.
    getProfileDetails: (pid) =>
      request(
        'GET',
        `/v1/profiles/${enc(pid)}/details`,
        PersonDetails,
        undefined,
        READ_RETRIES,
      ),
    updateProfileDetails: (pid, body) =>
      request(
        'PATCH',
        `/v1/profiles/${enc(pid)}/details`,
        DetailsWriteResult,
        body,
      ),
    getProfileHealth: (pid) =>
      request('GET', `/v1/profiles/${enc(pid)}/health`, HealthResponse),
    updateProfileHealth: (pid, body) =>
      request('PUT', `/v1/profiles/${enc(pid)}/health`, WriteResult, body),
    // Fin del plan 12.
    // Familias: plan 16. Sin reintentos en las escrituras: las repite la
    // persona («Reintentar») con el mismo `clientId`.
    getProfileDocuments: (pid, opts) =>
      request(
        'GET',
        `/v1/profiles/${enc(pid)}/documents${q(opts)}`,
        DocumentsResponse,
        undefined,
        READ_RETRIES,
      ),
    getProfileDocument: (pid, id) =>
      request(
        'GET',
        `/v1/profiles/${enc(pid)}/documents/${enc(id)}`,
        DocumentResponse,
        undefined,
        READ_RETRIES,
      ),
    getProfileDocumentFile: (pid, id, onProgress) =>
      download(
        `/v1/profiles/${enc(pid)}/documents/${enc(id)}/file`,
        onProgress,
      ),
    uploadProfileDocument: (pid, fields, file) =>
      request(
        'POST',
        `/v1/profiles/${enc(pid)}/documents`,
        WriteResult,
        profileDocumentForm(fields, file),
      ),
    updateProfileDocument: (pid, id, fields, file) =>
      request(
        'PATCH',
        `/v1/profiles/${enc(pid)}/documents/${enc(id)}`,
        WriteResult,
        profileDocumentForm(fields, file),
      ),
    deleteProfileDocument: (pid, id, clientId) =>
      request(
        'DELETE',
        `/v1/profiles/${enc(pid)}/documents/${enc(id)}?clientId=${enc(clientId)}`,
        WriteResult,
      ),
    getProfileSession: (pid, id) =>
      request(
        'GET',
        `/v1/profiles/${enc(pid)}/sessions/${enc(id)}`,
        SessionResponse,
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

// Familias: plan 16 — el multipart de los documentos de un perfil y el nombre
// del archivo que se baja.

/** `clientId`, y `name`, `description` y `file` solo si vienen. */
export function profileDocumentForm(
  fields: ProfileDocumentFields | ProfileDocumentPatch,
  file?: UploadFile,
): FormData {
  const form = new FormData();
  form.append('clientId', fields.clientId);
  if (fields.name !== undefined) form.append('name', fields.name);
  if (fields.description !== undefined) {
    form.append('description', fields.description);
  }
  if (file) {
    if (file.blob) {
      form.append('file', file.blob, file.name);
    } else {
      form.append('file', {
        uri: file.uri,
        name: file.name,
        type: file.mimeType,
      } as unknown as Blob);
    }
  }
  return form;
}

/** El nombre de `Content-Disposition` (`filename*=UTF-8''…` primero). */
export function fileNameFromDisposition(value: string): string | null {
  const star = /filename\*=UTF-8''([^;]+)/i.exec(value);
  if (star) {
    try {
      return decodeURIComponent(star[1].trim());
    } catch {
      // cae al nombre ASCII
    }
  }
  const plain = /filename="?([^";]+)"?/i.exec(value);
  return plain ? plain[1].trim() : null;
}
