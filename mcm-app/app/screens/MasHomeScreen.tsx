import React, { useCallback } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MaterialIcons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';

import { useColorScheme } from '@/hooks/useColorScheme';
import { MasStackParamList } from '../(tabs)/mas';
import { useFeatureFlags } from '@/contexts/FeatureFlagsContext';
import { takePendingMasScreen } from '@/utils/masNavigation';

interface NavigationItem {
  label: string;
  subtitle: string;
  emoji: string;
  materialIcon: ComponentProps<typeof MaterialIcons>['name'];
  target: keyof MasStackParamList;
  tintColor: string;
}

interface FeatureOptions {
  showMonitores: boolean;
  showComunica: boolean;
  showComunicaGestion: boolean;
}

const getAllNavigationItems = (opts: FeatureOptions): NavigationItem[] => {
  const items: NavigationItem[] = [];

  if (opts.showComunica) {
    items.push({
      label: 'Comunica',
      subtitle: 'Portal de comunicación MCM',
      emoji: '📣',
      materialIcon: 'forum',
      target: 'Comunica',
      tintColor: '#E08A3C',
    });
  }

  if (opts.showComunicaGestion) {
    items.push({
      label: 'Gestión',
      subtitle: 'Administración y CRM',
      emoji: '⚙️',
      materialIcon: 'admin-panel-settings',
      target: 'ComunicaGestion',
      tintColor: '#607D8B',
    });
  }

  if (opts.showMonitores) {
    items.push({
      label: 'Monitores',
      subtitle: 'Panel de monitores MCM',
      emoji: '💬',
      materialIcon: 'monitor',
      target: 'MonitoresWeb',
      tintColor: '#5C6BC0',
    });
  }

  items.push({
    label: 'Jubileo',
    subtitle: 'Horarios, materiales, grupos...',
    emoji: '🎉',
    materialIcon: 'celebration',
    target: 'JubileoHome',
    tintColor: '#A3BD31',
  });

  return items;
};

export default function MasHomeScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<MasStackParamList>>();
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const featureFlags = useFeatureFlags();
  const navigationItems = React.useMemo(
    () =>
      getAllNavigationItems({
        showMonitores: featureFlags.showMonitores,
        showComunica: featureFlags.showComunica,
        showComunicaGestion: featureFlags.showComunicaGestion,
      }),
    [
      featureFlags.showMonitores,
      featureFlags.showComunica,
      featureFlags.showComunicaGestion,
    ],
  );

  // Deep-link desde la Home: si hay una pantalla pendiente, navegar a ella
  useFocusEffect(
    useCallback(() => {
      const screen = takePendingMasScreen();
      if (screen) {
        navigation.navigate(screen as keyof MasStackParamList);
      }
    }, [navigation]),
  );

  return (
    <SafeAreaView
      style={[
        styles.safeArea,
        { backgroundColor: isDark ? '#1C1C1E' : '#F2F2F7' },
      ]}
      edges={['top']}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.scrollContent,
          Platform.OS === 'ios' && { paddingBottom: 120 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text
          style={[styles.pageTitle, { color: isDark ? '#fff' : '#1C1C1E' }]}
        >
          Más
        </Text>

        {navigationItems.map((item, idx) => (
          <TouchableOpacity
            key={idx}
            style={[
              styles.card,
              {
                backgroundColor: isDark ? '#2C2C2E' : '#fff',
              },
              Platform.OS !== 'web'
                ? {
                    shadowColor: item.tintColor,
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: isDark ? 0.3 : 0.15,
                    shadowRadius: 12,
                    elevation: 4,
                  }
                : {
                    boxShadow: `0 4px 12px ${item.tintColor}30`,
                  },
            ]}
            onPress={() => navigation.navigate(item.target as any)}
            activeOpacity={0.8}
          >
            {/* Accent bar izquierda */}
            <View
              style={[styles.accentBar, { backgroundColor: item.tintColor }]}
            />

            <View style={styles.cardBody}>
              {/* Icono grande */}
              <View
                style={[
                  styles.iconCircle,
                  { backgroundColor: item.tintColor + '18' },
                ]}
              >
                <Text style={styles.emoji}>{item.emoji}</Text>
              </View>

              {/* Texto */}
              <View style={styles.cardTextArea}>
                <Text
                  style={[
                    styles.cardTitle,
                    { color: isDark ? '#fff' : '#1C1C1E' },
                  ]}
                  numberOfLines={1}
                >
                  {item.label}
                </Text>
                <Text
                  style={[
                    styles.cardSubtitle,
                    { color: isDark ? '#8E8E93' : '#6B7280' },
                  ]}
                  numberOfLines={2}
                >
                  {item.subtitle}
                </Text>
              </View>

              {/* Flecha */}
              <View
                style={[
                  styles.arrowCircle,
                  { backgroundColor: item.tintColor + '15' },
                ]}
              >
                <MaterialIcons
                  name="arrow-forward"
                  size={18}
                  color={item.tintColor}
                />
              </View>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 8,
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  pageTitle: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: 20,
    marginLeft: 4,
  },
  card: {
    borderRadius: 20,
    marginBottom: 14,
    overflow: 'hidden',
  },
  accentBar: {
    height: 4,
    width: '100%',
  },
  cardBody: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 22,
    gap: 16,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  emoji: {
    fontSize: 28,
  },
  cardTextArea: {
    flex: 1,
    gap: 4,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  cardSubtitle: {
    fontSize: 13,
    lineHeight: 18,
  },
  arrowCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
});
