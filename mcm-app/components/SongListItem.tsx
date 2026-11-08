import React, {
  useCallback,
  useRef,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  TouchableOpacity,
  Text,
  View,
  StyleSheet,
  Animated,
  Platform,
} from 'react-native';
import Swipeable, {
  type SwipeableMethods,
} from 'react-native-gesture-handler/ReanimatedSwipeable';
import type { SharedValue } from 'react-native-reanimated';
import { openedActionsSide } from '@/utils/swipeSide';
import SwipeActionContent from './ui/SwipeActionContent';
import { PressableFeedback } from 'heroui-native';
import { h } from '@/utils/haptics';
import { IconSymbol } from './ui/IconSymbol';
import { useColorScheme } from '@/hooks/useColorScheme';
import useLargeText from '@/hooks/useLargeText';
import { useContextMenu } from '@/hooks/useContextMenu';
import { useSettings } from '../contexts/SettingsContext';
import { convertChord } from '../utils/chordNotation';
import { transposeKey, transposeLabel } from '../utils/transposeKey';
import { MaterialIcons } from '@/components/ui/icons';
import {
  Colors,
  HighlightColors,
  KeyPillColors,
  StateColors,
  SwipeColors,
  SystemGray,
  themeColors,
} from '@/constants/colors';
import { durations } from '@/constants/animations';
import { extractSongMedia, mediaKinds } from '@/types/songMedia';
import typography from '@/constants/typography';
import { radii } from '@/constants/uiStyles';
import spacing from '@/constants/spacing';
import type { ResolvedTag } from '@/utils/songTags';

// Type for song data
interface Song {
  title: string;
  filename: string;
  author?: string;
  key?: string;
  capo?: number;
  info?: string;
  album?: string;
  liturgicalTime?: string;
  source?: string;
  rhythm?: string;
  videoEmbed?: string;
  youtubeLinks?: { label: string; url: string }[];
  audioLinks?: { label: string; url: string }[];
  originalCategoryKey?: string;
  numericFilenamePart?: string;
}

interface SongListItemProps {
  song: Song;
  onPress: (song: Song) => void;
  onLongPress?: (song: Song) => void;
  isSearchAllMode?: boolean;
  isSelected: boolean;
  selectedTranspose: number;
  onAddSong: (filename: string) => void;
  onRemoveSong: (filename: string) => void;
  /** Última fila de un grupo con esquinas: el separador sobra. */
  hideSeparator?: boolean;
  /** Etiquetas destacadas que lleva la canción: se ven discretas. */
  featuredTags?: ResolvedTag[];
  /**
   * Pista de gesto (`useGestureHint`): al montarse, la fila se entreabre sola
   * un momento y enseña «Añadir», y vuelve. Solo en UNA fila de la lista.
   */
  hintSwipe?: boolean;
  /** La demostración ha arrancado en esta fila (para contarla). */
  onHintShown?: (filename: string) => void;
  /** El usuario ha añadido deslizando: ya conoce el gesto. */
  onSwipeAdd?: () => void;
}

/** Espera antes de la demostración: que la lista se haya posado. */
const HINT_DELAY_MS = 900;
/** Cuánto se queda abierta la fila en la demostración. */
const HINT_HOLD_MS = 1100;
/**
 * Arrastre (px) a partir del cual soltar ya ejecuta la acción: la mitad de
 * los 100 px de la acción, el umbral por defecto de `ReanimatedSwipeable`.
 */
const ARM_AT = 50;

