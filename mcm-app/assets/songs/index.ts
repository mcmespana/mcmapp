// assets/songs/index.ts
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
