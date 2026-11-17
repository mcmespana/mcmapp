/**
 * Un momento de la misa en «Cantos para el domingo»: su cabecera con
 * «Cambiar» y el menú, la canción propuesta con la fila de siempre del
 * cantoral y, en pequeño, por qué se propone.
 */
import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PressableFeedback } from 'heroui-native';
import ContextMenuSheet, {
  type ContextMenuAction,
} from '@/components/ContextMenuSheet';
import SongListItem from '@/components/SongListItem';
import SectionHeader from '@/components/ui/SectionHeader';
import { MaterialIcons } from '@/components/ui/icons';
import { themeColors } from '@/constants/colors';
import typography from '@/constants/typography';
import spacing from '@/constants/spacing';
import { radii } from '@/constants/uiStyles';
import { useColorScheme } from '@/hooks/useColorScheme';
import { h } from '@/utils/haptics';
import { candidateWhy, type MomentSuggestion } from '@/utils/sundaySongs';

/** Área táctil mínima (design.md §1). */
const TOUCH = 44;

type Song = React.ComponentProps<typeof SongListItem>['song'];

interface Props {
  suggestion: MomentSuggestion;
  isSelected: (filename: string) => boolean;
  selectedTranspose: (filename: string) => number;
  onOpenSong: (song: Song) => void;
  onAddSong: (filename: string) => void;
  onRemoveSong: (filename: string) => void;
  onChange: () => void;
  onChooseOther: () => void;
  onRemove: () => void;
  onRestore: () => void;
}

function IconButton({
  icon,
  label,
  onPress,
  color,
}: {
  icon: keyof typeof MaterialIcons.glyphMap;
  label: string;
  onPress: () => void;
  color: string;
}) {
  return (
    <PressableFeedback
      onPress={() => {
        h.select();
        onPress();
      }}
      style={styles.iconButton}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <MaterialIcons name={icon} size={22} color={color} />
    </PressableFeedback>
  );
}

function MomentBlock({
  suggestion,
  isSelected,
  selectedTranspose,
  onOpenSong,
  onAddSong,
  onRemoveSong,
  onChange,
  onChooseOther,
  onRemove,
  onRestore,
}: Props) {
  const isDark = useColorScheme() === 'dark';
  const roles = themeColors(isDark);
  const [menu, setMenu] = useState(false);
  const { label, candidates, chosenIndex, removed, emptyReason } = suggestion;
  const chosen = chosenIndex >= 0 ? candidates[chosenIndex] : undefined;
  const canChange = candidates.length > 1;
  const lower = label.toLowerCase();

  const actions = useMemo<ContextMenuAction[]>(
    () => [
      ...(canChange
        ? [
            {
              key: 'change',
              label: 'Cambiar por la siguiente',
              icon: 'refresh' as const,
              onPress: onChange,
            },
          ]
        : []),
      ...(candidates.length > 0
        ? [
            {
              key: 'other',
              label: 'Elegir otra…',
              icon: 'list' as const,
              onPress: onChooseOther,
            },
          ]
        : []),
      removed
        ? {
            key: 'restore',
            label: 'Volver a poner',
            icon: 'undo' as const,
            onPress: onRestore,
          }
        : {
            key: 'remove',
            label: 'Quitar de la misa',
            icon: 'remove-circle-outline' as const,
            onPress: onRemove,
            destructive: true,
          },
    ],
    [
      canChange,
      candidates.length,
      removed,
      onChange,
      onChooseOther,
      onRemove,
      onRestore,
    ],
  );

  return (
    <View style={styles.block}>
      <View style={styles.header}>
        <SectionHeader
          label={label}
          style={styles.sectionHeader}
          accentColor={roles.textSecondary}
        />
        {chosen && canChange ? (
          <IconButton
            icon="refresh"
            label={`Cambiar el canto de ${lower}`}
            onPress={onChange}
            color={roles.link}
          />
        ) : null}
        {candidates.length > 0 || removed ? (
          <IconButton
            icon="more-horiz"
            label={`Más opciones de ${lower}`}
            onPress={() => setMenu(true)}
            color={roles.link}
          />
        ) : null}
      </View>

      {chosen ? (
        <>
          <View
            style={[styles.card, { backgroundColor: roles.background }]}
            accessibilityLabel={`${label}: ${chosen.title.replace(/^\d+\.\s*/, '')}`}
          >
            <SongListItem
              song={{ ...chosen.song, filename: chosen.filename }}
              onPress={onOpenSong}
              onLongPress={() => setMenu(true)}
              isSelected={isSelected(chosen.filename)}
              selectedTranspose={selectedTranspose(chosen.filename)}
              onAddSong={onAddSong}
              onRemoveSong={onRemoveSong}
              hideSeparator
            />
          </View>
          {candidateWhy(chosen) ? (
            <Text style={[styles.note, { color: roles.textMuted }]}>
              {candidateWhy(chosen)}
            </Text>
          ) : null}
        </>
      ) : removed ? (
        <View style={styles.removed}>
          <Text style={[typography.body, { color: roles.textSecondary }]}>
            Sin canto de {lower}
          </Text>
          <PressableFeedback
            onPress={() => {
              h.select();
              onRestore();
            }}
            style={styles.textButton}
            accessibilityRole="button"
            accessibilityLabel={`Volver a poner el canto de ${lower}`}
          >
            <Text style={[typography.button, { color: roles.link }]}>
              Volver a poner
            </Text>
          </PressableFeedback>
        </View>
      ) : (
        <Text style={[styles.empty, { color: roles.textSecondary }]}>
          {emptyReason}
        </Text>
      )}

      <ContextMenuSheet
        visible={menu}
        onClose={() => setMenu(false)}
        title={label}
        actions={actions}
      />
    </View>
  );
}

export default React.memo(MomentBlock);

const styles = StyleSheet.create({
  block: { marginTop: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center' },
  sectionHeader: {
    flex: 1,
    paddingHorizontal: 0,
    marginTop: 0,
    marginBottom: 0,
  },
  iconButton: {
    width: TOUCH,
    height: TOUCH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: { borderRadius: radii.lg, overflow: 'hidden' },
  note: { ...typography.caption, marginTop: spacing.xs },
  removed: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: TOUCH,
  },
  textButton: {
    minHeight: TOUCH,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  empty: { ...typography.body, paddingVertical: spacing.sm },
});
