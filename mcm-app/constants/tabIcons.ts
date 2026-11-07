// Iconos PNG de la barra de tabs flotante.
//
// `expo-native-compact-tabs` pinta desde imágenes, no desde SF Symbols ni
// fuentes de iconos, así que cada tab necesita su PNG. Los genera
// `scripts/generate-tab-icons.js` a partir del mismo glifo de MaterialIcons
// que declara `androidIcon` en `constants/tabsCatalog.ts` — no se dibujan a
// mano.
//
// El mapa es ESTÁTICO a propósito: Metro necesita ver cada `require()` con una
// ruta literal en tiempo de bundling, no admite rutas construidas.
//
// Si añades un tab: añádelo a TABS_CONFIG, lanza `node
// scripts/generate-tab-icons.js` y registra aquí su entrada.

import type { ImageSourcePropType } from 'react-native';

export interface TabIconSet {
  /** Icono en reposo. */
  icon: ImageSourcePropType;
  /**
   * Fotogramas que la barra reproduce al seleccionar o reseleccionar el tab
   * (34 ms cada uno). Empiezan y acaban en el icono base para que el rebote
   * cierre limpio.
   */
  frames: ImageSourcePropType[];
}

function set(
  icon: ImageSourcePropType,
  f1: ImageSourcePropType,
  f2: ImageSourcePropType,
  f3: ImageSourcePropType,
): TabIconSet {
  return { icon, frames: [icon, f1, f2, f3, icon] };
}

export const TAB_ICONS: Record<string, TabIconSet> = {
  index: set(
    require('@/assets/tab-icons/index/icon.png'),
    require('@/assets/tab-icons/index/frame-1.png'),
    require('@/assets/tab-icons/index/frame-2.png'),
    require('@/assets/tab-icons/index/frame-3.png'),
  ),
  cancionero: set(
    require('@/assets/tab-icons/cancionero/icon.png'),
    require('@/assets/tab-icons/cancionero/frame-1.png'),
    require('@/assets/tab-icons/cancionero/frame-2.png'),
    require('@/assets/tab-icons/cancionero/frame-3.png'),
  ),
  contigo: set(
    require('@/assets/tab-icons/contigo/icon.png'),
    require('@/assets/tab-icons/contigo/frame-1.png'),
    require('@/assets/tab-icons/contigo/frame-2.png'),
    require('@/assets/tab-icons/contigo/frame-3.png'),
  ),
  comunica: set(
    require('@/assets/tab-icons/comunica/icon.png'),
    require('@/assets/tab-icons/comunica/frame-1.png'),
    require('@/assets/tab-icons/comunica/frame-2.png'),
    require('@/assets/tab-icons/comunica/frame-3.png'),
  ),
  visitapapa: set(
    require('@/assets/tab-icons/visitapapa/icon.png'),
    require('@/assets/tab-icons/visitapapa/frame-1.png'),
    require('@/assets/tab-icons/visitapapa/frame-2.png'),
    require('@/assets/tab-icons/visitapapa/frame-3.png'),
  ),
  calendario: set(
    require('@/assets/tab-icons/calendario/icon.png'),
    require('@/assets/tab-icons/calendario/frame-1.png'),
    require('@/assets/tab-icons/calendario/frame-2.png'),
    require('@/assets/tab-icons/calendario/frame-3.png'),
  ),
  fotos: set(
    require('@/assets/tab-icons/fotos/icon.png'),
    require('@/assets/tab-icons/fotos/frame-1.png'),
    require('@/assets/tab-icons/fotos/frame-2.png'),
    require('@/assets/tab-icons/fotos/frame-3.png'),
  ),
  mas: set(
    require('@/assets/tab-icons/mas/icon.png'),
    require('@/assets/tab-icons/mas/frame-1.png'),
    require('@/assets/tab-icons/mas/frame-2.png'),
    require('@/assets/tab-icons/mas/frame-3.png'),
  ),
};
