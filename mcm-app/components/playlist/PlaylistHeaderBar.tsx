/**
 * Cabecera del resumen de la playlist: banner de Modo Coro, cuenta de
 * canciones, **estado de sincronización con el coro** y el conmutador
 * «Por categoría / Orden ajustado».
 *
 * El estado es la parte nueva y la que más preguntas quita de encima: dice si
 * lo que ves es lo que hay subido («guardada en X») o si has tocado algo desde
 * entonces («cambios sin guardar»), y al tocarlo lleva directo a guardar. Antes
 * solo se veía un código de 4 dígitos, que no contaba ninguna de las dos cosas.
 *
 * Va memoizada porque la pantalla se re-renderiza en cada cambio de la
 * selección y esta cabecera solo depende de sus props.
 */
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import ChoirSessionBanner from '@/components/playlist/ChoirSessionBanner';
import type { SelectedSongsStyles } from '@/components/playlist/selectedSongsStyles';
import type { PlaylistLink } from '@/hooks/usePlaylistLink';
import { formatRelativeDate } from '@/utils/playlistSync';

export type ViewMode = 'category' | 'manual';

export interface PlaylistHeaderBarProps {
  visibleCount: number;
  /** Enlace con la copia en la nube, si la playlist viene de/ha ido a un coro. */
  link: PlaylistLink | null;
  /** ¿Coincide lo que ves con lo subido? */
  isSynced: boolean;
  onPressStatus: () => void;
  onClear: () => void;
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  styles: SelectedSongsStyles;
}

export const PlaylistHeaderBar = React.memo(function PlaylistHeaderBar({
  visibleCount,
  link,
  isSynced,
  onPressStatus,
  onClear,
  viewMode,
  setViewMode,
  styles,
}: PlaylistHeaderBarProps) {
  const statusLabel = link
    ? isSynced
      ? `☁️ ${link.choirName ? `Guardada en ${link.choirName}` : 'Guardada'}${
          link.syncedAt ? ` · ${formatRelativeDate(link.syncedAt)}` : ''
        }`
      : `✏️ Cambios sin guardar en «${link.name ?? link.code}»`
    : null;

  return (
    <View>
      <ChoirSessionBanner />
      <View style={styles.summaryRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.selectionCount}>
            {visibleCount} {visibleCount === 1 ? 'canción' : 'canciones'}
          </Text>
          {statusLabel ? (
            <TouchableOpacity onPress={onPressStatus} hitSlop={6}>
              <Text
                style={[styles.subInfo, !isSynced && styles.subInfoDirty]}
                numberOfLines={1}
              >
                {statusLabel}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
        {visibleCount > 0 ? (
          <TouchableOpacity
            onPress={onClear}
            style={styles.clearBtn}
            hitSlop={6}
            accessibilityLabel="Vaciar la playlist"
          >
            <MaterialIcons name="delete-sweep" size={18} color="#8E8E93" />
            <Text style={styles.clearBtnText}>Vaciar</Text>
          </TouchableOpacity>
        ) : null}
        {visibleCount > 1 ? (
          <View style={styles.viewToggle}>
            <TouchableOpacity
              onPress={() => setViewMode('category')}
              style={[
                styles.viewToggleBtn,
                viewMode === 'category' && styles.viewToggleBtnActive,
              ]}
            >
              <Text
                style={[
                  styles.viewToggleText,
                  viewMode === 'category' && styles.viewToggleTextActive,
                ]}
              >
                Por categoría
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setViewMode('manual')}
              style={[
                styles.viewToggleBtn,
                viewMode === 'manual' && styles.viewToggleBtnActive,
              ]}
            >
              <Text
                style={[
                  styles.viewToggleText,
                  viewMode === 'manual' && styles.viewToggleTextActive,
                ]}
              >
                Orden ajustado
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
    </View>
  );
});
