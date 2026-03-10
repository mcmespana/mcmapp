import React, {
  useLayoutEffect,
  ComponentProps,
  useRef,
  useEffect,
  useState,
  useMemo,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
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

  // Animated ping for notification badge
  const pingAnim = useRef(new Animated.Value(1)).current;
  const pingOpacity = useRef(new Animated.Value(0.6)).current;
  useEffect(() => {
    if (unreadCount > 0) {
      const loop = Animated.loop(
        Animated.parallel([
          Animated.sequence([
            Animated.timing(pingAnim, {
              toValue: 1.8,
              duration: 800,
              useNativeDriver: true,
            }),
            Animated.timing(pingAnim, {
              toValue: 1,
              duration: 0,
              useNativeDriver: true,
            }),
          ]),
          Animated.sequence([
            Animated.timing(pingOpacity, {
              toValue: 0,
              duration: 800,
              useNativeDriver: true,
            }),
            Animated.timing(pingOpacity, {
              toValue: 0.6,
              duration: 0,
              useNativeDriver: true,
            }),
          ]),
        ]),
      );
      loop.start();
      return () => loop.stop();
    }
    pingAnim.setValue(1);
    pingOpacity.setValue(0.6);
  }, [unreadCount, pingAnim, pingOpacity]);

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

  // Hide the tab navigator header — we render our own below
  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  // Notification display content
  const notifTitle = latestNotification
    ? latestNotification.title
    : 'Bienvenido a MCM App';
  const notifBody = latestNotification
    ? latestNotification.body
    : 'Mantente al día con las novedades de la comunidad.';
  const notifCta = latestNotification ? 'Leer notificación' : 'Ver novedades';

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

      {/* ── Custom Header ── */}
      <View style={[styles.header, { backgroundColor: theme.background }]}>
        {/* Left: logo */}
        <View style={styles.headerLeft}>
          <View style={styles.logoBox}>
            <MaterialIcons name="device-hub" size={20} color="white" />
          </View>
          <Text style={[styles.logoText, { color: theme.text }]}>MCM App</Text>
        </View>

        {/* Right: user + bell */}
        <View style={styles.headerRight}>
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
                <View style={styles.bellWrap}>
                  <MaterialIcons
                    name="notifications"
                    size={24}
                    color={theme.icon}
                  />
                  {unreadCount > 0 && (
                    <View style={styles.dotWrap}>
                      {/* Animated ping ring */}
                      <Animated.View
                        style={[
                          styles.dotPing,
                          {
                            transform: [{ scale: pingAnim }],
                            opacity: pingOpacity,
                          },
                        ]}
                      />
                      {/* Solid dot */}
                      <View style={styles.dot} />
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            </Link>
          )}
        </View>
      </View>

      <ScrollView
        style={{ backgroundColor: theme.background }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Novedades — siempre visible ── */}
        <View style={styles.section}>
          <Link href="/notifications" asChild>
            <TouchableOpacity
              style={StyleSheet.flatten([
                styles.notifCard,
                {
                  backgroundColor: theme.background,
                  borderColor: theme.icon + '1A',
                },
              ])}
              accessibilityLabel={`${notifTitle}. Toca para leer`}
              accessibilityRole="button"
              activeOpacity={0.75}
            >
              {/* Megaphone icon — top right */}
              <View
                style={[
                  styles.notifIconCircle,
                  {
                    backgroundColor:
                      scheme === 'dark'
                        ? colors.primary + '22'
                        : '#EAF4FE',
                  },
                ]}
              >
                <MaterialIcons
                  name="campaign"
                  size={26}
                  color={colors.primary}
                />
              </View>

              {/* Content */}
              <View style={styles.notifBody}>
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
                  style={[styles.notifDescription, { color: theme.icon }]}
                  numberOfLines={2}
                >
                  {notifBody}
                </Text>

                {/* CTA pill */}
                <View style={styles.ctaRow}>
                  <View
                    style={[
                      styles.ctaPill,
                      { backgroundColor: colors.primary + '12' },
                    ]}
                  >
                    <Text style={[styles.ctaText, { color: colors.primary }]}>
                      {notifCta}
                    </Text>
                    <MaterialIcons
                      name="arrow-forward"
                      size={13}
                      color={colors.primary}
                    />
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          </Link>
        </View>

        {/* ── Accesos rápidos ── */}
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
                activeOpacity={item.href ? 0.65 : 1}
              >
                <View
                  style={StyleSheet.flatten([
                    styles.quickIconCircle,
                    { backgroundColor: item.iconBg },
                    item.dashed
                      ? {
                          borderWidth: 1.5,
                          borderStyle: 'dashed',
                          borderColor: theme.icon + '40',
                        }
                      : undefined,
                  ])}
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

        {/* ── Próximos eventos ── */}
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
                      <Text style={[styles.eventMonth, { color: calColor }]}>
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

        {/* ── Pie ── */}
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

  // ── Custom Header ──
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  } as ViewStyle,
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  } as ViewStyle,
  logoBox: {
    backgroundColor: colors.primary,
    padding: 8,
    borderRadius: 10,
  } as ViewStyle,
  logoText: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.4,
  } as TextStyle,
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  } as ViewStyle,
  headerIconBtn: {
    padding: 8,
    marginLeft: 4,
  } as ViewStyle,
  bellWrap: {
    position: 'relative',
  } as ViewStyle,
  dotWrap: {
    position: 'absolute',
    top: -1,
    right: -1,
    width: 12,
    height: 12,
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  dotPing: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.primary,
  } as ViewStyle,
  dot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: colors.primary,
  } as ViewStyle,

  // ── ScrollView ──
  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
    paddingBottom: spacing.xl,
  } as ViewStyle,
  section: {
    marginBottom: spacing.lg + 4,
  } as ViewStyle,
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: spacing.sm,
  } as TextStyle,

  // ── Notification card ──
  notifCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: spacing.md + 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 3,
    gap: spacing.sm,
  } as ViewStyle,
  notifIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'flex-start',
  } as ViewStyle,
  notifBody: {
    gap: spacing.xs,
  } as ViewStyle,
  newBadge: {
    backgroundColor: colors.primary + '15',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
  } as ViewStyle,
  newBadgeText: {
    color: colors.primary,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
  } as TextStyle,
  notifTitle: {
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
  } as TextStyle,
  notifDescription: {
    fontSize: 13,
    lineHeight: 19,
  } as TextStyle,
  ctaRow: {
    marginTop: spacing.xs,
  } as ViewStyle,
  ctaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  } as ViewStyle,
  ctaText: {
    fontSize: 12,
    fontWeight: '700',
  } as TextStyle,

  // ── Quick grid ──
  quickGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  } as ViewStyle,
  quickItem: {
    alignItems: 'center',
    gap: 7,
    width: 70,
  } as ViewStyle,
  quickIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
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

  // ── Event cards ──
  eventCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    borderLeftWidth: 4,
    padding: spacing.sm + 4,
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

  // ── Footer ──
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
