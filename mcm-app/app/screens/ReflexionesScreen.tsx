/**
 * Compartiendo: el muro de reflexiones de un evento.
 *
 *   ┌ ScreenHero «Compartiendo» (kicker: el evento)
 *   ├ Escenario: el muro en vivo (cita que pasa, quién ha escrito, historias)
 *   ├ Invitación a escribir (+ arranques)
 *   └ El muro, por días: carteles (frases cortas, en color) y notas
 *
 * Escribir abre el compositor a pantalla completa (`ReflexionComposer`);
 * tocar una tarjeta, el modo historias (`ReflexionStories`). El «+» del grupo
 * flotante de arriba llega por `utils/reflexionesComposerRequests.ts`.
 *
 * Datos: `<evento>/compartiendo` `{ updatedAt, data }`, sin login. El modelo
 * está en `utils/reflexiones.ts`; la doc, en
 * `docs/funcionalidades/COMPARTIENDO.md` (raíz del monorepo).
 */
import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import {
  useFocusEffect,
  useIsFocused,
  useRoute,
  type RouteProp,
} from 'expo-router/react-navigation';
import { getDatabase, push, ref, update } from 'firebase/database';
import { logger } from '@/utils/logger';
import { useToast } from '@/contexts/AppToastContext';
import { shareText } from '@/utils/shareText';
import ContextMenuSheet from '@/components/ContextMenuSheet';
import CelebrationBurst from '@/components/ui/CelebrationBurst';
import EmptyState from '@/components/ui/EmptyState';
import PageContainer from '@/components/ui/PageContainer';
import ScreenHero from '@/components/ui/ScreenHero';
import ReflexionCard from '@/components/reflexiones/ReflexionCard';
import ReflexionesStage, {
  type StageQuote,
} from '@/components/reflexiones/ReflexionesStage';
import ComposerPrompt from '@/components/reflexiones/ComposerPrompt';
import ReflexionComposer from '@/components/reflexiones/ReflexionComposer';
import ReflexionStories, {
  type StoryItem,
} from '@/components/reflexiones/ReflexionStories';
import { useColorScheme } from '@/hooks/useColorScheme';
import { themeColors } from '@/constants/colors';
import spacing from '@/constants/spacing';
import typography from '@/constants/typography';
import {
  revalidateNode,
  useFirebaseData,
  withRetry,
} from '@/hooks/useFirebaseData';
import { useCurrentEvent } from '@/hooks/useCurrentEvent';
import { useTabBarPaddingBottom } from '@/hooks/useTabBarClearance';
import { getEventCacheKey, getEventFirebasePath } from '@/constants/events';
import { getFirebaseApp } from '@/utils/firebaseApp';
import { h } from '@/utils/haptics';
import { localISO } from '@/utils/localDate';
import { readableOn } from '@/utils/colorUtils';
import { onReflexionComposerRequest } from '@/utils/reflexionesComposerRequests';
import {
  buildReflexionUpdate,
  composerDays,
  createdAtOf,
  dayLabel,
  dayOf,
  groupByDay,
  newReflexion,
  normalizeReflexiones,
  REFLEXION_TONES,
  reflexionTone,
  relativeTime,
  sortReflexiones,
  toneColor,
  wallStats,
  type Reflexion,
  type ReflexionTone,
} from '@/utils/reflexiones';
import { useUserProfile } from '@/contexts/UserProfileContext';
import { useResolvedProfileConfig } from '@/hooks/useResolvedProfileConfig';
import type { EventStackParamList } from './eventStackScreens';

interface Grupo {
  nombre: string;
  subtitulo?: string;
}

/** Cada cuánto se pregunta a Firebase si hay reflexiones nuevas (solo
 *  `updatedAt`: si nada cambió, no se descarga nada). */
const REFRESH_MS = 20_000;
/** Cuántas reflexiones pasan por el escenario. */
const STAGE_QUOTES = 8;

type Row =
  | { kind: 'day'; key: string; label: string; count: number }
  | { kind: 'card'; key: string; r: Reflexion; index: number };

/** Un tono al azar para el borrador nuevo (que no todos empiecen en azul). */
const randomTone = (): ReflexionTone =>
  REFLEXION_TONES[Math.floor(Math.random() * REFLEXION_TONES.length)];

