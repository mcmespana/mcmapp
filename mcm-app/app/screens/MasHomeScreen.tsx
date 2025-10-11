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
import { MasStackParamList } from '../(tabs)/mas';

interface NavigationItem {
  label: string;
  icon: string;
  target: keyof MasStackParamList;
  backgroundColor: string;
}

const navigationItems: NavigationItem[] = [
  {
    label: 'Comunica MCM · Monitores',
    icon: '💬',
    target: 'MonitoresWeb',
    backgroundColor: '#607D8B',
  },
  {
    label: 'Jubileo',
    icon: '🎉',
    target: 'JubileoHome',
    backgroundColor: '#A3BD31',
  },
  // Aquí puedes agregar más secciones archivadas en el futuro
];

export default function MasHomeScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<MasStackParamList>>();
  const scheme = useColorScheme();
  const styles = React.useMemo(() => createStyles(scheme), [scheme]);
  const { width } = useWindowDimensions();
  const containerPadding = spacing.lg;
  const iconSize = 48;
  const labelFontSize = 18;

  return (
    <View style={styles.container}>
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
    </View>
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
