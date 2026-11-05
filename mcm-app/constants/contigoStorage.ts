// Claves de AsyncStorage de Contigo que se leen desde más de un sitio.
//
// Los hábitos los escribe `ContigoHabitsContext`; los recordatorios
// (`services/contigoReminders.ts`) los leen para saber si algo ya está hecho
// hoy sin tener que montar el provider. Una sola declaración: si cambia una,
// cambian las dos.

/** Mapa fecha → `DayRecord` con los tres hábitos del día. */
export const CONTIGO_HABITS_KEY = '@contigo_habits';

/** Configuración de los recordatorios de Contigo (`ReminderConfig`). */
export const CONTIGO_REMINDERS_KEY = '@contigo_reminders';
