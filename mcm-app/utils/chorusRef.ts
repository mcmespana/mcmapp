/**
 * `{chorus}` (ChordPro estándar: «aquí se repite el estribillo»), que el
 * cantoral usa desde octubre de 2026 en vez de escribir «ESTRIBILLO» como
 * letra. ChordSheetJS lo descarta sin pintar nada, así que se convierte en un
 * comentario: «Estribillo», o la etiqueta que traiga
 * (`{chorus: Estribillo final (bis)}`).
 */
export function chorusRefsToComments(chordPro: string): string {
  return chordPro.replace(
    /\{\s*chorus\s*(?::\s*([^}]*))?\}/gi,
    (_m, label?: string) =>
      `{comment: ${(label ?? '').trim() || 'Estribillo'}}`,
  );
}