export default function ReflexionesScreen() {
  const isDark = useColorScheme() === 'dark';
  const roles = themeColors(isDark);
  const route = useRoute<RouteProp<EventStackParamList, 'Reflexiones'>>();
  const { profile } = useUserProfile();
  const resolved = useResolvedProfileConfig();
  const { toast } = useToast();
  const isFocused = useIsFocused();
  const bottomPad = useTabBarPaddingBottom(spacing.xl);

  const event = useCurrentEvent();
  const tint = event.tintColor;
  const compartiendoPath = getEventFirebasePath(event, 'compartiendo');
  const compartiendoKey = getEventCacheKey(event, 'compartiendo');
  const {
    data: rawData,
    loading,
    refresh,
  } = useFirebaseData<unknown>(compartiendoPath, compartiendoKey);
  const { data: gruposData } = useFirebaseData<Record<string, Grupo[]>>(
    getEventFirebasePath(event, 'grupos'),
    getEventCacheKey(event, 'grupos'),
  );

  const grupos = useMemo(() => gruposData?.['Conso+'] ?? [], [gruposData]);
  const authorOf = useCallback(
    (r: Reflexion) => {
      if (!r.grupal) return r.autor ?? '';
      const g = grupos.find((gr) => gr.nombre === r.grupo);
      if (!g) return r.grupo ?? '';
      return g.subtitulo ? `${g.nombre} · ${g.subtitulo}` : g.nombre;
    },
    [grupos],
  );

  // ── La lista ──
  const remoteList = useMemo(() => normalizeReflexiones(rawData), [rawData]);
  // Lo recién publicado se pinta al instante, sin esperar a que Firebase
  // devuelva la lista con ello dentro (se casan por id).
  const [justPublished, setJustPublished] = useState<Reflexion[]>([]);
  const sorted = useMemo(() => {
    const remoteIds = new Set(remoteList.map((r) => r.id));
    const pending = justPublished.filter((r) => !remoteIds.has(r.id));
    return sortReflexiones([...pending, ...remoteList]);
  }, [justPublished, remoteList]);

  // Lo que había al abrir NO se anima; lo que llega después, sí (y solo eso).
  const [baseline, setBaseline] = useState<Set<string> | null>(null);
  if (baseline === null && (!loading || sorted.length > 0)) {
    setBaseline(new Set(sorted.map((r) => r.id)));
  }

  // ── El reloj (tiempos relativos) y la sincronización mientras se mira ──
  const [now, setNow] = useState(() => Date.now());

  // ── Borrador ──
  const defaultAuthor = [profile.name.trim(), resolved.delegationLabel.trim()]
    .filter(Boolean)
    .join(' · ');
  const [composerOpen, setComposerOpen] = useState(
    () => String(route.params?.openComposer ?? '') === '1',
  );
  const [draftText, setDraftText] = useState('');
  const [draftTone, setDraftTone] = useState<ReflexionTone>(randomTone);
  const [draftAuthor, setDraftAuthor] = useState(defaultAuthor);
  const [draftDay, setDraftDay] = useState(() => localISO());
  const [saving, setSaving] = useState(false);
  const [celebrate, setCelebrate] = useState(false);

  // La firma sale del perfil; si el perfil cambia, se re-siembra (ajuste
  // durante el render, el patrón de React para «estado que sigue a una prop»).
  const [lastDefaultAuthor, setLastDefaultAuthor] = useState(defaultAuthor);
  if (defaultAuthor !== lastDefaultAuthor) {
    setLastDefaultAuthor(defaultAuthor);
    setDraftAuthor(defaultAuthor);
  }

  const days = useMemo(() => composerDays(new Date(now)), [now]);

  const openComposer = useCallback(
    (seed?: string) => {
      h.tap();
      if (seed) setDraftText((t) => (t.trim() ? t : seed));
      // Pasada la medianoche, el día elegido puede haberse salido de la lista
      // (hoy, ayer, anteayer): entonces vuelve a «hoy».
      setDraftDay((d) => {
        const valid = composerDays().map((x) => x.iso);
        return valid.includes(d) ? d : valid[0];
      });
      setComposerOpen(true);
    },
    [setDraftText, setDraftDay, setComposerOpen],
  );

  // Al montar, `useFirebaseData` ya pregunta: el primer foco no repite.
  const focusedOnce = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (focusedOnce.current) {
        setNow(Date.now());
        refresh();
      }
      focusedOnce.current = true;
      const tick = setInterval(() => {
        setNow(Date.now());
        refresh();
      }, REFRESH_MS);
      // El «+» de arriba: solo escucha la pantalla que se está viendo.
      const off = onReflexionComposerRequest(() => openComposer());
      return () => {
        clearInterval(tick);
        off();
      };
    }, [refresh, openComposer]),
  );

  const [refreshing, setRefreshing] = useState(false);
  const onPullRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setNow(Date.now());
    setRefreshing(false);
  }, [refresh]);

  // ── Publicar ──
  const [composerError, setComposerError] = useState<string | null>(null);
  const listRef = useRef<FlatList<Row>>(null);
  const publish = async () => {
    if (!draftText.trim() || saving) return;
    setSaving(true);
    setComposerError(null);
    const nuevo = newReflexion({
      contenido: draftText,
      fecha: draftDay,
      autor: draftAuthor,
      tono: draftTone,
      now: Date.now(),
    });
    try {
      const db = getDatabase(getFirebaseApp());
      const newRef = push(ref(db, `${compartiendoPath}/data`));
      if (!newRef.key) throw new Error('push() sin key');
      // Un único update() multi-path: data/<key> + updatedAt a la vez (si
      // fuesen dos escrituras y fallase la segunda, la reflexión quedaría
      // invisible para el resto). Reintentarlo es idempotente: la key ya
      // está generada.
      const payload = buildReflexionUpdate(newRef.key, nuevo, Date.now());
      await withRetry(() => update(ref(db, compartiendoPath), payload), {
        op: 'write',
        path: compartiendoPath,
      });
      setJustPublished((prev) => [nuevo, ...prev]);
      h.formSuccess();
      setComposerOpen(false);
      setDraftText('');
      setDraftTone(randomTone());
      setCelebrate(true);
      setTimeout(() => setCelebrate(false), 1600);
      listRef.current?.scrollToOffset({ offset: 0, animated: true });
      // Que el hub (y cualquier otra pantalla con el nodo) lo vea ya.
      revalidateNode(compartiendoPath, compartiendoKey).catch(() => {});
    } catch (e) {
      logger.error('Error adding post', e);
      // El borrador se queda: en un encuentro la red falla a menudo y nadie
      // debería perder lo que ha escrito ni creer que se ha compartido.
      setComposerError('No se ha podido compartir. Revisa la conexión.');
    }
    setSaving(false);
  };

  // ── Vistas derivadas ──
  const todayISO = localISO(new Date(now));
  const whenOf = useCallback(
    (r: Reflexion) => {
      const rel =
        dayOf(r) === todayISO ? relativeTime(createdAtOf(r), now) : null;
      return rel ?? dayLabel(dayOf(r), todayISO).toLowerCase();
    },
    [now, todayISO],
  );

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    let index = 0;
    for (const g of groupByDay(sorted)) {
      out.push({
        kind: 'day',
        key: `day-${g.day}`,
        label: dayLabel(g.day, todayISO),
        count: g.items.length,
      });
      for (const r of g.items) {
        out.push({ kind: 'card', key: r.id, r, index: index++ });
      }
    }
    return out;
  }, [sorted, todayISO]);

  const stats = useMemo(() => wallStats(sorted, authorOf), [sorted, authorOf]);
  const quotes = useMemo<StageQuote[]>(
    () =>
      sorted.slice(0, STAGE_QUOTES).map((r) => ({
        id: r.id,
        text: r.contenido,
        author: authorOf(r),
      })),
    [sorted, authorOf],
  );
  const authorTone = useMemo(() => {
    const map = new Map<string, ReflexionTone>();
    for (const r of sorted) {
      const a = authorOf(r);
      if (a && !map.has(a)) map.set(a, reflexionTone(r));
    }
    return map;
  }, [sorted, authorOf]);
  const colorFor = useCallback(
    (name: string) => toneColor(authorTone.get(name) ?? 'primary'),
    [authorTone],
  );

  // ── Historias ──
  const [storyStart, setStoryStart] = useState<number | null>(null);
  const storyItems = useMemo<StoryItem[]>(
    () =>
      sorted.map((r) => ({
        r,
        author: authorOf(r),
        tone: reflexionTone(r),
        when: whenOf(r),
      })),
    [sorted, authorOf, whenOf],
  );

  // ── Menú de una tarjeta ──
  const [menuFor, setMenuFor] = useState<Reflexion | null>(null);
  const plainText = (r: Reflexion) => {
    const author = authorOf(r);
    return [r.titulo, r.contenido.trim(), author ? `— ${author}` : '']
      .filter(Boolean)
      .join('\n\n');
  };

  const sectionInk = readableOn(tint, roles.backgroundSunken, 4.5);

  const header = (
    <View style={styles.header}>
      <ScreenHero
        kicker={event.title}
        accentColor={sectionInk}
        title="Compartiendo"
        subtitle="Lo que nos llevamos de estos días"
        floatingHeaderInset
        style={styles.hero}
      />
      {stats.total > 0 ? (
        <ReflexionesStage
          tint={tint}
          stats={stats}
          quotes={quotes}
          now={now}
          active={isFocused && storyStart === null && !composerOpen}
          colorFor={colorFor}
          onPlay={() => {
            h.tap();
            setStoryStart(0);
          }}
          onWrite={() => openComposer()}
        />
      ) : null}
      <ComposerPrompt
        author={draftAuthor || defaultAuthor}
        tint={tint}
        isDark={isDark}
        onOpen={openComposer}
      />
    </View>
  );

  return (
    <View
      style={[styles.container, { backgroundColor: roles.backgroundSunken }]}
    >
      <PageContainer>
        <FlatList
          ref={listRef}
          data={rows}
          keyExtractor={(row) => row.key}
          ListHeaderComponent={header}
          renderItem={({ item: row }) =>
            row.kind === 'day' ? (
              <Text
                style={[styles.day, { color: roles.textSecondary }]}
                accessibilityRole="header"
              >
                {row.label}
                <Text style={{ color: roles.textMuted }}>
                  {`  ·  ${row.count}`}
                </Text>
              </Text>
            ) : (
              <ReflexionCard
                r={row.r}
                author={authorOf(row.r)}
                tone={reflexionTone(row.r)}
                isDark={isDark}
                timeLabel={whenOf(row.r)}
                isNew={baseline !== null && !baseline.has(row.r.id)}
                onPress={() => setStoryStart(row.index)}
                onLongPress={() => {
                  h.tap();
                  setMenuFor(row.r);
                }}
              />
            )
          }
          ItemSeparatorComponent={Separator}
          ListEmptyComponent={
            loading ? undefined : (
              <EmptyState
                icon="forum"
                title="Aún no hay nada compartido"
                subtitle="Estrena el muro: lo que escribas lo leerá todo el encuentro."
                actionLabel="Escribir la primera"
                onAction={() => openComposer()}
                accentColor={sectionInk}
              />
            )
          }
          contentContainerStyle={[styles.list, { paddingBottom: bottomPad }]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onPullRefresh}
              tintColor={sectionInk}
              colors={[tint]}
            />
          }
          initialNumToRender={10}
          windowSize={9}
          removeClippedSubviews={Platform.OS === 'android'}
          showsVerticalScrollIndicator={false}
        />
      </PageContainer>

      <ReflexionComposer
        visible={composerOpen}
        onClose={() => {
          setComposerOpen(false);
          setComposerError(null);
        }}
        eventTitle={event.title}
        text={draftText}
        onChangeText={setDraftText}
        tone={draftTone}
        onChangeTone={setDraftTone}
        author={draftAuthor}
        onChangeAuthor={setDraftAuthor}
        days={days}
        day={draftDay}
        onChangeDay={setDraftDay}
        saving={saving}
        error={composerError}
        onPublish={publish}
      />

      <ReflexionStories
        visible={storyStart !== null}
        onClose={() => setStoryStart(null)}
        items={storyItems}
        startIndex={storyStart ?? 0}
        eventTitle={event.title}
        tint={tint}
        onCompose={() => {
          setStoryStart(null);
          // La hoja de historias se va antes de que suba el compositor: dos
          // modales a la vez en iOS se pisan.
          setTimeout(() => openComposer(), 350);
        }}
      />

      <ContextMenuSheet
        visible={menuFor !== null}
        onClose={() => setMenuFor(null)}
        title={menuFor?.titulo || 'Reflexión'}
        actions={
          menuFor
            ? [
                {
                  key: 'open',
                  label: 'Ver a pantalla completa',
                  icon: 'fullscreen',
                  onPress: () => {
                    const i = sorted.findIndex((r) => r.id === menuFor.id);
                    setStoryStart(Math.max(0, i));
                  },
                },
                {
                  key: 'copy',
                  label: 'Copiar',
                  icon: 'content-copy',
                  onPress: async () => {
                    await Clipboard.setStringAsync(plainText(menuFor));
                    toast.show({ variant: 'success', label: 'Copiada' });
                  },
                },
                {
                  key: 'share',
                  label: 'Compartir',
                  icon: 'share',
                  onPress: () =>
                    shareText(plainText(menuFor), {
                      notify: (label) => toast.show({ label }),
                    }),
                },
              ]
            : []
        }
      />
      <CelebrationBurst visible={celebrate} emoji="💬" />
    </View>
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { gap: spacing.md, marginBottom: spacing.sm },
  hero: { paddingHorizontal: spacing.xs },
  list: { paddingHorizontal: spacing.md, paddingTop: spacing.sm },
  separator: { height: spacing.md },
  day: {
    ...typography.sectionLabel,
    marginTop: spacing.md,
    marginLeft: spacing.xs,
  },
});
