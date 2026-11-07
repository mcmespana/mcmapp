// services/comunica/localFiles.web.ts — en el navegador no hay copias que
// borrar ni rutas locales que medir (el `File` del selector ya trae su tamaño).

export function deleteLocalCopy(_uri: string): void {}

export function localFileSize(_uri: string): number | null {
  return null;
}
