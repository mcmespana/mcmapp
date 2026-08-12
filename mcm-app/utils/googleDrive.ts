/**
 * Utilidades para normalizar URLs de Google Drive.
 *
 * Los audios del cantoral viven en Drive como enlaces "de compartir"
 * (`/file/d/<id>/view?usp=drive_link`). Para reproducirlos dentro de la app
 * usamos el endpoint oficial de embed de Drive (`/file/d/<id>/preview`), que
 * pinta un reproductor de audio/vídeo apto para iframes y WebViews.
 */

/**
 * Extrae el ID de fichero de una URL de Google Drive en sus formas habituales.
 * Devuelve `null` si no se reconoce.
 *
 * Soporta:
 *  - https://drive.google.com/file/d/ID/view?usp=drive_link
 *  - https://drive.google.com/file/d/ID/preview
 *  - https://drive.google.com/open?id=ID
 *  - https://drive.google.com/uc?id=ID / ?export=download&id=ID
 *  - https://docs.google.com/uc?export=download&id=ID
 */
export function extractDriveFileId(input: string): string | null {
  if (!input) return null;
  const url = input.trim();
  if (!/(?:drive|docs)\.google\.com/i.test(url)) return null;

  const patterns = [
    /\/file\/d\/([A-Za-z0-9_-]{10,})/, // /file/d/ID
    /[?&]id=([A-Za-z0-9_-]{10,})/, // open?id=ID / uc?id=ID
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

/**
 * Convierte una URL de Drive en su URL de *preview* (embed). Si no se puede
 * extraer el ID, devuelve `null` — quien consume decide el fallback (abrir en
 * el navegador).
 */
export function toDrivePreviewUrl(input: string): string | null {
  const id = extractDriveFileId(input);
  return id ? `https://drive.google.com/file/d/${id}/preview` : null;
}
