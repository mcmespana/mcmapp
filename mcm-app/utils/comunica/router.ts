// utils/comunica/router.ts
//
// El enrutador de la pestaña Comunica (plan 10 §1): ¿área nativa o la WebView
// de siempre (el legado)? Puro, para poder probar la tabla entera.
//
//   `global.comunicaNativa` | alpha apagado | alpha encendido
//   `off`                   | legado        | legado
//   `alpha` (por defecto)   | legado        | NATIVA
//   `all`                   | nativa        | nativa
//
// Y sin servidor configurado (producción sin `EXPO_PUBLIC_COMUNICA_API`),
// siempre el legado.

export type ComunicaNativaFlag = 'off' | 'alpha' | 'all';
export type ComunicaMode = 'native' | 'legacy';

export function parseComunicaNativaFlag(value: unknown): ComunicaNativaFlag {
  return value === 'off' || value === 'all' ? value : 'alpha';
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
