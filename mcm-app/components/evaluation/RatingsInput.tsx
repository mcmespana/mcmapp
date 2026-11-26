import { StyleSheet, Text, View } from 'react-native';
import StarRating from '@/components/StarRating';
import { Colors } from '@/constants/colors';
import type { EvalOption } from '@/constants/evaluation';

/**
 * Varias valoraciones de 1 a 5 estrellas en una misma pantalla (aspectos
 * prácticos: lugar, comidas, ambiente…). Una fila por elemento de `items`;
 * `value` es el objeto `{ [item.value]: 1..5 }`.
 */
export default function RatingsInput({
  items,
  value,
  onChange,
  starColor,
  theme,
}: {
  items: EvalOption[];
  value: Record<string, number> | undefined;
  onChange: (itemId: string, n: number) => void;
  starColor: string;
  theme: (typeof Colors)['light'];
}) {
  return (
    <View>
      {items.map((item) => (
        <View key={item.value} style={styles.row}>
          <Text style={[styles.label, { color: theme.text }]}>
            {item.label}
          </Text>
          <StarRating
            value={value?.[item.value] ?? 0}
            onChange={(n) => onChange(item.value, n)}
            color={starColor}
            size={34}
          />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { marginBottom: 20, alignItems: 'flex-start' },
  label: { fontSize: 16, fontWeight: '600', marginBottom: 8 },
});
