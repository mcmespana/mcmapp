import { useProfileConfigContext } from '@/contexts/ProfileConfigContext';
import { usePreviewChannel } from '@/contexts/PreviewChannelContext';
import {
  isCarismochitoAvailable,
  parseCarismochitoFlag,
} from '@/utils/carismochitoGate';

/**
 * ¿Está disponible Carismochito (modo, caza y colección)? Ver
 * `utils/carismochitoGate.ts`.
 *
 * `settled` es `true` cuando ya se sabe de verdad (se ha leído la configuración
 * y el modo tester): hasta entonces `available` es `false` pero NO hay que
 * actuar en consecuencia —por ejemplo, apagar el icono del launcher— porque
 * podría ser solo que aún no ha llegado la respuesta.
 */
export function useCarismochitoAvailable(): {
  available: boolean;
  settled: boolean;
} {
  const { rawConfig, loading } = useProfileConfigContext();
  const { enabled, hydrated } = usePreviewChannel();
  const flag = parseCarismochitoFlag(rawConfig?.global?.carismochito);
  return {
    available: isCarismochitoAvailable({ flag, testerMode: enabled }),
    settled: !loading && hydrated,
  };
}
