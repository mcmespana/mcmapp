import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Stack, useRouter, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from '@/hooks/useColorScheme';
import { warm, formatDateLong } from '@/components/contigo/theme';

interface Bookmark {
  date: string;
  readings: any;
  bookmarkedAt: number;
}

const STORAGE = '@contigo_bookmarks';

export default function BookmarksScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const W = warm(isDark);

  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const str = await AsyncStorage.getItem(STORAGE);
      if (str) {
        const parsed = JSON.parse(str);
        const valid: Bookmark[] = parsed
          .filter((b: any) => typeof b !== 'string')
          .sort((a: Bookmark, b: Bookmark) => b.bookmarkedAt - a.bookmarkedAt);
        setBookmarks(valid);
      } else {
        setBookmarks([]);
      }
    } catch (e) {
      console.error('bookmarks load', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const removeBookmark = async (date: string) => {
    const next = bookmarks.filter((b) => b.date !== date);
    setBookmarks(next);
    try {
      await AsyncStorage.setItem(STORAGE, JSON.stringify(next));
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <LinearGradient
        colors={
          isDark
            ? (['#1A1712', '#100F0C'] as const)
            : (['#FAF6F0', '#F0E8D8'] as const)
        }
        style={StyleSheet.absoluteFill}
      />

      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + 12,
            backgroundColor: isDark
              ? 'rgba(26,23,18,0.92)'
              : 'rgba(250,246,240,0.92)',
            borderBottomColor: W.border,
          },
        ]}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={[
            styles.iconBtn,
            {
              backgroundColor: isDark
                ? 'rgba(255,255,255,0.08)'
                : 'rgba(0,0,0,0.06)',
            },
          ]}
          accessibilityLabel="Volver"
        >
          <MaterialIcons name="arrow-back-ios-new" size={18} color={W.text} />
        </TouchableOpacity>
        <View>
          <Text style={[styles.title, { color: W.text }]}>Guardados</Text>
          <Text style={[styles.subtitle, { color: W.textSec }]}>
            {bookmarks.length} evangelio
            {bookmarks.length !== 1 ? 's' : ''} guardado
            {bookmarks.length !== 1 ? 's' : ''}
          </Text>
        </View>
        <View style={{ width: 36 }} />
      </View>

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
        <ScrollView
          contentContainerStyle={styles.listWrap}
          showsVerticalScrollIndicator={false}
        >
          {bookmarks.map((b) => {
            const ev = b.readings?.evangelio;
            const titulo =
              b.readings?.info?.titulo || ev?.cita || 'Evangelio guardado';
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
                  colors={['#E8A838', '#C4922A']}
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
        </ScrollView>
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
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 20, fontWeight: '800', letterSpacing: -0.5 },
  subtitle: { fontSize: 12, marginTop: 2 },

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
    paddingBottom: 60,
    gap: 12,
  },
  card: {
    borderRadius: 18,
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
  removeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
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
    fontSize: 13,
    lineHeight: 20,
    fontStyle: 'italic',
    marginBottom: 12,
  },
  openBtn: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
  },
  openText: { fontSize: 11, fontWeight: '700' },
});
