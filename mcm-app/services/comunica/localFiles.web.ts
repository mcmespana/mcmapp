// services/comunica/localFiles.web.ts — en el navegador no hay copias que
// borrar ni rutas locales que medir (el `File` del selector ya trae su tamaño).

export function deleteLocalCopy(_uri: string): void {}

export function localFileSize(_uri: string): number | null {
  return null;
}

/**
 * En el navegador: se baja como `Blob` (con la sesión) y se abre en una
 * pestaña nueva, que es el visor de PDF e imágenes del propio navegador.
 */
export async function openRemoteFile(
  source: { uri: string; headers?: Record<string, string> },
  _fileName: string,
  mimeType: string,
): Promise<void> {
  // La pestaña se abre ya, en el gesto del toque: si no, la bloquea el navegador.
  const tab = window.open('', '_blank');
  try {
    const res = await fetch(source.uri, { headers: source.headers });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = new Blob([await res.blob()], { type: mimeType });
    const url = URL.createObjectURL(blob);
    if (tab) tab.location.href = url;
    else window.open(url, '_blank');
  } catch (e) {
    tab?.close();
    throw e;
  }
}

export function clearOpenedFiles(): void {}
