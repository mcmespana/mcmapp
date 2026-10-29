// components/comunica/eventos/ShareEventButton.tsx
//
// «Compartir evento» (plan 08, F5 del plugin): un icono en la CABECERA nativa
// de la pantalla del evento (plan 07) que abre la hoja de compartir del
// sistema con el texto ya escrito (`buildEventShareMessage`). Sin enlace, no
// se pinta. Sin conexión funciona: el texto sale de lo guardado.
//
//   · iOS y Android: `Share.share({ message })`, con el enlace dentro.
//   · Web: `navigator.share` si existe; si no, se copia y «Texto copiado».
//   · Si falla: toast «No se ha podido compartir».
//
// Uso, en la pantalla del evento:
//   <Stack.Screen options={{ headerRight: () => <ShareEventButton event={e} /> }} />

import React, { useCallback, useMemo } from 'react';
import { Platform, Share, StyleSheet } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { PressableFeedback } from 'heroui-native';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { useToast } from '@/contexts/AppToastContext';
import { comunicaNow } from '@/services/comunica';
import {
  buildEventShareMessage,
  type ShareableEvent,
} from '@/utils/comunica/eventShare';
import { madridDay } from '@/utils/comunica/madrid';
import { h } from '@/utils/haptics';
import { logger } from '@/utils/logger';
import { useComunicaTheme } from '../comun/useComunicaTheme';

type WebNavigator = { share?: (d: { text: string }) => Promise<void> };

/** El mensaje y cómo compartirlo, para quien quiera otro botón. */
export function useShareEvent(event: ShareableEvent | null | undefined) {
  const { toast } = useToast();
  const message = useMemo(
    () =>
      event ? buildEventShareMessage(event, madridDay(comunicaNow())) : null,
    [event],
  );
  const share = useCallback(async () => {
    if (!message) return;
    h.tap();
    try {
      if (Platform.OS === 'web') {
        const nav = (globalThis as { navigator?: WebNavigator }).navigator;
        if (nav?.share) {
          try {
            await nav.share({ text: message });
          } catch (e) {
            // Cerrar la hoja sin elegir no es un fallo.
            if ((e as { name?: string })?.name !== 'AbortError') throw e;
          }
          return;
        }
        await Clipboard.setStringAsync(message);
        toast.show({ label: 'Texto copiado', variant: 'success' });
        return;
      }
      await Share.share({ message });
    } catch (e) {
      logger.warn('[comunica] compartir evento', e);
      toast.show({ label: 'No se ha podido compartir', variant: 'danger' });
    }
  }, [message, toast]);
  return { canShare: !!message, message, share };
}

export default function ShareEventButton({
  event,
}: {
  event: ShareableEvent | null | undefined;
}) {
  const t = useComunicaTheme();
  const { canShare, share } = useShareEvent(event);
  if (!canShare) return null;
  return (
    <PressableFeedback
      onPress={() => void share()}
      accessibilityRole="button"
      accessibilityLabel="Compartir evento"
      hitSlop={8}
      style={styles.button}
    >
      <IconSymbol
        name="square.and.arrow.up"
        size={22}
        // El color de la cabecera: el del sistema en iOS, blanco sobre la
        // barra violeta en Android y web (como «Tu cuenta» en la portada).
        color={Platform.OS === 'ios' ? t.headerTint : '#fff'}
      />
    </PressableFeedback>
  );
}

const styles = StyleSheet.create({
  // 44 pt de toque (`design.md` §1), el icono centrado.
  button: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
