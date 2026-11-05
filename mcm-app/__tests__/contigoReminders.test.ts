// Recordatorios de Contigo: la lógica pura (qué se programa, con qué texto) y
// el servicio que lo vuelca a `expo-notifications`, simulado.

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import {
  CONTIGO_HABITS_KEY,
  CONTIGO_REMINDERS_KEY,
} from '@/constants/contigoStorage';
import { CONTIGO_REMINDER_TEXTS } from '@/constants/contigoReminderTexts';
import {
  ALL_DAYS,
  CUSTOM_TEXT,
  MAX_SCHEDULED,
  MAX_TIMES,
  REMINDER_HABITS,
  REMINDER_ID_PREFIX,
  REMINDER_ROUTES,
  WINDOW_DAYS,
  cleanDays,
  cleanTimes,
  daysSummary,
  defaultReminderConfig,
  isContigoReminderData,
  isoWeekday,
  normalizeReminderConfig,
  normalizeTime,
  planReminders,
  reminderMessage,
  type ReminderConfig,
} from '@/utils/contigoReminders';
import {
  cancelContigoReminders,
  syncContigoReminders,
} from '@/services/contigoReminders';

jest.mock('expo-notifications', () => ({
  scheduleNotificationAsync: jest.fn(() => Promise.resolve('id')),
  cancelScheduledNotificationAsync: jest.fn(() => Promise.resolve()),
  getAllScheduledNotificationsAsync: jest.fn(() => Promise.resolve([])),
  getPermissionsAsync: jest.fn(() => Promise.resolve({ granted: true })),
  requestPermissionsAsync: jest.fn(),
  SchedulableTriggerInputTypes: { DATE: 'date' },
}));

// Un jueves (2026-11-05), a las 10:00 hora local.
const NOW = new Date(2026, 10, 5, 10, 0, 0);

function config(patch: Partial<ReminderConfig> = {}): ReminderConfig {
  return { ...defaultReminderConfig(), ...patch };
}
const on = (times: string[], days: number[] = [...ALL_DAYS]) => ({
  enabled: true,
  times,
  days,
  textIndex: 0,
  customText: '',
});

describe('textos', () => {
  it('cada hábito tiene título, al menos un primer aviso y uno de insistencia', () => {
    for (const habit of REMINDER_HABITS) {
      const t = CONTIGO_REMINDER_TEXTS[habit];
      expect(t.title.trim()).not.toBe('');
      expect(t.first.length).toBeGreaterThan(0);
      expect(t.again.length).toBeGreaterThan(0);
      for (const s of [...t.first, ...t.again]) expect(s.trim()).not.toBe('');
    }
  });

  it('el primer aviso usa el texto elegido', () => {
    const r = { textIndex: 2, customText: '' };
    expect(reminderMessage('evangelio', r, 0).body).toBe(
      CONTIGO_REMINDER_TEXTS.evangelio.first[2],
    );
  });

  it('el 2.º y el 3.º rotan por los de insistencia a partir del elegido', () => {
    const again = CONTIGO_REMINDER_TEXTS.oracion.again;
    const r = { textIndex: 1, customText: '' };
    expect(reminderMessage('oracion', r, 1).body).toBe(again[1 % again.length]);
    expect(reminderMessage('oracion', r, 2).body).toBe(again[2 % again.length]);
    // y nunca se sale de la lista, por larga que sea la rotación
    expect(reminderMessage('oracion', r, 9).body).toBe(
      again[(1 + 9 - 1) % again.length],
    );
  });

  it('un texto propio sustituye a todos los avisos', () => {
    const r = { textIndex: CUSTOM_TEXT, customText: '  Hola, Señor  ' };
    for (const i of [0, 1, 2]) {
      expect(reminderMessage('revision', r, i).body).toBe('Hola, Señor');
    }
  });

  it('un texto propio vacío cae en el primero de la lista', () => {
    const r = { textIndex: CUSTOM_TEXT, customText: '   ' };
    expect(reminderMessage('revision', r, 0).body).toBe(
      CONTIGO_REMINDER_TEXTS.revision.first[0],
    );
  });
});

