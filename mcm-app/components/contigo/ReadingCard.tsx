import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Card, PressableFeedback } from 'heroui-native';
import { Colors } from '@/constants/colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { MaterialIcons } from '@expo/vector-icons';
import { radii, shadows } from '@/constants/uiStyles';
import { hexAlpha } from '@/utils/colorUtils';

interface ReadingCardProps {
  title: string;
  cita: string;
  texto: string;
  defaultExpanded?: boolean;
}

// Warm amber accent for Contigo section
const WARM_ACCENT_LIGHT = '#B8860B';
const WARM_ACCENT_DARK = '#DAA520';

import useFontScale from '@/hooks/useFontScale';
import { Platform } from 'react-native';

export function ReadingCard({ title, cita, texto, defaultExpanded = false }: ReadingCardProps) {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const theme = Colors[scheme ?? 'light'];
  const accent = isDark ? WARM_ACCENT_DARK : WARM_ACCENT_LIGHT;
  const fontScale = useFontScale();

  const [expanded, setExpanded] = useState(defaultExpanded);

  if (!texto) return null;

  return (
    <View style={styles.wrapper}>
      <Card
        style={[
          styles.card,
          {
            backgroundColor: theme.card,
            borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
          },
        ]}
      >
        <View style={styles.content}>
          <PressableFeedback
            onPress={() => setExpanded(!expanded)}
            style={styles.headerPressable}
          >
            <PressableFeedback.Highlight />
            <View style={styles.header}>
              <View style={styles.headerTextContainer}>
                <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>
                  {title}
                </Text>
                <View style={[styles.citaBadge, { backgroundColor: hexAlpha(accent, '12') }]}>
                  <Text style={[styles.citaText, { color: accent }]}>
                    {cita}
                  </Text>
                </View>
              </View>
              <MaterialIcons
                name={expanded ? 'expand-less' : 'expand-more'}
                size={22}
                color={isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.25)'}
              />
            </View>
          </PressableFeedback>

          {expanded && (
            <View style={[styles.body, { borderTopColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)' }]}>
              <Text 
                style={[
                  styles.bodyText, 
                  { 
                    color: theme.text,
                    fontSize: 16 * fontScale,
                    lineHeight: 24 * fontScale,
                    fontFamily: Platform.OS === 'ios' ? 'Palatino' : 'serif'
                  }
                ]} 
                selectable
              >
                {texto}
              </Text>
            </View>
          )}
        </View>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 10,
    ...shadows.sm,
  },
  card: {
    borderRadius: radii.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  content: {
    width: '100%',
  },
  headerPressable: {
    width: '100%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
  },
  headerTextContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  citaBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 100,
  },
  citaText: {
    fontSize: 11,
    fontWeight: '700',
  },
  body: {
    padding: 14,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  bodyText: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '400',
  },
});
