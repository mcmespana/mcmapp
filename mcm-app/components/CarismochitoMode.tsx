import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  Animated,
  Easing,
  Dimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useShakeDetector } from '@/hooks/useShakeDetector';
import { h } from '@/utils/haptics';

const STORAGE_KEY = '@carismochito_mode_v1';
const COUNTDOWN_SECONDS = 5;

/** Verde "Carismochito" — feo, chillón, inolvidable. */
const UGLY_GREEN = '#39FF14';
const UGLY_GREEN_DARK = '#1FAB0A';

type Phase = 'idle' | 'countdown';
type CountdownGoal = 'activate' | 'deactivate';

/**
 * Modo Carismochito: agita el dispositivo y aparece una cuenta atrás de 5s
 * que, al completarse, tiñe la app del verde más feo del mundo (la mascota
 * Carismochito en su esplendor). Vuelve a agitar para desactivarlo.
 *
 * Pensado para colocarse una sola vez en el root layout. No bloquea
 * interacciones con la app — el overlay verde tiene pointerEvents="none".
 */
export default function CarismochitoMode() {
  const [active, setActive] = useState(false);
  const [phase, setPhase] = useState<Phase>('idle');
  const [goal, setGoal] = useState<CountdownGoal>('activate');
  const [secondsLeft, setSecondsLeft] = useState(COUNTDOWN_SECONDS);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Restaurar estado persistido al arrancar.
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((v) => {
        if (v === '1') setActive(true);
      })
      .catch(() => {});
  }, []);

  // Persistir cambios.
  useEffect(() => {
    AsyncStorage.setItem(STORAGE_KEY, active ? '1' : '0').catch(() => {});
  }, [active]);

  const clearCountdown = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const cancelCountdown = useCallback(() => {
    clearCountdown();
    setPhase('idle');
    h.tap();
  }, [clearCountdown]);

  const startCountdown = useCallback(
    (g: CountdownGoal) => {
      clearCountdown();
      setGoal(g);
      setSecondsLeft(COUNTDOWN_SECONDS);
      setPhase('countdown');
      h.add();
      intervalRef.current = setInterval(() => {
        setSecondsLeft((s) => {
          if (s <= 1) {
            clearCountdown();
            setPhase('idle');
            setActive((wasActive) => {
              const next = g === 'activate';
              if (next !== wasActive) {
                if (next) h.formSuccess();
                else h.success();
              }
              return next;
            });
            return 0;
          }
          h.tap();
          return s - 1;
        });
      }, 1000);
    },
    [clearCountdown],
  );

  // Limpieza al desmontar.
  useEffect(() => clearCountdown, [clearCountdown]);

  const handleShake = useCallback(() => {
    if (phase === 'countdown') {
      cancelCountdown();
      return;
    }
    startCountdown(active ? 'deactivate' : 'activate');
  }, [phase, active, startCountdown, cancelCountdown]);

  useShakeDetector(handleShake);

  return (
    <>
      {active ? <GreenOverlay /> : null}
      <CountdownModal
        visible={phase === 'countdown'}
        secondsLeft={secondsLeft}
        goal={goal}
        onCancel={cancelCountdown}
      />
    </>
  );
}

// ---------- Overlay verde permanente cuando el modo está activo ----------

function GreenOverlay() {
  const pulse = useRef(new Animated.Value(0)).current;
  const bounce = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1400,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1400,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    const bounceLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(bounce, {
          toValue: 1,
          duration: 700,
          easing: Easing.bezier(0.34, 1.56, 0.64, 1),
          useNativeDriver: true,
        }),
        Animated.timing(bounce, {
          toValue: 0,
          duration: 700,
          easing: Easing.bezier(0.34, 1.56, 0.64, 1),
          useNativeDriver: true,
        }),
      ]),
    );
    pulseLoop.start();
    bounceLoop.start();
    return () => {
      pulseLoop.stop();
      bounceLoop.stop();
    };
  }, [pulse, bounce]);

  const tintOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.22, 0.36],
  });
  const badgeScale = bounce.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.06],
  });
  const badgeRotate = bounce.interpolate({
    inputRange: [0, 1],
    outputRange: ['-2deg', '2deg'],
  });

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Velo verde global */}
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: UGLY_GREEN, opacity: tintOpacity },
        ]}
      />
      {/* Borde grueso para marcar territorio carismochito */}
      <View style={styles.borderFrame} />
      {/* Badge flotante arriba */}
      <View style={styles.badgeWrapper} pointerEvents="none">
        <Animated.View
          style={[
            styles.badge,
            {
              transform: [{ scale: badgeScale }, { rotate: badgeRotate }],
            },
          ]}
        >
          <Text style={styles.badgeEmoji}>🐸</Text>
          <Text style={styles.badgeText}>MODO CARISMOCHITO</Text>
          <Text style={styles.badgeEmoji}>🐸</Text>
        </Animated.View>
        <Text style={styles.badgeHint}>agita para desactivar</Text>
      </View>
    </View>
  );
}

