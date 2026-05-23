import React, {
  useLayoutEffect,
  ComponentProps,
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
  Pressable,
  Linking,
  Platform,
  ViewStyle,
  TextStyle,
  useWindowDimensions,
} from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useNavigation } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import colors, { Colors } from '@/constants/colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import spacing from '@/constants/spacing';
import { radii, shadows } from '@/constants/uiStyles';
import useFontScale from '@/hooks/useFontScale';
import { Skeleton } from 'heroui-native';
import { useToast } from '@/contexts/AppToastContext';
import SettingsBottomSheet from '@/components/SettingsBottomSheet';
import AppFeedbackModal from '@/components/AppFeedbackModal';
import NotificationsBottomSheet from '@/components/NotificationsBottomSheet';
import { VersionDisplay } from '@/components/VersionDisplay';
import { SecretMenuTrigger } from '@/components/SecretMenuTrigger';
import { useResolvedProfileConfig } from '@/hooks/useResolvedProfileConfig';
import { useUserProfile } from '@/contexts/UserProfileContext';
import { setPendingMasScreen } from '@/utils/masNavigation';
import { hexAlpha } from '@/utils/colorUtils';
import ScreenHero from '@/components/ui/ScreenHero';
import EmptyState from '@/components/ui/EmptyState';
import GlassSurface from '@/components/ui/GlassSurface';
import { useNotifications } from '@/contexts/NotificationsContext';
import {
  getLocalNotificationsHistory,
  isNotificationOlderThan60Days,
} from '@/services/pushNotificationService';
import { useCalendarConfig } from '@/contexts/CalendarConfigContext';
import { useOTAContext } from '@/contexts/OTAContext';
import { h } from '@/utils/haptics';
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

function getWeekLabel(date: Date, today: Date): string {
  const diffTime = date.getTime() - today.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return 'Pasado';
  if (diffDays === 0) return 'Hoy';
  if (diffDays === 1) return 'Mañana';
  if (diffDays < 7) return 'Esta semana';
  if (diffDays < 14) return 'Próxima semana';
  if (diffDays < 28) return 'Este mes';

  // Beyond 28 days → don't show
  return null;
}

interface EventGroup {
  label: string;
  events: CalendarEvent[];
}

