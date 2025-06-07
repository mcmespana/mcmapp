import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Card } from 'react-native-paper';
import colors from '@/constants/colors';
import spacing from '@/constants/spacing';

export interface EventItemData {
  nombre: string;
  hora: string;
  subtitulo?: string;
  lugar?: string;
  icono?: string;
}

export default function EventItem({ event }: { event: EventItemData }) {
  return (
    <Card style={styles.card}>
      <Card.Content>
        <View style={styles.row}>
          {event.icono && <Text style={styles.emoji}>{event.icono}</Text>}
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{`${event.hora} - ${event.nombre}`}</Text>
            {event.subtitulo && <Text style={styles.subtitle}>{event.subtitulo}</Text>}
            {event.lugar && <Text style={styles.subtitle}>{event.lugar}</Text>}
          </View>
        </View>
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  emoji: {
    fontSize: 24,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
  },
  subtitle: {
    fontSize: 14,
    color: colors.text,
  },
});
