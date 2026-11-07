/**
 * La celebración del día completo de Contigo (los tres hábitos hechos): una por
 * día, la primera vez que se vuelve a la home con 3/3.
 *
 * Se persiste el día celebrado para que cerrar y abrir la app, o volver a la
 * home cien veces, no repita el confeti. Todo el storage va en try/catch: sin
 * él (modo privado, datos bloqueados) se celebra como mucho una vez por sesión,
 * que es mejor que no celebrar nunca o que hacerlo en cada foco.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export const DAY_COMPLETE_KEY = '@contigo_dayComplete';

/** Cuánto dura el momento en pantalla. */
export const DAY_COMPLETE_MS = 2200;

/** Último día celebrado en ESTA sesión (por si el storage no responde). */
let celebratedInSession: string | null = null;

/** ¿Ya se celebró este día? */
export async function hasCelebratedDay(day: string): Promise<boolean> {
  if (celebratedInSession === day) return true;
  try {
    return (await AsyncStorage.getItem(DAY_COMPLETE_KEY)) === day;
  } catch {
    return false;
  }
}

/** Apunta que este día ya se celebró (memoria + storage). */
export async function markDayCelebrated(day: string): Promise<void> {
  celebratedInSession = day;
  try {
    await AsyncStorage.setItem(DAY_COMPLETE_KEY, day);
  } catch {
    // Sin storage: queda solo el aviso en memoria, hasta que se cierre la app.
  }
}

/** Solo para tests: olvida lo celebrado en esta sesión. */
export function resetDayCompleteSession(): void {
  celebratedInSession = null;
}

/**
 * Partículas de la celebración, sobrias: nueve (tres de cada hábito) en los
 * colores de los tres hábitos —evangelio, oración y revisión— en vez de la
 * paleta multicolor por defecto, para que sean del territorio de Contigo.
 */
export function dayCompleteParticles(
  habitColors: readonly [string, string, string],
): { tx: number; ty: number; c: string }[] {
  const spots = [
    { tx: -80, ty: -70 },
    { tx: 80, ty: -70 },
    { tx: 0, ty: -100 },
    { tx: -105, ty: 10 },
    { tx: 105, ty: 10 },
    { tx: -55, ty: 85 },
    { tx: 55, ty: 85 },
    { tx: 0, ty: 105 },
    { tx: -30, ty: -35 },
  ];
  return spots.map((spot, i) => ({ ...spot, c: habitColors[i % 3] }));
}
