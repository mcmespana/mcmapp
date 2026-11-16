/**
 * Editor de canciones dentro de la app. Solo para administradores
 * (`users/<uid>/isAdmin`, `hooks/useAdminStatus.ts`). Sustituye al panel
 * secreto de la contraseña.
 *
 * Cuatro pestañas y nada más:
 *  - **Acordes**: la letra con los acordes en pastillas; se tocan, se
 *    arrastran, se cambian (`components/song-editor/ChordGrid.tsx`).
 *  - **Texto**: el ChordPro tal cual, para lo que no sea mover un acorde.
 *  - **Datos**: título, autor, tono, cejilla y lo multimedia.
 *  - **Vista**: como se verá en el cantoral.
 *
 * Canción nueva (`?nueva=1`): de una foto (la lee la IA del cantoral), de un
 * texto pegado o en blanco; después es el mismo editor.
 *
 * Guardar: `services/songEditorService.ts`. Detalle en
 * `docs/funcionalidades/EDITOR_CANCIONES.md` (raíz del monorepo).
 */
import React, { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PressableFeedback } from 'heroui-native';
import SongDisplay from '@/components/SongDisplay';
import ChordGrid, { type ChordRef } from '@/components/song-editor/ChordGrid';
import ChordPickerSheet from '@/components/song-editor/ChordPickerSheet';
import NewSongStart from '@/components/song-editor/NewSongStart';
import AppTextField from '@/components/ui/AppTextField';
import EmptyState from '@/components/ui/EmptyState';
import SegmentedControl from '@/components/ui/SegmentedControl';
import { MaterialIcons } from '@/components/ui/icons';
import { KeyPillColors, SwipeColors, themeColors } from '@/constants/colors';
import spacing from '@/constants/spacing';
import typography from '@/constants/typography';
import { radii } from '@/constants/uiStyles';
import { useToast } from '@/contexts/AppToastContext';
import { useSettings } from '@/contexts/SettingsContext';
import { useAdminStatus } from '@/hooks/useAdminStatus';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useFirebaseData } from '@/hooks/useFirebaseData';
import { useRepeatPress } from '@/hooks/useRepeatPress';
import { useSongProcessor } from '@/hooks/useSongProcessor';
import {
  EditorApiError,
  createSong,
  fetchEditorStatus,
  saveSongEdition,
  type EditorStatus,
} from '@/services/songEditorService';
import { cantoralHeaderTint } from '@/utils/cantoralHeader';
import { convertChord } from '@/utils/chordNotation';
import { confirmAsync } from '@/utils/confirmDialog';
import type { SongEntry, SongsData } from '@/utils/filterSongsData';
import { h } from '@/utils/haptics';
import { logger } from '@/utils/logger';
import {
  addChord,
  buildEdition,
  chordsUsed,
  cleanLinks,
  composeSongContent,
  moveChord,
  parseEditorLine,
  removeChord,
  renameChord,
  serializeEditorLine,
  splitSongHeader,
  type MediaLink,
  type SongSnapshot,
} from '@/utils/songEditor';
import { cleanSongTitle } from '@/utils/songUtils';
import { toYouTubeEmbedUrl } from '@/utils/youtube';

type Tab = 'chords' | 'text' | 'data' | 'preview';
const TABS = [
  { value: 'chords' as const, label: 'Acordes' },
  { value: 'text' as const, label: 'Texto' },
  { value: 'data' as const, label: 'Datos' },
  { value: 'preview' as const, label: 'Vista' },
];

const MONO = Platform.select({
  ios: 'Menlo',
  android: 'monospace',
  default: 'ui-monospace, Menlo, Consolas, monospace',
});

const EMPTY: SongSnapshot = {
  title: '',
  author: '',
  key: '',
  capo: 0,
  info: '',
  content: '',
  album: '',
  source: '',
  rhythm: '',
  liturgicalTime: '',
  videoEmbed: '',
  youtubeLinks: [],
  audioLinks: [],
};

