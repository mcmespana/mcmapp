// Textos de Grupos y fichas que salen en más de una pantalla, tal cual los
// dice el plugin (`pages/single_stic_mis_grupos.php`).

/** l.205: explica el vacío (el genérico solo lo constata). */
export const CLOSED_SEASON =
  'Los grupos tienen gente apuntada, pero ningún participante tiene la relación vigente: es lo que pasa cuando el curso anterior se ha cerrado y el nuevo no está abierto todavía. Las relaciones llevan fecha de fin y coordinación las renueva en el CRM. No es un fallo de la aplicación.';

export const SEARCH_EMPTY = 'Nada coincide con lo que buscas.';

export const NOT_COORDINATION_ASSIGN = 'Vincularlos es cosa de coordinación.';

/** l.61: un 403 al vincular. */
export const ASSIGN_FORBIDDEN =
  'No se ha podido vincular. Si no eres de coordinación, no puedes hacerlo desde aquí.';

/** l.228-229: la explicación de «Sin grupo». */
export const LOOSE_EXPLAIN_COORDINATION =
  'Estas personas tienen relación con la delegación pero no están en ningún grupo, así que no salen en ninguna lista. Elige su grupo y quedan vinculadas.';
export const LOOSE_EXPLAIN_OTHERS =
  'Estas personas no están en ningún grupo, así que no salen en ninguna lista. Vincularlas es cosa de coordinación: avísales.';
