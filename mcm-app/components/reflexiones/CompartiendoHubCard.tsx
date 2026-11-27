/**
 * La puerta de Compartiendo en el hub del evento.
 *
 * Hasta noviembre de 2026 al muro solo se llegaba desde el icono de la barra
 * flotante de las SUB-pantallas (Horario, Materiales…): desde el hub, que es
 * donde se entra, no había forma de verlo. Esta tarjeta va justo debajo del
 * héroe y enseña que el muro está vivo —cuántas hay, quién ha escrito, la
 * última frase— con un atajo para escribir sin pasar por el muro.
 *
 * Si el panel oculta `compartiendo` (`hidden: true` en el nodo), no sale.
 */
import React, { useCallback, useMemo, useState } from 'react';
import { Platform, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { PressableFeedback } from 'heroui-native';
import { useFocusEffect } from 'expo-router/react-navigation';
import { MaterialIcons } from '@/components/ui/icons';
import PressableScale from '@/components/ui/PressableScale';
import { AvatarStack } from '@/components/reflexiones/Avatars';
import { themeColors } from '@/constants/colors';
import spacing from '@/constants/spacing';
import typography from '@/constants/typography';
import { radii } from '@/constants/uiStyles';
import {
  getEventCacheKey,
  getEventFirebasePath,
  type EventConfig,
} from '@/constants/events';
import { useFirebaseData } from '@/hooks/useFirebaseData';
import { hexAlpha, onColor, readableOn } from '@/utils/colorUtils';
import { tintedGlyph } from '@/utils/tintColors';
import { clipText } from '@/utils/shareCard';
import {
  countLabel,
  normalizeReflexiones,
  reflexionTone,
  relativeTime,
  sortReflexiones,
  splitAuthor,
  toneColor,
  wallStats,
  type Reflexion,
} from '@/utils/reflexiones';

interface Props {
  event: EventConfig;
  isDark: boolean;
  /** Abre el muro. */
  onOpen: () => void;
  /** Abre el muro con el compositor ya abierto. */
  onWrite: () => void;
}

const authorOf = (r: Reflexion) =>
  r.grupal ? (r.grupo ?? '') : (r.autor ?? '');

export default function CompartiendoHubCard({
  event,
  isDark,
  onOpen,
  onWrite,
}: Props) {
  const roles = themeColors(isDark);
  const tint = event.tintColor;
  const { data, hidden } = useFirebaseData<unknown>(
    getEventFirebasePath(event, 'compartiendo'),
    getEventCacheKey(event, 'compartiendo'),
  );

  // «la última hace 5 min»: el reloj se pone en hora al volver al hub.
  const [now, setNow] = useState(() => Date.now());
  useFocusEffect(useCallback(() => setNow(Date.now()), []));

  const sorted = useMemo(
    () => sortReflexiones(normalizeReflexiones(data)),
    [data],
  );
  const stats = useMemo(() => wallStats(sorted, authorOf), [sorted]);
  const toneByAuthor = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of sorted) {
      const a = authorOf(r);
      if (a && !map.has(a)) map.set(a, toneColor(reflexionTone(r)));
    }
    return map;
  }, [sorted]);

  if (hidden) return null;

  const latest = sorted[0];
  const glyph = tintedGlyph(tint, roles.background, '18');
  const ago = relativeTime(stats.lastAt, now);
  const subtitle =
    stats.total === 0
      ? 'Lo que nos llevamos de estos días'
      : `${countLabel(stats.total, 'reflexión', 'reflexiones')}${
          ago ? ` · ${ago}` : ''
        }`;
  const latestTone = latest ? toneColor(reflexionTone(latest)) : tint;
  const latestName = latest ? splitAuthor(authorOf(latest)).name : '';

  // Dos zonas pulsables HERMANAS (el cuerpo abre el muro; «Escribir», el
  // compositor), nunca una dentro de otra: en web un <button> dentro de otro
  // es HTML inválido y React lo marca como error.
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: roles.background },
        Platform.OS !== 'web'
          ? {
              shadowColor: tint,
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: isDark ? 0.3 : 0.15,
              shadowRadius: 12,
              elevation: 4,
            }
          : ({ boxShadow: `0 4px 12px ${hexAlpha(tint, '30')}` } as ViewStyle),
      ]}
    >
      <PressableFeedback
        style={styles.body}
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel={`Compartiendo. ${subtitle}`}
        accessibilityHint="Abre el muro de reflexiones"
      >
        <PressableFeedback.Highlight />
        <View style={styles.head}>
          <View style={[styles.icon, { backgroundColor: glyph.fill }]}>
            <MaterialIcons name="forum" size={26} color={glyph.glyph} />
          </View>
          <View style={styles.flex}>
            <Text style={[styles.title, { color: roles.text }]}>
              Compartiendo
            </Text>
            <Text
              style={[styles.subtitle, { color: roles.textSecondary }]}
              numberOfLines={2}
            >
              {subtitle}
            </Text>
          </View>
          <AvatarStack
            names={stats.recentAuthors}
            colorFor={(n) => toneByAuthor.get(n) ?? tint}
            total={stats.people}
            max={3}
            size={28}
            ring={roles.background}
            moreColor={roles.backgroundSunken}
            moreInk={roles.textSecondary}
          />
        </View>

        {latest ? (
          <View
            style={[
              styles.bubble,
              { backgroundColor: hexAlpha(latestTone, isDark ? '2E' : '1A') },
            ]}
          >
            <Text
              style={[styles.quote, { color: roles.text }]}
              numberOfLines={2}
            >
              “{clipText(latest.contenido, 140)}”
            </Text>
            <Text
              style={[
                styles.by,
                { color: readableOn(latestTone, roles.background, 4.5) },
              ]}
              numberOfLines={1}
            >
              — {latestName || 'Anónimo'}
            </Text>
          </View>
        ) : null}
      </PressableFeedback>

      <View style={styles.foot}>
        <PressableScale
          onPress={onWrite}
          style={[styles.write, { backgroundColor: tint }]}
          accessibilityRole="button"
          accessibilityLabel="Escribir una reflexión"
        >
          <MaterialIcons name="edit" size={18} color={onColor(tint)} />
          <Text style={[styles.writeText, { color: onColor(tint) }]}>
            {stats.total === 0 ? 'Escribir la primera' : 'Escribir'}
          </Text>
        </PressableScale>
        <PressableScale
          onPress={onOpen}
          style={styles.see}
          accessibilityRole="button"
          accessibilityLabel="Ver el muro"
        >
          <Text style={[styles.seeText, { color: roles.textSecondary }]}>
            Ver el muro
          </Text>
          <MaterialIcons
            name="chevron-right"
            size={20}
            color={roles.textMuted}
          />
        </PressableScale>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    maxWidth: 1100,
    borderRadius: radii.lg,
    paddingBottom: spacing.md,
  },
  body: {
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    overflow: 'hidden',
    padding: spacing.md,
    paddingBottom: spacing.sm + spacing.xs,
    gap: spacing.sm + spacing.xs,
  },
  flex: { flex: 1 },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm + 4 },
  icon: {
    width: 52,
    height: 52,
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { ...typography.title, fontWeight: '700', letterSpacing: -0.3 },
  subtitle: { ...typography.footnote, marginTop: 2 },
  bubble: {
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + spacing.xs,
    gap: spacing.xs,
  },
  quote: { ...typography.body, fontWeight: '600', lineHeight: 22 },
  by: { ...typography.caption, fontWeight: '600' },
  foot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
  },
  write: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    minHeight: 44,
    paddingHorizontal: spacing.md,
    borderRadius: radii.full,
  },
  writeText: { ...typography.button, fontWeight: '700' },
  see: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    minHeight: 44,
    paddingLeft: spacing.sm,
  },
  seeText: { ...typography.subhead, fontWeight: '600' },
});
