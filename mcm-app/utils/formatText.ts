// Conversor BBCode → HTML.
//
// El flag `g` ya reemplaza todas las apariciones en una sola pasada y, dado el
// orden de las reglas (los contenedores antes que los inline), no necesitamos
// volver a aplicar la misma regla. La versión anterior usaba un bucle
// `do { text = text.replace(...) } while (prev !== text)` que doblaba trabajo
// y, ante BBCode patológico (ej. tags solapados), podía no converger.
//
// Se aplica un guard de tamaño para evitar amplificaciones DoS en textos
// muy grandes con muchísimos tags.
const MAX_INPUT_LENGTH = 200_000;

export function formatBBCodeToHtml(text: string): string {
  if (!text) return '';
  if (text.length > MAX_INPUT_LENGTH) {
    text = text.slice(0, MAX_INPUT_LENGTH);
  }

  return text
    .replace(/\[br\]/gi, '<br/>')
    .replace(/\[b\]([\s\S]*?)\[\/b\]/gi, '<strong>$1</strong>')
    .replace(/\[i\]([\s\S]*?)\[\/i\]/gi, '<em>$1</em>')
    .replace(/\[u\]([\s\S]*?)\[\/u\]/gi, '<u>$1</u>')
    .replace(/\[h1\]([\s\S]*?)\[\/h1\]/gi, '<h2>$1</h2>')
    .replace(/\[url=([^\]]*?)\]([\s\S]*?)\[\/url\]/gi, '<a href="$1">$2</a>')
    .replace(
      /\[btn-primary=([^\]]*?)\]([\s\S]*?)\[\/btn-primary\]/gi,
      '<a href="$1" class="btn-primary">$2</a>',
    )
    .replace(
      /\[btn-secondary=([^\]]*?)\]([\s\S]*?)\[\/btn-secondary\]/gi,
      '<a href="$1" class="btn-secondary">$2</a>',
    )
    .replace(
      /\[color=([^\]]*?)\]([\s\S]*?)\[\/color\]/gi,
      '<span class="color-$1">$2</span>',
    )
    .replace(
      /\[quote\]([\s\S]*?)\[\/quote\]/gi,
      '<blockquote class="quote">$1</blockquote>',
    )
    .replace(
      /\[gquote\]([\s\S]*?)\[\/gquote\]/gi,
      '<blockquote class="gquote">$1</blockquote>',
    )
    .replace(/\[list\]([\s\S]*?)\[\/list\]/gi, (_match, items) => {
      const html = String(items).replace(
        /\[\*\]([\s\S]*?)(?=\[\*\]|$)/gi,
        '<li>$1</li>',
      );
      return `<ul>${html}</ul>`;
    });
}
