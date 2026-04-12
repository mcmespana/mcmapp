import React from 'react';
import { View, Text, StyleSheet, Linking } from 'react-native';
import { Card, Chip, Button } from 'heroui-native';
import { Colors } from '@/constants/colors';
import { hexAlpha } from '@/utils/colorUtils';
import { useColorScheme } from '@/hooks/useColorScheme';
import useFontScale from '@/hooks/useFontScale';
import spacing from '@/constants/spacing';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';

export interface EventItemData {
  nombre: string;
  hora: string;
  subtitulo?: string;
  lugar?: string;
  icono?: string;
  maps?: string; // URL de Google Maps
  materiales?: boolean; // Si tiene materiales disponibles
}

export default function EventItem({
  event,
  dayIndex,
  onNavigateToMateriales,
}: {
  event: EventItemData;
  dayIndex?: number;
  onNavigateToMateriales?: (dayIndex: number) => void;
}) {
  const scheme = useColorScheme();
  const fontScale = useFontScale();
  const styles = React.useMemo(
    () => createStyles(scheme, fontScale),
    [scheme, fontScale],
  );

  // Helper function to check if hour should be displayed
  const shouldShowHour = (hora: string | undefined) => {
    return hora && hora.trim() !== '' && hora !== 'undefined';
  };

  // Handle Google Maps link
  const handleMapsPress = () => {
    if (event.maps) {
      Linking.openURL(event.maps).catch((err) =>
        console.error('Error opening maps:', err),
      );
    }
  };

  // Handle materials navigation
  const handleMaterialsPress = () => {
    if (onNavigateToMateriales && dayIndex !== undefined) {
      onNavigateToMateriales(dayIndex);
    }
  };

  return (
    <Card style={styles.card}>
      <Card.Body style={styles.cardContent}>
        <View style={styles.row}>
          <View style={styles.iconContainer}>
            <Text style={styles.emoji} selectable>
              {event.icono || '📅'}
            </Text>
          </View>
          <View style={styles.contentContainer}>
            <View style={styles.headerRow}>
              <Text style={styles.title} selectable>
                {event.nombre}
              </Text>
              <View style={styles.rightSection}>
                {event.materiales && (
                  <Chip
                    size="sm"
                    variant="primary"
                    color="warning"
                    onPress={handleMaterialsPress}
                  >
                    <MaterialIcons
                      name="library-books"
                      size={12 * fontScale}
                      color="#fff"
                    />
                    <Chip.Label>Materiales</Chip.Label>
                  </Chip>
                )}
                {shouldShowHour(event.hora) && (
                  <Chip size="sm" variant="primary" color="accent">
                    <Chip.Label>{event.hora}</Chip.Label>
                  </Chip>
                )}
              </View>
            </View>
            {event.subtitulo && (
              <Text style={styles.subtitle} selectable>
                {event.subtitulo}
              </Text>
            )}
            <View style={styles.bottomRow}>
              {event.lugar && (
                <View style={styles.locationRow}>
                  <Ionicons
                    name="location"
                    size={14 * fontScale}
                    color="#999"
                  />
                  <Text style={styles.location} selectable>
                    {event.lugar}
                  </Text>
                </View>
              )}
              {event.maps && (
                <Button variant="ghost" size="sm" onPress={handleMapsPress}>
                  <MaterialIcons
                    name="map"
                    size={16 * fontScale}
                    color="#4285F4"
                  />
                  <Button.Label>Ver en Maps</Button.Label>
                </Button>
              )}
            </View>
          </View>
        </View>
      </Card.Body>
    </Card>
  );
}

const createStyles = (scheme: 'light' | 'dark' | null, scale: number) => {
  const theme = Colors[scheme ?? 'light'];
  return StyleSheet.create({
    card: {
      marginBottom: spacing.md,
      backgroundColor: theme.background,
      borderRadius: 16,
      marginHorizontal: 2, // Para que la sombra se vea bien
    },
    cardContent: {
      padding: spacing.md,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.md,
    },
    iconContainer: {
      width: 50,
      height: 50,
      borderRadius: 25,
      backgroundColor: hexAlpha(theme.tint, '20'), // 20% opacity
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: spacing.xs,
    },
    contentContainer: {
      flex: 1,
    },
    headerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: spacing.xs,
    },
    rightSection: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      flexShrink: 0,
    },
    title: {
      fontSize: 18 * scale,
      fontWeight: '600',
      color: theme.text,
      flex: 1,
      marginRight: spacing.sm,
      lineHeight: 24 * scale,
    },
    subtitle: {
      fontSize: 15 * scale,
      color: hexAlpha(theme.text, 'CC'), // 80% opacity
      lineHeight: 20 * scale,
      marginBottom: spacing.xs / 2,
    },
    bottomRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: spacing.xs / 2,
    },
    locationRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    location: {
      fontSize: 14 * scale,
      color: '#666',
      fontWeight: '500',
      lineHeight: 18 * scale,
      marginLeft: spacing.xs / 2,
    },
    emoji: {
      fontSize: 24 * scale,
    },
  });
};
