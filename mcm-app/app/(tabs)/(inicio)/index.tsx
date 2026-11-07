import { logger } from '@/utils/logger';
import React, {
  ComponentProps,
  useCallback,
  useEffect,
  useState,
  useMemo,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  Linking,
  Platform,
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
import { Stack, router } from 'expo-router';
import { notificationDetailHref } from '@/utils/notificationsInbox';
import { useFocusEffect } from 'expo-router/react-navigation';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialIcons } from '@/components/ui/icons';
import colors, {
  Colors,
  TabHeaderColors,
  themeColors,
} from '@/constants/colors';
import { useActiveMeta } from '@/contexts/ActiveEventContext';
import { useTabScroll } from '@/components/tabs/useTabScroll';
import { useColorScheme } from '@/hooks/useColorScheme';
import useFontScale from '@/hooks/useFontScale';
import useLargeText, {
  CHROME_MAX_FONT_SCALE,
  appScaledTextCap,
} from '@/hooks/useLargeText';
import { Skeleton } from 'heroui-native';
import { useToast } from '@/contexts/AppToastContext';
import SettingsBottomSheet from '@/components/SettingsBottomSheet';
import AppFeedbackModal from '@/components/AppFeedbackModal';
import NotificationPermissionBanner from '@/components/NotificationPermissionBanner';
import { VersionDisplay } from '@/components/VersionDisplay';
import { SecretMenuTrigger } from '@/components/SecretMenuTrigger';
import { useResolvedProfileConfig } from '@/hooks/useResolvedProfileConfig';
import { useVersionGate } from '@/contexts/VersionGateContext';
import { useUserProfile } from '@/contexts/UserProfileContext';
import { useTabNavigation } from '@/hooks/useTabNavigation';
import { localISO } from '@/utils/localDate';
import { hexAlpha, readableOn } from '@/utils/colorUtils';
import { tintedGlyph } from '@/utils/tintColors';
import { motionEasings } from '@/constants/animations';
import typography from '@/constants/typography';
import HomeBrand from '@/components/home/HomeBrand';
import SectionHeader from '@/components/ui/SectionHeader';
import EmptyState from '@/components/ui/EmptyState';
import AppChip from '@/components/ui/AppChip';
import GlassActionGroup from '@/components/ui/GlassActionGroup';
import PressableScale from '@/components/ui/PressableScale';
import {
  DEFAULT_APP_EVALUATION,
  DEFAULT_EVENT_EVALUATION,
  EvaluationConfig,
  evaluationDoneKey,
  isEvaluationOpen,
  mergeEvaluationConfig,
} from '@/constants/evaluation';
import { useFirebaseData } from '@/hooks/useFirebaseData';
import { useActiveSurveys } from '@/hooks/useActiveSurveys';
import SurveyBanner from '@/components/SurveyBanner';
import {
  getEventCacheKey,
  getEventFirebasePath,
  isEventArchived,
} from '@/constants/events';
import { useNotifications } from '@/contexts/NotificationsContext';
import {
  getLocalNotificationsHistory,
  isNotificationOlderThan60Days,
} from '@/services/pushNotificationService';
import { useCalendarConfig } from '@/contexts/CalendarConfigContext';
import { useOTAContext } from '@/contexts/OTAContext';
import { useCarismochito } from '@/contexts/CarismochitoContext';
import { h } from '@/utils/haptics';
import useCalendarEvents from '@/hooks/useCalendarEvents';
import type { CalendarEvent } from '@/hooks/useCalendarEvents';
import { styles } from '@/components/home/homeStyles';

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

