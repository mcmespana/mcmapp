import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { Card, Button, PressableFeedback } from 'heroui-native';
import { MaterialIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Colors } from '@/constants/colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { radii } from '@/constants/uiStyles';
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
  accentColor = '#FF4D4D', // Warm passionate default
}: ContigoToolCardProps) {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const theme = Colors[scheme ?? 'light'];

  const defaultStatusColor = isDark ? '#A3BD31' : '#3A7D44';
  const finalStatusColor = statusColor || defaultStatusColor;

  return (
    <View style={[styles.wrapper, disabled && styles.disabled]}>
      <Card
        variant="transparent"
        style={[
          styles.card,
          {
            borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.5)',
            borderWidth: 1.5,
          },
        ]}
      >
        {Platform.OS === 'ios' ? (
          <BlurView
            tint={isDark ? 'systemMaterialDark' : 'systemMaterialLight'}
            intensity={80}
            style={StyleSheet.absoluteFill}
          />
        ) : (
          <View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: isDark ? 'rgba(30,30,30,0.85)' : 'rgba(255,255,255,0.85)' },
            ]}
          />
        )}
        
        <PressableFeedback 
          onPress={disabled ? undefined : onPress} 
          style={styles.pressable}
          feedbackVariant="scale-highlight"
        >
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
            
            {/* Right Chevron Button via HeroUI */}
            {!disabled && (
              <Button size="sm" isIconOnly variant="tertiary" className="ml-2">
                <MaterialIcons 
                  name="chevron-right" 
                  size={24} 
                  color={theme.icon} 
                />
              </Button>
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
  disabled: {
    opacity: 0.5,
  },
  card: {
    borderRadius: radii.2xl,
    overflow: 'hidden',
  },
  pressable: {
    width: '100%',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: radii.2xl,
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
    marginBottom: 6,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    flex: 1,
    marginRight: 8,
    letterSpacing: -0.5,
  },
  badgeContainer: {
    alignSelf: 'flex-start',
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 12,
    fontWeight: '500',
    opacity: 0.8,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  statusIcon: {
    marginRight: 6,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
