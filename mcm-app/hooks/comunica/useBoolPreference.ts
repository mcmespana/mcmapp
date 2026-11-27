// Un interruptor que es PREFERENCIA del móvil, no un dato del área: «Asignar
// grupos» (plan 05) o «Habitación al llegar» (plan 18). Se guarda en el móvil
// de quien lo toca y nada más; si el almacén falla, se queda apagado.

import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export function useBoolPreference(
  key: string,
): [boolean, (v: boolean) => void] {
  const [on, setOn] = useState(false);
  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(key)
      .then((v) => {
        if (alive && v === '1') setOn(true);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [key]);
  const set = useCallback(
    (v: boolean) => {
      setOn(v);
      void AsyncStorage.setItem(key, v ? '1' : '0').catch(() => {});
    },
    [key],
  );
  return [on, set];
}
