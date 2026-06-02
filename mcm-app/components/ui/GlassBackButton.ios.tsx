import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { PressableFeedback } from 'heroui-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useColorScheme } from '@/hooks/useColorScheme';
import { radii, shadows } from '@/constants/uiStyles';
import GlassSurface from './GlassSurface';

interface Props {
  /** Texto junto al chevron. Por defecto "Atrás". */
  label?: string;
}

/**
 * iOS-only: botón "Atrás" liquid-glass flotante usado como `headerLeft` de las
 * sub-pantallas de evento. Sustituye la antigua barra de color plana por un
 * pill de cristal desprendido que flota sobre el contenido (look iOS 18+).
 *
 * El color del icono/texto se adapta al esquema (claro/oscuro) porque el
 * cristal de fondo es `systemChromeMaterial` (sin tinte), que invierte solo.
 */
export default function GlassBackButton({ label = 'Atrás' }: Props) {
  const navigation = useNavigation();
  const scheme = useColorScheme();
  const fg = scheme === 'dark' ? '#FFFFFF' : '#1A1A1A';

  return (
    <View style={styles.shadowWrap}>
      <PressableFeedback
        onPress={() => {
          if (navigation.canGoBack()) navigation.goBack();
        }}
        style={styles.pill}
        accessibilityRole="button"
        accessibilityLabel={label}
        hitSlop={8}
      >
        <PressableFeedback.Scale />
        <GlassSurface variant="regular" style={styles.glass} />
        <MaterialIcons
          name="chevron-left"
          size={22}
          color={fg}
          style={styles.chevron}
        />
        <Text style={[styles.label, { color: fg }]}>{label}</Text>
      </PressableFeedback>
    </View>
  );
}

const styles = StyleSheet.create({
  // El shadow vive en un wrapper sin `overflow: hidden` para que la sombra no
  // se recorte; el clip del cristal lo hace el pill interior.
  shadowWrap: {
    borderRadius: radii.full,
    ...(shadows.md as ViewStyle),
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 38,
    paddingLeft: 6,
    paddingRight: 14,
    borderRadius: radii.full,
    overflow: 'hidden',
  },
  glass: {
    borderRadius: radii.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  chevron: { marginRight: -2 },
  label: { fontSize: 16, fontWeight: '600', marginLeft: 2 },
});
