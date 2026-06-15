/**
 * Mini-cola in-memory para pasar un código de playlist en la nube desde
 * el deep link (`/playlist?p=1234`) hasta la pantalla SelectedSongs.
 *
 * Se consume una sola vez. No persiste en disco: si el usuario recarga,
 * lo perdemos y eso está bien — la URL ya no contiene el parámetro tras
 * el redirect.
 */
let pendingPlaylist: string | null = null;
let pendingChoir: string | null = null;
/** Payload compacto de una playlist offline (mcmapp://playlist?d=...). */
let pendingOffline: string | null = null;

export function setPendingCloudPlaylistCode(code: string | null) {
  pendingPlaylist = code;
}

export function consumePendingCloudPlaylistCode(): string | null {
  const code = pendingPlaylist;
  pendingPlaylist = null;
  return code;
}

export function peekPendingCloudPlaylistCode(): string | null {
  return pendingPlaylist;
}

export function setPendingChoirCode(code: string | null) {
  pendingChoir = code;
}

export function consumePendingChoirCode(): string | null {
  const code = pendingChoir;
  pendingChoir = null;
  return code;
}

export function peekPendingChoirCode(): string | null {
  return pendingChoir;
}

export function setPendingOfflinePlaylist(payload: string | null) {
  pendingOffline = payload;
}

export function consumePendingOfflinePlaylist(): string | null {
  const payload = pendingOffline;
  pendingOffline = null;
  return payload;
}
