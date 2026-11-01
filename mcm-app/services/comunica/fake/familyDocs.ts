// services/comunica/fake/familyDocs.ts
//
// Documentos y sesiones de familias en el servidor falso (plan 16). Va aparte
// de `index.ts`, como los perfiles, y se porta como el middleware
// (`comunicaMiddleware:src/app/profile-docs{,-write}.ts`):
//
//   · `pid` comprobado en CADA petición (`allowedProfile`): ajeno → 403.
//   · Un documento ajeno, borrado o inexistente → 403 (nunca «no es tuyo»).
//     El archivo de uno sin archivo → 404.
//   · Subir: nombre, archivo de la lista, 1 byte a 4 MB; estado «Activo»,
//     fecha de hoy. Editar: solo lo que viene. Borrar: lo quita. Las tres,
//     sin duplicar con el mismo `clientId`; con «CRM caído», fallan antes
//     de escribir (el `gate` de escritura).
//   · La sesión: solo si está en el calendario del perfil (= inscripción
//     activa a su evento); si no, 403.
//   · Archivos: un PDF y un PNG mínimos de verdad; el resto, bytes con la
//     firma de su tipo.

import {
  DocumentResponse,
  DocumentsResponse,
  type RouteName,
  SessionResponse,
  WriteResult,
} from '../contract';
import {
  ComunicaApiError,
  type ComunicaApi,
  type FileTransport,
} from '../client';
import type { FakeData } from './fixtures';
import { calendarFor } from './profiles';
import { addDays } from '@/utils/comunica/madrid';
import {
  documentFileProblem,
  extensionOf,
  mimeOfName,
} from '@/utils/comunica/files';

export interface FamilyDocsCtx {
  data: () => FakeData;
  gate: (route: RouteName, write?: boolean) => Promise<void>;
  /** ¿Puede quien llama ver a `pid`? (lanza 503 si el CRM no contesta). */
  allowedProfile: (pid: string) => boolean;
  today: () => string;
  nowIso: () => string;
  seen: Map<string, unknown>;
  bumpWrites: (n?: number) => void;
  files?: FileTransport;
}

export type FamilyDocsKeys =
  | 'getProfileDocuments'
  | 'getProfileDocument'
  | 'getProfileDocumentFile'
  | 'uploadProfileDocument'
  | 'updateProfileDocument'
  | 'deleteProfileDocument'
  | 'getProfileSession';

export interface FamilyDocsFake {
  /** Vuelve a los documentos de partida (`reset()` del falso). */
  resetFamilyDocs(): void;
}

interface FakeDoc {
  id: string;
  name: string;
  fileName: string | null;
  status: { key: string; label: string } | null;
  activeOn: string | null;
  expiresOn: string | null;
  description: string | null;
  category: { key: string; label: string } | null;
  sharedLink: string | null;
}

const forbidden = () =>
  new ComunicaApiError('forbidden', 'No tienes acceso a esto', 403);
const validation = (reason: string, message: string) =>
  new ComunicaApiError('validation', message, 422, reason);

const ACTIVE = { key: 'Active', label: 'Activo' };
const DRAFT = { key: 'Draft', label: 'Borrador' };

const b64 = (s: string) =>
  Uint8Array.from(globalThis.atob(s), (c) => c.charCodeAt(0));
const ascii = (s: string) => Uint8Array.from(s, (c) => c.charCodeAt(0));

