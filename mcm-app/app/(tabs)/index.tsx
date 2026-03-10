import React, {
  useLayoutEffect,
  ComponentProps,
  useState,
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
import { Link, router } from 'expo-router';
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
  href?: string;
  dashed?: boolean;
}

export default function Home() {
  const navigation = useNavigation();
  const scheme = useColorScheme();
  const theme = Colors[scheme ?? 'light'];
  const featureFlags = useFeatureFlags();
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [feedbackVisible, setFeedbackVisible] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);

  // Notifications
  const { firebaseNotifications, readIds, unreadCount } = useNotifications();
  const latestNotification = firebaseNotifications[0] ?? null;
  const isUnread = latestNotification
    ? !readIds.has(latestNotification.id)
    : false;

  // Calendar events
  const { calendarConfigs } = useCalendarConfigs();
  const { eventsByDate } = useCalendarEvents(calendarConfigs);
  const upcomingEvents = useMemo(
    () => getUpcomingEvents(eventsByDate, 2),
    [eventsByDate],
  );

  // Quick grid items
  const quickItems = useMemo<QuickItem[]>(
    () =>
      [
        {
          key: 'comunica',
          label: 'Comunica',
          icon: 'forum' as const,
          iconBg: scheme === 'dark' ? '#3A2200' : '#FFF0E0',
          iconColor: '#E08A3C',
        },
        featureFlags.tabs.cancionero && {
          key: 'cancionero',
          label: 'Cantoral',
          icon: 'music-note' as const,
          iconBg: scheme === 'dark' ? '#1A1A3A' : '#E8E0FF',
          iconColor: '#6366F1',
          href: '/cancionero',
        },
        featureFlags.tabs.fotos && {
          key: 'fotos',
          label: 'Fotos',
          icon: 'image' as const,
          iconBg: scheme === 'dark' ? '#0A2A1A' : '#D5F5E3',
          iconColor: '#34D399',
          href: '/fotos',
        },
        {
          key: 'mas',
          label: 'Más',
          icon: 'add' as const,
          iconBg: 'transparent',
          iconColor: theme.icon,
          href: '/mas',
          dashed: true,
        },
      ].filter(Boolean) as QuickItem[],
    [featureFlags.tabs, scheme, theme.icon],
  );

  // Notification content (always show something)
  const notifTitle = latestNotification
    ? latestNotification.title
    : 'Bienvenido a MCM App';
  const notifBody = latestNotification
    ? latestNotification.body
    : 'Mantente al día con las novedades de la comunidad.';

  // Header setup
  useLayoutEffect(() => {
    navigation.setOptions({
      headerLeft: () => (
        <View style={[styles.headerLeft, { paddingLeft: spacing.md }]}>
          <View style={styles.logoBox}>
            <MaterialIcons name="device-hub" size={20} color="white" />
          </View>
          <Text style={[styles.logoText, { color: theme.text }]}>MCM App</Text>
        </View>
      ),
      headerTitle: '',
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
    });
  }, [navigation, theme, featureFlags.showNotificationsIcon, unreadCount]);

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
        {/* Novedades — siempre visible */}
        <View style={styles.section}>
          <Link href="/notifications" asChild>
            <TouchableOpacity
              style={StyleSheet.flatten([
                styles.notifCard,
                {
                  backgroundColor: theme.background,
                  borderColor: theme.icon + '20',
                },
              ])}
              accessibilityLabel={`Novedad: ${notifTitle}. Toca para ver notificaciones`}
              accessibilityRole="button"
            >
              <View style={styles.notifContent}>
                {isUnread && (
                  <View style={styles.newBadge}>
                    <Text style={styles.newBadgeText}>NUEVO</Text>
                  </View>
                )}
                <Text
                  style={[styles.notifTitle, { color: theme.text }]}
                  numberOfLines={2}
                >
                  {notifTitle}
                </Text>
                <Text
                  style={[styles.notifBody, { color: theme.icon }]}
                  numberOfLines={2}
                >
                  {notifBody}
                </Text>
              </View>
              <View
                style={[
                  styles.notifIconCircle,
                  {
                    backgroundColor:
                      scheme === 'dark' ? colors.primary + '25' : '#E8F4FD',
                  },
                ]}
              >
                <MaterialIcons
                  name="campaign"
                  size={28}
                  color={colors.primary}
                />
              </View>
            </TouchableOpacity>
          </Link>
        </View>

        {/* Accesos rápidos — iconos circulares */}
        <View style={styles.section}>
          <View style={styles.quickGrid}>
            {quickItems.map((item) => (
              <TouchableOpacity
                key={item.key}
                style={styles.quickItem}
                accessibilityLabel={item.label}
                accessibilityRole="button"
                onPress={() => {
                  if (item.href) router.push(item.href as any);
                }}
                activeOpacity={item.href ? 0.6 : 1}
              >
                <View
                  style={[
                    styles.quickIconCircle,
                    { backgroundColor: item.iconBg },
                    item.dashed && {
                      borderWidth: 1.5,
                      borderStyle: 'dashed',
                      borderColor: theme.icon + '40',
                    },
                  ]}
                >
                  <MaterialIcons
                    name={item.icon}
                    size={24}
                    color={item.iconColor}
                  />
                </View>
                <Text
                  style={[styles.quickLabel, { color: theme.icon }]}
                  numberOfLines={1}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Próximos eventos */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: theme.icon }]}>
            PRÓXIMOS EVENTOS
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
                        borderColor: theme.icon + '18',
                        borderLeftColor: calColor,
                      },
                    ])}
                    accessibilityRole="button"
                  >
                    <View
                      style={[
                        styles.eventDateBox,
                        { backgroundColor: calColor + '18' },
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
                              { backgroundColor: calColor + '18' },
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
                            name="schedule"
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
                      style={{ opacity: 0.3 }}
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
                { borderColor: colors.primary + '30' },
              ])}
              accessibilityRole="button"
            >
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

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  } as ViewStyle,
  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
  } as ViewStyle,
  section: {
    marginBottom: spacing.lg,
  } as ViewStyle,
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: spacing.sm,
  } as TextStyle,

  // Header
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  } as ViewStyle,
  logoBox: {
    backgroundColor: colors.primary,
    padding: 7,
    borderRadius: 10,
  } as ViewStyle,
  logoText: {
    marginLeft: 8,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  } as TextStyle,
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  } as ViewStyle,
  headerIconBtn: {
    padding: 8,
    marginLeft: 2,
  } as ViewStyle,
  badge: {
    position: 'absolute',
    right: -4,
    top: -2,
    backgroundColor: colors.primary,
    borderRadius: 10,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 3,
    justifyContent: 'center',
    alignItems: 'center',
  } as ViewStyle,
  badgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  } as TextStyle,

  // Notification card — always visible
  notifCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    padding: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  } as ViewStyle,
  notifContent: {
    flex: 1,
    marginRight: spacing.sm,
  } as ViewStyle,
  newBadge: {
    backgroundColor: colors.primary + '15',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 5,
    alignSelf: 'flex-start',
    marginBottom: 6,
  } as ViewStyle,
  newBadgeText: {
    color: colors.primary,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  } as TextStyle,
  notifTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
    lineHeight: 20,
  } as TextStyle,
  notifBody: {
    fontSize: 13,
    lineHeight: 18,
  } as TextStyle,
  notifIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  } as ViewStyle,

  // Quick grid — circular icons
  quickGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  } as ViewStyle,
  quickItem: {
    alignItems: 'center',
    gap: 6,
    width: 70,
  } as ViewStyle,
  quickIconCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    justifyContent: 'center',
    alignItems: 'center',
  } as ViewStyle,
  quickLabel: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    textAlign: 'center',
  } as TextStyle,

  // Event cards
  eventCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    borderLeftWidth: 4,
    padding: spacing.sm + 2,
    marginBottom: spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  } as ViewStyle,
  eventDateBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
    flexShrink: 0,
  } as ViewStyle,
  eventMonth: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.3,
  } as TextStyle,
  eventDay: {
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 18,
  } as TextStyle,
  eventInfo: {
    flex: 1,
    overflow: 'hidden',
  } as ViewStyle,
  eventTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 3,
  } as ViewStyle,
  eventTitle: {
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
  } as TextStyle,
  calBadge: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    flexShrink: 0,
  } as ViewStyle,
  calBadgeText: {
    fontSize: 8,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  } as TextStyle,
  eventMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  } as ViewStyle,
  eventMetaText: {
    fontSize: 11,
    flex: 1,
  } as TextStyle,
  emptyEvents: {
    textAlign: 'center',
    fontSize: 14,
    opacity: 0.6,
    paddingVertical: spacing.md,
  } as TextStyle,
  calendarButton: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1.5,
  } as ViewStyle,
  calendarButtonText: {
    fontSize: 14,
    fontWeight: '700',
  } as TextStyle,

  // Footer
  footer: {
    alignItems: 'center',
    paddingTop: spacing.xs,
  } as ViewStyle,
  feedbackLink: {
    padding: spacing.sm,
    marginTop: 4,
  } as ViewStyle,
  feedbackText: {
    fontSize: 12,
    opacity: 0.6,
  } as TextStyle,
});
