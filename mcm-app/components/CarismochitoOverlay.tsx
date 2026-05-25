import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Ellipse, Path } from 'react-native-svg';
import { useCarismochito } from '@/contexts/CarismochitoContext';
import { useShakeDetector } from '@/hooks/useShakeDetector';
import { h } from '@/utils/haptics';

// Verdes deliberadamente exagerados — guiño a la mascota MCM.
const SLIME = '#7FFF00'; // verde lima eléctrico ("muy feo")
const SLIME_DEEP = '#5BC700';
const SLIME_DARK = '#0D2E00';

/* -------------------------------------------------------------------------- */
/* Mascota                                                                    */
/* -------------------------------------------------------------------------- */

function CarismochitoFace({ size = 140 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120">
      {/* Aura — anillo translúcido */}
      <Circle cx="60" cy="62" r="58" fill={SLIME} opacity={0.18} />
      {/* Cuerpo */}
      <Path
        d="M60 10 C32 10 14 36 14 64 C14 90 32 110 60 110 C88 110 106 90 106 64 C106 36 88 10 60 10 Z"
        fill={SLIME}
      />
      {/* Brillo */}
      <Ellipse cx="42" cy="32" rx="14" ry="7" fill="#E8FFB8" opacity={0.85} />
      {/* Ojos */}
      <Circle cx="44" cy="56" r="9" fill={SLIME_DARK} />
      <Circle cx="76" cy="56" r="9" fill={SLIME_DARK} />
      <Circle cx="47" cy="53" r="3" fill="#fff" />
      <Circle cx="79" cy="53" r="3" fill="#fff" />
      {/* Sonrisa */}
      <Path
        d="M40 74 Q60 92 80 74"
        stroke={SLIME_DARK}
        strokeWidth={4}
        strokeLinecap="round"
        fill="none"
      />
      {/* Lengua */}
      <Path d="M52 82 Q60 90 68 82 Q60 88 52 82 Z" fill="#FF6B9D" />
      {/* Mejillas */}
      <Circle cx="26" cy="72" r="6" fill={SLIME_DEEP} opacity={0.55} />
      <Circle cx="94" cy="72" r="6" fill={SLIME_DEEP} opacity={0.55} />
    </Svg>
  );
}

/* -------------------------------------------------------------------------- */
/* Pantalla de cuenta atrás                                                   */
/* -------------------------------------------------------------------------- */

function CountdownScreen({
  countdown,
  onCancel,
}: {
  countdown: number;
  onCancel: () => void;
}) {
  const insets = useSafeAreaInsets();
  // Pop-in del modal al aparecer
  const enter = useRef(new Animated.Value(0)).current;
  // Pulso del número en cada tick
  const numberScale = useRef(new Animated.Value(1)).current;
  // Bobbing de la mascota
  const bob = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(enter, {
      toValue: 1,
      tension: 90,
      friction: 10,
      useNativeDriver: true,
    }).start();
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(bob, {
          toValue: 0,
          duration: 900,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [enter, bob]);

  useEffect(() => {
    // Pulso en cada cambio del número
    numberScale.setValue(0.6);
    Animated.spring(numberScale, {
      toValue: 1,
      tension: 80,
      friction: 6,
      useNativeDriver: true,
    }).start();
    h.tap();
  }, [countdown, numberScale]);

  const enterOpacity = enter;
  const enterScale = enter.interpolate({
    inputRange: [0, 1],
    outputRange: [0.92, 1],
  });
  const bobY = bob.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -10],
  });

  return (
    <Animated.View
      style={[styles.countdownRoot, { opacity: enterOpacity }]}
      pointerEvents="auto"
    >
      {/* Fondo en degradado verde-oscuro */}
      <LinearGradient
        colors={['#001A00', SLIME_DARK, '#0D4400']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {/* Halo de lima */}
      <View pointerEvents="none" style={styles.haloOuter}>
        <View style={styles.halo} />
      </View>

      <Animated.View
        style={[
          styles.countdownContent,
          { transform: [{ scale: enterScale }] },
          { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 },
        ]}
      >
        <Animated.View style={{ transform: [{ translateY: bobY }] }}>
          <CarismochitoFace size={150} />
        </Animated.View>

        <Text style={styles.activatingLabel}>activando modo</Text>
        <Text style={styles.carismoTitle}>CARISMOCHITO</Text>

        <Animated.Text
          style={[styles.number, { transform: [{ scale: numberScale }] }]}
        >
          {countdown}
        </Animated.Text>

        <Text style={styles.subtle}>
          Agita otra vez o pulsa Cancelar para cortar
        </Text>

        <Pressable
          onPress={() => {
            h.remove();
            onCancel();
          }}
          style={({ pressed }) => [
            styles.cancelBtn,
            pressed && { opacity: 0.75, transform: [{ scale: 0.98 }] },
          ]}
          hitSlop={8}
        >
          <Text style={styles.cancelText}>Cancelar</Text>
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}

/* -------------------------------------------------------------------------- */
/* Tinte + badge flotante mientras está activo                                */
/* -------------------------------------------------------------------------- */

function ActiveTint() {
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fade, {
      toValue: 1,
      duration: 700,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [fade]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, styles.tintRoot, { opacity: fade }]}
    >
      {/* Capa verde plana — el "wash" general */}
      <View style={[StyleSheet.absoluteFill, styles.tintFlat]} />
      {/* Viñeta superior */}
      <LinearGradient
        colors={[`${SLIME}CC`, 'transparent']}
        style={[StyleSheet.absoluteFill, { height: '40%' }]}
      />
      {/* Viñeta inferior */}
      <LinearGradient
        colors={['transparent', `${SLIME}CC`]}
        style={[StyleSheet.absoluteFill, { top: '60%', height: '40%' }]}
      />
    </Animated.View>
  );
}

