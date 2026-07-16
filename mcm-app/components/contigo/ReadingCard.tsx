import React, { useState } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { Card, PressableFeedback } from 'heroui-native';
import { Colors } from '@/constants/colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { MaterialIcons } from '@expo/vector-icons';
import { radii, shadows } from '@/constants/uiStyles';
import { hexAlpha } from '@/utils/colorUtils';
import {
  HighlightableReading,
  type ReadingSelection,
} from '@/components/contigo/HighlightableReading';
import type { HighlightRange } from '@/utils/highlightRanges';

import useFontScale from '@/hooks/useFontScale';

interface ReadingCardProps {
  title: string;
  cita: string;
  /** Texto de la lectura. Si es subrayable debe ser el texto CANÓNICO. */
  texto: string;
  defaultExpanded?: boolean;
  /** Escala de letra a aplicar. Si se omite, usa la global de la app. */
  scale?: number;
  /** Habilita subrayado con selección nativa en el cuerpo. */
  highlightable?: boolean;
  penMode?: boolean;
  ranges?: HighlightRange[];
  onSelectionChange?: (sel: ReadingSelection | null) => void;
}

// Warm amber accent for Contigo section
const WARM_ACCENT_LIGHT = '#B8860B';
const WARM_ACCENT_DARK = '#DAA520';

export function ReadingCard({
  title,
  cita,
  texto,
  defaultExpanded = false,
  scale,
  highlightable = false,
  penMode = false,
  ranges = [],
  onSelectionChange,
}: ReadingCardProps) {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const theme = Colors[scheme ?? 'light'];
  const accent = isDark ? WARM_ACCENT_DARK : WARM_ACCENT_LIGHT;
  const globalScale = useFontScale();
  const fontScale = scale ?? globalScale;

  const [expanded, setExpanded] = useState(defaultExpanded);
  // En modo subrayar la tarjeta subrayable se abre sola para poder seleccionar.
  const isOpen = expanded || (highlightable && penMode);

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
                <Text
                  style={[styles.title, { color: theme.text }]}
                  numberOfLines={1}
                >
                  {title}
                </Text>
                <View
                  style={[
                    styles.citaBadge,
                    { backgroundColor: hexAlpha(accent, '12') },
                  ]}
                >
                  <Text style={[styles.citaText, { color: accent }]}>
                    {cita}
                  </Text>
                </View>
              </View>
              <MaterialIcons
                name={isOpen ? 'expand-less' : 'expand-more'}
                size={22}
                color={isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.25)'}
              />
            </View>
          </PressableFeedback>

          {isOpen && (
            <View
              style={[
                styles.body,
                {
                  borderTopColor: isDark
                    ? 'rgba(255,255,255,0.04)'
                    : 'rgba(0,0,0,0.04)',
                },
              ]}
            >
              {highlightable ? (
                <HighlightableReading
                  text={texto}
                  ranges={ranges}
                  penMode={penMode}
                  onSelectionChange={onSelectionChange}
                  color={theme.text}
                  fontSize={17 * fontScale}
                  lineHeight={26 * fontScale}
                  fontFamily={Platform.OS === 'ios' ? 'Palatino' : 'serif'}
                  isDark={isDark}
                />
              ) : (
                <Text
                  style={[
                    styles.bodyText,
                    {
                      color: theme.text,
                      fontSize: 17 * fontScale,
                      lineHeight: 26 * fontScale,
                      fontFamily: Platform.OS === 'ios' ? 'Palatino' : 'serif',
                    },
                  ]}
                  selectable
                >
                  {texto}
                </Text>
              )}
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
