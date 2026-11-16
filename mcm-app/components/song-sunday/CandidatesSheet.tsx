/**
 * «Elegir otra…»: la lista completa de candidatas de un momento de la misa,
 * por orden de ranking y con la razón en pequeño («Cuaresma», «Jesucristo, Rey
 * del Universo»). Un toque la pone en la misa.
 */
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { PressableFeedback } from 'heroui-native';
import BottomSheet from '@/components/BottomSheet';
import EmptyState from '@/components/ui/EmptyState';
import { MaterialIcons } from '@/components/ui/icons';
import { themeColors } from '@/constants/colors';
import typography from '@/constants/typography';
import spacing from '@/constants/spacing';
import { radii } from '@/constants/uiStyles';
import { useColorScheme } from '@/hooks/useColorScheme';
import { h } from '@/utils/haptics';
import type { MomentSuggestion } from '@/utils/sundaySongs';

/** Alto máximo de la lista dentro de la hoja. */
const LIST_MAX_HEIGHT = 420;

interface Props {
  suggestion: MomentSuggestion | null;
  onClose: () => void;
  onPick: (moment: MomentSuggestion['moment'], filename: string) => void;
}

export default function CandidatesSheet({
  suggestion,
  onClose,
  onPick,
}: Props) {
  const isDark = useColorScheme() === 'dark';
  const roles = themeColors(isDark);
  const pending = React.useRef<(() => void) | null>(null);

  return (
    <BottomSheet
      visible={!!suggestion}
      onClose={onClose}
      onCloseComplete={() => {
        const fn = pending.current;
        pending.current = null;
        fn?.();
      }}
      title={suggestion ? `Elegir: ${suggestion.label}` : undefined}
    >
      {suggestion && suggestion.candidates.length === 0 ? (
        <EmptyState
          compact
          title={suggestion.emptyReason ?? 'No hay canciones'}
        />
      ) : (
        <ScrollView
          style={styles.list}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
        >
          {suggestion?.candidates.map((c, i) => {
            const isChosen = i === suggestion.chosenIndex;
            const title = c.title.replace(/^\d+\.\s*/, '');
            return (
              <PressableFeedback
                key={c.filename}
                style={[styles.row, { backgroundColor: roles.background }]}
                accessibilityRole="button"
                accessibilityState={{ selected: isChosen }}
                accessibilityLabel={`${title}${
                  c.reasons.length ? `, ${c.reasons.join(', ')}` : ''
                }${isChosen ? ', elegida' : ''}`}
                onPress={() => {
                  h.select();
                  pending.current = () => onPick(suggestion.moment, c.filename);
                  onClose();
                }}
              >
                <View style={styles.text}>
                  <Text
                    style={[typography.body, { color: roles.text }]}
                    numberOfLines={2}
                  >
                    {title}
                  </Text>
                  {c.reasons.length > 0 || c.song.author ? (
                    <Text
                      style={[typography.caption, { color: roles.textMuted }]}
                      numberOfLines={1}
                    >
                      {[...c.reasons, c.song.author]
                        .filter(Boolean)
                        .join(' · ')}
                    </Text>
                  ) : null}
                </View>
                {isChosen ? (
                  <MaterialIcons name="check" size={22} color={roles.link} />
                ) : null}
              </PressableFeedback>
            );
          })}
        </ScrollView>
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  list: { maxHeight: LIST_MAX_HEIGHT },
  content: { gap: spacing.sm, paddingBottom: spacing.lg },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 44,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
  },
  text: { flex: 1, gap: 2 },
});
