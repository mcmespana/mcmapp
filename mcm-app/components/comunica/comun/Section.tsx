// Bloque de la portada: una etiqueta de sección (`stic-section-label` del
// plugin: mayúsculas pequeñas con tracking y un hairline detrás) y una
// superficie con filas separadas por un hairline (la lista agrupada de iOS).
// Una sola superficie: nada de tarjetas dentro de tarjetas.

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import typography from '@/constants/typography';
import CardSurface from './CardSurface';
import { useComunicaTheme } from './useComunicaTheme';

/**
 * La etiqueta de un bloque: mayúsculas pequeñas con tracking y un hairline que
 * ocupa el resto de la línea. Las mayúsculas las pone `textTransform`, NUNCA
 * `.toUpperCase()`: el texto sigue siendo «Tu perfil» para el lector de
 * pantalla y para los tests. `warning` mantiene la frase en caja normal y en
 * ámbar («Te faltan 2 listas» no se lee en mayúsculas).
 */
export function SectionLabel({
  children,
  warning,
}: {
  children: string;
  warning?: boolean;
}) {
  const t = useComunicaTheme();
  return (
    <View style={styles.labelRow}>
      <Text
        accessibilityRole="header"
        style={[
          styles.label,
          { color: warning ? t.warningText : t.textSecondary },
        ]}
      >
        {children}
      </Text>
      <View style={[styles.hairline, { backgroundColor: t.separator }]} />
    </View>
  );
}

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
      {title ? <SectionLabel warning={warning}>{title}</SectionLabel> : null}
      {bare ? (
        <View style={styles.bare}>{rows}</View>
      ) : (
        <CardSurface clip background={warning ? t.warningSoft : undefined}>
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
        </CardSurface>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 4,
  },
  label: { ...typography.sectionLabel },
  hairline: { flex: 1, height: StyleSheet.hairlineWidth },
  bare: { gap: 12 },
});
