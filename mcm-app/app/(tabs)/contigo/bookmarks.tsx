import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  useWindowDimensions,
  Platform,
} from 'react-native';
import { Stack, useRouter, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated from 'react-native-reanimated';
import { useTabScroll } from '@/components/tabs/useTabScroll';
import { useColorScheme } from '@/hooks/useColorScheme';
import {
  WARM_DARK,
  WARM_LIGHT,
  formatDateLong,
  warm,
} from '@/components/contigo/theme';
import { useReaderBookmarks } from '@/hooks/useReaderBookmarks';
import { countHighlights } from '@/utils/contigoBookmarks';
import typography from '@/constants/typography';
import { radii } from '@/constants/uiStyles';

export default function BookmarksScreen() {
  // Subruta de Contigo: se registra con la clave del tab (gana el último
  // montado), así el re-tap sube el scroll de la pantalla que se está viendo.
  const { scrollRef, onScroll, contentPaddingBottom } = useTabScroll('contigo');
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const W = warm(isDark);
  const { width: windowWidth } = useWindowDimensions();
  const isWide = windowWidth >= 720;
  const wideWrapperStyle = isWide
    ? {
        width: '100%' as const,
        maxWidth: windowWidth >= 1100 ? 880 : 720,
        alignSelf: 'center' as const,
      }
    : undefined;

  const { bookmarks, isLoading, removeBookmark, reload } = useReaderBookmarks();

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  return (
    <View style={styles.container}>
      {/* Header NATIVO: back del sistema (con gota iOS 26) + título. */}
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitle: 'Guardados',
          headerTransparent: true,
          headerBackButtonDisplayMode: 'minimal',
          headerShadowVisible: false,
          headerTintColor: W.text,
          headerTitleStyle: { color: W.text, fontWeight: '700', fontSize: 17 },
          ...(Platform.OS === 'ios' &&
          parseInt(String(Platform.Version), 10) < 26
            ? { headerBlurEffect: 'systemChromeMaterial' as const }
            : {}),
        }}
      />
      <LinearGradient
        colors={
          isDark
            ? ([WARM_DARK.bg, WARM_DARK.bgDeep] as const)
            : ([WARM_LIGHT.bg, '#F0E8D8'] as const)
        }
        style={StyleSheet.absoluteFill}
      />

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={W.accent} />
        </View>
      ) : bookmarks.length === 0 ? (
        <View style={styles.center}>
          <Text style={{ fontSize: 48 }}>🔖</Text>
          <Text style={[styles.emptyTitle, { color: W.text }]}>
            Sin guardados aún
          </Text>
          <Text style={[styles.emptyText, { color: W.textSec }]}>
            Guarda evangelios para releerlos cuando quieras
          </Text>
        </View>
      ) : (
        <Animated.ScrollView
          ref={scrollRef}
          onScroll={onScroll}
          scrollEventThrottle={16}
          contentContainerStyle={[
            styles.listWrap,
            {
              paddingTop: insets.top + 56,
              paddingBottom: contentPaddingBottom,
            },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <View style={wideWrapperStyle}>
            <Text style={[styles.countLabel, { color: W.textSec }]}>
              {bookmarks.length} evangelio
              {bookmarks.length !== 1 ? 's' : ''} guardado
              {bookmarks.length !== 1 ? 's' : ''}
            </Text>
            {bookmarks.map((b) => {
              const ev = b.readings?.evangelio;
              const titulo =
                b.readings?.info?.titulo || ev?.cita || 'Evangelio guardado';
              const nHighlights = countHighlights(b);
              const firstLine = ev?.texto
                ? ev.texto
                    .split('\n')
                    .map((l: string) => l.trim())
                    .filter(Boolean)[0]
                : '';
              return (
                <View
                  key={b.date}
                  style={[
                    styles.card,
                    {
                      backgroundColor: W.bgCard,
                      borderColor: W.border,
                      shadowColor: W.shadow,
                    },
                  ]}
                >
                  <LinearGradient
                    colors={['#E8A838', WARM_LIGHT.accent]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.cardBar}
                  />
                  <View style={styles.cardBody}>
                    <View style={styles.cardHdrRow}>
                      <View style={{ flex: 1 }}>
                        {ev?.cita ? (
                          <Text
                            style={[styles.cita, { color: W.accent }]}
                            numberOfLines={1}
                          >
                            {ev.cita}
                          </Text>
                        ) : null}
                        <Text
                          style={[styles.dateText, { color: W.textMuted }]}
                          numberOfLines={1}
                        >
                          {formatDateLong(b.date)}
                        </Text>
                        {nHighlights > 0 ? (
                          <View style={styles.hlChipRow}>
                            <MaterialIcons
                              name="border-color"
                              size={11}
                              color={W.accent}
                            />
                            <Text
                              style={[styles.hlChipText, { color: W.accent }]}
                            >
                              {nHighlights} subrayado
                              {nHighlights !== 1 ? 's' : ''}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                      <TouchableOpacity
                        onPress={() => removeBookmark(b.date)}
                        style={[
                          styles.removeBtn,
                          {
                            backgroundColor: isDark
                              ? 'rgba(255,255,255,0.08)'
                              : 'rgba(0,0,0,0.05)',
                          },
                        ]}
                        accessibilityLabel="Quitar de guardados"
                      >
                        <MaterialIcons
                          name="close"
                          size={14}
                          color={W.textMuted}
                        />
                      </TouchableOpacity>
                    </View>
                    <Text
                      style={[styles.cardTitle, { color: W.text }]}
                      numberOfLines={2}
                    >
                      {titulo}
                    </Text>
                    {firstLine ? (
                      <Text
                        style={[styles.preview, { color: W.textSec }]}
                        numberOfLines={2}
                      >
                        «{firstLine.replace(/^«|»$/g, '').trim()}»
                      </Text>
                    ) : null}
                    <TouchableOpacity
                      onPress={() =>
                        router.push({
                          pathname: '/(tabs)/contigo/evangelio',
                          params: { date: b.date },
                        } as never)
                      }
                      style={[
                        styles.openBtn,
                        {
                          backgroundColor: isDark
                            ? 'rgba(218,165,32,0.10)'
                            : 'rgba(196,146,42,0.09)',
                          borderColor: W.border,
                        },
                      ]}
                    >
                      <Text style={[styles.openText, { color: W.accent }]}>
                        Leer evangelio →
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        </Animated.ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 14,
    gap: 12,
    borderBottomWidth: 1,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: radii.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 20, fontWeight: '800', letterSpacing: -0.5 },
  subtitle: { fontSize: 12, marginTop: 2 },
  countLabel: {
    ...typography.footnote,
    fontWeight: '600',
    marginBottom: 12,
    paddingHorizontal: 4,
  },

  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 12,
  },
  emptyTitle: { fontSize: 17, fontWeight: '700' },
  emptyText: { fontSize: 13, textAlign: 'center', lineHeight: 20 },

  listWrap: {
    padding: 16,
    gap: 12,
  },
  card: {
    borderRadius: radii.xl,
    overflow: 'hidden',
    borderWidth: 1,
  },
  cardBar: { height: 3 },
  cardBody: { padding: 14 },
  cardHdrRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  cita: { fontSize: 13, fontWeight: '700', marginBottom: 2 },
  dateText: { fontSize: 11 },
  hlChipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 4,
  },
  hlChipText: { fontSize: 11, fontWeight: '700' },
  removeBtn: {
    width: 28,
    height: 28,
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.2,
    marginBottom: 8,
  },
  preview: {
    ...typography.caption,
    lineHeight: 20,
    fontStyle: 'italic',
    marginBottom: 12,
  },
  openBtn: {
    alignSelf: 'flex-start',
    borderRadius: radii.pillFull,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
  },
  openText: { fontSize: 11, fontWeight: '700' },
});
