// utils/comunica/rollReminders.ts
//
// El recordatorio de pasar lista que coordinación manda a mano desde el
// Resumen de grupos: a quién se le puede mandar, los 100 mensajes (50 con
// guasa y 50 serios) y lo que se le dice a quien lo manda. Puro, sin React.
//
// El texto viaja tal cual al servidor (`RollReminderWrite.message`): una
// línea de 120 caracteres como mucho, sin nombres de nadie. Lo que se ve en
// la hoja es lo que llega al móvil del monitor.

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ROLL_REMINDER_MESSAGE_MAX,
  type RollReminderResult,
  type StageStrip,
} from '@/services/comunica/contract';
import { stripRowState } from './summary';

export type ReminderTone = 'funny' | 'serious';

export const REMINDER_TONE_OPTIONS: { value: ReminderTone; label: string }[] = [
  { value: 'funny', label: 'Gracioso' },
  { value: 'serious', label: 'Serio' },
];

export const REMINDER_MESSAGES: Record<ReminderTone, readonly string[]> = {
  funny: [
    'Máquina, acuérdate de pasar lista.',
    'Pasa lista para ser un titán.',
    'La lista no se pasa sola. Lo hemos comprobado.',
    'Dos toques y eres leyenda: pasa lista.',
    'Tu lista te echa de menos. Mucho.',
    'Crack, figura, fenómeno: la lista.',
    'Hay una lista por ahí preguntando por ti.',
    'Pasar lista: 30 segundos. Gloria eterna: para siempre.',
    'Se busca monitor que pase lista. Recompensa: nuestro cariño.',
    'Venga, que pasar lista cuesta menos que hacer un nudo de pañuelo.',
    'La lista está más sola que la una. Dale una alegría.',
    'Coordinación te mira con ojitos. Pasa lista, anda.',
    'Si pasas lista hoy, mañana sale el sol. Casi seguro.',
    'Alerta: lista sin pasar a la vista.',
    'Tu yo del futuro te da las gracias por pasar lista ahora.',
    'Eres el monitor que esta lista necesita.',
    'Un pequeño toque para ti, una gran lista para la humanidad.',
    'Que no te lo tengamos que decir dos veces, artista: la lista.',
    'Pasa lista y te guardamos sitio en la furgo.',
    'Pasa lista y te perdonamos lo de la guitarra desafinada.',
    'La lista lleva días esperando. Ya ni se enfada, solo suspira.',
    'Hoy es un gran día para pasar lista. Como todos, vaya.',
    'Los grandes pasan lista. Tú eres de los grandes.',
    'Tres, dos, uno… ¡lista!',
    'Pasa lista y esta noche duermes del tirón.',
    'Lista pendiente detectada. Misión: pasarla. Agente: tú.',
    'No es por meter prisa, pero la lista ya tiene telarañas.',
    'Pasa lista, que es gratis.',
    'Tú, la lista y un minuto. No hace falta más.',
    'Hay cosas imposibles. Pasar lista no es una de ellas.',
    'Pasa lista y hoy friega otro.',
    'Rumor confirmado: quien pasa lista liga más.',
    'La lista quiere verte. Dice que es urgente.',
    '¿Sabes qué te falta para ser perfecto? Exacto: la lista.',
    'Pasa lista y te contamos el final de la velada.',
    'Primer aviso. El segundo ya viene con canción.',
    'Monitor que pasa lista, monitor que se acuesta tranquilo.',
    'La lista no muerde. Entra, marca y sal.',
    'Cada vez que pasas lista, un coordinador sonríe.',
    'Anda, pasa lista, que luego se te junta con la siguiente.',
    'Lo sabemos, estabas a punto de pasarla. Pues ahora.',
    'Pasa lista y te guardamos la última croqueta.',
    'A ti, que pones a veinte chavales en fila: pon la lista al día.',
    'Notición: en la app se puede pasar lista. Y es ahora.',
    'Ni una oca ni un pañuelo: hoy el juego es pasar lista.',
    'Pasa lista como si te estuviera mirando tu madre.',
    'La lista no se va a pasar por arte de magia, Houdini.',
    'Fiera, mastodonte, jefe: esa lista.',
    'Menos mirar el móvil y más pasar lista. Ah, que es con el móvil. Pues venga.',
    'Último en pasar lista, recoge el material.',
  ],
  serious: [
    'Recuerda pasar la lista de tu grupo.',
    'Tu grupo tiene una lista pendiente. ¿La pasas cuando puedas?',
    'Queda por pasar la lista de la última sesión.',
    'Por favor, pasa la lista de tu grupo hoy.',
    'Falta la lista de tu grupo. Es un minuto.',
    'Necesitamos la lista de tu grupo para cerrar la sesión.',
    'Recordatorio: la lista de la última sesión sigue sin pasar.',
    'Cuando tengas un momento, pasa la lista pendiente.',
    'La lista de tu grupo está sin pasar. Gracias por ponerla al día.',
    '¿Puedes pasar la lista de tu grupo? Gracias.',
    'Aviso de coordinación: falta la lista de tu grupo.',
    'Para llevar bien la asistencia necesitamos tu lista.',
    'Pasa la lista de tu grupo en cuanto puedas, por favor.',
    'Tienes una lista sin pasar. Entra y márcala.',
    'Recuerda marcar quién vino a la última sesión.',
    'La asistencia de tu grupo está pendiente.',
    'Te falta pasar lista. Toca aquí para hacerlo.',
    'Hay una lista pendiente en tu grupo. Gracias por pasarla.',
    'Coordinación necesita la lista de tu grupo.',
    'Aún no tenemos la lista de tu grupo de la última sesión.',
    'Por favor, completa la lista pendiente de tu grupo.',
    'No olvides pasar lista: nos ayuda a seguir a cada chaval.',
    'Pasar lista ayuda a que nadie se nos quede atrás.',
    'Con tu lista sabemos quién falta y podemos acompañarle.',
    'Recordatorio amable: pasa la lista de tu grupo.',
    'Pon al día la lista de tu grupo cuando puedas.',
    'Falta tu lista para tener completa la asistencia de la etapa.',
    'La lista de tu grupo sigue abierta. ¿La cierras hoy?',
    'Gracias por pasar la lista de tu grupo en cuanto puedas.',
    'Tu grupo es de los que faltan por pasar lista.',
    'Queda pendiente la asistencia de tu grupo.',
    'Pasa lista hoy, por favor: mañana cuesta más acordarse.',
    'Revisa tu grupo: hay una sesión sin lista.',
    'Una sesión de tu grupo no tiene lista todavía.',
    'Te recordamos pasar la lista de la última reunión del grupo.',
    'La lista es parte del cuidado del grupo. ¿La pasas?',
    'Recuerda la lista. Gracias por tu tiempo y tu entrega.',
    'Necesitamos saber quién vino. Pasa la lista, por favor.',
    'Tu lista está pendiente. Solo lleva un momento.',
    'Antes de que acabe el día, pasa la lista de tu grupo.',
    'Faltan listas por pasar y la tuya es una de ellas.',
    'Por favor, registra la asistencia de tu grupo.',
    'Lista pendiente en tu grupo. Gracias por adelantado.',
    'Ayúdanos a cerrar la sesión: pasa tu lista.',
    'Acuérdate de la lista de tu grupo.',
    'Hay una lista esperando en tu grupo.',
    'La lista de tu grupo es importante para el seguimiento. Pásala, por favor.',
    'Recordatorio de coordinación: lista pendiente.',
    'Si ya has pasado lista con otro monitor, ignora este aviso. Si no, es el momento.',
    'Gracias por tu trabajo. Solo falta la lista de tu grupo.',
  ],
};

