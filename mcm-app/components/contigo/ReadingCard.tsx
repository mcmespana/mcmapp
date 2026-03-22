// components/contigo/ReadingCard.tsx — Expandable card for a single reading
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/colors';
import { radii } from '@/constants/uiStyles';
import spacing from '@/constants/spacing';

// Enable LayoutAnimation on Android
if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface Props {
  title: string;
  cita: string;
  texto: string;
  startExpanded?: boolean;
  accentColor?: string;
}

export default function ReadingCard({
  title,
  cita,
  texto,
  startExpanded = false,
  accentColor = '#6B3FA0',
}: Props) {
  const scheme = useColorScheme();
  const theme = Colors[scheme ?? 'light'];
  const [expanded, setExpanded] = useState(startExpanded);

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(!expanded);
  };

  // Clean up text: handle paragraph breaks from scraper
  const formattedText = texto
    .replace(/\\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.card,
          borderColor:
            scheme === 'dark' ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.07)',
          borderLeftColor: accentColor,
        },
      ]}
    >
      <TouchableOpacity
        style={styles.header}
        onPress={toggle}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={`${title} ${cita}`}
      >
        <View style={styles.headerContent}>
          <Text style={[styles.title, { color: accentColor }]}>{title}</Text>
          {cita ? (
            <Text style={[styles.cita, { color: theme.icon }]}>{cita}</Text>
          ) : null}
        </View>
        <MaterialIcons
          name={expanded ? 'expand-less' : 'expand-more'}
          size={24}
          color={theme.icon}
        />
      </TouchableOpacity>

      {expanded && formattedText ? (
        <View style={styles.body}>
          <Text style={[styles.texto, { color: theme.text }]} selectable>
            {formattedText}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderLeftWidth: 4,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.sm,
  },
  headerContent: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  cita: {
    fontSize: 13,
    fontStyle: 'italic',
  },
  body: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  texto: {
    fontSize: 15,
    lineHeight: 24,
  },
});
