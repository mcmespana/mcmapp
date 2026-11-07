// ¿Área nativa o legado? Junta el interruptor de `/profileConfig`, el modo
// alpha y si hay servidor (ver `utils/comunica/router.ts`).

import { useProfileConfigContext } from '@/contexts/ProfileConfigContext';
import { usePreviewChannel } from '@/contexts/PreviewChannelContext';
import { Platform } from 'react-native';
import { comunicaApiTarget, isComunicaApiAvailable } from '@/services/comunica';
import {
  parseComunicaNativaFlag,
  resolveComunicaMode,
  type ComunicaMode,
} from '@/utils/comunica/router';

export function useComunicaMode(): ComunicaMode {
  const { rawConfig } = useProfileConfigContext();
  const { enabled } = usePreviewChannel();
  return resolveComunicaMode({
    flag: parseComunicaNativaFlag(rawConfig?.global?.comunicaNativa),
    // En web no hay canal preview ni Laboratorio Alpha: con el servidor falso
    // (desarrollo y capturas, plan 01) se enseña la nativa. La web publicada
    // no lleva la variable, así que sigue con el legado. En el simulador pasa
    // lo mismo, pero solo si se pide a propósito con
    // `EXPO_PUBLIC_COMUNICA_API=fake` (en desarrollo, sin variable, el objetivo
    // ya es «falso» y no se quiere saltar el interruptor al depurar el legado).
    alphaEnabled:
      enabled ||
      (comunicaApiTarget().kind === 'fake' &&
        (Platform.OS === 'web' ||
          process.env.EXPO_PUBLIC_COMUNICA_API === 'fake')),
    apiAvailable: isComunicaApiAvailable(),
  });
}
