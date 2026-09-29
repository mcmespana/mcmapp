import type { ImageSourcePropType } from 'react-native';

/**
 * Las medallas de prueba del Laboratorio Alpha.
 *
 * Es una lista fija a propósito: sirve para ver cómo se ven, cuánto pesan y
 * cuánto tardan en cargar en móviles de verdad antes de montar el sistema de
 * recompensas (catálogo en Firebase, canje por evento, el pañuelo). Cuando
 * exista ese catálogo, esto desaparece.
 *
 * - El `.glb` se sirve desde la carpeta `medallas-3d/` del repo vía jsDelivr
 *   (repo público, CORS abierto, caché de CDN). Solo está disponible cuando
 *   el archivo ya está en `main`.
 * - La miniatura va empaquetada con la app: es lo que se ve en la rejilla (y
 *   lo que iría cosido en el pañuelo). Pintar varios modelos 3D a la vez
 *   se comería la batería; el 3D solo se abre al tocar una.
 */

export const MEDALLAS_CDN =
  'https://cdn.jsdelivr.net/gh/mcmespana/mcmapp@main/medallas-3d/';

export type LabMedal = {
  id: string;
  name: string;
  /** Una línea bajo el nombre en el pop-up. */
  subtitle: string;
  glbUrl: string;
  thumbnail: ImageSourcePropType;
};

export const LAB_MEDALS: readonly LabMedal[] = [
  {
    id: 'jubileo-jovenes-2025',
    name: 'Jubileo de los Jóvenes',
    subtitle: 'Roma · 2025',
    glbUrl: `${MEDALLAS_CDN}jubileo-jovenes-2025.glb`,
    thumbnail: require('@/assets/images/medallas/jubileo-jovenes-2025.webp'),
  },
  {
    id: 'visita-papa-2026',
    name: 'Alza la mirada',
    subtitle: 'Visita del Papa · 2026',
    glbUrl: `${MEDALLAS_CDN}visita-papa-2026.glb`,
    thumbnail: require('@/assets/images/medallas/visita-papa-2026.webp'),
  },
];
