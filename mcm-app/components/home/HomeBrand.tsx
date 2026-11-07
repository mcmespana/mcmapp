import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { themeColors } from '@/constants/colors';
import spacing from '@/constants/spacing';
import typography from '@/constants/typography';
import HomeLogo from '@/components/home/HomeLogo';
import { CHROME_MAX_FONT_SCALE } from '@/hooks/useLargeText';

/**
 * Lo que va a la izquierda de la cabecera de Inicio: la «M» de MCM y el nombre
 * de la app. En iOS se mete en un `Stack.Toolbar.View` sin cápsula; en Android
 * y web, en `headerLeft`.
 */
export default function HomeBrand({
  carismoActive,
  isDark,
  onCarismoPress,
}: {
  carismoActive: boolean;
  isDark: boolean;
  onCarismoPress: () => void;
}) {
  const roles = themeColors(isDark);
  return (
    <View style={styles.row}>
      <HomeLogo
        carismoActive={carismoActive}
        isDark={isDark}
        onCarismoPress={onCarismoPress}
      />
      {/* Va en la barra nativa, de altura fija: sin techo, con la letra del
          sistema al ×2 el título (28 pt) se iba a 56 pt y no cabía. */}
      <Text
        style={[styles.title, { color: roles.text }]}
        numberOfLines={1}
        maxFontSizeMultiplier={CHROME_MAX_FONT_SCALE}
      >
        MCM App
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { ...typography.h1, fontWeight: '800', letterSpacing: -0.8 },
});
