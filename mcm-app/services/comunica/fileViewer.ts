// services/comunica/fileViewer.ts
//
// Lo que el visor de archivos (`archivo.tsx`) tiene que enseñar: un hueco EN MEMORIA entre quien abre un archivo y la pantalla (nunca en la URL: es una ruta
// local y el nombre de un documento). Se consume al montar el visor; al cerrarlo se borran las copias.

export interface ViewingFile {
  kind: 'image' | 'pdf';
  /** Ruta local de la copia bajada. */
  uri: string;
  fileName: string;
  title: string;
}

let current: ViewingFile | null = null;

export const setViewingFile = (f: ViewingFile): void => {
  current = f;
};
/** Lo recoge el visor al montar; no se consume (si se vuelve a pintar, sigue). `clearViewingFile` lo suelta. */
export const getViewingFile = (): ViewingFile | null => current;
export const clearViewingFile = (): void => {
  current = null;
};
