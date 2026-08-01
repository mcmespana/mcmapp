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
    name: 'comunica',
    label: 'Comunica',
    subtitle: 'Portal de comunicación',
    emoji: '📣',
    iosIcon: { default: 'globe', selected: 'globe' },
    androidIcon: 'public',
    tintColor: TabHeaderColors.comunica,
    headerColor: TabHeaderColors.comunica,
    // La pantalla es un WebView a pantalla completa que gestiona su propia zona
    // segura (barra glass en el notch); un header encima la partiría.
    headerShown: false,
  },
  {
    name: 'visitapapa',
    label: 'Visita Papa',
    subtitle: 'Visita del Papa León XIV 2026',
    emoji: '🕊️',
    iosIcon: { default: 'building.columns', selected: 'building.columns.fill' },
    androidIcon: 'church',
    tintColor: TabHeaderColors.visitapapa,
    headerColor: TabHeaderColors.visitapapa,
    headerShown: false, // Tab con su propio StackNavigator header
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
 * Cuántos items caben en la barra de pestañas.
 *
 * Antes el tope era 5 y venía impuesto por iOS: `UITabBarController` en iPhone
 * sólo muestra 5 items y con 6+ añade un "More" automático del sistema que
 * rompía el estilo de la app. Con la barra flotante propia
 * (`components/tabs/CompactTabBar.tsx`) esa limitación desaparece, así que el
 * tope pasa a ser una decisión de diseño —6 iconos siguen entrando cómodos en
 * el ancho del modo compacto— y se aplica por igual en iOS y en Android.
 *
 * Los tabs que no caben se muestran como tarjetas en MasHomeScreen. Sus rutas
 * siguen siendo navegables programáticamente (expo-router las mantiene en el
 * navigation state aunque no tengan item en la barra).
 */
export const MAX_TAB_BAR_ITEMS = 6;

export interface TabBarSplit {
  /** Tabs que se mostrarán en la barra (≤ MAX_TAB_BAR_ITEMS). */
  mainTabs: TabConfig[];
  /** Tabs visibles según el perfil pero que no caben en la barra. */
  overflowTabs: TabConfig[];
}

/**
 * Divide la lista de tabs visibles en (mainTabs, overflowTabs), garantizando
 * que el tab `mas` (si está visible) sea siempre el último de la barra para
 * que actúe como puerta hacia los overflow.
 */
export function splitTabsForBar(
  visibleTabNames: ReadonlySet<string>,
): TabBarSplit {
  const visible = TABS_CONFIG.filter((tab) => visibleTabNames.has(tab.name));

  if (visible.length <= MAX_TAB_BAR_ITEMS) {
    return { mainTabs: visible, overflowTabs: [] };
  }

  const masTab = visible.find((tab) => tab.name === 'mas');
  const nonMas = visible.filter((tab) => tab.name !== 'mas');

  if (!masTab) {
    // Sin "mas" visible: simplemente recortamos. El resto se pierde porque no
    // hay un sitio razonable donde mostrarlos (no hay MasHome).
    return {
      mainTabs: nonMas.slice(0, MAX_TAB_BAR_ITEMS),
      overflowTabs: nonMas.slice(MAX_TAB_BAR_ITEMS),
    };
  }

  // Hueco para tabs principales = total - 1 (mas siempre al final).
  const mainSlots = MAX_TAB_BAR_ITEMS - 1;
  return {
    mainTabs: [...nonMas.slice(0, mainSlots), masTab],
    overflowTabs: nonMas.slice(mainSlots),
  };
}
