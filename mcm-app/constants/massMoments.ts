/**
 * Catálogo de «Cantos para el domingo» (`docs/funcionalidades/CANTOS_DOMINGO.md`):
 * qué momentos tiene la misa y qué etiqueta convierte una canción en candidata
 * de un tiempo o de una fiesta. Solo datos, sin lógica: la lógica vive en
 * `utils/sundaySongs.ts`.
 *
 * El vocabulario de etiquetas de abajo es la FORMA acordada, no un inventario
 * medido: la Fase 0 del plan (contar qué etiquetas litúrgicas hay de verdad en
 * `songs/data`) no se ha hecho. Una etiqueta que no esté aquí no estorba (la
 * canción se queda «neutra»); una que sobre tampoco. Se amplía sin tocar la
 * lógica: añade el slug (sin tildes, en minúscula, con guiones) a la tabla.
 */
import type { SeasonId } from '@/utils/liturgicalDay';

export type MassMomentId =
  | 'entrada'
  | 'salmo'
  | 'aleluya'
  | 'ofertorio'
  | 'santo'
  | 'comunion'
  | 'salida';

export interface MassMoment {
  id: MassMomentId;
  label: string;
  /** Claves de `songs/data` de las que bebe (las canciones de esas categorías). */
  categories: readonly string[];
  /** Etiquetas (slug) que hacen candidata a una canción de OTRA categoría. */
  tags: readonly string[];
}

/** Los siete momentos con categoría propia, en orden de misa. */
export const MASS_MOMENTS: readonly MassMoment[] = [
  {
    id: 'entrada',
    label: 'Entrada',
    categories: ['entrada'],
    tags: ['entrada'],
  },
  { id: 'salmo', label: 'Salmo', categories: ['salmos'], tags: [] },
  {
    id: 'aleluya',
    label: 'Aleluya',
    categories: ['aleluya'],
    tags: ['aclamacion'],
  },
  {
    id: 'ofertorio',
    label: 'Ofertorio',
    categories: ['ofertorio'],
    tags: ['ofertorio'],
  },
  { id: 'santo', label: 'Santo', categories: ['santo'], tags: [] },
  {
    id: 'comunion',
    label: 'Comunión',
    categories: ['comunion', 'adoracion'],
    tags: ['comunion'],
  },
  {
    id: 'salida',
    label: 'Salida',
    categories: ['salida'],
    tags: ['envio', 'mariana'],
  },
];

/** Cómo se llama el momento del Aleluya cuando no se canta el Aleluya. */
export const ACCLAMATION_LABEL = 'Aclamación';

/** Etiqueta que marca una aclamación antes del Evangelio (sin «Aleluya»). */
export const ACCLAMATION_TAG = 'aclamacion';

/** Tiempos en los que no se canta el Aleluya. */
export const NO_ALLELUIA_SEASONS: readonly SeasonId[] = [
  'cuaresma',
  'semana_santa',
];

/** Qué tiempo o fiesta marca una etiqueta (o un texto de `liturgicalTime`). */
export interface LiturgicalMark {
  season?: SeasonId;
  /** Id de fiesta canónico (ver `canonicalFeastId` en `utils/sundaySongs.ts`). */
  feast?: string;
}

/**
 * Slug de etiqueta (o palabra de `liturgicalTime`, con guiones por espacios) →
 * tiempo o fiesta. Los ids de fiesta son los de `fechas_especiales` del
 * calendario, salvo `ascension` y `corpus`, que juntan sus dos fechas.
 */
export const SEASON_TAGS: Readonly<Record<string, LiturgicalMark>> = {
  // Tiempos
  adviento: { season: 'adviento' },
  navidad: { season: 'navidad' },
  cuaresma: { season: 'cuaresma' },
  'semana-santa': { season: 'semana_santa' },
  pascua: { season: 'pascua' },
  'tiempo-de-pascua': { season: 'pascua' },
  ordinario: { season: 'ordinario' },
  'tiempo-ordinario': { season: 'ordinario' },
  // Fiestas
  'domingo-de-ramos': { feast: 'domingo_ramos' },
  ramos: { feast: 'domingo_ramos' },
  resurreccion: { feast: 'domingo_resurreccion' },
  ascension: { feast: 'ascension' },
  pentecostes: { feast: 'pentecostes' },
  'espiritu-santo': { feast: 'pentecostes' },
  trinidad: { feast: 'santisima_trinidad' },
  'santisima-trinidad': { feast: 'santisima_trinidad' },
  corpus: { feast: 'corpus' },
  'corpus-christi': { feast: 'corpus' },
  'cristo-rey': { feast: 'cristo_rey' },
  epifania: { feast: 'epifania' },
  reyes: { feast: 'epifania' },
  'sagrada-familia': { feast: 'sagrada_familia' },
  'bautismo-del-senor': { feast: 'bautismo_del_senor' },
  'todos-los-santos': { feast: 'todos_los_santos' },
  inmaculada: { feast: 'inmaculada' },
  asuncion: { feast: 'asuncion' },
  natividad: { feast: 'navidad' },
};
