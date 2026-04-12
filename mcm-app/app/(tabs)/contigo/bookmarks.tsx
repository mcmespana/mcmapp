import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Stack, useRouter, useFocusEffect } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/colors';
import { radii, shadows } from '@/constants/uiStyles';
import { getLiturgicalInfo } from '@/components/contigo/LiturgicalBadge';

const CONTIGO = {
  light: {
    accent: '#B8860B',       
    accentSoft: '#FFF8E7',   
    surface: '#FEFBF5',      
    warmGray: '#6B6560',     
  },
  dark: {
    accent: '#DAA520',       
    accentSoft: '#2A2112',   
    surface: '#1C1A17',      
    warmGray: '#A09A94',     
  },
};

interface Bookmark {
  date: string;
  readings: any;
  bookmarkedAt: number;
}

export default function BookmarksScreen() {
  const router = useRouter();
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const theme = Colors[scheme ?? 'light'];
  const warm = isDark ? CONTIGO.dark : CONTIGO.light;
  
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      const load = async () => {
        try {
          const str = await AsyncStorage.getItem('@contigo_bookmarks');
          if (str && isActive) {
            const parsed = JSON.parse(str);
            // filter out old string format, sort by newest
            const valid = parsed
                .filter((b: any) => typeof b !== 'string')
                .sort((a: Bookmark, b: Bookmark) => b.bookmarkedAt - a.bookmarkedAt);
            setBookmarks(valid);
          }
        } catch(e) {
          console.error(e);
        } finally {
          if (isActive) setIsLoading(false);
        }
      };
      load();
      return () => { isActive = false; };
    }, [])
  );

  return (
    <View style={[styles.container, { backgroundColor: warm.surface }]}>
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitle: 'Días Favoritos',
          headerBackTitle: 'Contigo',
          headerStyle: {
            backgroundColor: warm.surface,
          },
          headerTintColor: theme.text,
          headerTitleStyle: {
            fontWeight: '700',
            fontSize: 17,
          },
          headerShadowVisible: false,
        }}
      />
      
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={warm.accent} />
        </View>
      ) : bookmarks.length === 0 ? (
        <View style={styles.center}>
          <MaterialIcons name="bookmark-border" size={64} color={warm.warmGray} style={{ marginBottom: 16 }} />
          <Text style={[styles.emptyText, { color: theme.text }]}>No tienes lecturas guardadas</Text>
          <Text style={[styles.emptySubtext, { color: warm.warmGray }]}>
            Pulsa el icono de guardado mientras lees el Evangelio para conservarlo aquí, incluso sin conexión.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          {bookmarks.map((b) => {
            const info = getLiturgicalInfo(b.date);
            const displayTitle = b.readings?.info?.titulo || info.title || 'Evangelio';
            const evangelio = b.readings?.evangelio;

            return (
              <TouchableOpacity
                key={b.date}
                activeOpacity={0.7}
                style={[
                  styles.card,
                  {
                    backgroundColor: theme.card,
                    borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
                  }
                ]}
                onPress={() => router.push({
                   pathname: '/contigo/evangelio',
                   params: { date: b.date }
                })}
              >
                <View style={styles.cardHeader}>
                  <Text style={[styles.dateText, { color: warm.accent }]}>
                    {b.date}
                  </Text>
                </View>
                <Text style={[styles.title, { color: theme.text }]} numberOfLines={2}>
                  {displayTitle}
                </Text>
                {evangelio?.cita && (
                  <Text style={[styles.citaText, { color: warm.warmGray }]}>
                    {evangelio.cita}
                  </Text>
                )}
                {evangelio?.texto && (
                  <Text style={[styles.preview, { color: theme.text }]} numberOfLines={3}>
                    {evangelio.texto.replace(/\n/g, ' ')}
                  </Text>
                )}
                
                <View style={styles.cardFooter}>
                  <Text style={[styles.readMore, { color: warm.accent }]}>Leer de nuevo</Text>
                  <MaterialIcons name="arrow-forward" size={14} color={warm.accent} />
                </View>
              </TouchableOpacity>
            )
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  scroll: {
    padding: 16,
    paddingBottom: 40,
    gap: 12,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  card: {
    padding: 16,
    borderRadius: radii.xl,
    borderWidth: 1,
    ...shadows.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  dateText: {
    fontSize: 13,
    fontWeight: '700',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  citaText: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 10,
  },
  preview: {
    fontSize: 15,
    lineHeight: 22,
    opacity: 0.8,
    marginBottom: 16,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  readMore: {
    fontSize: 14,
    fontWeight: '700',
  }
});
