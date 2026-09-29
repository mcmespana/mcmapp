/**
 * Hoja del **coro**: el sitio único desde el que se hace todo lo de compartir
 * playlists, sin códigos de por medio.
 *
 * Pasos (el mismo BottomSheet cambia de contenido, no se apilan modales):
 *
 *   choose  → elegir mi coro de la lista, o crear uno nuevo
 *   create  → nombre del coro nuevo
 *   home    → «importar la última» (acción destacada), ver todas, guardar,
 *             y el estado del coro en vivo
 *   browse  → histórico de playlists del coro (nombre, fecha, y el código
 *             pequeñito al final, que ya no es el protagonista)
 *   save    → actualizar la que ya subí vs. subir una nueva
 *
 * La hoja NO toca la selección local ni pide contraseñas: cuando el usuario
 * decide algo, se cierra y llama al callback correspondiente. Quien ejecuta
 * (y quien pide la contraseña si hace falta) es `SelectedSongsScreen`.
 */
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import BottomSheet from '@/components/BottomSheet';
import AppTextField from '@/components/ui/AppTextField';
import { useColorScheme } from '@/hooks/useColorScheme';
import { h } from '@/utils/haptics';
import { logger } from '@/utils/logger';
import type { MyChoir } from '@/hooks/useMyChoir';
import type { PlaylistLink } from '@/hooks/usePlaylistLink';
import {
  choirLatestPlaylist,
  choirPlaylists,
  createChoir,
  fetchChoir,
  listChoirs,
  type Choir,
  type ChoirPlaylistEntry,
} from '@/services/choirDirectoryService';
import {
  fetchLiveChoirSession,
  isSameLeader,
  type ChoirSession,
} from '@/services/choirSessionService';
import { defaultPlaylistName } from '@/utils/playlistCodes';
import { formatRelativeDate } from '@/utils/playlistSync';
import { accent, createStyles } from './choirSheetStyles';
import EmptyState from '@/components/ui/EmptyState';

export type ChoirSheetStep = 'choose' | 'create' | 'home' | 'browse' | 'save';

interface Props {
  visible: boolean;
  initialStep: ChoirSheetStep;
  myChoir: MyChoir | null;
  onChooseChoir: (choir: MyChoir) => void;
  /** Selección actual: 0 canciones desactiva "guardar". */
  songCount: number;
  link: PlaylistLink | null;
  identity: { deviceId: string; name?: string };
  /** 'off' | 'master' | 'slave' de la sesión en vivo actual. */
  liveMode: 'off' | 'master' | 'slave';
  /** Clave de la sesión en vivo en curso (id de coro o código). */
  liveKey: string | null;

  onImport: (entry: ChoirPlaylistEntry, choir: MyChoir) => void;
  onSaveNew: (name: string, choir: MyChoir) => void;
  onSaveUpdate: (entry: ChoirPlaylistEntry, choir: MyChoir) => void;
  onLead: (choir: MyChoir, existing: ChoirSession | null) => void;
  onJoinLive: (choir: MyChoir, session: ChoirSession) => void;
  onLeaveLive: () => void;
  onClose: () => void;
}

