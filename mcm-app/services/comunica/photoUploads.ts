// services/comunica/photoUploads.ts
//
// La foto de perfil que se está subiendo (plan 12), POR PERSONA. Como los títulos del plan 09 (`uploads.ts`): DIRECTA, con conexión y NUNCA por la
// cola de escrituras (la cola se guarda en el móvil y la foto de un menor no debe quedarse ahí).
//
//   · Se sube en cuanto se elige y se recorta, sin esperar a «Guardar».
//   · Lo que se está subiendo vive SOLO en memoria. Sin conexión o con el CRM sin contestar, «no se ha subido» y «Reintentar» con el MISMO
//     `clientId` (un timeout no es un fallo: el CRM suele terminar la escritura después, y volver a subir la misma foto solo la pisa).
//   · La copia que dejó el selector se borra al subir, al descartar y al salir del área.
//   · Al acabar la sesión (salir o revocada) se olvida todo y lo que estuviera en vuelo ya no escribe nada.

import { getComunicaApi } from './index';
import { isComunicaApiError, type UploadFile } from './client';
import { deleteLocalCopy } from './localFiles';
import { onSessionEnd } from './session';
import { photoErrorText, photoRetryable } from '@/utils/comunica/photo';
import { uuidV4 } from '@/utils/comunica/uuid';
import { logger } from '@/utils/logger';

export type PhotoPhase = 'sending' | 'applied' | 'failed';

export interface PhotoEntry {
  pid: string;
  clientId: string;
  file: UploadFile;
  phase: PhotoPhase;
  /** Por qué no ha subido, en palabras de persona. */
  message?: string;
  /** ¿Tiene sentido «Reintentar» con esta misma foto? (No si el servidor la rechazó por lo que es.) */
  retryable?: boolean;
  /** La URL versionada nueva, una vez subida. */
  photoUrl?: string;
}

let entries = new Map<string, PhotoEntry>();
const listeners = new Set<() => void>();
const onDone = new Map<string, (photoUrl: string) => void>();
/** Cambia al acabar la sesión: lo que vuelva de antes no se escribe. */
let generation = 0;
let offEnd: (() => void) | null = null;

const emit = () => listeners.forEach((l) => l());
const put = (e: PhotoEntry) => {
  entries = new Map(entries).set(e.pid, e);
  emit();
};

export const getPhotoUpload = (pid: string) => entries.get(pid);
export function subscribePhotoUploads(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

async function send(pid: string) {
  const e = entries.get(pid);
  if (!e) return;
  const gen = generation;
  put({ ...e, phase: 'sending', message: undefined, retryable: undefined });
  try {
    const r = await getComunicaApi().uploadProfilePhoto(
      pid,
      { clientId: e.clientId },
      e.file,
    );
    if (gen !== generation || entries.get(pid)?.clientId !== e.clientId) return;
    deleteLocalCopy(e.file.uri);
    put({
      ...e,
      phase: 'applied',
      message: undefined,
      retryable: undefined,
      photoUrl: r.photoUrl,
    });
    onDone.get(pid)?.(r.photoUrl);
  } catch (err) {
    if (gen !== generation || entries.get(pid)?.clientId !== e.clientId) return;
    const known = isComunicaApiError(err);
    if (!known) logger.error('[comunica] subida de foto con fallo de la app');
    put({
      ...e,
      phase: 'failed',
      message: known
        ? photoErrorText(err.code, err.reason)
        : photoErrorText('internal'),
      retryable: known ? photoRetryable(err.code) : true,
    });
  }
}

/**
 * Sube una foto YA comprobada. Elegir otra antes de que acabe la sustituye (y borra la copia de la anterior). `onApplied` recibe la URL nueva
 * para que quien llama la ponga en su caché.
 */
export function startPhotoUpload(
  pid: string,
  file: UploadFile,
  onApplied?: (photoUrl: string) => void,
): Promise<void> {
  offEnd?.();
  offEnd = onSessionEnd(clearPhotoUploads);
  const prev = entries.get(pid);
  if (prev && prev.file.uri !== file.uri) deleteLocalCopy(prev.file.uri);
  if (onApplied) onDone.set(pid, onApplied);
  put({ pid, clientId: uuidV4(), file, phase: 'sending' });
  return send(pid);
}

/** «Reintentar»: la misma foto y el mismo `clientId`. */
export function retryPhotoUpload(pid: string): Promise<void> {
  const e = entries.get(pid);
  if (!e || e.phase !== 'failed' || e.retryable === false)
    return Promise.resolve();
  return send(pid);
}

/** Se olvida (y se borra la copia). Lo que está en vuelo se deja acabar. */
export function dismissPhotoUpload(pid: string): void {
  const e = entries.get(pid);
  if (!e || e.phase === 'sending') return;
  deleteLocalCopy(e.file.uri);
  entries = new Map(entries);
  entries.delete(pid);
  onDone.delete(pid);
  emit();
}

/** Salir o cambiar de persona: nada de antes sigue, ni sus copias. */
export function clearPhotoUploads(): void {
  generation += 1;
  entries.forEach((e) => deleteLocalCopy(e.file.uri));
  entries = new Map();
  onDone.clear();
  emit();
}
