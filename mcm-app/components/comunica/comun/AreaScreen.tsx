// Contenedor de cada pantalla del área (plan 01 §5): scroll enganchado a la
// barra de pestañas flotante, deslizar para refrescar del sistema, ancho
// máximo en iPad y web, y hueco abajo para la barra flotante (y para la
// `BottomActionBar` si la hay).

import React, { useCallback, useState } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import PageContainer from '@/components/ui/PageContainer';
import { useTabScroll } from '@/components/tabs/useTabScroll';
import { useTabBarClearance } from '@/hooks/useTabBarClearance';
import {
  BOTTOM_ACTION_BAR_SPACE,
  BottomActionBarHeightContext,
} from './BottomActionBar';
import { useComunicaTheme } from './useComunicaTheme';

interface Props {
  children: React.ReactNode;
  /** Deslizar para refrescar. Si no se da, no hay gesto. */
  onRefresh?: () => Promise<unknown>;
  /** Lo que va fuera del scroll (la `BottomActionBar`). */
  footer?: React.ReactNode;
  /** Fondo hundido (listas agrupadas) o el normal. */
  sunken?: boolean;
}

export default function AreaScreen({
  children,
  onRefresh,
  footer,
  sunken = true,
}: Props) {
  const t = useComunicaTheme();
  // La `BottomActionBar` mide lo que ocupa (con el hueco de la barra de
  // pestañas dentro); aquí se reserva eso, y nunca menos del mínimo.
  const [footerHeight, setFooterHeight] = useState<number | null>(null);
  const tabBar = useTabBarClearance();
  const footerExtra = footer
    ? Math.max(BOTTOM_ACTION_BAR_SPACE, (footerHeight ?? 0) - tabBar)
    : 0;
  const { scrollRef, onScroll, contentPaddingBottom } = useTabScroll(
    'comunica',
    footerExtra,
  );
  const [refreshing, setRefreshing] = useState(false);
  const refresh = useCallback(async () => {
    if (!onRefresh) return;
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  }, [onRefresh]);

  return (
    <View
      style={[
        styles.root,
        { backgroundColor: sunken ? t.backgroundSunken : t.background },
      ]}
    >
      <Animated.ScrollView
        ref={scrollRef}
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ paddingBottom: contentPaddingBottom + 16 }}
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={refresh}
              tintColor={t.textSecondary}
            />
          ) : undefined
        }
      >
        <PageContainer>
          <View style={styles.content}>{children}</View>
        </PageContainer>
      </Animated.ScrollView>
      <BottomActionBarHeightContext.Provider value={setFooterHeight}>
        {footer}
      </BottomActionBarHeightContext.Provider>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 16, gap: 24 },
});
