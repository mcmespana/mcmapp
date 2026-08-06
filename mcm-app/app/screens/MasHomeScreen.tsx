import React, { useCallback, useState } from 'react';
import { View, StyleSheet, Text, Platform } from 'react-native';
import { PressableFeedback } from 'heroui-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from 'expo-router/react-navigation';
import { NativeStackNavigationProp } from 'expo-router/build/react-navigation/native-stack';
import { MaterialIcons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';

import { useColorScheme } from '@/hooks/useColorScheme';
import { hexAlpha } from '@/utils/colorUtils';
import MasFooter from '@/components/mas/MasFooter';
import AppFeedbackModal from '@/components/AppFeedbackModal';
import { MasStackParamList } from '../(tabs)/mas';
import { useResolvedProfileConfig } from '@/hooks/useResolvedProfileConfig';
import { useVisibleTabs } from '@/hooks/useVisibleTabs';
import { useAdminStatus } from '@/hooks/useAdminStatus';
import {
  subscribePendingMasScreen,
  takePendingMasScreen,
} from '@/utils/masNavigation';
import { MAS_STACK_SCREENS } from '@/utils/tabNavigation';
import { useTabNavigator } from '@/hooks/useTabNavigator';
import { useToast } from '@/contexts/AppToastContext';
import { logger } from '@/utils/logger';
import PageContainer from '@/components/ui/PageContainer';
import ScreenHero from '@/components/ui/ScreenHero';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import Animated from 'react-native-reanimated';
import { useTabScroll } from '@/components/tabs/useTabScroll';
import { splitTabsForBar } from '@/constants/tabsCatalog';
import spacing from '@/constants/spacing';
import { radii } from '@/constants/uiStyles';

interface NavigationItem {
  label: string;
  subtitle: string;
  emoji: string;
  materialIcon: ComponentProps<typeof MaterialIcons>['name'];
  /** Si está definido, es un tab de overflow: la vía la resuelve `goToTab`. */
  tabName?: string;
  /** Si está definido, navega a una pantalla dentro del stack de Mas. */
  target?: keyof MasStackParamList;
  tintColor: string;
  /** Id del evento a pasar como route param cuando target === 'JubileoHome'. */
  eventId?: string;
}

const MCM_PANEL_ITEM: NavigationItem = {
  label: 'MCM Panel',
  subtitle: 'Panel de administración de la app',
  emoji: '🎛️',
  materialIcon: 'tune',
  target: 'McmPanel',
  tintColor: '#6D28D9',
};

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
  const { scrollRef, onScroll, contentPaddingBottom } = useTabScroll('mas');
  const navigation =
    useNavigation<NativeStackNavigationProp<MasStackParamList>>();
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const [feedbackVisible, setFeedbackVisible] = useState(false);
  // Grid de 2 columnas en tablet/web amplio (iPad portrait y landscape
  // incluidos). En móvil se queda en una sola columna (lista vertical).
  const layout = useResponsiveLayout();
  const useTwoColumns = layout.isWide;
  const resolved = useResolvedProfileConfig();
  const visibleTabs = useVisibleTabs();
  const { goToTab } = useTabNavigator();
  const { toast } = useToast();
  const { isAdmin } = useAdminStatus();
  const navigationItems = React.useMemo(() => {
    const items: NavigationItem[] = [];

    // La barra flotante muestra como mucho MAX_TAB_BAR_ITEMS tabs; los que no
    // caben se exponen aquí como tarjetas. Aplica a iOS y Android, que
    // comparten esa barra. En web sigue la barra clásica, que los muestra
    // todos, así que ahí no hay overflow que recoger.
    if (Platform.OS !== 'web') {
      const { overflowTabs } = splitTabsForBar(visibleTabs);
      for (const tab of overflowTabs) {
        // 'mas' nunca debería estar en overflow (splitTabsForBar lo garantiza),
        // pero filtramos defensivamente para no auto-referenciar esta pantalla.
        if (tab.name === 'mas') continue;
        items.push({
          label: tab.label,
          subtitle: tab.subtitle,
          emoji: tab.emoji,
          materialIcon: tab.androidIcon,
          tintColor: tab.tintColor,
          // Sin ruta cableada: `goToTab` decide si el tab se abre directo o por
          // su gemelo dentro de este mismo stack (Fotos, Calendario, Comunica,
          // hub de evento…). Ver `utils/tabNavigation.ts`.
          tabName: tab.name,
        });
      }
    }

    for (const id of resolved.masItems) {
      const entry = MAS_ITEM_CATALOG[id];
      if (entry) items.push(entry);
    }

    if (isAdmin) {
      items.push(MCM_PANEL_ITEM);
    }

    return items;
  }, [resolved.masItems, visibleTabs, isAdmin]);

  // Deep-link desde fuera (Home, tarjetas de overflow…): si hay una pantalla
  // pendiente, navegar a ella. Se consume al recibir el foco Y mientras se
  // tiene: si esta pantalla ya estaba enfocada (p.ej. el destino se guarda
  // desde una de sus propias tarjetas), `useFocusEffect` no volvería a
  // dispararse y el destino se quedaría colgado.
  useFocusEffect(
    useCallback(() => {
      const consume = () => {
        const pending = takePendingMasScreen();
        if (!pending) return;
        if (!MAS_STACK_SCREENS.has(pending.screen)) {
          logger.warn(
            `[MasHome] Destino pendiente desconocido: ${pending.screen}`,
          );
          return;
        }
        // navigate() overloads no aceptan tipos unión ni un screen con params
        // `undefined` + params — usamos `as any` como escape hatch idiomático.
        (navigation.navigate as any)(pending.screen, pending.params);
      };

      consume();
      return subscribePendingMasScreen(consume);
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
        <Animated.ScrollView
          ref={scrollRef}
          onScroll={onScroll}
          scrollEventThrottle={16}
          style={styles.container}
          contentContainerStyle={{ paddingBottom: contentPaddingBottom }}
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
                accessibilityRole="button"
                accessibilityLabel={item.label}
                accessibilityHint={item.subtitle}
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
                  if (item.tabName) {
                    // Overflow de tab: `goToTab` salta al tab sibling si la
                    // plataforma lo tiene registrado, o abre su gemelo dentro
                    // de este stack (que es donde acabamos ya estando).
                    if (!goToTab(item.tabName)) {
                      toast.show({
                        variant: 'warning',
                        label: 'Esa sección no está disponible ahora mismo',
                        actionLabel: 'Cerrar',
                        onActionPress: ({ hide }) => hide(),
                      });
                    }
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

          <MasFooter
            isDark={isDark}
            onFeedbackPress={() => setFeedbackVisible(true)}
          />
        </Animated.ScrollView>
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
    justifyContent: 'space-between',
  },
  card: {
    borderRadius: radii.xl,
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  cardGridItem: {
    // Dos columnas con un pequeño hueco entre ellas. Porcentaje (no `calc`)
    // para que funcione igual en nativo (iPad) y en web; el `marginBottom`
    // de `card` da el ritmo vertical.
    width: '48.5%',
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
});
