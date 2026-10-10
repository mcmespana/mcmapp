import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import PressableScale from '@/components/ui/PressableScale';
import { LiturgicalBadge } from '@/components/contigo/LiturgicalBadge';
import { formatDateLong, offsetDate, warm } from '@/components/contigo/theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import typography from '@/constants/typography';
import spacing from '@/constants/spacing';
import { radii, shadows } from '@/constants/uiStyles';
import { hexAlpha } from '@/utils/colorUtils';
import { h } from '@/utils/haptics';

/**
 * El navegador de días de Contigo: ‹ fecha ›.
 *
 * Antes había tres, uno por pantalla, y no se parecían: el evangelio era una
 * franja a sangre con «Volver a hoy», la oración una tarjeta sin él y la
 * revisión unas flechas sueltas en la barra que decían «Hoy». Ahora las tres
 * comparten este componente, que fija lo que tiene que ser igual:
 *
 *  - la fecha, con el mismo formato («Jueves, 8 de octubre»);
 *  - los mismos botones y la misma háptica;
 *  - «Volver a hoy» siempre que no estás en hoy;
 *  - el tope de «siguiente», que decide la pantalla con `maxDate` (en el
 *    evangelio se pueden leer días que vienen; un hábito no se apunta en el
 *    futuro).
 *
 * Dos tamaños, porque viven en sitios distintos: `card` en el cuerpo de la
 * pantalla (evangelio y oración) y `header` como título de la barra nativa
 * (revisión, que es un flujo a pantalla completa con su botón de cerrar).
 */
export interface DateNavigatorProps {
  /** Día que se está viendo, `YYYY-MM-DD`. */
  date: string;
  todayStr: string;
  onChange: (date: string) => void;
  /** Último día al que se puede avanzar. Sin él, no hay tope. */
  maxDate?: string;
  variant?: 'card' | 'header';
  /** Color litúrgico del día: tiñe el fondo de la tarjeta. Solo `card`. */
  tint?: string;
  /** Lo que la pantalla añada debajo de la fecha y el badge. Solo `card`. */
  children?: React.ReactNode;
  /** Márgenes de fuera de la tarjeta. Solo `card`. */
  style?: StyleProp<ViewStyle>;
}

export function DateNavigator({
  date,
  todayStr,
  onChange,
  maxDate,
  variant = 'card',
  tint,
  children,
  style,
}: DateNavigatorProps) {
  const isDark = useColorScheme() === 'dark';
  const W = warm(isDark);
  const isToday = date === todayStr;
  const next = offsetDate(date, 1);
  const canGoNext = maxDate === undefined || next <= maxDate;

  const step = (delta: number) => {
    const target = offsetDate(date, delta);
    if (maxDate !== undefined && target > maxDate) return;
    h.select();
    onChange(target);
  };

  const goToToday = () => {
    h.tap();
    onChange(todayStr);
  };

  const label = formatDateLong(date);

  if (variant === 'header') {
    return (
      <View style={styles.headerRow}>
        <NavButton
          direction="prev"
          onPress={() => step(-1)}
          compact
          color={W.textSec}
        />
        <PressableScale
          onPress={isToday ? undefined : goToToday}
          disabled={isToday}
          style={styles.headerLabel}
          accessibilityRole={isToday ? 'header' : 'button'}
          accessibilityLabel={isToday ? `Hoy, ${label}` : label}
          accessibilityHint={isToday ? undefined : 'Vuelve a hoy'}
        >
          {isToday ? null : (
            <MaterialIcons name="undo" size={14} color={W.accentText} />
          )}
          <Text
            style={[styles.headerText, { color: W.text }]}
            numberOfLines={1}
          >
            {isToday ? 'Hoy' : label}
          </Text>
        </PressableScale>
        <NavButton
          direction="next"
          onPress={() => step(1)}
          disabled={!canGoNext}
          compact
          color={W.textSec}
        />
      </View>
    );
  }

  const accent = tint ?? W.accent;
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: hexAlpha(accent, isDark ? '12' : '09'),
          borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
        },
        style,
      ]}
    >
      <NavButton
        direction="prev"
        onPress={() => step(-1)}
        color={W.text}
        filled={isDark ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.06)'}
      />

      <View style={styles.center}>
        <Text
          style={[styles.cardText, { color: W.text }]}
          accessibilityRole="header"
          accessibilityLiveRegion="polite"
        >
          {label}
        </Text>

        {/* Solo cuando estás en otro día; en hoy no se pinta nada. */}
        {isToday ? null : (
          <PressableScale
            onPress={goToToday}
            style={[
              styles.todayPill,
              {
                backgroundColor: hexAlpha(W.accent, '12'),
                borderColor: hexAlpha(W.accent, '30'),
              },
            ]}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Volver a hoy"
          >
            <MaterialIcons name="undo" size={12} color={W.accentText} />
            <Text style={[styles.todayLabel, { color: W.accentText }]}>
              Volver a hoy
            </Text>
          </PressableScale>
        )}

        <View style={styles.badge}>
          <LiturgicalBadge dateStr={date} />
        </View>

        {children}
      </View>

      <NavButton
        direction="next"
        onPress={() => step(1)}
        disabled={!canGoNext}
        color={W.text}
        filled={isDark ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.06)'}
      />
    </View>
  );
}

function NavButton({
  direction,
  onPress,
  disabled = false,
  compact = false,
  color,
  filled,
}: {
  direction: 'prev' | 'next';
  onPress: () => void;
  disabled?: boolean;
  compact?: boolean;
  color: string;
  filled?: string;
}) {
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      hitSlop={compact ? 10 : undefined}
      style={[
        compact ? styles.btnCompact : styles.btn,
        filled ? { backgroundColor: filled } : null,
        disabled && styles.btnDisabled,
      ]}
      accessibilityRole="button"
      accessibilityLabel={
        direction === 'prev' ? 'Día anterior' : 'Día siguiente'
      }
      accessibilityState={{ disabled }}
    >
      <MaterialIcons
        name={direction === 'prev' ? 'chevron-left' : 'chevron-right'}
        size={compact ? 20 : 26}
        color={color}
      />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    marginHorizontal: spacing.md,
    borderRadius: radii.xl,
    borderWidth: 1,
    ...shadows.card,
  },
  btn: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.lg,
  },
  btnCompact: {
    width: 28,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDisabled: { opacity: 0.3 },
  center: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
  },
  cardText: {
    ...typography.h3,
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  todayPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radii.xl,
    borderWidth: 1,
  },
  todayLabel: {
    ...typography.micro,
    fontWeight: '700',
  },
  badge: { marginTop: spacing.sm },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  headerLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    maxWidth: 220,
  },
  headerText: {
    ...typography.body,
    fontWeight: '700',
  },
});
