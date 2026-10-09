import React, { useCallback, useEffect, useRef } from 'react';
import {
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { PressableFeedback } from 'heroui-native';
import { MaterialIcons } from '@expo/vector-icons';
import useAnimatedValue from '@/hooks/useAnimatedValue';
import { HighlightColors, SystemGray, themeColors } from '@/constants/colors';
import { radii } from '@/constants/uiStyles';
import spacing from '@/constants/spacing';
import typography from '@/constants/typography';

/**
 * Piezas comunes de las hojas de ajustes de una canción (tono/cejilla y
 * tamaño/fuente).
 *
 * Antes cada hoja tenía su copia y no decían lo mismo: los ± del tono eran
 * rojo y verde y los del tamaño grises; el tono repetía al mantener pulsado y
 * el tamaño no; el tono avisaba al llegar al tope y el tamaño se quedaba mudo;
 * los botones del tamaño no tenían `accessibilityLabel`. Y había 49 colores
 * escritos a mano, entre ellos un ámbar `#9D5C00` que en oscuro se pintaba
 * sobre fondo casi negro.
 *
 * Todo lo animado va con el `Animated` de React Native, NO con Reanimated: estas
 * hojas viven dentro del `Modal` transparente de `BottomSheet`, donde los
 * estilos animados de Reanimated 4 no se aplican (ver `components/BottomSheet.tsx`).
 */

/**
 * Los colores de la hoja, todos por rol. El grupo y la celda se INVIERTEN entre
 * modos a propósito: en claro, grupo gris hundido con celdas blancas encima;
 * en oscuro, grupo gris elevado con celdas casi negras metidas dentro. Es como
 * agrupa iOS sus ajustes en los dos modos.
 */
export function sheetPalette(isDark: boolean) {
  const t = themeColors(isDark);
  const hl = isDark ? HighlightColors.dark : HighlightColors.light;
  return {
    group: isDark ? t.card : t.backgroundSunken,
    cell: isDark ? t.backgroundSunken : t.card,
    cellBorder: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
    text: t.text,
    textSecondary: t.textSecondary,
    label: t.textMuted,
    disabled: isDark ? SystemGray.dark.gray3 : SystemGray.light.gray3,
    /** Lo que está cambiado respecto al original de la canción. */
    active: { bg: hl.bg, fg: hl.fg, border: hl.border },
  };
}

export type SheetPalette = ReturnType<typeof sheetPalette>;

/**
 * Un bloque de la hoja: etiqueta, un estado en el centro («Original»,
 * «Modificado»…) y el botón de restablecer, que solo aparece si hay algo que
 * restablecer (ocupa su sitio siempre para que nada salte al aparecer).
 */
export function SheetCard({
  palette,
  label,
  status,
  statusActive = false,
  onReset,
  resetLabel,
  children,
}: {
  palette: SheetPalette;
  label: string;
  status?: string;
  statusActive?: boolean;
  onReset?: () => void;
  resetLabel?: string;
  children: React.ReactNode;
}) {
  const canReset = !!onReset && statusActive;
  return (
    <View style={[styles.card, { backgroundColor: palette.group }]}>
      <View style={styles.cardHeader}>
        <Text
          style={[styles.cardLabel, { color: palette.label }]}
          accessibilityRole="header"
        >
          {label}
        </Text>
        <View style={styles.cardStatusWrap}>
          {status ? (
            <Text
              style={[
                styles.cardStatus,
                {
                  color: statusActive ? palette.active.fg : palette.label,
                },
              ]}
              numberOfLines={1}
            >
              {status}
            </Text>
          ) : null}
        </View>
        <PressableFeedback
          style={[styles.resetBtn, !canReset && styles.hidden]}
          onPress={onReset}
          isDisabled={!canReset}
          hitSlop={spacing.sm}
          accessibilityLabel={resetLabel}
          accessibilityElementsHidden={!canReset}
          importantForAccessibility={canReset ? 'auto' : 'no-hide-descendants'}
        >
          <PressableFeedback.Highlight />
          <MaterialIcons
            name="refresh"
            size={18}
            color={palette.textSecondary}
          />
        </PressableFeedback>
      </View>
      {children}
    </View>
  );
}

const HOLD_DELAY_MS = 380; // espera antes de empezar a repetir
const HOLD_INTERVAL_MS = 130; // cadencia de repetición manteniendo pulsado
const PRESS_IN_MS = 90;
const PRESS_OUT_MS = 140;
const PRESS_SCALE = 0.94;
const POP_SCALE = 1.18;
const NATIVE = Platform.OS !== 'web';

function usePressScale(enabled: boolean) {
  const scale = useAnimatedValue(1);
  const press = useCallback(
    (to: number, duration: number) => {
      if (!enabled) return;
      Animated.timing(scale, {
        toValue: to,
        duration,
        useNativeDriver: NATIVE,
      }).start();
    },
    [enabled, scale],
  );
  return {
    scale,
    onPressIn: () => press(PRESS_SCALE, PRESS_IN_MS),
    onPressOut: () => press(1, PRESS_OUT_MS),
  };
}

/**
 * Botón de paso (− / +): un toque = un paso; mantener pulsado repite.
 *
 * `disabled` no lo deja MUDO: sigue avisando (`onBlocked`) para poder dar
 * háptica de tope y un meneo del valor. Un botón que no hace absolutamente
 * nada al tocarlo se lee como app colgada, no como "hasta aquí".
 */
export function HoldStepButton({
  palette,
  onStep,
  onBlocked,
  disabled = false,
  style,
  children,
  accessibilityLabel,
}: {
  palette: SheetPalette;
  onStep: () => void;
  onBlocked?: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
  accessibilityLabel: string;
}) {
  const delayTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const repeatTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const { scale, onPressIn, onPressOut } = usePressScale(!disabled);

  const stop = () => {
    if (delayTimer.current) clearTimeout(delayTimer.current);
    if (repeatTimer.current) clearInterval(repeatTimer.current);
    delayTimer.current = null;
    repeatTimer.current = null;
  };

  useEffect(() => stop, []);
  // Si se deshabilita con el dedo encima (llegas al tope manteniendo pulsado),
  // hay que cortar la repetición o sigue latiendo contra la pared.
  useEffect(() => {
    if (disabled) stop();
  }, [disabled]);

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPressIn={() => {
          if (disabled) {
            onBlocked?.();
            return;
          }
          onPressIn();
          onStep();
          delayTimer.current = setTimeout(() => {
            repeatTimer.current = setInterval(onStep, HOLD_INTERVAL_MS);
          }, HOLD_DELAY_MS);
        }}
        onPressOut={() => {
          onPressOut();
          stop();
        }}
        style={[
          styles.stepBtn,
          {
            backgroundColor: palette.cell,
            borderColor: palette.cellBorder,
          },
          style,
          disabled && styles.stepBtnDisabled,
        ]}
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        accessibilityLabel={accessibilityLabel}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

/**
 * Valor central: pega un pop cada vez que `token` cambia, y un meneo lateral
 * corto con `nudge()` (tope alcanzado).
 */
export function useValueFeedback(token: unknown) {
  const pop = useAnimatedValue(1);
  const shake = useAnimatedValue(0);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    pop.setValue(POP_SCALE);
    Animated.spring(pop, {
      toValue: 1,
      useNativeDriver: NATIVE,
      tension: 260,
      friction: 9,
    }).start();
  }, [token, pop]);

  const nudge = useCallback(() => {
    shake.setValue(0);
    Animated.sequence([
      Animated.timing(shake, {
        toValue: -6,
        duration: 60,
        useNativeDriver: NATIVE,
      }),
      Animated.timing(shake, {
        toValue: 4,
        duration: 60,
        useNativeDriver: NATIVE,
      }),
      Animated.timing(shake, {
        toValue: 0,
        duration: 80,
        useNativeDriver: NATIVE,
      }),
    ]).start();
  }, [shake]);

  return {
    style: { transform: [{ translateX: shake }] },
    popStyle: { transform: [{ scale: pop }] },
    nudge,
  };
}

/** Estilo de la caja del valor central, en reposo o cambiado. */
export function valueBoxStyle(palette: SheetPalette, active: boolean) {
  return active
    ? { backgroundColor: palette.active.bg, borderColor: palette.active.border }
    : { backgroundColor: palette.cell, borderColor: palette.cellBorder };
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.lg,
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 28,
  },
  cardLabel: {
    ...typography.overline,
  },
  cardStatusWrap: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
  },
  cardStatus: {
    ...typography.caption,
    fontWeight: '600',
  },
  resetBtn: {
    width: 28,
    height: 28,
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hidden: { opacity: 0 },
  stepBtn: {
    width: 64,
    height: 64,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  stepBtnDisabled: { opacity: 0.35 },
});
