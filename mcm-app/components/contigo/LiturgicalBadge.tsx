import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SEASON_ACCENT } from '@/hooks/useLiturgicalSeason';

interface Props {
  seasonId: string;
  seasonName: string;
  specialDay?: string | null;
}

export default function LiturgicalBadge({
  seasonId,
  seasonName,
  specialDay,
}: Props) {
  const accent = SEASON_ACCENT[seasonId] ?? '#3A7D44';
  const isWhiteSeason = seasonId === 'navidad' || seasonId === 'pascua';

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.badge,
          {
            backgroundColor: isWhiteSeason ? '#FFFDF5' : accent + '18',
            borderColor: accent + '40',
          },
        ]}
      >
        <View style={[styles.dot, { backgroundColor: accent }]} />
        <Text style={[styles.text, { color: accent }]}>{seasonName}</Text>
      </View>
      {specialDay && (
        <Text style={[styles.special, { color: accent }]} numberOfLines={1}>
          {specialDay}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: 4,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  text: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  special: {
    fontSize: 12,
    fontWeight: '500',
    opacity: 0.8,
  },
});
