import { StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';

// Emojis que flotan por el fondo del "Laboratorio Alpha". Cada partícula se
// mueve de forma determinista según su índice (no usa aleatoriedad real, así
// que la distribución es estable entre renders). Extraído de
// PreviewChannelModal.

const FLOATING_EMOJIS = [
  '🚀',
  '✨',
  '🌈',
  '🪄',
  '🎉',
  '🧪',
  '🔮',
  '⭐',
  '💫',
  '🌟',
  '🎈',
  '🛸',
];

export function FloatingParticle({
  index,
  width,
  height,
  phase,
}: {
  index: number;
  width: number;
  height: number;
  phase: SharedValue<number>;
}) {
  const emoji = FLOATING_EMOJIS[index % FLOATING_EMOJIS.length];
  // "Aleatorio" determinista por índice (LCG-ish — basta para distribuir).
  const baseX = ((index * 173) % 100) / 100;
  const baseY = ((index * 271) % 100) / 100;
  const ampX = 40 + ((index * 11) % 60);
  const ampY = 30 + ((index * 13) % 70);
  const speedX = 0.6 + ((index * 7) % 9) / 18;
  const speedY = 0.7 + ((index * 5) % 11) / 22;
  const rotSpeed = 30 + ((index * 17) % 60);
  const size = 22 + ((index * 3) % 18);

  const animatedStyle = useAnimatedStyle(() => {
    const t = phase.value;
    const x = baseX * width + Math.sin(t * speedX + index) * ampX;
    const y = baseY * height + Math.cos(t * speedY + index) * ampY;
    const rot = (t * rotSpeed + index * 50) % 360;
    const scale = 0.85 + Math.sin(t * 1.4 + index) * 0.18;
    return {
      transform: [
        { translateX: x },
        { translateY: y },
        { rotate: `${rot}deg` },
        { scale },
      ],
    };
  });

  return (
    <Animated.Text
      style={[styles.particle, { fontSize: size }, animatedStyle]}
      allowFontScaling={false}
    >
      {emoji}
    </Animated.Text>
  );
}

const styles = StyleSheet.create({
  particle: {
    position: 'absolute',
    top: 0,
    left: 0,
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowRadius: 6,
    textShadowOffset: { width: 0, height: 2 },
  },
});
