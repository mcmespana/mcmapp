// Icono alternativo del launcher (modo Carismochito).
//
// Envoltorio fino sobre `expo-alternate-app-icons` con tres garantías, porque
// esto toca algo que vive FUERA de la app y no se puede dejar a medias:
//
//   1. **Nunca lanza.** Si el módulo nativo no está (build viejo, web) o la
//      plataforma no lo soporta, la llamada es un no-op. El modo Carismochito
//      tiene que seguir funcionando aunque el icono no cambie.
//   2. **Nunca cambia el icono si ya es el correcto.** En iOS cada cambio real
//      dispara una alerta del sistema ("Has cambiado el icono de MCM App") que
//      NO se puede suprimir. Llamar a ciegas en cada arranque sería insufrible;
//      por eso se compara primero con `getAppIconName()`.
//   3. **Se puede reparar.** `syncAppIcon(false)` devuelve el icono por defecto
//      aunque la app crea que ya lo estaba, aplicando la regla 2: si el icono
//      del sistema quedó desincronizado (p. ej. se borró el flag de
//      AsyncStorage con el modo puesto), el siguiente arranque lo endereza.
//
// El nombre `Carismochito` tiene que coincidir EXACTAMENTE con el `name` del
// plugin en `app.json`; de ahí que sea una constante compartida.

import {
  getAppIconName,
  setAlternateAppIcon,
  supportsAlternateIcons,
} from 'expo-alternate-app-icons';

import { logger } from '@/utils/logger';

/** Nombre del icono alternativo declarado en `app.json`. */
export const CARISMOCHITO_ICON = 'Carismochito';

/**
 * Último icono que ESTE proceso ha aplicado con éxito (`undefined` = ninguno
 * todavía). En Android `getAppIconName()` lee el componente de la Activity que
 * está corriendo, y esa no cambia hasta relanzar la app: tras activar el modo
 * sigue diciendo `null` (icono por defecto) aunque el launcher ya muestre la
 * mascota, y salir en el mismo arranque no revertía el icono. Por eso, una vez
 * aplicado algo, mandamos lo que sabemos y no lo que lee el sistema. En iOS
 * `getAppIconName()` sí se actualiza al momento, así que ahí coinciden.
 */
let lastApplied: string | null | undefined;

/** Olvida el icono aplicado (solo para tests, que comparten el módulo). */
export function resetAppIconCache(): void {
  lastApplied = undefined;
}

/**
 * Pone el icono del launcher acorde al modo Carismochito. `true` → mascota,
 * `false` → icono normal de la app. No hace nada si ya está como toca.
 */
export async function syncAppIcon(carismochitoActive: boolean): Promise<void> {
  if (!supportsAlternateIcons) return;

  const wanted = carismochitoActive ? CARISMOCHITO_ICON : null;
  try {
    // `getAppIconName()` devuelve `null` cuando está el icono por defecto.
    const current = lastApplied !== undefined ? lastApplied : getAppIconName();
    if (current === wanted) return;
    await setAlternateAppIcon(wanted);
    lastApplied = wanted;
  } catch (error) {
    // Que no se pueda cambiar el icono no es motivo para romper nada: se anota
    // y el modo sigue su curso.
    logger.warn('[appIcon] no se pudo cambiar el icono:', error);
  }
}
