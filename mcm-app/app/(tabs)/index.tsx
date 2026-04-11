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
  Linking,
  ViewStyle,
  TextStyle,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useNavigation } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import colors, { Colors } from '@/constants/colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import spacing from '@/constants/spacing';
import { radii, shadows } from '@/constants/uiStyles';
import useFontScale from '@/hooks/useFontScale';
import { useToast, Chip, Button } from 'heroui-native';
import SettingsPanel from '@/components/SettingsPanel';
import AppFeedbackModal from '@/components/AppFeedbackModal';
import { VersionDisplay } from '@/components/VersionDisplay';
import { useFeatureFlags } from '@/contexts/FeatureFlagsContext';
import { setPendingMasScreen } from '@/utils/masNavigation';
import { hexAlpha } from '@/utils/colorUtils';
import { useNotifications } from '@/contexts/NotificationsContext';
import { useCalendarConfigs } from '@/hooks/useCalendarConfigs';
import useCalendarEvents from '@/hooks/useCalendarEvents';
import type { CalendarEvent } from '@/hooks/useCalendarEvents';

const MONTHS_SHORT = [
  'Ene',
  'Feb',
  'Mar',
  'Abr',
  'May',
  'Jun',
  'Jul',
  'Ago',
  'Sep',
  'Oct',
  'Nov',
  'Dic',
];

