import { useState, useMemo } from 'react';
import * as Clipboard from 'expo-clipboard';
import { Share, Platform } from 'react-native';

export type LetterState = 'correct' | 'present' | 'absent';

export interface EvaluatedLetter {
  letter: string;
  state: LetterState;
}

export interface Guess {
  letters: EvaluatedLetter[];
}

export type GameStatus = 'playing' | 'won' | 'lost';

const WORD_LEN = 5;
const MAX_TRIES = 6;

export default function useWordleGame(word: string, validWords: string[]) {
  const [guesses, setGuesses] = useState<Guess[]>([]);
  const [currentGuess, setCurrentGuess] = useState('');
  const [status, setStatus] = useState<GameStatus>('playing');
  const [keyboard, setKeyboard] = useState<Record<string, LetterState>>({});

  const addLetter = (l: string) => {
    if (status !== 'playing') return;
    if (currentGuess.length < WORD_LEN) {
      setCurrentGuess((g) => g + l.toUpperCase());
    }
  };

  const removeLetter = () => {
    if (status !== 'playing') return;
    setCurrentGuess((g) => g.slice(0, -1));
  };

  const evaluateGuess = (guess: string): EvaluatedLetter[] => {
    const result: LetterState[] = Array(WORD_LEN).fill('absent');
    const wordLetters = word.split('');
    const used = Array(WORD_LEN).fill(false);

    // first pass for correct
    guess.split('').forEach((ch, i) => {
      if (ch === word[i]) {
        result[i] = 'correct';
        used[i] = true;
      }
    });

    // second pass for present
    guess.split('').forEach((ch, i) => {
      if (result[i] === 'correct') return;
      const idx = wordLetters.findIndex((c, j) => c === ch && !used[j]);
      if (idx !== -1) {
        result[i] = 'present';
        used[idx] = true;
      }
    });

    return guess.split('').map((l, idx) => ({ letter: l, state: result[idx] }));
  };

  const submitGuess = (): 'not-enough' | 'invalid' | 'accepted' => {
    if (status !== 'playing') return 'invalid';
    if (currentGuess.length < WORD_LEN) return 'not-enough';
    if (!validWords.includes(currentGuess.toUpperCase())) return 'invalid';

    const evaluated = evaluateGuess(currentGuess.toUpperCase());
    setGuesses((g) => [...g, { letters: evaluated }]);
    setCurrentGuess('');

    setKeyboard((kb) => {
      const copy = { ...kb };
      evaluated.forEach(({ letter, state }) => {
        const prev = copy[letter];
        if (prev === 'correct') return;
        if (prev === 'present' && state === 'absent') return;
        copy[letter] = state;
      });
      return copy;
    });

    if (evaluated.every((l) => l.state === 'correct')) {
      setStatus('won');
    } else if (guesses.length + 1 >= MAX_TRIES) {
      setStatus('lost');
    }

    return 'accepted';
  };

  const shareText = useMemo(() => {
    if (status === 'playing') return '';
    const dateStr = new Date().toLocaleDateString('es-ES');
    const lines = guesses.map((g) =>
      g.letters
        .map((l) => {
          if (l.state === 'correct') return '🟩';
          if (l.state === 'present') return '🟨';
          return '⬜';
        })
        .join(''),
    );
    return `Jubileo Wordle ${dateStr}\n` + lines.join('\n');
  }, [guesses, status]);

  const shareResult = async () => {
    const text = shareText;
    if (!text) return;
    if (Platform.OS === 'web') {
      await Clipboard.setStringAsync(text);
    } else {
      await Share.share({ message: text });
    }
  };

  return {
    guesses,
    currentGuess,
    addLetter,
    removeLetter,
    submitGuess,
    status,
    keyboard,
    shareResult,
    shareText,
  };
}
