// utils/otaAutoApply.ts
//
// Cuándo aplica la app una OTA YA DESCARGADA sin preguntar (en vez del modal
// de «¿te actualizas?» de siempre). Lógica pura, sin React ni Expo, para que se
// pueda testear sin montar nada. La usa `contexts/OTAContext.tsx`.
//
// La idea: interrumpir a alguien a media canción es lo peor, pero justo al
// abrir la app (o al volver a ella) no hay nada que interrumpir. Así que:
//   · update listo en los primeros segundos de una sesión → se aplica ya;
//   · update que llega más tarde (la comprobación de cada 15 min) → espera a
//     que la persona vuelva a la app desde el fondo;
//   · mientras alguien está a mitad del onboarding, nada: la recarga le
//     borraría lo elegido. Se aplica al terminarlo o saltarlo («released»);
//   · y siempre con un cortafuegos: si ya se aplicó una hace nada y seguimos
//     aquí, algo falla — no se entra en bucle de recargas.

/** Tras abrir (o volver a) la app, durante cuánto se considera «recién abierta». */
export const FRESH_WINDOW_MS = 45_000;

/** Entre dos aplicaciones automáticas seguidas, como mínimo esto. */
export const AUTO_APPLY_COOLDOWN_MS = 10 * 60_000;

/** Clave de AsyncStorage con la marca de la última aplicación automática. */
export const LAST_AUTO_APPLY_KEY = 'otaLastAutoApplyAt';

export type AutoApplyTrigger =
  /** El update acaba de quedar listo. */
  | 'ready'
  /** La app vuelve del segundo plano con un update ya listo. */
  | 'foreground'
  /**
   * Se acaba de soltar una retención (`useHoldOTAAutoApply`, p. ej. al salir
   * del onboarding) y había un update esperando.
   */
  | 'released';

interface Context {
  trigger: AutoApplyTrigger;
  now: number;
  /** Cuándo la app se hizo activa por última vez (arranque o vuelta del fondo). */
  activeSince: number;
  /** Marca de la última aplicación automática, o `null` si nunca. */
  lastAutoApplyAt: number | null;
  /** Alguna pantalla pide que no se recargue ahora (el onboarding). */
  held?: boolean;
}

export function shouldAutoApply({
  trigger,
  now,
  activeSince,
  lastAutoApplyAt,
  held = false,
}: Context): boolean {
  if (held) return false;
  if (
    lastAutoApplyAt !== null &&
    now - lastAutoApplyAt < AUTO_APPLY_COOLDOWN_MS
  ) {
    return false;
  }
  // Al volver del fondo, o al terminar lo que retenía, no hay nada a medias.
  if (trigger === 'foreground' || trigger === 'released') return true;
  return now - activeSince <= FRESH_WINDOW_MS;
}
