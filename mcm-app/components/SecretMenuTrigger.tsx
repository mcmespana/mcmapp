import React from 'react';
import { Pressable, StyleProp, StyleSheet, ViewStyle } from 'react-native';
import { useSecretTap } from '@/hooks/useSecretTap';
import { usePreviewChannel } from '@/contexts/PreviewChannelContext';

/**
 * Envuelve a sus hijos con un detector de "7 taps rápidos" que abre el modal
 * secreto del canal preview. Diseñado para envolver elementos puramente
 * visuales (textos del pie, número de versión…): no añade ningún estilo, no
 * intercepta ningún gesto excepto el press, y no rompe el layout del padre.
 */
export function SecretMenuTrigger({
  children,
  style,
  accessibilityLabel,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}) {
  const { openSecretMenu } = usePreviewChannel();
  const tap = useSecretTap(openSecretMenu, { tapsRequired: 7 });

  return (
    <Pressable
      onPress={tap.onPress}
      style={[styles.wrapper, style]}
      // `none` mantiene a los hijos sin acciones de accesibilidad propias;
      // exponemos un label discreto solo si el caller lo pide.
      accessibilityRole={accessibilityLabel ? 'button' : undefined}
      accessibilityLabel={accessibilityLabel}
      hitSlop={6}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    // No imponer ningún estilo: el hijo manda.
  },
});
