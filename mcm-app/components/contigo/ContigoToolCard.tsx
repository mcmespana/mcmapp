import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { useColorScheme } from '@/hooks/useColorScheme';

interface Props {
  title: string;
  subtitle?: string;
  statusText?: string;
  statusDone?: boolean;
  icon: string;
  iconBg: string;
  iconColor: string;
  accentColor: string;
  streakCount?: number;
  disabled?: boolean;
  disabledLabel?: string;
  onPress?: () => void;
}

export default function ContigoToolCard({
  title,
  subtitle,
  statusText,
  statusDone,
  icon,
  iconBg,
  iconColor,
  accentColor,
  streakCount,
  disabled,
  disabledLabel,
  onPress,
}: Props) {
  const scheme = useColorScheme();
  const theme = Colors[scheme ?? 'light'];
  const isDark = scheme === 'dark';

  return (
    <TouchableOpacity
      style={[
        styles.card,
        {
          backgroundColor: isDark ? '#2C2C2E' : '#FFFFFF',
          borderColor: disabled
            ? (isDark ? '#3A3A3C' : '#E8E8E8')
            : accentColor + '25',
          opacity: disabled ? 0.55 : 1,
        },
        !disabled && styles.cardShadow,
      ]}
      activeOpacity={disabled ? 1 : 0.7}
      onPress={disabled ? undefined : onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled }}
    >
      {/* Left accent bar */}
      <View
        style={[
          styles.accentBar,
          { backgroundColor: disabled ? '#C0C0C0' : accentColor },
        ]}
      />

      {/* Icon circle */}
      <View
        style={[
          styles.iconCircle,
          { backgroundColor: disabled ? '#F0F0F0' : iconBg },
        ]}
      >
        <MaterialIcons
          name={icon as any}
          size={26}
          color={disabled ? '#B0B0B0' : iconColor}
        />
      </View>

      {/* Content */}
      <View style={styles.content}>
        <Text
          style={[styles.title, { color: isDark ? '#FFFFFF' : '#1A1A2E' }]}
          numberOfLines={1}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text
            style={[
              styles.subtitle,
              { color: isDark ? '#A0A0A0' : '#666680' },
            ]}
            numberOfLines={1}
          >
            {subtitle}
          </Text>
        ) : null}
        {statusText ? (
          <View style={styles.statusRow}>
            {statusDone !== undefined && (
              <MaterialIcons
                name={statusDone ? 'check-circle' : 'radio-button-unchecked'}
                size={16}
                color={statusDone ? '#4CAF50' : '#B0B0B0'}
              />
            )}
            <Text
              style={[
                styles.status,
                {
                  color: statusDone
                    ? '#4CAF50'
                    : isDark
                      ? '#888'
                      : '#999',
                },
              ]}
            >
              {statusText}
            </Text>
          </View>
        ) : null}
        {disabledLabel ? (
          <View style={styles.comingSoonBadge}>
            <Text style={styles.comingSoonText}>{disabledLabel}</Text>
          </View>
        ) : null}
      </View>

      {/* Right section: streak or arrow */}
      <View style={styles.right}>
        {streakCount !== undefined && streakCount > 0 && !disabled ? (
          <View style={styles.streakBadge}>
            <Text style={styles.streakIcon}>🔥</Text>
            <Text style={[styles.streakText, { color: accentColor }]}>
              {streakCount}
            </Text>
          </View>
        ) : null}
        {!disabled && (
          <MaterialIcons
            name="chevron-right"
            size={24}
            color={isDark ? '#555' : '#CCC'}
          />
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 16,
    paddingRight: 12,
    paddingLeft: 0,
    marginHorizontal: 16,
    marginBottom: 12,
    overflow: 'hidden',
  },
  cardShadow: Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 8,
    },
    default: { elevation: 2 },
  }) as any,
  accentBar: {
    width: 4,
    height: '80%',
    borderRadius: 2,
    marginLeft: 0,
    marginRight: 12,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  content: {
    flex: 1,
    gap: 3,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '500',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
  },
  status: {
    fontSize: 13,
    fontWeight: '500',
  },
  comingSoonBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#F0F0F0',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginTop: 4,
  },
  comingSoonText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#999',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  right: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginLeft: 4,
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  streakIcon: {
    fontSize: 14,
  },
  streakText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
