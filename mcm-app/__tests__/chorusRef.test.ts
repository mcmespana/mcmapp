import { chorusRefsToComments } from '@/utils/chorusRef';

describe('chorusRefsToComments', () => {
  it('un {chorus} suelto se ve como «Estribillo»', () => {
    expect(chorusRefsToComments('[C]Verso\n\n{chorus}\n')).toBe(
      '[C]Verso\n\n{comment: Estribillo}\n',
    );
  });
  it('respeta la etiqueta que traiga', () => {
    expect(chorusRefsToComments('{chorus: Estribillo final (bis)}')).toBe(
      '{comment: Estribillo final (bis)}',
    );
  });
  it('no toca {soc}/{start_of_chorus}', () => {
    const s = '{soc}\n[C]a\n{eoc}\n{start_of_chorus}\nb\n{end_of_chorus}';
    expect(chorusRefsToComments(s)).toBe(s);
  });
});
