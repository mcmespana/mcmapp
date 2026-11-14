// utils/panueloGate.ts
//
// ¿Está el pañuelo virtual disponible para esta persona? Mismo patrón que
// Carismochito (`utils/carismochitoGate.ts`): un interruptor de tres
// posiciones en `/profileConfig`, `global.panuelo`, que se cambia sin build ni
// OTA.
//
//   `global.panuelo`        | modo tester apagado | modo tester encendido
//   `off`                   | NO                  | NO
//   `alpha` (por defecto)   | NO                  | SÍ
//   `all`                   | SÍ                  | SÍ
//
// Hoy está en `alpha`: solo lo ve quien enciende el Laboratorio Alpha. `all`
// es el lanzamiento; `off`, la vuelta atrás de emergencia.

export type PanueloFlag = 'off' | 'alpha' | 'all';

export function parsePanueloFlag(value: unknown): PanueloFlag {
  return value === 'off' || value === 'all' ? value : 'alpha';
}

export function isPanueloAvailable({
  flag,
  testerMode,
}: {
  flag: PanueloFlag;
  testerMode: boolean;
}): boolean {
  if (flag === 'off') return false;
  if (flag === 'all') return true;
  return testerMode;
}
