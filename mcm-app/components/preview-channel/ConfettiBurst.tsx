import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

// Explosión de confeti que se monta bajo demanda al accionar la palanca y se
// desmonta sola al acabar la animación. Dos variantes: 'explode' (activar) y
// 'puff' (desactivar). Extraído de PreviewChannelModal.

const BURST_PARTICLES = 26;

export function ConfettiBurst({
  centerX,
  centerY,
  variant,
}: {
  centerX: number;
  centerY: number;
  variant: 'explode' | 'puff';
}) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {Array.from({ length: BURST_PARTICLES }).map((_, i) => (
        <ConfettiPiece
          key={i}
          index={i}
          centerX={centerX}
          centerY={centerY}
          variant={variant}
        />
      ))}
    </View>
  );
}

function ConfettiPiece({
  index,
  centerX,
  centerY,
  variant,
}: {
  index: number;
  centerX: number;
  centerY: number;
  variant: 'explode' | 'puff';
}) {
  const angle = (index / BURST_PARTICLES) * Math.PI * 2 + (index % 2) * 0.3;
  const distance = variant === 'explode' ? 180 + (index % 5) * 40 : -60;
  const targetX = Math.cos(angle) * distance;
  const targetY = Math.sin(angle) * distance;
  const duration = variant === 'explode' ? 900 + (index % 4) * 120 : 600;

  const t = useSharedValue(0);
  const rot = useSharedValue(0);
  const emoji =
    variant === 'explode'
      ? ['🎉', '✨', '🎊', '⭐', '💫', '🌟'][index % 6]
      : ['💨', '·', '•'][index % 3];

  useEffect(() => {
    t.value = withTiming(1, {
      duration,
      easing: Easing.out(Easing.cubic),
    });
    rot.value = withTiming(360 * (1 + (index % 3)), { duration });
  }, [t, rot, duration, index]);

  const style = useAnimatedStyle(() => {
    const tx = targetX * t.value;
    const ty =
      targetY * t.value + (variant === 'explode' ? t.value * t.value * 80 : 0); // gravedad leve
    const opacity = variant === 'explode' ? 1 - t.value * 0.9 : 1 - t.value;
    const scale = variant === 'explode' ? 1 - t.value * 0.3 : 0.4 + t.value;
    return {
      opacity,
      transform: [
        { translateX: centerX + tx },
        { translateY: centerY + ty },
        { rotate: `${rot.value}deg` },
        { scale },
      ],
    };
  });

  return (
    <Animated.Text style={[styles.confetti, style]} allowFontScaling={false}>
      {emoji}
    </Animated.Text>
  );
}

const styles = StyleSheet.create({
  confetti: {
    position: 'absolute',
    top: 0,
    left: 0,
    fontSize: 26,
  },
});
