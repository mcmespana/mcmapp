// Catálogo de muestra del pañuelo virtual.
//
// Es el mismo JSON que se importa en Firebase (`firebase-seed/panuelo.json`,
// nodo `/panuelo/data`), para que lo que se ve sin catálogo remoto y lo que se
// sube la primera vez sean la misma cosa. Mientras el Panel no tenga su
// editor de piezas, ESTE es el catálogo.

import panueloSeed from '@/firebase-seed/panuelo.json';
import type { PanueloCatalog } from '@/types/panuelo';
import { sanitizeCatalog } from '@/utils/panuelo';

export const DEFAULT_PANUELO_CATALOG: PanueloCatalog =
  sanitizeCatalog(panueloSeed);
