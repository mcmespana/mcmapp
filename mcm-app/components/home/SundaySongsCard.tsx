/**
 * «Cantos para el domingo» en Inicio, de viernes a domingo: una tarjeta que
 * abre la pantalla del cantoral con el domingo que toca y su fiesta o tiempo.
 * Solo con el tab del cantoral en el perfil y con el id `cantos-domingo` en los
 * `homeButtons` del perfil (así se apaga por perfil desde `/profileConfig`).
 *
 * Es un componente aparte para que `app/(tabs)/(inicio)/index.tsx` solo lo
 * monte. La regla de cuándo sale es una función pura (`shouldShowSundayCard`).
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PressableFeedback } from 'heroui-native';
import { MaterialIcons } from '@/components/ui/icons';
import { TabHeaderColors, themeColors } from '@/constants/colors';
import spacing from '@/constants/spacing';
import typography from '@/constants/typography';
import { radii, shadows } from '@/constants/uiStyles';
import { useColorScheme } from '@/hooks/useColorScheme';
import useLargeText from '@/hooks/useLargeText';
import { useResolvedProfileConfig } from '@/hooks/useResolvedProfileConfig';
import { openCantoral } from '@/utils/cantoralNavigation';
import { h } from '@/utils/haptics';
import {
  isoDateLocal,
  liturgicalDayOf,
  shortDateEs,
  targetSunday,
} from '@/utils/liturgicalDay';
import { shouldShowSundayCard } from '@/utils/sundaySongs';
import { tintedGlyph } from '@/utils/tintColors';

/** Id del perfil (`homeButtons`) que enciende la tarjeta. */
export const SUNDAY_CARD_ID = 'cantos-domingo';

/** Opacidad de la pastilla del icono (el color de la pestaña del cantoral). */
const FILL_LIGHT = '1F';
const FILL_DARK = '33';
/** Lado de la pastilla del icono. */
const ICON_BOX = 44;

export default function SundaySongsCard() {
  const isDark = useColorScheme() === 'dark';
  const roles = themeColors(isDark);
  const large = useLargeText();
  const resolved = useResolvedProfileConfig();

  const hoy = isoDateLocal();
  if (
    !resolved.homeButtons.includes(SUNDAY_CARD_ID) ||
    !shouldShowSundayCard(hoy, resolved.tabs)
  ) {
    return null;
  }

  const fecha = targetSunday(hoy);
  const day = liturgicalDayOf(fecha);
  const what = day.feastName ?? day.name;
  const icon = tintedGlyph(
    TabHeaderColors.cancionero,
    roles.background,
    isDark ? FILL_DARK : FILL_LIGHT,
  );

  return (
    <PressableFeedback
      onPress={() => {
        h.tap();
        openCantoral('SundaySongs', { fecha }, { fromOutside: true });
      }}
      style={[styles.card, { backgroundColor: roles.card }]}
      accessibilityRole="button"
      accessibilityLabel={`Cantos para el domingo, ${shortDateEs(fecha)}, ${what}`}
    >
      <View style={[styles.iconBox, { backgroundColor: icon.fill }]}>
        <MaterialIcons name="event" size={24} color={icon.glyph} />
      </View>
      <View style={styles.text}>
        <Text
          style={[typography.title, { color: roles.text }]}
          numberOfLines={large ? 3 : 1}
        >
          Cantos para el domingo
        </Text>
        <Text
          style={[typography.subhead, { color: roles.textSecondary }]}
          numberOfLines={large ? 3 : 2}
        >
          {shortDateEs(fecha)} · {what}
        </Text>
      </View>
      <MaterialIcons name="chevron-right" size={22} color={roles.link} />
    </PressableFeedback>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderRadius: radii.lg,
    ...shadows.card,
  },
  iconBox: {
    width: ICON_BOX,
    height: ICON_BOX,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1, gap: spacing.xs },
});
