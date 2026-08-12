/**
 * El **enlace** entre la playlist que tienes en el móvil y su copia en la nube.
 *
 * Es lo que permite responder a la pregunta que antes no tenía respuesta:
 * «he tocado 3 canciones, ¿esto que veo es lo que está subido o no?». Con el
 * enlace guardado (código + coro + firma de la lista en el momento de
 * subir/importar) la pantalla puede decir «guardada» o «cambios sin guardar»,
 * y ofrecer **actualizar** en vez de obligar a inventarse otro código.
 *
 * Se persiste en AsyncStorage: sobrevive a cerrar la app, que es justo cuando
 * antes se perdía el hilo (subo desde el ordenador, importo en el móvil, y al
 * día siguiente ya no hay forma de sobrescribir "la mía").
 */
import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from '@/utils/logger';
import { isValidCode } from '@/utils/playlistCodes';

const STORAGE_KEY = '@mcm_playlist_link_v1';
/** Clave antigua: solo guardaba el código de la última subida. */
const LEGACY_CODE_KEY = '@mcm_last_upload_code';

export interface PlaylistLink {
  /** Código de 4 dígitos bajo el que vive en `/playlistShares`. */
  code: string;
  /** Nombre con el que se subió («Eucaristía 7 ago»). */
  name?: string;
  choirId?: string;
  choirName?: string;
  /**
   * Firma (`playlistSignature`) de la selección en el momento de subirla o
   * importarla. Si la firma actual difiere, hay cambios sin guardar.
   */
  signature: string;
  /** Cuándo se sincronizó por última vez. */
  syncedAt: number;
  /** ¿La subimos desde este dispositivo? Entonces actualizarla no pide contraseña. */
  owned: boolean;
}

export function usePlaylistLink() {
  const [link, setLinkState] = useState<PlaylistLink | null>(null);
  const [isHydrated, setHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as PlaylistLink;
          if (parsed?.code && isValidCode(parsed.code) && !cancelled) {
            setLinkState(parsed);
          }
        } else {
          // Migración desde la versión que solo recordaba el código: se asume
          // que era nuestra (es lo que había subido este dispositivo) y que la
          // lista puede haber cambiado desde entonces (firma vacía).
          const legacy = await AsyncStorage.getItem(LEGACY_CODE_KEY);
          if (legacy && isValidCode(legacy) && !cancelled) {
            setLinkState({
              code: legacy,
              signature: '',
              syncedAt: 0,
              owned: true,
            });
          }
          if (legacy) await AsyncStorage.removeItem(LEGACY_CODE_KEY);
        }
      } catch (e) {
        logger.error('playlist link restore error', e);
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setLink = useCallback((next: PlaylistLink | null) => {
    setLinkState(next);
    if (next) {
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
    } else {
      AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
    }
  }, []);

  return { link, setLink, isHydrated };
}
