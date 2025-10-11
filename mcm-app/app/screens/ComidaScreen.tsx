import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
  ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Colors } from '@/constants/colors';
import spacing from '@/constants/spacing';
import typography from '@/constants/typography';
import { useColorScheme } from '@/hooks/useColorScheme';
import { MasStackParamList } from '../(tabs)/mas';

interface Option {
  label: string;
  icon: string;
  url: string;
}

const OPTIONS: Option[] = [
  {
    label: 'Web comidas',
    icon: '🍽️',
    url: 'https://app.amicidelpellegrino.it/es',
  },
  {
    label: 'Busca sitios',
    icon: '🔍',
    url: 'https://storelocator.amicidelpellegrino.it/?locale=it',
  },
  {
    label: 'Google Maps',
    icon: '🗺️',
    url: 'https://www.google.com/maps/d/edit?mid=11qLeGeI5-oD-OS1rh1kMsBSbGKwyP0g&usp=sharing',
  },
  {
    label: 'Food Hub',
    icon: '🍔',
    url: 'https://www.iubilaeum2025.va/es/pellegrinaggio/calendario-giubileo/GrandiEventi/Giubileo-dei-Giovani/hub-food.html',
  },
];

type Nav = NativeStackNavigationProp<MasStackParamList, 'ComidaWeb'>;

export default function ComidaScreen() {
  const navigation = useNavigation<Nav>();
  const scheme = useColorScheme();
  const styles = React.useMemo(() => createStyles(scheme), [scheme]);
  const { width, height } = useWindowDimensions();
  const containerPadding = spacing.md;
  const gap = spacing.md;
  const itemWidth = (width - containerPadding * 2 - gap) / 2;
  const itemHeight = Math.min(
    160,
    (height - containerPadding * 2 - gap * 3) / 3,
  );

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.gridContainer}>
          {OPTIONS.map((opt, idx) => (
            <View key={idx} style={styles.itemWrapper}>
              <TouchableOpacity
                style={[styles.item, { width: itemWidth, height: itemHeight }]}
                onPress={() =>
                  navigation.navigate('ComidaWeb', {
                    url: opt.url,
                    title: opt.label,
                  })
                }
                activeOpacity={0.85}
              >
                <Text style={styles.icon}>{opt.icon}</Text>
                <Text style={styles.label}>{opt.label}</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const createStyles = (scheme: 'light' | 'dark') => {
  const theme = Colors[scheme];
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    scrollContent: { flexGrow: 1, padding: spacing.md },
    gridContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
    },
    itemWrapper: { width: '48%', marginBottom: spacing.md },
    item: {
      justifyContent: 'center',
      alignItems: 'center',
      borderRadius: 16,
      backgroundColor: '#FF8A65',
    },
    icon: {
      fontSize: 40,
      marginBottom: spacing.sm,
      color: '#fff',
    },
    label: {
      ...(typography.button as any),
      color: '#fff',
      fontWeight: 'bold',
      textAlign: 'center',
    },
  });
};
