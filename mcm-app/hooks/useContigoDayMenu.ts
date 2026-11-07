import { useCallback, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import {
  getDayOptions,
  type DayAction,
} from '@/components/contigo/DayActionSheet';
import type { DayRecord } from '@/hooks/useContigoHabits';
import { h } from '@/utils/haptics';

/**
 * Qué pasa al pulsar un día en la racha de la semana o en el calendario del
 * mes: si sólo hay una cosa que ver (nada guardado → el evangelio de ese día)
 * se abre directamente; si hay varias, se ofrece un submenú en vez de decidir
 * por la persona.
 */
export function useContigoDayMenu() {
  const router = useRouter();
  const [dayMenu, setDayMenu] = useState<{
    date: string;
    rec: DayRecord | null;
  } | null>(null);

  const openDay = useCallback(
    (action: DayAction, date: string) => {
      setDayMenu(null);
      router.push({
        pathname: `/(tabs)/contigo/${action}` as never,
        params: { date },
      });
    },
    [router],
  );

  // Desde el submenú NO se navega al tocar: se cierra la hoja y se navega
  // cuando ya se ha desmontado (`onMenuClosed`). Empujar una pantalla con el
  // Modal de la hoja aún encima es lo que en iOS se queda a medias; es el
  // mismo patrón que la hoja de etiquetas y el menú de la playlist.
  const pendingRef = useRef<{ action: DayAction; date: string } | null>(null);
  const chooseFromMenu = useCallback((action: DayAction, date: string) => {
    pendingRef.current = { action, date };
    setDayMenu(null);
  }, []);
  const onMenuClosed = useCallback(() => {
    const pending = pendingRef.current;
    pendingRef.current = null;
    if (pending) openDay(pending.action, pending.date);
  }, [openDay]);

  const handleDayPress = useCallback(
    (date: string, rec: DayRecord | null) => {
      const options = getDayOptions(date, rec);
      if (options.length === 1) {
        openDay(options[0].key, date);
        return;
      }
      h.tap();
      setDayMenu({ date, rec });
    },
    [openDay],
  );

  const closeDayMenu = useCallback(() => setDayMenu(null), []);

  return {
    dayMenu,
    handleDayPress,
    openDay,
    chooseFromMenu,
    onMenuClosed,
    closeDayMenu,
  };
}
