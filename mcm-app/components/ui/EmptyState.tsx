import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { radii } from '@/constants/uiStyles';
import { useThemeColor } from '@/hooks/useThemeColor';
import { hexAlpha } from '@/utils/colorUtils';
import typography from '@/constants/typography';
import spacing from '@/constants/spacing';

type MaterialIconName = React.ComponentProps<typeof MaterialIcons>['name'];

interface EmptyStateProps {
  /** Material icon name shown above the title. */
  icon?: MaterialIconName;
  /** Optional emoji to use instead of an icon. */
  emoji?: string;
  /** Bold heading. */
  title: string;
  /** Optional explanatory subtitle (1–2 lines). */
  subtitle?: string;
  /** Optional call-to-action label + handler. */
  actionLabel?: string;
  onAction?: () => void;
  /** Accent color for icon and CTA. Defaults to muted text. */
  accentColor?: string;
  /**
   * Color del título. Por defecto, el del tema institucional.
   *
   * Existe porque este componente vive en `components/ui/`, y ahí el contrato
   * es ser AGNÓSTICO DE PALETA (`design.md` §2). Lo era a medias: `accentColor`
   * solo tocaba el icono y el CTA, mientras que el título y el subtítulo se
   * cogían del tema institucional — o sea que en Contigo salían grises fríos
   * sobre fondo crema.
   */
  titleColor?: string;
  /** Color del subtítulo. Por defecto, el gris del tema institucional. */
  subtitleColor?: string;
  /**
   * Versión compacta, para vacíos que viven DENTRO de una hoja, un desplegable
   * o una lista corta.
   *
   * El padding de 48 px del vacío normal desborda un bottom sheet, y por eso
   * `CommandPalette` y `ChoirSheet` se habían hecho su propio `<Text>` a mano
   * en vez de usar este componente. Compacto: sin icono grande, menos aire y
   * el título al tamaño del cuerpo.
   */
  compact?: boolean;
}

/**
 * Canonical empty-state for lists / sections with no data.
 * Used in Calendar (no events), Photos (no albums), Reflexiones (no entries),
 * SelectedSongs (no playlist), etc.
 */
export default function EmptyState({
  icon,
  emoji,
  title,
  subtitle,
  actionLabel,
  onAction,
  accentColor,
  titleColor,
  subtitleColor,
  compact = false,
}: EmptyStateProps) {
  const themeText = useThemeColor({}, 'text');
  const themeMuted = useThemeColor({}, 'icon');
  const textColor = titleColor ?? themeText;
  const mutedColor = subtitleColor ?? themeMuted;
  const tone = accentColor ?? themeMuted;

  return (
    <View style={[styles.root, compact && styles.rootCompact]}>
      {emoji ? (
        <Text style={[styles.emoji, compact && styles.emojiCompact]}>
          {emoji}
        </Text>
      ) : icon && !compact ? (
        <View
          style={[styles.iconWrap, { backgroundColor: hexAlpha(tone, '1A') }]}
        >
          <MaterialIcons name={icon} size={32} color={tone} />
        </View>
      ) : icon ? (
        <MaterialIcons name={icon} size={20} color={tone} />
      ) : null}
      <Text
        style={[
          styles.title,
          compact && styles.titleCompact,
          { color: textColor },
        ]}
      >
        {title}
      </Text>
      {subtitle ? (
        <Text style={[styles.subtitle, { color: mutedColor }]}>{subtitle}</Text>
      ) : null}
      {actionLabel && onAction ? (
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={onAction}
          style={[styles.cta, { backgroundColor: hexAlpha(tone, '17') }]}
        >
          <Text style={[styles.ctaText, { color: tone }]}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
    gap: 8,
  },
  rootCompact: { paddingVertical: 20, paddingHorizontal: spacing.md, gap: 4 },
  emoji: { fontSize: 48, marginBottom: 4 },
  emojiCompact: { ...typography.h1, marginBottom: 0 },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  titleCompact: { ...typography.subhead, fontWeight: '600' },
  subtitle: {
    ...typography.subhead,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 2,
    maxWidth: 320,
  },
  cta: {
    marginTop: 16,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: radii.xl,
  },
  ctaText: { fontSize: 14, fontWeight: '700' },
});
