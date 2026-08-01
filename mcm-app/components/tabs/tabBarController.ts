// Controlador compartido de la barra de tabs flotante.
//
// Guarda el estado "compacta / expandida" fuera de React (store externo con
// useSyncExternalStore) y expone el handler de scroll de Reanimated que lo
// alterna. Es un SINGLETON a propósito: la barra vive en el layout de tabs y
// los scrollers que la colapsan están en pantallas muy repartidas, así que
// necesitan un punto común al que engancharse sin pasar props por media app.
//
// Uso desde una pantalla con scroll:
//
//   const { scrollRef, onScroll } = useCollapsingScroll('cancionero');
//   <Animated.ScrollView ref={scrollRef} onScroll={onScroll}
//     scrollEventThrottle={16} … />
//
// La clave que se pasa es el `name` del tab (TABS_CONFIG). Sirve para que al
// re-tapear el tab activo la barra pueda mandar ese scroller arriba del todo.

import { createCompactTabBarController } from 'expo-native-compact-tabs';

export const tabBarController = createCompactTabBarController();

export const { useCompact, expand, scrollToTop, useCollapsingScroll } =
  tabBarController;