describe('normalización de lo guardado', () => {
  it('normalizeTime acepta H:MM y rechaza lo que no es una hora', () => {
    expect(normalizeTime('8:05')).toBe('08:05');
    expect(normalizeTime(' 21:30 ')).toBe('21:30');
    for (const bad of ['24:00', '12:60', 'a', '', null, 7]) {
      expect(normalizeTime(bad)).toBeNull();
    }
  });

  it('cleanTimes ordena, quita repetidas y recorta a MAX_TIMES', () => {
    expect(
      cleanTimes(['22:00', '08:00', '8:00', 'x', '13:00', '15:00']),
    ).toEqual(['08:00', '13:00', '15:00'].slice(0, MAX_TIMES));
  });

  it('cleanDays ordena y descarta lo que no es un día', () => {
    expect(cleanDays([7, 1, 1, 0, 8, 'x', 3.5, 3])).toEqual([1, 3, 7]);
  });

  it('un valor roto o ausente da la configuración de serie', () => {
    expect(normalizeReminderConfig(null)).toEqual(defaultReminderConfig());
    expect(normalizeReminderConfig('basura')).toEqual(defaultReminderConfig());
  });

  it('conserva lo válido y arregla lo inválido, hábito a hábito', () => {
    const c = normalizeReminderConfig({
      evangelio: {
        enabled: true,
        times: ['7:30'],
        days: [],
        textIndex: 99,
        customText: 'x'.repeat(500),
      },
      oracion: 'roto',
    });
    expect(c.evangelio.enabled).toBe(true);
    expect(c.evangelio.times).toEqual(['07:30']);
    expect(c.evangelio.days).toEqual([...ALL_DAYS]);
    expect(c.evangelio.textIndex).toBe(0);
    expect(c.evangelio.customText).toHaveLength(120);
    expect(c.oracion).toEqual(defaultReminderConfig().oracion);
  });

  it('un recordatorio nuevo viene apagado', () => {
    for (const h of REMINDER_HABITS) {
      expect(defaultReminderConfig()[h].enabled).toBe(false);
    }
  });
});

