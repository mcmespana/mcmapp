// Las dos marcas de salud de una lista, como las pondría el servidor: la
// principal (`healthNote`) con alergias, intolerancias o tratamiento; la menor
// (`healthOther`) con enfermedades u «otras patologías» (TEA, TDAH…). Solo
// cuentan los campos con texto. La app no lo usa para decidir nada (las marcas
// las manda el servidor): lo usa el servidor falso y los tests.

import {
  HEALTH_KINDS_MAIN,
  HEALTH_KINDS_OTHER,
  type HealthKind,
} from '@/services/comunica/contract';

export function healthBadgesOf(
  items: { kind: HealthKind; text: string }[] | undefined,
  /** `false` = la familia dijo «no» al uso de los datos: ninguna marca. */
  healthData?: boolean | null,
) {
  if (healthData === false) items = undefined;
  const has = (kinds: readonly HealthKind[]) =>
    !!items?.some((i) => kinds.includes(i.kind) && i.text.trim());
  return {
    healthNote: has(HEALTH_KINDS_MAIN),
    healthOther: has(HEALTH_KINDS_OTHER),
  };
}
