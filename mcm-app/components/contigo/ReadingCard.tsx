import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { radii, shadows } from '@/constants/uiStyles';
import spacing from '@/constants/spacing';

interface ReadingCardProps {
  title: string;
  citation?: string;
  text?: string;
  defaultExpanded?: boolean;
  accent?: string;
}

export default function ReadingCard({
  title,
  citation,
  text,
  defaultExpanded = false,
  accent = '#253883',
}: ReadingCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const scheme = useColorScheme();
  const theme = Colors[scheme ?? 'light'];
  const isDark = scheme === 'dark';

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.card,
          borderColor: isDark
            ? 'rgba(255,255,255,0.08)'
            : 'rgba(0,0,0,0.06)',
          ...shadows.sm,
        },
      ]}
    >
      <TouchableOpacity
        style={styles.header}
        onPress={() => setExpanded((e) => !e)}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={`${title}${citation ? `, ${citation}` : ''}`}
      >
        {/* Left bar accent */}
        <View style={[styles.accentBar, { backgroundColor: accent }]} />

        <View style={styles.headerContent}>
          <Text style={[styles.cardTitle, { color: theme.text }]}>
            {title}
          </Text>
          {citation && (
            <Text style={[styles.citation, { color: accent }]}>
              {citation}
            </Text>
          )}
        </View>

        <MaterialIcons
          name={expanded ? 'expand-less' : 'expand-more'}
          size={22}
          color={theme.icon}
          style={{ opacity: 0.6 }}
        />
      </TouchableOpacity>

      {expanded && text && (
        <View style={styles.body}>
          <View
            style={[
              styles.divider,
              {
                backgroundColor: isDark
                  ? 'rgba(255,255,255,0.07)'
                  : 'rgba(0,0,0,0.06)',
              },
            ]}
          />
          <Text style={[styles.bodyText, { color: theme.text }]}>
            {text}
          </Text>
        </View>
      )}

      {expanded && !text && (
        <View style={styles.body}>
          <View
            style={[
              styles.divider,
              {
                backgroundColor: isDark
                  ? 'rgba(255,255,255,0.07)'
                  : 'rgba(0,0,0,0.06)',
              },
            ]}
          />
          <Text style={[styles.noContent, { color: theme.icon }]}>
            Texto no disponible
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.lg,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: spacing.sm,
  } as ViewStyle,
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 10,
  } as ViewStyle,
  accentBar: {
    width: 3,
    height: 36,
    borderRadius: 2,
    flexShrink: 0,
  } as ViewStyle,
  headerContent: {
    flex: 1,
    gap: 2,
  } as ViewStyle,
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
  } as TextStyle,
  citation: {
    fontSize: 13,
    fontWeight: '500',
  } as TextStyle,
  divider: {
    height: 1,
    marginBottom: spacing.sm,
  } as ViewStyle,
  body: {
    paddingHorizontal: 14,
    paddingBottom: 14,
  } as ViewStyle,
  bodyText: {
    fontSize: 14,
    lineHeight: 22,
  } as TextStyle,
  noContent: {
    fontSize: 13,
    fontStyle: 'italic',
    opacity: 0.6,
  } as TextStyle,
});