describe('planReminders', () => {
  it('sin nada encendido no programa nada', () => {
    expect(planReminders(defaultReminderConfig(), {}, NOW)).toEqual([]);
  });

  it('programa los próximos días y no los que ya han pasado hoy', () => {
    const plan = planReminders(
      config({ evangelio: on(['08:00', '20:00']) }),
      {},
      NOW,
    );
    // Hoy a las 08:00 ya pasó (son las 10:00); queda hoy 20:00 + 6 días × 2.
    expect(plan).toHaveLength(1 + WINDOW_DAYS * 2);
    expect(plan[0].at).toEqual(new Date(2026, 10, 5, 20, 0));
    expect(plan.every((p) => p.at.getTime() > NOW.getTime())).toBe(true);
  });

  it('respeta los días de la semana (1 = lunes … 7 = domingo)', () => {
    // 2026-11-05 es jueves (4). Solo lunes y domingo.
    const plan = planReminders(
      config({ revision: on(['21:30'], [1, 7]) }),
      {},
      NOW,
    );
    expect(
      plan.map((p) =>
        isoWeekday(
          `${p.at.getFullYear()}-${String(p.at.getMonth() + 1).padStart(2, '0')}-${String(p.at.getDate()).padStart(2, '0')}`,
        ),
      ),
    ).toEqual([7, 1]);
  });

  it('si hoy el hábito ya está hecho, hoy no quedan avisos de ese hábito', () => {
    const cfg = config({
      evangelio: on(['20:00']),
      oracion: on(['20:00']),
      revision: on(['20:00']),
    });
    const today = {
      '2026-11-05': {
        readingDone: true,
        prayerDone: false,
        revisionDone: false,
      },
    };
    const plan = planReminders(cfg, today as never, NOW);
    const todays = plan.filter((p) => p.at.getDate() === 5);
    expect(todays.map((p) => p.habit).sort()).toEqual(['oracion', 'revision']);
    // mañana sí vuelve a avisar del evangelio
    expect(
      plan.some((p) => p.habit === 'evangelio' && p.at.getDate() === 6),
    ).toBe(true);
  });

  it('cada hábito mira su propio «hecho»', () => {
    const cfg = config({ revision: on(['20:00']) });
    const records = {
      '2026-11-05': {
        readingDone: true,
        prayerDone: true,
        revisionDone: false,
      },
    };
    expect(
      planReminders(cfg, records as never, NOW).some(
        (p) => p.at.getDate() === 5,
      ),
    ).toBe(true);
    const done = { '2026-11-05': { revisionDone: true } };
    expect(
      planReminders(cfg, done as never, NOW).some((p) => p.at.getDate() === 5),
    ).toBe(false);
  });

  it('el aviso nº 2 y 3 llevan el texto de insistencia y su ruta', () => {
    const plan = planReminders(
      config({ evangelio: on(['08:00', '12:00', '20:00']) }),
      {},
      new Date(2026, 10, 5, 7, 0),
    );
    const [first, second, third] = plan.filter((p) => p.at.getDate() === 5);
    const t = CONTIGO_REMINDER_TEXTS.evangelio;
    expect(first.body).toBe(t.first[0]);
    expect(second.body).toBe(t.again[0]);
    expect(third.body).toBe(t.again[1]);
    expect(first.title).toBe(t.title);
    expect(first.data).toEqual({
      contigoReminder: true,
      habit: 'evangelio',
      internalRoute: REMINDER_ROUTES.evangelio,
    });
    expect(first.id).toBe(`${REMINDER_ID_PREFIX}evangelio-2026-11-05-0`);
  });

  it('ids únicos y plan ordenado por hora', () => {
    const plan = planReminders(
      config({
        evangelio: on(['08:00', '12:00']),
        oracion: on(['13:00']),
        revision: on(['21:30', '22:30', '23:30']),
      }),
      {},
      NOW,
    );
    expect(new Set(plan.map((p) => p.id)).size).toBe(plan.length);
    const times = plan.map((p) => p.at.getTime());
    expect(times).toEqual([...times].sort((a, b) => a - b));
  });

  it('nunca pasa del tope de notificaciones pendientes (iOS admite 64)', () => {
    const all = on(['06:00', '12:00', '20:00']);
    const plan = planReminders(
      config({ evangelio: all, oracion: all, revision: all }),
      {},
      new Date(2026, 10, 5, 5, 0),
    );
    expect(plan.length).toBeLessThanOrEqual(MAX_SCHEDULED);
    expect(MAX_SCHEDULED).toBeLessThan(64);
    // y se queda con los más próximos
    expect(plan[0].at.getDate()).toBe(5);
  });

  it('cambia bien de mes y de hora (días por delante en local)', () => {
    const plan = planReminders(
      config({ evangelio: on(['08:00']) }),
      {},
      new Date(2026, 9, 28, 9, 0), // 28 oct: la ventana cruza el cambio de hora
    );
    expect(plan).toHaveLength(WINDOW_DAYS);
    for (const p of plan) expect(p.at.getHours()).toBe(8);
  });
});

describe('isContigoReminderData', () => {
  it('solo reconoce el data de un recordatorio con destino de la lista cerrada', () => {
    expect(
      isContigoReminderData({
        contigoReminder: true,
        habit: 'oracion',
        internalRoute: REMINDER_ROUTES.oracion,
      }),
    ).toBe(true);
    expect(isContigoReminderData(null)).toBe(false);
    expect(isContigoReminderData({ internalRoute: '/notifications' })).toBe(
      false,
    );
    // un destino que no está en la lista no se obedece
    expect(
      isContigoReminderData({
        contigoReminder: true,
        internalRoute: '/(tabs)/comunica',
      }),
    ).toBe(false);
  });
});

