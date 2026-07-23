import React from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useColorScheme } from '@/hooks/useColorScheme';
import { h } from '@/utils/haptics';
import GlassActionGroup from '@/components/ui/GlassActionGroup';

interface WebViewNavControlsProps {
  canGoBack: boolean;
  canGoForward: boolean;
  onBack: () => void;
  onForward: () => void;
  /** Posicionamiento absoluto lo pone la pantalla anfitriona. */
  style?: StyleProp<ViewStyle>;
}

/**
 * Cápsula glass flotante con botones atrás/adelante para WebViews a pantalla
 * completa (Comunica y similares). Reutiliza `GlassActionGroup` (el look
 * segmentado de cristal del cantoral/eventos).
 *
 * Se **auto-oculta** cuando no hay historial en ninguna dirección: en la
 * primera página no aparece nada (cero estorbo). Cada segmento se atenúa
 * cuando esa dirección no está disponible y su pulsación es un no-op.
 */
export default function WebViewNavControls({
  canGoBack,
  canGoForward,
  onBack,
  onForward,
  style,
}: WebViewNavControlsProps) {
  const isDark = useColorScheme() === 'dark';
  const fg = isDark ? '#FFFFFF' : '#1A1A1A';
  const off = isDark ? 'rgba(255,255,255,0.28)' : 'rgba(0,0,0,0.22)';

  // Nada que navegar → no renderizamos controles vacíos.
  if (!canGoBack && !canGoForward) return null;

  return (
    <GlassActionGroup
      style={style}
      height={44}
      itemWidth={50}
      items={[
        {
          key: 'back',
          accessibilityLabel: 'Atrás',
          onPress: () => {
            if (!canGoBack) return;
            h.tap();
            onBack();
          },
          children: (
            <MaterialIcons
              name="chevron-left"
              size={28}
              color={canGoBack ? fg : off}
            />
          ),
        },
        {
          key: 'forward',
          accessibilityLabel: 'Adelante',
          onPress: () => {
            if (!canGoForward) return;
            h.tap();
            onForward();
          },
          children: (
            <MaterialIcons
              name="chevron-right"
              size={28}
              color={canGoForward ? fg : off}
            />
          ),
        },
      ]}
    />
  );
}
