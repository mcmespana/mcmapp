/**
 * Estilos y maquetación de la hoja de una canción (HTML de `utils/songSheet.ts`).
 *
 * El CSS solo no basta para partir bien una línea que no cabe: el navegador
 * parte donde se acaba el hueco, y en una canción el sitio bueno es otro —
 * tras un punto o una coma, antes de una «y» o un «que», nunca detrás de un
 * artículo («la / felicidad»). `SHEET_LAYOUT_JS` corre dentro del WebView,
 * mide cada palabra y elige los cortes:
 *
 *  1. El menor número de renglones posible (que la canción ocupe poco).
 *  2. Entre los repartos con ese número de renglones, el que corta por frase
 *     y deja los trozos equilibrados (sin una palabra huérfana abajo).
 *
 * Si el script no corre (web a pantalla completa, que mete el HTML con
 * `innerHTML`), la línea se parte sola con `flex-wrap` por palabras enteras:
 * peor sitio, pero nunca a media palabra.
 *
 * En pantallas anchas (iPad), si la canción entera cabe a dos o tres columnas
 * sin hacer scroll, se reparte en columnas. Si no cabe, se queda en una:
 * columnas con scroll obligan a subir y bajar, que es justo lo que no se
 * puede hacer con las manos en la guitarra.
 *
 * El script está escrito en ES5 dentro de un string a propósito: Hermes no
 * guarda el código fuente de las funciones, así que no se puede generar con
 * `fn.toString()`. Los tests lo evalúan tal cual (`__tests__/songSheetLayout`).
 */
import { SongSheetColors } from '@/constants/colors';

const L = SongSheetColors.light;
const D = SongSheetColors.dark;

