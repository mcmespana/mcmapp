import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Card } from 'react-native-paper';
import { Colors } from '@/constants/colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import useFontScale from '@/hooks/useFontScale';
import spacing from '@/constants/spacing';

export interface EventItemData {
  nombre: string;
  hora: string;
  subtitulo?: string;
  lugar?: string;
  icono?: string;
}

export default function EventItem({ event }: { event: EventItemData }) {
  const scheme = useColorScheme();
  const fontScale = useFontScale();
  const styles = React.useMemo(
    () => createStyles(scheme, fontScale),
    [scheme, fontScale],
  );
  return (
    <Card style={styles.card}>
      <Card.Content>
        <View style={styles.row}>
          {event.icono && <Text style={styles.emoji}>{event.icono}</Text>}
          <View style={{ flex: 1 }}>
            <Text
              style={styles.title}
            >{`${event.hora} - ${event.nombre}`}</Text>
            {event.subtitulo && (
              <Text style={styles.subtitle}>{event.subtitulo}</Text>
            )}
            {event.lugar && <Text style={styles.subtitle}>{event.lugar}</Text>}
          </View>
        </View>
      </Card.Content>
    </Card>
  );
}

const createStyles = (scheme: 'light' | 'dark' | null, scale: number) => {
  const theme = Colors[scheme ?? 'light'];
  return StyleSheet.create({
    card: {
      marginBottom: spacing.md,
      backgroundColor: theme.background,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    emoji: {
      fontSize: 24 * scale,
    },
    title: {
      fontSize: 16 * scale,
      fontWeight: 'bold',
      color: theme.text,
    },
    subtitle: {
      fontSize: 14 * scale,
      color: theme.text,
    },
  });
};
