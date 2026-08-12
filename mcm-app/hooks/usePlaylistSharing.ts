/**
 * Todos los flujos de "compartir la playlist" en un solo sitio: coro,
 * playlists en la nube, sesión en vivo, deshacer y contraseña.
 *
 * Vive fuera de `SelectedSongsScreen` porque la pantalla ya era el fichero más
 * grande del proyecto y porque estos flujos tienen reglas propias que conviene
 * poder leer (y testear) de corrido:
 *
 *  1. **Importar SIEMPRE reemplaza**, y siempre deja 10 s de "Deshacer". Antes
 *     cada importación abría un diálogo de tres botones aunque vinieras de un
 *     enlace: ahora la lista se pone sola y, si no era lo que querías, un toque
 *     lo devuelve todo (canciones y enlace con la nube).
 *  2. **Cualquiera puede machacar una playlist si sabe la contraseña.** Si la
 *     subiste tú desde este dispositivo, ni eso: actualizar es directo.
 *  3. **El enlace con la nube se recuerda** (`usePlaylistLink`), así que
 *     "actualizar la que subí" existe como opción de primera clase en vez de
 *     obligarte a recordar un código de 4 dígitos.
 */
import { useCallback, useMemo, useState } from 'react';
import { logger } from '@/utils/logger';
import { trackEvent } from '@/utils/analytics';
import { tramoTamano } from '@/constants/analyticsEvents';
import { useToast } from '@/contexts/AppToastContext';
import {
  useSelectedSongs,
  type SelectedSong,
} from '@/contexts/SelectedSongsContext';
import { useChoirSession } from '@/contexts/ChoirSessionContext';
import { useUserProfile } from '@/contexts/UserProfileContext';
import { useMyChoir, type MyChoir } from '@/hooks/useMyChoir';
import { usePlaylistLink, type PlaylistLink } from '@/hooks/usePlaylistLink';
import {
  allocateFreeCode,
  fetchCloudPlaylist,
  uploadCloudPlaylist,
} from '@/services/cloudPlaylistService';
import {
  fetchChoir,
  choirLatestPlaylist,
  upsertChoirPlaylist,
  type ChoirPlaylistEntry,
} from '@/services/choirDirectoryService';
import {
  isSameLeader,
  type ChoirSession,
} from '@/services/choirSessionService';
import { playlistSignature } from '@/utils/playlistSync';
import type { ChoirSheetStep } from '@/components/playlist/ChoirSheet';

/** Contraseña única para machacar cosas ajenas (playlists y liderazgo). */
export const SHARED_PASSWORD = 'coco';

/** Ventana para arrepentirse de una importación. Larga a propósito. */
const UNDO_MS = 10_000;

export interface PasswordRequest {
  title: string;
  description: string;
  confirmLabel: string;
  onSuccess: () => void;
}

