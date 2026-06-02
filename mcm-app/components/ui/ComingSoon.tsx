import React from 'react';
import { StyleSheet, View } from 'react-native';
import EmptyState from './EmptyState';

interface Props {
  /** Título grande. Por defecto "Próximamente". */
  title?: string;
  /** Subtítulo explicativo. */
  message?: string;
  /** Emoji mostrado arriba. */
  emoji?: string;
  /** Color de acento (normalmente el tint del evento). */
  accentColor?: string;
}

/**
 * Estado vacío "Próximamente" — se muestra cuando una sección del evento aún
 * no tiene datos en Firebase (o llegan vacíos/mal formados). Centrado vertical
 * para llenar la pantalla con elegancia en vez de un esqueleto infinito.
 */
export default function ComingSoon({
  title = 'Próximamente',
  message = 'Estamos preparando esta sección. Muy pronto tendrás todo aquí 🙌',
  emoji = '🕊️',
  accentColor,
}: Props) {
  return (
    <View style={styles.root}>
      <EmptyState
        emoji={emoji}
        title={title}
        subtitle={message}
        accentColor={accentColor}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingBottom: 80,
  },
});
