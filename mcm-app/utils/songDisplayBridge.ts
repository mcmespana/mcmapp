/**
 * Puente entre `SongDisplay` y el documento de la canción (WebView en nativo,
 * iframe `srcDoc` en web) para lo que NO es estilo: cambiar el contenido sin
 * recargar la página y pasarle el teclado al documento padre.
 *
 * Los estilos (tamaño, acordes, tema…) ya viajan en vivo por
 * `__SONG_BRIDGE__.apply` (`utils/songDocument.ts`). Esto cubre lo que
 * reconstruye el HTML —transponer, cambiar la notación— y que antes recargaba
 * el WebView entero: parpadeo y vuelta arriba de la canción en cada toque.
 */

/**
 * La «carcasa» de un documento: todo menos el contenido visible del `<body>`
 * (cabecera con el CSS, la etiqueta `<body …>` con sus clases y los
 * `<script>`). Si dos documentos tienen la misma carcasa, el segundo se puede
 * pintar encima del primero cambiando solo el contenido del body: los scripts
 * que ya corren en la página (maquetación, puente de estilos, toque largo del
 * admin) son exactamente los que traería el nuevo.
 *
 * Devuelve `null` si el HTML no tiene la forma esperada: entonces no se
 * intenta nada y se recarga como siempre.
 */
export function documentShell(html: string): string | null {
  const open = html.indexOf('<body');
  const openEnd = open < 0 ? -1 : html.indexOf('>', open);
  const close = html.lastIndexOf('</body>');
  if (open < 0 || openEnd < 0 || close < openEnd) return null;
  const body = html.slice(openEnd + 1, close);
  const scripts = body.match(/<script[\s\S]*?<\/script>/g) ?? [];
  return html.slice(0, openEnd + 1) + scripts.join('\n') + html.slice(close);
}

/**
 * ¿Se puede pasar de `loaded` (el HTML con el que se CARGÓ la página, aunque
 * luego se le haya cambiado el contenido) a `next` sin recargar? Solo si es el
 * mismo documento (`sameDoc`: misma canción) y la carcasa no ha cambiado.
 */
export function canSwapInPlace(
  loaded: string,
  next: string,
  sameDoc: boolean,
): boolean {
  if (!sameDoc) return false;
  const a = documentShell(loaded);
  return a !== null && a === documentShell(next);
}

/**
 * Lo que la página tiene CARGADO (`loaded`, lo que va en `source`/`srcDoc`) y
 * lo que ENSEÑA (`shown`). Difieren cuando un HTML nuevo se ha pintado dentro
 * de la página sin recargarla; `swaps` cuenta esos cambios (0 = recién
 * cargada, no hay nada que pintar encima).
 */
export interface SongView {
  loaded: string;
  key: string | undefined;
  shown: string;
  swaps: number;
}

/**
 * Siguiente estado de `SongDisplay` cuando llega un HTML: pintarlo dentro de
 * la página (si está lista y es la misma canción con la misma carcasa) o
 * recargar. Con el spinner (`isLoading`) no hay página montada, así que la que
 * se monte después debe cargar directamente lo último que se enseñaba.
 *
 * Devuelve los MISMOS objetos si no cambia nada (para no volver a pintar).
 */
export function nextSongView(
  view: SongView,
  ready: boolean,
  next: { html: string; docKey: string | undefined; isLoading: boolean },
): { view: SongView; ready: boolean } {
  let v = view;
  let r = ready;
  if (next.html !== v.shown) {
    const inPlace =
      r &&
      canSwapInPlace(
        v.loaded,
        next.html,
        next.docKey !== undefined && next.docKey === v.key,
      );
    if (inPlace) {
      v = { ...v, shown: next.html, swaps: v.swaps + 1 };
    } else {
      v = { loaded: next.html, key: next.docKey, shown: next.html, swaps: 0 };
      r = false;
    }
  }
  if (next.isLoading && (r || v.loaded !== v.shown)) {
    v = { ...v, loaded: v.shown, key: next.docKey, swaps: 0 };
    r = false;
  }
  return { view: v, ready: r };
}

/**
 * JS que, ejecutado DENTRO de la página, sustituye el contenido del body por
 * el de `html` sin recargar y sin perder el sitio:
 *
 *  - Deja los `<script>` donde están (ya han corrido) y cambia el resto.
 *  - Fija el alto mínimo del body mientras cambia, para que el documento no
 *    encoja un instante y el navegador recorte el scroll a 0.
 *  - Conserva qué estribillos plegados estaban abiertos.
 *  - Vuelve a maquetar (`__SONG_LAYOUT__.refit`, que va en el siguiente
 *    frame) y, justo después y antes de pintar, suelta el alto mínimo y
 *    devuelve el scroll a donde estaba SOLO si se ha movido.
 *
 * Lo normal es que no se mueva (el alto mínimo lo impide) y entonces no se
 * toca: así no hay `scrollTo` que pelee con el `contentInset` nativo de iOS
 * ni con un scroll con inercia en marcha.
 */
export function swapBodyScript(html: string): string {
  // JSON con los separadores de línea escapados: en un literal de JS antiguo
  // U+2028/U+2029 terminaban la cadena.
  const payload = JSON.stringify(html)
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
  return `(function(){try{
var doc=new DOMParser().parseFromString(${payload},'text/html');
var body=document.body;if(!doc||!doc.body||!body)return;
var y=window.scrollY||window.pageYOffset||0;
var opened=Array.prototype.map.call(document.querySelectorAll('details'),function(d){return d.open;});
body.style.minHeight=body.scrollHeight+'px';
Array.prototype.slice.call(body.childNodes).forEach(function(n){if(n.nodeName!=='SCRIPT')body.removeChild(n);});
var anchor=body.firstChild;
Array.prototype.slice.call(doc.body.childNodes).forEach(function(n){if(n.nodeName!=='SCRIPT')body.insertBefore(document.importNode(n,true),anchor);});
var now=document.querySelectorAll('details');
if(now.length===opened.length){for(var i=0;i<now.length;i++)now[i].open=opened[i];}
if(window.__SONG_LAYOUT__)window.__SONG_LAYOUT__.refit();
var raf=window.requestAnimationFrame||function(f){return setTimeout(f,16);};
raf(function(){var now2=window.scrollY||window.pageYOffset||0;if(Math.abs(now2-y)>1)window.scrollTo(0,y);body.style.minHeight='';});
}catch(e){}true;})();`;
}

/**
 * Teclado del iframe (web) → ventana padre. Los `keydown` dentro de un iframe
 * no suben al documento que lo contiene, así que en cuanto alguien hacía clic
 * en la letra dejaban de funcionar ⌘K y los atajos del detalle. Se reemite
 * cada tecla en `target` (la ventana de la app) como un evento nuevo; si algún
 * atajo la consume (`preventDefault`), se cancela también la original.
 *
 * Tab no se reenvía (es para mover el foco dentro del iframe).
 */
export function makeKeydownForwarder(target: Window) {
  return (e: KeyboardEvent) => {
    if (e.key === 'Tab') return;
    const Ctor = (target as unknown as { KeyboardEvent: typeof KeyboardEvent })
      .KeyboardEvent;
    const forwarded = new Ctor('keydown', {
      key: e.key,
      code: e.code,
      metaKey: e.metaKey,
      ctrlKey: e.ctrlKey,
      shiftKey: e.shiftKey,
      altKey: e.altKey,
      repeat: e.repeat,
      bubbles: true,
      cancelable: true,
    });
    if (!target.dispatchEvent(forwarded)) e.preventDefault();
  };
}
