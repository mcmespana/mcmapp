import React from 'react';
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
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { Colors } from '@/constants/colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import spacing from '@/constants/spacing';
import typography from '@/constants/typography';
import { JubileoStackParamList } from '../(tabs)/jubileo';
import ProgressWithMessage from '@/components/ProgressWithMessage';
import { useFirebaseData } from '@/hooks/useFirebaseData';
import OfflineBanner from '@/components/OfflineBanner';

interface NavigationItem {
  label: string;
  icon: string;
  target: keyof JubileoStackParamList;
  backgroundColor: string;
}

const navigationItems: NavigationItem[] = [
  {
    label: 'Horario',
    icon: '⏰',
    target: 'Horario',
    backgroundColor: '#FF8A65',
  },
  {
    label: 'Materiales',
    icon: '📦',
    target: 'Materiales',
    backgroundColor: '#4FC3F7',
  },
  {
    label: 'Visitas',
    icon: '🚌',
    target: 'Visitas',
    backgroundColor: '#81C784',
  },
  {
    label: 'Profundiza',
    icon: '📖',
    target: 'Profundiza',
    backgroundColor: '#BA68C8',
  },
  { label: 'Grupos', icon: '👥', target: 'Grupos', backgroundColor: '#FFD54F' },
  {
    label: 'Contactos',
    icon: '☎️',
    target: 'Contactos',
    backgroundColor: '#9FA8DA',
  },
  {
    label: 'Apps',
    icon: '📲',
    target: 'Apps',
    backgroundColor: '#FFB74D',
  },
];

export default function JubileoHomeScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<JubileoStackParamList>>();
  const scheme = useColorScheme();
  const styles = React.useMemo(() => createStyles(scheme), [scheme]);
  const { loading: lh } = useFirebaseData('jubileo/horario', 'jubileo_horario');
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
  const { width, height } = useWindowDimensions();
  const containerPadding = spacing.md;
  const gap = spacing.md;
  const itemWidth = (width - containerPadding * 2 - gap) / 2;
  const itemHeight = Math.min(
    160,
    (height - containerPadding * 2 - gap * 3) / 3,
  ); // Limit max height
  const iconSize = 48;
  const labelFontSize = 18;

  if (isLoading) {
    return <ProgressWithMessage message="Cargando información..." />;
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
      >
        {offline && <OfflineBanner text="Mostrando datos sin conexión" />}
        <View
          style={[
            styles.gridContainer,
            {
              padding: containerPadding,
              backgroundColor: Colors[scheme].background,
            },
          ]}
        >
          {navigationItems.map((item, idx) => (
            <View key={idx} style={styles.itemWrapper}>
              <TouchableOpacity
                style={[
                  styles.item,
                  {
                    width: itemWidth,
                    height: itemHeight,
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
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

interface Styles {
  container: ViewStyle;
  scrollView: ViewStyle;
  scrollContent: ViewStyle;
  gridContainer: ViewStyle;
  itemWrapper: ViewStyle;
  item: ViewStyle;
  headerWrapper: ViewStyle;
  headerText: TextStyle;
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
      paddingBottom: 20,
    },
    scrollView: {
      flex: 1,
    },
    gridContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
    },
    itemWrapper: {
      width: '48%',
      marginBottom: spacing.md,
    },
    item: {
      justifyContent: 'center',
      alignItems: 'center',
      borderRadius: 16,
      marginBottom: spacing.md,
    },
    headerWrapper: {
      marginBottom: spacing.lg,
    },
    headerText: {
      fontSize: 22,
      fontWeight: 'bold',
      textAlign: 'center',
      color: theme.text,
    },
    iconPlaceholder: {
      fontWeight: 'bold',
      marginBottom: spacing.sm,
      textAlign: 'center',
      textShadowColor: 'rgba(0,0,0,0.08)',
      textShadowOffset: { width: 1, height: 2 },
      textShadowRadius: 2,
    },
    rectangleLabel: {
      ...(typography.button as TextStyle),
      fontWeight: 'bold',
      textAlign: 'center',
      letterSpacing: 0.5,
      marginTop: 2,
    },
  });
};