const ChoirSheet: React.FC<Props> = ({
  visible,
  initialStep,
  myChoir,
  onChooseChoir,
  songCount,
  link,
  identity,
  liveMode,
  liveKey,
  onImport,
  onSaveNew,
  onSaveUpdate,
  onLead,
  onJoinLive,
  onLeaveLive,
  onClose,
}) => {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const styles = useMemo(() => createStyles(isDark), [isDark]);

  const [step, setStep] = useState<ChoirSheetStep>(initialStep);
  const [choirs, setChoirs] = useState<Choir[] | null>(null);
  const [choir, setChoir] = useState<Choir | null>(null);
  const [live, setLive] = useState<ChoirSession | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newChoirName, setNewChoirName] = useState('');
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [busy, setBusy] = useState(false);

  // Al abrir, la hoja arranca siempre en el paso que pide la pantalla. Se
  // ajusta durante el render (patrón documentado de React para "resetear
  // estado cuando cambia una prop") para no pintar un fotograma con el paso
  // de la vez anterior.
  const [lastOpen, setLastOpen] = useState({ visible, initialStep });
  if (lastOpen.visible !== visible || lastOpen.initialStep !== initialStep) {
    setLastOpen({ visible, initialStep });
    if (visible) {
      setStep(myChoir ? initialStep : 'choose');
      setError(null);
      setBusy(false);
      setNewChoirName('');
      setNewPlaylistName(link?.name || defaultPlaylistName());
      // Cada apertura recarga el coro: entre una vez y otra puede haber subido
      // otra persona (o tú mismo desde el ordenador). Enseñar el histórico
      // cacheado sería justo lo contrario de lo que se viene a hacer aquí.
      setChoir(null);
      setLive(null);
    }
  }

  /** Carga el coro elegido + su sesión en vivo. */
  const loadChoir = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const [data, session] = await Promise.all([
        fetchChoir(id),
        fetchLiveChoirSession(id).catch(() => null),
      ]);
      setChoir(data);
      setLive(session);
      if (!data) setError('Este coro ya no existe. Elige otro.');
    } catch (e: any) {
      logger.error('choir load error', e);
      setError('No se ha podido conectar. ¿Tienes internet?');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadChoirs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setChoirs(await listChoirs());
    } catch (e: any) {
      logger.error('choir list error', e);
      setError('No se ha podido cargar la lista de coros');
      setChoirs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!visible) return;
    if (step === 'choose') void loadChoirs();
    else if (myChoir && choir?.id !== myChoir.id) void loadChoir(myChoir.id);
    // `choir?.id` a propósito: si ya está cargado el coro correcto, no se
    // vuelve a pedir cada vez que se cambia de paso dentro de la hoja.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, step, myChoir?.id]);

  const entries = useMemo(() => (choir ? choirPlaylists(choir) : []), [choir]);
  const latest = useMemo(
    () => (choir ? choirLatestPlaylist(choir) : null),
    [choir],
  );
  /** La playlist del coro que este dispositivo tiene enlazada (si sigue ahí). */
  const linkedEntry = useMemo(() => {
    if (!link || !choir || link.choirId !== choir.id) return null;
    return entries.find((e) => e.code === link.code) ?? null;
  }, [link, choir, entries]);

  /**
   * Cierra la hoja y ejecuta la acción DESPUÉS de que el Modal se haya
   * desmontado del todo: iOS no presenta un segundo Modal (la contraseña, el
   * QR) mientras el primero sigue montado. Mismo patrón que
   * `PlaylistActionsBottomSheet`.
   */
  const pendingActionRef = useRef<(() => void) | null>(null);
  const close = (fn?: () => void) => {
    pendingActionRef.current = fn ?? null;
    onClose();
  };
  const handleCloseComplete = useCallback(() => {
    const fn = pendingActionRef.current;
    pendingActionRef.current = null;
    fn?.();
  }, []);

  /**
   * Paso al que ir después de elegir/crear coro. Si la hoja se abrió para
   * guardar y no había coro elegido, se pasa por la lista y se VUELVE a
   * guardar: obligar a empezar otra vez desde el menú era un toque tonto.
   */
  const stepAfterChoosing = (): ChoirSheetStep =>
    initialStep === 'choose' || initialStep === 'create' ? 'home' : initialStep;

  const pickChoir = (c: Choir) => {
    h.tap();
    onChooseChoir({ id: c.id, name: c.name });
    setChoir(c);
    setStep(stepAfterChoosing());
  };

  const handleCreate = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const created = await createChoir(newChoirName, identity);
      onChooseChoir({ id: created.id, name: created.name });
      setChoir(created);
      setLive(null);
      setStep(stepAfterChoosing());
    } catch (e: any) {
      setError(e?.message ?? 'No se ha podido crear el coro');
    } finally {
      setBusy(false);
    }
  };

  /* ------------------------------------------------------------------ */

  const renderBack = (to: ChoirSheetStep, label: string) => (
    <TouchableOpacity style={styles.backRow} onPress={() => setStep(to)}>
      <MaterialIcons name="chevron-left" size={20} color={accent(isDark)} />
      <Text style={styles.backText}>{label}</Text>
    </TouchableOpacity>
  );

  const renderChoirHeader = () => (
    <View style={styles.choirRow}>
      <View style={styles.choirIcon}>
        <MaterialIcons name="groups" size={20} color={accent(isDark)} />
      </View>
      <View style={styles.choirTextBlock}>
        <Text style={styles.choirLabel}>Mi coro</Text>
        <Text style={styles.choirName} numberOfLines={1}>
          {choir?.name ?? myChoir?.name}
        </Text>
      </View>
      <TouchableOpacity
        style={styles.linkBtn}
        onPress={() => setStep('choose')}
      >
        <Text style={styles.linkBtnText}>Cambiar</Text>
      </TouchableOpacity>
    </View>
  );

  const renderRow = (
    icon: keyof typeof MaterialIcons.glyphMap,
    label: string,
    description: string | undefined,
    onPress: () => void,
    opts?: { disabled?: boolean; live?: boolean },
  ) => (
    <TouchableOpacity
      style={[styles.row, opts?.disabled && styles.rowDisabled]}
      onPress={() => {
        if (opts?.disabled) return;
        h.tap();
        onPress();
      }}
      disabled={opts?.disabled}
    >
      <View style={[styles.rowIcon, opts?.live && styles.rowIconLive]}>
        <MaterialIcons
          name={icon}
          size={20}
          color={opts?.live ? '#28A76A' : accent(isDark)}
        />
      </View>
      <View style={styles.rowTextBlock}>
        <Text style={styles.rowLabel}>{label}</Text>
        {description ? (
          <Text style={styles.rowDescription}>{description}</Text>
        ) : null}
      </View>
      <MaterialIcons name="chevron-right" size={20} color="#8E8E93" />
    </TouchableOpacity>
  );

  const entryMeta = (e: ChoirPlaylistEntry) =>
    `${formatRelativeDate(e.updatedAt)} · ${e.songCount} ${
      e.songCount === 1 ? 'canción' : 'canciones'
    }${e.by ? ` · ${e.by}` : ''}`;

  /* --- Paso: elegir coro -------------------------------------------- */
  const renderChoose = () => (
    <>
      <Text style={styles.description}>
        Las playlists cuelgan del coro. Elige el tuyo una vez y luego importar
        la del domingo es un toque.
      </Text>
      {loading ? (
        <ActivityIndicator style={styles.loading} color={accent(isDark)} />
      ) : (
        <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
          {(choirs ?? []).map((c) => (
            <TouchableOpacity
              key={c.id}
              style={[
                styles.listItem,
                myChoir?.id === c.id && styles.listItemActive,
              ]}
              onPress={() => pickChoir(c)}
            >
              <View style={styles.choirIcon}>
                <MaterialIcons name="groups" size={18} color={accent(isDark)} />
              </View>
              <View style={styles.rowTextBlock}>
                <Text style={styles.listTitle}>{c.name}</Text>
                <Text style={styles.listMeta}>
                  {Object.keys(c.playlists).length} playlist
                  {Object.keys(c.playlists).length === 1 ? '' : 's'}
                </Text>
              </View>
              {myChoir?.id === c.id ? (
                <MaterialIcons name="check" size={20} color={accent(isDark)} />
              ) : null}
            </TouchableOpacity>
          ))}
          {choirs && choirs.length === 0 ? (
            <EmptyState
              compact
              icon="groups"
              title="Todavía no hay ningún coro. Crea el primero."
              accentColor={accent(isDark)}
            />
          ) : null}
        </ScrollView>
      )}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {renderRow(
        'add-circle-outline',
        'Crear un coro nuevo',
        'Por ejemplo «Coro Consolación Castellón»',
        () => {
          setError(null);
          setStep('create');
        },
      )}
    </>
  );

  /* --- Paso: crear coro --------------------------------------------- */
  const renderCreate = () => (
    <>
      {renderBack('choose', 'Volver a la lista')}
      <View style={styles.field}>
        <Text style={styles.fieldLabel}>Nombre del coro</Text>
        <AppTextField
          value={newChoirName}
          onChangeText={setNewChoirName}
          placeholder="Coro Consolación Castellón"
          autoFocus
          editable={!busy}
          accentColor={accent(isDark)}
          accentWhenFilled
        />
      </View>
      <Text style={styles.description}>
        Cualquiera podrá elegirlo y subirle playlists, así que ponle el nombre
        por el que lo conoce la gente.
      </Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={styles.buttons}>
        <TouchableOpacity
          style={[styles.btn, styles.btnSecondary]}
          onPress={() => setStep('choose')}
          disabled={busy}
        >
          <Text style={styles.btnSecondaryText}>Cancelar</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.btn,
            styles.btnPrimary,
            (busy || newChoirName.trim().length < 3) && styles.btnDisabled,
          ]}
          onPress={() => void handleCreate()}
          disabled={busy || newChoirName.trim().length < 3}
        >
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.btnPrimaryText}>Crear coro</Text>
          )}
        </TouchableOpacity>
      </View>
    </>
  );

  /* --- Paso: home del coro ------------------------------------------ */
  const renderHome = () => {
    const leadingHere = liveMode === 'master' && liveKey === choir?.id;
    const followingHere = liveMode === 'slave' && liveKey === choir?.id;
    const leaderName = live?.master?.name?.trim();
    const iAmLeader = isSameLeader(live, identity);

    return (
      <>
        {renderChoirHeader()}

        <TouchableOpacity
          style={[styles.hero, !latest && styles.heroDisabled]}
          disabled={!latest || !myChoir}
          onPress={() => {
            if (!latest || !myChoir) return;
            h.tap();
            close(() => onImport(latest, myChoir));
          }}
        >
          <View style={styles.heroIcon}>
            <MaterialIcons name="bolt" size={22} color="#fff" />
          </View>
          <View style={styles.heroTextBlock}>
            <Text style={styles.heroTitle}>Importar la última</Text>
            <Text style={styles.heroSubtitle}>
              {latest
                ? `${latest.name} · ${entryMeta(latest)}`
                : loading
                  ? 'Cargando…'
                  : 'Este coro aún no tiene playlists'}
            </Text>
          </View>
        </TouchableOpacity>

        {renderRow(
          'history',
          'Ver todas las playlists',
          entries.length
            ? `${entries.length} en el histórico`
            : 'Aún no hay ninguna',
          () => setStep('browse'),
          { disabled: entries.length === 0 },
        )}

        <View style={styles.separator} />

        {renderRow(
          'cloud-upload',
          linkedEntry ? `Guardar «${linkedEntry.name}»` : 'Subir mi playlist',
          songCount === 0
            ? 'Tu selección está vacía'
            : linkedEntry
              ? 'Actualizar la del coro o subir una nueva'
              : `${songCount} ${songCount === 1 ? 'canción' : 'canciones'} para todo el coro`,
          () => {
            setNewPlaylistName(link?.name || defaultPlaylistName());
            setStep('save');
          },
          { disabled: songCount === 0 },
        )}

        <View style={styles.separator} />
        <Text style={styles.sectionTitle}>Coro en vivo</Text>

        {leadingHere ? (
          renderRow(
            'campaign',
            'Estás dirigiendo',
            'Los demás ven la canción que abras. Toca para cerrar la sesión.',
            () => close(onLeaveLive),
            { live: true },
          )
        ) : followingHere ? (
          renderRow(
            'headphones',
            `Siguiendo a ${leaderName || 'el líder'}`,
            'Toca para salir del coro en vivo',
            () => close(onLeaveLive),
            { live: true },
          )
        ) : live ? (
          <>
            {renderRow(
              'headphones',
              `Unirme · dirige ${leaderName || 'alguien'}`,
              'Verás su canción y su tono en tiempo real',
              () => {
                if (!myChoir) return;
                close(() => onJoinLive(myChoir, live));
              },
              { live: true },
            )}
            {renderRow(
              'campaign',
              'Tomar el mando',
              iAmLeader
                ? 'Eres tú desde otro dispositivo: pasa sin contraseña'
                : 'Hace falta la contraseña del coro',
              () => {
                if (!myChoir) return;
                close(() => onLead(myChoir, live));
              },
            )}
          </>
        ) : (
          renderRow(
            'campaign',
            'Dirigir yo',
            'Quien se una a este coro seguirá tus canciones (24 h)',
            () => {
              if (!myChoir) return;
              close(() => onLead(myChoir, null));
            },
            { disabled: !myChoir },
          )
        )}

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </>
    );
  };

  /* --- Paso: histórico ---------------------------------------------- */
  const renderBrowse = () => (
    <>
      {renderBack('home', choir?.name ?? 'Volver')}
      {loading ? (
        <ActivityIndicator style={styles.loading} color={accent(isDark)} />
      ) : (
        <ScrollView style={styles.list}>
          {entries.map((e) => (
            <TouchableOpacity
              key={e.code}
              style={[
                styles.listItem,
                link?.code === e.code && styles.listItemActive,
              ]}
              onPress={() => {
                if (!myChoir) return;
                h.tap();
                close(() => onImport(e, myChoir));
              }}
            >
              <View style={styles.rowTextBlock}>
                <Text style={styles.listTitle} numberOfLines={1}>
                  {e.name}
                </Text>
                <Text style={styles.listMeta}>{entryMeta(e)}</Text>
              </View>
              <Text style={styles.codeChip}>#{e.code}</Text>
            </TouchableOpacity>
          ))}
          {entries.length === 0 ? (
            <EmptyState
              compact
              icon="queue-music"
              title="Este coro aún no tiene playlists."
              accentColor={accent(isDark)}
            />
          ) : null}
        </ScrollView>
      )}
    </>
  );

  /* --- Paso: guardar ------------------------------------------------ */
  const renderSave = () => (
    <>
      {renderBack('home', choir?.name ?? 'Volver')}
      {linkedEntry ? (
        <>
          {renderRow(
            'sync',
            `Actualizar «${linkedEntry.name}»`,
            `Machaca la del coro · ${formatRelativeDate(linkedEntry.updatedAt)} · #${linkedEntry.code}`,
            () => {
              if (!myChoir) return;
              close(() => onSaveUpdate(linkedEntry, myChoir));
            },
          )}
          <View style={styles.separator} />
          <Text style={styles.sectionTitle}>O empezar una nueva</Text>
        </>
      ) : null}

      <View style={styles.field}>
        <Text style={styles.fieldLabel}>Nombre de la playlist</Text>
        <AppTextField
          value={newPlaylistName}
          onChangeText={setNewPlaylistName}
          placeholder="Eucaristía domingo 7 ago"
          editable={!busy}
          accentColor={accent(isDark)}
          accentWhenFilled
        />
      </View>
      <Text style={styles.description}>
        Se sube a {choir?.name ?? 'tu coro'} con {songCount}{' '}
        {songCount === 1 ? 'canción' : 'canciones'}. El código para compartirla
        suelta se genera solo.
      </Text>
      <View style={styles.buttons}>
        <TouchableOpacity
          style={[
            styles.btn,
            styles.btnPrimary,
            !newPlaylistName.trim() && styles.btnDisabled,
          ]}
          onPress={() => {
            if (!myChoir || !newPlaylistName.trim()) return;
            close(() => onSaveNew(newPlaylistName.trim(), myChoir));
          }}
          disabled={!newPlaylistName.trim()}
        >
          <Text style={styles.btnPrimaryText}>
            {linkedEntry ? 'Subir como nueva' : 'Subir al coro'}
          </Text>
        </TouchableOpacity>
      </View>
    </>
  );

  const titles: Record<ChoirSheetStep, string> = {
    choose: 'Elige tu coro',
    create: 'Nuevo coro',
    home: 'Coro',
    browse: 'Playlists del coro',
    save: 'Guardar en el coro',
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      onCloseComplete={handleCloseComplete}
      title={titles[step]}
    >
      <View style={styles.container}>
        {step === 'choose'
          ? renderChoose()
          : step === 'create'
            ? renderCreate()
            : step === 'browse'
              ? renderBrowse()
              : step === 'save'
                ? renderSave()
                : renderHome()}
      </View>
    </BottomSheet>
  );
};

export default ChoirSheet;