/** Un PDF de una página, mínimo pero que abre. */
const PDF = ascii(
  '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n' +
    '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n' +
    '3 0 obj<</Type/Page/MediaBox[0 0 300 200]/Parent 2 0 R/Contents 4 0 R' +
    '/Resources<</Font<</F1 5 0 R>>>>>>endobj\n' +
    '4 0 obj<</Length 58>>stream\nBT /F1 18 Tf 30 100 Td (Documento de prueba) Tj ET\nendstream endobj\n' +
    '5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\n' +
    'trailer<</Root 1 0 R>>\n%%EOF\n',
);
/** Un PNG de 16 × 16 de un solo color. */
const PNG = b64(
  'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAFklEQVR4nGPI8Z5HEmIY1TCqYfhqAAAXplUQcMB0KwAAAABJRU5ErkJggg==',
);
/** El resto: con la firma de su tipo (un zip para DOCX, texto…). */
const bytesOf = (fileName: string): Uint8Array => {
  const ext = extensionOf(fileName);
  if (ext === 'pdf') return PDF;
  if (ext === 'png' || ext === 'jpg' || ext === 'jpeg') return PNG;
  if (ext === 'docx' || ext === 'xlsx') {
    return Uint8Array.from([0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0]);
  }
  return ascii('Archivo de prueba del servidor falso.\n');
};

let seq = 0;
const newId = () => {
  seq += 1;
  return `f-d0c-${String(seq).padStart(4, '0')}-a1b2`;
};

/** Los documentos de partida de un perfil (relativos a hoy). */
function seedFor(pid: string, today: string): FakeDoc[] {
  const doc = (
    name: string,
    fileName: string | null,
    activeAgo: number | null,
    extra: Partial<FakeDoc> = {},
  ): FakeDoc => ({
    id: newId(),
    name,
    fileName,
    status: ACTIVE,
    activeOn: activeAgo === null ? null : addDays(today, -activeAgo),
    expiresOn: null,
    description: null,
    category: null,
    sharedLink: null,
    ...extra,
  });
  // El hijo sin nombre: vacío, para ver el estado.
  if (pid === 'f-fam-sin-nombre') return [];
  if (pid === 'f-fam-lucia') {
    return [
      doc('Autorización de imagen 2026-2027', 'autorizacion-imagen.pdf', 12, {
        description: 'Firmada por los dos tutores.',
        category: { key: 'authorization', label: 'Autorización' },
      }),
      doc('Foto de la tarjeta sanitaria', 'tarjeta-sanitaria.png', 30),
      doc('Justificante de pago del campamento', 'justificante.docx', 45, {
        sharedLink: 'https://example.org/justificante',
      }),
      doc('Ficha médica', null, null, { status: DRAFT }),
      doc('Autorización de salida al Moncayo', 'salida-moncayo.pdf', 120, {
        expiresOn: addDays(today, -1),
      }),
    ];
  }
  return [
    doc('Certificado de bautismo', 'certificado-bautismo.pdf', 60),
    doc('DNI (anverso)', 'dni.jpg', 200),
  ];
}

