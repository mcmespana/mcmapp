import { useState } from 'react';
import { Animated } from 'react-native';

/**
 * Un `Animated.Value` estable durante toda la vida del componente.
 *
 * **Por qué no se usa el de `react-native` directamente.** React Native
 * exporta un `useAnimatedValue` desde la 0.71 y la app lo adoptó en agosto de
 * 2026 para quitar los `useRef(new Animated.Value(0))`, que el compilador de
 * React marca (con razón: construyen un objeto en cada render y lo tiran).
 * Pero `react-native-web` **no lo implementa** —a día de hoy, 0.21.2, no está
 * entre sus exports—, así que en web el import se resolvía a `undefined` y
 * todo componente que lo llamara petaba con
 * `useAnimatedValue is not a function`, cazado por el ErrorBoundary. Se
 * llevaba por delante `BottomSheet`, y con él cualquier hoja de la app en web,
 * más `TransposeBottomSheet`, `ReaderSettingsSheet`, `CarismochitoDialogs` y
 * `OTAUpdatePrompt`.
 *
 * Es el mismo patrón que ya nos pasó con `expo-native-compact-tabs` (ver
 * `components/tabs/PlatformTabsLayout.web.tsx`): un módulo que solo existe en
 * nativo, importado desde código que también se empaqueta para web. Aquí no
 * hace falta resolución por plataforma porque el hook cabe en tres líneas y se
 * comporta igual en las dos: el inicializador de `useState` se ejecuta **una
 * sola vez** y de forma perezosa, que es exactamente el contrato que se
 * quería.
 *
 * Hay un test (`__tests__/animatedValueWebSafety.test.ts`) que impide volver a
 * importar `useAnimatedValue` de `react-native`.
 */
export default function useAnimatedValue(initial: number): Animated.Value {
  const [value] = useState(() => new Animated.Value(initial));
  return value;
}
