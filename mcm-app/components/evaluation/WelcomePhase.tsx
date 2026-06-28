import { StyleSheet } from 'react-native';
import Animated, { Easing, FadeIn, FadeInUp } from 'react-native-reanimated';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { hexAlpha } from '@/utils/colorUtils';

/**
 * Pantalla de bienvenida del wizard (icono, título, intro y meta "N preguntas ·
 * 2 min") con entradas animadas escalonadas. Extraído de EvaluationWizard.
 */
export default function WelcomePhase({
  title,
  intro,
  total,
  accent,
  theme,
}: {
  title?: string;
  intro?: string;
  total: number;
  accent: string;
  theme: (typeof Colors)['light'];
}) {
  return (
    <Animated.View
      key="welcome"
      entering={FadeIn.duration(420)}
      style={welcomeStyles.welcomeWrap}
    >
      <Animated.View
        entering={FadeIn.duration(560).easing(
          Easing.bezier(0.34, 1.56, 0.64, 1),
        )}
        style={[
          welcomeStyles.welcomeIcon,
          { backgroundColor: hexAlpha(accent, '18') },
        ]}
      >
        <MaterialIcons name="rate-review" size={40} color={accent} />
      </Animated.View>
      <Animated.Text
        entering={FadeInUp.delay(120).duration(420)}
        style={[welcomeStyles.welcomeTitle, { color: theme.text }]}
      >
        {title || 'Evalúa la actividad'}
      </Animated.Text>
      {intro ? (
        <Animated.Text
          entering={FadeInUp.delay(200).duration(420)}
          style={[welcomeStyles.welcomeBody, { color: theme.icon }]}
        >
          {intro}
        </Animated.Text>
      ) : null}
      <Animated.Text
        entering={FadeInUp.delay(280).duration(420)}
        style={[welcomeStyles.welcomeMeta, { color: theme.icon }]}
      >
        {total} {total === 1 ? 'pregunta' : 'preguntas'} · 2 min
      </Animated.Text>
    </Animated.View>
  );
}

const welcomeStyles = StyleSheet.create({
  welcomeWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  welcomeIcon: {
    width: 92,
    height: 92,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  welcomeTitle: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  welcomeBody: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    maxWidth: 320,
  },
  welcomeMeta: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
    opacity: 0.8,
  },
});