const SongListItem: React.FC<SongListItemProps> = React.memo(
  function SongListItem({
    song,
    onPress,
    onLongPress,
    isSearchAllMode = false,
    isSelected,
    selectedTranspose,
    onAddSong,
    onRemoveSong,
    hideSeparator = false,
    featuredTags,
    hintSwipe = false,
    onHintShown,
    onSwipeAdd,
  }) {
    const { settings } = useSettings();
    const { notation } = settings;
    const scheme = useColorScheme();
    const isDark = scheme === 'dark';
    // Letra del sistema grande: el título cabía en ~10 caracteres a una
    // línea; pasa a poder ocupar varias.
    const large = useLargeText();
    // Estilos de módulo, uno por tema: antes cada fila hacía su propio
    // `StyleSheet.create` de ~45 estilos al montarse.
    const styles = isDark ? stylesDark : stylesLight;
    const swipeableRow = useRef<SwipeableMethods>(null);
    // Mientras dura la demostración, abrir la fila NO añade la canción, ni
    // suena la háptica de «armado»: no la ha causado el usuario.
    const hintingRef = useRef(false);
    const onArm = useCallback(() => {
      if (!hintingRef.current) h.select();
    }, []);

    // Pista de gesto: la fila se entreabre sola (las acciones reales, con su
    // «Añadir» verde) y se vuelve a cerrar. Si el usuario toca mientras, el
    // gesto de la fila manda sobre la demostración. Arranca UNA vez por fila
    // y no se corta aunque la prop cambie después; solo al desmontar.
    const hintTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
    const hintStarted = useRef(false);
    useEffect(() => {
      if (!hintSwipe || hintStarted.current || isSelected || isWeb) return;
      hintStarted.current = true;
      const timers = hintTimers.current;
      timers.push(
        setTimeout(() => {
          hintingRef.current = true;
          onHintShown?.(song.filename);
          swipeableRow.current?.openRight();
          timers.push(
            setTimeout(() => {
              swipeableRow.current?.close();
              // Margen para que el cierre acabe antes de volver a armar.
              timers.push(
                setTimeout(() => {
                  hintingRef.current = false;
                }, HINT_DELAY_MS),
              );
            }, HINT_HOLD_MS),
          );
        }, HINT_DELAY_MS),
      );
      // Solo al recibir la pista: la selección no la relanza.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [hintSwipe]);
    useEffect(() => {
      const timers = hintTimers.current;
      return () => timers.forEach(clearTimeout);
    }, []);
    const backgroundColorAnim = useRef(
      new Animated.Value(isSelected ? 1 : 0),
    ).current;

    // El valor ya NACE en su destino (`isSelected ? 1 : 0`), así que en el
    // montaje no hay nada que animar. Antes se lanzaba igualmente un
    // `Animated.timing` de 0 a 0 sin driver nativo (250 ms de rAF en el hilo
    // de JS) por cada fila que entraba al hacer scroll, compitiendo con el
    // propio scroll. Solo se anima cuando la selección CAMBIA.
    const prevSelected = useRef(isSelected);
    useEffect(() => {
      if (prevSelected.current === isSelected) return;
      prevSelected.current = isSelected;
      Animated.timing(backgroundColorAnim, {
        toValue: isSelected ? 1 : 0,
        duration: durations.base,
        useNativeDriver: false,
      }).start();
    }, [isSelected, backgroundColorAnim]);

    const animatedStyle = useMemo(
      () => ({
        backgroundColor: backgroundColorAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [
            isDark ? Colors.dark.background : Colors.light.background,
            isDark ? StateColors.selectedBgDark : StateColors.selectedBgLight,
          ],
        }),
      }),
      [backgroundColorAnim, isDark],
    );

    // Web: la fila reacciona al cursor y lleva un botón visible para añadir o
    // quitar de «Tu selección». Con ratón, arrastrar la fila (el swipe) o
    // descubrir el clic derecho no es una forma razonable de armar la lista.
    const [hovered, setHovered] = useState(false);
    const hoverProps = isWeb
      ? {
          onPointerEnter: () => setHovered(true),
          onPointerLeave: () => setHovered(false),
        }
      : null;

    const renderRightActions = (
      _progress: SharedValue<number>,
      translation: SharedValue<number>,
    ) => (
      <TouchableOpacity
        style={styles.rightAction}
        onPress={() => {
          h.add();
          onAddSong(song.filename);
          swipeableRow.current?.close();
        }}
      >
        <SwipeActionContent
          translation={translation}
          inputRange={[-100, 0]}
          outputRange={[0, 100]}
          property="translateX"
          style={styles.actionContent}
          armAt={ARM_AT}
          onArm={onArm}
        >
          <IconSymbol name="plus.circle" size={22} color="#fff" />
          <Text style={styles.actionText}>Añadir</Text>
        </SwipeActionContent>
      </TouchableOpacity>
    );

    const renderLeftActions = (
      _progress: SharedValue<number>,
      translation: SharedValue<number>,
    ) => (
      <TouchableOpacity
        style={styles.leftAction}
        onPress={() => {
          h.remove();
          onRemoveSong(song.filename);
          swipeableRow.current?.close();
        }}
      >
        <SwipeActionContent
          translation={translation}
          inputRange={[0, 100]}
          outputRange={[-100, 0]}
          property="translateX"
          style={styles.actionContent}
          armAt={ARM_AT}
          onArm={onArm}
        >
          <IconSymbol name="minus.circle" size={22} color="#fff" />
          <Text style={styles.actionText}>Quitar</Text>
        </SwipeActionContent>
      </TouchableOpacity>
    );

    const cleanTitle = song.title.replace(/^\d+\.\s*/, '');

    // Indicador sutil de multimedia (▶ vídeo / 🎧 audio / 🔗 enlaces) en la fila.
    const kinds = useMemo(() => mediaKinds(extractSongMedia(song)), [song]);
    // El mismo rol que la leyenda «vídeo · audio» de la cabecera de la lista:
    // antes era un gris a mano que en claro se quedaba en 2:1 sobre blanco.
    const mediaIconColor = themeColors(isDark).textMuted;

    const contextHandler = useCallback(() => {
      h.tap();
      onLongPress?.(song);
    }, [onLongPress, song]);
    const contextMenuProps = useContextMenu(
      onLongPress ? contextHandler : undefined,
    );

    return (
      <Swipeable
        ref={swipeableRow}
        renderRightActions={!isSelected ? renderRightActions : undefined}
        renderLeftActions={isSelected ? renderLeftActions : undefined}
        onSwipeableOpen={(direction) => {
          // El lado ABIERTO, no la dirección del dedo (ver `utils/swipeSide`).
          const side = openedActionsSide(direction);
          // La demostración abre la fila de verdad: eso no es añadir.
          if (hintingRef.current) return;
          if (side === 'right' && !isSelected) {
            h.add();
            onAddSong(song.filename);
            onSwipeAdd?.();
            swipeableRow.current?.close();
          } else if (side === 'left' && isSelected) {
            h.remove();
            onRemoveSong(song.filename);
            swipeableRow.current?.close();
          }
        }}
      >
        <Animated.View
          style={[styles.songItemOuter, animatedStyle]}
          {...hoverProps}
        >
          <TouchableOpacity
            onPress={() => onPress(song)}
            style={[
              styles.songItemInner,
              hideSeparator && styles.noSeparator,
              hovered && styles.hovered,
            ]}
            activeOpacity={0.6}
            {...contextMenuProps}
          >
            <View style={styles.leftSection}>
              {isSelected && <View style={styles.selectedDot} />}
              {/* El número va delante, en su columna: en misa se busca
                  «la 98», y escondido en gris detrás de «#» al lado del autor
                  costaba encontrarlo. Sin ceros a la izquierda («2», no
                  «02»). En «Buscar general» la pastilla de categoría ya lo
                  lleva. */}
              {!isSearchAllMode && !!song.numericFilenamePart && (
                <Text style={styles.numberColumn}>
                  {parseInt(song.numericFilenamePart, 10) ||
                    song.numericFilenamePart}
                </Text>
              )}
              <View style={styles.songInfoContainer}>
                <Text
                  style={styles.songTitle}
                  numberOfLines={large ? 3 : 1}
                  ellipsizeMode="tail"
                >
                  {cleanTitle}
                </Text>
                <View style={styles.metaLine}>
                  {isSearchAllMode &&
                  song.originalCategoryKey &&
                  song.numericFilenamePart ? (
                    <View style={styles.metaPills}>
                      <View style={[styles.categoryPill, { marginRight: 8 }]}>
                        <Text style={styles.categoryPillText}>
                          {`${song.originalCategoryKey}${song.numericFilenamePart}`}
                        </Text>
                      </View>
                      {!!song.author && (
                        <Text
                          style={styles.authorText}
                          numberOfLines={1}
                          ellipsizeMode="tail"
                        >
                          {song.author}
                        </Text>
                      )}
                    </View>
                  ) : (
                    <View style={styles.metaPills}>
                      {!!song.author && (
                        <Text
                          style={styles.authorText}
                          numberOfLines={1}
                          ellipsizeMode="tail"
                        >
                          {song.author}
                        </Text>
                      )}
                    </View>
                  )}
                  {featuredTags && featuredTags.length > 0 && (
                    // Una pastilla callada, como las del tono: en texto
                    // suelto detrás del autor parecía un segundo autor.
                    <View
                      style={styles.tagPill}
                      accessibilityLabel={`Etiquetas: ${featuredTags
                        .map((t) => t.label)
                        .join(', ')}`}
                    >
                      {featuredTags[0].emoji ? (
                        <Text style={styles.tagPillText}>
                          {featuredTags[0].emoji}
                        </Text>
                      ) : (
                        <MaterialIcons
                          name="local-offer"
                          size={10}
                          color={themeColors(isDark).textMuted}
                        />
                      )}
                      <Text style={styles.tagPillText} numberOfLines={1}>
                        {featuredTags[0].label}
                        {featuredTags.length > 1
                          ? ` +${featuredTags.length - 1}`
                          : ''}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            </View>
            <View style={styles.rightSection}>
              {(kinds.video || kinds.audio || kinds.links) && (
                <View style={styles.mediaIndicators}>
                  {kinds.video && (
                    <MaterialIcons
                      name="play-arrow"
                      size={13}
                      color={mediaIconColor}
                    />
                  )}
                  {kinds.audio && (
                    <MaterialIcons
                      name="headphones"
                      size={12}
                      color={mediaIconColor}
                    />
                  )}
                  {kinds.links && (
                    <MaterialIcons
                      name="link"
                      size={12}
                      color={mediaIconColor}
                    />
                  )}
                </View>
              )}
              {song.capo && song.capo > 0 ? (
                <View style={styles.capoPill}>
                  <Text style={styles.capoText}>{`C${song.capo}`}</Text>
                </View>
              ) : null}
              {song.key ? (
                selectedTranspose !== 0 ? (
                  <View style={styles.toneTransposedWrap}>
                    <Text style={styles.toneOriginalStriked}>
                      {convertChord(song.key.toUpperCase(), notation)}
                    </Text>
                    <View style={styles.keyPillTransposed}>
                      <Text style={styles.keyTextTransposed}>
                        {convertChord(
                          transposeKey(
                            song.key.toUpperCase(),
                            selectedTranspose,
                          ),
                          notation,
                        )}
                      </Text>
                    </View>
                    <Text style={styles.transposeParenLabel}>
                      ({transposeLabel(selectedTranspose)})
                    </Text>
                  </View>
                ) : (
                  <View style={styles.keyPill}>
                    <Text style={styles.keyText}>
                      {convertChord(song.key.toUpperCase(), notation)}
                    </Text>
                  </View>
                )
              ) : null}
              {isWeb && (
                <PressableFeedback
                  onPress={() =>
                    isSelected
                      ? onRemoveSong(song.filename)
                      : onAddSong(song.filename)
                  }
                  style={styles.webSelectButton}
                  accessibilityRole="button"
                  accessibilityLabel={
                    isSelected
                      ? `Quitar «${cleanTitle}» de tu selección`
                      : `Añadir «${cleanTitle}» a tu selección`
                  }
                >
                  <IconSymbol
                    name={isSelected ? 'checkmark.circle.fill' : 'plus.circle'}
                    size={22}
                    color={
                      isSelected ? SwipeColors.add : themeColors(isDark).link
                    }
                  />
                </PressableFeedback>
              )}
            </View>
          </TouchableOpacity>
        </Animated.View>
      </Swipeable>
    );
  },
);

const isWeb = Platform.OS === 'web';

const createStyles = (scheme: 'light' | 'dark' | null) => {
  const isDark = scheme === 'dark';
  return StyleSheet.create({
    songItemOuter: {},
    songItemInner: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderColor: themeColors(isDark).separator,
    },
    noSeparator: {
      borderBottomWidth: 0,
    },
    hovered: {
      backgroundColor: isDark
        ? StateColors.hoverOverlayDark
        : StateColors.hoverOverlay,
    },
    // 44 pt de área táctil; el margen negativo lo come el padding de la fila
    // para que la altura no crezca.
    webSelectButton: {
      width: 44,
      height: 44,
      marginVertical: -spacing.sm,
      marginRight: -spacing.sm,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radii.pillFull,
    },
    leftSection: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      marginRight: 12,
    },
    selectedDot: {
      width: 6,
      height: 6,
      borderRadius: radii.pillFull,
      backgroundColor: SwipeColors.add,
      marginRight: 10,
    },
    songInfoContainer: {
      flex: 1,
    },
    songTitle: {
      ...typography.body,
      color: themeColors(isDark).text,
      fontWeight: '500',
      letterSpacing: -0.2,
    },
    metaLine: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 4,
    },
    metaPills: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    categoryPill: {
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: radii.pillFull,
      backgroundColor: themeColors(isDark).separator,
      borderWidth: 1,
      borderColor: isDark ? SystemGray.dark.gray3 : SystemGray.light.gray4,
    },
    categoryPillText: {
      ...typography.micro,
      fontWeight: '700',
      color: themeColors(isDark).textSecondary,
      fontVariant: ['tabular-nums'],
    },
    numberColumn: {
      ...typography.subhead,
      fontWeight: '600',
      color: themeColors(isDark).textSecondary,
      fontVariant: ['tabular-nums'],
      minWidth: 26,
      marginRight: spacing.xs + 2,
    },
    // Discretas: que se vean sin competir con el título ni el autor.
    tagPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      flexShrink: 1,
      maxWidth: '55%',
      marginLeft: spacing.sm,
      paddingHorizontal: 6,
      paddingVertical: 1,
      borderRadius: radii.pillFull,
      backgroundColor: themeColors(isDark).backgroundSunken,
    },
    tagPillText: {
      ...typography.micro,
      fontWeight: '600',
      color: themeColors(isDark).textSecondary,
      flexShrink: 1,
    },
    authorText: {
      ...typography.caption,
      // Era #8E8E93 en claro: 3,3:1 sobre blanco, por debajo del mínimo.
      color: themeColors(isDark).textSecondary,
      fontStyle: 'italic',
      flex: 1,
    },
    rightSection: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
    },
    mediaIndicators: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      marginRight: 2,
    },
    capoPill: {
      paddingHorizontal: 6,
      paddingVertical: 3,
      borderRadius: radii.xs,
      backgroundColor: isDark ? Colors.dark.card : SystemGray.light.gray5,
    },
    capoText: {
      ...typography.micro,
      fontWeight: '600',
      color: themeColors(isDark).textSecondary,
      fontVariant: ['tabular-nums'],
    },
    keyPill: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: radii.xs,
      backgroundColor: isDark ? KeyPillColors.bgDark : KeyPillColors.bgLight,
    },
    keyText: {
      ...typography.caption,
      fontWeight: '700',
      color: themeColors(isDark).link,
    },
    toneTransposedWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    toneOriginalStriked: {
      ...typography.footnote,
      fontWeight: '500',
      color: themeColors(isDark).textMuted,
      textDecorationLine: 'line-through',
    },
    keyPillTransposed: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 7,
      paddingVertical: 3,
      borderRadius: radii.xs,
      backgroundColor: isDark
        ? HighlightColors.dark.bg
        : HighlightColors.light.bg,
      borderWidth: 1,
      borderColor: isDark
        ? HighlightColors.dark.border
        : HighlightColors.light.border,
    },
    keyTextTransposed: {
      ...typography.caption,
      fontWeight: '700',
      // Antes era el fg de CLARO también en oscuro: #7A5A00 sobre #3A2D0A,
      // ilegible. Mismo fallo que el azul de marca en oscuro (§H4).
      color: isDark ? HighlightColors.dark.fg : HighlightColors.light.fg,
    },
    transposeParenLabel: {
      ...typography.micro,
      fontWeight: '700',
      color: themeColors(isDark).textMuted,
      fontVariant: ['tabular-nums'],
    },
    rightAction: {
      backgroundColor: SwipeColors.add,
      justifyContent: 'center',
      alignItems: 'center',
      width: 100,
    },
    leftAction: {
      backgroundColor: SwipeColors.remove,
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
      ...typography.footnote,
      fontWeight: '600',
      marginTop: 4,
    },
  });
};

const stylesLight = createStyles('light');
const stylesDark = createStyles('dark');

export default SongListItem;
