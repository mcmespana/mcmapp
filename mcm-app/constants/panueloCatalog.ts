// Catálogos del pañuelo virtual que van dentro de la app.
//
// `DEFAULT_PANUELO_CATALOG` es el mismo JSON que se importa en Firebase
// (`firebase-seed/panuelo.json`, nodo `/panuelo/data`): lo que se ve sin
// catálogo remoto y lo que se sube la primera vez son la misma cosa. Mientras
// el Panel no tenga su editor de piezas, ESTE es el catálogo. Solo lleva
// piezas DE VERDAD (chapas, pines, medallas y el troncho, fotografiados; sus
// modelos están en `piezas-3d/` y `medallas-3d/`).
//
// `EXAMPLE_PANUELO_CATALOG` son piezas inventadas, una de cada clase: las usa
// el tutorial para explicar las seis clases (todavía no hay cinta, parche ni
// pulsera de verdad) y los tests. Nadie las puede conseguir.

import panueloExample from '@/constants/panueloEjemplo.json';
import panueloSeed from '@/firebase-seed/panuelo.json';
import type { PanueloCatalog } from '@/types/panuelo';
import { sanitizeCatalog } from '@/utils/panuelo';

export const DEFAULT_PANUELO_CATALOG: PanueloCatalog =
  sanitizeCatalog(panueloSeed);

export const EXAMPLE_PANUELO_CATALOG: PanueloCatalog =
  sanitizeCatalog(panueloExample);
