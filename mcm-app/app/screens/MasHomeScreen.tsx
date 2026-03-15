import React from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MaterialIcons } from '@expo/vector-icons';

import { Colors } from '@/constants/colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { MasStackParamList } from '../(tabs)/mas';
import { useFeatureFlags } from '@/contexts/FeatureFlagsContext';

interface NavigationItem {
  label: string;
  subtitle?: string;
  icon: string;
  target: keyof MasStackParamList;
  tintColor: string;
}

interface Section {
  title: string;
  items: NavigationItem[];
}

function getSections(showMonitores: boolean): Section[] {
  const sections: Section[] = [];

  // Sección principal: Eventos
  const eventosItems: NavigationItem[] = [];

  eventosItems.push({
    label: 'Jubileo',
    subtitle: 'Horarios, materiales, grupos...',
    icon: '🎉',
    target: 'JubileoHome',
    tintColor: '#A3BD31',
  });

  sections.push({ title: 'Eventos', items: eventosItems });

  // Sección: Herramientas
  if (showMonitores) {
    sections.push({
      title: 'Herramientas',
      items: [
        {
          label: 'Comunica MCM · Monitores',
          subtitle: 'Panel de monitores',
          icon: '💬',
          target: 'MonitoresWeb',
          tintColor: '#607D8B',
        },
      ],
    });
  }

  return sections;
}

export default function MasHomeScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<MasStackParamList>>();
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const styles = React.useMemo(() => createStyles(scheme), [scheme]);
  const featureFlags = useFeatureFlags();
  const sections = React.useMemo(
    () => getSections(featureFlags.showMonitores),
    [featureFlags.showMonitores],
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
      {sections.map((section, sIdx) => (
        <View key={sIdx} style={styles.section}>
          <Text style={styles.sectionTitle}>{section.title.toUpperCase()}</Text>
          <View style={styles.sectionCards}>
            {section.items.map((item, idx) => (
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
          </View>
        </View>
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
    section: {
      marginBottom: 24,
    },
    sectionTitle: {
      fontSize: 13,
      fontWeight: '600',
      color: isDark ? '#8E8E93' : '#6D6D72',
      letterSpacing: 0.5,
      marginBottom: 8,
      marginLeft: 4,
    },
    sectionCards: {
      gap: 8,
    },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDark ? '#2C2C2E' : '#fff',
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 14,
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
