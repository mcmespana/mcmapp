import React, { useCallback } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  ViewStyle,
  TextStyle,
  useWindowDimensions,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { Colors } from '@/constants/colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import spacing from '@/constants/spacing';
import typography from '@/constants/typography';
import { MasStackParamList } from '../(tabs)/mas';
import { useFeatureFlags } from '@/contexts/FeatureFlagsContext';
import { takePendingMasScreen } from '@/utils/masNavigation';

interface NavigationItem {
  label: string;
  icon: string;
  target: keyof MasStackParamList;
  backgroundColor: string;
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
      backgroundColor: '#E08A3C',
    });
  }

  if (opts.showComunicaGestion) {
    items.push({
      label: 'Comunica Gestión',
      icon: '⚙️',
      target: 'ComunicaGestion',
      backgroundColor: '#607D8B',
    });
  }

  if (opts.showMonitores) {
    items.push({
      label: 'Comunica MCM · Monitores',
      icon: '💬',
      target: 'MonitoresWeb',
      backgroundColor: '#607D8B',
    });
  }

  items.push({
    label: 'Jubileo',
    icon: '🎉',
    target: 'JubileoHome',
    backgroundColor: '#A3BD31',
  });

  // Aquí puedes agregar más secciones archivadas en el futuro

  return items;
};

export default function MasHomeScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<MasStackParamList>>();
  const scheme = useColorScheme();
  const styles = React.useMemo(() => createStyles(scheme), [scheme]);
  const { width } = useWindowDimensions();
  const containerPadding = spacing.lg;
  const iconSize = 48;
  const labelFontSize = 18;
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
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={[
            styles.listContainer,
            {
              paddingHorizontal: containerPadding,
              backgroundColor: Colors[scheme].background,
            },
          ]}
        >
          {navigationItems.map((item, idx) => (
            <TouchableOpacity
              key={idx}
              style={[
                styles.item,
                {
                  backgroundColor: item.backgroundColor,
                },
              ]}
              onPress={() => navigation.navigate(item.target as any)}
              activeOpacity={0.85}
            >
              <Text
                style={[
                  styles.iconPlaceholder,
                  { color: '#fff', fontSize: iconSize },
                ]}
              >
                {item.icon}
              </Text>
              <Text
                style={[
                  styles.rectangleLabel,
                  { color: '#fff', fontSize: labelFontSize },
                ]}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

interface Styles {
  container: ViewStyle;
  scrollView: ViewStyle;
  scrollContent: ViewStyle;
  listContainer: ViewStyle;
  item: ViewStyle;
  iconPlaceholder: TextStyle;
  rectangleLabel: TextStyle;
}

const createStyles = (scheme: 'light' | 'dark') => {
  const theme = Colors[scheme];
  return StyleSheet.create<Styles>({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    scrollContent: {
      flexGrow: 1,
      paddingTop: spacing.lg,
      paddingBottom: spacing.xl,
    },
    scrollView: {
      flex: 1,
    },
    listContainer: {
      gap: spacing.md,
    },
    item: {
      justifyContent: 'center',
      alignItems: 'center',
      borderRadius: 16,
      paddingVertical: spacing.lg,
      minHeight: 100,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 4,
    },
    iconPlaceholder: {
      fontWeight: 'bold',
      marginBottom: spacing.sm,
      textAlign: 'center',
      textShadowColor: 'rgba(0,0,0,0.15)',
      textShadowOffset: { width: 1, height: 2 },
      textShadowRadius: 3,
    },
    rectangleLabel: {
      ...(typography.button as TextStyle),
      fontWeight: 'bold',
      textAlign: 'center',
      letterSpacing: 0.5,
      fontSize: 20,
    },
  });
};
