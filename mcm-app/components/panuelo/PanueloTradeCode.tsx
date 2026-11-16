import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { themeColors } from '@/constants/colors';
import spacing from '@/constants/spacing';
import typography from '@/constants/typography';
import { radii } from '@/constants/uiStyles';

/** Lado del QR: se lee a un metro y cabe en un móvil pequeño. */
const QR_SIZE = 180;

/** El enlace del QR: la cámara del sistema abre la app en la hoja. */
export function tradeLink(code: string): string {
  return `mcmapp://panuelo?intercambio=${code}`;
}

/** «K7WQ4M» → «K7W Q4M»: dos grupos de tres, para dictarlo. */
export function groupTradeCode(code: string): string {
  return `${code.slice(0, 3)} ${code.slice(3)}`;
}

type Props = {
  code: string;
  isDark: boolean;
};

/**
 * El código de un intercambio en grande y su QR. La receta visual es la de
 * `ShareQrModal` (marco blanco siempre: los lectores de QR necesitan
 * contraste), sin su `Modal`: esto vive dentro de la hoja.
 */
export function PanueloTradeCode({ code, isDark }: Props) {
  const t = themeColors(isDark);
  return (
    <View style={styles.root}>
      <Text
        style={[styles.code, { color: t.link }]}
        // Carácter a carácter: «K 7 W Q 4 M» se dicta, no se lee como palabra.
        accessibilityLabel={`Código: ${code.split('').join(', ')}`}
        selectable
      >
        {groupTradeCode(code)}
      </Text>
      <View
        style={styles.qrWrap}
        accessible
        accessibilityRole="image"
        accessibilityLabel="Código QR del intercambio. La otra persona lo puede escanear con la cámara."
      >
        <QRCode value={tradeLink(code)} size={QR_SIZE} backgroundColor="#fff" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    gap: spacing.md,
  },
  code: {
    ...typography.h0,
    letterSpacing: spacing.xs,
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
  },
  qrWrap: {
    backgroundColor: '#fff',
    padding: spacing.sm + spacing.xs,
    borderRadius: radii.lg,
  },
});
