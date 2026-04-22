import React from 'react';
import {
  View,
  StyleSheet,
  Text,
  ViewStyle,
  TextStyle,
  useWindowDimensions,
  ScrollView,
  Platform,
} from 'react-native';
import { PressableFeedback } from 'heroui-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MaterialIcons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';

import { useColorScheme } from '@/hooks/useColorScheme';
import { hexAlpha } from '@/utils/colorUtils';
import { radii } from '@/constants/uiStyles';
import spacing from '@/constants/spacing';
import { MasStackParamList } from '../(tabs)/mas';
import ProgressWithMessage from '@/components/ProgressWithMessage';
import { useFirebaseData } from '@/hooks/useFirebaseData';
import OfflineBanner from '@/components/OfflineBanner';

interface NavigationItem {
  label: string;
  subtitle?: string;
  emoji: string;
  materialIcon?: ComponentProps<typeof MaterialIcons>['name'];
  target: keyof MasStackParamList;
  tintColor: string;
}

const navigationItems: NavigationItem[] = [
  {
    label: 'Horario',
    subtitle: 'Programa del encuentro',
    emoji: '⏰',
    materialIcon: 'schedule',
    target: 'Horario',
    tintColor: '#FF8A65',
  },
  {
    label: 'Materiales',
    subtitle: 'Recursos y dinámicas',
    emoji: '📦',
    materialIcon: 'inventory-2',
    target: 'Materiales',
    tintColor: '#4FC3F7',
  },
  {
    label: 'Comida',
    subtitle: 'Menú y turnos',
    emoji: '🍽️',
    materialIcon: 'restaurant',
    target: 'Comida',
    tintColor: '#F06292',
  },
  {
    label: 'Visitas',
    subtitle: 'Salidas y traslados',
    emoji: '🚌',
    materialIcon: 'directions-bus',
    target: 'Visitas',
    tintColor: '#81C784',
  },
  {
    label: 'Profundiza',
    subtitle: 'Reflexión y textos',
    emoji: '📖',
    materialIcon: 'menu-book',
    target: 'Profundiza',
    tintColor: '#BA68C8',
  },
  {
    label: 'Grupos',
    subtitle: 'Equipos de trabajo',
    emoji: '👥',
    materialIcon: 'groups',
    target: 'Grupos',
    tintColor: '#FFD54F',
  },
  {
    label: 'Contactos',
    subtitle: 'Teléfonos útiles',
    emoji: '☎️',
    materialIcon: 'contact-phone',
    target: 'Contactos',
    tintColor: '#9FA8DA',
  },
  {
    label: 'Apps',
    subtitle: 'Herramientas MCM',
    emoji: '📲',
    materialIcon: 'apps',
    target: 'Apps',
    tintColor: '#FFB74D',
  },
];

const WIDE_BREAKPOINT = 700;

