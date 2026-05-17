/**
 * Mini-cola in-memory para pasar un código de playlist en la nube desde
 * el deep link (`/playlist?p=1234`) hasta la pantalla SelectedSongs.
 *
 * Se consume una sola vez. No persiste en disco: si el usuario recarga,
 * lo perdemos y eso está bien — la URL ya no contiene el parámetro tras
 * el redirect.
 */
let pending: string | null = null;

export function setPendingCloudPlaylistCode(code: string | null) {
  pending = code;
}

export function consumePendingCloudPlaylistCode(): string | null {
  const code = pending;
  pending = null;
  return code;
}

export function peekPendingCloudPlaylistCode(): string | null {
  return pending;
}
