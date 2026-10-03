import { ChordProParser, HtmlDivFormatter } from 'chordsheetjs';
import { groupWordColumns } from '@/utils/chordSheetWords';

const render = (chordPro: string) =>
  groupWordColumns(
    new HtmlDivFormatter().format(new ChordProParser().parse(chordPro)),
  );

const text = (html: string) => html.replace(/<[^>]+>/g, '');

describe('groupWordColumns', () => {
  it('junta en una palabra las columnas que parte un acorde a media palabra', () => {
    const html = render('[C]Dios está a[G]quí, tan [Am]cierto');
    // «está a» + «quí, » forman la palabra «aquí»: van juntas.
    expect(html).toMatch(
      /<div class="word"><div class="column"><div class="chord"><\/div><div class="lyrics">está a<\/div><\/div><div class="column"><div class="chord">G<\/div><div class="lyrics">quí, <\/div><\/div><\/div>/,
    );
    // «Dios » acaba en espacio: columna suelta, sin envoltorio de una sola.
    expect(html).not.toMatch(
      /<div class="word"><div class="column"><div class="chord">C/,
    );
  });

  it('no cambia el texto que se ve', () => {
    const src =
      '[C]Dios está a[G]quí, tan [Am]cierto como el [F]aire que res[C]piro';
    const plain = new HtmlDivFormatter().format(
      new ChordProParser().parse(src),
    );
    expect(text(render(src))).toBe(text(plain));
  });

  it('agrupa una palabra con tres acordes dentro', () => {
    const html = render('ale[C]lu[G]ya[D] amén');
    expect(html.match(/<div class="word">/g)).toHaveLength(1);
    expect(html).toMatch(
      /<div class="word">(<div class="column">.*?<\/div><\/div>){3}<\/div>/,
    );
  });

  it('deja intactas las filas sin acordes', () => {
    const src = 'una línea sin acordes';
    const plain = new HtmlDivFormatter().format(
      new ChordProParser().parse(src),
    );
    expect(render(src)).toBe(plain);
  });

  it('no toca una fila con algo que no sea columna acorde+letra', () => {
    const odd =
      '<div class="row"><div class="column"><div class="chord">C</div><div class="lyrics">a</div></div><div class="comment">ojo</div></div>';
    expect(groupWordColumns(odd)).toBe(odd);
  });

  it('respeta el data-line del modo admin si ya estaba puesto', () => {
    const tagged =
      '<div class="row" data-line="3"><div class="column"><div class="chord">C</div><div class="lyrics">a</div></div></div>';
    expect(groupWordColumns(tagged)).toBe(tagged);
  });
});
