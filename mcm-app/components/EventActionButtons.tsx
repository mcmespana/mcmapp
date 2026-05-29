import React from 'react';
import { StyleSheet, View } from 'react-native';
import GlassFAB from '@/components/ui/GlassFAB';

interface Props {
  /** Abre el bottom sheet de ajustes del tab. */
  onSettings: () => void;
  /** Navega a la sección "Compartiendo" (reflexiones). */
  onCompartiendo: () => void;
  /**
   * Oculta el FAB de Compartiendo (p.ej. cuando ya estamos en esa pantalla).
   * El de Ajustes se mantiene siempre.
   */
  showCompartiendo?: boolean;
}

/**
 * Acciones de evento como FAB glass flotantes (abajo a la derecha), en lugar
 * de botones en el header. Se renderiza por encima del Stack.Navigator del
 * evento (ver `app/(tabs)/visitapapa.tsx` y `app/(tabs)/mas.tsx`).
 *
 * Layout: el FAB de Compartiendo ocupa el hueco inferior (bottom 90) y el de
 * Ajustes el superior (bottom 158) para no solaparse entre sí ni con el FAB
 * propio de la pantalla de Compartiendo.
 */
export default function EventActionButtons({
  onSettings,
  onCompartiendo,
  showCompartiendo = true,
}: Props) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {showCompartiendo && (
        <GlassFAB
          icon="forum"
          onPress={onCompartiendo}
          tintColor="#A3BD31"
          iconColor="#fff"
          style={{ bottom: 90 }}
        />
      )}
      <GlassFAB
        icon="settings"
        onPress={onSettings}
        tintColor="#5B6573"
        iconColor="#fff"
        size={22}
        style={{ bottom: 158 }}
      />
    </View>
  );
}
