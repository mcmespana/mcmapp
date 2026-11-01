// Documentos (plan 16): las lecturas, las escrituras y cómo se abre un archivo.
//
//   · NADA de Documentos va al móvil (`persist: false`: un nombre como «Informe médico» ya es sensible); memoria 5 min y `staleTime: 0`.
//   · Subir, editar y borrar son llamadas DIRECTAS, con conexión y con un `clientId` por acción que se conserva solo mientras el fallo sea de red o del CRM
//     (reintentar sin duplicar). Nada va por la cola: el cuerpo y el archivo quedarían en el disco hasta subir.
//   · Abrir: se baja con sesión a `comunica/open/` y se enseña en el visor (imagen; PDF en iOS) o en la hoja de compartir; la copia se borra al cerrar.

import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { getComunicaApi } from '@/services/comunica';
import {
  isComunicaApiError,
  type UploadFile,
} from '@/services/comunica/client';
import type { DocumentSummary } from '@/services/comunica/contract';
import {
  clearOpenCopies,
  downloadToCache,
  shareLocalFile,
} from '@/services/comunica/eventFiles';
import { setViewingFile } from '@/services/comunica/fileViewer';
import { isImageFile, isPdfFile } from '@/utils/comunica/files';
import { uuidV4 } from '@/utils/comunica/uuid';
import { areaKey, useAreaQuery } from './useAreaQuery';

export const documentsKey = (pid: string) => ['documents', pid] as const;

export function useDocuments(pid: string | null | undefined) {
  return useAreaQuery({
    key: [...documentsKey(pid ?? '')],
    route: 'profileDocuments',
    fetch: () => getComunicaApi().getProfileDocuments(pid!),
    staleTime: 0,
    gcTime: 5 * 60_000,
    enabled: !!pid,
    retry: false,
  });
}

export function useDocument(pid: string | null | undefined, id: string) {
  return useAreaQuery({
    key: [...documentsKey(pid ?? ''), id],
    route: 'profileDocument',
    fetch: () => getComunicaApi().getProfileDocument(pid!, id),
    staleTime: 0,
    gcTime: 5 * 60_000,
    enabled: !!pid && !!id,
    retry: false,
  });
}

const retryable = (e: unknown) => isComunicaApiError(e) && e.retryable;

/** Un `clientId` por acción: se conserva mientras el fallo sea de red o del CRM; se suelta al salir bien o con otro error. */
function useClientId() {
  const ref = useRef<string | null>(null);
  return {
    get: () => (ref.current ??= uuidV4()),
    done: () => {
      ref.current = null;
    },
    after: (e: unknown) => {
      if (!retryable(e)) ref.current = null;
    },
  };
}

/** Subir, editar y borrar un documento del perfil: directos, con conexión. Lanzan el error; quien llama decide qué decir. */
export function useDocumentWrites(pid: string) {
  const qc = useQueryClient();
  const createId = useClientId();
  const editId = useClientId();
  const deleteId = useClientId();
  const [busy, setBusy] = useState<'create' | 'edit' | 'delete' | null>(null);
  const refresh = useCallback(() => {
    void qc.invalidateQueries({ queryKey: areaKey(documentsKey(pid)) });
  }, [pid, qc]);

  const create = useCallback(
    async (
      fields: { name: string; description?: string },
      file: UploadFile,
    ) => {
      setBusy('create');
      try {
        const r = await getComunicaApi().createProfileDocument(
          pid,
          { ...fields, clientId: createId.get() },
          file,
        );
        createId.done();
        refresh();
        return r;
      } catch (e) {
        createId.after(e);
        throw e;
      } finally {
        setBusy(null);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pid, refresh],
  );
  const edit = useCallback(
    async (
      id: string,
      fields: { name?: string; description?: string },
      file?: UploadFile,
    ) => {
      setBusy('edit');
      try {
        await getComunicaApi().updateProfileDocument(
          pid,
          id,
          { ...fields, clientId: editId.get() },
          file,
        );
        editId.done();
        refresh();
      } catch (e) {
        editId.after(e);
        throw e;
      } finally {
        setBusy(null);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pid, refresh],
  );
  const remove = useCallback(
    async (id: string) => {
      setBusy('delete');
      try {
        await getComunicaApi().deleteProfileDocument(pid, id, deleteId.get());
        deleteId.done();
        refresh();
      } catch (e) {
        deleteId.after(e);
        throw e;
      } finally {
        setBusy(null);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pid, refresh],
  );
  return { create, edit, remove, busy };
}

export type OpenOutcome = 'opened' | 'offline' | 'failed';

/**
 * Abrir el archivo de un documento: imagen → visor; PDF → visor en iOS (en Android, la hoja de compartir hasta que entre «Abrir con…»); lo demás, la hoja del
 * sistema. `downloading` dice qué documento está bajando (el botón enseña el progreso).
 */
export function useOpenFile(pid: string | null | undefined) {
  const router = useRouter();
  const [downloading, setDownloading] = useState<string | null>(null);
  const open = useCallback(
    async (
      d: Pick<DocumentSummary, 'id' | 'name' | 'fileName'>,
    ): Promise<OpenOutcome> => {
      if (!pid || !d.fileName || downloading) return 'failed';
      setDownloading(d.id);
      try {
        const src = getComunicaApi().documentFileSource(pid, d.id);
        const r = await downloadToCache(src, d.fileName);
        if (!r.ok) return r.reason;
        const title = d.name || d.fileName;
        if (
          isImageFile(r.fileName) ||
          (isPdfFile(r.fileName) && Platform.OS !== 'android')
        ) {
          setViewingFile({
            kind: isImageFile(r.fileName) ? 'image' : 'pdf',
            uri: r.uri,
            fileName: r.fileName,
            title,
          });
          router.push('/comunica/archivo' as never);
          return 'opened';
        }
        const shared = await shareLocalFile(r.uri, r.fileName);
        await clearOpenCopies();
        return shared ? 'opened' : 'failed';
      } finally {
        setDownloading(null);
      }
    },
    [pid, router, downloading],
  );
  /** Compartir el archivo de un documento: se baja y se enseña la hoja del sistema; la copia se borra al acabar. */
  const share = useCallback(
    async (
      d: Pick<DocumentSummary, 'id' | 'name' | 'fileName'>,
    ): Promise<OpenOutcome> => {
      if (!pid || !d.fileName || downloading) return 'failed';
      setDownloading(d.id);
      try {
        const r = await downloadToCache(
          getComunicaApi().documentFileSource(pid, d.id),
          d.fileName,
        );
        if (!r.ok) return r.reason;
        const shared = await shareLocalFile(r.uri, r.fileName);
        await clearOpenCopies();
        return shared ? 'opened' : 'failed';
      } finally {
        setDownloading(null);
      }
    },
    [pid, downloading],
  );
  return { open, share, downloading };
}

/** Al volver la app a primer plano y al abrir Documentos se borra lo que se bajó para abrir. */
export function useClearOpenCopies() {
  useEffect(() => {
    void clearOpenCopies();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void clearOpenCopies();
    });
    return () => sub.remove();
  }, []);
}
