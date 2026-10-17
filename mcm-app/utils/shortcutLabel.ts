/**
 * Cómo se anuncia un atajo de teclado en la web: ⌘ en Mac/iPad y Ctrl en el
 * resto. `useKeyboardShortcut` acepta las dos teclas en todas partes; esto
 * solo decide qué se ENSEÑA, para no decirle «⌘K» a quien está en Windows.
 */

type NavigatorLike = {
  platform?: string;
  userAgent?: string;
  userAgentData?: { platform?: string };
};

/** ¿El teclado es de Apple (⌘)? Sin `navigator` (nativo, SSR) se asume que no. */
export function isApplePlatform(nav?: NavigatorLike | null): boolean {
  if (!nav) return false;
  const platform =
    nav.userAgentData?.platform || nav.platform || nav.userAgent || '';
  return /mac|iphone|ipad|ipod/i.test(platform);
}

/** Etiqueta de un atajo con la tecla modificadora: «⌘K» o «Ctrl+K». */
export function modShortcutLabel(
  key: string,
  nav: NavigatorLike | null | undefined = typeof navigator === 'undefined'
    ? null
    : (navigator as NavigatorLike),
): string {
  const k = key.toUpperCase();
  return isApplePlatform(nav) ? `⌘${k}` : `Ctrl+${k}`;
}
