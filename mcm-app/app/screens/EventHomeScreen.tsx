import React from 'react';
import {
  View,
  StyleSheet,
  Text,
  ViewStyle,
  TextStyle,
  useWindowDimensions,
  ScrollView,
  Platform,
  Linking,
  Image,
  ImageStyle,
} from 'react-native';
import { PressableFeedback } from 'heroui-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MaterialIcons } from '@expo/vector-icons';

import { useColorScheme } from '@/hooks/useColorScheme';
import { hexAlpha, darkenHex } from '@/utils/colorUtils';
import { getBrightness } from '@/components/ui/glass';
import { radii, shadows } from '@/constants/uiStyles';
import spacing from '@/constants/spacing';
import { EventStackParamList } from './eventStackScreens';
import { useFirebaseData } from '@/hooks/useFirebaseData';
import useNetworkStatus from '@/hooks/useNetworkStatus';
import OfflineBanner from '@/components/OfflineBanner';
import { useCurrentEvent } from '@/hooks/useCurrentEvent';
import {
  EventConfig,
  EventSection,
  getEventCacheKey,
  getEventFirebasePath,
} from '@/constants/events';

const WIDE_BREAKPOINT = 700;

/**
 * Hub genérico de un evento (Jubileo, encuentros, retiros, etc.).
 *
 * Lee el `eventId` del route param vía `useCurrentEvent()` y renderiza
 * el grid de secciones definido en `constants/events.ts`. Para crear un
 * evento nuevo basta con añadir la config allí y navegar a esta pantalla
 * con `{ eventId }`; todas las sub-pantallas resuelven su path de
 * Firebase a partir del mismo registry.
 */
