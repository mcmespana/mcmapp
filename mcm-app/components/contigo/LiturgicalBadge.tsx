import React from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { LiturgicalInfo } from '@/hooks/useLiturgicalCalendar';

interface LiturgicalBadgeProps {
  info: LiturgicalInfo;
  style?: ViewStyle;
}

export default function LiturgicalBadge({ info, style }: LiturgicalBadgeProps) {
  const isLight =
    info.color === '#F5F5F5' || info.color === '#D4A0A7';
  const textColor = isLight ? '#555' : '#fff';
  const borderColor = isLight ? '#ccc' : info.color;

  return (
    <View style={[styles.wrapper, style]}>
      <View
        style={[
          styles.badge,
          {
            backgroundColor: info.color,
            borderColor,
          },
        ]}
      >
        <Text style={[styles.badgeText, { color: textColor }]}>
          {info.nombreTiempo}
        </Text>
      </View>

      {info.celebracion && (
        <Text style={styles.celebracion} numberOfLines={2}>
          {info.celebracion}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    gap: 4,
  } as ViewStyle,
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
  } as ViewStyle,
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  } as TextStyle,
  celebracion: {
    fontSize: 11,
    color: '#888',
    textAlign: 'center',
    fontStyle: 'italic',
  } as TextStyle,
});
