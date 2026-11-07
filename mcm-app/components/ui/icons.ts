/**
 * Iconos de la app (Material Icons e Ionicons) en iOS y Android.
 *
 * ── Por qué no `@expo/vector-icons` tal cual ───────────────────────────────
 * `@expo/vector-icons` carga la fuente del icono AL ARRANCAR (`Font.loadAsync`)
 * y, mientras no la tiene, pinta un `<Text />` vacío. En la primera build de
 * Expo 58 (TestFlight, 2026-10-31) esa carga no llegaba nunca en iOS: casi
 * todos los iconos de la app salían en blanco, sin error a la vista. La propia
 * Expo recomienda no cargar las fuentes de iconos en tiempo de ejecución.
 *
 * Aquí las fuentes van DENTRO del binario (plugin `expo-font` en `app.json`)
 * y el icono se pinta directamente con ellas, sin cargar nada:
 *   · iOS busca la fuente por su nombre PostScript (`MaterialIcons-Regular`,
 *     `Ionicons`), que se lee del propio .ttf;
 *   · Android, por el nombre del fichero en `assets/fonts` (`MaterialIcons`,
 *     `Ionicons`), que es lo que hace `createIconSet` con el 3.er argumento.
 * En web se siguen usando los de `@expo/vector-icons` (`icons.web.ts`), que
 * allí funcionan.
 *
 * Se importa SIEMPRE de aquí: `import { MaterialIcons } from
 * '@/components/ui/icons'`. Lo vigila `__tests__/iconFonts.test.ts`, que
 * también comprueba que `app.json` embebe las dos fuentes.
 */
import { Platform } from 'react-native';
import type ExpoMaterialIcons from '@expo/vector-icons/MaterialIcons';
import type ExpoIonicons from '@expo/vector-icons/Ionicons';

const VENDOR = '@expo/vector-icons/build/vendor/react-native-vector-icons';

type CreateIconSet = (
  glyphMap: Record<string, number>,
  fontFamily: string,
  fontFile: string,
) => unknown;

/* eslint-disable @typescript-eslint/no-require-imports */
const createIconSet: CreateIconSet =
  require('@expo/vector-icons/build/vendor/react-native-vector-icons/lib/create-icon-set').default;
const materialGlyphs: Record<
  string,
  number
> = require('@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/MaterialIcons.json');
const ioniconsGlyphs: Record<
  string,
  number
> = require('@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/Ionicons.json');
/* eslint-enable @typescript-eslint/no-require-imports */

/** Rutas de las fuentes que embebe el plugin `expo-font` (`app.json`). */
export const ICON_FONT_FILES = [
  `./node_modules/${VENDOR}/Fonts/MaterialIcons.ttf`,
  `./node_modules/${VENDOR}/Fonts/Ionicons.ttf`,
] as const;

export const MaterialIcons = createIconSet(
  materialGlyphs,
  Platform.OS === 'ios' ? 'MaterialIcons-Regular' : 'MaterialIcons',
  'MaterialIcons.ttf',
) as typeof ExpoMaterialIcons;

export const Ionicons = createIconSet(
  ioniconsGlyphs,
  'Ionicons',
  'Ionicons.ttf',
) as typeof ExpoIonicons;
