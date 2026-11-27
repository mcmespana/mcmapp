/**
 * Avatares de Compartiendo: un círculo con las iniciales de la firma, del
 * color de su tarjeta, y la pila de avatares solapados que dice «esta gente
 * ya ha escrito» (en el escenario del muro y en la tarjeta del hub).
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@/components/ui/icons';
import typography from '@/constants/typography';
import { radii } from '@/constants/uiStyles';
import { onColor } from '@/utils/colorUtils';
import { initialsOf } from '@/utils/reflexiones';

interface AvatarProps {
  /** Firma tal cual (`Nombre · Delegación`). Sin firma, un icono. */
  name?: string;
  /** Relleno del círculo. */
  color: string;
  /** Tinta de las iniciales. Por defecto, la que más contrasta. */
  ink?: string;
  size?: number;
  /** Aro alrededor (del color del fondo) para cuando se solapan. */
  ring?: string;
}

export function AuthorAvatar({
  name,
  color,
  ink,
  size = 36,
  ring,
}: AvatarProps) {
  const initials = initialsOf(name);
  const fg = ink ?? onColor(color);
  const text =
    size >= 40
      ? typography.subhead
      : size >= 30
        ? typography.footnote
        : typography.micro;
  return (
    <View
      style={[
        styles.avatar,
        { width: size, height: size, backgroundColor: color },
        ring ? { borderWidth: 2, borderColor: ring } : null,
      ]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {initials ? (
        <Text
          style={[text, styles.initials, { color: fg }]}
          maxFontSizeMultiplier={1.2}
        >
          {initials}
        </Text>
      ) : (
        <MaterialIcons
          name="favorite"
          size={Math.round(size * 0.42)}
          color={fg}
        />
      )}
    </View>
  );
}

interface StackProps {
  /** Firmas, de la más reciente a la más antigua. */
  names: string[];
  /** Color de cada avatar (mismo orden que `names`). */
  colorFor: (name: string, index: number) => string;
  /** Cuántos se ven antes del «+N». */
  max?: number;
  size?: number;
  /** Color del aro: el del fondo sobre el que va la pila. */
  ring: string;
  /** Total real de personas (para el «+N»). Por defecto, `names.length`. */
  total?: number;
  /** Relleno y tinta del «+N». */
  moreColor: string;
  moreInk: string;
}

export function AvatarStack({
  names,
  colorFor,
  max = 4,
  size = 32,
  ring,
  total,
  moreColor,
  moreInk,
}: StackProps) {
  const shown = names.slice(0, max);
  const rest = (total ?? names.length) - shown.length;
  if (shown.length === 0) return null;
  return (
    <View
      style={styles.stack}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {shown.map((n, i) => (
        <View
          key={`${n}-${i}`}
          style={[i > 0 && { marginLeft: -size * 0.3 }, { zIndex: max - i }]}
        >
          <AuthorAvatar
            name={n}
            color={colorFor(n, i)}
            size={size}
            ring={ring}
          />
        </View>
      ))}
      {rest > 0 ? (
        <View
          style={[
            styles.avatar,
            styles.more,
            {
              width: size,
              height: size,
              marginLeft: -size * 0.3,
              backgroundColor: moreColor,
              borderColor: ring,
            },
          ]}
        >
          <Text
            style={[typography.micro, styles.initials, { color: moreInk }]}
            maxFontSizeMultiplier={1.2}
          >
            +{rest > 99 ? 99 : rest}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    borderRadius: radii.pillFull,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  initials: { fontWeight: '700', letterSpacing: 0.2 },
  stack: { flexDirection: 'row', alignItems: 'center' },
  more: { borderWidth: 2 },
});
