// La etiqueta de habitación de una persona en el check-in (plan 18): el código
// con el color de cómo está la habitación (con hueco, llena, pasada) y, sin
// habitación, «Sin hab.» en gris. Se toca para cambiarla (abre el selector).
//
// Es pequeña para no robarle sitio al nombre, pero el toque es de 44 pt: la
// etiqueta mide 28 y `hitSlop` pone lo que falta arriba y abajo (encima y
// debajo solo está la propia fila, no otro botón).

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PressableFeedback } from 'heroui-native';
import { IconSymbol } from '@/components/ui/IconSymbol';
import typography from '@/constants/typography';
import { radii } from '@/constants/uiStyles';
import type { ManagedRoom } from '@/services/comunica/contract';
import { h } from '@/utils/haptics';
import type { RoomTone } from '@/utils/comunica/rooms';
import { ROOM_CHIP } from '../comun/theme';
import { useComunicaTheme } from '../comun/useComunicaTheme';

const SLOP = { top: 8, bottom: 8, left: 4, right: 4 };

export default function RoomTag({
  room,
  tone,
  onPress,
}: {
  room: ManagedRoom | null;
  tone?: RoomTone;
  /** Sin él (seleccionando varios), es solo una etiqueta. */
  onPress?: () => void;
}) {
  const t = useComunicaTheme();
  const chip = t.chip(room ? ROOM_CHIP[tone ?? 'free'] : 'neutral');
  const body = (
    <>
      <IconSymbol name="bed.double" size={14} color={chip.text} />
      <Text style={[styles.text, { color: chip.text }]} numberOfLines={1}>
        {room ? room.code : 'Sin hab.'}
      </Text>
    </>
  );
  const style = [styles.tag, { backgroundColor: chip.background }];
  if (!onPress) {
    return <View style={style}>{body}</View>;
  }
  return (
    <PressableFeedback
      onPress={() => {
        h.tap();
        onPress();
      }}
      hitSlop={SLOP}
      accessibilityRole="button"
      accessibilityLabel={
        room ? `Habitación ${room.code}. Cambiar` : 'Sin habitación. Poner una'
      }
      style={style}
    >
      {body}
      <PressableFeedback.Highlight />
    </PressableFeedback>
  );
}

const styles = StyleSheet.create({
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 28,
    paddingHorizontal: 8,
    borderRadius: radii.sm,
    overflow: 'hidden',
    flexShrink: 0,
  },
  text: { ...typography.footnote, fontWeight: '700' },
});
