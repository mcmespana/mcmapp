import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

export type KeyboardEvents = {
  show: 'keyboardWillShow' | 'keyboardDidShow';
  hide: 'keyboardWillHide' | 'keyboardDidHide';
};

/**
 * Eventos de teclado a escuchar, por plataforma.
 *
 * iOS avisa ANTES (`keyboardWill*`, con la duración de la animación del
 * teclado), así que lo que se mueva puede ir a la vez que el teclado. Android
 * no emite `keyboardWill*`, solo `keyboardDid*`: escuchar los `Will` en
 * Android es no enterarse nunca. En web no hay nada que hacer (`null`): el
 * teclado no tapa el contenido de la página.
 */
export function keyboardEventsFor(os: string): KeyboardEvents | null {
  if (os === 'ios')
    return { show: 'keyboardWillShow', hide: 'keyboardWillHide' };
  if (os === 'android')
    return { show: 'keyboardDidShow', hide: 'keyboardDidHide' };
  return null;
}

/**
 * ¿Está el teclado abierto? Para quitar el hueco del safe-area inferior de un
 * pie con botones cuando el teclado lo tapa (sobra: el teclado ya cubre la
 * barra de gestos).
 */
export function useKeyboardVisible(): boolean {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const events = keyboardEventsFor(Platform.OS);
    if (!events) return;
    const showSub = Keyboard.addListener(events.show, () => setVisible(true));
    const hideSub = Keyboard.addListener(events.hide, () => setVisible(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);
  return visible;
}
