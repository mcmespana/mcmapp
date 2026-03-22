import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Linking,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { useColorScheme } from '@/hooks/useColorScheme';

interface Props {
  title: string;
  cita: string;
  texto: string;
  source?: string;
  sourceUrl?: string;
  accent?: string;
  collapsible?: boolean;
  initiallyExpanded?: boolean;
}

export default function ReadingCard({
  title,
  cita,
  texto,
  source,
  sourceUrl,
  accent = '#253883',
  collapsible = false,
  initiallyExpanded = true,
}: Props) {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const [expanded, setExpanded] = useState(initiallyExpanded);

  const cardBg = isDark ? '#2C2C2E' : '#FFFFFF';

  return (
    <View style={[styles.card, { backgroundColor: cardBg }]}>
      <TouchableOpacity
        style={styles.header}
        activeOpacity={collapsible ? 0.7 : 1}
        onPress={
          collapsible ? () => setExpanded((e) => !e) : undefined
        }
      >
        <View style={styles.headerLeft}>
          <View
            style={[styles.titleBar, { backgroundColor: accent }]}
          />
          <View>
            <Text
              style={[
                styles.title,
                { color: isDark ? '#FFF' : '#1A1A2E' },
              ]}
            >
              {title}
            </Text>
            <Text
              style={[
                styles.cita,
                { color: accent },
              ]}
            >
              {cita}
            </Text>
          </View>
        </View>
        {collapsible && (
          <MaterialIcons
            name={expanded ? 'expand-less' : 'expand-more'}
            size={24}
            color={isDark ? '#888' : '#AAA'}
          />
        )}
      </TouchableOpacity>

      {expanded && texto ? (
        <View style={styles.body}>
          <Text
            style={[
              styles.texto,
              { color: isDark ? '#D0D0D0' : '#333' },
            ]}
          >
            {texto}
          </Text>
          {source ? (
            <TouchableOpacity
              style={styles.sourceRow}
              onPress={
                sourceUrl ? () => Linking.openURL(sourceUrl) : undefined
              }
            >
              <MaterialIcons
                name="open-in-new"
                size={14}
                color={accent}
              />
              <Text
                style={[styles.sourceText, { color: accent }]}
                numberOfLines={1}
              >
                {source}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    marginHorizontal: 16,
    marginBottom: 12,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 4,
      },
      default: { elevation: 1 },
    }),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingRight: 14,
    paddingLeft: 0,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  titleBar: {
    width: 4,
    height: 36,
    borderRadius: 2,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
  },
  cita: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 1,
  },
  body: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  texto: {
    fontSize: 15,
    lineHeight: 24,
    letterSpacing: 0.2,
  },
  sourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  sourceText: {
    fontSize: 12,
    fontWeight: '500',
    flex: 1,
  },
});
