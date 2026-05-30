/**
 * Utilidades para normalizar URLs de YouTube.
 *
 * El administrador pega una URL "normal" de YouTube (la que copia del
 * navegador o de la app) y la guardamos como URL de *embed* lista para
 * incrustar en un iframe: `https://www.youtube.com/embed/<id>`.
 */

/**
 * Extrae el ID de vídeo de una URL de YouTube en cualquiera de sus formas
 * habituales. Devuelve `null` si no se reconoce.
 *
 * Soporta:
 *  - https://www.youtube.com/watch?v=ID (con parámetros extra)
 *  - https://youtu.be/ID
 *  - https://www.youtube.com/embed/ID
 *  - https://www.youtube.com/shorts/ID
 *  - https://www.youtube.com/live/ID
 */
export function extractYouTubeId(input: string): string | null {
  if (!input) return null;
  const url = input.trim();

  // Patrones ordenados de más específico a más genérico.
  const patterns = [
    /[?&]v=([A-Za-z0-9_-]{11})/, // watch?v=ID
    /youtu\.be\/([A-Za-z0-9_-]{11})/, // youtu.be/ID
    /\/embed\/([A-Za-z0-9_-]{11})/, // /embed/ID
    /\/shorts\/([A-Za-z0-9_-]{11})/, // /shorts/ID
    /\/live\/([A-Za-z0-9_-]{11})/, // /live/ID
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }

  // ¿Es el ID a secas?
  if (/^[A-Za-z0-9_-]{11}$/.test(url)) return url;

  return null;
}

/**
 * Convierte una URL normal de YouTube en su URL de *embed*. Si no se puede
 * extraer el ID, devuelve la entrada tal cual (recortada) para no perder el
 * dato que el admin haya escrito.
 */
export function toYouTubeEmbedUrl(input: string): string {
  const trimmed = (input || '').trim();
  if (!trimmed) return '';
  const id = extractYouTubeId(trimmed);
  return id ? `https://www.youtube.com/embed/${id}` : trimmed;
}
