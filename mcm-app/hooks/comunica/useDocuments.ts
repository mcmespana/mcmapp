// hooks/comunica/useDocuments.ts
//
// Los documentos de la persona que se ve (plan 16): la lista, la ficha, las
// subidas en curso y las escrituras (editar y borrar). Todo por
// `useProfileQuery` (la clave lleva el pid) y con `persist: false` del
// contrato: ni un nombre de documento se queda en el móvil. Las escrituras
// son llamadas directas, con conexión y con `clientId` (el mismo en los
// reintentos de la misma acción), NUNCA por la cola.

import { useCallback, useRef, useState, useSyncExternalStore } from 'react';
import { onlineManager, useQueryClient } from '@tanstack/react-query';
import { getComunicaApi } from '@/services/comunica';
import {
  isComunicaApiError,
  type UploadFile,
} from '@/services/comunica/client';
import {
  dismissDocumentUpload,
  getDocumentUploads,
  retryDocumentUpload,
  startDocumentUpload,
  subscribeDocumentUploads,
} from '@/services/comunica/documentUploads';
import { deleteLocalCopy } from '@/services/comunica/localFiles';
import { documentWriteErrorText } from '@/utils/comunica/documents';
import { uuidV4 } from '@/utils/comunica/uuid';
import { h } from '@/utils/haptics';
import { profileKey } from './profileKeys';
import { areaKey, STALE } from './useAreaQuery';
import { useProfileQuery } from './useProfileQuery';

/** ¿Hay conexión? (lo que sabe TanStack: el mismo aviso que el resto del área). */
export function useOnline(): boolean {
  return useSyncExternalStore(
    (fn) => onlineManager.subscribe(fn),
    () => onlineManager.isOnline(),
    () => true,
  );
}

export function useDocuments() {
  return useProfileQuery({
    block: 'documents',
    route: 'profileDocuments',
    load: (pid) => getComunicaApi().getProfileDocuments(pid),
    staleTime: STALE.state,
    persist: false,
  });
}

export function useDocument(id: string) {
  return useProfileQuery({
    block: 'documents',
    rest: [id],
    route: 'profileDocument',
    load: (pid) => getComunicaApi().getProfileDocument(pid, id),
    staleTime: STALE.state,
    persist: false,
    // Un 403 («ya no está disponible») no se arregla insistiendo.
    retry: false,
  });
}

/** Releer la lista y las fichas de ese pid. */
export function useInvalidateDocuments() {
  const qc = useQueryClient();
  return useCallback(
    (pid: string) =>
      qc.invalidateQueries({ queryKey: areaKey(profileKey('documents', pid)) }),
    [qc],
  );
}

/** Las subidas en curso (o fallidas) de un pid, arriba de la lista. */
export function useDocumentUploads(pid: string | null) {
  const all = useSyncExternalStore(
    subscribeDocumentUploads,
    getDocumentUploads,
    getDocumentUploads,
  );
  return {
    uploads: all.filter((e) => e.pid === pid),
    retry: (clientId: string) => void retryDocumentUpload(clientId),
    dismiss: dismissDocumentUpload,
  };
}

/** Subir: arranca y vuelve en el acto (la lista enseña «Subiendo…»). */
export function useStartDocumentUpload(onDone?: () => void) {
  const invalidate = useInvalidateDocuments();
  return useCallback(
    (
      pid: string,
      input: { name: string; description?: string; file: UploadFile },
    ) =>
      startDocumentUpload(pid, input, () => {
        h.formSuccess();
        void invalidate(pid);
        onDone?.();
      }),
    [invalidate, onDone],
  );
}

type Phase = 'idle' | 'working' | 'failed';

interface Pending {
  kind: 'save' | 'remove';
  clientId: string;
  changes?: { name?: string; description?: string };
  file?: UploadFile;
}

/**
 * Editar (solo lo que cambia, y el archivo si se sustituye) y borrar un
 * documento. Un fallo deja la acción para «Reintentar» con su mismo
 * `clientId`; una acción nueva, uno nuevo.
 */
export function useDocumentWrites(pid: string | null, id: string) {
  const qc = useQueryClient();
  const invalidate = useInvalidateDocuments();
  const [phase, setPhase] = useState<Phase>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const [failedKind, setFailedKind] = useState<Pending['kind'] | null>(null);
  const pending = useRef<Pending | null>(null);

  const run = useCallback(
    async (p: Pending): Promise<boolean> => {
      if (!pid) return false;
      pending.current = p;
      setPhase('working');
      setMessage(null);
      setFailedKind(null);
      try {
        const api = getComunicaApi();
        if (p.kind === 'save') {
          await api.updateProfileDocument(
            pid,
            id,
            { clientId: p.clientId, ...p.changes },
            p.file,
          );
          if (p.file) deleteLocalCopy(p.file.uri);
        } else {
          await api.deleteProfileDocument(pid, id, p.clientId);
          // Su ficha ya no existe: que no se relea (daría «ya no está»).
          qc.removeQueries({
            queryKey: areaKey(profileKey('documents', pid, id)),
          });
        }
        pending.current = null;
        setPhase('idle');
        void invalidate(pid);
        return true;
      } catch (e) {
        setPhase('failed');
        setFailedKind(p.kind);
        setMessage(
          isComunicaApiError(e)
            ? documentWriteErrorText(e.code, e.reason)
            : documentWriteErrorText('internal'),
        );
        h.error();
        return false;
      }
    },
    [pid, id, invalidate, qc],
  );

  return {
    phase,
    message,
    failedKind,
    save: (changes: Pending['changes'], file?: UploadFile) =>
      run({ kind: 'save', clientId: uuidV4(), changes, file }),
    remove: () => run({ kind: 'remove', clientId: uuidV4() }),
    /** La misma acción, con el mismo `clientId`. */
    retry: () =>
      pending.current ? run(pending.current) : Promise.resolve(false),
  };
}