/** Uno al azar de ese tono, distinto del que ya se ve (si hay otro). */
export function randomReminder(
  tone: ReminderTone,
  except?: string,
  rnd: () => number = Math.random,
): string {
  const all = REMINDER_MESSAGES[tone];
  const pool = all.filter((m) => m !== except);
  const list = pool.length ? pool : all;
  return list[Math.min(list.length - 1, Math.floor(rnd() * list.length))];
}

/** Una línea, como la deja el servidor: sin saltos ni espacios dobles. */
export const cleanReminder = (v: string) => v.replace(/\s+/g, ' ').trim();

/** ¿Se puede mandar? Algo escrito y dentro del tope. */
export const reminderIsValid = (v: string) => {
  const n = cleanReminder(v).length;
  return n > 0 && n <= ROLL_REMINDER_MESSAGE_MAX;
};

type Row = StageStrip['rows'][number];

/** Solo se puede avisar a un grupo con monitores vinculados (con relación). */
export const canRemind = (row: Pick<Row, 'monitors'>) =>
  row.monitors.length > 0;

/** Los grupos a los que se puede avisar. */
export const remindableIds = (strips: readonly StageStrip[]): string[] =>
  strips.flatMap((s) => s.rows.filter(canRemind).map((r) => r.group.id));

/** Lo que sale marcado al empezar: los que tienen la última lista sin pasar. */
export const defaultReminderSelection = (
  strips: readonly StageStrip[],
): string[] =>
  strips.flatMap((s) =>
    s.rows
      .filter((r) => canRemind(r) && stripRowState(r).last === 'gap')
      .map((r) => r.group.id),
  );

export const groupsText = (n: number) => (n === 1 ? '1 grupo' : `${n} grupos`);

/** Lo que se le dice a quien lo ha mandado, y si ha ido bien. */
export function reminderResultText(r: RollReminderResult): {
  ok: boolean;
  text: string;
} {
  const waiting =
    r.recent.length === 1
      ? 'A 1 grupo ya se le avisó hace menos de 10 minutos'
      : `A ${r.recent.length} grupos ya se les avisó hace menos de 10 minutos`;
  if (r.monitors === 0) {
    return {
      ok: false,
      text: r.recent.length
        ? `${waiting}. Espera un poco.`
        : 'Esos grupos no tienen monitores vinculados.',
    };
  }
  if (r.reached === 0) {
    return {
      ok: false,
      text: 'Ninguno de esos monitores tiene la app con los avisos activados.',
    };
  }
  const sent =
    r.reached === r.monitors
      ? r.monitors === 1
        ? 'Aviso enviado a su monitor'
        : `Aviso enviado a los ${r.monitors} monitores`
      : `Aviso enviado a ${r.reached} de ${r.monitors} monitores (el resto no tiene la app con avisos)`;
  return { ok: true, text: r.recent.length ? `${sent}. ${waiting}.` : sent };
}

// ── El tono elegido, en el móvil ────────────────────────────────────────────

// Fuera del prefijo `@comunica/` (que `nativeStores.ts` muda a SQLite): es una
// preferencia del móvil, no dato del área, y se queda aunque se salga.
const TONE_KEY = '@mcm_comunica_reminder_tone';

export async function loadReminderTone(): Promise<ReminderTone> {
  try {
    return (await AsyncStorage.getItem(TONE_KEY)) === 'serious'
      ? 'serious'
      : 'funny';
  } catch {
    return 'funny';
  }
}

export async function saveReminderTone(tone: ReminderTone): Promise<void> {
  try {
    await AsyncStorage.setItem(TONE_KEY, tone);
  } catch {}
}
