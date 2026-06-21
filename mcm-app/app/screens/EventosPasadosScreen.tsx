import React from 'react';
import {
  View,
  StyleSheet,
  Text,
  ScrollView,
  Platform,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { PressableFeedback } from 'heroui-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MaterialIcons } from '@expo/vector-icons';

import { useColorScheme } from '@/hooks/useColorScheme';
import { hexAlpha } from '@/utils/colorUtils';
import spacing from '@/constants/spacing';
import { radii } from '@/constants/uiStyles';
import { getArchivedEvents } from '@/constants/events';
import { MasStackParamList } from '../(tabs)/mas';

/**
 * "Eventos pasados": lista los eventos archivados (`status: 'archived'` en
 * `constants/events.ts`) como tarjetas que abren su hub. Hoy muestra Jubileo;
 * cuando un evento activo se archive aparecerá aquí automáticamente.
 */
export default function EventosPasadosScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<MasStackParamList>>();
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const styles = React.useMemo(() => createStyles(isDark), [isDark]);

  const events = React.useMemo(() => getArchivedEvents(), []);

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <ScrollView
        style={styles.container}
        // El header transparente lo compensa el contentInset automático del
        // ScrollView en iOS (como el cantoral); no añadimos paddingTop manual.
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={
          Platform.OS === 'ios'
            ? { paddingBottom: 140, padding: spacing.md }
            : { paddingBottom: spacing.xl, padding: spacing.md }
        }
        showsVerticalScrollIndicator={false}
      >
        {events.length === 0 ? (
          <Text style={styles.empty}>Todavía no hay eventos pasados.</Text>
        ) : (
          events.map((event) => (
            <PressableFeedback
              key={event.id}
              style={[
                styles.card,
                { backgroundColor: isDark ? '#2C2C2E' : '#fff' },
                Platform.OS !== 'web'
                  ? {
                      shadowColor: event.tintColor,
                      shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: isDark ? 0.3 : 0.15,
                      shadowRadius: 12,
                      elevation: 4,
                    }
                  : ({
                      boxShadow: `0 4px 12px ${hexAlpha(event.tintColor, '30')}`,
                    } as ViewStyle),
              ]}
              onPress={() =>
                navigation.navigate('JubileoHome', { eventId: event.id })
              }
              accessibilityRole="button"
              accessibilityLabel={event.title}
            >
              <PressableFeedback.Highlight />
              <View
                style={[styles.accentBar, { backgroundColor: event.tintColor }]}
              />
              <View style={styles.cardBody}>
                <View
                  style={[
                    styles.iconCircle,
                    { backgroundColor: hexAlpha(event.tintColor, '18') },
                  ]}
                >
                  <MaterialIcons
                    name="history"
                    size={26}
                    color={event.tintColor}
                  />
                </View>
                <Text
                  style={[
                    styles.cardTitle,
                    { color: isDark ? '#fff' : '#1C1C1E' },
                  ]}
                  numberOfLines={2}
                >
                  {event.title}
                </Text>
                <View
                  style={[
                    styles.arrowCircle,
                    { backgroundColor: hexAlpha(event.tintColor, '15') },
                  ]}
                >
                  <MaterialIcons
                    name="arrow-forward"
                    size={18}
                    color={event.tintColor}
                  />
                </View>
              </View>
            </PressableFeedback>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

interface Styles {
  safeArea: ViewStyle;
  container: ViewStyle;
  empty: TextStyle;
  card: ViewStyle;
  accentBar: ViewStyle;
  cardBody: ViewStyle;
  iconCircle: ViewStyle;
  cardTitle: TextStyle;
  arrowCircle: ViewStyle;
}

const createStyles = (isDark: boolean) =>
  StyleSheet.create<Styles>({
    safeArea: {
      flex: 1,
      backgroundColor: isDark ? '#1C1C1E' : '#F2F2F7',
    },
    container: {
      flex: 1,
    },
    empty: {
      textAlign: 'center',
      marginTop: spacing.xl,
      color: isDark ? '#8E8E93' : '#6B7280',
      fontSize: 15,
    },
    card: {
      borderRadius: radii.xl,
      marginBottom: spacing.md,
      overflow: 'hidden',
    },
    accentBar: {
      height: 4,
      width: '100%',
    },
    cardBody: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      gap: spacing.md,
    },
    iconCircle: {
      width: 56,
      height: 56,
      borderRadius: radii.md,
      justifyContent: 'center',
      alignItems: 'center',
      flexShrink: 0,
    },
    cardTitle: {
      flex: 1,
      fontSize: 18,
      fontWeight: '700',
      letterSpacing: -0.3,
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