function snapshotOf(song: SongEntry): SongSnapshot {
  return {
    title: song.title ?? '',
    author: song.author ?? '',
    key: song.key ?? '',
    capo: Number(song.capo) || 0,
    info: song.info ?? '',
    content: song.content ?? '',
    album: song.album ?? '',
    source: song.source ?? '',
    rhythm: song.rhythm ?? '',
    liturgicalTime: song.liturgicalTime ?? '',
    videoEmbed: song.videoEmbed ?? '',
    youtubeLinks: cleanLinks(song.youtubeLinks),
    audioLinks: cleanLinks(song.audioLinks),
  };
}

export default function SongEditorScreen() {
  const params = useLocalSearchParams<{
    filename?: string;
    firebaseCategory?: string;
    nueva?: string;
  }>();
  const isNew = params.nueva === '1';
  const navigation = useNavigation();
  const isDark = useColorScheme() === 'dark';
  const theme = themeColors(isDark);
  const insets = useSafeAreaInsets();
  const { toast } = useToast();
  const { settings } = useSettings();
  const notation = settings.notation;
  const admin = useAdminStatus();

  const { data } = useFirebaseData<SongsData>('songs', 'songs');
  const original = useMemo<SongSnapshot | null>(() => {
    if (isNew) return EMPTY;
    const cat = params.firebaseCategory
      ? data?.[params.firebaseCategory]
      : undefined;
    const song = cat?.songs?.find((s) => s?.filename === params.filename);
    return song ? snapshotOf(song) : null;
  }, [data, params.firebaseCategory, params.filename, isNew]);

  // El borrador nace de la canción la primera vez que llega y ya no se pisa
  // (si otro la cambia mientras tanto, manda lo que hay en pantalla).
  const [draft, setDraft] = useState<SongSnapshot | null>(null);
  const [body, setBody] = useState('');
  const [started, setStarted] = useState(!isNew);
  if (draft === null && original) {
    setDraft(original);
    setBody(splitSongHeader(original.content).body);
  }

  const [tab, setTab] = useState<Tab>('chords');
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<ChordRef | null>(null);
  const [picker, setPicker] = useState<
    | { mode: 'add'; line: number; pos: number }
    | { mode: 'rename'; ref: ChordRef }
    | null
  >(null);
  const [status, setStatus] = useState<EditorStatus | null>(null);
  const [category, setCategory] = useState<string | null>(null);

  useEffect(() => {
    if (!admin.isAdmin) return;
    let alive = true;
    void fetchEditorStatus().then((s) => alive && setStatus(s));
    return () => {
      alive = false;
    };
  }, [admin.isAdmin]);

  const current = useMemo<SongSnapshot | null>(() => {
    if (!draft) return null;
    return {
      ...draft,
      title: draft.title.trim(),
      videoEmbed: toYouTubeEmbedUrl(draft.videoEmbed),
      content: composeSongContent(draft, body),
    };
  }, [draft, body]);

  const edition = useMemo(() => {
    if (!original || !current || isNew) return null;
    // El contenido se compara ya recompuesto, para que quitar un salto de
    // línea de la cabecera no cuente como cambio.
    const before = {
      ...original,
      content: composeSongContent(
        original,
        splitSongHeader(original.content).body,
      ),
    };
    const out = buildEdition(before, current);
    if ('contentNew' in out.changes) out.changes.contentOld = original.content;
    return out;
  }, [original, current, isNew]);
  const dirty = isNew
    ? started && body.trim().length > 0
    : !!edition && Object.keys(edition.changes).length > 0;

  const used = useMemo(() => chordsUsed(body), [body]);

  const save = async () => {
    if (!current || saving) return;
    if (!current.title) {
      setTab('data');
      toast.show({ variant: 'danger', label: 'Falta el título' });
      return;
    }
    setSaving(true);
    try {
      if (isNew) {
        if (!category) {
          setTab('data');
          toast.show({ variant: 'danger', label: 'Elige la categoría' });
          return;
        }
        const res = await createSong({
          category,
          title: current.title,
          artist: current.author,
          key: current.key,
          capo: current.capo,
          content: current.content,
        });
        h.formSuccess();
        toast.show({
          variant: 'success',
          label: res.pushed
            ? 'Canción creada. Aparecerá en el cantoral en un par de minutos'
            : 'Canción guardada en el cantoral. Falta subirla desde el admin',
        });
      } else {
        if (!edition || !params.filename || !params.firebaseCategory) return;
        const res = await saveSongEdition({
          filename: params.filename,
          category: params.firebaseCategory,
          changes: edition.changes,
          fields: edition.fields,
        });
        h.formSuccess();
        toast.show({
          variant: 'success',
          label:
            res.where === 'repo'
              ? 'Guardado en el cantoral'
              : 'Guardado. Llegará al cantoral en unas horas',
        });
      }
      router.back();
    } catch (e) {
      logger.error('song editor: save', e);
      toast.show({
        variant: 'danger',
        label:
          e instanceof EditorApiError || e instanceof Error
            ? e.message
            : 'No se ha podido guardar',
      });
    } finally {
      setSaving(false);
    }
  };

  const close = async () => {
    if (dirty) {
      const ok = await confirmAsync({
        title: '¿Salir sin guardar?',
        message: 'Se perderán los cambios de esta canción.',
        confirmLabel: 'Salir',
        destructive: true,
      });
      if (!ok) return;
    }
    router.back();
  };

  useLayoutEffect(() => {
    const tint = cantoralHeaderTint(isDark);
    navigation.setOptions({
      title: isNew ? 'Nueva canción' : 'Editar canción',
      headerLeft: () => (
        <PressableFeedback
          onPress={() => void close()}
          hitSlop={10}
          style={styles.headerBtn}
          accessibilityRole="button"
          accessibilityLabel="Cerrar"
        >
          <MaterialIcons name="close" size={24} color={tint} />
        </PressableFeedback>
      ),
      headerRight: () =>
        saving ? (
          <ActivityIndicator color={tint} />
        ) : (
          <PressableFeedback
            onPress={() => void save()}
            isDisabled={!dirty}
            hitSlop={10}
            style={[styles.headerBtn, !dirty && styles.disabled]}
            accessibilityRole="button"
            accessibilityLabel="Guardar"
          >
            <Text style={[styles.headerSave, { color: tint }]}>Guardar</Text>
          </PressableFeedback>
        ),
    });
    // `save` y `close` leen el estado de este render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigation, isDark, dirty, saving, isNew, current, edition, category]);

  // ── Acorde seleccionado ──
  const lines = useMemo(() => body.split('\n'), [body]);
  const selLine = selected ? parseEditorLine(lines[selected.line] ?? '') : null;
  const selChord =
    selected && selLine?.kind === 'lyrics'
      ? selLine.chords[selected.index]
      : undefined;

  const editLine = (
    lineIndex: number,
    fn: (
      line: Extract<ReturnType<typeof parseEditorLine>, { kind: 'lyrics' }>,
    ) => ReturnType<typeof parseEditorLine>,
  ) => {
    const parsed = parseEditorLine(lines[lineIndex] ?? '');
    if (parsed.kind !== 'lyrics') return;
    const out = lines.slice();
    out[lineIndex] = serializeEditorLine(fn(parsed));
    setBody(out.join('\n'));
  };

  const nudge = (delta: number) => () => {
    if (!selected || !selChord || selLine?.kind !== 'lyrics') return false;
    const next = selChord.pos + delta;
    if (next < 0 || next > selLine.lyrics.length) {
      h.limit();
      return false;
    }
    h.select();
    editLine(selected.line, (l) => moveChord(l, selected.index, next));
    return true;
  };
  const left = useRepeatPress(nudge(-1), { intervalMs: 70 });
  const right = useRepeatPress(nudge(1), { intervalMs: 70 });

  // ── Vista previa ──
  const preview = useSongProcessor({
    originalChordPro: tab === 'preview' && current ? current.content : null,
    currentTranspose: 0,
    chordsVisible: true,
    currentFontSizeEm: settings.fontSize,
    currentFontFamily: settings.fontFamily,
    notation,
    author: current?.author,
    key: current?.key,
    capo: current?.capo,
    isDark,
  });

  if (!admin.loading && !admin.isAdmin) {
    return (
      <EmptyState
        icon="lock"
        title="Solo para quien cuida el cantoral"
        subtitle="Para editar canciones hace falta una cuenta de administrador."
      />
    );
  }
  if (!draft) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <ActivityIndicator color={theme.link} />
      </View>
    );
  }

  if (isNew && !started) {
    return (
      <NewSongStart
        status={status}
        onReady={(title, cho, cat) => {
          const split = splitSongHeader(cho);
          const parsedTitle =
            split.header
              .map((l) => l.match(/\{\s*(?:title|t)\s*:\s*(.*?)\s*\}/i)?.[1])
              .find(Boolean) ?? title;
          const get = (name: string) =>
            split.header
              .map(
                (l) =>
                  l.match(
                    new RegExp(`\\{\\s*${name}\\s*:\\s*(.*?)\\s*\\}`, 'i'),
                  )?.[1],
              )
              .find(Boolean) ?? '';
          setDraft({
            ...EMPTY,
            title: parsedTitle,
            author: get('(?:artist|author)'),
            key: get('key'),
            capo: Number(get('capo')) || 0,
          });
          setBody(split.body);
          if (cat) {
            const hit = status?.categories.find(
              (c) => c.title === cat || c.key === cat || c.letter === cat,
            );
            if (hit) setCategory(hit.key);
          }
          setStarted(true);
          setTab(cho.trim() ? 'chords' : 'text');
        }}
      />
    );
  }

  const set = <K extends keyof SongSnapshot>(k: K, v: SongSnapshot[K]) =>
    setDraft((d) => (d ? { ...d, [k]: v } : d));

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: theme.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.tabs}>
        <SegmentedControl
          options={TABS}
          value={tab}
          onChange={(t) => {
            setSelected(null);
            setTab(t);
          }}
          accentColor={theme.link}
          accessibilityLabel="Qué editar"
        />
      </View>

      {tab === 'preview' ? (
        <SongDisplay
          songHtml={preview.songHtml}
          isLoading={preview.isLoadingSong}
          styleState={preview.styleState}
          docKey="editor-preview"
          fullBleed
          topInset={0}
        />
      ) : (
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[
            styles.content,
            { paddingBottom: insets.bottom + spacing.xl * 3 },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          {tab === 'chords' &&
            (body.trim() ? (
              <>
                <Text style={[styles.hint, { color: theme.textSecondary }]}>
                  Toca la letra para poner un acorde. Arrastra un acorde para
                  moverlo.
                </Text>
                <ChordGrid
                  body={body}
                  onChange={setBody}
                  notation={notation}
                  selected={selected}
                  onSelect={setSelected}
                  onAddAt={(line, pos) => setPicker({ mode: 'add', line, pos })}
                />
              </>
            ) : (
              <EmptyState
                icon="notes"
                title="Aún no hay letra"
                subtitle="Escríbela o pégala en Texto."
                actionLabel="Ir a Texto"
                onAction={() => setTab('text')}
                accentColor={theme.link}
              />
            ))}

          {tab === 'text' && (
            <>
              <View style={styles.helpers}>
                <Helper
                  label="Estribillo"
                  onPress={() =>
                    setBody((b) => `${b.trimEnd()}\n\n{soc}\n\n{eoc}\n`)
                  }
                />
                <Helper
                  label="Repite estribillo"
                  onPress={() => setBody((b) => `${b.trimEnd()}\n\n{chorus}\n`)}
                />
                <Helper
                  label="Nota"
                  onPress={() =>
                    setBody((b) => `${b.trimEnd()}\n{comment: }\n`)
                  }
                />
              </View>
              <TextInput
                value={body}
                onChangeText={setBody}
                multiline
                autoCapitalize="sentences"
                autoCorrect={false}
                spellCheck={false}
                scrollEnabled={false}
                placeholder={'[Do]Letra con los a[Sol]cordes entre corchetes'}
                placeholderTextColor={theme.textMuted}
                style={[
                  styles.textArea,
                  {
                    color: theme.text,
                    backgroundColor: theme.backgroundSunken,
                  },
                ]}
                accessibilityLabel="Letra y acordes en ChordPro"
              />
            </>
          )}

          {tab === 'data' && (
            <View style={styles.form}>
              <Field label="Título">
                <AppTextField
                  value={draft.title}
                  onChangeText={(v) => set('title', v)}
                  accentColor={theme.link}
                  error={!draft.title.trim()}
                />
              </Field>
              <Field label="Autor">
                <AppTextField
                  value={draft.author}
                  onChangeText={(v) => set('author', v)}
                  accentColor={theme.link}
                />
              </Field>
              <View style={styles.pair}>
                <Field label="Tono" style={styles.flex}>
                  <AppTextField
                    value={draft.key}
                    onChangeText={(v) => set('key', v)}
                    placeholder="C, Am, F#m…"
                    autoCapitalize="characters"
                    autoCorrect={false}
                    accentColor={theme.link}
                  />
                </Field>
                <Field label="Cejilla">
                  <View style={styles.stepper}>
                    <StepBtn
                      icon="remove"
                      label="Menos cejilla"
                      onPress={() => set('capo', Math.max(0, draft.capo - 1))}
                    />
                    <Text style={[styles.capo, { color: theme.text }]}>
                      {draft.capo || '—'}
                    </Text>
                    <StepBtn
                      icon="add"
                      label="Más cejilla"
                      onPress={() => set('capo', Math.min(11, draft.capo + 1))}
                    />
                  </View>
                </Field>
              </View>
              {isNew && (
                <Field label="Categoría">
                  {status?.categories.length ? (
                    <View style={styles.cats}>
                      {status.categories.map((c) => {
                        const on = c.key === category;
                        return (
                          <PressableFeedback
                            key={c.key}
                            onPress={() => {
                              h.select();
                              setCategory(c.key);
                            }}
                            style={[
                              styles.cat,
                              {
                                backgroundColor: on
                                  ? theme.link
                                  : theme.backgroundSunken,
                              },
                            ]}
                            accessibilityRole="radio"
                            accessibilityState={{ selected: on }}
                          >
                            <Text
                              style={[
                                styles.catText,
                                { color: on ? theme.background : theme.text },
                              ]}
                            >
                              {cleanSongTitle(c.title)}
                            </Text>
                          </PressableFeedback>
                        );
                      })}
                    </View>
                  ) : (
                    <Text style={[styles.hint, { color: theme.textSecondary }]}>
                      El cantoral no contesta: no se puede crear ahora.
                    </Text>
                  )}
                </Field>
              )}
              <Field label="Nota de la canción">
                <AppTextField
                  value={draft.info}
                  onChangeText={(v) => set('info', v)}
                  multiline
                  accentColor={theme.link}
                />
              </Field>

              {!isNew && (
                <>
                  <Text
                    style={[styles.section, { color: theme.textSecondary }]}
                  >
                    Ficha y multimedia
                  </Text>
                  <Field label="Álbum">
                    <AppTextField
                      value={draft.album}
                      onChangeText={(v) => set('album', v)}
                      accentColor={theme.link}
                    />
                  </Field>
                  <View style={styles.pair}>
                    <Field label="Ritmo" style={styles.flex}>
                      <AppTextField
                        value={draft.rhythm}
                        onChangeText={(v) => set('rhythm', v)}
                        placeholder="4x4"
                        accentColor={theme.link}
                      />
                    </Field>
                    <Field label="Tiempo litúrgico" style={styles.flex}>
                      <AppTextField
                        value={draft.liturgicalTime}
                        onChangeText={(v) => set('liturgicalTime', v)}
                        accentColor={theme.link}
                      />
                    </Field>
                  </View>
                  <Field label="Fuente">
                    <AppTextField
                      value={draft.source}
                      onChangeText={(v) => set('source', v)}
                      autoCapitalize="none"
                      accentColor={theme.link}
                    />
                  </Field>
                  <Field label="Vídeo principal (YouTube)">
                    <AppTextField
                      value={draft.videoEmbed}
                      onChangeText={(v) => set('videoEmbed', v)}
                      autoCapitalize="none"
                      autoCorrect={false}
                      keyboardType="url"
                      accentColor={theme.link}
                    />
                  </Field>
                  <Links
                    title="Más vídeos"
                    links={draft.youtubeLinks}
                    onChange={(v) => set('youtubeLinks', v)}
                  />
                  <Links
                    title="Audios"
                    links={draft.audioLinks}
                    onChange={(v) => set('audioLinks', v)}
                  />
                </>
              )}
            </View>
          )}
        </ScrollView>
      )}

      {/* Barra del acorde seleccionado. */}
      {tab === 'chords' && selected && selChord && (
        <View
          style={[
            styles.bar,
            {
              backgroundColor: theme.card,
              borderTopColor: theme.separator,
              paddingBottom: insets.bottom + spacing.sm,
            },
          ]}
        >
          <View
            style={[
              styles.barChord,
              {
                backgroundColor: isDark
                  ? KeyPillColors.bgDark
                  : KeyPillColors.bgLight,
              },
            ]}
          >
            <Text style={[styles.barChordText, { color: theme.link }]}>
              {convertChord(selChord.name, notation)}
            </Text>
          </View>
          <PressableFeedback
            {...left}
            style={styles.barBtn}
            accessibilityRole="button"
            accessibilityLabel="Mover una letra a la izquierda"
          >
            <MaterialIcons name="chevron-left" size={28} color={theme.text} />
          </PressableFeedback>
          <PressableFeedback
            {...right}
            style={styles.barBtn}
            accessibilityRole="button"
            accessibilityLabel="Mover una letra a la derecha"
          >
            <MaterialIcons name="chevron-right" size={28} color={theme.text} />
          </PressableFeedback>
          <View style={styles.flex} />
          <PressableFeedback
            onPress={() => setPicker({ mode: 'rename', ref: selected })}
            style={styles.barBtn}
            accessibilityRole="button"
            accessibilityLabel="Cambiar el acorde"
          >
            <MaterialIcons name="edit" size={22} color={theme.link} />
          </PressableFeedback>
          <PressableFeedback
            onPress={() => {
              h.remove();
              editLine(selected.line, (l) => removeChord(l, selected.index));
              setSelected(null);
            }}
            style={styles.barBtn}
            accessibilityRole="button"
            accessibilityLabel="Quitar el acorde"
          >
            <MaterialIcons
              name="delete-outline"
              size={24}
              color={SwipeColors.remove}
            />
          </PressableFeedback>
        </View>
      )}

      <ChordPickerSheet
        visible={picker !== null}
        onClose={() => setPicker(null)}
        used={used}
        notation={notation}
        current={picker?.mode === 'rename' ? selChord?.name : undefined}
        onPick={(chord) => {
          if (!picker || !chord) return;
          if (picker.mode === 'add') {
            const p = picker;
            editLine(p.line, (l) => addChord(l, p.pos, chord));
            h.add();
          } else {
            const r = picker.ref;
            editLine(r.line, (l) => renameChord(l, r.index, chord));
          }
          setPicker(null);
        }}
      />
    </KeyboardAvoidingView>
  );
}

