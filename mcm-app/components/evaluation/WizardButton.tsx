import { Pressable, StyleSheet, Text } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { MaterialIcons } from '@expo/vector-icons';
import { hexAlpha } from '@/utils/colorUtils';

/**
 * Botón principal del wizard de evaluación, con micro-animación de pulsación.
 * Extraído de EvaluationWizard.
 */
export default function WizardButton({
  label,
  onPress,
  color,
  disabled,
  loading,
}: {
  label: string;
  onPress: () => void;
  color: string;
  disabled?: boolean;
  loading?: boolean;
}) {
  const scale = useSharedValue(1);
  const aStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  return (
    <Animated.View style={aStyle}>
      <Pressable
        accessibilityRole="button"
        disabled={disabled}
        onPressIn={() => (scale.value = withTiming(0.97, { duration: 90 }))}
        onPressOut={() => (scale.value = withTiming(1, { duration: 140 }))}
        onPress={onPress}
        style={[
          btnStyles.btn,
          {
            backgroundColor: disabled ? hexAlpha(color, '45') : color,
            shadowColor: color,
            shadowOpacity: disabled ? 0 : 0.3,
          },
        ]}
      >
        <Text style={btnStyles.label}>{label}</Text>
        {!loading && (
          <MaterialIcons name="arrow-forward" size={18} color="#fff" />
        )}
      </Pressable>
    </Animated.View>
  );
}

const btnStyles = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
    paddingVertical: 16,
    borderRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 14,
    elevation: 4,
  },
  label: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
});
