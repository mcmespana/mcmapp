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
    // no lleva la variable, así que sigue con el legado.
    alphaEnabled:
      enabled || (Platform.OS === 'web' && comunicaApiTarget().kind === 'fake'),
    apiAvailable: isComunicaApiAvailable(),
  });
}
