import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';

import colors, { Colors } from '@/constants/colors';
import { getBrightness } from '@/components/ui/glass';
import { useColorScheme } from '@/hooks/useColorScheme';
import { h } from '@/utils/haptics';
import type { SurveyIndexEntry } from '@/constants/surveys';

interface SurveyBannerProps {
  entry: SurveyIndexEntry;
  /** Fila compacta (para listas, p. ej. Ajustes) en vez del CTA destacado. */
  compact?: boolean;
  /** Acción al pulsar. Por defecto navega a `/encuesta/<id>`. */
  onPress?: () => void;
}

/**
 * Banner/fila para una encuesta genérica activa. Reutiliza el look de los CTA de
 * evaluación de la Home. Navega a la pantalla de la encuesta (`/encuesta/<id>`).
 */
export default function SurveyBanner({
  entry,
  compact,
  onPress,
}: SurveyBannerProps) {
  const scheme = useColorScheme();
  const theme = Colors[scheme ?? 'light'];
  const accent = entry.accentColor || colors.primary;

  const handlePress = () => {
    h.tap();
    if (onPress) onPress();
    else router.navigate(`/encuesta/${entry.id}` as never);
  };

  if (compact) {
    return (
      <TouchableOpacity
        style={styles.row}
        onPress={handlePress}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={entry.title}
      >
        <View
          style={[styles.rowIcon, { backgroundColor: hexFade(accent, 0.14) }]}
        >
          {entry.emoji ? (
            <Text style={styles.emoji}>{entry.emoji}</Text>
          ) : (
            <MaterialIcons name="assignment" size={20} color={accent} />
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text
            style={[styles.rowTitle, { color: theme.text }]}
            numberOfLines={1}
          >
            {entry.title}
          </Text>
          {entry.intro ? (
            <Text
              style={[styles.rowHint, { color: theme.icon }]}
              numberOfLines={1}
            >
              {entry.intro}
            </Text>
          ) : null}
        </View>
        <MaterialIcons
          name="chevron-right"
          size={20}
          color={theme.icon}
          style={{ opacity: 0.4 }}
        />
      </TouchableOpacity>
    );
  }

  // El acento puede ser muy claro; si lo es, el texto blanco no se lee, así que
  // usamos un fondo legible (primary) manteniendo el acento solo en el botón.
  const bg = getBrightness(accent) > 200 ? colors.primary : accent;
  const ctaLabel = entry.placement?.ctaLabel || 'Responder';

  return (
    <TouchableOpacity
      style={[styles.cta, { backgroundColor: bg }]}
      onPress={handlePress}
      activeOpacity={0.9}
      accessibilityRole="button"
      accessibilityLabel={entry.title}
    >
      <View style={styles.ctaIcon}>
        {entry.emoji ? (
          <Text style={styles.ctaEmoji}>{entry.emoji}</Text>
        ) : (
          <MaterialIcons name="assignment" size={26} color="#fff" />
        )}
      </View>
      <View style={styles.ctaTextWrap}>
        <Text style={styles.ctaTitle} numberOfLines={1}>
          {entry.title}
        </Text>
        <Text style={styles.ctaBody} numberOfLines={2}>
          {entry.intro || 'Tu opinión nos ayuda — solo un momento.'}
        </Text>
      </View>
      <View style={styles.ctaBtn}>
        <Text style={[styles.ctaBtnText, { color: bg }]}>{ctaLabel}</Text>
        <MaterialIcons name="arrow-forward" size={15} color={bg} />
      </View>
    </TouchableOpacity>
  );
}

/** Mezcla un hex con alfa (0..1) → 'rrggbbAA'. */
function hexFade(hex: string, alpha: number): string {
  const a = Math.round(Math.max(0, Math.min(1, alpha)) * 255)
    .toString(16)
    .padStart(2, '0');
  return `${hex}${a}`;
}

const styles = StyleSheet.create({
  // CTA destacado (Home / hub de evento)
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 18,
    padding: 14,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 3,
  },
  ctaIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaEmoji: { fontSize: 24 },
  ctaTextWrap: { flex: 1 },
  ctaTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  ctaBody: { color: 'rgba(255,255,255,0.92)', fontSize: 13, marginTop: 2 },
  ctaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  ctaBtnText: { fontSize: 13, fontWeight: '800' },
  // Fila compacta (Ajustes)
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: { fontSize: 18 },
  rowTitle: { fontSize: 15, fontWeight: '700' },
  rowHint: { fontSize: 12, marginTop: 1 },
});
