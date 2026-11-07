// Lo que comparan los buscadores del área: sin acentos y en minúsculas
// («lucia» encuentra «Lucía»). Uno solo para todas las listas.

export const fold = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
