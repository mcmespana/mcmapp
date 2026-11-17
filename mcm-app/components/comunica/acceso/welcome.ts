// La entrada en Comunica (14/11/2026): el estado de la capa de bienvenida, sin
// React, para que la pinte la PUERTA (`app/(tabs)/comunica/index.tsx`) por
// encima del acceso y de la portada. Así el degradado tapa el acceso, la
// sesión se guarda debajo y la capa se abre ya sobre la portada, sin corte.
//
// La sesión se guarda cuando el círculo YA lo tapa todo y la marca está
// dibujada, lo diga la capa (`markCovered`) o, si no hay capa o se atasca, el tope
// `COVER_MS + COVER_GRACE_MS`. Con un reloj fijo, en un móvil lento la portada
// asomaba por detrás del círculo a medio crecer.

/** Hasta que el círculo, el anillo, la marca y el saludo están en su sitio. */
export const COVER_MS = 1_000;
/** Si la capa no avisa, se guarda igual pasado esto. */
export const COVER_GRACE_MS = 700;
/** Desde que todo está quieto hasta que empieza a abrirse (el saludo a la vista). */
export const HOLD_MS = 700;
/** Lo que tarda en abrirse. */
export const REVEAL_MS = 450;

export interface Welcome {
  /** Cambia en cada entrada: la capa vuelve a empezar. */
  id: number;
  /** Nombre de pila («David»), o vacío si no se sabe. */
  name: string;
  /** Lo que va debajo del saludo (la delegación). */
  subtitle: string;
  /** De dónde sale el círculo (el centro del botón), en coordenadas de ventana. */
  origin: { x: number; y: number } | null;
  /** `cover` → tapando; `reveal` → abriéndose sobre la portada. */
  phase: 'cover' | 'reveal';
  /**
   * Ya lo tapa todo. Al guardar la sesión la pila de Comunica se vuelve a
   * montar (el perfil cambia de clave) y la capa con ella: así sigue por donde
   * iba en vez de empezar otra vez.
   */
  covered: boolean;
}

let state: Welcome | null = null;
let seq = 0;
let covered: (() => void) | null = null;
const listeners = new Set<() => void>();
const emit = (next: Welcome | null) => {
  state = next;
  listeners.forEach((l) => l());
};

export const getWelcome = (): Welcome | null => state;
export function subscribeWelcome(l: () => void): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

/** La capa avisa de que el círculo ya lo tapa todo. */
export function markCovered(id: number): void {
  if (state?.id === id) covered?.();
}

/**
 * Empieza la entrada. La promesa se cumple cuando el degradado ya lo tapa todo:
 * es el momento de guardar la sesión, que la portada aparezca debajo sin verse.
 * Luego el saludo se queda un momento y la capa se abre sola.
 */
export function playWelcome(
  w: Omit<Welcome, 'id' | 'phase' | 'covered'>,
  ms: { grace?: number; hold?: number; reveal?: number } = {},
): Promise<void> {
  const id = ++seq;
  const hold = ms.hold ?? HOLD_MS;
  const reveal = ms.reveal ?? REVEAL_MS;
  emit({ ...w, id, phase: 'cover', covered: false });
  return new Promise((resolve) => {
    let done = false;
    const onCovered = () => {
      if (done) return;
      done = true;
      covered = null;
      if (state?.id === id) emit({ ...state, covered: true });
      resolve();
      setTimeout(() => {
        if (state?.id === id) emit({ ...state, phase: 'reveal' });
      }, hold);
      setTimeout(() => {
        if (state?.id === id) emit(null);
      }, hold + reveal);
    };
    covered = onCovered;
    setTimeout(onCovered, COVER_MS + (ms.grace ?? COVER_GRACE_MS));
  });
}

/** Si algo falla después de empezar (guardar la sesión), fuera la capa. */
export function cancelWelcome(): void {
  covered = null;
  emit(null);
}
