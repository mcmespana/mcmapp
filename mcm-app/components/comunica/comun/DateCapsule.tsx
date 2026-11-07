// Cápsula de fecha del área privada: día grande y mes en tres letras
// (`.stic-rec-badge` del plugin). Va en la tarjeta de registro y en las filas de
// «Te faltan N listas».
//
// Tres tonos:
//   · `brand` (por defecto): la MARCA de degradado del plugin, para fechas de
//     hoy y futuras.
//   · `neutral`: fondo hundido y tinta normal, para fechas pasadas (el
//     `.is-past` del plugin) y listas largas, donde no se pinta degradado.
//   · `onGradient`: la que va dentro de un bloque de marca (tarjeta destacada):
//     velo oscuro y texto blanco, nunca marca sobre marca.
//
// Variantes de contenido, como en el plugin: `kind` (un texto corto tipo
// «PDF») o `icon` en lugar de día y mes. Sin fecha no hay etiqueta de voz
// propia: se pasa `accessibilityLabel`.

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { radii } from '@/constants/uiStyles';
import typography from '@/constants/typography';
import { capsule, longDay } from '@/utils/comunica/dates';
import BrandGradient from './BrandGradient';
import { useComunicaTheme } from './useComunicaTheme';

type IconName = React.ComponentProps<typeof IconSymbol>['name'];

interface Props {
  /** `YYYY-MM-DD`. Con `kind` o `icon` puede faltar. */
  day?: string;
  tone?: 'brand' | 'neutral' | 'onGradient';
  /** Texto corto en lugar del día («PDF»). */
  kind?: string;
  /** Icono en lugar del día. */
  icon?: IconName;
  /** Etiqueta de voz si no hay `day` (con `day` es la fecha larga). */
  accessibilityLabel?: string;
}

export default function DateCapsule({
  day,
  tone = 'brand',
  kind,
  icon,
  accessibilityLabel,
}: Props) {
  const t = useComunicaTheme();
  const c = day ? capsule(day) : null;
  const brand = tone === 'brand';
  const ink = tone === 'neutral' ? t.text : t.onGradient;
  const inkSoft = tone === 'neutral' ? t.textSecondary : t.onGradient;
  const background =
    tone === 'neutral'
      ? t.backgroundSunken
      : tone === 'onGradient'
        ? t.gradientOverlay
        : undefined;
  return (
    <View
      accessible
      accessibilityLabel={accessibilityLabel ?? (day ? longDay(day) : kind)}
      style={[styles.box, background ? { backgroundColor: background } : null]}
    >
      {brand ? <BrandGradient variant="mark" /> : null}
      {icon ? (
        <IconSymbol name={icon} size={22} color={ink} />
      ) : kind ? (
        <Text style={[styles.kind, { color: ink }]} maxFontSizeMultiplier={1.3}>
          {kind}
        </Text>
      ) : c ? (
        <>
          <Text
            style={[styles.day, { color: ink }]}
            maxFontSizeMultiplier={1.3}
          >
            {c.day}
          </Text>
          <Text
            style={[styles.month, { color: inkSoft }]}
            maxFontSizeMultiplier={1.3}
          >
            {c.month}
          </Text>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    width: 52,
    minHeight: 52,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    overflow: 'hidden',
  },
  // `lineHeight` holgado: en Android un 22/800 con el justo se recorta.
  day: { ...typography.h2, fontWeight: '800', lineHeight: 28 },
  month: { ...typography.overline, fontWeight: '700', lineHeight: 14 },
  kind: { ...typography.caption, fontWeight: '800', lineHeight: 18 },
});
