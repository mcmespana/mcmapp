/**
 * Las seis cuerdas, de la 6.ª (grave) a la 1.ª, como se ven en la guitarra
 * mirándola de frente. La que suena se enciende; la que ya está afinada lleva
 * su check y se queda así hasta que se cierra el afinador (es la lista de
 * «lo que me falta»). Tocar una la FIJA: el afinador mide contra ella aunque
 * esté muy destemplada; tocarla otra vez vuelve a automático.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';
import PressableScale from '@/components/ui/PressableScale';
import { MaterialIcons } from '@/components/ui/icons';
import { durations, motionEasings } from '@/constants/animations';
import { radii } from '@/constants/uiStyles';
import typography from '@/constants/typography';
import spacing from '@/constants/spacing';

export interface TunerStringsColors {
  surface: string;
  surfaceActive: string;
  text: string;
  textMuted: string;
  textActive: string;
  inTune: string;
  badgeInk: string;
}

export interface TunerStringItem {
  label: string;
  number: number;
}

interface TunerStringsProps {
  strings: TunerStringItem[];
  activeIndex: number;
  lockedIndex: number | null;
  tuned: ReadonlySet<number>;
  onPress: (index: number) => void;
  colors: TunerStringsColors;
}

const CHIP = 48;
const BADGE = 18;

export default function TunerStrings({
  strings,
  activeIndex,
  lockedIndex,
  tuned,
  onPress,
  colors,
}: TunerStringsProps) {
  return (
    <View style={styles.row}>
      {strings.map((s, i) => {
        const active = i === activeIndex;
        const locked = i === lockedIndex;
        const done = tuned.has(i);
        return (
          <PressableScale
            key={s.number}
            onPress={() => onPress(i)}
            style={styles.item}
            hitSlop={4}
            accessibilityRole="button"
            accessibilityState={{ selected: locked }}
            accessibilityLabel={`Cuerda ${s.number}, ${s.label}${
              done ? ', afinada' : ''
            }${locked ? ', fijada' : ''}`}
            accessibilityHint={
              locked
                ? 'Vuelve a detectar la cuerda sola'
                : 'Afina solo esta cuerda'
            }
          >
            <View
              style={[
                styles.chip,
                {
                  backgroundColor:
                    active || locked ? colors.surfaceActive : colors.surface,
                  borderColor: locked ? colors.textActive : 'transparent',
                },
              ]}
            >
              <Text
                style={[
                  styles.label,
                  {
                    color: done
                      ? colors.inTune
                      : active || locked
                        ? colors.textActive
                        : colors.text,
                  },
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit
                maxFontSizeMultiplier={1.3}
              >
                {s.label}
              </Text>
              {done && (
                <Animated.View
                  entering={ZoomIn.duration(durations.base).easing(
                    motionEasings.out,
                  )}
                  style={[styles.badge, { backgroundColor: colors.inTune }]}
                >
                  <MaterialIcons
                    name="check"
                    size={12}
                    color={colors.badgeInk}
                  />
                </Animated.View>
              )}
            </View>
            <Text
              style={[styles.number, { color: colors.textMuted }]}
              maxFontSizeMultiplier={1.3}
            >
              {s.number}
            </Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  item: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  chip: {
    width: CHIP,
    height: CHIP,
    // `full` (28) ya es más de medio lado: sale un círculo.
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    // El borde solo se pinta en la fijada; con 0 de ancho, el chip cambiaría
    // de tamaño al fijarla.
    borderWidth: 1.5,
    paddingHorizontal: spacing.xs,
  },
  label: {
    ...typography.button,
    fontWeight: '700',
  },
  number: {
    ...typography.micro,
    fontVariant: ['tabular-nums'],
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: BADGE,
    height: BADGE,
    borderRadius: radii.pillFull,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
