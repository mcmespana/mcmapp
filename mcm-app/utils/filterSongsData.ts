export interface SongEntry {
  title: string;
  filename?: string;
  author?: string;
  key?: string;
  capo?: number;
  info?: string;
  content?: string;
  status?: string;
}

export interface SongCategory {
  categoryTitle: string;
  songs: SongEntry[];
}

export type SongsData = Record<string, SongCategory>;

export function filterSongsData(data: SongsData | null): SongsData | null {
  if (!data) return data;
  const result: SongsData = {};
  Object.keys(data).forEach((catKey) => {
    const category = data[catKey];
    if (!category) return;
    const songs = Array.isArray(category.songs)
      ? category.songs.filter(
          (s) => !s.status || (s.status !== 'pendiente' && s.status !== 'borrador'),
        )
      : [];
    result[catKey] = { ...category, songs };
  });
  return result;
}
