import React, { useCallback } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MaterialIcons } from '@expo/vector-icons';

import { useColorScheme } from '@/hooks/useColorScheme';
import { MasStackParamList } from '../(tabs)/mas';
import { useFeatureFlags } from '@/contexts/FeatureFlagsContext';
import { takePendingMasScreen } from '@/utils/masNavigation';

interface NavigationItem {
  label: string;
  subtitle?: string;
  icon: string;
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
      icon: '📣',
      target: 'Comunica',
      tintColor: '#E08A3C',
    });
  }

  if (opts.showComunicaGestion) {
    items.push({
      label: 'Comunica Gestión',
      icon: '⚙️',
      target: 'ComunicaGestion',
      tintColor: '#607D8B',
    });
  }

  if (opts.showMonitores) {
    items.push({
      label: 'Comunica MCM · Monitores',
      subtitle: 'Panel de monitores',
      icon: '💬',
      target: 'MonitoresWeb',
      tintColor: '#607D8B',
    });
  }

  items.push({
    label: 'Jubileo',
    subtitle: 'Horarios, materiales, grupos...',
    icon: '🎉',
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
  const styles = React.useMemo(() => createStyles(scheme), [scheme]);
  const featureFlags = useFeatureFlags();
  const navigationItems = React.useMemo(
    () =>
      getAllNavigationItems({
        showMonitores: featureFlags.showMonitores,
        showComunica: featureFlags.showComunica,
        showComunicaGestion: featureFlags.showComunicaGestion,
      }),
    [featureFlags.showMonitores, featureFlags.showComunica, featureFlags.showComunicaGestion],
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
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.scrollContent,
        Platform.OS === 'ios' && { paddingBottom: 100 },
      ]}
      showsVerticalScrollIndicator={false}
    >
      {navigationItems.map((item, idx) => (
        <TouchableOpacity
          key={idx}
          style={styles.card}
          onPress={() => navigation.navigate(item.target as any)}
          activeOpacity={0.7}
        >
          <View
            style={[
              styles.cardEmoji,
              { backgroundColor: item.tintColor + '20' },
            ]}
          >
            <Text style={styles.emojiText}>{item.icon}</Text>
          </View>
          <View style={styles.cardContent}>
            <Text style={styles.cardTitle} numberOfLines={1}>
              {item.label}
            </Text>
            {item.subtitle && (
              <Text style={styles.cardSubtitle} numberOfLines={1}>
                {item.subtitle}
              </Text>
            )}
          </View>
          <MaterialIcons
            name="chevron-right"
            size={20}
            color={isDark ? '#555' : '#C7C7CC'}
          />
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const createStyles = (scheme: 'light' | 'dark') => {
  const isDark = scheme === 'dark';
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDark ? '#1C1C1E' : '#F2F2F7',
    },
    scrollContent: {
      paddingTop: 16,
      paddingHorizontal: 16,
      paddingBottom: 32,
    },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDark ? '#2C2C2E' : '#fff',
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 14,
      marginBottom: 8,
      ...(Platform.OS === 'web'
        ? {
            boxShadow: isDark
              ? '0 1px 3px rgba(0,0,0,0.4)'
              : '0 1px 3px rgba(0,0,0,0.06)',
          }
        : {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: isDark ? 0.25 : 0.04,
            shadowRadius: 3,
            elevation: 1,
          }),
    },
    cardEmoji: {
      width: 42,
      height: 42,
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 14,
    },
    emojiText: {
      fontSize: 22,
    },
    cardContent: {
      flex: 1,
    },
    cardTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: isDark ? '#FFFFFF' : '#1C1C1E',
      letterSpacing: -0.2,
    },
    cardSubtitle: {
      fontSize: 13,
      color: isDark ? '#8E8E93' : '#8E8E93',
      marginTop: 2,
    },
  });
};
