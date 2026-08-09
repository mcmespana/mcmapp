import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { MaterialIcons } from '@expo/vector-icons';

import brand, { Colors } from '@/constants/colors';
import { radii } from '@/constants/uiStyles';
import { useColorScheme } from '@/hooks/useColorScheme';

interface OTAUpdatePromptProps {
  visible: boolean;
  isDownloading: boolean;
  onApply: () => void;
  onLater: () => void;
}

/**
 * Modal mostrado cuando una actualización OTA está descargada y lista para
 * aplicarse. Sigue el patrón estándar de Expo Updates: el usuario decide
 * cuándo reiniciar.
 *
 * En iOS las apps no pueden cerrarse a sí mismas a la fuerza (Apple lo
 * prohíbe en App Store Review). `Updates.reloadAsync()` es la forma
 * soportada: descarga el bundle nuevo y reinicia el contexto JS — para el
 * usuario la app "se cierra y se vuelve a abrir" con la nueva versión.
 */
export default function OTAUpdatePrompt({
  visible,
  isDownloading,
  onApply,
  onLater,
}: OTAUpdatePromptProps) {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const theme = Colors[scheme ?? 'light'];

  // Con el `Animated` de React Native, NO con Reanimated: este diálogo vive
  // dentro de un `Modal` y ahí las animaciones de Reanimated no corren (ver el
  // aviso de `components/BottomSheet.tsx`). Y aquí eso no era un detalle
  // estético: el fondo nace a opacidad 0, así que sin animación el aviso de
  // actualización salía INVISIBLE — tapando la pantalla y con sus botones
  // imposibles de ver.
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.92)).current;
  const rotate = useRef(new Animated.Value(0)).current;
  const sparkle = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) {
      opacity.setValue(0);
      scale.setValue(0.92);
      rotate.setValue(0);
      sparkle.setValue(0);
      return;
    }

    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      // Sin haptics — ignorar.
    }

    const nativeDriver = Platform.OS !== 'web';

    Animated.timing(opacity, {
      toValue: 1,
      duration: 220,
      useNativeDriver: nativeDriver,
    }).start();
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: nativeDriver,
      tension: 120,
      friction: 11,
    }).start();

    // Rotación continua suave del icono de update.
    const spin = Animated.loop(
      Animated.timing(rotate, {
        toValue: 1,
        duration: 2800,
        easing: Easing.linear,
        useNativeDriver: nativeDriver,
      }),
    );
    spin.start();

    // Pulso suave del halo decorativo (ida y vuelta).
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(sparkle, {
          toValue: 1,
          duration: 1400,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: nativeDriver,
        }),
        Animated.timing(sparkle, {
          toValue: 0,
          duration: 1400,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: nativeDriver,
        }),
      ]),
    );
    pulse.start();

    return () => {
      spin.stop();
      pulse.stop();
    };
  }, [visible, opacity, scale, rotate, sparkle]);

  const backdropStyle = { opacity };
  const cardStyle = { transform: [{ scale }] };
  const iconStyle = {
    transform: [
      {
        rotate: rotate.interpolate({
          inputRange: [0, 1],
          outputRange: ['0deg', '360deg'],
        }),
      },
    ],
  };
  const haloStyle = {
    opacity: sparkle.interpolate({
      inputRange: [0, 1],
      outputRange: [0.35, 0.7],
    }),
    transform: [
      {
        scale: sparkle.interpolate({
          inputRange: [0, 1],
          outputRange: [0.85, 1.08],
        }),
      },
    ],
  };

  const cardBg = isDark ? '#1F1F22' : '#FFFFFF';
  const subtleText = isDark ? '#B5B7BD' : '#5B6168';
  const dividerColor = isDark ? '#2E2E32' : '#ECEEF1';

  return (
    <Modal
      visible={visible}
      animationType="none"
      transparent
      statusBarTranslucent
      onRequestClose={onLater}
    >
      <Animated.View style={[styles.backdrop, backdropStyle]}>
        {Platform.OS === 'ios' ? (
          <BlurView
            tint={isDark ? 'dark' : 'systemUltraThinMaterialDark'}
            intensity={45}
            style={StyleSheet.absoluteFill}
          />
        ) : (
          <View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: 'rgba(0,0,0,0.55)' },
            ]}
          />
        )}

        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onLater}
          accessibilityLabel="Cerrar diálogo de actualización"
        />

        <Animated.View style={[styles.cardWrap, cardStyle]}>
          <View style={[styles.card, { backgroundColor: cardBg }]}>
            <View style={styles.hero}>
              <Animated.View style={[styles.heroHalo, haloStyle]} />
              <View style={styles.heroBadge}>
                <Animated.View style={iconStyle}>
                  <MaterialIcons name="autorenew" size={36} color="#FFFFFF" />
                </Animated.View>
              </View>
            </View>

            <Text style={[styles.title, { color: theme.text }]}>
              ¡Tenemos novedades!
            </Text>
            <Text style={[styles.subtitle, { color: subtleText }]}>
              {isDownloading
                ? 'Estamos descargando las novedades. Tardará solo unos segundos…'
                : 'Hemos preparado mejoras y correcciones nuevas. Tan solo te llevará un par de segundos.'}
            </Text>

            <View style={[styles.divider, { backgroundColor: dividerColor }]} />

            <View style={styles.actions}>
              <TouchableOpacity
                onPress={onApply}
                disabled={isDownloading}
                style={[
                  styles.primaryButton,
                  isDownloading && styles.primaryButtonDisabled,
                ]}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel="Reiniciar la app para aplicar la actualización"
              >
                <MaterialIcons
                  name="rocket-launch"
                  size={18}
                  color="#FFFFFF"
                  style={styles.primaryIcon}
                />
                <Text style={styles.primaryLabel}>
                  {isDownloading ? 'Preparando…' : 'Me actualizo (2 seg)'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={onLater}
                style={styles.secondaryButton}
                activeOpacity={0.6}
                accessibilityRole="button"
                accessibilityLabel="Aplicar más tarde"
              >
                <Text style={[styles.secondaryLabel, { color: subtleText }]}>
                  Después (no recomendado)
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={[styles.fineprint, { color: subtleText }]}>
              La app se reiniciará sola para cargar la nueva versión.
            </Text>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
  },
  cardWrap: {
    width: '100%',
    maxWidth: 420,
  },
  card: {
    borderRadius: radii.xxl,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 18,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 18 },
        shadowOpacity: 0.32,
        shadowRadius: 32,
      },
      android: {
        elevation: 20,
      },
      default: {
        // @ts-ignore web only
        boxShadow: '0px 18px 40px rgba(0, 0, 0, 0.28)',
      },
    }),
  },
  hero: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
    height: 96,
  },
  heroHalo: {
    position: 'absolute',
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: brand.secondary,
  },
  heroBadge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: brand.primary,
    ...Platform.select({
      ios: {
        shadowColor: brand.primary,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.4,
        shadowRadius: 14,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.3,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 21,
    textAlign: 'center',
    marginBottom: 22,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginBottom: 16,
  },
  actions: {
    width: '100%',
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: brand.primary,
    paddingVertical: 14,
    borderRadius: radii.pill,
    marginBottom: 6,
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryIcon: {
    marginRight: 8,
  },
  primaryLabel: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  secondaryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  secondaryLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  fineprint: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
    opacity: 0.85,
  },
});
