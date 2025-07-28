import React, { useMemo, useState, useLayoutEffect, useEffect } from 'react';
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
import useWordleStats from '@/hooks/useWordleStats';
import useWordleWords from '@/hooks/useWordleWords';
import { getDatabase, ref, get } from 'firebase/database';
import { getFirebaseApp } from '@/hooks/firebaseApp';

const QWERTY = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', 'Ñ'],
  ['Z', 'X', 'C', 'V', 'B', 'N', 'M'],
];

const FALLBACK = ['ROMAN', 'AMIGO', 'JOVEN', 'SALVE', 'MARIA'];
const EMOJIS = ['😀', '😁', '😊', '😎', '🤩', '🥳'];

export default function WordleScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<JubileoStackParamList>>();
  const scheme = useColorScheme();
  const theme = Colors[scheme];
  const styles = useMemo(() => createStyles(theme), [theme]);
  const emoji = useMemo(
    () => EMOJIS[Math.floor(Math.random() * EMOJIS.length)],
    [],
  );

  const { stats, recordGame, saveResultToServer } = useWordleStats();
  const { getWordForDate, loading } = useWordleWords();

  // Determinar la fecha y ciclo actual
  const now = new Date();
  let dateKey = now.toISOString().slice(0, 10);
  let cycle: 'morning' | 'evening' = 'morning';
  if (now.getHours() < 7) {
    const y = new Date(now);
    y.setDate(y.getDate() - 1);
    dateKey = y.toISOString().slice(0, 10);
    cycle = 'evening';
  } else if (now.getHours() >= 19) {
    cycle = 'evening';
  }
  const todayKey = dateKey;
  const playKey = `${todayKey}_${cycle}`;

  // Obtener la palabra del día desde Firebase o fallback
  const target = getWordForDate(todayKey, cycle);

  const {
    guesses,
    currentGuess,
    addLetter,
    removeLetter,
    submitGuess,
    status,
    keyboard,
    shareResult,
  } = useWordleGame(target, []);

  const [showInfo, setShowInfo] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [rank, setRank] = useState<number | null>(null);
  const [modalMessage, setModalMessage] = useState('');
  const [isModalVisible, setIsModalVisible] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: 'Wordle Jubileo',
      headerRight: () => (
        <View style={{ flexDirection: 'row' }}>
          {status !== 'playing' && (
            <IconButton
              icon="share-variant"
              iconColor="#fff"
              onPress={shareResult}
            />
          )}
          <IconButton
            icon="poll"
            iconColor="#fff"
            onPress={() => setShowStats(true)}
          />
          <IconButton
            icon="information-outline"
            iconColor="#fff"
            onPress={() => setShowInfo(true)}
          />
        </View>
      ),
    });
  }, [navigation, status, shareResult]);

  const handleKey = (k: string) => {
    if (k === 'ENTER') {
      const res = submitGuess();
      if (res === 'not-enough') {
        setModalMessage('No hay suficientes letras');
        setIsModalVisible(true);
      } else if (res === 'invalid') {
        setModalMessage('Palabra no válida');
        setIsModalVisible(true);
      }
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

  useEffect(() => {
    if (status === 'won' || status === 'lost') {
      const attempts = status === 'won' ? guesses.length : 6;
      recordGame(attempts as 1 | 2 | 3 | 4 | 5 | 6, playKey);
      saveResultToServer(playKey, attempts);
      const fetchRank = async () => {
        try {
          const db = getDatabase(getFirebaseApp());
          const snap = await get(ref(db, `wordle/${todayKey}/${cycle}`));
          if (snap.exists()) {
            const arr = Object.values(snap.val() || []) as any[];
            arr.sort(
              (a, b) => a.attempts - b.attempts || a.timestamp - b.timestamp,
            );
            const idx = arr.findIndex((r) => r.userId === stats.userId);
            if (idx !== -1) setRank(idx + 1);
          }
        } catch (e) {
          console.error('Error ranking', e);
        }
      };
      fetchRank();
    }
  }, [status, playKey, todayKey, cycle, stats.userId]);

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
      {Array.from({
        length: 6 - guesses.length - (status === 'playing' ? 1 : 0),
      }).map((_, idx) => (
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
                <TouchableOpacity
                  style={[styles.key, styles.specialKey]}
                  onPress={() => handleKey('DEL')}
                >
                  <Text style={styles.keyText}>⌫</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.key, styles.specialKey]}
                  onPress={() => handleKey('ENTER')}
                >
                  <Text style={styles.keyText}>ENVIAR</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        ))}
      </View>

      <BottomSheet visible={showInfo} onClose={() => setShowInfo(false)}>
        <Text style={styles.infoTitle}>¿Cómo jugar?</Text>
        <Text style={styles.infoText}>
          Adivina la palabra de 5 letras en 6 intentos. Cada letra cambia de
          color:
        </Text>
        <View style={{ flexDirection: 'row', marginVertical: 8 }}>
          {renderCell('R', 'correct')}
          {renderCell('E', 'present')}
          {renderCell('Z', 'absent')}
        </View>
        <Text style={styles.infoText}>
          Verde: letra en posición correcta. Amarillo: letra en la palabra pero
          en otra posición. Gris: letra ausente.
        </Text>
      </BottomSheet>

      <BottomSheet visible={showStats} onClose={() => setShowStats(false)}>
        <Text style={styles.infoTitle}>Estadísticas</Text>
        <Text style={styles.infoText}>Partidas jugadas: {stats.played}</Text>
        {Object.entries(stats.distribution).map(([k, v]) => {
          const max = Math.max(...Object.values(stats.distribution), 1);
          const width = `${(Number(v) / max) * 100}%`;
          return (
            <View
              key={k}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                marginBottom: 4,
              }}
            >
              <Text style={{ width: 20 }}>{k}</Text>
              <View
                style={{
                  flex: 1,
                  backgroundColor: '#d3d6da',
                  height: 10,
                  marginHorizontal: 4,
                }}
              >
                <View
                  style={{
                    backgroundColor: '#6aaa64',
                    height: 10,
                    width: width,
                  }}
                />
              </View>
              <Text>{v}</Text>
            </View>
          );
        })}
        {rank && (
          <Text style={[styles.infoText, { marginTop: 8 }]}>
            Hoy has quedado en el ranking #{rank}
          </Text>
        )}
      </BottomSheet>

      {status === 'won' && (
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          <ConfettiCannon count={80} origin={{ x: -10, y: 0 }} fadeOut={true} />
          <TouchableOpacity style={styles.shareBtn} onPress={shareResult}>
            <Text style={styles.shareBtnText}>Compartir resultado</Text>
          </TouchableOpacity>
        </View>
      )}
      <Text style={styles.footerText}>
        Súper Wordle Jubilar Consolación Chulo {emoji}
      </Text>
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
    infoTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      marginBottom: 8,
      color: theme.text,
    },
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
    footerText: {
      textAlign: 'center',
      marginTop: 20,
      fontWeight: 'bold',
      color: theme.text,
    },
  });