export const SHEET_CSS = `
  body {
    --sh-text: ${L.text}; --sh-title: ${L.title}; --sh-chord: ${L.chord};
    --sh-muted: ${L.muted}; --sh-label: ${L.label};
    --sh-chorus-bar: ${L.chorusBar}; --sh-chorus-bg: ${L.chorusBg};
    --sh-filler: ${L.filler};
  }
  body.theme-dark {
    --sh-text: ${D.text}; --sh-title: ${D.title}; --sh-chord: ${D.chord};
    --sh-muted: ${D.muted}; --sh-label: ${D.label};
    --sh-chorus-bar: ${D.chorusBar}; --sh-chorus-bg: ${D.chorusBg};
    --sh-filler: ${D.filler};
  }
  .sheet {
    font-size: var(--song-font-size);
    color: var(--sh-text);
    margin-top: 0.4em;
    column-gap: 2.2em;
    column-rule: 1px solid var(--sh-filler);
  }
  .sec { margin: 0 0 0.9em; break-inside: avoid; position: relative; }
  .ln {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    margin: 0 0 0.14em;
  }
  .w {
    display: inline-flex;
    align-items: flex-end;
    flex-shrink: 0;
    max-width: 100%;
  }
  .s { display: inline-flex; flex-direction: column; min-width: 0; }
  .c {
    color: var(--sh-chord);
    font-weight: 700;
    font-size: 0.92em;
    line-height: 1.2;
    white-space: pre;
    /* Hueco tras el acorde: «SOL7» sobre «a» no se pega al siguiente. */
    padding-right: 0.4em;
  }
  .t { display: flex; line-height: 1.34; min-height: 1.34em; white-space: pre; }
  /* Con el script en marcha (\`ov\`), el acorde no ocupa ancho: vuela sobre
     la letra y el script separa los que chocarían. */
  body.ov .ln.ly .c { width: 0; padding-right: 0; overflow: visible; }
  /* Un acorde más ancho que su sílaba a media palabra («acérca[SOL]te[SOL7].»)
     abre un hueco en la palabra: una raya tenue lo une, así se lee «te──.»
     como una sola palabra. Sin hueco, la raya mide cero. */
  .s.m > .t::after {
    content: '';
    flex: 1 1 0;
    min-width: 0;
    align-self: stretch;
    /* Sin márgenes: un margen ocuparía sitio aunque la raya mida cero. */
    background: linear-gradient(var(--sh-filler), var(--sh-filler))
      center 64% / calc(100% - 0.3em) 1.5px no-repeat;
  }
  .br { flex-basis: 100%; height: 0; }
  .w.cont { margin-left: var(--sh-cont-indent, 0.9em); }
  .vn {
    align-self: flex-end;
    color: var(--sh-label);
    font-weight: 700;
    font-size: 0.78em;
    line-height: 1.7;
    min-width: 1.1em;
    margin-right: 0.35em;
  }
  .w.bis .t { color: var(--sh-muted); font-style: italic; }
  .ln.co { gap: 0.15em 1em; margin-bottom: 0.3em; }
  .ln.co .c { padding-right: 0; }
  .cn { color: var(--sh-muted); font-style: italic; line-height: 1.2; }
  .cm {
    color: var(--sh-muted);
    font-style: italic;
    font-size: 0.86em;
    white-space: pre-wrap;
    overflow-wrap: break-word;
    margin: 0.2em 0 0.3em;
  }
  .lbl {
    color: var(--sh-label);
    font-size: 0.6em;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    line-height: 1.4;
    margin: 0 0 0.35em;
  }
  /* Estribillo: raya a la izquierda (en el margen, así la letra no se mueve
     de sitio) y un fondo que apenas se nota. */
  .sec.chorus {
    border-left: 3px solid var(--sh-chorus-bar);
    background: var(--sh-chorus-bg);
    padding: 0.35em 0.5em 0.3em 10px;
    margin-left: -13px;
    border-radius: 0 10px 10px 0;
  }
  .sec.bridge { border-left: 3px dashed var(--sh-chorus-bar); padding-left: 10px; margin-left: -13px; }
  /* Vista completa / compacta: la repetición sale dos veces en el HTML y la
     clase del body decide cuál se ve (cambiar no recarga nada). */
  body:not(.compact) .rep-fold { display: none; }
  body.compact .rep-full { display: none; }
  details.rep-fold { padding-top: 0.25em; padding-bottom: 0.25em; }
  details.rep-fold > summary {
    list-style: none;
    display: flex;
    align-items: baseline;
    gap: 0.6em;
    cursor: pointer;
    min-height: 1.6em;
    -webkit-tap-highlight-color: transparent;
  }
  details.rep-fold > summary::-webkit-details-marker { display: none; }
  details.rep-fold > summary .lbl { margin: 0; font-size: 0.68em; white-space: nowrap; }
  details.rep-fold .x { opacity: 0.75; font-weight: 600; letter-spacing: 0.02em; text-transform: none; }
  details.rep-fold .pv {
    flex: 1;
    min-width: 0;
    color: var(--sh-muted);
    font-size: 0.82em;
    font-style: italic;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  details.rep-fold[open] > summary { margin-bottom: 0.35em; }
  details.rep-fold[open] .pv { display: none; }
  /* Sin acordes: fuera los acordes, las líneas de solo acordes y las
     intros instrumentales enteras. */
  body.chords-hidden .c,
  body.chords-hidden .ln.co,
  body.chords-hidden .sec.instrumental { display: none !important; }
  body.chords-hidden .s.m > .t::after { display: none; }
  body.nums-hidden .vn { display: none; }
  body.chords-hidden .xc { display: none; }
  /* Columnas (iPad, solo si la canción cabe entera sin scroll). */
  body.cols { padding-left: 28px; padding-right: 28px; }
  body.cols .sheet .sec.chorus { margin-left: 0; }
`;

/**
 * Maquetación en el WebView. Expone `window.__SONG_LAYOUT__`:
 *  - `refit()`: recoloca todo (columnas + cortes). Lo llama el puente de
 *    estilos tras cambiar letra, tamaño, acordes o vista.
 *  - `chooseBreaks`, `penalty`: el algoritmo, para los tests.
 */
