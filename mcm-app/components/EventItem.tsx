import React from 'react';
import { View, Text, StyleSheet, Linking, Platform } from 'react-native';
import { Card, Button } from 'heroui-native';
import colors, { Colors } from '@/constants/colors';
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

const EventItem = React.memo(function EventItem({
  event,
  dayIndex,
  accentColor = colors.accent,
  isFirst = false,
  isLast = false,
  onNavigateToMateriales,
}: {
  event: EventItemData;
  dayIndex?: number;
  accentColor?: string;
  isFirst?: boolean;
  isLast?: boolean;
  onNavigateToMateriales?: (dayIndex: number) => void;
}) {
  const scheme = useColorScheme();
  const fontScale = useFontScale();
  const styles = React.useMemo(
    () => createStyles(scheme, fontScale, accentColor),
    [scheme, fontScale, accentColor],
  );

  // Helper function to check if hour should be displayed
  const shouldShowHour = (hora: string | undefined): boolean => {
    return !!hora && hora.trim() !== '' && hora !== 'undefined';
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

  const showHour = shouldShowHour(event.hora);

  return (
    <View style={styles.row}>
      {/* Columna de la HORA — protagonista, grande y en color del día */}
      <View style={styles.timeCol}>
        {showHour ? (
          <Text style={styles.timeText} selectable allowFontScaling={false}>
            {event.hora}
          </Text>
        ) : (
          <Text style={styles.timeDash} allowFontScaling={false}>
            ·
          </Text>
        )}
      </View>

      {/* Rail vertical de la línea de tiempo */}
      <View style={styles.railCol}>
        <View style={[styles.railLine, isFirst && styles.railLineHidden]} />
        <View style={styles.dotOuter}>
          <View style={styles.dotInner} />
        </View>
        <View
          style={[
            styles.railLine,
            styles.railLineGrow,
            isLast && styles.railLineHidden,
          ]}
        />
      </View>

      {/* Tarjeta de contenido */}
      <Card style={styles.card}>
        <Card.Body style={styles.cardContent}>
          <View style={styles.headerRow}>
            <View style={styles.iconContainer}>
              <Text style={styles.emoji} selectable>
                {event.icono || '📅'}
              </Text>
            </View>
            <Text style={styles.title} selectable>
              {event.nombre}
            </Text>
          </View>

          {event.subtitulo ? (
            <Text style={styles.subtitle} selectable>
              {event.subtitulo}
            </Text>
          ) : null}

          {event.lugar || event.maps || event.materiales ? (
            <View style={styles.metaRow}>
              {event.lugar ? (
                <View style={styles.locationPill}>
                  <Ionicons
                    name="location-sharp"
                    size={13 * fontScale}
                    color={accentColor}
                  />
                  <Text style={styles.location} selectable>
                    {event.lugar}
                  </Text>
                </View>
              ) : null}
              {event.materiales ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onPress={handleMaterialsPress}
                  style={styles.metaBtn}
                >
                  <MaterialIcons
                    name="library-books"
                    size={15 * fontScale}
                    color={colors.warning}
                  />
                  <Button.Label style={styles.metaBtnLabel}>
                    Materiales
                  </Button.Label>
                </Button>
              ) : null}
              {event.maps ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onPress={handleMapsPress}
                  style={styles.metaBtn}
                >
                  <MaterialIcons
                    name="map"
                    size={15 * fontScale}
                    color="#4285F4"
                  />
                  <Button.Label style={styles.metaBtnLabel}>
                    Ver en Maps
                  </Button.Label>
                </Button>
              ) : null}
            </View>
          ) : null}
        </Card.Body>
      </Card>
    </View>
  );
});

const createStyles = (
  scheme: 'light' | 'dark' | null,
  scale: number,
  accentColor: string,
) => {
  const isDark = scheme === 'dark';
  const theme = Colors[scheme ?? 'light'];
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'stretch',
    },
    // —— Columna de la hora ——
    timeCol: {
      width: 58 * Math.min(scale, 1.3),
      alignItems: 'flex-end',
      paddingTop: 6,
    },
    timeText: {
      fontSize: 22 * scale,
      fontWeight: '800',
      letterSpacing: -0.5,
      color: accentColor,
      fontVariant: ['tabular-nums'],
    },
    timeDash: {
      fontSize: 22 * scale,
      fontWeight: '800',
      color: hexAlpha(theme.text, '40'),
    },
    // —— Rail de la timeline ——
    railCol: {
      width: 26,
      alignItems: 'center',
    },
    railLine: {
      width: 2,
      height: 12,
      backgroundColor: hexAlpha(accentColor, isDark ? '40' : '30'),
    },
    railLineGrow: {
      flex: 1,
      height: undefined,
    },
    railLineHidden: {
      backgroundColor: 'transparent',
    },
    dotOuter: {
      width: 16,
      height: 16,
      borderRadius: 8,
      backgroundColor: hexAlpha(accentColor, isDark ? '33' : '22'),
      alignItems: 'center',
      justifyContent: 'center',
    },
    dotInner: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: accentColor,
    },
    // —— Tarjeta ——
    card: {
      flex: 1,
      marginLeft: spacing.sm,
      marginBottom: spacing.md,
      backgroundColor: theme.background,
      borderRadius: 18,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: hexAlpha(theme.text, isDark ? '14' : '0D'),
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 3 },
          shadowOpacity: isDark ? 0.25 : 0.07,
          shadowRadius: 10,
        },
        android: { elevation: 2 },
        web: {
          // @ts-ignore — sombra suave en web
          boxShadow: isDark
            ? '0 4px 14px rgba(0,0,0,0.35)'
            : '0 4px 14px rgba(0,0,0,0.06)',
        },
      }),
    },
    cardContent: {
      padding: spacing.md,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm + 2,
    },
    iconContainer: {
      width: 44 * Math.min(scale, 1.3),
      height: 44 * Math.min(scale, 1.3),
      borderRadius: 14,
      backgroundColor: hexAlpha(accentColor, isDark ? '26' : '1A'),
      justifyContent: 'center',
      alignItems: 'center',
    },
    emoji: {
      fontSize: 22 * scale,
    },
    title: {
      flex: 1,
      fontSize: 17 * scale,
      fontWeight: '700',
      color: theme.text,
      lineHeight: 23 * scale,
      letterSpacing: -0.2,
    },
    subtitle: {
      fontSize: 14.5 * scale,
      color: hexAlpha(theme.text, isDark ? 'B0' : '99'),
      lineHeight: 20 * scale,
      marginTop: spacing.sm,
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: spacing.xs,
      marginTop: spacing.sm + 2,
    },
    locationPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      paddingVertical: 5,
      paddingHorizontal: 10,
      borderRadius: 999,
      backgroundColor: hexAlpha(accentColor, isDark ? '1F' : '12'),
    },
    location: {
      fontSize: 13 * scale,
      color: isDark ? hexAlpha(theme.text, 'DD') : '#444',
      fontWeight: '600',
    },
    metaBtn: {
      paddingHorizontal: 4,
      minHeight: 0,
    },
    metaBtnLabel: {
      fontSize: 13 * scale,
      fontWeight: '600',
    },
  });
};

export default EventItem;
