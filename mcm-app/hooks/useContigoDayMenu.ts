import { useCallback, useState } from 'react';
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

  return { dayMenu, handleDayPress, openDay, closeDayMenu };
}
