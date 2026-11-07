import { Pressable, StyleSheet, Text, View } from 'react-native';
import { radii } from '@/constants/uiStyles';
import { Colors } from '@/constants/colors';
import { hexAlpha } from '@/utils/colorUtils';
import { h } from '@/utils/haptics';

/**
 * Escala numérica seleccionable (p. ej. NPS 0..10) con etiquetas de extremos.
 * Extraído de EvaluationWizard.
 */
export default function ScaleInput({
  min,
  max,
  minLabel,
  maxLabel,
  value,
  onChange,
  accent,
  theme,
}: {
  min: number;
  max: number;
  minLabel?: string;
  maxLabel?: string;
  value: number | null;
  onChange: (n: number) => void;
  accent: string;
  theme: (typeof Colors)['light'];
}) {
  const steps = [];
  for (let i = min; i <= max; i++) steps.push(i);
  return (
    <View>
      <View style={scaleStyles.row}>
        {steps.map((n) => {
          const selected = value === n;
          return (
            <Pressable
              key={n}
              onPress={() => {
                h.select();
                onChange(n);
              }}
              style={[
                scaleStyles.cell,
                {
                  borderColor: selected ? accent : hexAlpha(theme.icon, '30'),
                  backgroundColor: selected ? accent : 'transparent',
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel={`${n}`}
            >
              <Text
                style={[
                  scaleStyles.cellText,
                  { color: selected ? '#fff' : theme.text },
                ]}
              >
                {n}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {(minLabel || maxLabel) && (
        <View style={scaleStyles.labels}>
          <Text style={[scaleStyles.labelText, { color: theme.icon }]}>
            {minLabel ?? ''}
          </Text>
          <Text style={[scaleStyles.labelText, { color: theme.icon }]}>
            {maxLabel ?? ''}
          </Text>
        </View>
      )}
    </View>
  );
}

const scaleStyles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cell: {
    minWidth: 44,
    height: 44,
    paddingHorizontal: 6,
    borderRadius: radii.md,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellText: { fontSize: 16, fontWeight: '700' },
  labels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  labelText: { fontSize: 12, fontWeight: '600', maxWidth: '45%' },
});
