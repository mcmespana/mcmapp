// Bloque de la portada: un título pequeño y una superficie con filas
// separadas por un hairline (la lista agrupada de iOS). Una sola superficie:
// nada de tarjetas dentro de tarjetas.

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { radii, shadows } from '@/constants/uiStyles';
import typography from '@/constants/typography';
import { useComunicaTheme } from './useComunicaTheme';

interface Props {
  title?: string;
  /** Título en ámbar («Te faltan 2 listas»). */
  warning?: boolean;
  children: React.ReactNode;
  /** Sin superficie: el contenido va suelto (una `RecordCard`). */
  bare?: boolean;
}

export default function Section({ title, warning, children, bare }: Props) {
  const t = useComunicaTheme();
  const rows = React.Children.toArray(children).filter(Boolean);
  return (
    <View style={styles.wrap}>
      {title ? (
        <Text
          accessibilityRole="header"
          style={[
            styles.title,
            { color: warning ? t.warningText : t.textSecondary },
          ]}
        >
          {title}
        </Text>
      ) : null}
      {bare ? (
        <View style={styles.bare}>{rows}</View>
      ) : (
        <View
          style={[
            styles.surface,
            shadows.card,
            {
              backgroundColor: warning ? t.warningSoft : t.card,
            },
          ]}
        >
          {rows.map((row, i) => (
            // La key del HIJO (la que le dio quien llama, vía `toArray`), no
            // el índice: al filtrar, las filas se quedan montadas y las fotos
            // no parpadean.
            <View
              key={React.isValidElement(row) && row.key != null ? row.key : i}
              style={
                i > 0
                  ? {
                      borderTopWidth: StyleSheet.hairlineWidth,
                      borderTopColor: t.separator,
                    }
                  : undefined
              }
            >
              {row}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  title: { ...typography.subhead, fontWeight: '600', paddingHorizontal: 4 },
  surface: { borderRadius: radii.lg, overflow: 'hidden' },
  bare: { gap: 12 },
});
