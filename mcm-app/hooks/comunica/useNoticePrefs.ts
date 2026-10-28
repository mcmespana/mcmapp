// hooks/comunica/useNoticePrefs.ts
//
// Las tres preferencias de «Avisos en este móvil» (plan 08): cambian al
// instante en pantalla; se guardan en el móvil por detrás y
// `ComunicaBackground` vuelve a dar de alta el móvil si cambian las del
// servidor. Ver `services/comunica/devices.ts`.

import { useEffect, useState, useSyncExternalStore } from 'react';
import {
  getNoticePrefs,
  loadNoticePrefs,
  setNoticePref,
  subscribeNoticePrefs,
  type NoticePrefs,
} from '@/services/comunica/devices';

export function useNoticePrefs() {
  const prefs = useSyncExternalStore(subscribeNoticePrefs, getNoticePrefs);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let alive = true;
    void loadNoticePrefs().then(() => {
      if (alive) setLoaded(true);
    });
    return () => {
      alive = false;
    };
  }, []);
  return {
    prefs,
    loaded,
    setPref: (key: keyof NoticePrefs, value: boolean) =>
      void setNoticePref(key, value),
  };
}
