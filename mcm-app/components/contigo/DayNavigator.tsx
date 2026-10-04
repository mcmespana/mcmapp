/**
 * Navegador de días de Contigo: ‹ fecha › con el tiempo litúrgico debajo.
 *
 * Evangelio y oración tenían cada uno el suyo, copiado y ya distinto: en el
 * evangelio había «Volver a hoy» y en la oración no; en la oración la flecha
 * de «siguiente» se paraba en hoy y en el evangelio no; los botones y la
 * letra no medían lo mismo. Ahora es una sola pieza y cada pantalla dice solo
 * lo que la diferencia (si se puede ir al futuro, qué va debajo de la fecha,
 * si tocar la fecha abre el calendario).
 */
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { LiturgicalBadge } from '@/components/contigo/LiturgicalBadge';
import { warm } from '@/components/contigo/theme';
import { hexAlpha } from '@/utils/colorUtils';
import { h } from '@/utils/haptics';
import typography from '@/constants/typography';
import spacing from '@/constants/spacing';
import { radii } from '@/constants/uiStyles';

const DAYS = [
  'Domingo',
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
];
const MONTHS = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

/** «Sábado, 3 de octubre». Fecha local, sin pasar por UTC. */
export function formatDayTitle(dateStr: string): string {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return `${DAYS[date.getDay()]}, ${d} de ${MONTHS[m - 1]}`;
}

interface DayNavigatorProps {
  date: string;
  todayStr: string;
  isDark: boolean;
  onStep: (offset: number) => void;
  onToday: () => void;
  /** `false` en lo que no se puede apuntar en el futuro (oración). */
  allowFuture?: boolean;
  /** Si se pasa, tocar la fecha abre el calendario. */
  onPressDate?: () => void;
  /** Lo propio de cada pantalla, debajo del tiempo litúrgico. */
  children?: React.ReactNode;
}

export default function DayNavigator({
  date,
  todayStr,
  isDark,
  onStep,
  onToday,
  allowFuture = true,
  onPressDate,
  children,
}: DayNavigatorProps) {
  const W = warm(isDark);
  const canGoNext = allowFuture || date < todayStr;
  const isToday = date === todayStr;
  const btnBg = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)';

  const title = (
    <Text style={[styles.title, { color: W.text }]}>
      {formatDayTitle(date)}
    </Text>
  );

  return (
    <View style={styles.row}>
      <TouchableOpacity
        onPress={() => {
          h.select();
          onStep(-1);
        }}
        style={[styles.btn, { backgroundColor: btnBg }]}
        accessibilityLabel="Día anterior"
      >
        <MaterialIcons name="chevron-left" size={26} color={W.text} />
      </TouchableOpacity>

      <View style={styles.center}>
        {onPressDate ? (
          <TouchableOpacity
            onPress={onPressDate}
            accessibilityRole="button"
            accessibilityHint="Abre el calendario"
          >
            {title}
          </TouchableOpacity>
        ) : (
          title
        )}
        {!isToday ? (
          <TouchableOpacity
            onPress={() => {
              h.select();
              onToday();
            }}
            style={[
              styles.todayPill,
              {
                backgroundColor: hexAlpha(W.accent, '14'),
                borderColor: hexAlpha(W.accent, '33'),
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
          </TouchableOpacity>
        ) : null}
        <View style={styles.badge}>
          <LiturgicalBadge dateStr={date} />
        </View>
        {children}
      </View>

      <TouchableOpacity
        onPress={() => {
          if (!canGoNext) return;
          h.select();
          onStep(1);
        }}
        disabled={!canGoNext}
        style={[
          styles.btn,
          { backgroundColor: btnBg, opacity: canGoNext ? 1 : 0.3 },
        ]}
        accessibilityLabel="Día siguiente"
        accessibilityState={{ disabled: !canGoNext }}
      >
        <MaterialIcons name="chevron-right" size={26} color={W.text} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  // Ancho completo: algunas pantallas lo meten en un contenedor en fila.
  row: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  btn: {
    width: 44,
    height: 44,
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
  },
  title: {
    ...typography.h3,
    fontWeight: '700',
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  todayPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: spacing.xs + 2,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radii.xl,
    borderWidth: 1,
  },
  todayLabel: {
    ...typography.micro,
    fontWeight: '700',
  },
  badge: {
    marginTop: spacing.sm,
  },
});
