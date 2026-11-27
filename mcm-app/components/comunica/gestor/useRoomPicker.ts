// El selector de habitación y su «Deshacer» (plan 18), para el check-in, la
// vista de habitaciones y la ficha: abre la hoja con quién se mueve, pone la
// elegida en la cola (se ve al momento, sube sola) y enseña un aviso con
// «Deshacer», que devuelve a cada uno a la suya de antes. Recuerda la última
// habitación usada en la pantalla para ponerla arriba.

import { useCallback, useState } from 'react';
import { useToast } from '@/contexts/AppToastContext';
import type { ManagedEventDetail } from '@/services/comunica/contract';
import { h } from '@/utils/haptics';
import { roomShort } from '@/utils/comunica/rooms';
import type { RoomTarget } from './RoomSheet';

/** «Lucía García → Hab. 102» o «3 personas: sin habitación». */
export const roomChangeText = (
  who: string,
  room: { code: string } | null | undefined,
) => (room ? `${who} → ${roomShort(room)}` : `${who}: sin habitación`);

export function useRoomPicker(
  detail: ManagedEventDetail | undefined,
  setRoom: (
    ids: readonly string[],
    roomId: string | null,
  ) => Promise<(() => Promise<void>) | null>,
) {
  const { toast } = useToast();
  const [target, setTarget] = useState<RoomTarget | null>(null);
  const [last, setLast] = useState<string | null>(null);

  const onPick = useCallback(
    async (t: RoomTarget, roomId: string | null) => {
      const undo = await setRoom(t.ids, roomId);
      if (!undo) return;
      h.formSuccess();
      if (roomId) setLast(roomId);
      const room = roomId
        ? detail?.rooms.find((r) => r.id === roomId)
        : undefined;
      toast.show({
        label: roomChangeText(t.title, room),
        actionLabel: 'Deshacer',
        onActionPress: ({ hide }) => {
          hide();
          h.remove();
          void undo();
        },
      });
    },
    [detail?.rooms, setRoom, toast],
  );

  return {
    open: setTarget,
    sheet: {
      target,
      last,
      onPick: (t: RoomTarget, roomId: string | null) => void onPick(t, roomId),
      onClose: () => setTarget(null),
    },
  };
}
