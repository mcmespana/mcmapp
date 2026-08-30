// components/calendar/SwipeableMonthCalendar.tsx
import React, { useCallback, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { Calendar, CalendarProps } from 'react-native-calendars';
import colors from '@/constants/colors';
import { h } from '@/utils/haptics';

interface SwipeableMonthCalendarProps {
  /** Mes visible, en formato `YYYY-MM-DD` (normalmente el día 1). */
  visibleMonth: string;
  markedDates: CalendarProps['markedDates'];
  onDayPress: (dateString: string) => void;
  /** `delta` = +1 (mes siguiente) o -1 (mes anterior). */
  onChangeMonth: (delta: number) => void;
  isDark: boolean;
}

// Cuánto se desplaza la rejilla al confirmar el cambio de mes (fracción del
// ancho). Suficiente para leer la dirección sin que el hueco cante.
const EXIT_RATIO = 0.55;
// Umbrales para dar por bueno el gesto: o has arrastrado lo suficiente, o has
// soltado con velocidad (flick corto y rápido).
const DRAG_THRESHOLD = 52;
const VELOCITY_THRESHOLD = 620;

/**
 * Calendario mensual que se desliza de verdad: el mes sigue al dedo y, al
 * soltar, sale por un lado mientras el nuevo entra por el otro.
 *
 * `react-native-calendars` trata `current` como valor INICIAL, no reactivo:
 * por eso la `key` incluye el mes visible, para que cada mes sea un montaje
 * nuevo posicionado donde toca. Antes el swipe cambiaba los eventos de abajo
 * pero la rejilla se quedaba clavada en el mes anterior.
 */
export default function SwipeableMonthCalendar({
  visibleMonth,
  markedDates,
  onDayPress,
  onChangeMonth,
  isDark,
}: SwipeableMonthCalendarProps) {
  const { width: windowWidth } = useWindowDimensions();
  const [measuredWidth, setMeasuredWidth] = useState(0);
  const width = measuredWidth || windowWidth;

  const dx = useSharedValue(0);

  // Cambia de mes y hace entrar la rejilla nueva desde el lado contrario.
  const commitMonth = useCallback(
    (dir: number) => {
      h.select();
      onChangeMonth(dir);
      dx.set(dir * width * EXIT_RATIO);
      dx.set(withSpring(0, { damping: 20, stiffness: 170, mass: 0.7 }));
    },
    [onChangeMonth, dx, width],
  );

  // Salida animada + cambio de mes. La usan tanto el swipe como las flechas
  // del header, así que las dos vías se sienten igual.
  const animateChange = useCallback(
    (dir: number) => {
      dx.set(
        withTiming(-dir * width * EXIT_RATIO, { duration: 140 }, (finished) => {
          'worklet';
          if (finished) scheduleOnRN(commitMonth, dir);
        }),
      );
    },
    [dx, width, commitMonth],
  );

  const pan = Gesture.Pan()
    // Sólo se activa con intención horizontal clara, y se rinde ante un
    // arrastre vertical: así el ScrollView de la pantalla sigue mandando.
    .activeOffsetX([-14, 14])
    .failOffsetY([-14, 14])
    .onUpdate((e) => {
      const max = width * 0.9;
      dx.set(Math.max(-max, Math.min(max, e.translationX)));
    })
    .onEnd((e) => {
      const commit =
        Math.abs(e.translationX) > DRAG_THRESHOLD ||
        Math.abs(e.velocityX) > VELOCITY_THRESHOLD;
      if (commit) {
        const dir = e.translationX < 0 ? 1 : -1;
        dx.set(
          withTiming(
            -dir * width * EXIT_RATIO,
            { duration: 130 },
            (finished) => {
              if (finished) scheduleOnRN(commitMonth, dir);
            },
          ),
        );
      } else {
        dx.set(withSpring(0, { damping: 18, stiffness: 200 }));
      }
    });

  const gridStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: dx.get() }],
    opacity: interpolate(
      Math.abs(dx.get()),
      [0, width * EXIT_RATIO],
      [1, 0.3],
      'clamp',
    ),
  }));

  return (
    <View
      style={styles.clip}
      onLayout={(e) => setMeasuredWidth(e.nativeEvent.layout.width)}
    >
      <GestureDetector gesture={pan}>
        <Animated.View style={gridStyle}>
          <Calendar
            key={visibleMonth.slice(0, 7)}
            current={visibleMonth}
            onDayPress={(day) => onDayPress(day.dateString)}
            // Las flechas nativas del header no deben mover el mes por su
            // cuenta: lo hace nuestro estado (con la misma animación).
            onPressArrowLeft={() => animateChange(-1)}
            onPressArrowRight={() => animateChange(1)}
            markedDates={markedDates}
            markingType="multi-period"
            firstDay={1}
            enableSwipeMonths={false}
            style={styles.calendar}
            theme={{
              calendarBackground: isDark ? '#2C2C2E' : '#FFFFFF',
              dayTextColor: isDark ? '#FFFFFF' : '#1C1C1E',
              monthTextColor: isDark ? '#FFFFFF' : '#1C1C1E',
              textSectionTitleColor: '#8E8E93',
              selectedDayBackgroundColor: colors.info,
              selectedDayTextColor: colors.white,
              arrowColor: colors.info,
              todayTextColor: colors.info,
              textDayFontWeight: '500',
              textMonthFontWeight: '700',
              textDayHeaderFontWeight: '600',
              textMonthFontSize: 18,
            }}
          />
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  // Recorta la rejilla que sale de cuadro mientras se desliza.
  clip: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  calendar: {
    borderRadius: 20,
  },
});
