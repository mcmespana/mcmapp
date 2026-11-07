// utils/comunica/registrationNotes.ts
//
// Los avisos de «Inscripciones» (plan 14), con los textos del plugin (`sticpa_registration_saved_note`, `sticpa_registration_detail_html`). PURO.
// Sin «inscrito/a»: «plaza», «apuntarse»; y si es de un hijo, diciendo de cuál (FAM-a4).

export type NoteTone = 'ok' | 'info' | 'warn' | 'danger';
export interface Note {
  tone: NoteTone;
  text: string;
}

/** Lo que se dice tras apuntarse, modificar o cancelar. `child` = el nombre de pila del hijo que se ve (o `null`). */
export function savedNote(
  kind: 'signed' | 'paid' | 'saved' | 'cancelled' | 'closed' | 'payment_error',
  child: string | null,
): Note {
  switch (kind) {
    case 'signed':
      return {
        tone: 'ok',
        text: child
          ? `Listo: ${child} ya tiene su plaza.`
          : 'Listo: ya tienes tu plaza.',
      };
    case 'paid':
      return {
        tone: 'ok',
        text: child
          ? `Pago hecho. ${child} ya tiene su plaza.`
          : 'Pago hecho. Ya tienes tu plaza.',
      };
    case 'saved':
      return { tone: 'ok', text: 'Cambios guardados.' };
    case 'cancelled':
      return { tone: 'info', text: 'Inscripción cancelada.' };
    case 'closed':
      return {
        tone: 'warn',
        text: 'El plazo de inscripción ya ha terminado, así que no se ha cambiado nada. Si lo necesitas, habla con tu delegación.',
      };
    case 'payment_error':
      return {
        tone: 'warn',
        text: child
          ? `${child} tiene su plaza, pero no hemos podido dejar anotado el pago. Tu delegación lo revisará; no hace falta repetir la inscripción.`
          : 'Tienes tu plaza, pero no hemos podido dejar anotado el pago. Tu delegación lo revisará; no hace falta repetir la inscripción.',
      };
  }
}

export const SAVE_ERROR =
  'No hemos podido guardar el cambio. Inténtalo otra vez en un rato.';
export const SIGNUP_ERROR =
  'No hemos podido guardar la inscripción. Inténtalo otra vez en un rato.';

/** El aviso del estado de la inscripción: `danger` y `warn` (los demás, ninguno). */
export function statusNote(status: {
  label: string;
  tone: string;
}): Note | null {
  if (status.tone === 'danger')
    return {
      tone: 'danger',
      text: `Esta inscripción está en estado «${status.label}». Si crees que es un error, habla con tu delegación.`,
    };
  if (status.tone === 'warn')
    return {
      tone: 'warn',
      text: 'Todavía no está confirmada. Tu delegación la revisará y te avisará; no hace falta que hagas nada más.',
    };
  return null;
}

/** Los textos de la ficha de una inscripción (plan 14). */
export const REGISTRATION_TEXT = {
  titleOwn: 'Mis inscripciones',
  titleOf: (child: string) => `Inscripciones de ${child}`,
  titleOfNoName: 'Inscripciones del participante',
  intro:
    'Aquí están las actividades y eventos a los que te has apuntado. Si quieres ver a cuáles puedes apuntarte, mira la sección',
  introLink: 'Eventos',
  emptyOwn: 'Todavía no tienes ninguna inscripción',
  emptyOwnBody:
    'Cuando te apuntes a una actividad aparecerá aquí, con su estado y lo que quede por hacer.',
  emptyOf: (child: string) => `Todavía no hay inscripciones de ${child}`,
  emptyOfBody:
    'Cuando haya una, aparecerá aquí con su estado y lo que quede por hacer.',
  emptyAction: 'Ver actividades abiertas',
  others: 'Otros eventos',
  cancelTitle: '¿Cancelar tu inscripción?',
  cancelBody: 'Tu plaza quedará libre.',
  cancelKeep: 'No, mantenerla',
  cancelConfirm: 'Sí, cancelar',
} as const;
