// components/contigo/ContigoToolCard.tsx — Card for each tool in the Contigo section
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ViewStyle,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/colors';
import { radii, shadows } from '@/constants/uiStyles';
import spacing from '@/constants/spacing';

interface Props {
  icon: React.ComponentProps<typeof MaterialIcons>['name'];
  iconColor: string;
  title: string;
  subtitle?: string;
  statusText?: string;
  statusDone?: boolean;
  streakCount?: number;
  disabled?: boolean;
  onPress?: () => void;
  style?: ViewStyle;
}

export default function ContigoToolCard({
  icon,
  iconColor,
  title,
  subtitle,
  statusText,
  statusDone,
  streakCount,
  disabled = false,
  onPress,
  style,
}: Props) {
  const scheme = useColorScheme();
  const theme = Colors[scheme ?? 'light'];

  return (
    <TouchableOpacity
      style={[
        styles.card,
        {
          backgroundColor: theme.card,
          borderColor:
            scheme === 'dark' ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.07)',
          opacity: disabled ? 0.5 : 1,
        },
        style,
      ]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={title}
    >
      <View style={[styles.iconCircle, { backgroundColor: iconColor + '15' }]}>
        <MaterialIcons name={icon} size={26} color={iconColor} />
      </View>

      <View style={styles.content}>
        <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>
          {title}
        </Text>
        {subtitle && (
          <Text
            style={[styles.subtitle, { color: theme.icon }]}
            numberOfLines={1}
          >
            {subtitle}
          </Text>
        )}
        {statusText && (
          <View style={styles.statusRow}>
            {statusDone !== undefined && (
              <MaterialIcons
                name={statusDone ? 'check-circle' : 'radio-button-unchecked'}
                size={14}
                color={statusDone ? '#4CAF50' : theme.icon}
              />
            )}
            <Text
              style={[
                styles.statusText,
                {
                  color: statusDone ? '#4CAF50' : theme.icon,
                },
              ]}
              numberOfLines={1}
            >
              {statusText}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.rightCol}>
        {streakCount !== undefined && streakCount > 0 && (
          <View style={styles.streakBadge}>
            <Text style={styles.streakIcon}>🔥</Text>
            <Text style={[styles.streakText, { color: theme.text }]}>
              {streakCount}
            </Text>
          </View>
        )}
        {disabled && (
          <View
            style={[styles.soonBadge, { backgroundColor: theme.icon + '15' }]}
          >
            <Text style={[styles.soonText, { color: theme.icon }]}>Pronto</Text>
          </View>
        )}
        {!disabled && (
          <MaterialIcons
            name="chevron-right"
            size={22}
            color={theme.icon}
            style={{ opacity: 0.4 }}
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
    padding: spacing.md,
    borderRadius: radii.xl,
    borderWidth: 1,
    gap: spacing.sm + 4,
    ...shadows.sm,
  },
  iconCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  content: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 12,
    opacity: 0.8,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  rightCol: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    flexShrink: 0,
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginBottom: 4,
  },
  streakIcon: {
    fontSize: 14,
  },
  streakText: {
    fontSize: 14,
    fontWeight: '800',
  },
  soonBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  soonText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