// ---------- Modal de cuenta atrás ----------

function CountdownModal({
  visible,
  secondsLeft,
  goal,
  onCancel,
}: {
  visible: boolean;
  secondsLeft: number;
  goal: CountdownGoal;
  onCancel: () => void;
}) {
  const ringScale = useRef(new Animated.Value(1)).current;
  const tickScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!visible) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(ringScale, {
          toValue: 1.08,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(ringScale, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [visible, ringScale]);

  useEffect(() => {
    if (!visible) return;
    tickScale.setValue(1.35);
    Animated.spring(tickScale, {
      toValue: 1,
      friction: 4,
      tension: 90,
      useNativeDriver: true,
    }).start();
  }, [secondsLeft, visible, tickScale]);

  const title = goal === 'activate' ? 'Activando' : 'Desactivando';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
      statusBarTranslucent
    >
      <Pressable style={styles.modalBackdrop} onPress={onCancel}>
        <Pressable style={styles.modalCard} onPress={() => {}}>
          <Text style={styles.modalEyebrow}>{title}</Text>
          <Text style={styles.modalTitle}>Modo{'\n'}Carismochito</Text>

          <View style={styles.ringContainer}>
            <Animated.View
              style={[styles.ringOuter, { transform: [{ scale: ringScale }] }]}
            />
            <View style={styles.ringInner}>
              <Animated.Text
                style={[
                  styles.ringNumber,
                  { transform: [{ scale: tickScale }] },
                ]}
              >
                {secondsLeft}
              </Animated.Text>
            </View>
          </View>

          <Text style={styles.modalHint}>
            Pulsa fuera o el botón para cancelar
          </Text>

          <Pressable
            style={({ pressed }) => [
              styles.cancelBtn,
              pressed && styles.cancelBtnPressed,
            ]}
            onPress={onCancel}
            accessibilityRole="button"
            accessibilityLabel="Cancelar"
          >
            <Text style={styles.cancelBtnText}>Cancelar</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const { width: SCREEN_W } = Dimensions.get('window');

const styles = StyleSheet.create({
  // Marco verde feo del modo activo.
  borderFrame: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 6,
    borderColor: UGLY_GREEN,
  },
  badgeWrapper: {
    position: 'absolute',
    top: Platform.select({ ios: 60, android: 40, default: 24 }),
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: UGLY_GREEN,
    borderColor: UGLY_GREEN_DARK,
    borderWidth: 2,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    shadowColor: UGLY_GREEN_DARK,
    shadowOpacity: 0.5,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 8,
    elevation: 6,
  },
  badgeText: {
    color: '#0a2a00',
    fontWeight: '900',
    fontSize: 13,
    letterSpacing: 1.2,
  },
  badgeEmoji: {
    fontSize: 16,
  },
  badgeHint: {
    marginTop: 4,
    fontSize: 11,
    fontWeight: '700',
    color: UGLY_GREEN_DARK,
    backgroundColor: 'rgba(255,255,255,0.85)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    overflow: 'hidden',
  },

  // Modal de cuenta atrás.
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(10, 30, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: Math.min(SCREEN_W - 48, 340),
    backgroundColor: '#ffffff',
    borderRadius: 28,
    paddingVertical: 28,
    paddingHorizontal: 24,
    alignItems: 'center',
    borderWidth: 4,
    borderColor: UGLY_GREEN,
    shadowColor: UGLY_GREEN_DARK,
    shadowOpacity: 0.45,
    shadowOffset: { width: 0, height: 12 },
    shadowRadius: 24,
    elevation: 12,
  },
  modalEyebrow: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 2,
    color: UGLY_GREEN_DARK,
    textTransform: 'uppercase',
  },
  modalTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: '#0a2a00',
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 32,
  },
  ringContainer: {
    width: 160,
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    marginBottom: 12,
  },
  ringOuter: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 80,
    borderWidth: 8,
    borderColor: UGLY_GREEN,
    opacity: 0.6,
  },
  ringInner: {
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: UGLY_GREEN,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringNumber: {
    fontSize: 72,
    fontWeight: '900',
    color: '#0a2a00',
    includeFontPadding: false,
  },
  modalHint: {
    marginTop: 4,
    fontSize: 12,
    color: '#445544',
    textAlign: 'center',
  },
  cancelBtn: {
    marginTop: 16,
    backgroundColor: '#0a2a00',
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 999,
  },
  cancelBtnPressed: {
    opacity: 0.7,
  },
  cancelBtnText: {
    color: UGLY_GREEN,
    fontWeight: '800',
    letterSpacing: 1,
  },
});
