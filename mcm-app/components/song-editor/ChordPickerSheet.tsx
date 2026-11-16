/**
 * Elegir un acorde: los que ya usa la canción (lo normal es repetir) o
 * escribirlo. Se escribe como se quiera («Sol7», «lam», «G»): se guarda en
 * cifrado inglés, que es como está el cantoral.
 */
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PressableFeedback } from 'heroui-native';
import BottomSheet from '@/components/BottomSheet';
import AppPrimaryButton from '@/components/ui/AppPrimaryButton';
import AppTextField from '@/components/ui/AppTextField';
import { KeyPillColors, themeColors } from '@/constants/colors';
import spacing from '@/constants/spacing';
import typography from '@/constants/typography';
import { radii } from '@/constants/uiStyles';
import { useColorScheme } from '@/hooks/useColorScheme';
import { convertChord, type Notation } from '@/utils/chordNotation';
import { h } from '@/utils/haptics';
import { chordToEnglish } from '@/utils/songEditor';

interface Props {
  visible: boolean;
  onClose: () => void;
  /** Acordes de la canción (cifrado inglés). */
  used: string[];
  notation: Notation;
  /** Acorde que se está cambiando, si es un cambio. */
  current?: string;
  onPick: (chord: string) => void;
}

export default function ChordPickerSheet(props: Props) {
  return (
    <BottomSheet
      visible={props.visible}
      onClose={props.onClose}
      title={props.current ? 'Cambiar acorde' : 'Acorde'}
    >
      {props.visible ? <Body {...props} /> : null}
    </BottomSheet>
  );
}

function Body({ used, notation, current, onPick }: Props) {
  const isDark = useColorScheme() === 'dark';
  const theme = themeColors(isDark);
  const [typed, setTyped] = useState('');
  const custom = chordToEnglish(typed);

  return (
    <View style={styles.root}>
      {used.length > 0 && (
        <View style={styles.chips}>
          {used.map((chord) => {
            const on = chord === current;
            return (
              <PressableFeedback
                key={chord}
                onPress={() => {
                  h.select();
                  onPick(chord);
                }}
                style={[
                  styles.chip,
                  {
                    backgroundColor: on
                      ? theme.link
                      : isDark
                        ? KeyPillColors.bgDark
                        : KeyPillColors.bgLight,
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel={`Acorde ${convertChord(chord, notation)}`}
              >
                <Text
                  style={[
                    styles.chipText,
                    { color: on ? theme.background : theme.link },
                  ]}
                >
                  {convertChord(chord, notation)}
                </Text>
              </PressableFeedback>
            );
          })}
        </View>
      )}
      <View style={styles.typeRow}>
        <AppTextField
          value={typed}
          onChangeText={setTyped}
          placeholder={
            notation === 'ES' ? 'Otro: Sol7, lam, Fa#m…' : 'Otro: G7, Am, F#m…'
          }
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.input}
          accentColor={theme.link}
          returnKeyType="done"
          onSubmitEditing={() => custom && onPick(custom)}
          accessibilityLabel="Escribir otro acorde"
        />
        <AppPrimaryButton
          label="Poner"
          onPress={() => onPick(custom)}
          disabled={!custom}
          color={theme.link}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.md, paddingBottom: spacing.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    minWidth: 52,
    height: 44,
    paddingHorizontal: spacing.md - spacing.xs,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: { ...typography.title, fontWeight: '700' },
  typeRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  input: { flex: 1 },
});
