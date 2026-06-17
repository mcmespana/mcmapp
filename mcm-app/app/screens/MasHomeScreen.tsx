import React, { useCallback, useState } from 'react';
import {
  View,
  StyleSheet,
  Text,
  ScrollView,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { PressableFeedback } from 'heroui-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { router } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';

import { useColorScheme } from '@/hooks/useColorScheme';
import { hexAlpha } from '@/utils/colorUtils';
import { VersionDisplay } from '@/components/VersionDisplay';
import { SecretMenuTrigger } from '@/components/SecretMenuTrigger';
import AppFeedbackModal from '@/components/AppFeedbackModal';
import { MasStackParamList } from '../(tabs)/mas';
import { useResolvedProfileConfig } from '@/hooks/useResolvedProfileConfig';
import { takePendingMasScreen } from '@/utils/masNavigation';
import PageContainer from '@/components/ui/PageContainer';
import ScreenHero from '@/components/ui/ScreenHero';
import { useResponsive } from '@/hooks/useResponsive';
import { splitTabsForIOS } from '@/constants/tabsCatalog';
import spacing from '@/constants/spacing';
import { radii } from '@/constants/uiStyles';

interface NavigationItem {
  label: string;
  subtitle: string;
  emoji: string;
  materialIcon: ComponentProps<typeof MaterialIcons>['name'];
  /** Si está definido, navega a una ruta expo-router (overflow de tab). */
  routePath?: string;
  /** Si está definido, navega a una pantalla dentro del stack de Mas. */
  target?: keyof MasStackParamList;
  tintColor: string;
  /** Id del evento a pasar como route param cuando target === 'JubileoHome'. */
  eventId?: string;
}

const MAS_ITEM_CATALOG: Record<string, NavigationItem> = {
  comunica: {
    label: 'Comunica',
    subtitle: 'Portal de comunicación MCM',
    emoji: '📣',
    materialIcon: 'forum',
    target: 'Comunica',
    tintColor: '#E08A3C',
  },
  'comunica-gestion': {
    label: 'Gestión',
    subtitle: 'Administración y CRM',
    emoji: '⚙️',
    materialIcon: 'admin-panel-settings',
    target: 'ComunicaGestion',
    tintColor: '#607D8B',
  },
  jubileo: {
    label: 'Jubileo',
    subtitle: 'Horarios, materiales, grupos...',
    emoji: '🎉',
    materialIcon: 'celebration',
    target: 'JubileoHome',
    eventId: 'jubileo',
    tintColor: '#A3BD31',
  },
  'eventos-pasados': {
    label: 'Eventos pasados',
    subtitle: 'Jubileo y otros encuentros',
    emoji: '🗂️',
    materialIcon: 'history',
    target: 'EventosPasados',
    tintColor: '#9FA8DA',
  },
  // ── Añadir eventos futuros aquí ──
  // Ejemplo:
  //   items.push({
  //     label: 'Encuentro 2027',
  //     subtitle: 'Programa y materiales',
  //     emoji: '✨',
  //     materialIcon: 'auto-awesome',
  //     target: 'JubileoHome',      // ← mismo hub genérico
  //     tintColor: '#E15C62',
  //   });
};

export default function MasHomeScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<MasStackParamList>>();
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const [feedbackVisible, setFeedbackVisible] = useState(false);
  const { isMd, isWeb } = useResponsive();
  const useTwoColumns = isWeb && isMd;
  const resolved = useResolvedProfileConfig();
  const navigationItems = React.useMemo(() => {
    const items: NavigationItem[] = [];

    // En iOS la barra nativa sólo admite 5 triggers; los tabs que no caben
    // se exponen aquí como tarjetas para evitar el "More" automático del sistema.
    if (Platform.OS === 'ios') {
      const visibleSet = new Set(resolved.tabs);
      const { overflowTabs } = splitTabsForIOS(visibleSet);
      // Tabs cuyo screen está registrado en el stack de Más (no accesibles vía router.navigate en iOS)
      const OVERFLOW_STACK_TARGETS: Partial<
        Record<string, keyof MasStackParamList>
      > = {
        fotos: 'Fotos',
        calendario: 'Calendario',
      };
      for (const tab of overflowTabs) {
        // 'mas' nunca debería estar en overflow (splitTabsForIOS lo garantiza),
        // pero filtramos defensivamente para no auto-referenciar esta pantalla.
        if (tab.name === 'mas') continue;
        const stackTarget = OVERFLOW_STACK_TARGETS[tab.name];
        items.push({
          label: tab.label,
          subtitle: tab.subtitle,
          emoji: tab.emoji,
          materialIcon: tab.androidIcon,
          tintColor: tab.tintColor,
          ...(stackTarget
            ? { target: stackTarget }
            : { routePath: `/${tab.name}` }),
        });
      }
    }

    for (const id of resolved.masItems) {
      const entry = MAS_ITEM_CATALOG[id];
      if (entry) items.push(entry);
    }

    return items;
  }, [resolved.masItems, resolved.tabs]);

  // Deep-link desde la Home: si hay una pantalla pendiente, navegar a ella
  useFocusEffect(
    useCallback(() => {
      const pending = takePendingMasScreen();
      if (pending) {
        // navigate() overloads no aceptan tipos unión ni un screen con params
        // `undefined` + params — usamos `as any` como escape hatch idiomático.
        (navigation.navigate as any)(pending.screen, pending.params);
      }
    }, [navigation]),
  );

  return (
    <SafeAreaView
      style={[
        styles.safeArea,
        { backgroundColor: isDark ? '#1C1C1E' : '#F2F2F7' },
      ]}
      edges={['top']}
    >
      <AppFeedbackModal
        visible={feedbackVisible}
        onClose={() => setFeedbackVisible(false)}
      />
      <PageContainer>
        <ScrollView
          style={styles.container}
          contentContainerStyle={
            Platform.OS === 'ios'
              ? { paddingBottom: 140 }
              : { paddingBottom: spacing.xl }
          }
          showsVerticalScrollIndicator={false}
        >
          <ScreenHero title="Más" subtitle="Atajos y secciones de la app" />
          <View
            style={[
              styles.scrollContent,
              useTwoColumns && styles.scrollContentGrid,
            ]}
          >
            {navigationItems.map((item, idx) => (
              <PressableFeedback
                key={idx}
                style={[
                  styles.card,
                  useTwoColumns && styles.cardGridItem,
                  {
                    backgroundColor: isDark ? '#2C2C2E' : '#fff',
                  },
                  Platform.OS !== 'web'
                    ? {
                        shadowColor: item.tintColor,
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: isDark ? 0.3 : 0.15,
                        shadowRadius: 12,
                        elevation: 4,
                      }
                    : {
                        boxShadow: `0 4px 12px ${item.tintColor}30`,
                      },
                ]}
                onPress={() => {
                  if (item.routePath) {
                    // Overflow de tab: salta al tab sibling vía expo-router.
                    // La ruta sigue existiendo aunque no tenga NativeTabs.Trigger.
                    router.navigate(item.routePath as any);
                    return;
                  }
                  if (item.target) {
                    navigation.navigate(
                      item.target as any,
                      item.eventId
                        ? ({ eventId: item.eventId } as any)
                        : undefined,
                    );
                  }
                }}
              >
                <PressableFeedback.Highlight />
                {/* Accent bar izquierda */}
                <View
                  style={[
                    styles.accentBar,
                    { backgroundColor: item.tintColor },
                  ]}
                />

                <View style={styles.cardBody}>
                  {/* Icono grande */}
                  <View
                    style={[
                      styles.iconCircle,
                      { backgroundColor: hexAlpha(item.tintColor, '18') },
                    ]}
                  >
                    <Text style={styles.emoji}>{item.emoji}</Text>
                  </View>

                  {/* Texto */}
                  <View style={styles.cardTextArea}>
                    <Text
                      style={[
                        styles.cardTitle,
                        { color: isDark ? '#fff' : '#1C1C1E' },
                      ]}
                      numberOfLines={1}
                    >
                      {item.label}
                    </Text>
                    <Text
                      style={[
                        styles.cardSubtitle,
                        { color: isDark ? '#8E8E93' : '#6B7280' },
                      ]}
                      numberOfLines={2}
                    >
                      {item.subtitle}
                    </Text>
                  </View>

                  {/* Flecha */}
                  <View
                    style={[
                      styles.arrowCircle,
                      { backgroundColor: hexAlpha(item.tintColor, '15') },
                    ]}
                  >
                    <MaterialIcons
                      name="arrow-forward"
                      size={18}
                      color={item.tintColor}
                    />
                  </View>
                </View>
              </PressableFeedback>
            ))}
          </View>

          {/* ── Pie ── */}
          <View style={styles.footer}>
            <VersionDisplay />
            <TouchableOpacity
              onPress={() => setFeedbackVisible(true)}
              style={styles.feedbackLink}
            >
              <Text
                style={[
                  styles.feedbackText,
                  { color: isDark ? '#8E8E93' : '#6B7280' },
                ]}
              >
                ¿Algún fallo? Cuéntanoslo
              </Text>
            </TouchableOpacity>
            <SecretMenuTrigger>
              <Text
                style={[
                  styles.tagline,
                  { color: isDark ? '#8E8E93' : '#6B7280' },
                ]}
              >
                Movimiento Consolación para el Mundo
              </Text>
            </SecretMenuTrigger>
          </View>
        </ScrollView>
      </PageContainer>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
  },
  scrollContentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  card: {
    borderRadius: radii.xl,
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  cardGridItem: {
    // Two columns minus the row gap (spacing.md) divided over 2 items.
    width: `calc(50% - ${spacing.md / 2}px)` as any,
    marginBottom: 0,
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
  emoji: {
    fontSize: 28,
  },
  cardTextArea: {
    flex: 1,
    gap: spacing.xs,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  cardSubtitle: {
    fontSize: 13,
    lineHeight: 18,
  },
  arrowCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
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
  tagline: {
    fontSize: 11,
    opacity: 0.3,
    marginTop: spacing.sm,
    letterSpacing: 0.2,
    fontStyle: 'italic',
  },
});
