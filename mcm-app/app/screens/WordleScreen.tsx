import React, {
  useMemo,
  useState,
  useLayoutEffect,
  useEffect,
  useRef,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Share,
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { Colors } from '@/constants/colors';
import spacing from '@/constants/spacing';
import { useColorScheme } from '@/hooks/useColorScheme';
import BottomSheet from '@/components/BottomSheet';
import ConfettiCannon from 'react-native-confetti-cannon';
import useWordleGame from '@/hooks/useWordleGame';
import useWordleStats from '@/hooks/useWordleStats';
import useWordleWords from '@/hooks/useWordleWords';
import { getDatabase, ref, get } from 'firebase/database';
import { getFirebaseApp } from '@/hooks/firebaseApp';
import * as Clipboard from 'expo-clipboard';
import AsyncStorage from '@react-native-async-storage/async-storage';

const QWERTY = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', 'Ñ'],
  ['Z', 'X', 'C', 'V', 'B', 'N', 'M'],
];

const EMOJIS = ['😀', '😁', '😊', '😎', '🤩', '🥳'];

export default function WordleScreen() {
  const navigation = useNavigation();
  const scheme = useColorScheme();
  const theme = Colors[scheme];
  const styles = useMemo(() => createStyles(theme), [theme]);
  const emoji = useMemo(
    () => EMOJIS[Math.floor(Math.random() * EMOJIS.length)],
    [],
  );

  const { stats, recordGame, saveResultToServer } = useWordleStats();
  const { getWordForDate } = useWordleWords();

  // Usar ref para evitar múltiples ejecuciones del efecto
  const gameProcessedRef = useRef<string | null>(null);

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
  } = useWordleGame(target, []);

  const [internalShowInfo, setInternalShowInfo] = useState(false);
  const [internalShowStats, setInternalShowStats] = useState(false);
  const [rank, setRank] = useState<number | null>(null);
  const [buttonAnimation] = useState(new Animated.Value(0));
  const [isGameLocked, setIsGameLocked] = useState(false);

  const showInfo = internalShowInfo;
  const setShowInfo = setInternalShowInfo;
  const showStats = internalShowStats;
  const setShowStats = setInternalShowStats;

  // Verificar si el juego está bloqueado para esta palabra
  useEffect(() => {
    const checkGameLock = async () => {
      try {
        const lockKey = `wordle_completed_${playKey}`;
        const completed = await AsyncStorage.getItem(lockKey);
        setIsGameLocked(completed === 'true');
      } catch (error) {
        console.error('Error checking game lock:', error);
      }
    };
    checkGameLock();
  }, [playKey]);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: 'Wordle Jubileo',
      headerStyle: { backgroundColor: '#A3BD31' },
      headerTintColor: '#fff',
      headerTitleStyle: { fontWeight: 'bold', fontSize: 18 },
      headerTitleAlign: 'center',
      headerRight: () => (
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity
            onPress={() => setShowStats(true)}
            style={{ padding: 8, marginRight: 4 }}
          >
            <MaterialIcons name="poll" size={24} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setShowInfo(true)}
            style={{ padding: 8 }}
          >
            <MaterialIcons name="info" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      ),
    });
  }, [navigation, setShowInfo, setShowStats]);

  const generateEmojiResult = () => {
    let result = '';
    guesses.forEach((guess) => {
      guess.letters.forEach((letter) => {
        if (letter.state === 'correct') result += '🟩';
        else if (letter.state === 'present') result += '🟨';
        else result += '⬜';
      });
      result += '\n';
    });
    return result;
  };

  const shareCustomResult = async () => {
    const emojiGrid = generateEmojiResult();
    const attempts = guesses.length;
    const message = `🎯 Mi intento hoy en el Wordle-Jubilar-Consolación ha sido:\n\n${attempts}/6 intentos\n\n${emojiGrid}\n🎉 ¡Súper Wordle Jubilar Consolación Chulo! 🎊`;

    if (Platform.OS === 'web') {
      await Clipboard.setStringAsync(message);
    } else {
      await Share.share({ message });
    }
  };

  const handleKey = (k: string) => {
    // Bloquear input si el juego está completado para esta palabra
    if (isGameLocked) return;

    if (k === 'ENTER') {
      const res = submitGuess();
      if (res === 'not-enough') {
        console.log('No hay suficientes letras');
      } else if (res === 'invalid') {
        console.log('Palabra no válida');
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
    const gameKey = `${status}_${playKey}_${guesses.length}`;

    if (
      (status === 'won' || status === 'lost') &&
      gameProcessedRef.current !== gameKey
    ) {
      gameProcessedRef.current = gameKey;

      const attempts = status === 'won' ? guesses.length : 6;
      recordGame(attempts as 1 | 2 | 3 | 4 | 5 | 6, playKey);
      saveResultToServer(playKey, attempts);

      // Si gana, bloquear el juego hasta la siguiente palabra
      if (status === 'won') {
        const lockKey = `wordle_completed_${playKey}`;
        AsyncStorage.setItem(lockKey, 'true').catch(console.error);
        setIsGameLocked(true);

        // Animar el botón de compartir - aparece una vez y se queda
        const showButtonAnimation = () => {
          Animated.timing(buttonAnimation, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }).start();
        };
        showButtonAnimation();
      }

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
  }, [
    status,
    playKey,
    todayKey,
    cycle,
    stats.userId,
    guesses.length,
    recordGame,
    saveResultToServer,
    buttonAnimation,
  ]);

  return (
    <View style={styles.container}>
      <View style={styles.gameArea}>
        {guesses.map((g, idx) => (
          <View key={idx} style={styles.row}>
            {g.letters.map((l, i) => (
              <View key={`guess-${idx}-${i}`}>
                {renderCell(l.letter, l.state)}
              </View>
            ))}
          </View>
        ))}
        {status === 'playing' && (
          <View style={styles.row}>
            {[...currentGuess.padEnd(5)].map((ch, i) => (
              <View key={`current-${i}`}>{renderCell(ch)}</View>
            ))}
          </View>
        )}
        {Array.from({
          length: 6 - guesses.length - (status === 'playing' ? 1 : 0),
        }).map((_, idx) => (
          <View key={`empty-${idx}`} style={styles.row}>
            {Array.from({ length: 5 }).map((_, i) => (
              <View key={`empty-cell-${idx}-${i}`}>{renderCell('')}</View>
            ))}
          </View>
        ))}
      </View>

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

      <Text style={styles.footerText}>
        Súper Wordle Jubilar Consolación Chulo {emoji}
      </Text>

      <BottomSheet visible={showInfo} onClose={() => setShowInfo(false)}>
        <Text style={styles.infoTitle}>¿Cómo jugar?</Text>
        <Text style={styles.infoText}>
          Adivina una palabra de 5 letras en 6 intentos.{'\n'}
          Cada día a las 7h y a las 19h una palabra nueva.{'\n\n'}
          Cuando le das a enviar, las letras cambian de color:
        </Text>
        <View style={{ flexDirection: 'row', marginVertical: 8 }}>
          {renderCell('R', 'correct')}
          {renderCell('E', 'present')}
          {renderCell('Z', 'absent')}
        </View>
        <Text style={styles.infoText}>
          🟩 Verde: Letra en posición correcta, vas bien.{'\n'}
          🟡 Amarillo: La letra está en la palabra pero en otra posición.{'\n'}
          ⚪ Gris: Esa letra no está, no lo intentes.
        </Text>
      </BottomSheet>

      <BottomSheet visible={showStats} onClose={() => setShowStats(false)}>
        <Text style={styles.infoTitle}>Estadísticas</Text>
        <Text style={styles.infoText}>Partidas jugadas: {stats.played}</Text>
        {Object.entries(stats.distribution).map(([k, v]) => {
          const max = Math.max(...Object.values(stats.distribution), 1);
          const width = (Number(v) / max) * 100;
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
                    width: `${width}%`,
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
          {/* Confeti cayendo desde la parte superior de la pantalla */}
          <ConfettiCannon
            count={60}
            origin={{ x: -10, y: -50 }}
            fallSpeed={2500}
            fadeOut={true}
            autoStart={true}
          />
          <ConfettiCannon
            count={60}
            origin={{ x: 10, y: -50 }}
            fallSpeed={2500}
            fadeOut={true}
            autoStart={true}
          />

          <Animated.View
            style={[
              styles.shareBtn,
              {
                transform: [{ scale: buttonAnimation }],
              },
            ]}
          >
            <TouchableOpacity
              onPress={shareCustomResult}
              style={{ width: '100%', alignItems: 'center' }}
            >
              <Text style={styles.shareBtnText}>
                🎉 ¡Compartir mi victoria! 🎊
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      )}

      {isGameLocked && status !== 'won' && status !== 'lost' && (
        <View style={styles.lockedGameMessage}>
          <Text style={styles.lockedGameText}>
            🎯 ¡Ya completaste el Wordle de este turno!
          </Text>
          <Text style={styles.lockedGameSubtext}>
            Vuelve a las {cycle === 'morning' ? '19:00' : '07:00'} para una
            nueva palabra
          </Text>
        </View>
      )}
    </View>
  );
}

const createStyles = (theme: typeof Colors.light) =>
  StyleSheet.create({
    container: {
      flex: 1,
      paddingHorizontal: spacing.sm,
      paddingTop: spacing.xs,
      paddingBottom: spacing.xs,
      backgroundColor: theme.background,
      justifyContent: 'flex-start',
    },
    gameArea: {
      flex: 0,
      justifyContent: 'flex-start',
      paddingVertical: 10,
      marginBottom: 10,
    },
    row: {
      flexDirection: 'row',
      justifyContent: 'center',
      marginBottom: 6,
    },
    cell: {
      width: 60,
      height: 60,
      marginHorizontal: 3,
      borderWidth: 2,
      borderRadius: 8,
      justifyContent: 'center',
      alignItems: 'center',
      elevation: 2,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
    },
    cellText: {
      fontSize: 28,
      fontWeight: 'bold',
      color: theme.text,
    },
    keyboard: {
      marginTop: 8,
      paddingBottom: 10,
    },
    kbRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      marginBottom: 6,
    },
    key: {
      paddingVertical: 16,
      paddingHorizontal: 12,
      marginHorizontal: 3,
      borderRadius: 8,
      backgroundColor: '#d3d6da',
      minWidth: 32,
      justifyContent: 'center',
      alignItems: 'center',
      elevation: 2,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 1,
    },
    specialKey: {
      minWidth: 60,
      paddingHorizontal: 8,
    },
    keyText: {
      color: '#000',
      fontWeight: 'bold',
      fontSize: 16,
    },
    infoTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      marginBottom: 8,
      color: theme.text,
    },
    infoText: {
      color: theme.text,
      marginBottom: 8,
      lineHeight: 24,
    },
    shareBtn: {
      position: 'absolute',
      bottom: 60,
      left: 30,
      right: 30,
      backgroundColor: '#A3BD31',
      padding: 18,
      borderRadius: 25,
      alignItems: 'center',
      elevation: 8,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      borderWidth: 3,
      borderColor: '#fff',
    },
    shareBtnText: {
      color: '#fff',
      fontWeight: 'bold',
      fontSize: 18,
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    footerText: {
      textAlign: 'center',
      marginTop: 8,
      fontWeight: 'bold',
      color: theme.text,
      fontSize: 14,
    },
    lockedGameMessage: {
      position: 'absolute',
      top: '50%',
      left: 20,
      right: 20,
      backgroundColor: '#A3BD31',
      padding: 20,
      borderRadius: 15,
      alignItems: 'center',
      elevation: 5,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
    },
    lockedGameText: {
      color: '#fff',
      fontSize: 18,
      fontWeight: 'bold',
      textAlign: 'center',
      marginBottom: 8,
    },
    lockedGameSubtext: {
      color: '#fff',
      fontSize: 14,
      textAlign: 'center',
      opacity: 0.9,
    },
  });