export function familyDocsRoutes(
  ctx: FamilyDocsCtx,
): Pick<ComunicaApi, FamilyDocsKeys> & FamilyDocsFake {
  let store = new Map<string, FakeDoc[]>();
  const docsOf = (pid: string) => {
    if (!store.has(pid)) store.set(pid, seedFor(pid, ctx.today()));
    return store.get(pid)!;
  };
  const requireProfile = (pid: string) => {
    if (!ctx.allowedProfile(pid)) throw forbidden();
  };
  const find = (pid: string, id: string) => {
    const d = docsOf(pid).find((x) => x.id === id);
    if (!d) throw forbidden();
    return d;
  };
  const summary = ({
    description: _d,
    category: _c,
    sharedLink: _s,
    ...rest
  }: FakeDoc) => rest;
  const checkFile = (file: { name: string; size: number }) => {
    const p = documentFileProblem(file);
    if (p === 'bad_type') {
      throw validation(
        'bad_file_type',
        'Ese tipo de archivo no se puede subir.',
      );
    }
    if (p === 'empty') throw validation('empty_file', 'El archivo está vacío.');
    if (p === 'too_big') {
      throw validation('file_too_big', 'Ese archivo pesa más de 4 MB.');
    }
  };
  const remember = (clientId: string, id: string) => {
    const r = WriteResult.parse({ clientId, status: 'applied', crmIds: [id] });
    ctx.seen.set(clientId, r);
    ctx.bumpWrites();
    return r;
  };
  const repeated = (clientId: string) => {
    const r = ctx.seen.get(clientId);
    return r ? WriteResult.parse(r) : null;
  };

  return {
    resetFamilyDocs() {
      store = new Map();
    },

    async getProfileDocuments(pid) {
      await ctx.gate('profileDocuments');
      requireProfile(pid);
      const today = ctx.today();
      const all = docsOf(pid).map(summary);
      const expired = (d: { expiresOn: string | null }) =>
        d.expiresOn !== null && d.expiresOn < today;
      return DocumentsResponse.parse({
        generatedAt: ctx.nowIso(),
        documents: [...all.filter((d) => !expired(d)), ...all.filter(expired)],
      });
    },

    async getProfileDocument(pid, id) {
      await ctx.gate('profileDocument');
      requireProfile(pid);
      return DocumentResponse.parse({
        generatedAt: ctx.nowIso(),
        document: find(pid, id),
      });
    },

    async getProfileDocumentFile(pid, id, onProgress) {
      await ctx.gate('profileDocumentFile');
      requireProfile(pid);
      const d = find(pid, id);
      if (!d.fileName) {
        throw new ComunicaApiError('not_found', 'No está disponible.', 404);
      }
      const bytes = bytesOf(d.fileName);
      const mimeType = mimeOfName(d.fileName);
      onProgress?.(1);
      const localUri = ctx.files
        ? await ctx.files.saveBytes(bytes, d.fileName, mimeType)
        : `data:${mimeType};base64,${globalThis.btoa(String.fromCharCode(...bytes))}`;
      return { localUri, fileName: d.fileName, mimeType };
    },

    async uploadProfileDocument(pid, fields, file) {
      await ctx.gate('uploadProfileDocument', true);
      const again = repeated(fields.clientId);
      if (again) return again;
      requireProfile(pid);
      const name = fields.name.trim();
      if (!name || name.length > 200) {
        throw validation('bad_body', 'Escribe un nombre para el documento.');
      }
      checkFile(file);
      const d: FakeDoc = {
        id: newId(),
        name,
        fileName: file.name,
        status: ACTIVE,
        activeOn: ctx.today(),
        expiresOn: null,
        description: fields.description?.trim() || null,
        category: null,
        sharedLink: null,
      };
      docsOf(pid).unshift(d);
      return remember(fields.clientId, d.id);
    },

    async updateProfileDocument(pid, id, fields, file) {
      await ctx.gate('updateProfileDocument', true);
      const again = repeated(fields.clientId);
      if (again) return again;
      requireProfile(pid);
      const d = find(pid, id);
      if (fields.name !== undefined) {
        const name = fields.name.trim();
        if (!name || name.length > 200) {
          throw validation('bad_body', 'Escribe un nombre para el documento.');
        }
        d.name = name;
      }
      if (fields.description !== undefined) {
        d.description = fields.description.trim() || null;
      }
      if (file) {
        checkFile(file);
        d.fileName = file.name;
      }
      return remember(fields.clientId, d.id);
    },

    async deleteProfileDocument(pid, id, clientId) {
      await ctx.gate('deleteProfileDocument', true);
      const again = repeated(clientId);
      if (again) return again;
      requireProfile(pid);
      find(pid, id);
      store.set(
        pid,
        docsOf(pid).filter((x) => x.id !== id),
      );
      return remember(clientId, id);
    },

    async getProfileSession(pid, id) {
      await ctx.gate('profileSession');
      requireProfile(pid);
      const s = calendarFor(ctx.data(), pid, ctx.today()).sessions.find(
        (x) => x.id === id,
      );
      if (!s) throw forbidden();
      return SessionResponse.parse({
        generatedAt: ctx.nowIso(),
        session: {
          ...s,
          description: s.name.startsWith('Sesión')
            ? 'Trae el cuaderno y algo de merienda.'
            : null,
        },
      });
    },
  };
}
