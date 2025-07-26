export function formatBBCodeToHtml(text: string): string {
  const replaceIteratively = (pattern: RegExp, replacer: string | ((...args: any[]) => string)) => {
    let prev: string;
    do {
      prev = text;
      text = text.replace(pattern, replacer as any);
    } while (prev !== text);
  };

  replaceIteratively(/\[br\]/gi, '<br/>');
  replaceIteratively(/\[b\](.*?)\[\/b\]/gis, '<strong>$1</strong>');
  replaceIteratively(/\[i\](.*?)\[\/i\]/gis, '<em>$1</em>');
  replaceIteratively(/\[u\](.*?)\[\/u\]/gis, '<u>$1</u>');
  replaceIteratively(/\[h1\](.*?)\[\/h1\]/gis, '<h2>$1</h2>');
  replaceIteratively(/\[url=(.*?)\](.*?)\[\/url\]/gis, '<a href="$1">$2</a>');
  replaceIteratively(/\[btn-primary=(.*?)\](.*?)\[\/btn-primary\]/gis, '<a href="$1" class="btn-primary">$2</a>');
  replaceIteratively(/\[btn-secondary=(.*?)\](.*?)\[\/btn-secondary\]/gis, '<a href="$1" class="btn-secondary">$2</a>');
  replaceIteratively(/\[color=(.*?)\](.*?)\[\/color\]/gis, '<span class="color-$1">$2</span>');
  replaceIteratively(/\[quote\](.*?)\[\/quote\]/gis, '<blockquote class="quote">$1</blockquote>');
  replaceIteratively(/\[gquote\](.*?)\[\/gquote\]/gis, '<blockquote class="gquote">$1</blockquote>');
  replaceIteratively(/\[list\](.*?)\[\/list\]/gis, (_match, items) => {
    const html = items.replace(/\[\*\](.*?)(?=\[\*\]|$)/gis, '<li>$1</li>');
    return `<ul>${html}</ul>`;
  });

  return text;
}
