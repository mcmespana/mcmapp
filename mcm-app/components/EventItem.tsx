import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { Card } from 'react-native-paper';
import { Colors } from '@/constants/colors';
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
    <Card style={styles.card} elevation={3}>
      <Card.Content style={styles.cardContent}>
        <View style={styles.row}>
          <View style={styles.iconContainer}>
            <Text style={styles.emoji}>{event.icono || '📅'}</Text>
          </View>
          <View style={styles.contentContainer}>
            <View style={styles.headerRow}>
              <Text style={styles.title}>{event.nombre}</Text>
              <View style={styles.rightSection}>
                {event.materiales && (
                  <TouchableOpacity
                    style={styles.materialsBadge}
                    onPress={handleMaterialsPress}
                    activeOpacity={0.7}
                  >
                    <MaterialIcons
                      name="library-books"
                      size={12 * fontScale}
                      color="#fff"
                    />
                    <Text style={styles.materialsText}>Materiales</Text>
                  </TouchableOpacity>
                )}
                {shouldShowHour(event.hora) && (
                  <View style={styles.timeContainer}>
                    <Text style={styles.timeText}>{event.hora}</Text>
                  </View>
                )}
              </View>
            </View>
            {event.subtitulo && (
              <Text style={styles.subtitle}>{event.subtitulo}</Text>
            )}
            <View style={styles.bottomRow}>
              {event.lugar && (
                <View style={styles.locationRow}>
                  <Ionicons
                    name="location"
                    size={14 * fontScale}
                    color="#999"
                  />
                  <Text style={styles.location}>{event.lugar}</Text>
                </View>
              )}
              {event.maps && (
                <TouchableOpacity
                  style={styles.mapsButton}
                  onPress={handleMapsPress}
                  activeOpacity={0.7}
                >
                  <MaterialIcons
                    name="map"
                    size={16 * fontScale}
                    color="#4285F4"
                  />
                  <Text style={styles.mapsText}>Ver en Maps</Text>
                </TouchableOpacity>
              )}
            </View>
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
      backgroundColor: theme.tint + '20', // 20% opacity
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
    materialsBadge: {
      backgroundColor: '#FF6B35',
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.xs,
      paddingVertical: spacing.xs / 3,
      borderRadius: 12,
      gap: spacing.xs / 2,
    },
    materialsText: {
      fontSize: 10 * scale,
      fontWeight: '600',
      color: '#fff',
    },
    timeContainer: {
      backgroundColor: theme.tint,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs / 2,
      borderRadius: 12,
      minWidth: 60,
      alignItems: 'center',
    },
    timeText: {
      fontSize: 13 * scale,
      fontWeight: '600',
      color: scheme === 'dark' ? '#000' : '#fff',
    },
    subtitle: {
      fontSize: 15 * scale,
      color: theme.text + 'CC', // 80% opacity
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
    mapsButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#E3F2FD',
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs / 2,
      borderRadius: 12,
      gap: spacing.xs / 2,
    },
    mapsText: {
      fontSize: 12 * scale,
      color: '#4285F4',
      fontWeight: '500',
    },
    emoji: {
      fontSize: 24 * scale,
    },
  });
};
