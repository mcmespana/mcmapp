import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { PressableFeedback } from 'heroui-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useColorScheme } from '@/hooks/useColorScheme';
import { shadows } from '@/constants/uiStyles';
import GlassSurface from './GlassSurface';

const SIZE = 38;

/**
 * Botón "Atrás" liquid-glass flotante usado como `headerLeft` de las
 * sub-pantallas de evento. Solo el chevron (sin texto "Atrás"), circular y
 * discreto, sobre header transparente — look iOS 18+. `GlassSurface` resuelve
 * el cristal real en iOS, backdrop-filter en web y superficie tintada en
 * Android, así que funciona en todas las plataformas.
 */
export default function GlassBackButton() {
  const navigation = useNavigation();
  const scheme = useColorScheme();
  const fg = scheme === 'dark' ? '#FFFFFF' : '#1A1A1A';

  return (
    <View style={styles.shadow}>
      <PressableFeedback
        onPress={() => {
          if (navigation.canGoBack()) navigation.goBack();
        }}
        style={styles.btn}
        accessibilityRole="button"
        accessibilityLabel="Atrás"
        hitSlop={10}
      >
        <PressableFeedback.Scale />
        <GlassSurface variant="regular" style={styles.glass} />
        <MaterialIcons
          name="chevron-left"
          size={24}
          color={fg}
          style={styles.chevron}
        />
      </PressableFeedback>
    </View>
  );
}

const styles = StyleSheet.create({
  shadow: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    ...(shadows.sm as ViewStyle),
  },
  btn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: SIZE / 2,
    overflow: 'hidden',
  },
  glass: {
    borderRadius: SIZE / 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.22)',
  },
  chevron: { marginLeft: -1 },
});
