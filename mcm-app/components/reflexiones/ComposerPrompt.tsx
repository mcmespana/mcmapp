/**
 * La invitación a escribir, arriba del muro: tu avatar, un «campo» que en
 * realidad es un botón (abre el compositor a pantalla completa) y los
 * arranques —«Me llevo…», «Doy gracias por…»— para quien no sabe por dónde
 * empezar. El mismo patrón que el «¿Qué estás pensando?» de cualquier red:
 * se entiende sin explicarlo.
 */
import React from 'react';
import { ScrollView, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { MaterialIcons } from '@/components/ui/icons';
import PressableScale from '@/components/ui/PressableScale';
import { AuthorAvatar } from '@/components/reflexiones/Avatars';
import { themeColors } from '@/constants/colors';
import spacing from '@/constants/spacing';
import typography from '@/constants/typography';
import { radii, shadows } from '@/constants/uiStyles';
import { hexAlpha, onColor, readableOn } from '@/utils/colorUtils';
import { REFLEXION_SEEDS } from '@/utils/reflexiones';

interface Props {
  /** Firma por defecto (del perfil). */
  author: string;
  tint: string;
  isDark: boolean;
  onOpen: (seed?: string) => void;
}

export default function ComposerPrompt({
  author,
  tint,
  isDark,
  onOpen,
}: Props) {
  const roles = themeColors(isDark);
  const ink = readableOn(tint, roles.background, 3);
  // Sin el nombre: con él no cabía en un móvil normal, y ya lo dice el avatar.
  const prompt = '¿Qué te llevas de hoy?';

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: roles.background },
        shadows.card as ViewStyle,
      ]}
    >
      <View style={styles.row}>
        <AuthorAvatar name={author} color={tint} size={40} />
        <PressableScale
          onPress={() => onOpen()}
          style={[styles.field, { backgroundColor: roles.backgroundSunken }]}
          accessibilityRole="button"
          accessibilityLabel={`${prompt} Escribir una reflexión`}
        >
          <Text
            style={[styles.placeholder, { color: roles.textMuted }]}
            numberOfLines={1}
          >
            {prompt}
          </Text>
          <View style={[styles.pen, { backgroundColor: tint }]}>
            <MaterialIcons name="edit" size={16} color={onColor(tint)} />
          </View>
        </PressableScale>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.seeds}
        keyboardShouldPersistTaps="handled"
      >
        {REFLEXION_SEEDS.map((seed) => (
          <PressableScale
            key={seed}
            onPress={() => onOpen(seed)}
            style={[
              styles.seed,
              {
                borderColor: hexAlpha(ink, '40'),
                backgroundColor: hexAlpha(tint, '12'),
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel={`Empezar con: ${seed.trim()}`}
          >
            <Text style={[styles.seedText, { color: ink }]}>{seed.trim()}</Text>
          </PressableScale>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm + spacing.xs,
    gap: spacing.sm + spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  field: {
    flex: 1,
    minHeight: 44,
    borderRadius: radii.full,
    paddingLeft: spacing.md,
    paddingRight: spacing.xs + 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  placeholder: { ...typography.body, flex: 1 },
  pen: {
    width: 32,
    height: 32,
    borderRadius: radii.pillFull,
    alignItems: 'center',
    justifyContent: 'center',
  },
  seeds: {
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  seed: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm + spacing.xs,
    borderRadius: radii.full,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  seedText: { ...typography.subhead, fontWeight: '600' },
});