function Field({
  label,
  children,
  style,
}: {
  label: string;
  children: React.ReactNode;
  style?: object;
}) {
  const theme = themeColors(useColorScheme() === 'dark');
  return (
    <View style={[styles.field, style]}>
      <Text style={[styles.label, { color: theme.textSecondary }]}>
        {label}
      </Text>
      {children}
    </View>
  );
}

function StepBtn({
  icon,
  label,
  onPress,
}: {
  icon: 'add' | 'remove';
  label: string;
  onPress: () => void;
}) {
  const theme = themeColors(useColorScheme() === 'dark');
  return (
    <PressableFeedback
      onPress={() => {
        h.select();
        onPress();
      }}
      style={[styles.stepBtn, { backgroundColor: theme.backgroundSunken }]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <MaterialIcons name={icon} size={20} color={theme.text} />
    </PressableFeedback>
  );
}

function Helper({ label, onPress }: { label: string; onPress: () => void }) {
  const theme = themeColors(useColorScheme() === 'dark');
  return (
    <PressableFeedback
      onPress={() => {
        h.tap();
        onPress();
      }}
      style={[styles.helper, { backgroundColor: theme.backgroundSunken }]}
      accessibilityRole="button"
      accessibilityLabel={`Añadir ${label}`}
    >
      <MaterialIcons name="add" size={16} color={theme.link} />
      <Text style={[styles.helperText, { color: theme.link }]}>{label}</Text>
    </PressableFeedback>
  );
}

function Links({
  title,
  links,
  onChange,
}: {
  title: string;
  links: MediaLink[];
  onChange: (links: MediaLink[]) => void;
}) {
  const theme = themeColors(useColorScheme() === 'dark');
  const edit = (i: number, patch: Partial<MediaLink>) =>
    onChange(links.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: theme.textSecondary }]}>
        {title}
      </Text>
      {links.map((l, i) => (
        <View key={i} style={styles.linkRow}>
          <View style={styles.linkFields}>
            <AppTextField
              value={l.label}
              onChangeText={(v) => edit(i, { label: v })}
              placeholder="Nombre"
              accentColor={theme.link}
            />
            <AppTextField
              value={l.url}
              onChangeText={(v) => edit(i, { url: v })}
              placeholder="https://…"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              accentColor={theme.link}
            />
          </View>
          <PressableFeedback
            onPress={() => onChange(links.filter((_, j) => j !== i))}
            style={styles.barBtn}
            accessibilityRole="button"
            accessibilityLabel={`Quitar ${l.label || 'enlace'}`}
          >
            <MaterialIcons
              name="remove-circle-outline"
              size={22}
              color={SwipeColors.remove}
            />
          </PressableFeedback>
        </View>
      ))}
      <Helper
        label="Enlace"
        onPress={() => onChange([...links, { label: '', url: '' }])}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  headerBtn: { padding: spacing.xs },
  headerSave: { ...typography.title, fontWeight: '700' },
  disabled: { opacity: 0.35 },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  content: { padding: spacing.md, gap: spacing.md },
  hint: { ...typography.caption },
  helpers: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  helper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 36,
    paddingHorizontal: spacing.md - spacing.xs,
    borderRadius: radii.xl,
    alignSelf: 'flex-start',
  },
  helperText: { ...typography.caption, fontWeight: '600' },
  textArea: {
    fontFamily: MONO,
    fontSize: 15,
    lineHeight: 24,
    minHeight: 320,
    padding: spacing.md,
    borderRadius: radii.md,
    textAlignVertical: 'top',
  },
  form: { gap: spacing.md },
  field: { gap: spacing.xs },
  label: { ...typography.caption, fontWeight: '600' },
  pair: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  stepBtn: {
    width: 44,
    height: 44,
    borderRadius: radii.pillFull,
    alignItems: 'center',
    justifyContent: 'center',
  },
  capo: {
    ...typography.h3,
    minWidth: 28,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  cats: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  cat: {
    minHeight: 36,
    paddingHorizontal: spacing.md - spacing.xs,
    borderRadius: radii.xl,
    justifyContent: 'center',
  },
  catText: { ...typography.caption, fontWeight: '600' },
  section: { ...typography.sectionLabel, marginTop: spacing.md },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  linkFields: { flex: 1, gap: spacing.xs },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  barChord: {
    minWidth: 56,
    height: 44,
    paddingHorizontal: spacing.md - spacing.xs,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  barChordText: { ...typography.title, fontWeight: '700' },
  barBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
