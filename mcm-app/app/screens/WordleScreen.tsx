import React, { useMemo, useState, useLayoutEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { IconButton } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { JubileoStackParamList } from '../(tabs)/jubileo';
import colors, { Colors } from '@/constants/colors';
import spacing from '@/constants/spacing';
import { useColorScheme } from '@/hooks/useColorScheme';
import BottomSheet from '@/components/BottomSheet';
import ConfettiCannon from 'react-native-confetti-cannon';
import useWordleGame from '@/hooks/useWordleGame';
import dailyWords from '@/assets/wordle-daily.json';
import validWords from '@/assets/wordle-valid.json';

const QWERTY = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', 'Ñ'],
  ['Z', 'X', 'C', 'V', 'B', 'N', 'M'],
];

const FALLBACK = ['ROMAN', 'AMIGO', 'JOVEN', 'SALVE', 'MARIA'];

export default function WordleScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<JubileoStackParamList>>();
  const scheme = useColorScheme();
  const theme = Colors[scheme];
  const styles = useMemo(() => createStyles(theme), [theme]);

  const todayKey = new Date().toISOString().slice(0, 10);
  const hash = todayKey.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const target = (dailyWords as Record<string, string>)[todayKey] ||
    FALLBACK[hash % FALLBACK.length];

  const {
    guesses,
    currentGuess,
    addLetter,
    removeLetter,
    submitGuess,
    status,
    keyboard,
    shareResult,
  } = useWordleGame(target, validWords as string[]);

  const [showInfo, setShowInfo] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: 'Wordle Jubileo',
      headerRight: () => (
        <View style={{ flexDirection: 'row' }}>
          <IconButton
            icon="information-outline"
            iconColor="#fff"
            onPress={() => setShowInfo(true)}
          />
          <IconButton icon="poll" disabled onPress={() => {}} iconColor="#fff" />
        </View>
      ),
    });
  }, [navigation]);

  const handleKey = (k: string) => {
    if (k === 'ENTER') {
      const res = submitGuess();
      if (res === 'not-enough') alert('No hay suficientes letras');
      else if (res === 'invalid') alert('Palabra no válida');
    } else if (k === 'DEL') {
      removeLetter();
    } else {
      addLetter(k);
    }
  };

  const renderCell = (letter: string, state?: string) => {
    let backgroundColor = theme.background;
    let borderColor = theme.icon;
    if (state === 'correct') backgroundColor = '#6aaa64';
    else if (state === 'present') backgroundColor = '#c9b458';
    else if (state === 'absent') backgroundColor = '#787c7e';
    return (
      <View style={[styles.cell, { backgroundColor, borderColor }]}> 
        <Text style={styles.cellText}>{letter}</Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {guesses.map((g, idx) => (
        <View key={idx} style={styles.row}>
          {g.letters.map((l, i) => renderCell(l.letter, l.state))}
        </View>
      ))}
      {status === 'playing' && (
        <View style={styles.row}>
          {[...currentGuess.padEnd(5)].map((ch, i) => renderCell(ch))}
        </View>
      )}
      {Array.from({ length: 6 - guesses.length - (status === 'playing' ? 1 : 0) }).map((_, idx) => (
        <View key={`empty-${idx}`} style={styles.row}>
          {Array.from({ length: 5 }).map((_, i) => renderCell(''))}
        </View>
      ))}

      <View style={styles.keyboard}>
        {QWERTY.map((row, idx) => (
          <View key={idx} style={styles.kbRow}>
            {row.map((k) => (
              <TouchableOpacity
                key={k}
                style={[
                  styles.key,
                  keyboard[k] === 'correct'
                    ? { backgroundColor: '#6aaa64' }
                    : keyboard[k] === 'present'
                    ? { backgroundColor: '#c9b458' }
                    : keyboard[k] === 'absent'
                    ? { backgroundColor: '#787c7e' }
                    : {},
                ]}
                onPress={() => handleKey(k)}
              >
                <Text style={styles.keyText}>{k}</Text>
              </TouchableOpacity>
            ))}
            {idx === 2 && (
              <>
                <TouchableOpacity style={[styles.key, styles.specialKey]} onPress={() => handleKey('DEL')}>
                  <Text style={styles.keyText}>⌫</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.key, styles.specialKey]} onPress={() => handleKey('ENTER')}>
                  <Text style={styles.keyText}>ENVIAR</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        ))}
      </View>

      <BottomSheet visible={showInfo} onClose={() => setShowInfo(false)}>
        <Text style={styles.infoTitle}>¿Cómo jugar?</Text>
        <Text style={styles.infoText}>Adivina la palabra de 5 letras en 6 intentos. Cada letra cambia de color:</Text>
        <View style={{ flexDirection: 'row', marginVertical: 8 }}>
          {renderCell('R', 'correct')}
          {renderCell('E', 'present')}
          {renderCell('Z', 'absent')}
        </View>
        <Text style={styles.infoText}>Verde: letra en posición correcta. Amarillo: letra en la palabra pero en otra posición. Gris: letra ausente.</Text>
      </BottomSheet>

      {status === 'won' && (
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          <ConfettiCannon count={80} origin={{ x: -10, y: 0 }} fadeOut={true} />
          <TouchableOpacity style={styles.shareBtn} onPress={shareResult}>
            <Text style={styles.shareBtnText}>Compartir resultado</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const createStyles = (theme: typeof Colors.light) =>
  StyleSheet.create({
    container: {
      flex: 1,
      padding: spacing.md,
      backgroundColor: theme.background,
    },
    row: {
      flexDirection: 'row',
      justifyContent: 'center',
      marginBottom: 4,
    },
    cell: {
      width: 48,
      height: 48,
      marginHorizontal: 2,
      borderWidth: 2,
      justifyContent: 'center',
      alignItems: 'center',
    },
    cellText: { fontSize: 24, fontWeight: 'bold', color: theme.text },
    keyboard: { marginTop: 20 },
    kbRow: { flexDirection: 'row', justifyContent: 'center', marginBottom: 4 },
    key: {
      paddingVertical: 10,
      paddingHorizontal: 6,
      marginHorizontal: 2,
      borderRadius: 4,
      backgroundColor: '#d3d6da',
    },
    specialKey: { minWidth: 48 },
    keyText: { color: '#000', fontWeight: 'bold' },
    infoTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 8, color: theme.text },
    infoText: { color: theme.text, marginBottom: 8 },
    shareBtn: {
      position: 'absolute',
      bottom: 40,
      left: 20,
      right: 20,
      backgroundColor: colors.success,
      padding: 12,
      borderRadius: 8,
      alignItems: 'center',
    },
    shareBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  });