function FloatingBadge({ onDeactivate }: { onDeactivate: () => void }) {
  const insets = useSafeAreaInsets();
  const enter = useRef(new Animated.Value(0)).current;
  const bob = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(enter, {
      toValue: 1,
      tension: 80,
      friction: 9,
      useNativeDriver: true,
    }).start();
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, {
          toValue: 1,
          duration: 1100,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(bob, {
          toValue: 0,
          duration: 1100,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [enter, bob]);

  const translateY = Animated.add(
    enter.interpolate({
      inputRange: [0, 1],
      outputRange: [-60, 0],
    }),
    bob.interpolate({
      inputRange: [0, 1],
      outputRange: [0, -4],
    }),
  );

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.badgeRoot,
        { top: insets.top + 8, opacity: enter, transform: [{ translateY }] },
      ]}
    >
      <Pressable
        onPress={() => {
          h.toggle();
          onDeactivate();
        }}
        style={({ pressed }) => [
          styles.badge,
          pressed && { transform: [{ scale: 0.97 }], opacity: 0.92 },
        ]}
        hitSlop={6}
      >
        <CarismochitoFace size={36} />
        <View style={styles.badgeText}>
          <Text style={styles.badgeTitle}>MODO CARISMOCHITO</Text>
          <Text style={styles.badgeSubtitle}>Agita o tócame para salir</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

/* -------------------------------------------------------------------------- */
/* Overlay principal                                                          */
/* -------------------------------------------------------------------------- */

export default function CarismochitoOverlay() {
  const { state, countdown, toggleByShake, cancelCountdown, deactivate } =
    useCarismochito();

  // Listener de shake siempre activo — el contexto decide qué hacer según estado.
  useShakeDetector(toggleByShake);

  // Haptic + log al entrar en activo
  useEffect(() => {
    if (state === 'active') h.formSuccess();
  }, [state]);

  return (
    <>
      {state === 'active' ? <ActiveTint /> : null}
      {state === 'active' ? <FloatingBadge onDeactivate={deactivate} /> : null}
      {state === 'countingDown' ? (
        <View style={styles.modalRoot} pointerEvents="auto">
          <CountdownScreen countdown={countdown} onCancel={cancelCountdown} />
        </View>
      ) : null}
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Estilos                                                                    */
/* -------------------------------------------------------------------------- */

const styles = StyleSheet.create({
  /* Tinte activo */
  tintRoot: {
    zIndex: 50,
    elevation: 50,
  },
  tintFlat: {
    backgroundColor: SLIME,
    opacity: 0.32,
  },

  /* Badge flotante */
  badgeRoot: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 9500,
    elevation: 60,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SLIME_DARK,
    borderRadius: 28,
    paddingVertical: 6,
    paddingLeft: 6,
    paddingRight: 16,
    gap: 10,
    borderWidth: 2,
    borderColor: SLIME,
    ...Platform.select({
      ios: {
        shadowColor: SLIME,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.55,
        shadowRadius: 18,
      },
      android: {
        elevation: 16,
      },
      default: {
        // @ts-ignore - web only
        boxShadow: `0px 6px 22px ${SLIME}AA`,
      },
    }),
  },
  badgeText: {
    paddingRight: 4,
  },
  badgeTitle: {
    color: SLIME,
    fontWeight: '900',
    fontSize: 12,
    letterSpacing: 1.4,
  },
  badgeSubtitle: {
    color: '#D4F5A0',
    fontSize: 10,
    marginTop: 2,
    letterSpacing: 0.3,
  },

  /* Modal de cuenta atrás */
  modalRoot: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9998,
    elevation: 80,
  },
  countdownRoot: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  countdownContent: {
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  haloOuter: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  halo: {
    width: 420,
    height: 420,
    borderRadius: 210,
    backgroundColor: SLIME,
    opacity: 0.18,
    ...Platform.select({
      ios: {
        shadowColor: SLIME,
        shadowOpacity: 0.7,
        shadowRadius: 80,
        shadowOffset: { width: 0, height: 0 },
      },
      android: { elevation: 0 },
      default: {
        // @ts-ignore - web only
        boxShadow: `0px 0px 120px ${SLIME}`,
      },
    }),
  },
  activatingLabel: {
    color: SLIME,
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 4,
    textTransform: 'uppercase',
    marginTop: 18,
    opacity: 0.85,
  },
  carismoTitle: {
    color: '#E8FFB8',
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 3,
    marginTop: 4,
    textShadowColor: SLIME,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 18,
  },
  number: {
    color: SLIME,
    fontSize: 140,
    fontWeight: '900',
    marginTop: 8,
    textShadowColor: SLIME,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 24,
    includeFontPadding: false,
    lineHeight: 150,
  },
  subtle: {
    color: '#A3D86E',
    fontSize: 13,
    marginTop: 4,
    marginBottom: 28,
    textAlign: 'center',
    opacity: 0.85,
  },
  cancelBtn: {
    paddingVertical: 14,
    paddingHorizontal: 36,
    borderRadius: 30,
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: SLIME,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
      },
      android: { elevation: 8 },
      default: {
        // @ts-ignore - web only
        boxShadow: '0px 4px 14px rgba(0,0,0,0.3)',
      },
    }),
  },
  cancelText: {
    color: SLIME_DARK,
    fontWeight: '800',
    fontSize: 16,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
});
