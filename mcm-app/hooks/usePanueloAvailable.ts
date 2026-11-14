import { useProfileConfigContext } from '@/contexts/ProfileConfigContext';
import { usePreviewChannel } from '@/contexts/PreviewChannelContext';
import { isPanueloAvailable, parsePanueloFlag } from '@/utils/panueloGate';

/**
 * ¿Está disponible el pañuelo virtual? Ver `utils/panueloGate.ts`.
 *
 * `settled` es `true` cuando ya se sabe lo bastante para decidir: hasta
 * entonces `available` puede ser `false` solo porque aún no ha llegado la
 * respuesta, y no hay que echar a nadie de la pantalla.
 *
 * Un probador con la palanca puesta no espera a la configuración: sin ella el
 * interruptor vale `alpha`, que ya le deja pasar. Así el pañuelo abre también
 * sin red (si luego llega un `off`, se le saca).
 */
export function usePanueloAvailable(): {
  available: boolean;
  settled: boolean;
} {
  const { rawConfig, loading } = useProfileConfigContext();
  const { enabled, hydrated } = usePreviewChannel();
  const flag = parsePanueloFlag(rawConfig?.global?.panuelo);
  const available = isPanueloAvailable({ flag, testerMode: enabled });
  return {
    available,
    settled: hydrated && (!loading || available),
  };
}
