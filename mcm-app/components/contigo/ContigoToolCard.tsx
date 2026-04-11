import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { Card, PressableFeedback } from 'heroui-native';
import { MaterialIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Colors } from '@/constants/colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { radii, shadows } from '@/constants/uiStyles';
import { hexAlpha } from '@/utils/colorUtils';

interface ContigoToolCardProps {
  title: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  subtitle?: string;
  badge?: React.ReactNode;
  statusText?: string;
  statusIcon?: keyof typeof MaterialIcons.glyphMap;
  statusColor?: string;
  disabled?: boolean;
  onPress?: () => void;
  accentColor?: string;
}

export function ContigoToolCard({
  title,
  icon,
  subtitle,
  badge,
  statusText,
  statusIcon,
  statusColor,
  disabled,
  onPress,
  accentColor = '#B8860B',
}: ContigoToolCardProps) {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const theme = Colors[scheme ?? 'light'];

  const defaultStatusColor = isDark ? '#A3BD31' : '#3A7D44';
  const finalStatusColor = statusColor || defaultStatusColor;

  // Warm amber-gold icon bg
  const iconBg = isDark
    ? hexAlpha(accentColor, '20')
    : hexAlpha(accentColor, '12');

  return (
    <View style={[styles.wrapper, disabled && styles.disabled]}>
      <Card
        variant="transparent"
        style={[
          styles.card,
          {
            borderColor: isDark
              ? 'rgba(255,255,255,0.10)'
              : 'rgba(0,0,0,0.06)',
            borderWidth: 1,
          },
        ]}
      >
        {/* Translucent background — liquid glass style */}
        {Platform.OS === 'ios' ? (
          <BlurView
            tint={isDark ? 'systemMaterialDark' : 'systemMaterialLight'}
            intensity={60}
            style={StyleSheet.absoluteFill}
          />
        ) : (
          <View
            style={[
              StyleSheet.absoluteFill,
              {
                backgroundColor: isDark
                  ? 'rgba(28,26,23,0.92)'
                  : 'rgba(255,252,245,0.92)',
              },
            ]}
          />
        )}

        <PressableFeedback
          onPress={disabled ? undefined : onPress}
          style={styles.pressable}
        >
          <PressableFeedback.Highlight />

          <View style={styles.content}>
            {/* Icon Circle */}
            <View style={[styles.iconContainer, { backgroundColor: iconBg }]}>
              <MaterialIcons name={icon} size={28} color={accentColor} />
            </View>

            {/* Text Area */}
            <View style={styles.textContainer}>
              <View style={styles.titleRow}>
                <Text
                  style={[styles.title, { color: theme.text }]}
                  numberOfLines={1}
                >
                  {title}
                </Text>
              </View>

              {subtitle && (
                <Text
                  style={[
                    styles.subtitle,
                    { color: isDark ? 'rgba(255,255,255,0.55)' : '#6B6560' },
                  ]}
                  numberOfLines={2}
                >
                  {subtitle}
                </Text>
              )}

              {/* Status + Badge Row */}
              <View style={styles.footerRow}>
                {(statusText || statusIcon) && (
                  <View style={styles.statusRow}>
                    {statusIcon && (
                      <MaterialIcons
                        name={statusIcon}
                        size={15}
                        color={finalStatusColor}
                        style={styles.statusIconStyle}
                      />
                    )}
                    {statusText && (
                      <Text
                        style={[
                          styles.statusText,
                          { color: finalStatusColor },
                        ]}
                      >
                        {statusText}
                      </Text>
                    )}
                  </View>
                )}
                {badge && <View style={styles.badgeContainer}>{badge}</View>}
              </View>
            </View>

            {/* Chevron */}
            {!disabled && (
              <View style={styles.chevronContainer}>
                <MaterialIcons
                  name="chevron-right"
                  size={22}
                  color={isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.2)'}
                />
              </View>
            )}
          </View>
        </PressableFeedback>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 12,
    ...shadows.sm,
  },
  disabled: {
    opacity: 0.45,
  },
  card: {
    borderRadius: radii.xl,
    overflow: 'hidden',
  },
  pressable: {
    width: '100%',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 18,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  textContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 3,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    flex: 1,
    letterSpacing: -0.3,
  },
  badgeContainer: {
    marginLeft: 8,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 19,
    marginBottom: 8,
    fontWeight: '400',
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusIconStyle: {
    marginRight: 5,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  chevronContainer: {
    marginLeft: 8,
    justifyContent: 'center',
  },
});
