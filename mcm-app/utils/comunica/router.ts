// utils/comunica/router.ts
//
// El enrutador de la pestaña Comunica (plan 10 §1): ¿área nativa o la WebView
// de siempre (el legado)? Puro, para poder probar la tabla entera.
//
// Desde el 14/11/2026 la nativa es el área de TODO el mundo (decisión del
// propietario): el legado queda de fondo, solo como vuelta atrás.
//
//   `global.comunicaNativa`        | alpha apagado | alpha encendido
//   `off`                          | legado        | legado
//   `solo-alpha`                   | legado        | NATIVA
//   `all`, `alpha` (el de antes),
//   ausente o un valor raro        | NATIVA        | NATIVA
//
// `alpha` se lee como `all` a propósito: es lo que hay escrito en Firebase
// desde la fase de pruebas, y el lanzamiento tiene que llegar con la OTA sin
// tocar el panel. Para volver a probar solo con el Laboratorio Alpha, `solo-alpha`.
//
// Sin servidor configurado (una build sin `EXPO_PUBLIC_COMUNICA_API`), siempre
// el legado.

export type ComunicaNativaFlag = 'off' | 'solo-alpha' | 'all';
export type ComunicaMode = 'native' | 'legacy';

export function parseComunicaNativaFlag(value: unknown): ComunicaNativaFlag {
  return value === 'off' || value === 'solo-alpha' ? value : 'all';
}

export function resolveComunicaMode({
  flag,
  alphaEnabled,
  apiAvailable,
}: {
  flag: ComunicaNativaFlag;
  alphaEnabled: boolean;
  apiAvailable: boolean;
}): ComunicaMode {
  if (!apiAvailable || flag === 'off') return 'legacy';
  if (flag === 'all') return 'native';
  return alphaEnabled ? 'native' : 'legacy';
}