function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function getUpcomingEvents(
  eventsByDate: Record<string, CalendarEvent[]>,
  limit: number,
  visibleCalendars: boolean[],
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
        if (visibleCalendars[evt.calendarIndex] === false) return;
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
  const fontScale = useFontScale();
  const { width: windowWidth } = useWindowDimensions();
  const isWide = windowWidth >= 700;
  const { toast } = useToast();
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [feedbackVisible, setFeedbackVisible] = useState(false);

  // Primary color readable on both light and dark backgrounds
  const accentColor = scheme === 'dark' ? colors.info : colors.primary;

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

  // Calendar events — filtered by user's visible calendars
  const { calendarConfigs, visibleCalendars } = useCalendarConfigs();
  const { eventsByDate } = useCalendarEvents(calendarConfigs);
  const upcomingEvents = useMemo(
    () => getUpcomingEvents(eventsByDate, 2, visibleCalendars),
    [eventsByDate, visibleCalendars],
  );

  const hasAnyVisibleCalendar =
    calendarConfigs.length > 0 && visibleCalendars.some(Boolean);

  // Quick grid items
  const quickItems = useMemo<QuickItem[]>(
    () =>
      [
        featureFlags.showComunica && {
          key: 'comunica',
          label: 'Comunica',
          icon: 'forum' as const,
          iconBg: scheme === 'dark' ? '#3A2200' : '#FFF0E0',
          iconColor: '#E08A3C',
          href: '/mas' as const,
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
    [featureFlags.tabs, featureFlags.showComunica, scheme, theme.icon],
  );

  // Hide the tab navigator header — we render our own
  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  // Notification card content
  const notifTitle = latestNotification
    ? latestNotification.title
    : 'Bienvenido a MCM App';
  const notifBody = latestNotification
    ? latestNotification.body
    : 'Mantente al día con las novedades de la comunidad.';

  // Mapeo de rutas internas a etiquetas legibles (coherente con notifications.tsx)
  const ROUTE_LABELS: Record<string, string> = {
    '/(tabs)/calendario': 'Calendario',
    '/(tabs)/fotos': 'Fotos',
    '/(tabs)/cancionero': 'Cantoral',
    '/(tabs)/mas': 'Más',
    '/(tabs)/index': 'Inicio',
    '/wordle': 'Wordle',
  };
  const internalRouteLabel = latestNotification?.internalRoute
    ? (ROUTE_LABELS[latestNotification.internalRoute] ?? null)
    : null;

  const handleActionButton = () => {
    const btn = latestNotification?.actionButton;
    if (!btn) return;
    if (btn.isInternal) {
      router.push(btn.url as any);
    } else {
      Linking.openURL(btn.url).catch((e) => console.error(e));
    }
  };

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
        onSuccess={() =>
          toast.show({
            variant: 'success',
            label: '¡Gracias! Tu comentario ha sido enviado correctamente 🙌',
            actionLabel: 'Cerrar',
            onActionPress: ({ hide }) => hide(),
          })
        }
      />

      {/* ── Custom Header ── */}
      <View
        style={[
          styles.header,
          { backgroundColor: theme.background },
          isWide && styles.headerWide,
        ]}
      >
        <View style={styles.headerLeft}>
          <View style={styles.logoBox}>
            <MaterialIcons name="device-hub" size={20} color="white" />
          </View>
          <Text style={[styles.logoText, { color: theme.text }]}>MCM App</Text>
        </View>

        <View style={styles.headerRight}>
          <TouchableOpacity
            onPress={() => setSettingsVisible(true)}
            style={styles.headerIconBtn}
            accessibilityLabel="Perfil y ajustes"
            accessibilityRole="button"
          >
            <MaterialIcons name="account-circle" size={26} color={theme.icon} />
          </TouchableOpacity>

          {featureFlags.showNotificationsIcon && (
            <TouchableOpacity
              style={styles.headerIconBtn}
              onPress={() => router.navigate('/notifications')}
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
                    <Animated.View
                      style={[
                        styles.dotPing,
                        {
                          transform: [{ scale: pingAnim }],
                          opacity: pingOpacity,
                        },
                      ]}
                    />
                    <View style={styles.dot} />
                  </View>
                )}
              </View>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView
        style={{ backgroundColor: theme.background }}
        contentContainerStyle={[
          styles.scrollContent,
          isWide && styles.scrollContentWide,
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Two-column wrapper on wide screens ── */}
        <View style={isWide ? styles.wideRow : undefined}>
          {/* ── Left column (or full-width on mobile) ── */}
          <View style={isWide ? styles.wideColLeft : undefined}>
            {/* ── Novedades ── */}
            <View style={styles.section}>
              <TouchableOpacity
                style={StyleSheet.flatten([
                  styles.notifCard,
                  {
                    backgroundColor: theme.card,
                    borderColor:
                      scheme === 'dark'
                        ? 'rgba(255,255,255,0.09)'
                        : 'rgba(0,0,0,0.07)',
                  },
                ])}
                onPress={() => router.navigate('/notifications')}
                activeOpacity={0.78}
                accessibilityLabel={`${notifTitle}. Toca para leer`}
                accessibilityRole="button"
              >
                {/* Top row: content + icon */}
                <View style={styles.notifRow}>
                  {/* Content */}
                  <View style={styles.notifContent}>
                    {isUnread && (
                      <View
                        style={[
                          styles.newBadge,
                          { backgroundColor: hexAlpha(accentColor, '15') },
                        ]}
                      >
                        <Text
                          style={[styles.newBadgeText, { color: accentColor }]}
                        >
                          NUEVO
                        </Text>
                      </View>
                    )}
                    <Text
                      style={[
                        styles.notifTitle,
                        {
                          color: theme.text,
                          fontSize: 16 * fontScale,
                        },
                      ]}
                      numberOfLines={2}
                    >
                      {notifTitle}
                    </Text>
                    <Text
                      style={[
                        styles.notifDescription,
                        {
                          color: theme.icon,
                          fontSize: 13 * fontScale,
                        },
                      ]}
                      numberOfLines={2}
                    >
                      {notifBody}
                    </Text>
                  </View>

                  {/* Megaphone icon — right */}
                  <View
                    style={[
                      styles.notifIconCircle,
                      {
                        backgroundColor:
                          scheme === 'dark'
                            ? hexAlpha(accentColor, '20')
                            : hexAlpha(accentColor, '12'),
                      },
                    ]}
                  >
                    <MaterialIcons
                      name="campaign"
                      size={26}
                      color={accentColor}
                    />
                  </View>
                </View>

                {/* CTA row: destino interno + botón de acción */}
                <View style={styles.notifCtaRow}>
                  {/* Chip de destino (internalRoute) — solo indicador, la tarjeta lleva a /notifications */}
                  {internalRouteLabel && (
                    <Chip
                      size="sm"
                      variant="soft"
                      color="default"
                      style={{
                        backgroundColor: hexAlpha(accentColor, '10'),
                        borderColor: hexAlpha(accentColor, '50'),
                      }}
                    >
                      <Chip.Label style={{ color: accentColor }}>
                        {internalRouteLabel}
                      </Chip.Label>
                    </Chip>
                  )}

                  {/* Botón de acción explícito */}
                  {latestNotification?.actionButton ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onPress={handleActionButton}
                      style={{ backgroundColor: hexAlpha(accentColor, '12') }}
                    >
                      <Button.Label style={{ color: accentColor }}>
                        {latestNotification.actionButton.text ?? 'Voy a verlo'}
                      </Button.Label>
                      <MaterialIcons
                        name={
                          latestNotification.actionButton.isInternal
                            ? 'arrow-forward'
                            : 'open-in-new'
                        }
                        size={14}
                        color={accentColor}
                      />
                    </Button>
                  ) : !internalRouteLabel ? (
                    /* Flecha genérica solo si no hay ningún indicador */
                    <View
                      style={[
                        styles.arrowPill,
                        { backgroundColor: hexAlpha(accentColor, '10') },
                      ]}
                    >
                      <MaterialIcons
                        name="east"
                        size={14}
                        color={accentColor}
                      />
                    </View>
                  ) : null}
                </View>
              </TouchableOpacity>
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
                      if (item.key === 'comunica') {
                        setPendingMasScreen('Comunica');
                      }
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
                              borderColor: hexAlpha(theme.icon, '40'),
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
                      style={[
                        styles.quickLabel,
                        {
                          color: theme.icon,
                          fontSize: 10 * fontScale,
                        },
                      ]}
                      numberOfLines={1}
                    >
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
          {/* end left column */}

          {/* ── Right column (or full-width on mobile) ── */}
          <View style={isWide ? styles.wideColRight : undefined}>
            {/* ── Próximos eventos ── */}
            <View style={styles.section}>
              <Text
                style={[
                  styles.sectionLabel,
                  {
                    color: theme.icon,
                    fontSize: 11 * fontScale,
                  },
                ]}
              >
                PRÓXIMOS EVENTOS
              </Text>

              {!hasAnyVisibleCalendar && calendarConfigs.length > 0 ? (
                /* User has calendars but all hidden */
                <TouchableOpacity
                  style={[
                    styles.emptyEventsCard,
                    {
                      backgroundColor: theme.card,
                      borderColor:
                        scheme === 'dark'
                          ? 'rgba(255,255,255,0.08)'
                          : 'rgba(0,0,0,0.06)',
                    },
                  ]}
                  onPress={() => router.push('/calendario')}
                  accessibilityRole="button"
                >
                  <MaterialIcons
                    name="event-note"
                    size={28}
                    color={theme.icon}
                    style={{ opacity: 0.5 }}
                  />
                  <Text
                    style={[
                      styles.emptyEventsTitle,
                      { color: theme.text, fontSize: 14 * fontScale },
                    ]}
                  >
                    Activa algún calendario
                  </Text>
                  <Text
                    style={[
                      styles.emptyEventsBody,
                      { color: theme.icon, fontSize: 12 * fontScale },
                    ]}
                  >
                    Selecciona un calendario para ver los próximos eventos aquí.
                  </Text>
                </TouchableOpacity>
              ) : upcomingEvents.length > 0 ? (
                upcomingEvents.map((evt, idx) => {
                  const evtDate = parseLocalDate(evt.startDate);
                  const calColor =
                    calendarConfigs[evt.calendarIndex]?.color ?? accentColor;
                  const calName = calendarConfigs[evt.calendarIndex]?.name;
                  return (
                    <TouchableOpacity
                      key={`${evt.title}|${evt.startDate}|${idx}`}
                      style={StyleSheet.flatten([
                        styles.eventCard,
                        {
                          backgroundColor: theme.card,
                          borderColor:
                            scheme === 'dark'
                              ? 'rgba(255,255,255,0.09)'
                              : 'rgba(0,0,0,0.06)',
                          borderLeftColor: calColor,
                        },
                      ])}
                      onPress={() =>
                        router.push({
                          pathname: '/calendario',
                          params: { date: evt.startDate },
                        } as any)
                      }
                      accessibilityRole="button"
                      accessibilityLabel={`Evento: ${evt.title}`}
                    >
                      <View
                        style={[
                          styles.eventDateBox,
                          { backgroundColor: hexAlpha(calColor, '18') },
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
                        <Text
                          style={[
                            styles.eventTitle,
                            {
                              color: theme.text,
                              fontSize: 13 * fontScale,
                            },
                          ]}
                          numberOfLines={1}
                        >
                          {evt.title}
                        </Text>
                        {calName && (
                          <View
                            style={[
                              styles.calBadge,
                              { backgroundColor: hexAlpha(calColor, '18') },
                            ]}
                          >
                            <Text
                              style={[styles.calBadgeText, { color: calColor }]}
                              numberOfLines={1}
                            >
                              {calName}
                            </Text>
                          </View>
                        )}
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
                                {
                                  color: theme.icon,
                                  fontSize: 11 * fontScale,
                                },
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
                  );
                })
              ) : (
                /* No upcoming events */
                <Text
                  style={[
                    styles.emptyEvents,
                    { color: theme.icon, fontSize: 13 * fontScale },
                  ]}
                >
                  Sin eventos próximos
                </Text>
              )}

              <TouchableOpacity
                style={StyleSheet.flatten([
                  styles.calendarButton,
                  { borderColor: hexAlpha(accentColor, '30') },
                ])}
                onPress={() => router.push('/calendario')}
                accessibilityRole="button"
              >
                <Text
                  style={[
                    styles.calendarButtonText,
                    { color: accentColor, fontSize: 14 * fontScale },
                  ]}
                >
                  Ver calendario
                </Text>
              </TouchableOpacity>
            </View>
          </View>
          {/* end right column */}
        </View>
        {/* end wide row */}

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
          <Text style={[styles.tagline, { color: theme.icon }]}>
            Movimiento Consolación para el Mundo
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 } as ViewStyle,

  // ── Header ──
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  } as ViewStyle,
  headerWide: {
    maxWidth: 900,
    alignSelf: 'center',
    width: '100%',
    paddingHorizontal: spacing.lg,
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
  headerIconBtn: { padding: 8, marginLeft: 4 } as ViewStyle,
  bellWrap: { position: 'relative' } as ViewStyle,
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
  scrollContentWide: {
    maxWidth: 900,
    alignSelf: 'center',
    width: '100%',
    paddingHorizontal: spacing.lg,
  } as ViewStyle,

  // ── Responsive columns ──
  wideRow: {
    flexDirection: 'row',
    gap: spacing.lg,
  } as ViewStyle,
  wideColLeft: {
    flex: 1,
  } as ViewStyle,
  wideColRight: {
    flex: 1,
  } as ViewStyle,

  section: { marginBottom: spacing.lg + 4 } as ViewStyle,
  sectionLabel: {
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: spacing.sm,
  } as TextStyle,

  // ── Notification card ──
  notifCard: {
    borderRadius: radii.xl,
    borderWidth: 1,
    padding: spacing.md + 2,
    ...shadows.md,
  } as ViewStyle,
  notifRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm + 2,
  } as ViewStyle,
  notifContent: {
    flex: 1,
    gap: 5,
  } as ViewStyle,
  newBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
  } as ViewStyle,
  newBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
  } as TextStyle,
  notifTitle: {
    fontWeight: '700',
    lineHeight: 22,
  } as TextStyle,
  notifDescription: {
    lineHeight: 19,
  } as TextStyle,
  notifIconCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
    marginTop: 2,
  } as ViewStyle,
  notifCtaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: spacing.sm + 2,
    flexWrap: 'wrap',
  } as ViewStyle,
  destinationChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: radii.pill,
    borderWidth: 1,
  } as ViewStyle,
  destinationChipText: {
    fontSize: 10,
    fontWeight: '700',
  } as TextStyle,
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radii.pill,
  } as ViewStyle,
  actionBtnText: {
    fontSize: 12,
    fontWeight: '700',
  } as TextStyle,
  arrowPill: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  } as ViewStyle,

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
    borderRadius: radii.full,
    justifyContent: 'center',
    alignItems: 'center',
  } as ViewStyle,
  quickLabel: {
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    textAlign: 'center',
  } as TextStyle,

  // ── Event cards ──
  eventCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radii.lg,
    borderWidth: 1,
    borderLeftWidth: 4,
    padding: spacing.sm + 4,
    marginBottom: spacing.sm,
    ...shadows.sm,
  } as ViewStyle,
  eventDateBox: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
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
    gap: 3,
  } as ViewStyle,
  eventTitle: {
    fontWeight: '700',
  } as TextStyle,
  calBadge: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: radii.xs,
    alignSelf: 'flex-start',
    maxWidth: 110,
  } as ViewStyle,
  calBadgeText: {
    fontSize: 8,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.2,
  } as TextStyle,
  eventMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  } as ViewStyle,
  eventMetaText: { flex: 1 } as TextStyle,
  emptyEvents: {
    textAlign: 'center',
    opacity: 0.6,
    paddingVertical: spacing.md,
  } as TextStyle,
  emptyEventsCard: {
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: spacing.lg,
    marginBottom: spacing.sm,
    alignItems: 'center',
    gap: spacing.xs,
  } as ViewStyle,
  emptyEventsTitle: {
    fontWeight: '700',
    textAlign: 'center',
  } as TextStyle,
  emptyEventsBody: {
    textAlign: 'center',
    lineHeight: 18,
    opacity: 0.7,
  } as TextStyle,
  calendarButton: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
    paddingVertical: 11,
    borderRadius: radii.md,
    borderWidth: 1.5,
  } as ViewStyle,
  calendarButtonText: {
    fontWeight: '700',
  } as TextStyle,

  // ── Footer ──
  footer: { alignItems: 'center', paddingTop: spacing.xs } as ViewStyle,
  feedbackLink: { padding: spacing.sm, marginTop: 4 } as ViewStyle,
  feedbackText: { fontSize: 12, opacity: 0.6 } as TextStyle,
  tagline: {
    fontSize: 11,
    opacity: 0.3,
    marginTop: spacing.sm,
    letterSpacing: 0.2,
    fontStyle: 'italic',
  } as TextStyle,
});
