import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useToast } from 'heroui-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { useColorScheme } from '@/hooks/useColorScheme';
import { spacing, radii } from '@/constants/uiStyles';
import {
  useContigoHabits,
  PrayerDuration,
  Emotion,
} from '@/hooks/useContigoHabits';

// Emotion configurations based on design
const EMOTIONS = [
  { id: 'joy', label: 'Gozo', color: '#FBBF24' },
  { id: 'sadness', label: 'Tristeza', color: '#60A5FA' },
  { id: 'anger', label: 'Enojo', color: '#F87171' },
  { id: 'fear', label: 'Miedo', color: '#A78BFA' },
  { id: 'disgust', label: 'Disgusto', color: '#34D399' },
] as const;

export default function OracionScreen() {
  const router = useRouter();
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const insets = useSafeAreaInsets();
  const { toast } = useToast();

  const { setPrayerDone, todayStr } = useContigoHabits();

  // State
  const [durationStr, setDurationStr] = useState('15');
  const [selectedEmotion, setSelectedEmotion] = useState<Emotion | null>(null);

  // Animation for background glow
  const activeColor = useSharedValue(isDark ? '#2A2112' : '#F0EBE0');

  useEffect(() => {
    if (selectedEmotion) {
      const emotionConfig = EMOTIONS.find((e) => e.id === selectedEmotion);
      if (emotionConfig) {
        activeColor.value = withTiming(emotionConfig.color, { duration: 500 });
      }
    } else {
      activeColor.value = withTiming(isDark ? '#2A2112' : '#F0EBE0', {
        duration: 500,
      });
    }
  }, [selectedEmotion, isDark, activeColor]);

  const animatedBackground = useAnimatedStyle(() => {
    return {
      backgroundColor: activeColor.value,
      opacity: 0.2, // Subtle glow
    };
  });

  const getDurationEnum = (minutes: number): PrayerDuration => {
    if (minutes < 1) return 'less_than_1';
    if (minutes <= 4) return '2_to_4';
    if (minutes <= 10) return '5_to_10';
    if (minutes <= 15) return '10_to_15';
    return 'more_than_15';
  };

  const handleSave = async () => {
    if (!selectedEmotion) {
      toast.show({
        label: 'Por favor, selecciona cómo te sentiste',
        actionLabel: 'OK',
        onActionPress: ({ hide }) => hide(),
      });
      return;
    }

    const minutes = parseInt(durationStr, 10) || 0;
    const durationEnum = getDurationEnum(minutes);

    try {
      await setPrayerDone(todayStr, durationEnum, selectedEmotion);
      router.back();
    } catch (error) {
      console.error('Failed to save prayer record', error);
      toast.show({
        label: 'Error al guardar el registro',
        actionLabel: 'OK',
        onActionPress: ({ hide }) => hide(),
      });
    }
  };

  const bgColor = isDark ? '#101422' : '#f6f6f8';
  const textColor = isDark ? '#f1f5f9' : '#0f172a';
  const labelColor = isDark ? '#94a3b8' : '#64748b';

  // Custom button style matching the reference
  const primaryColor = '#1138d4'; // Deep blue from reference

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: bgColor }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.container}>
          {/* Ambient Glow */}
          <View style={styles.glowContainer}>
            <Animated.View style={[styles.ambientGlow, animatedBackground]} />
          </View>

          {/* Header / Back Button */}
          <View
            style={[styles.header, { paddingTop: insets.top || spacing.lg }]}
          >
            <TouchableOpacity
              onPress={() => router.back()}
              style={[
                styles.backButton,
                {
                  backgroundColor: isDark
                    ? 'rgba(0,0,0,0.2)'
                    : 'rgba(255,255,255,0.5)',
                  borderColor: isDark
                    ? 'rgba(255,255,255,0.1)'
                    : 'rgba(255,255,255,0.5)',
                },
              ]}
            >
              <MaterialIcons name="arrow-back" size={24} color={textColor} />
            </TouchableOpacity>
          </View>

          {/* Main Content Card */}
          <View style={styles.contentWrapper}>
            <View
              style={[
                styles.glassCard,
                {
                  backgroundColor: isDark
                    ? 'rgba(30, 35, 50, 0.7)'
                    : 'rgba(255, 255, 255, 0.7)',
                  borderColor: isDark
                    ? 'rgba(255, 255, 255, 0.1)'
                    : 'rgba(255, 255, 255, 0.5)',
                },
              ]}
            >
              {Platform.OS === 'ios' && (
                <BlurView
                  tint={isDark ? 'dark' : 'light'}
                  intensity={40}
                  style={StyleSheet.absoluteFill}
                />
              )}

              <View style={styles.innerCard}>
                {/* Title */}
                <Text style={[styles.title, { color: labelColor }]}>
                  TIEMPO DE ORACIÓN
                </Text>

                {/* Duration Input */}
                <View style={styles.durationContainer}>
                  <TextInput
                    style={[styles.durationInput, { color: textColor }]}
                    value={durationStr}
                    onChangeText={setDurationStr}
                    keyboardType="numeric"
                    maxLength={3}
                    selectTextOnFocus
                  />
                  <Text style={[styles.durationUnit, { color: labelColor }]}>
                    min
                  </Text>
                </View>

                {/* Emotions Section */}
                <View style={styles.emotionsSection}>
                  <Text style={[styles.emotionsTitle, { color: labelColor }]}>
                    ¿Cómo te sentiste?
                  </Text>

                  <View style={styles.emotionsRow}>
                    {EMOTIONS.map((emotion) => {
                      const isSelected = selectedEmotion === emotion.id;
                      return (
                        <TouchableOpacity
                          key={emotion.id}
                          onPress={() =>
                            setSelectedEmotion(emotion.id as Emotion)
                          }
                          activeOpacity={0.7}
                        >
                          <AnimatedOrb
                            color={emotion.color}
                            isSelected={isSelected}
                          />
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  <View style={styles.emotionLabelContainer}>
                    <Text
                      style={[
                        styles.emotionLabel,
                        {
                          color: selectedEmotion
                            ? EMOTIONS.find((e) => e.id === selectedEmotion)
                                ?.color
                            : 'transparent',
                        },
                      ]}
                    >
                      {selectedEmotion
                        ? EMOTIONS.find((e) => e.id === selectedEmotion)?.label
                        : ' '}
                    </Text>
                  </View>
                </View>

                {/* Save Button */}
                <TouchableOpacity
                  style={[styles.saveButton, { backgroundColor: primaryColor }]}
                  onPress={handleSave}
                  activeOpacity={0.8}
                >
                  <Text style={styles.saveButtonText}>Guardar</Text>
                  <MaterialIcons name="check-circle" size={20} color="white" />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}

// Separate component for animated orbs
function AnimatedOrb({
  color,
  isSelected,
}: {
  color: string;
  isSelected: boolean;
}) {
  const scale = useSharedValue(isSelected ? 1.2 : 1);
  const opacity = useSharedValue(isSelected ? 1 : 0.5);

  useEffect(() => {
    scale.value = withSpring(isSelected ? 1.2 : 1);
    opacity.value = withTiming(isSelected ? 1 : 0.5, { duration: 200 });
  }, [isSelected, scale, opacity]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
      opacity: opacity.value,
      shadowColor: color,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: isSelected ? 0.6 : 0,
      shadowRadius: isSelected ? 12 : 0,
      elevation: isSelected ? 8 : 0,
    };
  });

  return (
    <Animated.View
      style={[styles.orb, { backgroundColor: color }, animatedStyle]}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  glowContainer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 0,
    pointerEvents: 'none',
  },
  ambientGlow: {
    width: 350,
    height: 350,
    borderRadius: 175,
    filter: 'blur(40px)', // Will work partially on web/some native, fallback to opacity
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    paddingHorizontal: spacing.md,
    zIndex: 20,
  },
  backButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  contentWrapper: {
    width: '100%',
    maxWidth: 400,
    paddingHorizontal: spacing.lg,
    zIndex: 10,
  },
  glassCard: {
    borderRadius: radii.xl,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  innerCard: {
    padding: spacing.xl * 1.5,
    alignItems: 'center',
  },
  title: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 1.5,
    marginBottom: spacing.xl,
  },
  durationContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    marginBottom: spacing.xl * 1.5,
  },
  durationInput: {
    fontSize: 72,
    fontWeight: '800',
    textAlign: 'center',
    padding: 0,
    minWidth: 90,
  },
  durationUnit: {
    fontSize: 28,
    fontWeight: '500',
    marginBottom: 12,
    marginLeft: 8,
  },
  emotionsSection: {
    width: '100%',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  emotionsTitle: {
    fontSize: 15,
    fontWeight: '500',
    marginBottom: spacing.lg,
  },
  emotionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 8,
    marginBottom: spacing.md,
  },
  orb: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  emotionLabelContainer: {
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emotionLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingVertical: 18,
    borderRadius: 999,
    marginTop: spacing.sm,
    gap: 8,
    shadowColor: '#1138d4',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  saveButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
});
