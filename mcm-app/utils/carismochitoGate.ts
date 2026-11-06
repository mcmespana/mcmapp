// utils/carismochitoGate.ts
//
// ¿Está Carismochito disponible para esta persona? Puro, para poder probar la
// tabla entera. Carismochito es TODO esto junto: el modo (agitar el móvil, la
// app teñida de verde, el icono del launcher), la caza y la colección. Se
// enciende y se apaga entero, con un solo interruptor, `global.carismochito`
// de `/profileConfig` (mismo patrón que `global.comunicaNativa`):
//
//   `global.carismochito`   | modo tester apagado | modo tester encendido
//   `off`                   | NO                  | NO
//   `alpha` (por defecto)   | NO                  | SÍ
//   `all`                   | SÍ                  | SÍ
//
// El modo tester es la palanca del Laboratorio Alpha (canal `preview`).
//
//   · `alpha` es el estado de construcción: nadie que no sea probador ve nada,
//     y a quien lo traía activado se le apaga.
//   · `all` es el lanzamiento (25 aniversario de Carismochito, 2027): se pone
//     desde la consola de Firebase, sin build ni OTA.
//   · `off` es la vuelta atrás de emergencia: apaga también a los probadores.

export type CarismochitoFlag = 'off' | 'alpha' | 'all';

export function parseCarismochitoFlag(value: unknown): CarismochitoFlag {
  return value === 'off' || value === 'all' ? value : 'alpha';
}

export function isCarismochitoAvailable({
  flag,
  testerMode,
}: {
  flag: CarismochitoFlag;
  testerMode: boolean;
}): boolean {
  if (flag === 'off') return false;
  if (flag === 'all') return true;
  return testerMode;
}
