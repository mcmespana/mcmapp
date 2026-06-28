import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import {
  Easing,
  cancelAnimation,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { usePreviewChannel } from '@/contexts/PreviewChannelContext';
import { AnimatedGradients } from '@/components/preview-channel/AnimatedGradients';
import { FloatingParticle } from '@/components/preview-channel/FloatingParticle';
import { ConfettiBurst } from '@/components/preview-channel/ConfettiBurst';
import { GiantLever } from '@/components/preview-channel/GiantLever';
import {
  RotatingPhrases,
  Sparkles,
  WobblingTitle,
} from '@/components/preview-channel/LabDecorations';

/**
 * Modal "Laboratorio Alpha" — UI deliberadamente exagerada, festiva y opuesta
 * al estilo minimalista del resto de la app. Activa/desactiva el canal preview
 * de EAS Update. Sólo se llega aquí tras dar 7 taps escondidos en elementos
 * decorativos del pie (versión + tagline "Movimiento Consolación").
 *
 * Las piezas decorativas animadas (gradientes, partículas, confeti, palanca y
 * adornos de texto) viven en `components/preview-channel/`.
 */
export function PreviewChannelModal() {
  const { isSecretMenuOpen, closeSecretMenu, enabled, setEnabled } =
    usePreviewChannel();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const phase = useSharedValue(0);
  const [burstKey, setBurstKey] = useState<number | null>(null);
  const [burstVariant, setBurstVariant] = useState<'explode' | 'puff'>(
    'explode',
  );

  // Bucle global de partículas — un solo shared value para todas.
  useEffect(() => {
    if (!isSecretMenuOpen) {
      phase.value = 0;
      return;
    }
    phase.value = withRepeat(
      withTiming(Math.PI * 2, { duration: 14000, easing: Easing.linear }),
      -1,
      false,
    );
    return () => cancelAnimation(phase);
  }, [isSecretMenuOpen, phase]);

  const handleToggle = useCallback(async () => {
    const next = !enabled;
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(
        next
          ? Haptics.NotificationFeedbackType.Success
          : Haptics.NotificationFeedbackType.Warning,
      ).catch(() => {});
    }
    setBurstVariant(next ? 'explode' : 'puff');
    setBurstKey(Date.now());
    await setEnabled(next);
  }, [enabled, setEnabled]);

  const handleClose = useCallback(() => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    closeSecretMenu();
  }, [closeSecretMenu]);

  const particles = useMemo(
    () =>
      Array.from({ length: 14 }).map((_, i) => (
        <FloatingParticle
          key={i}
          index={i}
          width={width}
          height={height}
          phase={phase}
        />
      )),
    [width, height, phase],
  );

  return (
    <Modal
      visible={isSecretMenuOpen}
      onRequestClose={handleClose}
      animationType="fade"
      transparent={false}
      statusBarTranslucent
    >
      <View style={styles.root}>
        <AnimatedGradients />
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          {particles}
        </View>
        {/* Capa oscura sutil para que el texto sea legible */}
        <View style={styles.scrim} pointerEvents="none" />

        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingTop: insets.top + 24,
              paddingBottom: insets.bottom + 32,
            },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.headerBlock}>
            <Sparkles />
            <WobblingTitle>🧪 LABORATORIO ALPHA 🧪</WobblingTitle>
            <Text style={styles.subtitle}>
              Has descubierto el portal a las novedades del futuro
            </Text>
            <Text style={styles.eyebrow}>· · · modo ultrasecreto · · ·</Text>
          </View>

          {/* Estado actual + lever */}
          <View style={styles.statusBlock}>
            <Text style={styles.statusEyebrow}>tu nivel de aventura</Text>
            <Text style={styles.statusValue} allowFontScaling={false}>
              {enabled ? '⚡  ZONA ALPHA  ⚡' : '☁️  Mundano  ☁️'}
            </Text>
            <GiantLever active={enabled} onToggle={handleToggle} />
            <RotatingPhrases />
          </View>

          {/* Pergamino: el pacto */}
          <View style={styles.scrollCard}>
            <Text style={styles.scrollTitle}>🔮 EL PACTO DEL PROBADOR</Text>
            <Text style={styles.scrollBody}>
              Al activar este modo, tu dispositivo se suscribirá al canal{' '}
              <Text style={styles.scrollMono}>preview</Text> de EAS Update.
            </Text>
            <Text style={styles.scrollBody}>
              Recibirás antes que nadie las novedades que el equipo publica en
              la rama <Text style={styles.scrollMono}>preview</Text> del
              proyecto. Cosas que aún no están en App Store ni Google Play.
              Cosas que pueden fallar. Cosas brillantes y nuevas.
            </Text>
            <Text style={styles.scrollBody}>
              Cuando lo desactives, en el próximo arranque volverás al canal{' '}
              <Text style={styles.scrollMono}>production</Text>, como el resto
              del mundo.
            </Text>
            <Text style={styles.scrollFootnote}>
              Funciona en versiones instaladas desde la store. Si algo se rompe,
              cierra y vuelve a abrir la app, o desactiva este modo.
            </Text>
          </View>

          {/* Cierre */}
          <Pressable
            onPress={handleClose}
            style={({ pressed }) => [
              styles.closeButton,
              pressed && { transform: [{ scale: 0.96 }] },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Cerrar laboratorio"
          >
            <Text style={styles.closeButtonText}>
              {enabled ? '✦  cerrar y disfrutar  ✦' : '↩  volver al mundo gris'}
            </Text>
          </Pressable>
        </ScrollView>

        {/* Burst de confeti — montado bajo demanda, se desmonta solo */}
        {burstKey !== null && (
          <ConfettiBurst
            key={burstKey}
            centerX={width / 2 - 14}
            centerY={height / 2 - 14}
            variant={burstVariant}
          />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#1A1230',
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.18)',
  },
  scrollContent: {
    paddingHorizontal: 20,
    alignItems: 'center',
    gap: 28,
  },

  // Header
  headerBlock: {
    alignItems: 'center',
    gap: 8,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.95)',
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
    paddingHorizontal: 30,
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowRadius: 6,
  },
  eyebrow: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginTop: 8,
  },

  // Estado + lever
  statusBlock: {
    alignItems: 'center',
    gap: 16,
    paddingVertical: 18,
    paddingHorizontal: 18,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.30)',
    width: '100%',
    maxWidth: 420,
    ...Platform.select({
      web: { boxShadow: '0 12px 36px rgba(0,0,0,0.35)' } as any,
      default: {
        shadowColor: '#000',
        shadowOpacity: 0.35,
        shadowOffset: { width: 0, height: 12 },
        shadowRadius: 22,
        elevation: 12,
      },
    }),
  },
  statusEyebrow: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  statusValue: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 1.2,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowRadius: 10,
    textShadowOffset: { width: 0, height: 3 },
  },

  // Pergamino
  scrollCard: {
    width: '100%',
    maxWidth: 460,
    padding: 22,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 248, 220, 0.94)',
    borderWidth: 2,
    borderColor: 'rgba(120, 80, 30, 0.45)',
    gap: 12,
    ...Platform.select({
      web: { boxShadow: '0 14px 36px rgba(0,0,0,0.35)' } as any,
      default: {
        shadowColor: '#000',
        shadowOpacity: 0.35,
        shadowOffset: { width: 0, height: 12 },
        shadowRadius: 20,
        elevation: 12,
      },
    }),
  },
  scrollTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: '#3D2A0E',
    letterSpacing: 0.4,
    textAlign: 'center',
    marginBottom: 4,
  },
  scrollBody: {
    color: '#3D2A0E',
    fontSize: 14,
    lineHeight: 21,
  },
  scrollMono: {
    fontFamily: Platform.select({
      ios: 'Menlo',
      android: 'monospace',
      default: 'monospace',
    }),
    fontWeight: '700',
    backgroundColor: 'rgba(61, 42, 14, 0.10)',
    color: '#3D2A0E',
  },
  scrollFootnote: {
    color: 'rgba(61, 42, 14, 0.75)',
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 4,
    lineHeight: 17,
  },

  // Cerrar
  closeButton: {
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 26,
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.55)',
    marginTop: 4,
  },
  closeButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
});
