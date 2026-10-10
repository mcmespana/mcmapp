/**
 * Estilos y maquetación de la hoja de una canción (HTML de `utils/songSheet.ts`).
 *
 * El CSS solo no basta para partir bien una línea que no cabe: el navegador
 * parte donde se acaba el hueco, y en una canción el sitio bueno es otro —
 * tras un punto o una coma, antes de una «y» o un «que», nunca detrás de un
 * artículo («la / felicidad»). `SHEET_LAYOUT_JS` corre dentro del WebView,
 * mide cada palabra y elige los cortes:
 *
 *  1. Pocos renglones (que la canción ocupe poco)…
 *  2. …cortando por frase y con trozos equilibrados (sin una palabra
 *     huérfana abajo). Solo se gasta un renglón más para no dejar un «de» o
 *     un «la» colgando al final.
 *
 * Si el script no corre (web a pantalla completa, que mete el HTML con
 * `innerHTML`), la línea se parte sola con `flex-wrap` por palabras enteras:
 * peor sitio, pero nunca a media palabra.
 *
 * En pantallas anchas (iPad), si la canción entera cabe a dos o tres columnas
 * sin hacer scroll, se reparte en columnas y los estribillos repetidos se
 * pliegan solos. Si no cabe, se queda en una (columnas con scroll obligan a
 * subir y bajar, justo lo que no se puede hacer con las manos en la
 * guitarra) y, si girando la pantalla cabría, lo avisa.
 *
 * Modo atril (`paged`, pantalla completa): páginas en vez de scroll, que se
 * pasan con un toque en el borde, deslizando o con un pedal Bluetooth.
 *
 * El script está escrito en ES5 dentro de un string a propósito: Hermes no
 * guarda el código fuente de las funciones, así que no se puede generar con
 * `fn.toString()`. Los tests lo evalúan tal cual (`__tests__/songSheetLayout`).
 */
import { SongSheetColors } from '@/constants/colors';

/** Variantes del estribillo. La primera es la de serie. */
export const CHORUS_STYLES = [
  { id: 'negrita', name: 'Negrita' },
  { id: 'raya', name: 'Raya' },
  { id: 'mayus', name: 'MAYÚS' },
  { id: 'clasico', name: 'Clásico' },
  { id: 'sangrado', name: 'Sangrado' },
] as const;
export type ChorusStyle = (typeof CHORUS_STYLES)[number]['id'];

