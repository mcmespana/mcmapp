import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { radii, shadows } from '@/constants/uiStyles';
import { Colors } from '@/constants/colors';
import { useColorScheme } from '@/hooks/useColorScheme';

interface ContigoToolCardProps {
  icon: React.ComponentProps<typeof MaterialIcons>['name'];
  iconColor: string;
  title: string;
  subtitle?: string;
  badge?: {
    text: string;
    color: string;
    bgColor: string;
  };
  statusText?: string;
  statusDone?: boolean;
  streak?: number;
  disabled?: boolean;
  onPress?: () => void;
}

export default function ContigoToolCard({
  icon,
  iconColor,
  title,
  subtitle,
  badge,
  statusText,
  statusDone,
  streak,
  disabled = false,
  onPress,
}: ContigoToolCardProps) {
  const scheme = useColorScheme();
  const theme = Colors[scheme ?? 'light'];

  return (
    <TouchableOpacity
      style={[
        styles.card,
        {
          backgroundColor: theme.card,
          borderColor:
            scheme === 'dark'
              ? 'rgba(255,255,255,0.09)'
              : 'rgba(0,0,0,0.07)',
          opacity: disabled ? 0.5 : 1,
          ...shadows.md,
        },
      ]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={disabled ? 1 : 0.75}
      accessibilityRole="button"
      accessibilityLabel={title}
    >
      {/* Left: icon */}
      <View
        style={[
          styles.iconWrap,
          { backgroundColor: iconColor + '18' },
        ]}
      >
        <MaterialIcons name={icon} size={26} color={iconColor} />
      </View>

      {/* Middle: content */}
      <View style={styles.content}>
        <View style={styles.titleRow}>
          <Text
            style={[styles.title, { color: theme.text }]}
            numberOfLines={1}
          >
            {title}
          </Text>
          {badge && (
            <View
              style={[styles.badge, { backgroundColor: badge.bgColor }]}
            >
              <Text style={[styles.badgeText, { color: badge.color }]}>
                {badge.text}
              </Text>
            </View>
          )}
          {disabled && (
            <View style={styles.soonBadge}>
              <Text style={styles.soonText}>Pronto</Text>
            </View>
          )}
        </View>

        {subtitle && (
          <Text
            style={[styles.subtitle, { color: theme.icon }]}
            numberOfLines={1}
          >
            {subtitle}
          </Text>
        )}

        {statusText !== undefined && (
          <View style={styles.statusRow}>
            <MaterialIcons
              name={statusDone ? 'check-circle' : 'radio-button-unchecked'}
              size={14}
              color={statusDone ? '#4CAF50' : theme.icon}
            />
            <Text
              style={[
                styles.statusText,
                { color: statusDone ? '#4CAF50' : theme.icon },
              ]}
            >
              {statusText}
            </Text>
            {!!streak && streak > 1 && (
              <Text style={styles.streak}>🔥 {streak} días</Text>
            )}
          </View>
        )}
      </View>

      {/* Right: chevron */}
      {!disabled && (
        <MaterialIcons
          name="chevron-right"
          size={22}
          color={theme.icon}
          style={{ opacity: 0.35 }}
        />
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radii.xl,
    borderWidth: 1,
    padding: 14,
    gap: 12,
    marginBottom: 10,
  } as ViewStyle,
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  } as ViewStyle,
  content: {
    flex: 1,
    gap: 3,
  } as ViewStyle,
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  } as ViewStyle,
  title: {
    fontSize: 15,
    fontWeight: '700',
  } as TextStyle,
  badge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
  } as ViewStyle,
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
  } as TextStyle,
  soonBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: '#88888820',
  } as ViewStyle,
  soonText: {
    fontSize: 10,
    color: '#888',
    fontWeight: '600',
  } as TextStyle,
  subtitle: {
    fontSize: 12,
    lineHeight: 16,
  } as TextStyle,
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 1,
  } as ViewStyle,
  statusText: {
    fontSize: 12,
    fontWeight: '500',
  } as TextStyle,
  streak: {
    fontSize: 11,
    marginLeft: 4,
  } as TextStyle,
});