export function usePlaylistSharing(opts: {
  onShowQr: (link: PlaylistLink) => void;
}) {
  const { selectedSongs, replaceAll, clearSelection } = useSelectedSongs();
  const { profile } = useUserProfile();
  const choirSession = useChoirSession();
  const { toast } = useToast();
  const { choir: myChoir, setChoir: setMyChoir } = useMyChoir();
  const { link, setLink } = usePlaylistLink();

  const [sheetStep, setSheetStep] = useState<ChoirSheetStep | null>(null);
  const [passwordRequest, setPasswordRequest] =
    useState<PasswordRequest | null>(null);
  const [busy, setBusy] = useState(false);

  const identity = useMemo(
    () => ({
      deviceId: choirSession.deviceId,
      name: profile.name?.trim() || undefined,
    }),
    [choirSession.deviceId, profile.name],
  );

  const signature = useMemo(
    () => playlistSignature(selectedSongs),
    [selectedSongs],
  );
  /** ¿Lo que veo es exactamente lo que hay subido? */
  const isSynced = !!link && link.signature === signature;

  const openSheet = useCallback(
    (step: ChoirSheetStep) => setSheetStep(step),
    [],
  );
  const closeSheet = useCallback(() => setSheetStep(null), []);

  /* --------------------------------------------------------------- */
  /*  Reemplazar con deshacer                                         */
  /* --------------------------------------------------------------- */

  /**
   * Sustituye la selección entera dejando 10 s para volver atrás. Restaura
   * también el enlace con la nube: deshacer una importación tiene que dejarte
   * exactamente donde estabas, no a medias.
   */
  const replaceWithUndo = useCallback(
    (songs: SelectedSong[], label: string, nextLink: PlaylistLink | null) => {
      const prevSongs = selectedSongs;
      const prevLink = link;
      replaceAll(songs);
      setLink(nextLink);
      toast.show({
        label,
        variant: 'success',
        duration: UNDO_MS,
        actionLabel: 'Deshacer',
        onActionPress: ({ hide }) => {
          replaceAll(prevSongs);
          setLink(prevLink);
          hide();
          toast.show({ label: 'Restaurada tu playlist anterior' });
        },
      });
    },
    [selectedSongs, link, replaceAll, setLink, toast],
  );

  /** Vaciar la lista sin ceremonias: un toque y 10 s para arrepentirse. */
  const clearWithUndo = useCallback(() => {
    if (selectedSongs.length === 0) return;
    const prevSongs = selectedSongs;
    clearSelection();
    toast.show({
      label: 'Playlist vaciada',
      duration: UNDO_MS,
      actionLabel: 'Deshacer',
      onActionPress: ({ hide }) => {
        replaceAll(prevSongs);
        hide();
      },
    });
  }, [selectedSongs, clearSelection, replaceAll, toast]);

  /* --------------------------------------------------------------- */
  /*  Importar                                                        */
  /* --------------------------------------------------------------- */

  /** Descarga un código y lo deja puesto (reemplazando, con deshacer). */
  const importByCode = useCallback(
    async (code: string, hint?: { name?: string; choir?: MyChoir }) => {
      const data = await fetchCloudPlaylist(code);
      if (!data) {
        throw new Error('No existe ninguna playlist con ese código');
      }
      const songs = data.songs ?? [];
      const name = hint?.name ?? data.name;
      const choirId = hint?.choir?.id ?? data.choirId;
      const choirName = hint?.choir?.name ?? data.choirName;
      trackEvent('playlist_usada', {
        accion: 'importada',
        tamano: tramoTamano(songs.length),
      });
      replaceWithUndo(
        songs,
        name ? `«${name}» importada` : `Playlist ${code} importada`,
        {
          code,
          name,
          choirId,
          choirName,
          signature: playlistSignature(songs),
          syncedAt: Date.now(),
          owned:
            !!data.ownerDeviceId && data.ownerDeviceId === identity.deviceId,
        },
      );
      // Si la playlist declara coro y todavía no tenías uno elegido, te lo
      // dejamos puesto: has entrado por el enlace de ese coro, es el tuyo.
      if (choirId && choirName && !myChoir) {
        setMyChoir({ id: choirId, name: choirName });
      }
    },
    [replaceWithUndo, identity.deviceId, myChoir, setMyChoir],
  );

  /** Importa una entrada concreta del histórico de un coro. */
  const importEntry = useCallback(
    async (entry: ChoirPlaylistEntry, choir: MyChoir) => {
      try {
        await importByCode(entry.code, { name: entry.name, choir });
      } catch (e: any) {
        toast.show({
          variant: 'danger',
          label: e?.message ?? 'No se ha podido importar',
        });
      }
    },
    [importByCode, toast],
  );

  /** «Importar la última» desde un enlace `?coro=<id>` sin abrir nada. */
  const importLatestFromChoir = useCallback(
    async (choirId: string) => {
      const choir = await fetchChoir(choirId);
      if (!choir) throw new Error('Ese coro ya no existe');
      const latest = choirLatestPlaylist(choir);
      if (!latest) throw new Error(`«${choir.name}» aún no tiene playlists`);
      await importByCode(latest.code, {
        name: latest.name,
        choir: { id: choir.id, name: choir.name },
      });
    },
    [importByCode],
  );

  /* --------------------------------------------------------------- */
  /*  Guardar                                                         */
  /* --------------------------------------------------------------- */

  const publish = useCallback(
    async (args: {
      code: string;
      name: string;
      choir: MyChoir;
      createdAt?: number;
    }) => {
      const now = Date.now();
      await uploadCloudPlaylist(args.code, selectedSongs, {
        name: args.name,
        createdAt: args.createdAt,
        choirId: args.choir.id,
        choirName: args.choir.name,
        by: identity.name,
        ownerDeviceId: identity.deviceId,
      });
      await upsertChoirPlaylist(args.choir.id, {
        code: args.code,
        name: args.name,
        createdAt: args.createdAt ?? now,
        updatedAt: now,
        songCount: selectedSongs.length,
        ...(identity.name ? { by: identity.name } : {}),
        ownerDeviceId: identity.deviceId,
      });
      const nextLink: PlaylistLink = {
        code: args.code,
        name: args.name,
        choirId: args.choir.id,
        choirName: args.choir.name,
        signature: playlistSignature(selectedSongs),
        syncedAt: now,
        owned: true,
      };
      setLink(nextLink);
      trackEvent('playlist_usada', {
        accion: 'compartida',
        tamano: tramoTamano(selectedSongs.length),
      });
      toast.show({
        variant: 'success',
        label: `«${args.name}» guardada en ${args.choir.name}`,
        duration: 6000,
        actionLabel: 'Ver QR',
        onActionPress: ({ hide }) => {
          hide();
          opts.onShowQr(nextLink);
        },
      });
    },
    [selectedSongs, identity, setLink, toast, opts],
  );

  /** Sube la selección como playlist NUEVA del coro (código automático). */
  const saveNew = useCallback(
    async (name: string, choir: MyChoir) => {
      if (busy) return;
      setBusy(true);
      try {
        const code = await allocateFreeCode();
        await publish({ code, name, choir });
      } catch (e: any) {
        logger.error('saveNew error', e);
        toast.show({
          variant: 'danger',
          label: e?.message ?? 'No se ha podido subir',
        });
      } finally {
        setBusy(false);
      }
    },
    [busy, publish, toast],
  );

  /**
   * Machaca una playlist que ya existe. Sin contraseña si la subiste tú desde
   * este dispositivo; con contraseña en cualquier otro caso (que es justo lo
   * que faltaba: antes, la playlist que te habías hecho en el ordenador no
   * había forma de actualizarla desde el móvil).
   */
  const saveUpdate = useCallback(
    (entry: ChoirPlaylistEntry, choir: MyChoir) => {
      const run = async () => {
        setBusy(true);
        try {
          await publish({
            code: entry.code,
            name: entry.name,
            choir,
            createdAt: entry.createdAt,
          });
        } catch (e: any) {
          logger.error('saveUpdate error', e);
          toast.show({
            variant: 'danger',
            label: e?.message ?? 'No se ha podido actualizar',
          });
        } finally {
          setBusy(false);
        }
      };

      const mine =
        (link?.code === entry.code && link.owned) ||
        (!!entry.ownerDeviceId && entry.ownerDeviceId === identity.deviceId);
      if (mine) {
        void run();
        return;
      }
      setPasswordRequest({
        title: `Actualizar «${entry.name}»`,
        description: `La subió otra persona (o desde otro dispositivo). Escribe la contraseña del coro para machacarla con tus ${selectedSongs.length} canciones.`,
        confirmLabel: 'Actualizar',
        onSuccess: () => {
          setPasswordRequest(null);
          void run();
        },
      });
    },
    [publish, link, identity.deviceId, selectedSongs.length, toast],
  );

  /* --------------------------------------------------------------- */
  /*  Coro en vivo                                                    */
  /* --------------------------------------------------------------- */

  /** Ponerse al frente del coro. Si ya dirige otra persona, pide contraseña. */
  const lead = useCallback(
    (choir: MyChoir, existing: ChoirSession | null) => {
      const run = async () => {
        try {
          await choirSession.startAsMaster(choir.id, selectedSongs, {
            name: identity.name,
            choirId: choir.id,
            choirName: choir.name,
          });
          toast.show({
            variant: 'success',
            label: `Diriges ${choir.name}. La sesión se cierra sola en 24 h.`,
          });
        } catch (e: any) {
          logger.error('lead error', e);
          toast.show({
            variant: 'danger',
            label: e?.message ?? 'No se ha podido iniciar',
          });
        }
      };

      if (!existing || isSameLeader(existing, identity)) {
        void run();
        return;
      }
      setPasswordRequest({
        title: 'Tomar el mando',
        description: `Ahora mismo dirige ${existing.master?.name || 'otra persona'}. Con la contraseña del coro pasas tú a dirigir y los demás te seguirán a ti.`,
        confirmLabel: 'Dirigir yo',
        onSuccess: () => {
          setPasswordRequest(null);
          void run();
        },
      });
    },
    [choirSession, selectedSongs, identity, toast],
  );

  /** Unirse como oyente: la playlist del líder pasa a ser la tuya (con deshacer). */
  const joinLive = useCallback(
    async (choir: MyChoir, session: ChoirSession) => {
      try {
        replaceWithUndo(
          session.playlist ?? [],
          `Sigues a ${session.master?.name || 'el líder'} en ${choir.name}`,
          null,
        );
        await choirSession.joinAsSlave(choir.id);
      } catch (e: any) {
        logger.error('joinLive error', e);
        toast.show({
          variant: 'danger',
          label: e?.message ?? 'No se ha podido entrar',
        });
      }
    },
    [choirSession, replaceWithUndo, toast],
  );

  const leaveLive = useCallback(() => {
    void choirSession.leave();
  }, [choirSession]);

  const dismissPassword = useCallback(() => setPasswordRequest(null), []);

  // El objeto se memoiza porque lo consume la pantalla de la playlist: si
  // cambiara en cada render, la cabecera memoizada y el menú de acciones se
  // recalcularían con cada pulsación de la lista.
  return useMemo(
    () => ({
      // estado
      myChoir,
      setMyChoir,
      link,
      signature,
      isSynced,
      identity,
      busy,
      // hoja del coro
      sheetStep,
      openSheet,
      closeSheet,
      // contraseña
      passwordRequest,
      dismissPassword,
      // acciones
      replaceWithUndo,
      clearWithUndo,
      importByCode,
      importEntry,
      importLatestFromChoir,
      saveNew,
      saveUpdate,
      lead,
      joinLive,
      leaveLive,
      setLink,
    }),
    [
      myChoir,
      setMyChoir,
      link,
      signature,
      isSynced,
      identity,
      busy,
      sheetStep,
      openSheet,
      closeSheet,
      passwordRequest,
      dismissPassword,
      replaceWithUndo,
      clearWithUndo,
      importByCode,
      importEntry,
      importLatestFromChoir,
      saveNew,
      saveUpdate,
      lead,
      joinLive,
      leaveLive,
      setLink,
    ],
  );
}
