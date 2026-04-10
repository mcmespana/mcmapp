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

export function ReadingCard({ title, cita, texto, defaultExpanded = false }: ReadingCardProps) {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const theme = Colors[scheme ?? 'light'];
  
  const [expanded, setExpanded] = useState(defaultExpanded);

  if (!texto) return null;

  return (
    <View style={styles.wrapper}>
      <Card 
        style={[
          styles.card,
          { 
            backgroundColor: theme.card,
            borderColor: isDark ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.07)'
          }
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
                <View style={[styles.citaBadge, { backgroundColor: hexAlpha(Colors.light.tint, '15') }]}>
                  <Text style={[styles.citaText, { color: isDark ? '#95d2f2' : Colors.light.tint }]}>
                    {cita}
                  </Text>
                </View>
              </View>
              <MaterialIcons 
                name={expanded ? 'expand-less' : 'expand-more'} 
                size={24} 
                color={theme.icon} 
              />
            </View>
          </PressableFeedback>
          
          {expanded && (
            <View style={[styles.body, { borderTopColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }]}>
              <Text style={[styles.bodyText, { color: theme.text }]}>
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
    marginBottom: 12,
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
    padding: 16,
  },
  headerTextContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  citaBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.sm,
  },
  citaText: {
    fontSize: 12,
    fontWeight: '700',
  },
  body: {
    padding: 16,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  bodyText: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '400',
  },
});