export default function JubileoHomeScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<MasStackParamList>>();
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';

  const { loading: lh, offline } = useFirebaseData(
    'jubileo/horario',
    'jubileo_horario',
  );
  const { loading: lm } = useFirebaseData(
    'jubileo/materiales',
    'jubileo_materiales',
  );
  const { loading: lv } = useFirebaseData('jubileo/visitas', 'jubileo_visitas');
  const { loading: lp } = useFirebaseData(
    'jubileo/profundiza',
    'jubileo_profundiza',
  );
  const { loading: lg } = useFirebaseData('jubileo/grupos', 'jubileo_grupos');
  const { loading: lc } = useFirebaseData(
    'jubileo/contactos',
    'jubileo_contactos',
  );
  const { loading: la } = useFirebaseData('jubileo/apps', 'jubileo_apps');
  const isLoading = lh || lm || lv || lp || lg || lc || la;

  const { width } = useWindowDimensions();
  const isWide = width >= WIDE_BREAKPOINT;
  const columns = isWide ? 3 : 2;
  const containerPadding = spacing.md;
  const gap = spacing.md;
  const itemWidth =
    (Math.min(width, 1100) - containerPadding * 2 - gap * (columns - 1)) /
    columns;

  const styles = React.useMemo(() => createStyles(isDark), [isDark]);

  if (isLoading) {
    return <ProgressWithMessage message="Cargando información..." />;
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { padding: containerPadding, rowGap: gap },
        ]}
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
      >
        {offline && <OfflineBanner text="Mostrando datos sin conexión" />}

        <View style={[styles.gridContainer, { gap }]}>
          {navigationItems.map((item) => (
            <PressableFeedback
              key={item.target}
              style={[
                styles.card,
                {
                  width: itemWidth,
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
                  : ({
                      boxShadow: `0 4px 12px ${hexAlpha(item.tintColor, '30')}`,
                    } as ViewStyle),
              ]}
              onPress={() => navigation.navigate(item.target as never)}
              accessibilityRole="button"
              accessibilityLabel={
                item.subtitle ? `${item.label}. ${item.subtitle}` : item.label
              }
            >
              <PressableFeedback.Highlight />

              {/* Accent bar superior */}
              <View
                style={[styles.accentBar, { backgroundColor: item.tintColor }]}
              />

              <View style={styles.cardBody}>
                {/* Icon circle tintado */}
                <View
                  style={[
                    styles.iconCircle,
                    { backgroundColor: hexAlpha(item.tintColor, '18') },
                  ]}
                >
                  <Text style={styles.emoji}>{item.emoji}</Text>
                </View>

                <Text
                  style={[
                    styles.cardTitle,
                    { color: isDark ? '#fff' : '#1C1C1E' },
                  ]}
                  numberOfLines={1}
                >
                  {item.label}
                </Text>

                {item.subtitle && (
                  <Text
                    style={[
                      styles.cardSubtitle,
                      { color: isDark ? '#8E8E93' : '#6B7280' },
                    ]}
                    numberOfLines={2}
                  >
                    {item.subtitle}
                  </Text>
                )}

                {/* Indicador de acción */}
                {item.materialIcon && (
                  <View
                    style={[
                      styles.arrowPill,
                      { backgroundColor: hexAlpha(item.tintColor, '15') },
                    ]}
                  >
                    <MaterialIcons
                      name={item.materialIcon}
                      size={14}
                      color={item.tintColor}
                    />
                  </View>
                )}
              </View>
            </PressableFeedback>
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
  gridContainer: ViewStyle;
  card: ViewStyle;
  accentBar: ViewStyle;
  cardBody: ViewStyle;
  iconCircle: ViewStyle;
  emoji: TextStyle;
  cardTitle: TextStyle;
  cardSubtitle: TextStyle;
  arrowPill: ViewStyle;
}

const createStyles = (isDark: boolean) =>
  StyleSheet.create<Styles>({
    container: {
      flex: 1,
      backgroundColor: isDark ? '#1C1C1E' : '#F2F2F7',
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      flexGrow: 1,
      alignItems: 'center',
      paddingBottom: Platform.OS === 'ios' ? 100 : spacing.xl,
    },
    gridContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      width: '100%',
      maxWidth: 1100,
    },
    card: {
      borderRadius: radii.xl,
      overflow: 'hidden',
    },
    accentBar: {
      height: 4,
      width: '100%',
    },
    cardBody: {
      paddingHorizontal: spacing.md,
      paddingTop: spacing.md,
      paddingBottom: spacing.md,
      alignItems: 'flex-start',
      gap: 6,
      minHeight: 150,
    },
    iconCircle: {
      width: 52,
      height: 52,
      borderRadius: 16,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 4,
    },
    emoji: {
      fontSize: 28,
    },
    cardTitle: {
      fontSize: 17,
      fontWeight: '700',
      letterSpacing: -0.3,
    },
    cardSubtitle: {
      fontSize: 12,
      lineHeight: 16,
    },
    arrowPill: {
      position: 'absolute',
      top: spacing.sm,
      right: spacing.sm,
      width: 28,
      height: 28,
      borderRadius: 14,
      justifyContent: 'center',
      alignItems: 'center',
    },
  });
