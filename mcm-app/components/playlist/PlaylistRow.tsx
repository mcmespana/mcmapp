/**
 * Fila de canción dentro de la pantalla "Seleccionadas".
 *
 * Diferencias con `SongListItem`:
 *   - Muestra el tono TRANSPORTADO (tono original → tono final) si la
 *     canción tiene `transpose != 0`.
 *   - Tiene controles opcionales de reorden (↑ / ↓) en modo "Orden libre".
 *   - Numerador opcional (posición 1, 2, 3...).
 *   - Indicador opcional de "sonando ahora" (modo coro).
 */
import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { h } from '@/utils/haptics';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useSettings } from '@/contexts/SettingsContext';
import { convertChord } from '@/utils/chordNotation';
import { transposeKey, transposeLabel } from '@/utils/transposeKey';

interface Song {
  title: string;
  filename: string;
  author?: string;
  key?: string;
  capo?: number;
}

interface Props {
  song: Song;
  transpose: number;
  /** Override de cejilla para esta sesión. null = usar la original. */
  capoOverride?: number | null;
  /** Si se indica, se muestra como prefijo (#1, #2…). */
  position?: number;
  /** Solo modo "Orden libre". */
  showReorderControls?: boolean;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onPress: () => void;
  onRemove: () => void;
  /**
   * Long-press sobre la fila (modo "Orden ajustado": inicia el arrastre
   * de la lista reordenable).
   */
  onLongPress?: () => void;
  /** Marca esta canción como la actual en una sesión de coro. */
  isNowPlaying?: boolean;
}

const PlaylistRow: React.FC<Props> = ({
  song,
  transpose,
  capoOverride,
  position,
  showReorderControls,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  onPress,
  onRemove,
  onLongPress,
  isNowPlaying,
}) => {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const styles = useMemo(() => createStyles(isDark), [isDark]);
  const { settings } = useSettings();
  const { notation } = settings;

  const cleanTitle = song.title.replace(/^\d+\.\s*/, '');
  const originalKey = song.key ? song.key.toUpperCase() : '';
  const targetKey =
    transpose && originalKey
      ? transposeKey(originalKey, transpose)
      : originalKey;

  const transposeBadge = transposeLabel(transpose);

  const renderLeftActions = (
    _progress: Animated.AnimatedInterpolation<number>,
    dragX: Animated.AnimatedInterpolation<number>,
  ) => {
    const trans = dragX.interpolate({
      inputRange: [0, 100],
      outputRange: [-100, 0],
      extrapolate: 'clamp',
    });
    return (
      <TouchableOpacity style={styles.leftAction} onPress={onRemove}>
        <Animated.View
          style={[styles.actionContent, { transform: [{ translateX: trans }] }]}
        >
          <IconSymbol name="minus.circle" size={22} color="#fff" />
          <Text style={styles.actionText}>Quitar</Text>
        </Animated.View>
      </TouchableOpacity>
    );
  };

  return (
    <Swipeable
      renderLeftActions={renderLeftActions}
      onSwipeableOpen={(direction, swipeable) => {
        if (direction === 'left') {
          h.remove();
          swipeable.close();
          onRemove();
        }
      }}
    >
      <View style={[styles.outer, isNowPlaying && styles.outerNowPlaying]}>
        <TouchableOpacity
          onPress={onPress}
          onLongPress={
            onLongPress
              ? () => {
                  h.select();
                  onLongPress();
                }
              : undefined
          }
          delayLongPress={250}
          style={styles.inner}
          activeOpacity={0.6}
        >
          <View style={styles.leftSection}>
            {position !== undefined ? (
              <View style={styles.numberWrap}>
                <Text style={styles.numberText}>{position}</Text>
              </View>
            ) : isNowPlaying ? (
              <View style={[styles.numberWrap, styles.numberWrapPlaying]}>
                <MaterialIcons name="graphic-eq" size={16} color="#34C759" />
              </View>
            ) : (
              <View style={styles.dotPlaceholder} />
            )}

            <View style={styles.songInfoContainer}>
              <Text
                style={styles.songTitle}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {cleanTitle}
              </Text>
              {song.author ? (
                <Text
                  style={styles.authorText}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {song.author}
                </Text>
              ) : null}
            </View>
          </View>

          <View style={styles.rightSection}>
            {(() => {
              const isOverridden =
                capoOverride !== null && capoOverride !== undefined;
              const displayCapo = isOverridden ? capoOverride : song.capo;
              if (!displayCapo || displayCapo <= 0) return null;
              return (
                <View
                  style={[
                    styles.capoPill,
                    isOverridden && styles.capoPillOverridden,
                  ]}
                >
                  <Text
                    style={[
                      styles.capoText,
                      isOverridden && styles.capoTextOverridden,
                    ]}
                  >
                    {`C${displayCapo}${isOverridden ? '✱' : ''}`}
                  </Text>
                </View>
              );
            })()}

            {originalKey ? (
              transpose !== 0 ? (
                <View style={styles.toneTransposedWrap}>
                  <Text style={styles.toneOriginalStriked}>
                    {convertChord(originalKey, notation)}
                  </Text>
                  <View style={styles.keyPillTransposed}>
                    <Text style={styles.keyTextTransposed}>
                      {convertChord(targetKey, notation)}
                    </Text>
                  </View>
                  <Text style={styles.transposeParenLabel}>
                    ({transposeBadge})
                  </Text>
                </View>
              ) : (
                <View style={styles.keyPill}>
                  <Text style={styles.keyText}>
                    {convertChord(originalKey, notation)}
                  </Text>
                </View>
              )
            ) : null}
          </View>
        </TouchableOpacity>

        {showReorderControls ? (
          <View style={styles.reorderRow}>
            <TouchableOpacity
              style={[
                styles.reorderBtn,
                !canMoveUp && styles.reorderBtnDisabled,
              ]}
              onPress={() => {
                h.select();
                onMoveUp?.();
              }}
              disabled={!canMoveUp}
              hitSlop={6}
            >
              <MaterialIcons
                name="keyboard-arrow-up"
                size={22}
                color={
                  canMoveUp
                    ? isDark
                      ? '#7AB3FF'
                      : '#253883'
                    : isDark
                      ? '#48484A'
                      : '#C7C7CC'
                }
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.reorderBtn,
                !canMoveDown && styles.reorderBtnDisabled,
              ]}
              onPress={() => {
                h.select();
                onMoveDown?.();
              }}
              disabled={!canMoveDown}
              hitSlop={6}
            >
              <MaterialIcons
                name="keyboard-arrow-down"
                size={22}
                color={
                  canMoveDown
                    ? isDark
                      ? '#7AB3FF'
                      : '#253883'
                    : isDark
                      ? '#48484A'
                      : '#C7C7CC'
                }
              />
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
    </Swipeable>
  );
};

