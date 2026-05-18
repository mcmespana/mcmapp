import React from 'react';
import {
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { radii } from '@/constants/uiStyles';
import { hexAlpha } from '@/utils/colorUtils';
import { useColorScheme } from '@/hooks/useColorScheme';

interface TeaserCardProps {
  /** Small uppercase label above the title (e.g. "EVANGELIO DEL DÍA", "PRÓXIMO EVENTO"). */
  kicker?: string;
  /** Main heading of the card. */
  title: string;
  /** Optional reference / pill shown on the right of the title (e.g. "Mt 5, 1-12"). */
  cita?: string;
  /** Optional 2–3 line preview that fades out at the bottom. */
  preview?: string;
  /** Accent color — used for kicker, cita, CTA, accent bar fallback. */
  accentColor: string;
  /** Optional gradient for the top accent bar (3 colors). Falls back to a flat `accentColor` bar. */
  accentGradient?: readonly [string, string, string];
  /** Label of the CTA button. Defaults to "Abrir →". */
  ctaLabel?: string;
  /** Tap on CTA / whole card. */
  onOpen: () => void;
  /** If true, shows a green "done" badge next to the CTA. */
  done?: boolean;
  /** Custom label for the "done" badge. Defaults to "Hecho hoy". */
  doneLabel?: string;
  /** Serif font for the preview (recommended for liturgical / contemplative texts). */
  serifPreview?: boolean;
}

/**
 * Hero teaser card with:
 *   - top accent bar (solid or gradient)
 *   - uppercase kicker + title + optional pill reference (cita)
 *   - optional preview with fade-out
 *   - CTA button + optional done badge
 *
 * Extracted from `components/contigo/HomeWidgets.tsx` (EvangelioTeaserCard).
 * Designed to be reusable for: next calendar event in Home, latest reflection,
 * featured material in MasHome, etc.
 */
export default function TeaserCard({
  kicker,
  title,
  cita,
  preview,
  accentColor,
  accentGradient,
  ctaLabel = 'Abrir →',
  onOpen,
  done = false,
  doneLabel = 'Hecho hoy',
  serifPreview = false,
}: TeaserCardProps) {
  const scheme = useColorScheme() ?? 'light';
  const isDark = scheme === 'dark';

  const surfaceBg = isDark ? '#26221C' : '#FFFDF7';
  const borderColor = hexAlpha(accentColor, isDark ? '26' : '2E');
  const citaBg = hexAlpha(accentColor, isDark ? '1F' : '1A');
  const ctaBg = hexAlpha(accentColor, isDark ? '1A' : '17');
  const textColor = isDark ? '#F5EFE3' : '#1C1610';
  const doneBg = hexAlpha('#3A7D44', isDark ? '24' : '1A');
  const doneText = isDark ? '#6DBF7E' : '#3A7D44';

  const fadeColors = isDark
    ? (['rgba(38,34,28,0)', 'rgba(38,34,28,0.95)'] as const)
    : (['rgba(255,253,247,0)', 'rgba(255,253,247,0.95)'] as const);

  return (
    <View style={styles.outer}>
      <View style={[styles.clip, { backgroundColor: surfaceBg, borderColor }]}>
        {accentGradient ? (
          <LinearGradient
            colors={accentGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.bar}
          />
        ) : (
          <View style={[styles.bar, { backgroundColor: accentColor }]} />
        )}

        <View style={styles.body}>
          <View style={styles.headerRow}>
            <View style={{ flex: 1, marginRight: 10 }}>
              {kicker ? (
                <Text style={[styles.kicker, { color: accentColor }]}>
                  {kicker}
                </Text>
              ) : null}
              <Text
                style={[styles.title, { color: textColor }]}
                numberOfLines={2}
              >
                {title}
              </Text>
            </View>
            {cita ? (
              <View style={[styles.cita, { backgroundColor: citaBg }]}>
                <Text style={[styles.citaText, { color: accentColor }]}>
                  {cita}
                </Text>
              </View>
            ) : null}
          </View>

          {preview ? (
            <View style={styles.previewWrap}>
              <Text
                style={[
                  styles.preview,
                  serifPreview && styles.previewSerif,
                  { color: textColor },
                ]}
                numberOfLines={3}
              >
                {preview.replace(/\n+/g, ' ').trim()}
              </Text>
              <LinearGradient
                colors={fadeColors}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={styles.fade}
                pointerEvents="none"
              />
            </View>
          ) : null}

          <View style={styles.actions}>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={onOpen}
              style={[styles.cta, { backgroundColor: ctaBg }]}
            >
              <Text style={[styles.ctaText, { color: accentColor }]}>
                {ctaLabel}
              </Text>
            </TouchableOpacity>
            {done ? (
              <View style={[styles.done, { backgroundColor: doneBg }]}>
                <MaterialIcons name="check" size={12} color={doneText} />
                <Text style={[styles.doneText, { color: doneText }]}>
                  {doneLabel}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    borderRadius: radii.xxl,
    backgroundColor: 'transparent',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.18,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
      },
      android: { elevation: 2 },
      web: { boxShadow: '0 4px 12px rgba(0,0,0,0.12)' as any },
    }),
  },
  clip: {
    borderRadius: radii.xxl,
    overflow: 'hidden',
    borderWidth: 1,
  },
  bar: { height: 3 },
  body: { padding: 16 },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  kicker: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 3,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.3,
    lineHeight: 20,
  },
  cita: {
    borderRadius: radii.pillFull,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  citaText: { fontSize: 12, fontWeight: '800' },
  previewWrap: { position: 'relative', marginBottom: 14 },
  preview: { fontSize: 14, lineHeight: 22 },
  previewSerif: {
    fontFamily: Platform.OS === 'ios' ? 'Palatino' : 'serif',
  },
  fade: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 36,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cta: {
    flex: 1,
    height: 38,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: { fontSize: 12, fontWeight: '700' },
  done: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: radii.pillFull,
    paddingHorizontal: 11,
    paddingVertical: 5,
    marginLeft: 8,
  },
  doneText: { fontSize: 11, fontWeight: '700' },
});
