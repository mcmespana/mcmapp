import { useCallback } from 'react';
import { useFocusEffect } from 'expo-router/react-navigation';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';

/** Contador para que cada activación tenga su propia `tag`. */
let seq = 0;

/**
 * Mantiene la pantalla encendida mientras la pantalla que llama tiene el foco.
 *
 * El cantoral se usa con el móvil en el atril mientras se toca: sin esto la
 * pantalla se apagaba sola a mitad de canción (también con el auto-scroll en
 * marcha). Va por foco y no por montaje (`useKeepAwake`) porque el detalle de
 * canción sigue montado al irse a otra pestaña o al abrir la pantalla completa
 * encima, y ahí no tiene por qué gastar batería.
 *
 * Cada activación lleva una `tag` única y se suelta cuando ESA activación ha
 * terminado: en web (Wake Lock API) conceder el bloqueo es asíncrono, y soltar
 * por nombre una `tag` compartida dejaba, al salir y volver rápido, un bloqueo
 * huérfano o el nuevo soltado antes de tiempo. El sistema solo deja apagarse
 * la pantalla cuando se han soltado todas. La Wake Lock API no existe en todos
 * los navegadores y puede fallar (pestaña oculta): los errores se tragan, que
 * no tener pantalla encendida no es motivo de aviso.
 */
export function useKeepAwakeWhileFocused(name: string): void {
  useFocusEffect(
    useCallback(() => {
      seq += 1;
      const tag = `${name}-${seq}`;
      const granted = activateKeepAwakeAsync(tag).then(
        () => true,
        () => false,
      );
      return () => {
        void granted.then((ok) => {
          if (ok) deactivateKeepAwake(tag).catch(() => {});
        });
      };
    }, [name]),
  );
}
