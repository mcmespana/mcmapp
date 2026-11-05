import React from 'react';
import {
  Linking,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { Stack } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { PressableFeedback } from 'heroui-native';
import Animated from 'react-native-reanimated';
import { MaterialIcons } from '@/components/ui/icons';
import { useTabScroll } from '@/components/tabs/useTabScroll';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useContigoReminders } from '@/hooks/useContigoReminders';
import { warm } from '@/components/contigo/theme';
import {
  contigoHeaderChrome,
  useContigoHeaderInset,
} from '@/components/contigo/headerChrome';
import ReminderCard from '@/components/contigo/ReminderCard';
import { reminderNoticesAvailable } from '@/services/contigoReminders';
import { REMINDER_HABITS, anyReminderEnabled } from '@/utils/contigoReminders';
import typography from '@/constants/typography';
import spacing from '@/constants/spacing';
import { radii } from '@/constants/uiStyles';

export default function RecordatoriosScreen() {
  // Subruta de Contigo: misma clave del tab que el resto (ver `bookmarks.tsx`).
  const { scrollRef, onScroll, contentPaddingBottom } = useTabScroll('contigo');
  const isDark = useColorScheme() === 'dark';
  const headerInset = useContigoHeaderInset();
  const W = warm(isDark);
  const { width: windowWidth } = useWindowDimensions();
  const isWide = windowWidth >= 720;

  const {
    config,
    loaded,
    permission,
    setEnabled,
    setTime,
    addTime,
    removeTime,
    toggleDay,
    setText,
  } = useContigoReminders();

  // Avisamos de que no sonará nada si hay algo encendido y el permiso está
  // negado; con el permiso sin pedir aún no se dice nada (se pide al encender).
  const blocked = anyReminderEnabled(config) && permission === 'denied';

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitle: 'Recordatorios',
          headerTransparent: true,
          headerBackButtonDisplayMode: 'minimal',
          headerShadowVisible: false,
          headerTintColor: W.text,
          headerTitleStyle: { color: W.text, fontWeight: '700', fontSize: 17 },
          ...contigoHeaderChrome(isDark),
        }}
      />
      <LinearGradient colors={W.bgGradient} style={StyleSheet.absoluteFill} />
      <Animated.ScrollView
        ref={scrollRef}
        onScroll={onScroll}
        scrollEventThrottle={16}
        style={styles.flex}
        contentContainerStyle={{
          paddingTop: headerInset,
          paddingBottom: contentPaddingBottom,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.content, isWide ? styles.wide : undefined]}>
          <View style={styles.hero}>
            <Text style={[styles.title, { color: W.text }]}>
              Tus recordatorios
            </Text>
            <Text style={[styles.lead, { color: W.textSec }]}>
              Un toquecito con cariño cuando se te pase.
            </Text>
          </View>

          {!reminderNoticesAvailable ? (
            <Text style={[styles.note, { color: W.textSec }]}>
              Los recordatorios suenan en la app del móvil. En la web puedes
              dejarlos preparados, pero no avisan.
            </Text>
          ) : null}

          {blocked ? (
            <PressableFeedback
              onPress={() => Linking.openSettings().catch(() => {})}
              accessibilityRole="button"
              accessibilityLabel="Abrir los ajustes para activar las notificaciones"
              style={[styles.banner, { backgroundColor: W.accentLight }]}
            >
              <MaterialIcons
                name="notifications-off"
                size={22}
                color={W.accentText}
              />
              <Text style={[styles.bannerText, { color: W.text }]}>
                Las notificaciones están apagadas para la app, así que no te
                avisaremos. Toca aquí para activarlas.
              </Text>
            </PressableFeedback>
          ) : null}

          {loaded
            ? REMINDER_HABITS.map((habit) => (
                <ReminderCard
                  key={habit}
                  habit={habit}
                  reminder={config[habit]}
                  W={W}
                  isDark={isDark}
                  onToggle={(on) => setEnabled(habit, on)}
                  onTime={(i, v) => setTime(habit, i, v)}
                  onAddTime={() => addTime(habit)}
                  onRemoveTime={(i) => removeTime(habit, i)}
                  onDay={(d) => toggleDay(habit, d)}
                  onText={(idx, custom) => setText(habit, idx, custom)}
                />
              ))
            : null}
        </View>
      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  content: { paddingHorizontal: spacing.md, gap: spacing.md },
  wide: { width: '100%', maxWidth: 720, alignSelf: 'center' },
  hero: { gap: spacing.xs, paddingVertical: spacing.sm },
  title: { ...typography.h1 },
  lead: { ...typography.body },
  note: { ...typography.subhead },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 4,
    padding: spacing.md,
    borderRadius: radii.lg,
    minHeight: 44,
  },
  bannerText: { ...typography.subhead, flex: 1 },
});
