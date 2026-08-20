import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { hexAlpha } from '@/utils/colorUtils';
import WizardButton from './WizardButton';

/**
 * Pantalla de agradecimiento del wizard (envío recién hecho o ya evaluado
 * antes), con icono que entra con spring y un ripple en bucle. Extraído de
 * EvaluationWizard.
 */
export default function SuccessPhase({
  accent,
  theme,
  insets,
  justSubmitted,
  thanksTitle,
  thanksBody,
  onDone,
}: {
  accent: string;
  theme: (typeof Colors)['light'];
  insets: { top: number; bottom: number };
  justSubmitted: boolean;
  thanksTitle?: string;
  thanksBody?: string;
  onDone: () => void;
}) {
  // Con "reducir movimiento" el icono aparece sin el muelle con rebote, y el
  // ripple —un bucle infinito de escala, justo lo que la skill pide quitar—
  // no arranca: la celebración se confirma con el fundido del icono y el
  // texto, no con nada que se repita solo de fondo.
  const reducedMotion = useReducedMotion();
  const scale = useSharedValue(reducedMotion ? 1 : 0);
  const ripple = useSharedValue(0);
  useEffect(() => {
    if (reducedMotion) return;
    scale.set(withSpring(1, { damping: 9, stiffness: 140 }));
    ripple.set(
      withDelay(
        250,
        withRepeat(
          withTiming(1, { duration: 2000, easing: Easing.out(Easing.ease) }),
          -1,
          false,
        ),
      ),
    );
  }, [scale, ripple, reducedMotion]);
  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.get() }],
  }));
  const rippleStyle = useAnimatedStyle(() => ({
    opacity: reducedMotion ? 0 : 0.4 * (1 - ripple.get()),
    transform: [{ scale: 1 + ripple.get() * 1.7 }],
  }));

  return (
    <View
      style={[
        successStyles.root,
        {
          backgroundColor: theme.background,
          paddingTop: insets.top + 28,
          paddingBottom: insets.bottom + 28,
        },
      ]}
    >
      <View style={successStyles.iconWrap}>
        <Animated.View
          style={[
            successStyles.ripple,
            { backgroundColor: hexAlpha(accent, '22') },
            rippleStyle,
          ]}
        />
        <Animated.View
          style={[
            successStyles.iconCircle,
            { backgroundColor: hexAlpha(accent, '15') },
            iconStyle,
          ]}
        >
          <MaterialIcons name="celebration" size={52} color={accent} />
        </Animated.View>
      </View>

      <Animated.Text
        entering={FadeInDown.delay(150).duration(420)}
        style={[successStyles.title, { color: theme.text }]}
      >
        {justSubmitted
          ? (thanksTitle ?? '¡Gracias de corazón!')
          : '¡Ya nos lo has contado!'}
      </Animated.Text>
      <Animated.Text
        entering={FadeInDown.delay(220).duration(420)}
        style={[successStyles.sub, { color: theme.icon }]}
      >
        {justSubmitted
          ? (thanksBody ??
            'Hemos recibido tu evaluación. Nos ayuda muchísimo a mejorar 🙌')
          : 'Ya enviaste tu evaluación. ¡Gracias por tu ayuda!'}
      </Animated.Text>

      <Animated.View
        entering={FadeInUp.delay(320).duration(420)}
        style={successStyles.cta}
      >
        <WizardButton label="Hecho" color={accent} onPress={onDone} />
      </Animated.View>
    </View>
  );
}

const successStyles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  iconWrap: {
    width: 110,
    height: 110,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  ripple: {
    position: 'absolute',
    width: 110,
    height: 110,
    borderRadius: 55,
  },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.4,
    textAlign: 'center',
    marginBottom: 10,
  },
  sub: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    maxWidth: 320,
    marginBottom: 32,
  },
  cta: { width: '100%', maxWidth: 360, gap: 6 },
});
