// «Asignar grupos» encendido o apagado: una PREFERENCIA del móvil, no un dato
// del área (plan 05, regla 12; `sticpa-pl-asignar` del plugin).

import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'comunica.assignGroups';

export function useAssignPreference(): [boolean, (v: boolean) => void] {
  const [on, setOn] = useState(false);
  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(KEY)
      .then((v) => {
        if (alive && v === '1') setOn(true);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  const set = useCallback((v: boolean) => {
    setOn(v);
    void AsyncStorage.setItem(KEY, v ? '1' : '0').catch(() => {});
  }, []);
  return [on, set];
}
