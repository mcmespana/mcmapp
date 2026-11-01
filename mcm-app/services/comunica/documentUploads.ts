// services/comunica/documentUploads.ts
//
// Los documentos que se están subiendo a un perfil (plan 16). Como los del
// monitor (`uploads.ts`, plan 09): DIRECTOS, con conexión y NUNCA por la cola
// (el nombre y el archivo pueden ser un informe médico o un DNI). Así:
//
//   · Lo que sube vive SOLO en memoria; la lista lo enseña arriba con su
//     `UploadStatus`. Si falla, «Reintentar» (el mismo `clientId`: el
//     servidor no duplica) o «Descartar».
//   · La copia que dejó el selector en la caché se borra al subir, al
//     descartar y al acabar la sesión.
//   · Al acabar la sesión se olvida todo y lo que vuelva ya no escribe.

import { getComunicaApi } from './index';
import { isComunicaApiError, type UploadFile } from './client';
import { deleteLocalCopy } from './localFiles';
import { onSessionEnd } from './session';
import { documentWriteErrorText } from '@/utils/comunica/documents';
import { uuidV4 } from '@/utils/comunica/uuid';

export type DocumentUploadPhase = 'sending' | 'applied' | 'failed';

export interface DocumentUploadEntry {
  pid: string;
  clientId: string;
  name: string;
  description?: string;
  file: UploadFile;
  phase: DocumentUploadPhase;
  message?: string;
}

let entries: DocumentUploadEntry[] = [];
const listeners = new Set<() => void>();
const onApplied = new Map<string, () => void>();
let generation = 0;
let offEnd: (() => void) | null = null;

const emit = () => listeners.forEach((l) => l());
const put = (e: DocumentUploadEntry) => {
  entries = entries.some((x) => x.clientId === e.clientId)
    ? entries.map((x) => (x.clientId === e.clientId ? e : x))
    : [e, ...entries];
  emit();
};

/** Las subidas de un perfil que aún se enseñan (en curso o fallidas). */
export const getDocumentUploads = (): readonly DocumentUploadEntry[] => entries;

export function subscribeDocumentUploads(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

async function send(clientId: string) {
  const e = entries.find((x) => x.clientId === clientId);
  if (!e) return;
  const gen = generation;
  put({ ...e, phase: 'sending', message: undefined });
  try {
    await getComunicaApi().uploadProfileDocument(
      e.pid,
      {
        clientId: e.clientId,
        name: e.name,
        ...(e.description ? { description: e.description } : {}),
      },
      e.file,
    );
    if (gen !== generation) return;
    deleteLocalCopy(e.file.uri);
    // Aplicada: deja de enseñarse (la lista relee y trae el documento).
    entries = entries.filter((x) => x.clientId !== clientId);
    emit();
    onApplied.get(clientId)?.();
    onApplied.delete(clientId);
  } catch (err) {
    if (gen !== generation) return;
    if (!entries.some((x) => x.clientId === clientId)) return;
    put({
      ...e,
      phase: 'failed',
      message: isComunicaApiError(err)
        ? documentWriteErrorText(err.code, err.reason)
        : documentWriteErrorText('internal'),
    });
  }
}

/** Sube un documento YA comprobado. Devuelve su `clientId`. */
export function startDocumentUpload(
  pid: string,
  input: { name: string; description?: string; file: UploadFile },
  applied?: () => void,
): string {
  offEnd ??= onSessionEnd(clearDocumentUploads);
  const clientId = uuidV4();
  if (applied) onApplied.set(clientId, applied);
  put({ pid, clientId, ...input, phase: 'sending' });
  void send(clientId);
  return clientId;
}

/** «Reintentar»: el mismo archivo y el mismo `clientId`. */
export function retryDocumentUpload(clientId: string): Promise<void> {
  const e = entries.find((x) => x.clientId === clientId);
  if (!e || e.phase !== 'failed') return Promise.resolve();
  return send(clientId);
}

/** «Descartar»: se olvida y se borra la copia. */
export function dismissDocumentUpload(clientId: string): void {
  const e = entries.find((x) => x.clientId === clientId);
  if (!e) return;
  deleteLocalCopy(e.file.uri);
  entries = entries.filter((x) => x.clientId !== clientId);
  onApplied.delete(clientId);
  emit();
}

/** Al acabar la sesión: nada de antes sigue, ni sus copias. */
export function clearDocumentUploads(): void {
  generation += 1;
  entries.forEach((e) => deleteLocalCopy(e.file.uri));
  entries = [];
  onApplied.clear();
  emit();
}