export const SHEET_LAYOUT_JS = `
(function () {
  var STRONG = 0, COMMA = 2, CONJ = 3, PREP = 5, PLAIN = 8, WEAK = 18;
  var CONJ_RE = /^(y|e|o|u|ni|que|pero|porque|pues|como|cuando|donde|mientras|aunque|sino|si)$/;
  var PREP_RE = /^(a|al|ante|bajo|con|contra|de|del|desde|en|entre|hacia|hasta|para|por|seg\\u00fan|sin|sobre|tras)$/;
  // Detrás de estas no se corta: artículos, posesivos, clíticos,
  // preposiciones y nexos se quedan con la palabra que les sigue.
  var WEAK_RE = /^(el|la|los|las|lo|un|una|unos|unas|mi|mis|tu|tus|su|sus|nuestro|nuestra|nuestros|nuestras|vuestro|vuestra|me|te|se|nos|os|le|les|y|e|o|u|ni|que|a|al|de|del|en|con|por|para|sin|sobre|tras|desde|hasta|muy|tan|m\\u00e1s|no|ya)$/;

  function bare(t) {
    return t.toLowerCase().replace(/[^a-z\\u00e1\\u00e9\\u00ed\\u00f3\\u00fa\\u00fc\\u00f1]/g, '');
  }

  /** Coste de partir ENTRE la palabra prev y la palabra next. */
  function penalty(prev, next, nextHasChord) {
    var p = prev.replace(/\\s+$/, '');
    var bonus = nextHasChord ? -1 : 0;
    if (/[.;:!?\\u2026]['"\\u00bb\\u201d)\\]]*$/.test(p)) return STRONG + bonus;
    if (/[,\\u2014\\u2013-]['"\\u00bb\\u201d)\\]]*$/.test(p)) return COMMA + bonus;
    if (WEAK_RE.test(bare(p))) return WEAK;
    var n = bare(next);
    if (CONJ_RE.test(n)) return CONJ + bonus;
    if (PREP_RE.test(n)) return PREP + bonus;
    return PLAIN + bonus;
  }

  /**
   * Cortes óptimos. w: anchos de las palabras; pen[i]: coste de cortar tras
   * la palabra i; first/rest: ancho disponible del primer renglón y de los
   * siguientes (que llevan sangría); ov[i] (opcional): lo que un acorde
   * sobresale por la derecha si el renglón acaba en la palabra i. Devuelve
   * los índices de las palabras que empiezan renglón nuevo.
   */
  function chooseBreaks(w, pen, first, rest, ov) {
    var n = w.length, INF = 1e15, cost = [0], from = [0], i, j;
    for (j = 1; j <= n; j++) { cost[j] = INF; from[j] = 0; }
    for (i = 0; i < n; i++) {
      if (cost[i] >= INF) continue;
      var lim = i === 0 ? first : rest, sum = 0;
      for (j = i + 1; j <= n; j++) {
        sum += w[j - 1];
        if (sum > lim && j > i + 1) break;
        var width = sum + (ov ? ov[j - 1] : 0);
        if (width > lim && j > i + 1) continue;
        var last = j === n;
        var slack = Math.max(0, lim - width) / lim;
        var c = cost[i] + 1000 + slack * slack * (last ? 15 : 30) +
          (last ? 0 : pen[j - 1]) + (j - i === 1 && n > 2 ? 6 : 0);
        if (c < cost[j]) { cost[j] = c; from[j] = i; }
      }
    }
    var out = [], k = n;
    while (k > 0) { var s = from[k]; if (s > 0) out.unshift(s); k = s; }
    return out;
  }

  function atomsOf(line) {
    var out = [], ch = line.children;
    for (var i = 0; i < ch.length; i++) if (ch[i].classList.contains('w')) out.push(ch[i]);
    return out;
  }
  function textOf(atom) {
    var ts = atom.querySelectorAll('.t'), s = '';
    for (var i = 0; i < ts.length; i++) s += ts[i].textContent;
    return s;
  }
  function chordsShown() { return !document.body.classList.contains('chords-hidden'); }

  function chordWidth(c) {
    var r = document.createRange();
    r.selectNodeContents(c);
    return r.getBoundingClientRect().width;
  }

  /**
   * Acordes que «vuelan»: un acorde ocupa su sitio encima de la letra, no al
   * lado, así que «SOL» sobre «a quien» no abre un hueco en «a». Solo cuando
   * dos acordes chocarían se ensancha la letra que hay entre ellos (y si es a
   * media palabra, una raya tenue la une). Calcula, por línea, cuánto
   * ensanchar cada trozo y cuánto sobresale el último acorde de cada palabra.
   * «breaks» (opcional): índices de palabra que empiezan renglón; dos acordes
   * en renglones distintos no chocan.
   */
  function chordPlan(atoms, gap, breaks) {
    var segs = [], segAtom = [], i, j;
    for (i = 0; i < atoms.length; i++) {
      var ss = atoms[i].querySelectorAll('.s');
      for (j = 0; j < ss.length; j++) { segs.push(ss[j]); segAtom.push(i); }
    }
    var tw = [], cw = [];
    for (i = 0; i < segs.length; i++) {
      tw.push(segs[i].querySelector('.t').getBoundingClientRect().width);
      var c = segs[i].querySelector('.c');
      cw.push(c ? chordWidth(c) : -1);
    }
    var startsRow = {};
    if (breaks) for (i = 0; i < breaks.length; i++) startsRow[breaks[i]] = true;
    var pad = [], last = -1, dist = 0;
    for (i = 0; i < segs.length; i++) {
      pad.push(0);
      var newRow = i > 0 && segAtom[i] !== segAtom[i - 1] && startsRow[segAtom[i]];
      if (newRow) { last = -1; dist = 0; }
      if (cw[i] >= 0) {
        if (last >= 0) {
          var need = cw[last] + gap - dist;
          if (need > 0.5) { pad[i - 1] += need; }
        }
        last = i; dist = 0;
      }
      dist += tw[i] + pad[i];
    }
    // Cuánto sobresale el acorde más a la derecha si el renglón acaba en
    // cada palabra (posiciones relativas: el número de estrofa delante no
    // cambia la diferencia).
    var ov = [], pos = 0, reach = 0;
    for (i = 0; i < segs.length; i++) {
      if (i > 0 && segAtom[i] !== segAtom[i - 1] && startsRow[segAtom[i]]) { pos = 0; reach = 0; }
      if (cw[i] >= 0) reach = Math.max(reach, pos + cw[i]);
      pos += tw[i] + pad[i];
      var endOfAtom = i === segs.length - 1 || segAtom[i + 1] !== segAtom[i];
      if (endOfAtom) ov[segAtom[i]] = Math.max(0, reach - pos);
    }
    return { segs: segs, tw: tw, pad: pad, ov: ov };
  }

  function applyPads(plan) {
    for (var i = 0; i < plan.segs.length; i++) {
      plan.segs[i].style.minWidth = plan.pad[i] > 0 ? (plan.tw[i] + plan.pad[i]) + 'px' : '';
    }
  }

  function relayout(root) {
    root = root || document;
    var lines = root.querySelectorAll('.ln.ly'), i, j;
    var body = document.body;
    var showChords = chordsShown();
    // Acordes volando solo con este script en marcha: sin él, cada acorde
    // ocupa su ancho y nunca se pisan.
    body.classList.toggle('ov', showChords);
    // 1) Quitar lo de la pasada anterior (solo escrituras).
    for (i = 0; i < lines.length; i++) {
      var brs = lines[i].querySelectorAll('.br');
      for (j = 0; j < brs.length; j++) brs[j].parentNode.removeChild(brs[j]);
      var cs = lines[i].querySelectorAll('.w.cont');
      for (j = 0; j < cs.length; j++) cs[j].classList.remove('cont');
      var ps = lines[i].querySelectorAll('.s');
      for (j = 0; j < ps.length; j++) ps[j].style.minWidth = '';
    }
    var probe = document.querySelector('.sheet');
    if (!probe) return;
    var fs = parseFloat(getComputedStyle(probe).fontSize) || 16;
    var indent = fs * 0.9, gap = fs * 0.4;
    // 2) Huecos entre acordes que chocarían, con la línea entera seguida.
    var items = [];
    for (i = 0; i < lines.length; i++) {
      var line = lines[i];
      if (!line.clientWidth) continue;
      var atoms = atomsOf(line);
      items.push({ line: line, atoms: atoms, plan: showChords ? chordPlan(atoms, gap) : null });
    }
    for (i = 0; i < items.length; i++) if (items[i].plan) applyPads(items[i].plan);
    // 3) Medir palabras y elegir cortes.
    for (i = 0; i < items.length; i++) {
      var it = items[i], avail = it.line.clientWidth, widths = [], total = 0;
      for (j = 0; j < it.atoms.length; j++) {
        var wd = it.atoms[j].getBoundingClientRect().width;
        widths.push(wd); total += wd;
      }
      var ov = it.plan ? it.plan.ov : null;
      var tail = ov && ov.length ? ov[ov.length - 1] : 0;
      // El espacio final de cada palabra va dentro de su caja: también
      // cuenta para el salto, así que no hay tolerancia que valga.
      if (total + tail <= avail + 0.5 || it.atoms.length < 2) { it.breaks = null; continue; }
      var pens = [];
      for (j = 0; j < it.atoms.length - 1; j++) {
        var nextChord = showChords && !!it.atoms[j + 1].querySelector('.c');
        pens.push(penalty(textOf(it.atoms[j]), textOf(it.atoms[j + 1]), nextChord));
      }
      it.breaks = chooseBreaks(widths, pens, avail + 0.5, avail - indent + 0.5, ov);
    }
    // 4) Cortes, y huecos recalculados por renglón: dos acordes que han
    //    quedado en renglones distintos ya no necesitan separarse.
    for (i = 0; i < items.length; i++) {
      var t = items[i];
      if (!t.breaks || !t.breaks.length) continue;
      for (j = 0; j < t.breaks.length; j++) {
        var a = t.atoms[t.breaks[j]], el = document.createElement('span');
        el.className = 'br';
        a.parentNode.insertBefore(el, a);
        a.classList.add('cont');
      }
      if (t.plan) {
        var ps2 = t.plan.segs;
        for (j = 0; j < ps2.length; j++) ps2[j].style.minWidth = '';
        t.plan2 = chordPlan(t.atoms, gap, t.breaks);
      }
    }
    for (i = 0; i < items.length; i++) if (items[i].plan2) applyPads(items[i].plan2);
  }

  function fits() {
    // En iOS el detalle desplaza la letra con un contentInset nativo (bajo
    // el header transparente) que el documento no ve: SongDisplay lo deja
    // en __SONG_VIEW_INSET__ para restarlo aquí.
    var inset = window.__SONG_VIEW_INSET__ || 0;
    return document.documentElement.scrollHeight + inset <= window.innerHeight + 1;
  }

  /**
   * Columnas en pantallas anchas (iPad), solo si así la canción cabe ENTERA
   * en la pantalla. Para conseguirlo puede achicar la letra hasta un 20 %;
   * si ni así cabe, una sola columna y al tamaño elegido. En un móvil nunca
   * caben dos columnas, así que allí esto no hace nada.
   */
  var SCALES = [1, 0.92, 0.86, 0.8];
  function refit() {
    var sheet = document.querySelector('.sheet');
    if (!sheet) return;
    var body = document.body;
    body.classList.remove('cols');
    sheet.style.columnCount = '';
    sheet.style.fontSize = '';
    relayout();
    if (fits()) return;
    var base = parseFloat(getComputedStyle(sheet).fontSize) || 16;
    // En un móvil no caben dos columnas ni con la letra más pequeña: fuera
    // antes de tocar nada (cada intento es otra maquetación entera).
    var small = base * SCALES[SCALES.length - 1];
    if (window.innerWidth - 56 < 2 * small * 19 + small * 2.2) return;
    // Con columnas el texto usa todo el ancho de la pantalla (sin el margen
    // que lo centra a 760 px): se mide ya con ese ancho.
    body.classList.add('cols');
    var width = sheet.clientWidth;
    for (var si = 0; si < SCALES.length; si++) {
      var fs = base * SCALES[si], gap = fs * 2.2;
      var maxCols = Math.min(3, Math.floor((width + gap) / (fs * 19 + gap)));
      if (maxCols < 2) continue;
      sheet.style.fontSize = SCALES[si] === 1 ? '' : fs + 'px';
      for (var k = 2; k <= maxCols; k++) {
        sheet.style.columnCount = String(k);
        relayout();
        if (fits()) return;
      }
    }
    body.classList.remove('cols');
    sheet.style.columnCount = '';
    sheet.style.fontSize = '';
    relayout();
  }

  var pending = false;
  function schedule() {
    if (pending) return;
    pending = true;
    (window.requestAnimationFrame || setTimeout)(function () {
      pending = false;
      try { refit(); } catch (e) {}
    });
  }

  window.__SONG_LAYOUT__ = {
    refit: schedule,
    relayout: relayout,
    chooseBreaks: chooseBreaks,
    penalty: penalty
  };

  if (typeof document === 'undefined' || !document.addEventListener) return;
  window.addEventListener('resize', schedule);
  // Al desplegar un estribillo plegado, sus líneas se miden por primera vez.
  document.addEventListener('toggle', function (e) {
    if (e.target && e.target.tagName === 'DETAILS') {
      try { relayout(e.target); } catch (err) {}
    }
  }, true);
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', schedule);
  } else {
    schedule();
  }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(schedule);
})();
`;
