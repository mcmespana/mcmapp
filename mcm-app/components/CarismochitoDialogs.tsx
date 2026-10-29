import React, { useEffect } from 'react';
import {
  Animated,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import useAnimatedValue from '@/hooks/useAnimatedValue';
import { PressableFeedback } from 'heroui-native';
import { LinearGradient } from 'expo-linear-gradient';
import CarismochitoMascot from '@/components/CarismochitoMascot';
import { h } from '@/utils/haptics';
import { CarismoColors } from '@/constants/colors';
import typography from '@/constants/typography';
import { radii } from '@/constants/uiStyles';

/* Verdes del modo (en línea con CarismochitoOverlay). */
const G = CarismoColors.light;
const G_LIGHT = CarismoColors.dark;
const G_GLOW = CarismoColors.glow;
const G_DARK = CarismoColors.deep;

/**
 * Tarjeta central con animación de entrada (escala + fade).
 *
 * Con el `Animated` de React Native, NO con Reanimated: esto vive dentro de un
 * `Modal` y ahí las animaciones de Reanimated no corren (ver el aviso de
 * `components/BottomSheet.tsx`). Como la tarjeta nace a opacidad 0, quedarse
 * sin animación no era "sale de golpe": era una tarjeta invisible.
 */
function PopCard({ children }: { children: React.ReactNode }) {
  const enter = useAnimatedValue(0);
  useEffect(() => {
    Animated.spring(enter, {
      toValue: 1,
      useNativeDriver: Platform.OS !== 'web',
      tension: 90,
      friction: 9,
    }).start();
  }, [enter]);

  const cardStyle = {
    opacity: enter,
    transform: [
      {
        scale: enter.interpolate({
          inputRange: [0, 1],
          outputRange: [0.85, 1],
        }),
      },
    ],
  };

  return (
    <View style={styles.backdrop}>
      <Animated.View style={[styles.card, cardStyle]}>
        <LinearGradient
          colors={[CarismoColors.deepEdge, G_DARK]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        {children}
      </Animated.View>
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* Onboarding / explicación del modo                                          */
/* -------------------------------------------------------------------------- */

export function CarismochitoOnboarding({
  visible,
  onDismiss,
  onExit,
  huntEnabled = false,
}: {
  visible: boolean;
  onDismiss: () => void;
  /**
   * Botón "Salir del modo" para quien no puede (o no quiere) agitar el móvil,
   * p. ej. con el iPad sobre el atril. Sin esta prop no se muestra.
   */
  onExit?: () => void;
  /** Con la caza del Laboratorio Alpha encendida ya se pueden atrapar. */
  huntEnabled?: boolean;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
      statusBarTranslucent
    >
      <PopCard>
        <View style={styles.mascotWrap}>
          <CarismochitoMascot size={96} dance={2} />
        </View>

        <Text style={styles.title}>¡Has despertado a Carismochito!</Text>

        <Text style={styles.body}>
          Mientras el modo está activo, Carismochito andará escondido por la
          app. Échale un ojo: aparece y desaparece cuando menos lo esperas. 👀
        </Text>

        {/* Teaser de futuro, sin destripar — salvo con la caza encendida. */}
        <View style={styles.teaser}>
          {huntEnabled ? (
            <Text style={styles.teaserText}>
              ✨ Tócalo cuando se asome para{' '}
              <Text style={styles.teaserStrong}>atraparlo</Text>. Hay más de
              uno, y algunos cuesta verlos.
            </Text>
          ) : (
            <Text style={styles.teaserText}>
              ✨ Muy pronto podrás{' '}
              <Text style={styles.teaserStrong}>coleccionarlos</Text>… y se
              desvelará algo más. Mantente atento.
            </Text>
          )}
        </View>

        <Text style={styles.hint}>
          Para salir, agita el móvil con fuerza un par de veces.
        </Text>

        <Pressable
          onPress={() => {
            h.tap();
            onDismiss();
          }}
          accessibilityRole="button"
          accessibilityLabel="Entendido, cerrar la explicación"
          style={({ pressed }) => [
            styles.primaryBtn,
            pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
          ]}
        >
          <Text style={styles.primaryBtnText}>¡Entendido!</Text>
        </Pressable>

        {onExit ? (
          <PressableFeedback
            onPress={() => {
              h.tap();
              onExit();
            }}
            accessibilityRole="button"
            accessibilityLabel="Salir del modo Carismochito"
            style={styles.exitLink}
          >
            <Text style={styles.exitLinkText}>Salir del modo</Text>
          </PressableFeedback>
        ) : null}
      </PopCard>
    </Modal>
  );
}

/* -------------------------------------------------------------------------- */
/* Confirmación de salida                                                      */
/* -------------------------------------------------------------------------- */

export function CarismochitoExitConfirm({
  visible,
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
      statusBarTranslucent
    >
      <PopCard>
        <View style={styles.mascotWrap}>
          <CarismochitoMascot size={80} dance={1} />
        </View>

        <Text style={styles.title}>¿Salir del Modo Carismochito?</Text>
        <Text style={styles.body}>
          Volverás al modo normal. Podrás despertarlo otra vez cuando quieras
          agitando el móvil.
        </Text>

        <View style={styles.row}>
          <Pressable
            onPress={onCancel}
            accessibilityRole="button"
            accessibilityLabel="Seguir en el modo Carismochito"
            style={({ pressed }) => [
              styles.secondaryBtn,
              pressed && { opacity: 0.85 },
            ]}
          >
            <Text style={styles.secondaryBtnText}>Seguir</Text>
          </Pressable>
          <Pressable
            onPress={onConfirm}
            accessibilityRole="button"
            accessibilityLabel="Salir del modo Carismochito"
            style={({ pressed }) => [
              styles.exitBtn,
              pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
            ]}
          >
            <Text style={styles.exitBtnText}>Salir</Text>
          </Pressable>
        </View>
      </PopCard>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(2, 12, 6, 0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    borderRadius: radii.full,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 24,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: G,
    ...Platform.select({
      ios: {
        shadowColor: G,
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.5,
        shadowRadius: 24,
      },
      android: { elevation: 18 },
      default: {
        // @ts-ignore - web only
        boxShadow: `0px 10px 30px ${G}AA`,
      },
    }),
  },
  mascotWrap: {
    alignItems: 'center',
    marginBottom: 14,
  },
  title: {
    color: CarismoColors.onDeep,
    fontSize: 21,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: 0.3,
    marginBottom: 12,
    textShadowColor: G_GLOW,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 14,
  },
  body: {
    color: CarismoColors.onDeepSoft,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  teaser: {
    marginTop: 16,
    backgroundColor: 'rgba(90, 224, 138, 0.12)',
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: 'rgba(90, 224, 138, 0.3)',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  teaserText: {
    color: G_LIGHT,
    ...typography.subhead,
    lineHeight: 21,
    textAlign: 'center',
  },
  teaserStrong: {
    fontWeight: '900',
    color: CarismoColors.onDeep,
  },
  hint: {
    color: CarismoColors.onDeepMuted,
    ...typography.footnote,
    textAlign: 'center',
    marginTop: 16,
    opacity: 0.85,
  },
  primaryBtn: {
    marginTop: 22,
    backgroundColor: G_LIGHT,
    borderRadius: 26,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: G_DARK,
    fontWeight: '900',
    ...typography.body,
    letterSpacing: 0.5,
  },
  exitLink: {
    marginTop: 8,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exitLinkText: {
    color: CarismoColors.onDeepMuted,
    ...typography.subhead,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 22,
  },
  secondaryBtn: {
    flex: 1,
    borderRadius: 26,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: G,
  },
  secondaryBtnText: {
    color: G_LIGHT,
    fontWeight: '800',
    fontSize: 15,
  },
  exitBtn: {
    flex: 1,
    borderRadius: 26,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: G_LIGHT,
  },
  exitBtnText: {
    color: G_DARK,
    fontWeight: '900',
    fontSize: 15,
  },
});