export default function EventHomeScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<EventStackParamList>>();
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const event = useCurrentEvent();

  const { width } = useWindowDimensions();
  const isWide = width >= WIDE_BREAKPOINT;
  const columns = isWide ? 3 : 2;
  const containerPadding = spacing.md;
  const gap = spacing.md;
  const itemWidth =
    (Math.min(width, 1100) - containerPadding * 2 - gap * (columns - 1)) /
    columns;

  const styles = React.useMemo(() => createStyles(isDark), [isDark]);

  // Pre-filtro: secciones ocultas en el config local nunca se montan.
  // Las ocultas desde Firebase se filtran dentro de SectionCard (que
  // retorna null), manteniendo el orden de hooks estable.
  const visibleSections = React.useMemo(
    () => event.sections.filter((s) => !s.hidden),
    [event.sections],
  );

  const isConnected = useNetworkStatus();
  const offline = isConnected === false;

  // El header nativo solo se muestra cuando el hub está apilado sobre otra
  // pantalla (índice > 0, p.ej. abierto desde "Más"). En la tab propia del
  // evento es la raíz del stack → sin header, así que aquí añadimos el
  // safe-area top y evitamos el hueco blanco que había antes.
  const stackIndex =
    (navigation.getState?.() as { index?: number } | undefined)?.index ?? 0;
  const isPushed = stackIndex > 0;

  const tint = event.tintColor;
  const tintIsLight = getBrightness(tint) > 175;
  const heroFg = tintIsLight ? '#1A1A1A' : '#FFFFFF';
  const heroMuted = tintIsLight
    ? 'rgba(26,26,26,0.72)'
    : 'rgba(255,255,255,0.9)';
  const emblemBg = tintIsLight
    ? 'rgba(255,255,255,0.5)'
    : 'rgba(255,255,255,0.16)';

  return (
    <SafeAreaView style={styles.container} edges={isPushed ? [] : ['top']}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { padding: containerPadding, rowGap: gap },
        ]}
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
      >
        {offline && <OfflineBanner text="Mostrando datos sin conexión" />}

        {/* ── Hero del evento ── */}
        {/* Rellena el espacio superior con identidad: emblema/logo + título +
            lema. Si el evento define `heroImage` se muestra su logo; si no, un
            emblema-placeholder discreto. */}
        <LinearGradient
          colors={[tint, darkenHex(tint, 0.22)]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          {event.heroImage ? (
            <Image
              source={event.heroImage}
              style={styles.heroImage}
              resizeMode="contain"
              accessibilityIgnoresInvertColors
            />
          ) : (
            <View style={[styles.heroEmblem, { backgroundColor: emblemBg }]}>
              <MaterialIcons name="auto-awesome" size={26} color={heroFg} />
            </View>
          )}
          <Text style={[styles.heroTitle, { color: heroFg }]}>
            {event.title}
          </Text>
          {event.bannerText ? (
            <Text style={[styles.heroSubtitle, { color: heroMuted }]}>
              {event.bannerText}
            </Text>
          ) : null}
        </LinearGradient>

        <View style={[styles.gridContainer, { gap }]}>
          {visibleSections.map((section) => (
            <SectionCard
              key={section.firebaseKey ?? section.url ?? section.label}
              section={section}
              event={event}
              width={itemWidth}
              isDark={isDark}
              onPress={() => {
                // Sección-enlace: abre la URL externa (ej. Google Maps).
                if (section.url) {
                  Linking.openURL(section.url).catch(() => {});
                  return;
                }
                if (section.target) {
                  (navigation as any).navigate(section.target, {
                    eventId: event.id,
                  });
                }
              }}
            />
          ))}
        </View>

        {/* ── Lema del encuentro ── */}
        <View style={styles.motto}>
          <View
            style={[
              styles.mottoLine,
              { backgroundColor: hexAlpha(tint, '55') },
            ]}
          />
          <MaterialIcons name="arrow-upward" size={15} color={tint} />
          <Text
            style={[
              styles.mottoText,
              { color: isDark ? '#C7C7CC' : '#6B7280' },
            ]}
          >
            Alzad la mirada
          </Text>
          <View
            style={[
              styles.mottoLine,
              { backgroundColor: hexAlpha(tint, '55') },
            ]}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Card de sección ─────────────────────────────────────────────────
// Cada card lee el nodo Firebase de su sección (si tiene firebaseKey)
// para: (a) calentar la caché para la sub-pantalla y (b) respetar el
// flag `hidden` que el panel MCM puede poner en Firebase.

function SectionCard({
  section,
  event,
  width,
  isDark,
  onPress,
}: {
  section: EventSection;
  event: EventConfig;
  width: number;
  isDark: boolean;
  onPress: () => void;
}) {
  const styles = React.useMemo(() => createStyles(isDark), [isDark]);
  const sectionSlug = section.firebaseKey ?? section.target ?? section.label;
  const { hidden: firebaseHidden } = useFirebaseData(
    section.firebaseKey
      ? getEventFirebasePath(event, section.firebaseKey)
      : `__noop__/${sectionSlug}`,
    section.firebaseKey
      ? getEventCacheKey(event, section.firebaseKey)
      : `__noop__${event.id}_${sectionSlug}`,
  );

  if (firebaseHidden) return null;

  return (
    <PressableFeedback
      style={[
        styles.card,
        {
          width,
          backgroundColor: isDark ? '#2C2C2E' : '#fff',
        },
        Platform.OS !== 'web'
          ? {
              shadowColor: section.tintColor,
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: isDark ? 0.3 : 0.15,
              shadowRadius: 12,
              elevation: 4,
            }
          : ({
              boxShadow: `0 4px 12px ${hexAlpha(section.tintColor, '30')}`,
            } as ViewStyle),
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={
        section.subtitle
          ? `${section.label}. ${section.subtitle}`
          : section.label
      }
    >
      <PressableFeedback.Highlight />

      <View
        style={[styles.accentBar, { backgroundColor: section.tintColor }]}
      />

      <View style={styles.cardBody}>
        <View
          style={[
            styles.iconCircle,
            { backgroundColor: hexAlpha(section.tintColor, '18') },
          ]}
        >
          <Text style={styles.emoji}>{section.emoji}</Text>
        </View>

        <Text
          style={[styles.cardTitle, { color: isDark ? '#fff' : '#1C1C1E' }]}
          numberOfLines={1}
        >
          {section.label}
        </Text>

        {section.subtitle && (
          <Text
            style={[
              styles.cardSubtitle,
              { color: isDark ? '#8E8E93' : '#6B7280' },
            ]}
            numberOfLines={2}
          >
            {section.subtitle}
          </Text>
        )}

        {section.materialIcon && (
          <View
            style={[
              styles.arrowPill,
              { backgroundColor: hexAlpha(section.tintColor, '15') },
            ]}
          >
            <MaterialIcons
              name={section.materialIcon}
              size={14}
              color={section.tintColor}
            />
          </View>
        )}
      </View>
    </PressableFeedback>
  );
}

interface Styles {
  container: ViewStyle;
  scrollView: ViewStyle;
  scrollContent: ViewStyle;
  hero: ViewStyle;
  heroEmblem: ViewStyle;
  heroImage: ImageStyle;
  heroTitle: TextStyle;
  heroSubtitle: TextStyle;
  motto: ViewStyle;
  mottoLine: ViewStyle;
  mottoText: TextStyle;
  gridContainer: ViewStyle;
  card: ViewStyle;
  accentBar: ViewStyle;
  cardBody: ViewStyle;
  iconCircle: ViewStyle;
  emoji: TextStyle;
  cardTitle: TextStyle;
  cardSubtitle: TextStyle;
  arrowPill: ViewStyle;
}

const createStyles = (isDark: boolean) =>
  StyleSheet.create<Styles>({
    container: {
      flex: 1,
      backgroundColor: isDark ? '#1C1C1E' : '#F2F2F7',
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      flexGrow: 1,
      alignItems: 'center',
      paddingBottom: Platform.OS === 'ios' ? 100 : spacing.xl,
    },
    hero: {
      width: '100%',
      maxWidth: 1100,
      borderRadius: radii.xxl,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.lg,
      marginBottom: spacing.xs,
      overflow: 'hidden',
      ...(Platform.OS === 'web'
        ? ({ boxShadow: '0 10px 30px rgba(0,0,0,0.16)' } as ViewStyle)
        : (shadows.xl as ViewStyle)),
    },
    heroEmblem: {
      width: 52,
      height: 52,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.md,
    },
    heroImage: {
      width: 132,
      height: 132,
      alignSelf: 'flex-start',
      marginBottom: spacing.md,
    },
    heroTitle: {
      fontSize: 26,
      fontWeight: '800',
      letterSpacing: -0.6,
      lineHeight: 30,
    },
    heroSubtitle: {
      fontSize: 14,
      fontWeight: '500',
      lineHeight: 19,
      marginTop: 6,
      maxWidth: 460,
    },
    motto: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      marginTop: spacing.md,
      paddingHorizontal: spacing.lg,
    },
    mottoLine: {
      height: StyleSheet.hairlineWidth * 2,
      width: 28,
      borderRadius: 1,
    },
    mottoText: {
      fontSize: 13,
      fontWeight: '700',
      fontStyle: 'italic',
      letterSpacing: 0.3,
      textTransform: 'uppercase',
    },
    gridContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      width: '100%',
      maxWidth: 1100,
    },
    card: {
      borderRadius: radii.xl,
      overflow: 'hidden',
    },
    accentBar: {
      height: 4,
      width: '100%',
    },
    cardBody: {
      paddingHorizontal: spacing.md,
      paddingTop: spacing.md,
      paddingBottom: spacing.md,
      alignItems: 'flex-start',
      gap: 6,
      minHeight: 150,
    },
    iconCircle: {
      width: 52,
      height: 52,
      borderRadius: 16,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 4,
    },
    emoji: {
      fontSize: 28,
    },
    cardTitle: {
      fontSize: 17,
      fontWeight: '700',
      letterSpacing: -0.3,
    },
    cardSubtitle: {
      fontSize: 12,
      lineHeight: 16,
    },
    arrowPill: {
      position: 'absolute',
      top: spacing.sm,
      right: spacing.sm,
      width: 28,
      height: 28,
      borderRadius: 14,
      justifyContent: 'center',
      alignItems: 'center',
    },
  });