describe('daysSummary', () => {
  it('resume los días', () => {
    expect(daysSummary([1, 2, 3, 4, 5, 6, 7])).toBe('todos los días');
    expect(daysSummary([1, 2, 3, 4, 5])).toBe('de lunes a viernes');
    expect(daysSummary([1, 3, 5])).toBe('lun, mié, vie');
  });
});

describe('syncContigoReminders', () => {
  const schedule = Notifications.scheduleNotificationAsync as jest.Mock;
  const cancel = Notifications.cancelScheduledNotificationAsync as jest.Mock;
  const all = Notifications.getAllScheduledNotificationsAsync as jest.Mock;
  const perms = Notifications.getPermissionsAsync as jest.Mock;

  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
    all.mockResolvedValue([]);
    perms.mockResolvedValue({ granted: true });
  });

  const save = (c: ReminderConfig) =>
    AsyncStorage.setItem(CONTIGO_REMINDERS_KEY, JSON.stringify(c));

  it('programa el plan en el canal propio', async () => {
    await save(config({ evangelio: on(['20:00']) }));
    await syncContigoReminders(NOW);
    expect(schedule).toHaveBeenCalledTimes(1 + WINDOW_DAYS);
    const arg = schedule.mock.calls[0][0];
    expect(arg.identifier).toBe(`${REMINDER_ID_PREFIX}evangelio-2026-11-05-0`);
    expect(arg.trigger.channelId).toBe('contigo-recordatorios');
    expect(arg.trigger.date).toEqual(new Date(2026, 10, 5, 20, 0));
    expect(arg.content.data.contigoReminder).toBe(true);
  });

  it('lee los hábitos guardados: lo hecho hoy no se vuelve a avisar', async () => {
    await save(config({ evangelio: on(['20:00']) }));
    await AsyncStorage.setItem(
      CONTIGO_HABITS_KEY,
      JSON.stringify({ '2026-11-05': { readingDone: true } }),
    );
    await syncContigoReminders(NOW);
    expect(schedule).toHaveBeenCalledTimes(WINDOW_DAYS);
  });

  it('borra solo lo suyo antes de reprogramar', async () => {
    all.mockResolvedValue([
      { identifier: `${REMINDER_ID_PREFIX}oracion-2026-11-04-0` },
      { identifier: 'comunica-outbox' },
      { identifier: 'otra-cosa' },
    ]);
    await save(config({ evangelio: on(['20:00']) }));
    await syncContigoReminders(NOW);
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(cancel).toHaveBeenCalledWith(
      `${REMINDER_ID_PREFIX}oracion-2026-11-04-0`,
    );
  });

  it('sin permiso no programa nada (pero sí limpia)', async () => {
    perms.mockResolvedValue({ granted: false, status: 'denied' });
    all.mockResolvedValue([{ identifier: `${REMINDER_ID_PREFIX}x` }]);
    await save(config({ evangelio: on(['20:00']) }));
    await syncContigoReminders(NOW);
    expect(schedule).not.toHaveBeenCalled();
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it('con todo apagado deja el móvil sin avisos de Contigo', async () => {
    all.mockResolvedValue([{ identifier: `${REMINDER_ID_PREFIX}x` }]);
    await syncContigoReminders(NOW);
    expect(schedule).not.toHaveBeenCalled();
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it('dos sincronizaciones seguidas no se pisan', async () => {
    await save(config({ evangelio: on(['20:00']) }));
    await Promise.all([syncContigoReminders(NOW), syncContigoReminders(NOW)]);
    expect(schedule).toHaveBeenCalledTimes((1 + WINDOW_DAYS) * 2);
  });

  it('un fallo al programar uno no tumba el resto', async () => {
    schedule.mockRejectedValueOnce(new Error('límite'));
    await save(config({ evangelio: on(['20:00']) }));
    await expect(syncContigoReminders(NOW)).resolves.toBeUndefined();
    expect(schedule).toHaveBeenCalledTimes(1 + WINDOW_DAYS);
  });

  it('cancelContigoReminders no revienta si el sistema falla', async () => {
    all.mockRejectedValueOnce(new Error('boom'));
    await expect(cancelContigoReminders()).resolves.toBeUndefined();
  });
});
