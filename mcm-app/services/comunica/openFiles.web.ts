// services/comunica/openFiles.web.ts — en el navegador, un archivo bajado es
// un `blob:` en memoria; «borrarlo» es soltar esa URL.

import type { FileTransport } from './client';

const blobs = new Set<string>();
const inUse = new Set<string>();

const keep = (blob: Blob) => {
  const uri = URL.createObjectURL(blob);
  blobs.add(uri);
  return uri;
};

export const openFilesTransport: FileTransport = {
  async download(url, headers, _fileName, onProgress) {
    const res = await fetch(url, { headers });
    const out: Record<string, string> = {};
    res.headers.forEach((v, k) => {
      out[k] = v;
    });
    const uri = keep(await res.blob());
    onProgress?.(1);
    return { status: res.status, headers: out, uri };
  },
  readText: async (uri) => (await fetch(uri)).text(),
  saveBytes: async (bytes, _fileName, mimeType) =>
    keep(new Blob([bytes as BlobPart], { type: mimeType })),
  remove: (uri) => removeOpenFile(uri),
};

export function holdOpenFile(uri: string): () => void {
  inUse.add(uri);
  return () => {
    inUse.delete(uri);
    removeOpenFile(uri);
  };
}

export function removeOpenFile(uri: string): void {
  if (!blobs.has(uri)) return;
  blobs.delete(uri);
  URL.revokeObjectURL(uri);
}

export async function clearOpenFiles(all = false): Promise<void> {
  for (const uri of [...blobs]) {
    if (all || !inUse.has(uri)) removeOpenFile(uri);
  }
  if (all) inUse.clear();
}

export const contentUriOf = async (uri: string) => uri;

interface OpenedFile {
  localUri: string;
  fileName: string;
  mimeType: string;
}

/** En el navegador, «compartir» es descargar el archivo con su nombre. */
export async function shareOpenFile(file: OpenedFile): Promise<void> {
  const a = document.createElement('a');
  a.href = file.localUri;
  a.download = file.fileName;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/** Una pestaña nueva (PDF e imágenes los abre el navegador); lo demás, se descarga. */
export async function openWithSystem(file: OpenedFile): Promise<void> {
  const inline = /^(application\/pdf|image\/(jpeg|png|gif|webp))$/.test(
    file.mimeType,
  );
  if (inline && window.open(file.localUri, '_blank')) return;
  await shareOpenFile(file);
}
