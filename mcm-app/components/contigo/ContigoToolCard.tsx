import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Card, PressableFeedback } from 'heroui-native';
import { MaterialIcons } from '@expo/vector-icons';
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
  accentColor = '#253883', // primary default
}: ContigoToolCardProps) {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const theme = Colors[scheme ?? 'light'];

  const defaultStatusColor = isDark ? '#A3BD31' : '#3A7D44';
  const finalStatusColor = statusColor || defaultStatusColor;

  return (
    <View style={[styles.wrapper, disabled && styles.disabled]}>
      <Card
        style={[
          styles.card,
          {
            backgroundColor: theme.card,
            borderColor: isDark ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.07)',
          },
        ]}
      >
        <PressableFeedback onPress={disabled ? undefined : onPress} style={styles.pressable}>
          <PressableFeedback.Highlight />
          
          <View style={styles.content}>
            {/* Left Icon Area */}
            <View 
              style={[
                styles.iconContainer, 
                { backgroundColor: hexAlpha(accentColor, isDark ? '20' : '15') }
              ]}
            >
              <MaterialIcons name={icon} size={32} color={accentColor} />
            </View>
            
            {/* Main Content Area */}
            <View style={styles.textContainer}>
              <View style={styles.titleRow}>
                <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>
                  {title}
                </Text>
                {badge && <View style={styles.badgeContainer}>{badge}</View>}
              </View>
              
              {subtitle && (
                <Text style={[styles.subtitle, { color: theme.icon }]} numberOfLines={2}>
                  {subtitle}
                </Text>
              )}
              
              {/* Footer / Status Area */}
              {(statusText || statusIcon) && (
                <View style={styles.statusRow}>
                  {statusIcon && (
                    <MaterialIcons 
                      name={statusIcon} 
                      size={16} 
                      color={finalStatusColor} 
                      style={styles.statusIcon} 
                    />
                  )}
                  {statusText && (
                    <Text style={[styles.statusText, { color: finalStatusColor }]}>
                      {statusText}
                    </Text>
                  )}
                </View>
              )}
            </View>
            
            {/* Right Chevron */}
            {!disabled && (
              <MaterialIcons 
                name="chevron-right" 
                size={24} 
                color={theme.icon} 
                style={styles.chevron}
              />
            )}
          </View>
        </PressableFeedback>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 16,
    ...shadows.sm,
  },
  disabled: {
    opacity: 0.5,
  },
  card: {
    borderRadius: radii.xl,
    borderWidth: 1,
    overflow: 'hidden',
  },
  pressable: {
    width: '100%',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: radii.xl,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  textContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    flex: 1,
    marginRight: 8,
    letterSpacing: -0.3,
  },
  badgeContainer: {
    alignSelf: 'flex-start',
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 10,
    fontWeight: '500',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusIcon: {
    marginRight: 6,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  chevron: {
    marginLeft: 8,
    opacity: 0.4,
  },
});
