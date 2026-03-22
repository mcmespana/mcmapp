// components/contigo/LiturgicalBadge.tsx — Badge showing liturgical season + color
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { LiturgicalInfo } from '@/types/contigo';

interface Props {
  info: LiturgicalInfo;
  showSpecialDate?: boolean;
  compact?: boolean;
}

export default function LiturgicalBadge({
  info,
  showSpecialDate = true,
  compact = false,
}: Props) {
  const seasonName = info.season?.nombre ?? 'Tiempo Ordinario';
  const isWhite = info.colorName === 'Blanco' || info.color === '#B0B0B0';

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.badge,
          compact && styles.badgeCompact,
          {
            backgroundColor: isWhite ? '#F5F5F5' : info.color + '20',
            borderColor: isWhite ? '#D0D0D0' : info.color + '40',
            borderWidth: isWhite ? 1 : 0,
          },
        ]}
      >
        <View
          style={[
            styles.dot,
            { backgroundColor: isWhite ? '#888' : info.color },
          ]}
        />
        <Text
          style={[
            styles.text,
            compact && styles.textCompact,
            { color: isWhite ? '#555' : info.color },
          ]}
          numberOfLines={1}
        >
          {seasonName}
        </Text>
      </View>
      {showSpecialDate && info.specialDate && (
        <Text
          style={[styles.special, { color: isWhite ? '#666' : info.color }]}
          numberOfLines={1}
        >
          {info.specialDate.nombre}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'flex-start',
    gap: 3,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  badgeCompact: {
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  text: {
    fontSize: 12,
    fontWeight: '700',
  },
  textCompact: {
    fontSize: 10,
  },
  special: {
    fontSize: 11,
    fontWeight: '600',
    fontStyle: 'italic',
    paddingLeft: 4,
  },
});
