/**
 * Cabecera del resumen de la playlist: banner de Modo Coro, cuenta de canciones,
 * código de la copia en la nube y el conmutador «Por categoría / Orden ajustado».
 *
 * Extraída de `SelectedSongsScreen` sin tocar el marcado. Va memoizada porque la
 * pantalla se re-renderiza en cada cambio de la selección y esta cabecera solo
 * depende de cuatro props.
 */
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import ChoirSessionBanner from '@/components/playlist/ChoirSessionBanner';
import type { SelectedSongsStyles } from '@/components/playlist/selectedSongsStyles';

export type ViewMode = 'category' | 'manual';

export interface PlaylistHeaderBarProps {
  visibleCount: number;
  lastUploadCode: string | null;
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  styles: SelectedSongsStyles;
}

export const PlaylistHeaderBar = React.memo(function PlaylistHeaderBar({
  visibleCount,
  lastUploadCode,
  viewMode,
  setViewMode,
  styles,
}: PlaylistHeaderBarProps) {
  return (
    <View>
      <ChoirSessionBanner />
      <View style={styles.summaryRow}>
        <View>
          <Text style={styles.selectionCount}>
            {visibleCount} {visibleCount === 1 ? 'canción' : 'canciones'}
          </Text>
          {lastUploadCode ? (
            <Text style={styles.subInfo}>
              ☁️ Guardada con código {lastUploadCode}
            </Text>
          ) : null}
        </View>
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
