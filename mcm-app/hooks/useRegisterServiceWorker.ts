import { useEffect } from 'react';
import { Platform } from 'react-native';

/**
 * Registra el Service Worker en web (PWA). En nativo no hace nada.
 * El SW (`/sw.js`) implementa runtime caching para que la app funcione
 * offline tras la primera carga y se instale como PWA.
 */
export function useRegisterServiceWorker() {
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;

    const onLoad = () => {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .catch((err) => {
          // No bloqueamos la app si falla el SW, solo lo registramos.
          // eslint-disable-next-line no-console
          console.warn('[PWA] Service worker registration failed:', err);
        });
    };

    if (document.readyState === 'complete') {
      onLoad();
    } else {
      window.addEventListener('load', onLoad);
      return () => window.removeEventListener('load', onLoad);
    }
  }, []);
}
