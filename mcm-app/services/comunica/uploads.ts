// services/comunica/uploads.ts
//
// Los títulos y certificados que se están subiendo (plan 09). DIRECTOS, con
// conexión, y NUNCA por la cola de escrituras: la cola se guarda en el móvil
// y un certificado de delitos sexuales no debe quedarse en el almacén (regla
// común de los archivos, `docs/planes/area-nativa/README.md`). Así:
//
//   · Se sube en cuanto se elige, sin esperar a «Guardar».
//   · Lo que está subiendo vive SOLO en memoria: si se cierra la app, se
//     pierde (y se vuelve a elegir). Sin conexión, «no se ha subido» y
//     «Reintentar» con el mismo `clientId` (el servidor no duplica).
//   · La copia que dejó el selector se borra al subir, al descartar y al salir.
//   · Al acabar la sesión (salir o revocada) se olvida todo y lo que estuviera
//     en vuelo ya no escribe nada.

import { getComunicaApi } from './index';
import { isComunicaApiError, type UploadFile } from './client';
import type { DocumentKind } from './contract';
import { deleteLocalCopy } from './localFiles';
import { onSessionEnd } from './session';
import { uploadErrorText } from '@/utils/comunica/monitorProfile';
import { uuidV4 } from '@/utils/comunica/uuid';
import { logger } from '@/utils/logger';

export type UploadPhase = 'sending' | 'applied' | 'failed';

export interface UploadEntry {
  kind: DocumentKind;
  clientId: string;
  file: UploadFile;
  phase: UploadPhase;
  /** Por qué no ha subido, en palabras de persona. */
  message?: string;
}

let entries = new Map<DocumentKind, UploadEntry>();
const listeners = new Set<() => void>();
const onDone = new Map<DocumentKind, () => void>();
/** Cambia al acabar la sesión: lo que vuelva de antes no se escribe. */
let generation = 0;
let offEnd: (() => void) | null = null;

const emit = () => listeners.forEach((l) => l());
const put = (e: UploadEntry) => {
  entries = new Map(entries).set(e.kind, e);
  emit();
};

export const getUpload = (kind: DocumentKind) => entries.get(kind);
export function subscribeUploads(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

async function send(kind: DocumentKind) {
  const e = entries.get(kind);
  if (!e) return;
  const gen = generation;
  put({ ...e, phase: 'sending', message: undefined });
  try {
    await getComunicaApi().uploadMyDocument(
      { clientId: e.clientId, kind },
      e.file,
    );
    if (gen !== generation || entries.get(kind)?.clientId !== e.clientId)
      return;
    deleteLocalCopy(e.file.uri);
    put({ ...e, phase: 'applied' });
    onDone.get(kind)?.();
  } catch (err) {
    if (gen !== generation || entries.get(kind)?.clientId !== e.clientId)
      return;
    if (!isComunicaApiError(err)) {
      logger.error('[comunica] subida con fallo de la app', kind);
    }
    put({
      ...e,
      phase: 'failed',
      message: isComunicaApiError(err)
        ? uploadErrorText(err.code, err.reason)
        : uploadErrorText('internal'),
    });
  }
}

/**
 * Sube un archivo YA comprobado. Elegir otro del mismo tipo antes de que
 * acabe lo sustituye (y borra la copia del anterior).
 */
export function startUpload(
  kind: DocumentKind,
  file: UploadFile,
  onApplied?: () => void,
): Promise<void> {
  offEnd?.();
  offEnd = onSessionEnd(clearUploads);
  const prev = entries.get(kind);
  if (prev && prev.file.uri !== file.uri) deleteLocalCopy(prev.file.uri);
  if (onApplied) onDone.set(kind, onApplied);
  put({ kind, clientId: uuidV4(), file, phase: 'sending' });
  return send(kind);
}

/** «Reintentar»: el mismo archivo y el mismo `clientId`. */
export function retryUpload(kind: DocumentKind): Promise<void> {
  const e = entries.get(kind);
  if (!e || e.phase !== 'failed') return Promise.resolve();
  return send(kind);
}

/** Se olvida (y se borra la copia). */
export function dismissUpload(kind: DocumentKind): void {
  const e = entries.get(kind);
  if (!e) return;
  deleteLocalCopy(e.file.uri);
  entries = new Map(entries);
  entries.delete(kind);
  onDone.delete(kind);
  emit();
}

/** Salir o cambiar de persona: nada de antes sigue, ni sus copias. */
export function clearUploads(): void {
  generation += 1;
  entries.forEach((e) => deleteLocalCopy(e.file.uri));
  entries = new Map();
  onDone.clear();
  emit();
}