const createStyles = (isDark: boolean) =>
  StyleSheet.create({
    outer: {
      backgroundColor: isDark ? '#2C2C2E' : '#fff',
      flexDirection: 'row',
      alignItems: 'stretch',
    },
    outerNowPlaying: {
      backgroundColor: isDark ? '#1A3320' : '#E8F5E9',
    },
    inner: {
      flex: 1,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
    },
    leftSection: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      marginRight: 12,
      gap: 10,
    },
    numberWrap: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: isDark ? '#1A2744' : '#EEF4FF',
      alignItems: 'center',
      justifyContent: 'center',
    },
    numberWrapPlaying: {
      backgroundColor: isDark ? '#1A3320' : '#D7F1DA',
    },
    numberText: {
      fontSize: 13,
      fontWeight: '700',
      color: isDark ? '#7AB3FF' : '#253883',
      fontVariant: ['tabular-nums'],
    },
    dotPlaceholder: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: '#34C759',
      marginHorizontal: 11,
    },
    songInfoContainer: {
      flex: 1,
    },
    songTitle: {
      fontSize: 16,
      color: isDark ? '#FFFFFF' : '#1C1C1E',
      fontWeight: '500',
      letterSpacing: -0.2,
    },
    authorText: {
      fontSize: 13,
      color: isDark ? '#AEAEB2' : '#8E8E93',
      fontStyle: 'italic',
      marginTop: 3,
    },
    rightSection: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
    },
    capoPill: {
      paddingHorizontal: 6,
      paddingVertical: 3,
      borderRadius: 5,
      backgroundColor: isDark ? '#3A3A3C' : '#EBEBEB',
    },
    capoPillOverridden: {
      backgroundColor: isDark ? '#3A2D0A' : '#FFF4DA',
      borderWidth: 1,
      borderColor: isDark ? '#7A5A00' : '#F4C11E',
    },
    capoText: {
      fontSize: 11,
      fontWeight: '600',
      color: isDark ? '#AEAEB2' : '#636366',
      fontVariant: ['tabular-nums'],
    },
    capoTextOverridden: {
      color: isDark ? '#F4C11E' : '#7A5A00',
    },
    keyPill: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
      backgroundColor: isDark ? '#1A2744' : '#EEF4FF',
    },
    keyText: {
      fontSize: 13,
      fontWeight: '700',
      color: isDark ? '#7AB3FF' : '#253883',
    },
    toneTransposedWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    toneOriginalStriked: {
      fontSize: 12,
      fontWeight: '500',
      color: isDark ? '#636366' : '#A0A0A8',
      textDecorationLine: 'line-through',
    },
    keyPillTransposed: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
      backgroundColor: '#FFF4DA',
      borderWidth: 1,
      borderColor: '#F4C11E',
    },
    keyTextTransposed: {
      fontSize: 13,
      fontWeight: '700',
      color: '#7A5A00',
    },
    transposeParenLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: isDark ? '#8E8E93' : '#8E8E93',
      fontVariant: ['tabular-nums'],
    },
    reorderRow: {
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 8,
      paddingVertical: 6,
      gap: 2,
      borderLeftWidth: StyleSheet.hairlineWidth,
      borderLeftColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
    },
    reorderBtn: {
      width: 32,
      height: 24,
      alignItems: 'center',
      justifyContent: 'center',
    },
    reorderBtnDisabled: {
      opacity: 0.4,
    },
    leftAction: {
      backgroundColor: '#FF453A',
      justifyContent: 'center',
      alignItems: 'center',
      width: 100,
    },
    actionContent: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    actionText: {
      color: '#fff',
      fontSize: 12,
      fontWeight: '600',
      marginTop: 4,
    },
  });

export default PlaylistRow;
