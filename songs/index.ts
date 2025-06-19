// assets/songs/index.ts
import songsDataFromFile from '../songs.json';
// Define Song and CategorizedSongs types for clarity, matching songs.json structure
interface SongFromFile {
  title: string;
  filename: string;
  author?: string;
  key?: string;
  capo?: number;
  info?: string;
  content?: string; // Content is in songs.json
}

interface CategorizedSongsData {
  [categoryTitle: string]: SongFromFile[];
}

// Export the imported data from songs.json as 'songs'
export const songs: CategorizedSongsData = songsDataFromFile;

export type SongFilename = 
  | 'lote_heredad.cho'
  | 'ven_a_celebrar.cho'
  | 'senor_pastor.cho'
  | 'nunca_dejare.cho'
  | 'dios_esta_aqui.cho'
  | 'aleluya_cantara.cho';

export const songAssets: Record<SongFilename, any> = {
  'lote_heredad.cho': require('./lote_heredad.cho'),
  'ven_a_celebrar.cho': require('./ven_a_celebrar.cho'),
  'senor_pastor.cho': require('./senor_pastor.cho'),
  'nunca_dejare.cho': require('./nunca_dejare.cho'),
  'dios_esta_aqui.cho': require('./dios_esta_aqui.cho'),
  'aleluya_cantara.cho': require('./aleluya_cantara.cho')
} as const;
