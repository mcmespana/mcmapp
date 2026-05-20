// Catálogo compartido de tabs.
//
// Fuente única de verdad para la metadata visual de cada tab. Lo consumen:
//   - `app/(tabs)/_layout.tsx` para registrar los NativeTabs/Tabs.
//   - `app/screens/MasHomeScreen.tsx` para listar como tarjetas los tabs que
//     no caben en la barra inferior de iOS (limitación nativa: UITabBarController
//     sólo muestra 5 items; si hay más, añade un "More" automático poco bonito).
//
// Si añades un nuevo tab, añádelo aquí y a `constants/profileCatalog.KNOWN_TABS`.

import type { ComponentProps } from 'react';
import type { MaterialIcons } from '@expo/vector-icons';
import { TabHeaderColors } from '@/constants/colors';

export interface TabConfig {
  /** Nombre del archivo en `app/(tabs)/` (sin extensión) y ruta expo-router. */
  name: string;
  label: string;
  /** Subtítulo mostrado cuando el tab cae en MasHomeScreen como tarjeta. */
  subtitle: string;
  /** Emoji mostrado en la tarjeta de MasHomeScreen. */
  emoji: string;
  iosIcon: {
    default: string;
    selected: string;
  };
  androidIcon: ComponentProps<typeof MaterialIcons>['name'];
  /** Color principal del tab (cabecera y acento de tarjeta en MasHome). */
  tintColor: string;
  /** Color de cabecera específico (algunos tabs usan otro distinto al tint). */
  headerColor?: string;
  headerShown?: boolean;
}

export const TABS_CONFIG: TabConfig[] = [
  {
    name: 'index',
    label: 'Inicio',
    subtitle: 'Pantalla principal',
    emoji: '🏠',
    iosIcon: { default: 'house', selected: 'house.fill' },
    androidIcon: 'home',
    tintColor: '#253883',
    headerShown: true,
  },
  {
    name: 'cancionero',
    label: 'Cantoral',
    subtitle: 'Canciones con acordes',
    emoji: '🎵',
    iosIcon: { default: 'music.note', selected: 'music.note' },
    androidIcon: 'music-note',
    tintColor: TabHeaderColors.cancionero,
    headerColor: TabHeaderColors.cancionero,
    headerShown: false, // Cantoral uses its own StackNavigator header
  },
  {
    name: 'contigo',
    label: 'Contigo',
    subtitle: 'Acompañamiento y oración',
    emoji: '❤️',
    iosIcon: { default: 'heart', selected: 'heart.fill' },
    androidIcon: 'favorite',
    tintColor: TabHeaderColors.contigo,
    headerShown: false,
  },
  {
    name: 'calendario',
    label: 'Calendario',
    subtitle: 'Eventos y celebraciones',
    emoji: '📅',
    iosIcon: { default: 'calendar', selected: 'calendar' },
    androidIcon: 'calendar-today',
    tintColor: TabHeaderColors.calendario,
    headerColor: TabHeaderColors.calendario,
    headerShown: true,
  },
  {
    name: 'fotos',
    label: 'Fotos',
    subtitle: 'Galería de fotos MCM',
    emoji: '📷',
    iosIcon: { default: 'photo', selected: 'photo.fill' },
    androidIcon: 'photo-library',
    tintColor: TabHeaderColors.fotos,
    headerColor: TabHeaderColors.fotos,
    headerShown: true,
  },
  {
    name: 'comunica',
    label: 'Comunica',
    subtitle: 'Portal de comunicación',
    emoji: '📣',
    iosIcon: { default: 'globe', selected: 'globe' },
    androidIcon: 'public',
    tintColor: TabHeaderColors.comunica,
    headerColor: TabHeaderColors.comunica,
    headerShown: true,
  },
  {
    name: 'mas',
    label: 'Más',
    subtitle: 'Atajos y secciones',
    emoji: '✨',
    iosIcon: { default: 'ellipsis', selected: 'ellipsis' },
    androidIcon: 'more-horiz',
    tintColor: '#78909C',
    headerShown: false,
  },
];

/**
 * UITabBarController en iPhone sólo muestra 5 items; con 6+ añade un "More"
 * automático del sistema que rompe el estilo de la app. Para evitarlo limitamos
 * la barra nativa a 5 triggers como máximo: los 4 primeros del orden definido
 * más el tab "mas" siempre como 5º (si está visible). El resto se navega desde
 * MasHomeScreen como tarjetas.
 *
 * Las rutas que quedan sin Trigger siguen siendo navegables programáticamente
 * (expo-router las mantiene en el navigation state aunque no tengan tab item).
 */
export const IOS_MAX_NATIVE_TABS = 5;

export interface IOSTabSplit {
  /** Tabs que se mostrarán como triggers nativos (≤ IOS_MAX_NATIVE_TABS). */
  mainTabs: TabConfig[];
  /** Tabs visibles según el perfil pero que no caben en la barra. */
  overflowTabs: TabConfig[];
}

/**
 * Divide la lista de tabs visibles en (mainTabs, overflowTabs) para iOS,
 * garantizando que el tab `mas` (si está visible) sea siempre el último de la
 * barra nativa para que actúe como puerta hacia los overflow.
 */
export function splitTabsForIOS(
  visibleTabNames: ReadonlySet<string>,
): IOSTabSplit {
  const visible = TABS_CONFIG.filter((tab) => visibleTabNames.has(tab.name));

  if (visible.length <= IOS_MAX_NATIVE_TABS) {
    return { mainTabs: visible, overflowTabs: [] };
  }

  const masTab = visible.find((tab) => tab.name === 'mas');
  const nonMas = visible.filter((tab) => tab.name !== 'mas');

  if (!masTab) {
    // Sin "mas" visible: simplemente recortamos a los primeros 5. El resto se
    // pierde porque no hay un sitio razonable donde mostrarlos (no hay MasHome).
    return {
      mainTabs: nonMas.slice(0, IOS_MAX_NATIVE_TABS),
      overflowTabs: nonMas.slice(IOS_MAX_NATIVE_TABS),
    };
  }

  // Hueco para tabs principales = total - 1 (mas siempre al final).
  const mainSlots = IOS_MAX_NATIVE_TABS - 1;
  return {
    mainTabs: [...nonMas.slice(0, mainSlots), masTab],
    overflowTabs: nonMas.slice(mainSlots),
  };
}
