import React, {
  useLayoutEffect,
  ComponentProps,
  useState,
  useEffect,
  useMemo,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link } from 'expo-router';
import { useNavigation } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import colors, { Colors } from '@/constants/colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import spacing from '@/constants/spacing';
import SettingsPanel from '@/components/SettingsPanel';
import AppFeedbackModal from '@/components/AppFeedbackModal';
import Toast from '@/components/Toast';
import { VersionDisplay } from '@/components/VersionDisplay';
import { useFeatureFlags } from '@/contexts/FeatureFlagsContext';
import useWordleStats from '@/hooks/useWordleStats';
import { useNotifications } from '@/contexts/NotificationsContext';
import { useCalendarConfigs } from '@/hooks/useCalendarConfigs';
import useCalendarEvents from '@/hooks/useCalendarEvents';
import type { CalendarEvent } from '@/hooks/useCalendarEvents';

const MONTHS_SHORT = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
];

function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function getUpcomingEvents(
  eventsByDate: Record<string, CalendarEvent[]>,
  limit: number,
): CalendarEvent[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split('T')[0];
  const seen = new Set<string>();
  const events: CalendarEvent[] = [];

  Object.entries(eventsByDate)
    .filter(([date]) => date >= todayStr)
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([, evts]) => {
      evts.forEach((evt) => {
        const key = `${evt.title}|${evt.startDate}`;
        if (!seen.has(key)) {
          seen.add(key);
          events.push(evt);
        }
      });
    });

  return events.slice(0, limit);
}

interface QuickItem {
  key: string;
  label: string;
  icon: ComponentProps<typeof MaterialIcons>['name'];
  iconBg: string;
  iconColor: string;
  href: string;
  pending?: boolean;
}

