// services/comunica/openFiles.ts
//
// Los archivos que se abren desde el área (plan 16: documentos; plan 13: los
// de un evento). Se bajan a `cacheDirectory/comunica/open/` con el token en
// la cabecera y NO se quedan: se borran al cerrar el visor, al volver la app
// a primer plano, al abrir Documentos y siempre al salir (un informe médico o
// un DNI no se deja en el móvil). Lo que está abierto en el visor se respeta
// hasta que se cierra.
//
// Es el `FileTransport` del cliente (y del servidor falso); en web, su
// `.web.ts` usa `blob:`.

import { AppState, Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import type { FileTransport } from './client';
import { utiOf } from '@/utils/comunica/files';
import { logger } from '@/utils/logger';

const dir = () => `${FileSystem.cacheDirectory ?? ''}comunica/open/`;
let seq = 0;
/** Lo que tiene abierto el visor ahora mismo: no se borra por debajo. */
const inUse = new Set<string>();

/** Sin barras ni caracteres raros: el nombre va dentro de una ruta. */
const safe = (name: string) =>
  name.replace(/[^\p{L}\p{N}._ -]/gu, '_').slice(-120) || 'documento';

async function ensureDir() {
  await FileSystem.makeDirectoryAsync(dir(), { intermediates: true }).catch(
    () => {},
  );
}

const target = (fileName: string) => {
  seq += 1;
  return `${dir()}${Date.now().toString(36)}-${seq}-${safe(fileName)}`;
};

const toBase64 = (bytes: Uint8Array) => {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return globalThis.btoa(bin);
};

export const openFilesTransport: FileTransport = {
  async download(url, headers, fileName, onProgress) {
    await ensureDir();
    const task = FileSystem.createDownloadResumable(
      url,
      target(fileName),
      { headers },
      (p) => {
        if (onProgress && p.totalBytesExpectedToWrite > 0) {
          onProgress(p.totalBytesWritten / p.totalBytesExpectedToWrite);
        }
      },
    );
    const r = await task.downloadAsync();
    if (!r) throw new Error('descarga cancelada');
    return { status: r.status, headers: r.headers ?? {}, uri: r.uri };
  },
  readText: (uri) => FileSystem.readAsStringAsync(uri),
  async saveBytes(bytes, fileName) {
    await ensureDir();
    const uri = target(fileName);
    await FileSystem.writeAsStringAsync(uri, toBase64(bytes), {
      encoding: FileSystem.EncodingType.Base64,
    });
    return uri;
  },
  remove: (uri) => removeOpenFile(uri),
};

/** Lo marca como abierto en el visor (no se borra hasta cerrarlo). */
export function holdOpenFile(uri: string): () => void {
  inUse.add(uri);
  return () => {
    inUse.delete(uri);
    removeOpenFile(uri);
  };
}

/** Borra un archivo bajado (solo si es nuestro). */
export function removeOpenFile(uri: string): void {
  if (!uri.startsWith(dir())) return;
  FileSystem.deleteAsync(uri, { idempotent: true }).catch((e) =>
    logger.warn('[comunica] no se ha podido borrar un archivo abierto', e),
  );
}

/**
 * Vacía `comunica/open/` salvo lo que está en el visor. Con `all` (al salir),
 * todo.
 */
export async function clearOpenFiles(all = false): Promise<void> {
  try {
    const names = await FileSystem.readDirectoryAsync(dir());
    await Promise.all(
      names
        .map((n) => `${dir()}${n}`)
        .filter((uri) => all || !inUse.has(uri))
        .map((uri) => FileSystem.deleteAsync(uri, { idempotent: true })),
    );
    if (all) inUse.clear();
  } catch {
    // Sin carpeta: no hay nada que borrar.
  }
}

// Al volver la app a primer plano: lo que se abrió fuera (compartir, «Abrir
// con…») ya no hace falta. Lo del visor se respeta.
let lastState = AppState.currentState;
AppState.addEventListener?.('change', (next) => {
  if (lastState !== 'active' && next === 'active') void clearOpenFiles();
  lastState = next;
});

/** Para la hoja de Android («Abrir con…»): `content://` en vez de `file://`. */
export const contentUriOf = (uri: string) => FileSystem.getContentUriAsync(uri);

interface OpenedFile {
  localUri: string;
  fileName: string;
  mimeType: string;
}

/** La hoja de compartir del sistema con el archivo (con su tipo y su UTI). */
export async function shareOpenFile(file: OpenedFile): Promise<void> {
  await Sharing.shareAsync(file.localUri, {
    mimeType: file.mimeType,
    UTI: utiOf(file.mimeType),
    dialogTitle: file.fileName,
  });
}

/**
 * «Abrir con…» del sistema. En Android, el visor que tenga el móvil
 * (`expo-intent-launcher`); si el binario no lo trae o nadie lo abre, la
 * hoja de compartir. En iOS, la hoja (que ya trae «Abrir en…»).
 */
export async function openWithSystem(file: OpenedFile): Promise<void> {
  if (Platform.OS === 'android') {
    try {
      const IntentLauncher = await import('expo-intent-launcher');
      await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
        data: await contentUriOf(file.localUri),
        // FLAG_GRANT_READ_URI_PERMISSION: el visor puede leerlo.
        flags: 1,
        type: file.mimeType,
      });
      return;
    } catch (e) {
      logger.warn('[comunica] «Abrir con…» no está; se comparte', e);
    }
  }
  await shareOpenFile(file);
}