function getWeekLabel(date: Date, today: Date): string | null {
  const diffTime = date.getTime() - today.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return 'Ya pasó';
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
  // `localISO()` (hora local) — antes usaba `toISOString()`, que convierte a
  // UTC: en España (UTC+1/+2) "hoy" resultaba ser AYER las 365 noches del
  // año, colando los eventos de ayer como "próximos".
  const todayStr = localISO();
  const today = parseLocalDate(todayStr); // medianoche local, para getWeekLabel
  const seen = new Set<string>();
  const eventsByWeek: Map<string, CalendarEvent[]> = new Map();

  // ⚡ Bolt Optimization: Replaced chained .entries().filter().sort().forEach() with native for-of loops.
  // This allows early exits (break) when we reach maxEvents, avoiding processing
  // the entire calendar dataset unnecessarily when we only need the first few upcoming events.
  const sortedDates = Object.keys(eventsByDate)
    .filter((date) => date >= todayStr)
    .sort();

  for (const dateStr of sortedDates) {
    if (seen.size >= maxEvents) break;

    const evts = eventsByDate[dateStr];
    for (const evt of evts) {
      if (seen.size >= maxEvents) break;
      if (visibleCalendars[evt.calendarIndex] === false) continue;

      const key = `${evt.title}|${evt.startDate}`;
      if (!seen.has(key)) {
        const eventDate = parseLocalDate(dateStr);
        const label = getWeekLabel(eventDate, today);
        if (label === null) continue; // beyond 4 weeks — skip

        seen.add(key);

        if (!eventsByWeek.has(label)) {
          eventsByWeek.set(label, []);
        }
        eventsByWeek.get(label)!.push(evt);
      }
    }
  }

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

/**
 * Relleno de los CTA de evaluación: el rojo MIC y el celeste de marca,
 * oscurecidos lo justo para que el texto BLANCO de encima llegue a 4,5:1
 * (blanco sobre `info` da 2,6:1 y sobre `accent` 3,6:1). Así se conserva el
 * estilo «color + texto blanco» sin pasar a texto oscuro.
 */
const EVAL_ACCENT_FILL = readableOn(colors.accent, colors.white);

// Tamaños base de la escala, para multiplicarlos por `fontScale`.
const FOOTNOTE_SIZE = typography.footnote.fontSize as number;
const SECTION_LABEL_SIZE = typography.sectionLabel.fontSize as number;

/** Opacidad de la pastilla de un acceso rápido (el color de su pestaña). */
const QUICK_FILL_LIGHT = '1F';
const QUICK_FILL_DARK = '33';

interface QuickItem {
  key: string;
  label: string;
  icon: ComponentProps<typeof MaterialIcons>['name'];
  iconBg: string;
  iconColor: string;
  /**
   * Nombre del TAB al que lleva. El camino (directo o entrando por "Más") lo
   * resuelve `goToTab`, que sabe si el tab está en la barra. Antes cada entrada
   * llevaba un `href` fijo y acertaba solo con algunos perfiles.
   */
  tab?: string;
  /** Ruta literal, para destinos que no son un tab (sub-rutas, "Más"…). */
  href?: string;
  dashed?: boolean;
}

export default function Home() {
  // Compacta la barra de pestañas flotante al scrollear y reserva su hueco.
  const { scrollRef, onScroll, contentPaddingBottom } = useTabScroll('index');
  // Navegación a tabs que tiene en cuenta si el tab está en la barra o en el
  // overflow de "Más" (ver utils/tabNavigation.ts).
  const { goToTab, goToEventScreen, goToPath } = useTabNavigation();
  const scheme = useColorScheme();
  const theme = Colors[scheme ?? 'light'];
  // Color neutro de los iconos en la cápsula glass (igual que EventActionButtons).
  const glassFg = scheme === 'dark' ? '#EDEDED' : '#3A3A3C';
  const resolved = useResolvedProfileConfig();
  const { profile } = useUserProfile();
  const fontScale = useFontScale();
  // Letra del sistema grande: la maqueta cambia (cuadrícula de accesos en
  // varias filas, títulos en más líneas). Y los textos que ya multiplican por
  // el tamaño de letra de la app llevan techo para no ir a ×4.
  const large = useLargeText();
  const textCap = appScaledTextCap(fontScale);
  const { width: windowWidth } = useWindowDimensions();
  const isWide = windowWidth >= 700;
  const { toast } = useToast();
  // Modo carismochito: tiñe de verde el icono de la app del header.
  const { isActive: carismoActive, openOnboarding } = useCarismochito();
  const [settingsVisible, setSettingsVisibleRaw] = useState(false);
  const [feedbackVisible, setFeedbackVisible] = useState(false);
  const setSettingsVisible = setSettingsVisibleRaw;

  // Primary color readable on both light and dark backgrounds
  const accentColor = scheme === 'dark' ? colors.info : colors.primary;

  // Banner "modo evento": destaca el evento activo en la Home. Solo se muestra
  // a los perfiles que tienen acceso al evento (tab o botón Home).
  // El evento activo se lee de Firebase (`activities/_meta`) con fallback al
  // valor hardcoded en `constants/events.ts`.
  const { activeEvent } = useActiveMeta();
  const activeTabId = activeEvent.tabId ?? '';
  // Un evento archivado (`status: 'archived'`, ya sea en el registry o puesto
  // desde el panel MCM) deja de destacarse: sin banner, sin botón en la Home y
  // sin tab (esto último lo filtra `useVisibleTabs`). Se sigue viendo en
  // "Más > Eventos pasados".
  const eventArchived = isEventArchived(activeEvent);
  const hasEventAccess =
    !eventArchived &&
    activeTabId !== '' &&
    (resolved.tabs.includes(activeTabId) ||
      resolved.homeButtons.includes(activeTabId));
  const showEventBanner = hasEventAccess;

  // CTA "Evalúa la actividad": el estado abierto/cerrado se lee de Firebase
  // (config en `activities/<evento>/evaluacion/data`) con fallback al código,
  // así el panel abre/cierra la encuesta sin OTA. Se muestra si está abierta y
  // el usuario aún no ha evaluado (flag local). Mismo gating que el evento.
  const { data: eventEvalConfig } = useFirebaseData<Partial<EvaluationConfig>>(
    getEventFirebasePath(activeEvent, 'evaluacion'),
    getEventCacheKey(activeEvent, 'evaluacion'),
  );
  const eventEvalOpen = isEvaluationOpen(
    mergeEvaluationConfig(DEFAULT_EVENT_EVALUATION, eventEvalConfig),
  );
  const { data: appEvalConfig } = useFirebaseData<Partial<EvaluationConfig>>(
    'app/evaluationConfig',
    'app_evaluation_config',
  );
  const appEvalOpen = isEvaluationOpen(
    mergeEvaluationConfig(DEFAULT_APP_EVALUATION, appEvalConfig),
  );
  const [evalDone, setEvalDone] = useState(false);
  useFocusEffect(
    useCallback(() => {
      let active = true;
      AsyncStorage.getItem(evaluationDoneKey(activeEvent.id)).then((v) => {
        if (active) setEvalDone(v === '1');
      });
      return () => {
        active = false;
      };
    }, [activeEvent.id]),
  );
  const showEvalBanner = hasEventAccess && eventEvalOpen && !evalDone;

  // CTA "Evalúa la app": flag en código (DEFAULT_APP_EVALUATION). No depende del
  // evento (la app se evalúa siempre). Abre la pantalla raíz de Ajustes.
  const [appEvalDone, setAppEvalDone] = useState(false);
  useFocusEffect(
    useCallback(() => {
      let active = true;
      AsyncStorage.getItem(evaluationDoneKey('app')).then((v) => {
        if (active) setAppEvalDone(v === '1');
      });
      return () => {
        active = false;
      };
    }, []),
  );
  const showAppEvalBanner = appEvalOpen && !appEvalDone;

  // Encuestas genéricas con placement "home-banner" para el perfil actual.
  const homeSurveys = useActiveSurveys('home-banner');

  // OTA update badge: la OTA se aplica sola al abrir la app o al volver a ella;
  // si llegó con la app en uso queda esperando, y esta insignia deja aplicarla
  // ya con un toque.
  const {
    isReady: otaReady,
    applying: otaApplying,
    applyUpdate: otaApply,
  } = useOTAContext();
  const showUpdateBadge = otaReady && !otaApplying;

  // Store update badge (show in header after the user skips the mandatory
  // "actualiza la app" screen — tapping opens the store directly, no dialog)
  const { updateRequired, updateSkipped, openStore } = useVersionGate();
  const showStoreUpdateBadge = updateRequired && updateSkipped;

  // Notifications
  const { firebaseNotifications, readIds, unreadCount } = useNotifications();
  const latestNotification = firebaseNotifications[0] ?? null;

  // Lo que se sabe sin preguntar a disco: sin notificación, ya leída o de hace
  // más de 60 días, no hay nada que marcar. Solo lo que sobrevive a este filtro
  // merece la comprobación cruzada de abajo.
  const candidate = useMemo(() => {
    if (!latestNotification) return null;
    if (readIds.has(latestNotification.id)) return null;
    const dateStr = (
      'receivedAt' in latestNotification
        ? latestNotification.receivedAt
        : latestNotification.createdAt
    ) as string | undefined;
    if (isNotificationOlderThan60Days(dateStr)) return null;
    return latestNotification;
  }, [latestNotification, readIds]);

  // Comprobación cruzada asíncrona: la misma notificación puede constar ya
  // leída en su copia local, con otro id (se casan por título + cuerpo). El
  // resultado se guarda JUNTO al id comprobado, así que al llegar otra
  // notificación deja de contar solo, sin resetearlo a mano.
  const [crossCheck, setCrossCheck] = useState<{
    id: string;
    unread: boolean;
  } | null>(null);

  useEffect(() => {
    if (!candidate) return;
    let alive = true;
    getLocalNotificationsHistory().then((localData) => {
      if (!alive) return;
      const match = localData.find(
        (n) => n.title === candidate.title && n.body === candidate.body,
      );
      const unread = !(match && (match.isRead || readIds.has(match.id)));
      setCrossCheck((prev) =>
        prev && prev.id === candidate.id && prev.unread === unread
          ? prev
          : { id: candidate.id, unread },
      );
    });
    return () => {
      alive = false;
    };
  }, [candidate, readIds]);

  // Como antes: no se enciende hasta que la comprobación cruzada responde.
  const isUnread =
    candidate !== null && crossCheck !== null && crossCheck.id === candidate.id
      ? crossCheck.unread
      : false;

  // Ping animation for the notification badge (Reanimated 3). Solo late
  // mientras la Home está en pantalla: las pestañas de Android y web mantienen
  // las pantallas montadas, y un bucle infinito en segundo plano mantiene a la
  // plataforma produciendo fotogramas (batería, y en web el hilo principal).
  const pingScale = useSharedValue(1);
  const pingOpacity = useSharedValue(0.6);
  useFocusEffect(
    useCallback(() => {
      if (unreadCount === 0) {
        pingScale.set(1);
        pingOpacity.set(0.6);
        return;
      }
      pingScale.set(
        withRepeat(
          withSequence(
            withTiming(1.8, { duration: 800, easing: motionEasings.out }),
            withTiming(1, { duration: 0 }),
          ),
          -1,
        ),
      );
      pingOpacity.set(
        withRepeat(
          withSequence(
            withTiming(0, { duration: 800 }),
            withTiming(0.6, { duration: 0 }),
          ),
          -1,
        ),
      );
      return () => {
        cancelAnimation(pingScale);
        cancelAnimation(pingOpacity);
        pingScale.set(1);
        pingOpacity.set(0.6);
      };
    }, [unreadCount, pingScale, pingOpacity]),
  );
  const animatedPingStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pingScale.get() }],
    opacity: pingOpacity.get(),
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
    // Cada acceso lleva el color de su pestaña (design.md §1: el mismo destino
    // no puede tener un color en la barra y otro en la Home). Comunica va con
    // `colors.purple` porque `TabHeaderColors.comunica` es un rgba.
    const tinted = (tint: string) =>
      tintedGlyph(
        tint,
        theme.background,
        scheme === 'dark' ? QUICK_FILL_DARK : QUICK_FILL_LIGHT,
      );
    const comunicaColors = tinted(colors.purple);
    const cancioneroColors = tinted(TabHeaderColors.cancionero);
    const visitapapaColors = tinted(TabHeaderColors.visitapapa);
    const fotosColors = tinted(TabHeaderColors.fotos);
    const evangelioColors = tinted(TabHeaderColors.contigo);
    const catalog: Record<string, QuickItem> = {
      comunica: {
        key: 'comunica',
        label: 'Comunica',
        icon: 'forum',
        iconBg: comunicaColors.fill,
        iconColor: comunicaColors.glyph,
        tab: 'comunica',
      },
      cancionero: {
        key: 'cancionero',
        label: 'Cantoral',
        icon: 'music-note',
        iconBg: cancioneroColors.fill,
        iconColor: cancioneroColors.glyph,
        tab: 'cancionero',
      },
      visitapapa: {
        key: 'visitapapa',
        label: 'Visita Papa',
        icon: 'church',
        iconBg: visitapapaColors.fill,
        iconColor: visitapapaColors.glyph,
        // El tab del evento en curso; su nombre lo pone el perfil, no está fijo.
        tab: activeTabId || 'visitapapa',
      },
      fotos: {
        key: 'fotos',
        label: 'Fotos',
        icon: 'image',
        iconBg: fotosColors.fill,
        iconColor: fotosColors.glyph,
        tab: 'fotos',
      },
      evangelio: {
        key: 'evangelio',
        label: 'Evangelio',
        icon: 'menu-book',
        iconBg: evangelioColors.fill,
        iconColor: evangelioColors.glyph,
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
    // El botón del evento en curso desaparece cuando el evento se archiva.
    return resolved.homeButtons
      .filter((id) => visible.has(id) && catalog[id])
      .filter((id) => !(eventArchived && id === activeTabId))
      .map((id) => catalog[id]);
  }, [
    resolved.homeButtons,
    scheme,
    theme.background,
    theme.icon,
    eventArchived,
    activeTabId,
  ]);

  // Notification card content
  // La tarjeta solo se pinta con una notificación real (ver «Novedades»).
  const notifTitle = latestNotification?.title ?? '';
  const notifBody = latestNotification?.body ?? '';

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
    '/': { label: 'Inicio', icon: 'home' },
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
      // Como la campana: `goToPath` sabe llegar a un tab que en iOS no está en
      // la barra y pone la portada debajo de una subruta.
      goToPath(normalizeRoute(btn.url));
    } else {
      Linking.openURL(btn.url).catch((e) => logger.error(e));
    }
  };

  // Navega al calendario (opcionalmente saltando a una fecha concreta).
  //
  // El camino lo decide `goToTab` mirando si `calendario` está DE VERDAD en la
  // barra (ver utils/tabNavigation.ts). Antes esto miraba solo `Platform.OS`
  // === 'ios' y entraba SIEMPRE por "Más": cuando el calendario sí cabía en la
  // barra —que depende del perfil y de si hay evento en curso— se aterrizaba en
  // el tab equivocado, y si el perfil no tenía "Más" no se llegaba a ninguna
  // parte.
  const navigateToCalendar = (date?: string) => {
    h.tap();
    goToTab('calendario', date ? { date } : undefined);
  };

  // Fila de abajo del aviso: destino interno + botón de acción. Ver la nota
  // de la tarjeta sobre por qué con acción va fuera de la zona pulsable.
  const hasNotifAction = !!latestNotification?.actionButton;
  const notifCtaRow = (
    <View style={styles.notifCtaRow}>
      {/* Chip de destino (internalRoute) — solo indicador, la tarjeta lleva a /notifications */}
      {internalRouteInfo && (
        <AppChip
          label={internalRouteInfo.label}
          color={accentColor}
          icon={internalRouteInfo.icon}
        />
      )}

      {/* Botón de acción explícito: hermano de la zona pulsable, no hijo */}
      {latestNotification?.actionButton ? (
        <Pressable
          onPress={handleActionButton}
          style={[
            styles.actionBtn,
            { backgroundColor: hexAlpha(accentColor, '12') },
          ]}
          accessibilityRole="button"
        >
          <Text style={[styles.actionBtnText, { color: accentColor }]}>
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
          <MaterialIcons name="east" size={14} color={accentColor} />
        </View>
      ) : null}
    </View>
  );

  const brand = (
    <HomeBrand
      carismoActive={carismoActive}
      isDark={scheme === 'dark'}
      onCarismoPress={openOnboarding}
    />
  );

  // Acciones de la derecha para Android y web (en iOS son `Stack.Toolbar`).
  const headerActions = [
    ...(showStoreUpdateBadge
      ? [
          {
            key: 'store-update',
            onPress: openStore,
            accessibilityLabel:
              'Tienes que actualizar la app. Toca para ir a la tienda',
            children: (
              <MaterialIcons
                name="system-update"
                size={22}
                color={colors.accent}
              />
            ),
          },
        ]
      : []),
    ...(showUpdateBadge
      ? [
          {
            key: 'ota',
            onPress: otaApply,
            accessibilityLabel:
              'Actualización disponible. Toca y actualiza en menos de 5 segundos',
            children: (
              <MaterialIcons
                name="system-update"
                size={22}
                color={colors.green}
              />
            ),
          },
        ]
      : []),
    ...(resolved.showNotificationsIcon
      ? [
          {
            key: 'notif',
            onPress: () => router.push('/notifications'),
            accessibilityLabel:
              unreadCount > 0
                ? `Notificaciones, ${unreadCount} sin leer`
                : 'Notificaciones',
            children: (
              <View style={styles.bellWrap}>
                <MaterialIcons name="notifications" size={22} color={glassFg} />
                {unreadCount > 0 && (
                  <View style={styles.dotWrap}>
                    <Animated.View
                      style={[styles.dotPing, animatedPingStyle]}
                    />
                    <View style={styles.dot} />
                  </View>
                )}
              </View>
            ),
          },
        ]
      : []),
    {
      key: 'settings',
      onPress: () => setSettingsVisible(true),
      accessibilityLabel: 'Perfil y ajustes',
      children: (
        <MaterialIcons name="account-circle" size={22} color={glassFg} />
      ),
    },
  ];

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: theme.background }]}
      edges={[]}
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
            label: '¡Gracias! Hemos recibido tu comentario 🙌',
            actionLabel: 'Cerrar',
            onActionPress: ({ hide }) => hide(),
          })
        }
      />

      {/* ── Cabecera NATIVA (pila `(inicio)`) ──
          iOS: el logo con «MCM App» a la izquierda (sin cápsula) y los botones
          de cristal a la derecha son `Stack.Toolbar`. Android y web: las mismas
          piezas como vistas normales. */}
      <Stack.Screen
        options={{
          headerTitle: '',
          ...(Platform.OS === 'ios'
            ? {}
            : {
                headerLeft: () => brand,
                headerRight: () => <GlassActionGroup items={headerActions} />,
              }),
        }}
      />
      {Platform.OS === 'ios' && (
        <>
          <Stack.Toolbar placement="left">
            <Stack.Toolbar.View hidesSharedBackground>
              {brand}
            </Stack.Toolbar.View>
          </Stack.Toolbar>
          <Stack.Toolbar placement="right">
            {showStoreUpdateBadge && (
              <Stack.Toolbar.Button
                icon="arrow.down.app"
                tintColor={colors.accent}
                accessibilityLabel="Tienes que actualizar la app. Toca para ir a la tienda"
                onPress={openStore}
              />
            )}
            {showUpdateBadge && (
              <Stack.Toolbar.Button
                icon="arrow.down.app"
                tintColor={colors.green}
                accessibilityLabel="Actualización disponible. Toca y actualiza en menos de 5 segundos"
                onPress={otaApply}
              />
            )}
            {resolved.showNotificationsIcon && (
              <Stack.Toolbar.Button
                icon="bell"
                accessibilityLabel={
                  unreadCount > 0
                    ? `Notificaciones, ${unreadCount} sin leer`
                    : 'Notificaciones'
                }
                onPress={() => router.push('/notifications')}
              >
                {unreadCount > 0 && (
                  <Stack.Toolbar.Badge>
                    {unreadCount > 99 ? '99+' : String(unreadCount)}
                  </Stack.Toolbar.Badge>
                )}
              </Stack.Toolbar.Button>
            )}
            <Stack.Toolbar.Button
              icon="person.crop.circle"
              accessibilityLabel="Perfil y ajustes"
              onPress={() => setSettingsVisible(true)}
            />
          </Stack.Toolbar>
        </>
      )}

      <Animated.ScrollView
        ref={scrollRef}
        onScroll={onScroll}
        scrollEventThrottle={16}
        style={{ backgroundColor: theme.background }}
        contentContainerStyle={[
          styles.scrollContent,
          isWide && styles.scrollContentWide,
          {
            paddingBottom: contentPaddingBottom,
          },
        ]}
        showsVerticalScrollIndicator={false}
        // iOS: con la cabecera transparente, el sistema reserva su altura solo.
        contentInsetAdjustmentBehavior="automatic"
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
                    En solo 1 minuto
                  </Text>
                  <Text
                    style={[styles.onboardingBannerBody, { color: theme.icon }]}
                    numberOfLines={2}
                  >
                    Dinos a qué localidad perteneces y te mostraremos las
                    secciones más importantes.
                  </Text>
                </View>
                <MaterialIcons
                  name="chevron-right"
                  size={20}
                  color={accentColor}
                />
              </TouchableOpacity>
            )}

            {/* ── Banner de permisos de notificaciones (denied / undetermined) ── */}
            <NotificationPermissionBanner placement="home" />

            {/* ── Banner del evento activo (modo evento) ── */}
            {showEventBanner && (
              <TouchableOpacity
                style={[
                  styles.eventBanner,
                  {
                    backgroundColor: hexAlpha(activeEvent.tintColor, '20'),
                    borderColor: hexAlpha(activeEvent.tintColor, '50'),
                  },
                ]}
                onPress={() => {
                  h.tap();
                  // El tab del evento lo dice el perfil (`tabId`), y puede estar
                  // en la barra o en overflow: antes esto era un '/visitapapa'
                  // fijo que no llevaba a ninguna parte en cuanto el evento no
                  // cabía en la barra.
                  goToTab(activeTabId || 'visitapapa');
                }}
                accessibilityRole="button"
                accessibilityLabel={activeEvent.title}
              >
                <View
                  style={[
                    styles.eventBannerIcon,
                    {
                      backgroundColor: hexAlpha(
                        activeEvent.tintColor,
                        scheme === 'dark' ? '45' : '35',
                      ),
                    },
                  ]}
                >
                  <MaterialIcons
                    name="church"
                    size={22}
                    color={readableOn(activeEvent.tintColor, theme.background)}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={[styles.eventBannerTitle, { color: theme.text }]}
                    numberOfLines={large ? 3 : 1}
                  >
                    {activeEvent.title}
                  </Text>
                  {activeEvent.bannerText && (
                    <Text
                      style={[styles.eventBannerBody, { color: theme.icon }]}
                      numberOfLines={2}
                    >
                      {activeEvent.bannerText}
                    </Text>
                  )}
                </View>
                <MaterialIcons
                  name="chevron-right"
                  size={22}
                  color={theme.icon}
                />
              </TouchableOpacity>
            )}

            {/* ── CTA "Evalúa la actividad" — destacado y directo ── */}
            {showEvalBanner && (
              <TouchableOpacity
                style={[
                  styles.evalCta,
                  { backgroundColor: EVAL_ACCENT_FILL },
                  // Letra grande: el botón va debajo del texto (en fila no
                  // dejaba sitio al título) y el icono se quita.
                  large && styles.evalCtaLarge,
                ]}
                onPress={() => {
                  h.tap();
                  // Entra por el tab del evento si tiene ruta propia y por
                  // "Más" si está en overflow (allí están registradas las
                  // mismas pantallas de evento).
                  goToEventScreen('Evaluacion', { eventId: activeEvent.id });
                }}
                activeOpacity={0.9}
                accessibilityRole="button"
                accessibilityLabel="Evalúa la actividad ahora"
              >
                {!large && (
                  <View style={styles.evalCtaIcon}>
                    <MaterialIcons name="star-rate" size={26} color="#fff" />
                  </View>
                )}
                <View style={large ? undefined : styles.evalCtaTextWrap}>
                  <Text
                    style={styles.evalCtaTitle}
                    numberOfLines={large ? undefined : 1}
                  >
                    {DEFAULT_EVENT_EVALUATION.title || 'Evalúa la actividad'}
                  </Text>
                  <Text
                    style={styles.evalCtaBody}
                    numberOfLines={large ? undefined : 2}
                  >
                    ¿Qué tal ha ido? Tu opinión nos ayuda — solo 2 minutos.
                  </Text>
                </View>
                <View style={styles.evalCtaBtn}>
                  <Text
                    style={[styles.evalCtaBtnText, { color: EVAL_ACCENT_FILL }]}
                  >
                    Evaluar
                  </Text>
                  <MaterialIcons
                    name="arrow-forward"
                    size={15}
                    color={EVAL_ACCENT_FILL}
                  />
                </View>
              </TouchableOpacity>
            )}

            {/* ── CTA "Evalúa la app": una fila tranquila, no un bloque de color ── */}
            {showAppEvalBanner && (
              <TouchableOpacity
                style={[
                  styles.onboardingBanner,
                  {
                    backgroundColor: theme.card,
                    borderColor:
                      scheme === 'dark'
                        ? 'rgba(255,255,255,0.09)'
                        : 'rgba(0,0,0,0.07)',
                  },
                ]}
                onPress={() => {
                  h.tap();
                  router.push('/evaluacion-app');
                }}
                accessibilityRole="button"
                accessibilityLabel="Evalúa la app"
              >
                <MaterialIcons
                  name="rate-review"
                  size={20}
                  color={theme.icon}
                />
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      styles.onboardingBannerTitle,
                      { color: theme.text },
                    ]}
                  >
                    {DEFAULT_APP_EVALUATION.title || 'Evalúa la app'}
                  </Text>
                  <Text
                    style={[styles.onboardingBannerBody, { color: theme.icon }]}
                    numberOfLines={2}
                  >
                    ¿Errores o ideas? Ayúdanos a mejorar la app.
                  </Text>
                </View>
                <MaterialIcons
                  name="chevron-right"
                  size={20}
                  color={theme.icon}
                />
              </TouchableOpacity>
            )}

            {/* ── Encuestas activas (banner automático por placement) ── */}
            {homeSurveys.map((s) => (
              <SurveyBanner key={s.id} entry={s} />
            ))}

            {/* ── Novedades: solo con una notificación real (antes, sin ninguna,
                salía una tarjeta de bienvenida con texto de relleno) ── */}
            {latestNotification ? (
              <View style={styles.section}>
                {/* El botón de acción del aviso NO puede vivir dentro de la
                  tarjeta pulsable: en web eso es un <button> dentro de otro
                  (HTML inválido, y el lector de pantalla lo lee como uno
                  solo). Con acción, la fila de abajo va FUERA de la zona
                  pulsable, debajo; sin acción, todo es un solo botón. */}
                <View
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
                >
                  <TouchableOpacity
                    onPress={() => {
                      // Abre la notificación y «volver» (flecha o gesto) regresa
                      // a Inicio. Un segundo `push`/`navigate` de la lista
                      // duplicaba pantallas o la colapsaba: no se usa.
                      router.push(
                        notificationDetailHref(latestNotification.id) as any,
                      );
                    }}
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
                              style={[
                                styles.newBadgeText,
                                { color: accentColor },
                              ]}
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
                              lineHeight: 22 * fontScale,
                            },
                          ]}
                          numberOfLines={large ? 4 : 2}
                          maxFontSizeMultiplier={textCap}
                        >
                          {notifTitle}
                        </Text>
                        <Text
                          style={[
                            styles.notifDescription,
                            {
                              color: theme.icon,
                              fontSize: 13 * fontScale,
                              lineHeight: 19 * fontScale,
                            },
                          ]}
                          numberOfLines={large ? 4 : 2}
                          maxFontSizeMultiplier={textCap}
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

                    {hasNotifAction ? null : notifCtaRow}
                  </TouchableOpacity>
                  {hasNotifAction ? notifCtaRow : null}
                </View>
              </View>
            ) : null}

            {/* ── Accesos rápidos ── */}
            <View style={styles.section}>
              <View
                style={[
                  styles.quickGrid,
                  isWide && styles.quickGridWide,
                  large && !isWide && styles.quickGridLarge,
                ]}
              >
                {quickItems.map((item) => (
                  <PressableScale
                    key={item.key}
                    style={[
                      styles.quickItem,
                      large && !isWide && styles.quickItemLarge,
                    ]}
                    accessibilityLabel={item.label}
                    accessibilityRole="button"
                    onPress={() => {
                      h.tap();
                      // `goToTab` resuelve el camino según la barra real; los
                      // destinos que no son un tab siguen con su ruta literal.
                      if (item.tab) goToTab(item.tab);
                      else if (item.href) router.push(item.href as any);
                    }}
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
                          fontSize: FOOTNOTE_SIZE * fontScale,
                        },
                      ]}
                      numberOfLines={2}
                      maxFontSizeMultiplier={textCap}
                    >
                      {item.label}
                    </Text>
                  </PressableScale>
                ))}
              </View>
            </View>
          </View>
          {/* end left column */}

          {/* ── Right column (or full-width on mobile) ── */}
          <View style={isWide ? styles.wideColRight : undefined}>
            {/* ── Próximos eventos ── */}
            <View style={styles.section}>
              <SectionHeader
                label="Próximos eventos"
                style={styles.sectionHeader}
                textStyle={{
                  fontSize: SECTION_LABEL_SIZE * fontScale,
                }}
                maxFontSizeMultiplier={textCap}
              />

              {!hasAnyVisibleCalendar && calendarConfigs.length > 0 ? (
                /* User has calendars but all hidden */
                <EmptyState
                  icon="event-note"
                  title="Activa algún calendario"
                  subtitle="Selecciona un calendario para ver los próximos eventos aquí."
                  actionLabel="Ir al calendario"
                  onAction={() => navigateToCalendar()}
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
                            },
                          ])}
                          onPress={() => navigateToCalendar(evt.startDate)}
                          accessibilityRole="button"
                          accessibilityLabel={`Evento: ${evt.title}`}
                        >
                          <View
                            style={[
                              styles.eventDateBox,
                              { backgroundColor: hexAlpha(calColor, '18') },
                            ]}
                          >
                            {/* Recuadro de 44 px de un vistazo: techo de
                                cromo, o los números se salían del recuadro. */}
                            <Text
                              style={[styles.eventMonth, { color: calColor }]}
                              maxFontSizeMultiplier={CHROME_MAX_FONT_SCALE}
                            >
                              {MONTHS_SHORT[evtDate.getMonth()].toUpperCase()}
                            </Text>
                            <Text
                              style={[styles.eventDay, { color: calColor }]}
                              maxFontSizeMultiplier={CHROME_MAX_FONT_SCALE}
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
                              numberOfLines={large ? 3 : 1}
                              maxFontSizeMultiplier={textCap}
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
                                  name="place"
                                  size={12}
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
                                  numberOfLines={large ? 2 : 1}
                                  maxFontSizeMultiplier={textCap}
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
                  title="Sin próximos eventos"
                  accentColor={accentColor}
                />
              )}

              <TouchableOpacity
                style={StyleSheet.flatten([
                  styles.calendarButton,
                  { borderColor: hexAlpha(accentColor, '30') },
                ])}
                onPress={() => navigateToCalendar()}
                accessibilityRole="button"
              >
                <Text
                  style={[
                    styles.calendarButtonText,
                    { color: accentColor, fontSize: 14 * fontScale },
                  ]}
                  maxFontSizeMultiplier={textCap}
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
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text
              style={[
                styles.feedbackText,
                { color: themeColors(scheme === 'dark').textSecondary },
              ]}
            >
              ¿Algún fallo? Cuéntanoslo
            </Text>
          </TouchableOpacity>
          <SecretMenuTrigger>
            <Text style={[styles.tagline, { color: theme.icon }]}>
              Movimiento Consolación para el Mundo
            </Text>
          </SecretMenuTrigger>
        </View>
      </Animated.ScrollView>
    </SafeAreaView>
  );
}