/** Clases del `<body>` para una variante (las aplica el puente de estilos). */
export const CHORUS_STYLE_CLASSES = CHORUS_STYLES.map((c) => `ch-${c.id}`);

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
    /* Ritmo vertical: el hueco dice qué separa a dos cosas.
       - Un renglón que continúa la misma línea del .cho: pegado (0).
       - Otra línea del .cho: --gap-line.
       - Una línea en blanco: --gap-sec.
       - Dos o más líneas en blanco, o entrar/salir de un estribillo:
         --gap-big (no el doble, pero se nota). */
    --gap-line: 0.34em;
    --gap-sec: 0.95em;
    --gap-big: 1.45em;
  }
  /* «Más aire»: lo mismo, más abierto. */
  body.airy .sheet { --gap-line: 0.5em; --gap-sec: 1.4em; --gap-big: 2.05em; }
  .sec { margin: 0; break-inside: avoid; position: relative; }
  .sec + .sec { margin-top: var(--gap-sec); }
  .sec.gap2,
  .sec.chorus, .sec.chorus + .sec,
  .sec.bridge, .sec.bridge + .sec { margin-top: var(--gap-big); }
  /* Un estribillo plegado es una sola línea: hueco normal, no de bloque. */
  body.compact .sec.rep:not(.gap2), body.compact .sec.rep + .sec:not(.gap2),
  body.auto-compact .sec.rep:not(.gap2), body.auto-compact .sec.rep + .sec:not(.gap2) {
    margin-top: var(--gap-sec);
  }
  .sheet > .sec:first-child { margin-top: 0; }
  .sec > * + *, .rep-one > * + *, .rep-fold > * + * { margin-top: var(--gap-line); }
  .sec > .lbl + *, .rep-one > .lbl + * { margin-top: 0.2em; }
  .rep-one + .rep-one { margin-top: var(--gap-big); }
  .ln {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
  }
  /* En columnas y en páginas, una sección larga puede partirse entre dos
     columnas, pero nunca una línea por dentro (se separaba el «la» de «la
     comunidad alienta»), ni una etiqueta o un arreglo de lo que anuncian. */
  .ln, .cm, .arrangement, .lbl, summary { break-inside: avoid; }
  .lbl, .arrangement { break-after: avoid; }
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
  .ln.co { gap: 0.15em 1em; }
  .ln.co .c { padding-right: 0; }
  .cn { color: var(--sh-muted); font-style: italic; line-height: 1.2; }
  .cm {
    color: var(--sh-muted);
    font-style: italic;
    font-size: 0.86em;
    white-space: pre-wrap;
    overflow-wrap: break-word;
    margin: 0;
  }
  .sec > .arrangement, .rep-one > .arrangement { margin-top: 0; margin-bottom: 0; }
  .sec > * + .arrangement, .rep-one > * + .arrangement { margin-top: var(--gap-line); }
  .sec.rep > .rep-fold { margin-top: 0; }
  .lbl {
    color: var(--sh-label);
    font-size: 0.6em;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    line-height: 1.4;
    margin: 0;
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
  /* Variantes del estribillo («Letra y vista» → Estribillo). La de serie
     es la raya; las demás suman negrita, mayúsculas o vuelven al estilo de
     cantoral de papel (sin raya, o sangrado). */
  body.ch-negrita .sec.chorus .t,
  body.ch-mayus .sec.chorus .t,
  body.ch-clasico .sec.chorus .t,
  body.ch-sangrado .sec.chorus .t { font-weight: 700; }
  body.ch-mayus .sec.chorus .t,
  body.ch-clasico .sec.chorus .t { text-transform: uppercase; }
  body.ch-clasico .sec.chorus,
  body.ch-sangrado .sec.chorus {
    border-left: 0;
    background: none;
    padding: 0;
    margin-left: 0;
    border-radius: 0;
  }
  body.ch-sangrado .sec.chorus { padding-left: 1.3em; }
  body.ch-nolabel .sec.chorus > .lbl,
  body.ch-nolabel .sec.chorus .rep-one > .lbl { display: none; }
  /* Vista completa / compacta: la repetición sale dos veces en el HTML y la
     clase del body decide cuál se ve (cambiar no recarga nada). En iPad, si
     la canción cabe entera a columnas, se pliega sola (\`auto-compact\`):
     el estribillo ya está a la vista. */
  body:not(.compact):not(.auto-compact) .rep-fold { display: none; }
  body.compact .rep-full, body.auto-compact .rep-full { display: none; }
  details.rep-fold { padding-top: 0.1em; padding-bottom: 0.1em; }
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
  /* Modo atril (pantalla completa en páginas). */
  html:has(body.paged), body.paged { overflow: hidden; }
  body.paged .pager { overflow: hidden; }
  body.paged .sheet {
    column-fill: auto;
    column-rule: none;
    margin-top: 0;
    transition: transform 0.28s ease;
  }
  @media (prefers-reduced-motion: reduce) {
    body.paged .sheet { transition: none; }
  }
  body.paged .sheet .sec.chorus { margin-left: 0; }
  .pages-ind {
    position: fixed;
    left: 50%;
    bottom: calc(var(--song-pad-bottom) * 0.35);
    transform: translateX(-50%);
    padding: 0.2em 0.8em;
    border-radius: 999px;
    background: var(--sh-chorus-bg);
    color: var(--sh-label);
    font-weight: 700;
    font-size: 0.8em;
    font-variant-numeric: tabular-nums;
    pointer-events: none;
  }
  .rot-hint {
    margin: 0.2em 0 0.6em;
    color: var(--sh-label);
    font-size: 0.8em;
    font-weight: 600;
  }
  /* Columnas (iPad, solo si la canción cabe entera sin scroll). */
  body.cols { padding-left: 28px; padding-right: 28px; }
  @media (min-width: 720px) {
    body.paged { padding-left: 28px; padding-right: 28px; }
  }
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
  // ROW: lo que cuesta un renglón más. Un corte detrás de un artículo o
  // una preposición (WEAK) cuesta más que un renglón: antes «Hay muchas
  // formas / de orar,» que «Hay muchas formas de / orar,».
  var STRONG = 0, COMMA = 2, CONJ = 3, PREP = 5, PLAIN = 8, WEAK = 40, ROW = 24;
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
        var c = cost[i] + ROW + slack * slack * (last ? 12 : 20) +
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

  function fitsWithin(limitH) {
    // En iOS el detalle desplaza la letra con un contentInset nativo (bajo
    // el header transparente) que el documento no ve: SongDisplay lo deja
    // en __SONG_VIEW_INSET__ para restarlo aquí.
    var inset = window.__SONG_VIEW_INSET__ || 0;
    return contentHeight() + inset <= limitH + 1;
  }

  /**
   * Alto de lo que hay que ver (cabecera + hoja + margen de abajo). No vale
   * el scrollHeight del documento: nunca baja del alto de la pantalla, y al
   * simular la otra orientación hay que medir contra un alto menor.
   */
  function contentHeight() {
    var wrap = pager() || document.querySelector('.sheet');
    if (!wrap) return document.documentElement.scrollHeight;
    var pad = parseFloat(getComputedStyle(document.body).paddingBottom) || 0;
    return wrap.getBoundingClientRect().bottom + (window.scrollY || 0) + pad;
  }

  /**
   * Columnas en pantallas anchas (iPad), solo si así la canción cabe ENTERA
   * en la pantalla. Para conseguirlo puede achicar la letra hasta un 20 %;
   * si ni así cabe, una sola columna y al tamaño elegido. Con columnas, los
   * estribillos repetidos se pliegan solos (\`auto-compact\`): el estribillo
   * ya está a la vista en otra columna. En un móvil nunca caben dos
   * columnas, así que allí esto no hace nada.
   */
  var SCALES = [1, 0.92, 0.86, 0.8];
  function resetColumns(sheet) {
    document.body.classList.remove('cols');
    document.body.classList.remove('auto-compact');
    sheet.style.columnCount = '';
    sheet.style.fontSize = '';
  }
  function tryColumns(sheet, limitH, viewW) {
    var body = document.body;
    var base = parseFloat(getComputedStyle(sheet).fontSize) || 16;
    // Fuera antes de tocar nada si no caben dos columnas ni con la letra más
    // pequeña: cada intento es otra maquetación entera.
    var small = base * SCALES[SCALES.length - 1];
    if (viewW - 56 < 2 * small * 19 + small * 2.2) return false;
    // Con columnas el texto usa todo el ancho de la pantalla (sin el margen
    // que lo centra a 760 px): se mide ya con ese ancho.
    body.classList.add('cols');
    body.classList.add('auto-compact');
    var width = sheet.clientWidth;
    for (var si = 0; si < SCALES.length; si++) {
      var fs = base * SCALES[si], gap = fs * 2.2;
      var maxCols = Math.min(3, Math.floor((width + gap) / (fs * 19 + gap)));
      if (maxCols < 2) continue;
      sheet.style.fontSize = SCALES[si] === 1 ? '' : fs + 'px';
      for (var k = 2; k <= maxCols; k++) {
        sheet.style.columnCount = String(k);
        relayout();
        if (fitsWithin(limitH)) return true;
      }
    }
    resetColumns(sheet);
    return false;
  }

  /**
   * ¿Cabría entera girando la pantalla? Se maqueta con el ancho y el alto
   * cambiados, se mira y se deshace. Solo en tablet: un móvil en horizontal
   * tiene sitio para muy pocas líneas.
   */
  function fitsRotated(sheet) {
    var w = window.innerWidth, h = window.innerHeight;
    if (Math.min(w, h) < 600) return false;
    var root = document.documentElement;
    root.style.width = h + 'px';
    relayout();
    var ok = fitsWithin(w) || tryColumns(sheet, w, h);
    root.style.width = '';
    resetColumns(sheet);
    return ok;
  }

  function setRotateHint(show) {
    var hint = document.querySelector('.rot-hint');
    if (!hint) return;
    hint.hidden = !show;
    if (show) {
      hint.textContent = '\u21bb Gira la pantalla: en ' +
        (window.innerWidth < window.innerHeight ? 'horizontal' : 'vertical') +
        ' se ve entera';
    }
  }

  // ── Modo atril: páginas en vez de scroll ─────────────────────────────────
  // La hoja se reparte en columnas de la altura de la pantalla que se
  // desbordan hacia la derecha; una página son las columnas que caben a lo
  // ancho, y pasar de página es desplazar la hoja una pantalla. Las
  // secciones no se parten entre columnas (break-inside: avoid), así que una
  // página nunca corta una estrofa por la mitad salvo que no quepa entera.
  var page = 0, pageCount = 1, stride = 0;

  function pager() { return document.querySelector('.pager'); }

  function indicator() {
    var el = document.querySelector('.pages-ind');
    if (!el) {
      el = document.createElement('div');
      el.className = 'pages-ind';
      el.setAttribute('aria-live', 'polite');
      document.body.appendChild(el);
    }
    return el;
  }

  function showPage() {
    var sheet = document.querySelector('.sheet');
    if (!sheet) return;
    page = Math.max(0, Math.min(page, pageCount - 1));
    sheet.style.transform = 'translateX(' + (-page * stride) + 'px)';
    var ind = indicator();
    ind.hidden = pageCount < 2;
    ind.textContent = (page + 1) + ' / ' + pageCount;
  }

  function goPage(delta) {
    if (!document.body.classList.contains('paged')) return false;
    var next = Math.max(0, Math.min(page + delta, pageCount - 1));
    if (next === page) return false;
    page = next;
    showPage();
    return true;
  }

  function columnsUsed(sheet, colW, gap) {
    return Math.max(1, Math.round((sheet.scrollWidth + gap) / (colW + gap)));
  }

  function paginate(sheet) {
    var body = document.body, wrap = pager();
    if (!wrap) return;
    resetColumns(sheet);
    sheet.style.transform = '';
    var cs = getComputedStyle(body);
    var padBottom = parseFloat(cs.paddingBottom) || 0;
    var top = wrap.getBoundingClientRect().top;
    var pageH = Math.max(120, window.innerHeight - top - padBottom);
    var base = parseFloat(getComputedStyle(sheet).fontSize) || 16;
    var width = wrap.clientWidth;
    // Como en las columnas del iPad: si con la letra hasta un 20 % más
    // pequeña cabe toda en UNA página, así; si no, páginas a su tamaño.
    function layoutAt(si) {
      var fs = base * SCALES[si], gap = fs * 2.2;
      var k = Math.max(1, Math.min(3, Math.floor((width + gap) / (fs * 19 + gap))));
      var colW = (width - (k - 1) * gap) / k;
      sheet.style.fontSize = SCALES[si] === 1 ? '' : fs + 'px';
      sheet.style.height = pageH + 'px';
      sheet.style.columnWidth = colW + 'px';
      sheet.style.columnGap = gap + 'px';
      // Varias columnas a la vista: el estribillo repetido se pliega.
      body.classList.toggle('auto-compact', k > 1);
      relayout();
      return { k: k, colW: colW, gap: gap, cols: columnsUsed(sheet, colW, gap) };
    }
    var chosen = null;
    for (var si = 0; si < SCALES.length && !chosen; si++) {
      var plan = layoutAt(si);
      if (plan.cols <= plan.k) chosen = plan;
    }
    if (!chosen) chosen = layoutAt(0);
    stride = chosen.k * (chosen.colW + chosen.gap);
    pageCount = Math.max(1, Math.ceil(chosen.cols / chosen.k));
    showPage();
  }

  function unpaginate(sheet) {
    sheet.style.height = '';
    sheet.style.columnWidth = '';
    sheet.style.columnGap = '';
    sheet.style.transform = '';
    page = 0; pageCount = 1;
    var ind = document.querySelector('.pages-ind');
    if (ind) ind.hidden = true;
  }

  function refit() {
    var sheet = document.querySelector('.sheet');
    if (!sheet) return;
    if (document.body.classList.contains('paged')) {
      setRotateHint(false);
      paginate(sheet);
      return;
    }
    unpaginate(sheet);
    resetColumns(sheet);
    relayout();
    if (fitsWithin(window.innerHeight)) { setRotateHint(false); return; }
    if (tryColumns(sheet, window.innerHeight, window.innerWidth)) {
      setRotateHint(false);
      return;
    }
    var rotate = fitsRotated(sheet);
    relayout();
    setRotateHint(rotate);
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
    page: goPage,
    relayout: relayout,
    chooseBreaks: chooseBreaks,
    penalty: penalty
  };

  if (typeof document === 'undefined' || !document.addEventListener) return;
  window.addEventListener('resize', schedule);
  // Pasar de canción: lo decide quien pinta la hoja (la pantalla completa
  // escucha «sheet-nav»; el resto lo ignora). Se avisa al pasar de la última
  // página o de la primera, y al deslizar en horizontal con scroll.
  function postNav(dir) {
    var msg = JSON.stringify({ type: 'sheet-nav', dir: dir });
    try {
      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
        window.ReactNativeWebView.postMessage(msg);
      } else if (window.parent && window.parent !== window) {
        window.parent.postMessage(msg, '*');
      }
    } catch (e) {}
  }
  function pageOrNav(dir) {
    if (!goPage(dir)) postNav(dir);
  }
  // Atril: un toque en el tercio izquierdo vuelve atrás, en el resto
  // avanza; las flechas, AvPág/RePág, espacio e Intro hacen lo mismo (es lo
  // que mandan los pedales Bluetooth); y también se puede deslizar.
  document.addEventListener('click', function (e) {
    if (!document.body.classList.contains('paged')) return;
    if (e.target && e.target.closest && e.target.closest('summary, a, button')) return;
    pageOrNav(e.clientX < window.innerWidth / 3 ? -1 : 1);
  });
  document.addEventListener('keydown', function (e) {
    var k = e.key;
    if (!document.body.classList.contains('paged')) {
      // Con scroll, las flechas laterales pasan de canción.
      if (k === 'ArrowRight' || k === 'ArrowLeft') postNav(k === 'ArrowRight' ? 1 : -1);
      return;
    }
    var d = k === 'ArrowRight' || k === 'ArrowDown' || k === 'PageDown' || k === ' ' || k === 'Enter' ? 1
      : k === 'ArrowLeft' || k === 'ArrowUp' || k === 'PageUp' ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    pageOrNav(d);
  });
  var touchX = null, touchY = null;
  document.addEventListener('touchstart', function (e) {
    if (!e.touches || e.touches.length !== 1) return;
    touchX = e.touches[0].clientX; touchY = e.touches[0].clientY;
  }, { passive: true });
  document.addEventListener('touchend', function (e) {
    if (touchX === null || !e.changedTouches || !e.changedTouches.length) return;
    var dx = e.changedTouches[0].clientX - touchX;
    var dy = e.changedTouches[0].clientY - touchY;
    touchX = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      var dir = dx < 0 ? 1 : -1;
      if (document.body.classList.contains('paged')) pageOrNav(dir);
      else if (Math.abs(dx) > 80) postNav(dir);
    }
  });
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
