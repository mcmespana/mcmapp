// Estado de la pantalla de recordatorios de Contigo: la configuración guardada,
// el permiso de notificaciones y los cambios (cada uno se guarda y reprograma
// los avisos). La lógica de qué se programa está en `utils/contigoReminders.ts`.

import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import {
  loadReminderConfig,
  readNoticePermission,
  requestNoticePermission,
  saveReminderConfig,
  syncContigoReminders,
  type NoticePermission,
} from '@/services/contigoReminders';
import {
  MAX_TIMES,
  CUSTOM_TEXT_MAX,
  cleanDays,
  cleanTimes,
  defaultReminderConfig,
  type HabitReminder,
  type ReminderConfig,
  type ReminderHabit,
} from '@/utils/contigoReminders';

export function useContigoReminders() {
  const [config, setConfig] = useState<ReminderConfig>(defaultReminderConfig);
  const [loaded, setLoaded] = useState(false);
  const [permission, setPermission] =
    useState<NoticePermission>('undetermined');
  // Siempre el último valor: dos cambios seguidos parten cada uno del anterior.
  const ref = useRef(config);

  const refreshPermission = useCallback(async () => {
    setPermission(await readNoticePermission());
  }, []);

  useEffect(() => {
    let alive = true;
    loadReminderConfig().then((c) => {
      if (!alive) return;
      ref.current = c;
      setConfig(c);
      setLoaded(true);
    });
    readNoticePermission().then((p) => {
      if (alive) setPermission(p);
    });
    // Al volver de los ajustes del sistema, el permiso puede haber cambiado.
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') refreshPermission();
    });
    return () => {
      alive = false;
      sub.remove();
    };
  }, [refreshPermission]);

  const commit = useCallback((next: ReminderConfig) => {
    ref.current = next;
    setConfig(next);
    saveReminderConfig(next).then(() => syncContigoReminders());
  }, []);

  const patch = useCallback(
    (habit: ReminderHabit, change: Partial<HabitReminder>) =>
      commit({ ...ref.current, [habit]: { ...ref.current[habit], ...change } }),
    [commit],
  );

  const setEnabled = useCallback(
    async (habit: ReminderHabit, enabled: boolean) => {
      patch(habit, { enabled });
      // Al encender el primero se pide el permiso (una sola vez; si ya se
      // negó, la pantalla enseña cómo activarlo en los ajustes).
      if (enabled) {
        const current = await readNoticePermission();
        if (current === 'undetermined') {
          setPermission(await requestNoticePermission());
          syncContigoReminders();
        } else {
          setPermission(current);
        }
      }
    },
    [patch],
  );

  const setTime = useCallback(
    (habit: ReminderHabit, index: number, value: string) => {
      const times = [...ref.current[habit].times];
      times[index] = value;
      patch(habit, { times: cleanTimes(times) });
    },
    [patch],
  );

  const addTime = useCallback(
    (habit: ReminderHabit) => {
      const times = ref.current[habit].times;
      if (times.length >= MAX_TIMES) return;
      // Una hora más tarde que la última, para que no salga repetida.
      const [h, m] = times[times.length - 1].split(':').map(Number);
      const next = `${String((h + 1) % 24).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      patch(habit, { times: cleanTimes([...times, next]) });
    },
    [patch],
  );

  const removeTime = useCallback(
    (habit: ReminderHabit, index: number) => {
      const times = ref.current[habit].times.filter((_, i) => i !== index);
      if (times.length === 0) return;
      patch(habit, { times });
    },
    [patch],
  );

  const toggleDay = useCallback(
    (habit: ReminderHabit, day: number) => {
      const days = ref.current[habit].days;
      const next = days.includes(day)
        ? days.filter((d) => d !== day)
        : [...days, day];
      // Siempre al menos un día: sin ninguno, el recordatorio no serviría.
      if (next.length === 0) return;
      patch(habit, { days: cleanDays(next) });
    },
    [patch],
  );

  const setText = useCallback(
    (habit: ReminderHabit, textIndex: number, customText?: string) =>
      patch(habit, {
        textIndex,
        ...(customText !== undefined
          ? { customText: customText.slice(0, CUSTOM_TEXT_MAX) }
          : {}),
      }),
    [patch],
  );

  return {
    config,
    loaded,
    permission,
    setEnabled,
    setTime,
    addTime,
    removeTime,
    toggleDay,
    setText,
  };
}