export default function Home() {
  const navigation = useNavigation();
  const scheme = useColorScheme();
  const theme = Colors[scheme ?? 'light'];
  const featureFlags = useFeatureFlags();
  const { stats } = useWordleStats();
  const [pendingWordle, setPendingWordle] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [feedbackVisible, setFeedbackVisible] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);

  const { firebaseNotifications, readIds, unreadCount } = useNotifications();
  const latestUnread = useMemo(
    () => firebaseNotifications.find((n) => !readIds.has(n.id)),
    [firebaseNotifications, readIds],
  );

  const { calendarConfigs } = useCalendarConfigs();
  const { eventsByDate } = useCalendarEvents(calendarConfigs);
  const upcomingEvents = useMemo(
    () => getUpcomingEvents(eventsByDate, 2),
    [eventsByDate],
  );

  const quickItems = useMemo<QuickItem[]>(
    () =>
      [
        featureFlags.tabs.cancionero && {
          key: 'cancionero',
          label: 'Cantoral',
          icon: 'library-music' as const,
          iconBg: scheme === 'dark' ? '#4A3A00' : '#FFF3CD',
          iconColor: colors.warning,
          href: '/cancionero',
        },
        featureFlags.tabs.calendario && {
          key: 'calendario',
          label: 'Calendario',
          icon: 'event' as const,
          iconBg: scheme === 'dark' ? '#0A2A3A' : '#D1ECF8',
          iconColor: colors.info,
          href: '/calendario',
        },
        featureFlags.tabs.fotos && {
          key: 'fotos',
          label: 'Fotos',
          icon: 'photo-library' as const,
          iconBg: scheme === 'dark' ? '#3A0A0C' : '#FAD7D9',
          iconColor: colors.accent,
          href: '/fotos',
        },
        {
          key: 'wordle',
          label: 'Wordle',
          icon: 'sports-esports' as const,
          iconBg: scheme === 'dark' ? '#1A2E00' : '#D7EBB8',
          iconColor: colors.success,
          href: '/wordle',
          pending: pendingWordle,
        },
      ].filter(Boolean) as QuickItem[],
    [featureFlags.tabs, pendingWordle, scheme],
  );

  useEffect(() => {
    const now = new Date();
    let dateKey = now.toISOString().slice(0, 10);
    let cycle: 'morning' | 'evening' = 'morning';
    if (now.getHours() < 7) {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      dateKey = y.toISOString().slice(0, 10);
      cycle = 'evening';
    } else if (now.getHours() >= 19) {
      cycle = 'evening';
    }
    const key = `${dateKey}_${cycle}`;
    setPendingWordle(stats.lastPlayedKey !== key);
  }, [stats]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={[styles.headerButtons, { paddingRight: spacing.md }]}>
          <TouchableOpacity
            onPress={() => setSettingsVisible(true)}
            style={styles.headerIconBtn}
            accessibilityLabel="Perfil y ajustes"
            accessibilityRole="button"
          >
            <MaterialIcons
              name="account-circle"
              size={26}
              color={theme.icon}
            />
          </TouchableOpacity>
          {featureFlags.showNotificationsIcon && (
            <Link href="/notifications" asChild>
              <TouchableOpacity
                style={styles.headerIconBtn}
                accessibilityLabel={
                  unreadCount > 0
                    ? `Notificaciones, ${unreadCount} sin leer`
                    : 'Notificaciones'
                }
                accessibilityRole="button"
              >
                <View>
                  <MaterialIcons
                    name="notifications"
                    size={24}
                    color={theme.icon}
                  />
                  {unreadCount > 0 && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            </Link>
          )}
        </View>
      ),
      title: 'Inicio',
    });
  }, [navigation, theme.icon, featureFlags.showNotificationsIcon, unreadCount]);

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: theme.background }]}
      edges={['top']}
    >
      <SettingsPanel
        visible={settingsVisible}
        onClose={() => setSettingsVisible(false)}
      />
      <AppFeedbackModal
        visible={feedbackVisible}
        onClose={() => setFeedbackVisible(false)}
        onSuccess={() => setToastVisible(true)}
      />
      <Toast
        visible={toastVisible}
        message="¡Gracias! Tu comentario ha sido enviado correctamente. Nos ayudas a mejorar la app 🙌"
        type="success"
        duration={4000}
        onDismiss={() => setToastVisible(false)}
      />

      <ScrollView
        style={{ backgroundColor: theme.background }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Novedades — solo cuando hay notificaciones sin leer */}
        {latestUnread && (
          <View style={styles.section}>
            <Link href="/notifications" asChild>
              <TouchableOpacity
                style={StyleSheet.flatten([
                  styles.notifCard,
                  {
                    backgroundColor: theme.background,
                    borderColor: theme.icon + '25',
                  },
                ])}
                accessibilityLabel={`Novedad: ${latestUnread.title}. Toca para ver todas las novedades`}
                accessibilityRole="button"
              >
                <View style={styles.notifContent}>
                  <View style={styles.notifHeaderRow}>
                    <View style={styles.newBadge}>
                      <Text style={styles.newBadgeText}>NUEVO</Text>
                    </View>
                    <Text
                      style={[styles.notifTitle, { color: theme.text }]}
                      numberOfLines={1}
                    >
                      {latestUnread.title}
                    </Text>
                  </View>
                  <Text
                    style={[styles.notifBody, { color: theme.icon }]}
                    numberOfLines={2}
                  >
                    {latestUnread.body}
                  </Text>
                </View>
                <MaterialIcons
                  name="chevron-right"
                  size={22}
                  color={theme.icon}
                  style={{ opacity: 0.4 }}
                />
              </TouchableOpacity>
            </Link>
          </View>
        )}

        {/* Accesos rápidos */}
        <View style={styles.section}>
          <View style={styles.quickGrid}>
            {quickItems.map((item) => (
              <Link key={item.key} href={item.href as any} asChild>
                <TouchableOpacity
                  style={styles.quickItem}
                  accessibilityLabel={item.label}
                  accessibilityRole="button"
                >
                  <View
                    style={[
                      styles.quickIconBox,
                      { backgroundColor: item.iconBg },
                    ]}
                  >
                    <MaterialIcons
                      name={item.icon}
                      size={24}
                      color={item.iconColor}
                    />
                    {item.pending && <View style={styles.pendingDot} />}
                  </View>
                  <Text
                    style={[styles.quickLabel, { color: theme.icon }]}
                    numberOfLines={1}
                  >
                    {item.label}
                  </Text>
                </TouchableOpacity>
              </Link>
            ))}
          </View>
        </View>

        {/* Próximos eventos */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            Próximos eventos
          </Text>

          {upcomingEvents.length > 0 ? (
            upcomingEvents.map((evt, idx) => {
              const evtDate = parseLocalDate(evt.startDate);
              const calColor =
                calendarConfigs[evt.calendarIndex]?.color ?? colors.info;
              const calName = calendarConfigs[evt.calendarIndex]?.name;
              return (
                <Link
                  key={`${evt.title}|${evt.startDate}|${idx}`}
                  href="/calendario"
                  asChild
                >
                  <TouchableOpacity
                    style={StyleSheet.flatten([
                      styles.eventCard,
                      {
                        backgroundColor: theme.background,
                        borderColor: theme.icon + '20',
                        borderLeftColor: calColor,
                      },
                    ])}
                    accessibilityRole="button"
                  >
                    <View
                      style={[
                        styles.eventDateBox,
                        { backgroundColor: calColor + '22' },
                      ]}
                    >
                      <Text
                        style={[styles.eventMonth, { color: calColor }]}
                      >
                        {MONTHS_SHORT[evtDate.getMonth()].toUpperCase()}
                      </Text>
                      <Text style={[styles.eventDay, { color: calColor }]}>
                        {evtDate.getDate()}
                      </Text>
                    </View>

                    <View style={styles.eventInfo}>
                      <View style={styles.eventTitleRow}>
                        <Text
                          style={[styles.eventTitle, { color: theme.text }]}
                          numberOfLines={1}
                        >
                          {evt.title}
                        </Text>
                        {calName && (
                          <View
                            style={[
                              styles.calBadge,
                              { backgroundColor: calColor + '22' },
                            ]}
                          >
                            <Text
                              style={[
                                styles.calBadgeText,
                                { color: calColor },
                              ]}
                            >
                              {calName}
                            </Text>
                          </View>
                        )}
                      </View>
                      {evt.location ? (
                        <View style={styles.eventMeta}>
                          <MaterialIcons
                            name="place"
                            size={11}
                            color={theme.icon}
                          />
                          <Text
                            style={[
                              styles.eventMetaText,
                              { color: theme.icon },
                            ]}
                            numberOfLines={1}
                          >
                            {evt.location}
                          </Text>
                        </View>
                      ) : null}
                    </View>

                    <MaterialIcons
                      name="chevron-right"
                      size={20}
                      color={theme.icon}
                      style={{ opacity: 0.35 }}
                    />
                  </TouchableOpacity>
                </Link>
              );
            })
          ) : (
            <Text style={[styles.emptyEvents, { color: theme.icon }]}>
              Sin eventos próximos
            </Text>
          )}

          <Link href="/calendario" asChild>
            <TouchableOpacity
              style={StyleSheet.flatten([
                styles.calendarButton,
                { borderColor: colors.primary + '35' },
              ])}
              accessibilityRole="button"
            >
              <MaterialIcons
                name="calendar-today"
                size={15}
                color={colors.primary}
              />
              <Text
                style={[styles.calendarButtonText, { color: colors.primary }]}
              >
                Ver calendario
              </Text>
            </TouchableOpacity>
          </Link>
        </View>

        {/* Pie */}
        <View style={styles.footer}>
          <VersionDisplay />
          <TouchableOpacity
            onPress={() => setFeedbackVisible(true)}
            style={styles.feedbackLink}
          >
            <Text style={[styles.feedbackText, { color: theme.icon }]}>
              ¿Algún fallo? Cuéntanoslo
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

interface Styles {
  safeArea: ViewStyle;
  scrollContent: ViewStyle;
  section: ViewStyle;
  sectionTitle: TextStyle;
  headerButtons: ViewStyle;
  headerIconBtn: ViewStyle;
  badge: ViewStyle;
  badgeText: TextStyle;
  notifCard: ViewStyle;
  notifContent: ViewStyle;
  notifHeaderRow: ViewStyle;
  newBadge: ViewStyle;
  newBadgeText: TextStyle;
  notifTitle: TextStyle;
  notifBody: TextStyle;
  quickGrid: ViewStyle;
  quickItem: ViewStyle;
  quickIconBox: ViewStyle;
  pendingDot: ViewStyle;
  quickLabel: TextStyle;
  eventCard: ViewStyle;
  eventDateBox: ViewStyle;
  eventMonth: TextStyle;
  eventDay: TextStyle;
  eventInfo: ViewStyle;
  eventTitleRow: ViewStyle;
  eventTitle: TextStyle;
  calBadge: ViewStyle;
  calBadgeText: TextStyle;
  eventMeta: ViewStyle;
  eventMetaText: TextStyle;
  emptyEvents: TextStyle;
  calendarButton: ViewStyle;
  calendarButtonText: TextStyle;
  footer: ViewStyle;
  feedbackLink: ViewStyle;
  feedbackText: TextStyle;
}

const styles = StyleSheet.create<Styles>({
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: spacing.sm,
    letterSpacing: 0.1,
  },

  // Header
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIconBtn: {
    padding: 8,
    marginLeft: 2,
  },
  badge: {
    position: 'absolute',
    right: -4,
    top: -2,
    backgroundColor: colors.danger,
    borderRadius: 10,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 3,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },

  // Notification preview card
  notifCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    padding: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  notifContent: {
    flex: 1,
    marginRight: spacing.sm,
  },
  notifHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: 6,
  },
  newBadge: {
    backgroundColor: colors.primary + '18',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  newBadgeText: {
    color: colors.primary,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  notifTitle: {
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
  },
  notifBody: {
    fontSize: 12,
    lineHeight: 17,
  },

  // Quick grid
  quickGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  quickItem: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 4,
    gap: 6,
  },
  quickIconBox: {
    width: 54,
    height: 54,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pendingDot: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.danger,
  },
  quickLabel: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    textAlign: 'center',
  },

  // Event cards
  eventCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderLeftWidth: 4,
    padding: spacing.sm + 2,
    marginBottom: spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  eventDateBox: {
    width: 44,
    height: 44,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
    flexShrink: 0,
  },
  eventMonth: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  eventDay: {
    fontSize: 17,
    fontWeight: '800',
    lineHeight: 19,
  },
  eventInfo: {
    flex: 1,
    overflow: 'hidden',
  },
  eventTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 3,
  },
  eventTitle: {
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
  },
  calBadge: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    flexShrink: 0,
  },
  calBadgeText: {
    fontSize: 8,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  eventMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  eventMetaText: {
    fontSize: 11,
    flex: 1,
  },
  emptyEvents: {
    textAlign: 'center',
    fontSize: 14,
    opacity: 0.7,
    paddingVertical: spacing.md,
  },
  calendarButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: spacing.xs,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  calendarButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },

  // Footer
  footer: {
    alignItems: 'center',
    paddingTop: spacing.xs,
  },
  feedbackLink: {
    padding: spacing.sm,
    marginTop: 4,
  },
  feedbackText: {
    fontSize: 12,
    opacity: 0.6,
  },
});
