import React from 'react';
import {
  Dimensions,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useToast } from '@/contexts/AppToastContext';
import { h } from '@/utils/haptics';
import BottomSheet from '@/components/BottomSheet';
import brand from '@/constants/colors';
import { toDrivePreviewUrl } from '@/utils/googleDrive';
import type { MediaLink, SongMedia } from '@/types/songMedia';
import type { FloatingMediaSource } from '@/components/song-media/FloatingMediaPlayer';

interface SongMediaSheetProps {
  visible: boolean;
  onClose: () => void;
  media: SongMedia | null;
  /** Título de la canción — se usa como etiqueta del reproductor flotante. */
  songTitle?: string;
  /** Abre el reproductor flotante con la fuente indicada (vídeo o audio). */
  onPlayMedia: (source: FloatingMediaSource) => void;
}

const YT_RED = '#FF3B30';
const SCREEN_HEIGHT = Dimensions.get('window').height;

/** ¿El texto parece una URL / dominio que tenga sentido abrir en el navegador? */
function isUrlLike(value: string): boolean {
  const v = value.trim();
  if (/^https?:\/\//i.test(v)) return true;
  // Dominio simple tipo "doceacordes.es" o "a.b/c" sin espacios.
  return /^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(v);
}

function toHref(value: string): string {
  const v = value.trim();
  return /^https?:\/\//i.test(v) ? v : `https://${v}`;
}

export default function SongMediaSheet({
  visible,
  onClose,
  media,
  songTitle,
  onPlayMedia,
}: SongMediaSheetProps) {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const { toast } = useToast();
  const styles = React.useMemo(() => createStyles(isDark), [isDark]);

  if (!media) return null;

  const hasVideos = Boolean(
    media.videoEmbed || (media.youtubeLinks && media.youtubeLinks.length > 0),
  );
  const hasAudios = Boolean(media.audioLinks && media.audioLinks.length > 0);
  const fichaChips: { label: string; value: string }[] = [
    media.rhythm ? { label: 'Ritmo', value: media.rhythm } : null,
    media.album ? { label: 'Álbum', value: media.album } : null,
    media.liturgicalTime
      ? { label: 'T. litúrgico', value: media.liturgicalTime }
      : null,
  ].filter((x): x is { label: string; value: string } => x !== null);
  const hasFicha = Boolean(fichaChips.length > 0 || media.info || media.source);

  const openExternal = async (url: string) => {
    h.tap();
    toast.show({ label: 'Abriendo en el navegador…' });
    try {
      await WebBrowser.openBrowserAsync(url);
    } catch {
      /* el usuario verá que no se abrió; nada más que hacer */
    }
  };

  const playVideo = (embedUrl: string, label: string) => {
    h.tap();
    onPlayMedia({ kind: 'youtube', url: embedUrl, label });
  };

  // Audio: si es un enlace de Drive reconocible, suena en el reproductor
  // flotante (URL de preview embebible); si no, cae al navegador.
  const playAudio = (link: MediaLink) => {
    const previewUrl = toDrivePreviewUrl(link.url);
    if (!previewUrl) {
      void openExternal(link.url);
      return;
    }
    h.tap();
    onPlayMedia({
      kind: 'drive',
      url: previewUrl,
      label: link.label || 'Audio',
    });
  };

  const renderVideoRow = (
    embedUrl: string,
    label: string,
    isMain: boolean,
    key: string,
  ) => (
    <TouchableOpacity
      key={key}
      style={styles.mRow}
      activeOpacity={0.7}
      onPress={() => playVideo(embedUrl, label)}
    >
      <View style={[styles.mIco, styles.mIcoYt]}>
        <MaterialIcons name="smart-display" size={22} color={YT_RED} />
      </View>
      <View style={styles.mMain}>
        <Text style={styles.mTitle} numberOfLines={1}>
          {label}
        </Text>
        <Text style={styles.mMeta}>YouTube</Text>
      </View>
      {isMain && (
        <View style={styles.floatTag}>
          <Text style={styles.floatTagText}>FLOTANTE</Text>
        </View>
      )}
      <View style={styles.mGo}>
        <MaterialIcons name="play-arrow" size={20} color={brand.primary} />
      </View>
    </TouchableOpacity>
  );

  const renderAudioRow = (link: MediaLink, index: number) => {
    const playsInApp = Boolean(toDrivePreviewUrl(link.url));
    return (
      <TouchableOpacity
        key={`audio-${index}`}
        style={styles.mRow}
        activeOpacity={0.7}
        onPress={() => playAudio(link)}
      >
        <View style={[styles.mIco, styles.mIcoDrive]}>
          <MaterialIcons
            name="headphones"
            size={20}
            color={driveTint(isDark)}
          />
        </View>
        <View style={styles.mMain}>
          <Text style={styles.mTitle} numberOfLines={1}>
            {link.label || 'Audio'}
          </Text>
          <Text style={styles.mMeta}>
            {playsInApp ? 'Google Drive' : 'Enlace externo'}
          </Text>
        </View>
        {playsInApp && (
          <TouchableOpacity
            style={[styles.mGo, styles.mGoExt]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            onPress={() => openExternal(link.url)}
            accessibilityLabel="Abrir en el navegador"
          >
            <MaterialIcons name="open-in-new" size={17} color="#8E8E93" />
          </TouchableOpacity>
        )}
        <View style={styles.mGo}>
          <MaterialIcons
            name={playsInApp ? 'play-arrow' : 'open-in-new'}
            size={playsInApp ? 20 : 17}
            color={playsInApp ? brand.primary : '#8E8E93'}
          />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Multimedia y ficha">
      <ScrollView
        style={{ maxHeight: SCREEN_HEIGHT * 0.62 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* ── VÍDEOS ── */}
        {hasVideos && (
          <View style={styles.section}>
            <View style={styles.secHead}>
              <MaterialIcons
                name="smart-display"
                size={15}
                color={isDark ? '#8E8E93' : '#8E8E93'}
              />
              <Text style={styles.secHeadText}>Vídeos</Text>
            </View>
            {media.videoEmbed &&
              renderVideoRow(
                media.videoEmbed,
                songTitle || 'Vídeo principal',
                true,
                'main-video',
              )}
            {media.youtubeLinks?.map((link, i) =>
              renderVideoRow(link.url, link.label || 'Vídeo', false, `yt-${i}`),
            )}
          </View>
        )}

        {/* ── AUDIOS ── */}
        {hasAudios && (
          <View style={styles.section}>
            <View style={styles.secHead}>
              <MaterialIcons
                name="headphones"
                size={15}
                color={isDark ? '#8E8E93' : '#8E8E93'}
              />
              <Text style={styles.secHeadText}>Audios</Text>
              <Text style={styles.secHint}>reproductor flotante</Text>
            </View>
            {media.audioLinks?.map(renderAudioRow)}
          </View>
        )}

        {/* ── FICHA ── */}
        {hasFicha && (
          <View style={styles.section}>
            <View style={styles.secHead}>
              <MaterialIcons
                name="info-outline"
                size={15}
                color={isDark ? '#8E8E93' : '#8E8E93'}
              />
              <Text style={styles.secHeadText}>Ficha</Text>
            </View>

            {fichaChips.length > 0 && (
              <View style={styles.fichaGrid}>
                {fichaChips.map((chip) => (
                  <View key={chip.label} style={styles.fichaChip}>
                    <Text style={styles.fk}>{chip.label.toUpperCase()}</Text>
                    <Text style={styles.fv}>{chip.value}</Text>
                  </View>
                ))}
              </View>
            )}

            {media.info && (
              <Text style={styles.fichaComment}>{media.info}</Text>
            )}

            {media.source &&
              (isUrlLike(media.source) ? (
                <TouchableOpacity
                  style={styles.fichaSource}
                  activeOpacity={0.7}
                  onPress={() => openExternal(toHref(media.source as string))}
                >
                  <MaterialIcons name="link" size={17} color={brand.primary} />
                  <Text style={styles.fichaSourceText} numberOfLines={1}>
                    {media.source}
                  </Text>
                  <MaterialIcons
                    name="open-in-new"
                    size={15}
                    color={isDark ? '#8E8E93' : '#8E8E93'}
                  />
                </TouchableOpacity>
              ) : (
                <View style={styles.fichaSource}>
                  <MaterialIcons name="link" size={17} color={brand.primary} />
                  <Text style={styles.fichaSourceText} numberOfLines={1}>
                    {media.source}
                  </Text>
                </View>
              ))}
          </View>
        )}
      </ScrollView>
    </BottomSheet>
  );
}

function driveTint(isDark: boolean): string {
  return isDark ? brand.secondary : brand.primary;
}

const createStyles = (isDark: boolean) =>
  StyleSheet.create({
    scrollContent: {
      paddingBottom: 12,
    },
    section: {
      marginBottom: 18,
    },
    secHead: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 6,
      marginBottom: 9,
      paddingHorizontal: 4,
    },
    secHeadText: {
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 0.9,
      textTransform: 'uppercase',
      color: '#8E8E93',
    },
    secHint: {
      marginLeft: 'auto',
      fontSize: 10,
      fontWeight: '600',
      fontStyle: 'italic',
      color: isDark ? '#7C7C80' : '#A8A8AD',
    },
    // ── media rows ──
    mRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 11,
      paddingHorizontal: 12,
      backgroundColor: isDark ? '#2C2C2E' : '#F7F7F9',
      borderRadius: 13,
      marginBottom: 8,
    },
    mIco: {
      width: 34,
      height: 34,
      borderRadius: 9,
      alignItems: 'center',
      justifyContent: 'center',
    },
    mIcoYt: {
      backgroundColor: '#FFFFFF',
      ...Platform.select({
        web: { boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.06)' } as any,
        default: {
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: 'rgba(0,0,0,0.08)',
        },
      }),
    },
    mIcoDrive: {
      backgroundColor: isDark
        ? 'rgba(149,210,242,0.16)'
        : 'rgba(37,56,131,0.10)',
    },
    mMain: {
      flex: 1,
      minWidth: 0,
    },
    mTitle: {
      fontSize: 14.5,
      fontWeight: '600',
      letterSpacing: -0.2,
      color: isDark ? '#F5F5F7' : '#1C1C1E',
    },
    mMeta: {
      fontSize: 11.5,
      color: '#8E8E93',
      marginTop: 1,
    },
    floatTag: {
      backgroundColor: 'rgba(244,193,30,0.28)',
      paddingVertical: 3,
      paddingHorizontal: 7,
      borderRadius: 7,
    },
    floatTagText: {
      fontSize: 9.5,
      fontWeight: '800',
      letterSpacing: 0.4,
      color: '#9a7400',
    },
    mGo: {
      width: 26,
      height: 26,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
    },
    mGoExt: {},
    // ── ficha ──
    fichaGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginHorizontal: 4,
      marginBottom: 12,
    },
    fichaChip: {
      backgroundColor: isDark ? '#3A3A3C' : '#F2F2F7',
      borderRadius: 11,
      paddingVertical: 7,
      paddingHorizontal: 12,
      minWidth: 96,
    },
    fk: {
      fontSize: 9.5,
      fontWeight: '800',
      letterSpacing: 0.5,
      color: '#8E8E93',
    },
    fv: {
      fontSize: 13.5,
      fontWeight: '600',
      letterSpacing: -0.2,
      color: isDark ? '#F5F5F7' : '#1C1C1E',
      marginTop: 2,
    },
    fichaComment: {
      fontSize: 13.5,
      lineHeight: 20,
      color: isDark ? '#D0D0D2' : '#48484A',
      marginHorizontal: 4,
      marginBottom: 12,
      paddingVertical: 12,
      paddingHorizontal: 14,
      backgroundColor: isDark
        ? 'rgba(149,210,242,0.10)'
        : 'rgba(149,210,242,0.14)',
      borderRadius: 13,
      borderLeftWidth: 3,
      borderLeftColor: brand.secondary,
    },
    fichaSource: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginHorizontal: 4,
      paddingVertical: 9,
      paddingHorizontal: 12,
      borderRadius: 11,
      backgroundColor: isDark
        ? 'rgba(149,210,242,0.10)'
        : 'rgba(37,56,131,0.06)',
    },
    fichaSourceText: {
      flex: 1,
      fontSize: 13,
      fontWeight: '600',
      color: isDark ? '#9FD3F5' : brand.primary,
    },
  });
