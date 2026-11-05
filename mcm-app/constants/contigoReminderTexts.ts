// Textos de los recordatorios de Contigo.
//
// ESTE ES EL ÚNICO SITIO DONDE SE EDITAN. Cambiar una frase, quitarla o
// añadir otra es tocar este fichero y nada más: la pantalla de ajustes y las
// notificaciones leen de aquí. Son solo JS, así que salen por OTA.
//
//   · `title`: el título de la notificación (y el de la tarjeta de la vista
//     previa).
//   · `first`: las frases entre las que la persona elige para el primer aviso
//     del día. La primera es la que viene marcada de serie.
//   · `again`: para el 2.º y el 3.º aviso, que solo suenan si aún no ha hecho
//     el hábito. Van rotando; no se eligen.
//
// Si la persona escribe un texto propio, ese texto sustituye a todos los
// avisos de ese hábito (el primero y los de insistencia).
//
// Validados por David el 2026-11-05 en el prototipo del artefacto.

import type { ReminderHabit } from '@/utils/contigoReminders';

export interface ReminderTexts {
  title: string;
  first: readonly string[];
  again: readonly string[];
}

export const CONTIGO_REMINDER_TEXTS: Record<ReminderHabit, ReminderTexts> = {
  evangelio: {
    title: 'El evangelio de hoy 📖',
    first: [
      'Un ratito para seguir desencadenando la palabra ¿Encontrarás tus 5 minutos? ⏰',
      'Un ratito con el Evangelio antes de que el día se acabe 🔄',
      'Día a día seguir descubriendo que tiene que ver la vida de Jesús con la tuya ⏳',
      'Día a día, texto a texto, hoy la palabra también tiene algo que decir 🙂',
    ],
    again: [
      'Todavía no has leído el evangelio de hoy. Sigue ahí, sin prisa, pero oye, que no se pase 🚌',
      'Aún estás a tiempo de leer el evangelio de hoy 🤓',
      'Última llamadita: el evangelio de hoy también quiere ser leído 🙃',
      'Aún tienes 5 minutos para descubrir la palabra de hoy ⏱️',
      'CONFIRMADO: El día de hoy tiene 1.440 minutos. Aún te queda alguno para descubrir la palabra ⏳',
      'UNA HORA = 3600 segundos. Seguro que aún te queda alguno para leer la palabra de hoy ✅',
    ],
  },
  oracion: {
    title: 'Tu ratito de oración',
    first: [
      'Parar 10 minutos y conectar con Él. Es el momento 🙌',
      'Para un momento. Ahora toca otra cosa  🤫',
      'Un ratito de silencio para ti y con Él 🥳',
      '¿Una paradita? ☺️',
    ],
    again: [
      'Aún no has encontrado tu ratito de oración hoy. ¿Es el momento? 👇',
      'Un día tiene 1.440 minutos, una hora 3.600 segundos. Aún te queda un rato para parar hoy ⏳',
      'Aunque sea un minuto: ven a parar y estar con Él 🛑',
    ],
  },
  revision: {
    title: 'El paso de Dios por tu día 🔎',
    first: [
      'Para el día un momento... ¿Qué te ha hecho dar gracias hoy? 🤗',
      'Antes de acabar el día, reconocer por dónde ha pasado Dios hoy 😇',
      'Un respiro para repasar el día 😮‍💨',
      '¿Cómo ha sido el día de hoy? Anota 3 ideas para no dejarlo pasar ⚠️',
    ],
    again: [
      'Aún no has hecho la revisión de hoy. Dos minutos y a descansar ‼️',
      'No te acuestes sin dar gracias por día de hoy 🤜🤛',
      'Última llamadiiita: la revisión de hoy te espera 🫸🫷',
    ],
  },
};