function getUpcomingEventsByWeek(
  eventsByDate: Record<string, CalendarEvent[]>,
  maxEvents: number,
  visibleCalendars: boolean[],
): EventGroup[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split('T')[0];
  const seen = new Set<string>();
  const eventsByWeek: Map<string, CalendarEvent[]> = new Map();

  Object.entries(eventsByDate)
    .filter(([date]) => date >= todayStr)
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([dateStr, evts]) => {
      evts.forEach((evt) => {
        if (visibleCalendars[evt.calendarIndex] === false) return;
        const key = `${evt.title}|${evt.startDate}`;
        if (!seen.has(key) && seen.size < maxEvents) {
          const eventDate = parseLocalDate(dateStr);
          const label = getWeekLabel(eventDate, today);
          if (label === null) return; // beyond 4 weeks — skip
          seen.add(key);

          if (!eventsByWeek.has(label)) {
            eventsByWeek.set(label, []);
          }
          eventsByWeek.get(label)!.push(evt);
        }
      });
    });

  // Preserve order: Hoy → Mañana → Esta semana → Próxima semana → Este mes
  const order = ['Hoy', 'Mañana', 'Esta semana', 'Próxima semana', 'Este mes'];
  const groups: EventGroup[] = [];

  order.forEach((label) => {
    if (eventsByWeek.has(label)) {
      groups.push({ label, events: eventsByWeek.get(label)! });
      eventsByWeek.delete(label);
    }
  });

  // Add remaining weeks in order
  eventsByWeek.forEach((events, label) => {
    groups.push({ label, events });
  });

  return groups;
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
  const resolved = useResolvedProfileConfig();
  const { profile } = useUserProfile();
  const fontScale = useFontScale();
  const { width: windowWidth } = useWindowDimensions();
  const isWide = windowWidth >= 700;
  const { toast } = useToast();
  const [settingsVisible, setSettingsVisibleRaw] = useState(false);
  const [feedbackVisible, setFeedbackVisible] = useState(false);
  const [notifSheetOpen, setNotifSheetOpenRaw] = useState(false);

  // Settings and notifications panels must be mutually exclusive: opening
  // one auto-closes the other. Otherwise both panels stack visually and
  // taps leak through to the header buttons underneath.
  const setSettingsVisible = (next: boolean) => {
    setSettingsVisibleRaw(next);
    if (next) setNotifSheetOpenRaw(false);
  };
  const setNotifSheetOpen = (next: boolean) => {
    setNotifSheetOpenRaw(next);
    if (next) setSettingsVisibleRaw(false);
  };

  // Primary color readable on both light and dark backgrounds
  const accentColor = scheme === 'dark' ? colors.info : colors.primary;

  // OTA update badge (show in header after user dismisses the modal)
  const {
    isReady: otaReady,
    dismissed: otaDismissed,
    applyUpdate: otaApply,
  } = useOTAContext();
  const showUpdateBadge = otaReady && otaDismissed;

  // Notifications
  const { firebaseNotifications, readIds, unreadCount } = useNotifications();
  const latestNotification = firebaseNotifications[0] ?? null;

  const [isUnread, setIsUnread] = useState(false);

  useEffect(() => {
    if (!latestNotification) {
      setIsUnread(false);
      return;
    }
    if (readIds.has(latestNotification.id)) {
      setIsUnread(false);
      return;
    }
    const dateStr = (
      'receivedAt' in latestNotification
        ? latestNotification.receivedAt
        : latestNotification.createdAt
    ) as string | undefined;
    if (isNotificationOlderThan60Days(dateStr)) {
      setIsUnread(false);
      return;
    }

    // Comprobación cruzada asíncrona: ver si ya se leyó la versión local
    getLocalNotificationsHistory().then((localData) => {
      const match = localData.find(
        (n) =>
          n.title === latestNotification.title &&
          n.body === latestNotification.body,
      );
      if (match && (match.isRead || readIds.has(match.id))) {
        setIsUnread(false);
      } else {
        setIsUnread(true);
      }
    });
  }, [latestNotification, readIds]);

  // Ping animation for the notification badge (Reanimated 3).
  const pingScale = useSharedValue(1);
  const pingOpacity = useSharedValue(0.6);
  useEffect(() => {
    if (unreadCount > 0) {
      pingScale.value = withRepeat(
        withSequence(
          withTiming(1.8, { duration: 800 }),
          withTiming(1, { duration: 0 }),
        ),
        -1,
      );
      pingOpacity.value = withRepeat(
        withSequence(
          withTiming(0, { duration: 800 }),
          withTiming(0.6, { duration: 0 }),
        ),
        -1,
      );
      return () => {
        cancelAnimation(pingScale);
        cancelAnimation(pingOpacity);
      };
    }
    pingScale.value = 1;
    pingOpacity.value = 0.6;
  }, [unreadCount, pingScale, pingOpacity]);
  const animatedPingStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pingScale.value }],
    opacity: pingOpacity.value,
  }));

  // Calendar events — filtered by user's visible calendars
  const { calendarConfigs, visibleCalendars } = useCalendarConfig();
  const { eventsByDate, loading: eventsLoading } =
    useCalendarEvents(calendarConfigs);
  const upcomingEventGroups = useMemo(
    () => getUpcomingEventsByWeek(eventsByDate, 8, visibleCalendars),
    [eventsByDate, visibleCalendars],
  );

  const hasAnyVisibleCalendar =
    calendarConfigs.length > 0 && visibleCalendars.some(Boolean);
  const hasUpcomingEvents = upcomingEventGroups.some(
    (g) => g.events.length > 0,
  );

  // Quick grid items — filtrados por la config del perfil resuelto
  const quickItems = useMemo<QuickItem[]>(() => {
    const visible = new Set(resolved.homeButtons);
    const catalog: Record<string, QuickItem> = {
      comunica: {
        key: 'comunica',
        label: 'Comunica',
        icon: 'forum',
        iconBg: scheme === 'dark' ? '#3A2200' : '#FFF0E0',
        iconColor: '#E08A3C',
        href: '/mas',
      },
      cancionero: {
        key: 'cancionero',
        label: 'Cantoral',
        icon: 'music-note',
        iconBg: scheme === 'dark' ? '#1A1A3A' : '#E8E0FF',
        iconColor: '#6366F1',
        href: '/cancionero',
      },
      fotos: {
        key: 'fotos',
        label: 'Fotos',
        icon: 'image',
        iconBg: scheme === 'dark' ? '#0A2A1A' : '#D5F5E3',
        iconColor: '#34D399',
        href: '/mas',
      },
      evangelio: {
        key: 'evangelio',
        label: 'Evangelio',
        icon: 'menu-book',
        iconBg: scheme === 'dark' ? '#3A2A1A' : '#FFF8E1',
        iconColor: '#F59E0B',
        href: '/(tabs)/contigo/evangelio',
      },
      mas: {
        key: 'mas',
        label: 'Más',
        icon: 'add',
        iconBg: 'transparent',
        iconColor: theme.icon,
        href: '/mas',
        dashed: true,
      },
    };
    return resolved.homeButtons
      .filter((id) => visible.has(id) && catalog[id])
      .map((id) => catalog[id]);
  }, [resolved.homeButtons, scheme, theme.icon]);

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

  const normalizeRoute = (route: string): string => {
    if (!route) return '';
    let clean = route.trim();
    if (clean.startsWith('http')) return clean;

    clean = clean.replace(/\/+/g, '/');

    const hasSlash = clean.startsWith('/');
    const naked = hasSlash ? clean.substring(1) : clean;

    if (naked.startsWith('(tabs)/')) {
      return '/' + naked;
    }

    const tabPaths = [
      'cancionero',
      'calendario',
      'fotos',
      'mas',
      'index',
      'contigo',
    ];

    const isTab = tabPaths.some(
      (p) => naked === p || naked.startsWith(p + '/'),
    );
    if (isTab) {
      return '/(tabs)/' + naked;
    }

    return '/' + naked;
  };

  // Mapeo de rutas internas a etiquetas + iconos (coherente con notifications.tsx)
  const ROUTE_LABELS: Record<
    string,
    { label: string; icon: ComponentProps<typeof MaterialIcons>['name'] }
  > = {
    '/(tabs)/calendario': { label: 'Calendario', icon: 'calendar-today' },
    '/(tabs)/fotos': { label: 'Fotos', icon: 'photo-library' },
    '/(tabs)/cancionero': { label: 'Cantoral', icon: 'music-note' },
    '/(tabs)/mas': { label: 'Más', icon: 'more-horiz' },
    '/(tabs)/index': { label: 'Inicio', icon: 'home' },
    '/wordle': { label: 'Wordle', icon: 'games' },
    '/(tabs)/contigo': { label: 'Contigo', icon: 'favorite' },
    '/(tabs)/contigo/evangelio': { label: 'Evangelio', icon: 'menu-book' },
    '/(tabs)/contigo/oracion': { label: 'Oración', icon: 'brightness-3' },
    '/(tabs)/contigo/revision': { label: 'Revisión', icon: 'rate-review' },
    '/(tabs)/contigo/bookmarks': { label: 'Favoritos', icon: 'bookmark' },
  };
  const internalRouteInfo = latestNotification?.internalRoute
    ? (ROUTE_LABELS[normalizeRoute(latestNotification.internalRoute)] ??
      ROUTE_LABELS[latestNotification.internalRoute] ??
      null)
    : null;
  const internalRouteLabel = internalRouteInfo?.label ?? null;

  const handleActionButton = () => {
    const btn = latestNotification?.actionButton;
    if (!btn) return;
    if (btn.isInternal) {
      router.push(normalizeRoute(btn.url) as any);
    } else {
      Linking.openURL(btn.url).catch((e) => console.error(e));
    }
  };

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: theme.background }]}
      edges={['top']}
    >
      <SettingsBottomSheet
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
      <NotificationsBottomSheet
        visible={notifSheetOpen}
        onClose={() => setNotifSheetOpen(false)}
      />

      {/* ── App-bar header (ScreenHero in compact mode) ── */}
      <View
        style={[
          { backgroundColor: theme.background },
          isWide && styles.headerWide,
        ]}
      >
        <ScreenHero
          compact={false}
          title="MCM App"
          titleStyle={styles.logoText}
          left={
            <View style={styles.logoBox}>
              <MaterialIcons name="device-hub" size={20} color="white" />
            </View>
          }
          right={
            <>
              {showUpdateBadge && (
                <TouchableOpacity
                  onPress={otaApply}
                  style={[
                    styles.headerBtn,
                    {
                      backgroundColor:
                        Platform.OS === 'ios'
                          ? 'transparent'
                          : scheme === 'dark'
                            ? 'rgba(163,189,49,0.15)'
                            : 'rgba(163,189,49,0.12)',
                      borderColor: colors.success,
                    },
                  ]}
                  accessibilityLabel="Actualización disponible. Toca para reiniciar"
                  accessibilityRole="button"
                >
                  {Platform.OS === 'ios' && (
                    <GlassSurface
                      variant="regular"
                      tintColor={colors.success}
                    />
                  )}
                  <MaterialIcons
                    name="system-update"
                    size={22}
                    color={colors.success}
                  />
                </TouchableOpacity>
              )}

              {resolved.showNotificationsIcon && (
                <TouchableOpacity
                  style={[
                    styles.headerBtn,
                    {
                      backgroundColor:
                        Platform.OS === 'ios'
                          ? 'transparent'
                          : scheme === 'dark'
                            ? 'rgba(255,255,255,0.07)'
                            : 'rgba(0,0,0,0.05)',
                      borderColor:
                        scheme === 'dark'
                          ? 'rgba(255,255,255,0.12)'
                          : 'rgba(0,0,0,0.08)',
                    },
                  ]}
                  onPress={() => setNotifSheetOpen(true)}
                  accessibilityLabel={
                    unreadCount > 0
                      ? `Notificaciones, ${unreadCount} sin leer`
                      : 'Notificaciones'
                  }
                  accessibilityRole="button"
                >
                  {Platform.OS === 'ios' && <GlassSurface variant="regular" />}
                  <View style={styles.bellWrap}>
                    <MaterialIcons
                      name="notifications"
                      size={22}
                      color={theme.icon}
                    />
                    {unreadCount > 0 && (
                      <View style={styles.dotWrap}>
                        <Animated.View
                          style={[styles.dotPing, animatedPingStyle]}
                        />
                        <View style={styles.dot} />
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                onPress={() => setSettingsVisible(true)}
                style={[
                  styles.headerBtn,
                  {
                    backgroundColor:
                      Platform.OS === 'ios'
                        ? 'transparent'
                        : scheme === 'dark'
                          ? 'rgba(255,255,255,0.07)'
                          : 'rgba(0,0,0,0.05)',
                    borderColor:
                      scheme === 'dark'
                        ? 'rgba(255,255,255,0.12)'
                        : 'rgba(0,0,0,0.08)',
                  },
                ]}
                accessibilityLabel="Perfil y ajustes"
                accessibilityRole="button"
              >
                {Platform.OS === 'ios' && <GlassSurface variant="regular" />}
                <MaterialIcons
                  name="account-circle"
                  size={22}
                  color={theme.icon}
                />
              </TouchableOpacity>
            </>
          }
        />
      </View>

      <ScrollView
        style={{ backgroundColor: theme.background }}
        contentContainerStyle={[
          styles.scrollContent,
          isWide && styles.scrollContentWide,
          Platform.OS === 'ios' && { paddingBottom: 120 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Two-column wrapper on wide screens ── */}
        <View style={isWide ? styles.wideRow : undefined}>
          {/* ── Left column (or full-width on mobile) ── */}
          <View style={isWide ? styles.wideColLeft : undefined}>
            {/* ── Banner de personalización (solo si saltó el onboarding) ── */}
            {profile.profileType && !profile.onboardingCompleted && (
              <TouchableOpacity
                style={[
                  styles.onboardingBanner,
                  {
                    backgroundColor: hexAlpha(accentColor, '12'),
                    borderColor: hexAlpha(accentColor, '30'),
                  },
                ]}
                onPress={() => router.push('/onboarding' as any)}
                accessibilityRole="button"
                accessibilityLabel="Completa tu perfil"
              >
                <MaterialIcons name="tune" size={20} color={accentColor} />
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      styles.onboardingBannerTitle,
                      { color: theme.text },
                    ]}
                  >
                    Personaliza tu experiencia
                  </Text>
                  <Text
                    style={[styles.onboardingBannerBody, { color: theme.icon }]}
                    numberOfLines={2}
                  >
                    Dinos quién eres y de qué delegación para ver lo que más te
                    interesa.
                  </Text>
                </View>
                <MaterialIcons
                  name="chevron-right"
                  size={20}
                  color={accentColor}
                />
              </TouchableOpacity>
            )}

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
                onPress={() => setNotifSheetOpen(true)}
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
                  {internalRouteInfo && (
                    <View
                      style={[
                        styles.destinationChip,
                        {
                          borderColor: hexAlpha(accentColor, '60'),
                          backgroundColor: hexAlpha(accentColor, '10'),
                        },
                      ]}
                    >
                      <MaterialIcons
                        name={internalRouteInfo.icon}
                        size={12}
                        color={accentColor}
                      />
                      <Text
                        style={[
                          styles.destinationChipText,
                          { color: accentColor },
                        ]}
                      >
                        {internalRouteInfo.label}
                      </Text>
                    </View>
                  )}

                  {/* Botón de acción explícito — Pressable evita <button> anidado en web */}
                  {latestNotification?.actionButton ? (
                    <Pressable
                      onPress={handleActionButton}
                      style={[
                        styles.actionBtn,
                        { backgroundColor: hexAlpha(accentColor, '12') },
                      ]}
                      accessibilityRole="button"
                    >
                      <Text
                        style={[styles.actionBtnText, { color: accentColor }]}
                      >
                        {latestNotification.actionButton.text ?? 'Voy a verlo'}
                      </Text>
                      <MaterialIcons
                        name={
                          latestNotification.actionButton.isInternal
                            ? 'arrow-forward'
                            : 'open-in-new'
                        }
                        size={13}
                        color={accentColor}
                      />
                    </Pressable>
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
                      h.tap();
                      if (item.key === 'comunica') {
                        setPendingMasScreen('Comunica');
                      } else if (item.key === 'fotos') {
                        setPendingMasScreen('Fotos');
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
                <EmptyState
                  icon="event-note"
                  title="Activa algún calendario"
                  subtitle="Selecciona un calendario para ver los próximos eventos aquí."
                  actionLabel="Ir al calendario"
                  onAction={() => router.push('/calendario')}
                  accentColor={accentColor}
                />
              ) : eventsLoading && !hasUpcomingEvents ? (
                /* Loading skeleton — shown only when there is no cached data */
                <View style={styles.eventsSkeletonWrap}>
                  <Skeleton style={styles.eventSkeleton} />
                  <Skeleton style={styles.eventSkeleton} />
                </View>
              ) : hasUpcomingEvents ? (
                upcomingEventGroups.map((group) =>
                  group.events.map((evt, idx) => {
                    const isFirstInGroup = idx === 0;
                    const evtDate = parseLocalDate(evt.startDate);
                    const calColor =
                      calendarConfigs[evt.calendarIndex]?.color ?? accentColor;
                    const calName = calendarConfigs[evt.calendarIndex]?.name;
                    return (
                      <React.Fragment
                        key={`${group.label}|${evt.title}|${evt.startDate}|${idx}`}
                      >
                        {isFirstInGroup && (
                          <Text
                            style={[
                              styles.weekSeparator,
                              { color: theme.icon },
                            ]}
                          >
                            {group.label}
                          </Text>
                        )}
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
                            <Text
                              style={[styles.eventMonth, { color: calColor }]}
                            >
                              {MONTHS_SHORT[evtDate.getMonth()].toUpperCase()}
                            </Text>
                            <Text
                              style={[styles.eventDay, { color: calColor }]}
                            >
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
                                  style={[
                                    styles.calBadgeText,
                                    { color: calColor },
                                  ]}
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
                      </React.Fragment>
                    );
                  }),
                )
              ) : (
                /* No upcoming events */
                <EmptyState
                  icon="event-busy"
                  title="Sin eventos próximos"
                  accentColor={accentColor}
                />
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
          <SecretMenuTrigger>
            <Text style={[styles.tagline, { color: theme.icon }]}>
              Movimiento Consolación para el Mundo
            </Text>
          </SecretMenuTrigger>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 } as ViewStyle,

  // ── Header ──
  headerWide: {
    maxWidth: 900,
    alignSelf: 'center',
    width: '100%',
  } as ViewStyle,
  logoBox: {
    backgroundColor: colors.primary,
    padding: spacing.sm,
    borderRadius: radii.sm + 2, // 10
  } as ViewStyle,
  logoText: {
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -1.4,
    lineHeight: 38,
  } as TextStyle,
  headerIconBtn: { padding: spacing.sm } as ViewStyle,
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    overflow: 'hidden',
  } as ViewStyle,
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
  eventsSkeletonWrap: {
    gap: spacing.sm,
    marginBottom: spacing.sm,
  } as ViewStyle,
  eventSkeleton: {
    height: 78,
    borderRadius: radii.lg,
  } as ViewStyle,
  weekSeparator: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: spacing.sm + 2,
    marginBottom: spacing.xs,
    marginLeft: spacing.xs,
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

  // ── Onboarding banner ──
  onboardingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm + 4,
    borderRadius: radii.lg,
    borderWidth: 1,
    marginBottom: spacing.md,
  } as ViewStyle,
  onboardingBannerTitle: {
    fontSize: 13,
    fontWeight: '700',
  } as TextStyle,
  onboardingBannerBody: {
    fontSize: 11,
    marginTop: 2,
    lineHeight: 15,
    opacity: 0.8,
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
