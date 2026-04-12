import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  ScrollView,
} from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Button, useToast, PressableFeedback } from 'heroui-native';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/colors';
import { useContigoHabits, PrayerDuration } from '@/hooks/useContigoHabits';

export default function OracionScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { toast } = useToast();
  const { setPrayerDone, todayStr } = useContigoHabits();

  const [selectedDuration, setSelectedDuration] = useState<number>(15);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Breathing animation value
  const breatheAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(breatheAnim, {
          toValue: 1,
          duration: 3000,
          useNativeDriver: true,
        }),
        Animated.timing(breatheAnim, {
          toValue: 0,
          duration: 3000,
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, [breatheAnim]);

  const breatheScale = breatheAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.05],
  });

  const breatheOpacity = breatheAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.6, 0.9],
  });

  // Handle timer logic
  useEffect(() => {
    if (isTimerRunning) {
      timerRef.current = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isTimerRunning]);

  const toggleTimer = () => {
    setIsTimerRunning(!isTimerRunning);
  };

  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleRegisterPrayer = async () => {
    let durationType: PrayerDuration = '5_to_10'; // default
    if (selectedDuration < 5) durationType = '2_to_4';
    else if (selectedDuration >= 5 && selectedDuration < 10)
      durationType = '5_to_10';
    else if (selectedDuration >= 10 && selectedDuration < 15)
      durationType = '10_to_15';
    else if (selectedDuration >= 15) durationType = 'more_than_15';

    try {
      // Defaulting emotion to 'joy' for now as there is no emotion selector in UI
      await setPrayerDone(todayStr, durationType, 'joy');
      toast.show({
        variant: 'success',
        label: 'Tiempo de oración registrado',
      });
      router.back();
    } catch (e) {
      toast.show({
        variant: 'danger',
        label: 'Error al registrar tiempo',
      });
    }
  };

  const scheme = useColorScheme();
  const isDark = scheme === 'dark';

  // Custom colors for this specific screen based on the design
  const colors = {
    background: isDark ? '#101b22' : '#fdfaf6',
    textPrimary: isDark ? '#f1f5f9' : '#1e293b', // slate-100 / slate-800
    textSecondary: isDark ? '#94a3b8' : '#64748b', // slate-400 / slate-500
    textMuted: isDark ? '#64748b' : '#94a3b8', // slate-500 / slate-400
    primary: '#3ea8ef',
    surface: isDark ? 'rgba(30, 41, 59, 0.5)' : '#ffffff',
    border: isDark ? 'rgba(51, 65, 85, 0.8)' : 'rgba(241, 245, 249, 1)',
    cardHover: 'rgba(62, 168, 239, 0.1)',
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={
          isDark
            ? ['rgba(26,42,53,0.8)', 'rgba(16,27,34,1)', 'rgba(28,28,22,0.8)']
            : [
                'rgba(227,242,253,0.8)',
                'rgba(253,250,246,1)',
                'rgba(253,246,227,0.8)',
              ]
        }
        style={StyleSheet.absoluteFill}
        start={{ x: 1, y: 0 }}
        end={{ x: 0, y: 1 }}
      />

      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={[
              styles.backButton,
              {
                backgroundColor: isDark
                  ? 'rgba(30,41,59,0.5)'
                  : 'rgba(255,255,255,0.5)',
              },
            ]}
          >
            <MaterialIcons
              name="arrow-back-ios"
              size={20}
              color={colors.textSecondary}
              style={{ marginLeft: 6 }}
            />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.textSecondary }]}>
            ORACIÓN
          </Text>
          <View style={{ width: 48 }} />
        </View>

        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: 24 }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Explanatory Quote */}
          <View style={styles.quoteContainer}>
            <Text style={[styles.quoteText, { color: colors.textPrimary }]}>
              “No se trata de cronometrar el tiempo de oración, sino de poder
              apuntar cada día como vas en esto de estar un rato con Jesús.”
            </Text>
          </View>

          {/* Subtle Breathing Timer Area */}
          <View style={styles.timerSection}>
            <View style={styles.timerContainer}>
              {/* Animated Inner Ring */}
              <Animated.View
                style={[
                  styles.animatedRing,
                  {
                    backgroundColor: 'rgba(62, 168, 239, 0.1)',
                    transform: [{ scale: breatheScale }],
                    opacity: breatheOpacity,
                  },
                ]}
              />
              {/* Static Outer Ring */}
              <View
                style={[
                  styles.staticRing,
                  { borderColor: 'rgba(62, 168, 239, 0.2)' },
                ]}
              />

              {/* Timer Text */}
              <View style={styles.timerTextContainer}>
                <Text style={styles.timerLabel}>En presencia</Text>
                <Text
                  style={[styles.timerValue, { color: colors.textPrimary }]}
                >
                  {formatTime(elapsedSeconds)}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={[
                styles.startAccompButton,
                {
                  borderColor: isTimerRunning ? colors.primary : colors.border,
                  backgroundColor: isTimerRunning
                    ? 'rgba(62, 168, 239, 0.1)'
                    : isDark
                      ? 'rgba(30,41,59,0.3)'
                      : 'transparent',
                },
              ]}
              onPress={toggleTimer}
            >
              <MaterialIcons
                name={isTimerRunning ? 'pause' : 'play-arrow'}
                size={18}
                color={isTimerRunning ? colors.primary : colors.textSecondary}
              />
              <Text
                style={[
                  styles.startAccompText,
                  {
                    color: isTimerRunning
                      ? colors.primary
                      : colors.textSecondary,
                  },
                ]}
              >
                {isTimerRunning
                  ? 'Pausar acompañamiento'
                  : 'Iniciar acompañamiento'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Subtítulo & Manual Entry */}
          <View style={styles.manualEntrySection}>
            <Text
              style={[styles.sectionTitle, { color: colors.textSecondary }]}
            >
              Registrar tiempo realizado:
            </Text>

            <View style={styles.grid}>
              {[5, 10, 15, 20].map((mins) => {
                const isSelected = selectedDuration === mins;
                return (
                  <TouchableOpacity
                    key={mins}
                    onPress={() => setSelectedDuration(mins)}
                    style={[
                      styles.timeButton,
                      {
                        backgroundColor: isSelected
                          ? 'rgba(62, 168, 239, 0.1)'
                          : colors.surface,
                        borderColor: isSelected
                          ? colors.primary
                          : colors.border,
                        borderWidth: isSelected ? 2 : 1,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.timeButtonValue,
                        {
                          color: isSelected
                            ? colors.primary
                            : colors.textPrimary,
                        },
                      ]}
                    >
                      {mins}
                    </Text>
                    <Text
                      style={[
                        styles.timeButtonUnit,
                        {
                          color: isSelected
                            ? 'rgba(62, 168, 239, 0.7)'
                            : colors.textMuted,
                        },
                      ]}
                    >
                      MIN
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              style={[
                styles.customTimeButton,
                {
                  backgroundColor: isDark
                    ? 'rgba(30,41,59,0.3)'
                    : 'rgba(255,255,255,0.5)',
                  borderColor: colors.border,
                },
              ]}
            >
              <MaterialIcons
                name="edit"
                size={20}
                color={colors.textSecondary}
              />
              <Text
                style={[styles.customTimeText, { color: colors.textSecondary }]}
              >
                Tiempo personalizado
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>

        {/* Primary Action Button Fixed Bottom */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.submitButton}
            onPress={handleRegisterPrayer}
          >
            <Text style={styles.submitButtonText}>Registrar Oración</Text>
            <MaterialIcons name="done-all" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.footerNote}>
            Tú defines tu ritmo, Dios ya está esperando.
          </Text>
        </View>

        {/* Ambient Control */}
        <TouchableOpacity
          style={[
            styles.ambientControl,
            {
              backgroundColor: isDark
                ? 'rgba(30,41,59,0.8)'
                : 'rgba(255,255,255,0.8)',
            },
          ]}
        >
          <MaterialIcons
            name="music-note"
            size={24}
            color={colors.textSecondary}
          />
        </TouchableOpacity>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 16,
    flexGrow: 1,
  },
  quoteContainer: {
    marginTop: 16,
    marginBottom: 48,
    paddingHorizontal: 8,
  },
  quoteText: {
    fontFamily: 'serif',
    fontSize: 24,
    fontStyle: 'italic',
    lineHeight: 34,
    textAlign: 'center',
  },
  timerSection: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 48,
  },
  timerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    height: 200,
    width: 200,
  },
  animatedRing: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
  },
  staticRing: {
    position: 'absolute',
    width: 192,
    height: 192,
    borderRadius: 96,
    borderWidth: 1,
    opacity: 0.4,
  },
  timerTextContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  timerLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 2,
    color: '#3ea8ef',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  timerValue: {
    fontSize: 48,
    fontWeight: '300',
    letterSpacing: -1,
  },
  startAccompButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 32,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 24,
    borderWidth: 1,
  },
  startAccompText: {
    fontSize: 14,
    fontWeight: '500',
  },
  manualEntrySection: {
    marginBottom: 40,
    marginTop: 'auto', // Pushes this down slightly if space permits
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 16,
  },
  grid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  timeButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  timeButtonValue: {
    fontSize: 24,
    fontWeight: '700',
  },
  timeButtonUnit: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginTop: 4,
  },
  customTimeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
    paddingVertical: 12,
    borderRadius: 24,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  customTimeText: {
    fontSize: 14,
    fontWeight: '500',
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  submitButton: {
    backgroundColor: '#3ea8ef',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    height: 64,
    borderRadius: 32,
    shadowColor: '#3ea8ef',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  footerNote: {
    textAlign: 'center',
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 16,
  },
  ambientControl: {
    position: 'absolute',
    bottom: 128,
    right: 24,
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
});
