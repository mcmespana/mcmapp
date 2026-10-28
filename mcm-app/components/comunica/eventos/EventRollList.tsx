// La lista del autobús de un evento (plan 07): marcar quién está.
//
//   · Los de la delegación por etapa y curso, las otras delegaciones detrás,
//     los monitores PLEGADOS y «No van» al final, apagados y sin marcar.
//   · Chips por curso pegados arriba (tocar uno deja ese curso y vuelve
//     arriba; tocarlo otra vez lo quita) y buscador sin acentos que abre el
//     pliegue si encuentra a alguien dentro.
//   · El gesto del plan 04 (`RollRow`, `MarkSheet`): toque y pulsación larga.
//   · «Están todos» marca SOLO lo sin marcar y SOLO lo que se ve.
//   · Guardar va a la cola: funciona igual sin cobertura (el caso estrella).
//   · Con `by`, la misma lista partida por los grupos de esa pestaña (mismo
//     borrador y misma entrada en la cola: es la misma lista del día).
//
// Una sola `FlatList` (cien filas no caben en un ScrollView), con los chips
// como cabecera pegada.

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Alert,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { useNavigation, useRouter } from 'expo-router';
import { PressableFeedback } from 'heroui-native';
import EmptyState from '@/components/ui/EmptyState';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { useTabListScroll } from '@/components/tabs/useTabScroll';
import typography from '@/constants/typography';
import { radii } from '@/constants/uiStyles';
import type { EventRoll, Mark, SetMark } from '@/services/comunica/contract';
import {
  estanLabel,
  faltanLabel,
  useSaveEventRoll,
} from '@/hooks/comunica/events';
import { useOutbox } from '@/hooks/comunica/useOutbox';
import { useRollDraft } from '@/hooks/comunica/useRollDraft';
import { useTabBarClearance } from '@/hooks/useTabBarClearance';
import useNetworkStatus from '@/hooks/useNetworkStatus';
import { h } from '@/utils/haptics';
import {
  armTab,
  groupLabelsByPerson,
  tabLabel,
} from '@/utils/comunica/activityGroups';
import { longDay } from '@/utils/comunica/dates';
import {
  courseChips,
  courseSections,
  eventDraftFrom,
  eventRollQueueKey,
  eventRows,
  fillVisibleLabel,
  groupSections,
  markVisibleUnmarked,
  outRows,
  visibleRowIds,
  type EventDay,
  type EventRow,
  type ListSection,
  type OutRow,
} from '@/utils/comunica/eventRoll';
import { madridTime } from '@/utils/comunica/madrid';
import {
  countMarks,
  nextMarkOnTap,
  unmarkedLabel,
} from '@/utils/comunica/marks';
import type { RollDraft } from '@/utils/comunica/rollDraft';
import { uploadText } from '@/utils/comunica/uploadText';
import BottomActionBar, {
  BOTTOM_ACTION_BAR_SPACE,
} from '../comun/BottomActionBar';
import FilterChips from '../comun/FilterChips';
import { MarkLegend } from '../comun/MarkControl';
import PersonRow from '../comun/PersonRow';
import SearchField from '../comun/SearchField';
import StatusChip from '../comun/StatusChip';
import SyncBadge from '../comun/SyncBadge';
import UploadStatus from '../comun/UploadStatus';
import { useComunicaTheme } from '../comun/useComunicaTheme';
import ListCell, { cellPosition, type CellPosition } from '../grupos/ListCell';
import MarkSheet from '../pasar-lista/MarkSheet';
import { Count, Counts, FillButton, Notice } from '../pasar-lista/RollBits';
import RollRow from '../pasar-lista/RollRow';
import SaveRollButton from '../pasar-lista/SaveRollButton';

type Item =
  | { kind: 'head'; key: string }
  | { kind: 'tools'; key: string }
  | { kind: 'chips'; key: string }
  | { kind: 'section'; key: string; section: ListSection }
  | { kind: 'course'; key: string; title: string; count: number }
  | { kind: 'note'; key: string; text: string }
  | { kind: 'row'; key: string; row: EventRow; position: CellPosition }
  | { kind: 'out'; key: string; row: OutRow; position: CellPosition }
  | { kind: 'empty'; key: string; text: string; search: boolean }
  | { kind: 'help'; key: string };

const SEARCH_EMPTY = 'Nadie coincide con lo que buscas.';

/** Pone una marca; quitarla se lleva el motivo. */
const withMark = (d: RollDraft, id: string, mark: Mark): RollDraft => ({
  marks: { ...d.marks, [id]: mark },
  notes: mark ? d.notes : { ...d.notes, [id]: '' },
});

const sameDraft = (a: RollDraft, b: RollDraft) =>
  JSON.stringify(a.marks) === JSON.stringify(b.marks) &&
  JSON.stringify(a.notes) === JSON.stringify(b.notes);

export default function EventRollList({
  roll,
  pick,
  by,
  group,
  head,
  onRefresh,
}: {
  roll: EventRoll;
  pick: EventDay;
  by?: string;
  group?: string;
  head: React.ReactNode;
  onRefresh: () => Promise<unknown>;
}) {
  const t = useComunicaTheme();
  const router = useRouter();
  const navigation = useNavigation();
  const online = useNetworkStatus();
  const { outbox, get } = useOutbox();
  const tabClearance = useTabBarClearance();
  const [barHeight, setBarHeight] = useState<number | null>(null);
  const [sheetFor, setSheetFor] = useState<string | null>(null);
  const { listRef, onScroll, contentPaddingBottom } = useTabListScroll<
    Animated.FlatList<Item>
  >(
    'comunica',
    Math.max(BOTTOM_ACTION_BAR_SPACE, (barHeight ?? 0) - tabClearance),
  );

  const sessionId = pick.session?.id ?? null;
  const key = eventRollQueueKey(roll.event.id, sessionId, pick.day);
  const saved = useMemo(
    () => eventDraftFrom(roll, sessionId ?? `new-${pick.day}`),
    [roll, sessionId, pick.day],
  );
  const { draft, setDraft, resetTo, restored } = useRollDraft(key, saved);
  // Sin tocar nada, lo que llega del servidor (otro móvil marcó) se adopta.
  const lastSaved = useRef(saved);
  useEffect(() => {
    if (lastSaved.current === saved) return;
    if (sameDraft(draft, lastSaved.current)) resetTo(saved, false);
    lastSaved.current = saved;
  }, [saved, draft, resetTo]);

  const { save, outcome } = useSaveEventRoll({
    outbox,
    roll,
    sessionId,
    day: pick.day,
    draft,
    resetTo,
  });

  // ── Filas, secciones y chips ──
  const labels = useMemo(() => groupLabelsByPerson(roll.activity), [roll]);
  const rows = useMemo(() => eventRows(roll, labels), [roll, labels]);
  const out = useMemo(() => outRows(roll), [roll]);
  const armed = useMemo(() => (by ? armTab(roll, by) : null), [roll, by]);
  const [chip, setChip] = useState(group ?? '');
  const [query, setQuery] = useState('');
  const [monitorsOpen, setMonitorsOpen] = useState(false);
  const view = useMemo(() => {
    if (armed) return groupSections(armed, rows, out, { chip, query });
    return {
      sections: courseSections(rows, out, { chip, query, monitorsOpen }),
      chips: courseChips(rows),
      rows,
    };
  }, [armed, rows, out, chip, query, monitorsOpen]);
  const visible = useMemo(() => visibleRowIds(view.sections), [view]);
  const fill = fillVisibleLabel(draft, visible);

  const counts = countMarks(
    roll.people.map((p) => draft.marks[p.person.id] ?? null),
  );
  const dirty = !sameDraft(draft, saved);
  const queued = get(key);
  const uploading = queued && queued.status !== 'applied';
  const hasMarks = counts.came + counts.missed > 0;
  const when = pick.session
    ? `${longDay(pick.day)} · ${madridTime(pick.session.startsAt)}`
    : longDay(pick.day);

  // Salir con cambios sin guardar pregunta (el borrador se queda igual).
  useEffect(() => {
    const unsub = navigation.addListener('beforeRemove', (e) => {
      if (!dirty || pick.locked || Platform.OS === 'web') return;
      if (uploading) return;
      e.preventDefault();
      Alert.alert(
        'Tienes cambios sin guardar',
        'Se quedan en el móvil si sales.',
        [
          {
            text: 'Guardar',
            onPress: () =>
              void save().then((ok) => {
                if (ok) navigation.dispatch(e.data.action);
              }),
          },
          {
            text: 'Salir sin guardar',
            style: 'destructive',
            onPress: () => navigation.dispatch(e.data.action),
          },
        ],
      );
    });
    return unsub;
  }, [navigation, dirty, pick.locked, uploading, save]);

  // ── Marcar ──
  const onTap = useCallback(
    (id: string) => {
      h.select();
      setDraft((d) => withMark(d, id, nextMarkOnTap(d.marks[id] ?? null)));
    },
    [setDraft],
  );
  const onSet = useCallback(
    (id: string, m: SetMark) => {
      h.select();
      setDraft((d) => withMark(d, id, m));
    },
    [setDraft],
  );
  const onMore = useCallback((id: string) => {
    h.tap();
    setSheetFor(id);
  }, []);
  const sheetPerson = roll.people.find((p) => p.person.id === sheetFor) ?? null;

  const pickChip = (k: string) => {
    setChip((cur) => (cur === k ? '' : k));
    if (k === 'monitor') setMonitorsOpen(true);
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
  };

  // ── La lista, aplanada ──
  const data = useMemo((): Item[] => {
    const items: Item[] = [
      { kind: 'head', key: 'head' },
      { kind: 'tools', key: 'tools' },
    ];
    if (view.chips.length > 0) items.push({ kind: 'chips', key: 'chips' });
    if (roll.people.length === 0 && roll.notGoing.length === 0) {
      items.push({
        kind: 'empty',
        key: 'empty',
        text: 'Todavía no hay nadie inscrito en este evento.',
        search: false,
      });
    } else if (view.sections.length === 0) {
      items.push({
        kind: 'empty',
        key: 'empty-q',
        text: query
          ? SEARCH_EMPTY
          : 'Todavía no hay nadie inscrito en este evento.',
        search: !!query,
      });
    }
    for (const s of view.sections) {
      items.push({ kind: 'section', key: `s:${s.key}`, section: s });
      // Cada bloque (un curso, o la sección entera) es una superficie.
      let block: Item[] = [];
      const flush = () => {
        block.forEach((it, i) => {
          if (it.kind === 'row' || it.kind === 'out') {
            it.position = cellPosition(i, block.length);
          }
        });
        items.push(...block);
        block = [];
      };
      for (const it of s.data) {
        if (it.type === 'course') {
          flush();
          items.push({
            kind: 'course',
            key: `c:${it.key}`,
            title: it.title,
            count: it.count,
          });
        } else if (it.type === 'note') {
          flush();
          items.push({ kind: 'note', key: `n:${it.key}`, text: it.text });
        } else if (it.type === 'row') {
          block.push({
            kind: 'row',
            key: `r:${it.row.id}`,
            row: it.row,
            position: 'only',
          });
        } else {
          block.push({
            kind: 'out',
            key: `o:${it.row.id}`,
            row: it.row,
            position: 'only',
          });
        }
      }
      flush();
    }
    items.push({ kind: 'help', key: 'help' });
    return items;
  }, [view, roll.people.length, roll.notGoing.length, query]);
  const stickyIndex = data.findIndex((i) => i.kind === 'chips');

  const renderItem = ({ item }: { item: Item }) => {
    switch (item.kind) {
      case 'head':
        return (
          <View>
            {head}
            <View style={styles.block}>
              {online === false ? (
                <Notice
                  icon="exclamationmark.triangle.fill"
                  text="Sin cobertura. Puedes marcar: se guardará en el móvil."
                />
              ) : null}
              {pick.notice ? (
                <Notice
                  icon={pick.notice.tone === 'info' ? 'calendar' : 'clock'}
                  tone={pick.notice.tone}
                  text={pick.notice.text}
                />
              ) : null}
              {outcome ? (
                <View
                  style={[
                    styles.outcome,
                    {
                      backgroundColor: outcome.ok
                        ? t.chip('positive').background
                        : t.warningSoft,
                    },
                  ]}
                  accessibilityRole="alert"
                >
                  <Text style={[styles.body, { color: t.text }]}>
                    {outcome.text}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        );
      case 'tools':
        return (
          <View style={styles.block}>
            {armed ? (
              <View style={styles.byBanner}>
                <Text style={[styles.body, { color: t.text }]}>
                  Lista por {tabLabel(armed.tab).toLowerCase()}.
                </Text>
                <PressableFeedback
                  onPress={() => router.setParams({ by: '', group: '' })}
                  accessibilityRole="button"
                  hitSlop={8}
                >
                  <Text style={[styles.link, { color: t.accentText }]}>
                    Ver por cursos
                  </Text>
                </PressableFeedback>
              </View>
            ) : null}
            {roll.people.length > 0 ? (
              <SearchField
                value={query}
                onChange={setQuery}
                placeholder="Buscar por nombre…"
              />
            ) : null}
            {!pick.locked && roll.people.length > 0 ? (
              <FillButton
                label={fill.label}
                disabled={!fill.enabled}
                onPress={() => setDraft((d) => markVisibleUnmarked(d, visible))}
              />
            ) : null}
          </View>
        );
      case 'chips':
        return (
          <FilterChips
            chips={view.chips}
            value={chip}
            onChange={pickChip}
            label={armed ? 'Filtrar por grupo' : 'Filtrar por curso'}
          />
        );
      case 'section': {
        const s = item.section;
        if (s.foldable) {
          return (
            <PressableFeedback
              onPress={() => {
                h.toggle();
                setMonitorsOpen((o) => !o);
              }}
              accessibilityRole="button"
              accessibilityState={{ expanded: !!s.open }}
              accessibilityLabel={`${s.title}, ${s.count}`}
              style={[styles.sectionHead, styles.foldHead]}
            >
              <Text
                accessibilityRole="header"
                style={[styles.sectionTitle, { color: t.text }]}
              >
                {s.title}
              </Text>
              <Text style={[styles.sectionCount, { color: t.textSecondary }]}>
                {s.count}
              </Text>
              <View style={styles.flex} />
              <IconSymbol
                name={s.open ? 'chevron.up' : 'chevron.down'}
                size={18}
                color={t.textSecondary}
              />
            </PressableFeedback>
          );
        }
        return (
          <View style={styles.sectionHead}>
            <Text
              accessibilityRole="header"
              style={[
                styles.sectionTitle,
                { color: s.kind === 'notGoing' ? t.textSecondary : t.text },
              ]}
            >
              {s.title}
            </Text>
            <Text style={[styles.sectionCount, { color: t.textSecondary }]}>
              {s.count}
            </Text>
          </View>
        );
      }
      case 'course':
        return (
          <Text
            accessibilityRole="header"
            style={[styles.course, { color: t.textSecondary }]}
          >
            {item.title} · {item.count}
          </Text>
        );
      case 'note':
        return (
          <Text style={[styles.note, { color: t.warningText }]}>
            {item.text}
          </Text>
        );
      case 'row': {
        const r = item.row;
        const other = r.person.otherDelegation;
        return (
          <ListCell position={item.position}>
            <RollRow
              person={r.person.person}
              mark={draft.marks[r.id] ?? null}
              note={draft.notes[r.id] ?? ''}
              streak={0}
              line={r.line}
              lead={
                other
                  ? {
                      text: other.name,
                      color: t.chip('accent').text,
                      background: t.chip('accent').background,
                    }
                  : undefined
              }
              avatarTone={r.monitor ? 'accent' : undefined}
              disabled={pick.locked}
              onTap={onTap}
              onSet={onSet}
              onMore={onMore}
            />
          </ListCell>
        );
      }
      case 'out': {
        const r = item.row;
        return (
          <ListCell position={item.position}>
            <PersonRow
              person={r.person.person}
              subtitle={r.line || undefined}
              stateLabel={r.status}
              right={<StatusChip label={r.status} />}
            />
          </ListCell>
        );
      }
      case 'empty':
        return (
          <EmptyState
            icon={item.search ? 'search-off' : 'inbox'}
            title={item.text}
            titleColor={t.text}
            compact
          />
        );
      case 'help':
        return (
          <View style={[styles.block, styles.help]}>
            <MarkLegend />
            <Text style={[styles.small, { color: t.textSecondary }]}>
              Toca la fila para <Text style={styles.bold}>está / no está</Text>.
              Mantén pulsado para parcial o justificar.
            </Text>
            <SyncBadge generatedAt={roll.generatedAt} />
          </View>
        );
    }
  };

  const saveLabel = pick.locked
    ? 'Aún no ha llegado'
    : !dirty && hasMarks && !uploading && !restored
      ? 'Guardada ✓'
      : counts.unmarked > 0 && hasMarks
        ? `Guardar (${unmarkedLabel(counts.unmarked)})`
        : 'Guardar lista';
  const barNotice = uploading
    ? null
    : restored && dirty
      ? 'Tienes marcas sin guardar de antes.'
      : dirty && !pick.locked
        ? 'Cambios sin guardar · los datos están solo en tu móvil'
        : null;

  return (
    <View style={[styles.root, { backgroundColor: t.backgroundSunken }]}>
      <Animated.FlatList
        ref={listRef}
        data={data}
        keyExtractor={(i) => i.key}
        renderItem={renderItem}
        extraData={draft}
        onScroll={onScroll}
        scrollEventThrottle={16}
        stickyHeaderIndices={stickyIndex >= 0 ? [stickyIndex] : undefined}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        initialNumToRender={20}
        contentContainerStyle={{ paddingBottom: contentPaddingBottom + 16 }}
        refreshControl={
          <RefreshControl
            refreshing={false}
            onRefresh={() => void onRefresh()}
            tintColor={t.textSecondary}
          />
        }
      />
      <BottomActionBar onHeightChange={setBarHeight}>
        {uploading && queued ? (
          <View style={styles.center}>
            <UploadStatus
              state={queued.status}
              onRetry={() => void outbox?.retry(key)}
            />
            <Text
              style={[
                styles.small,
                styles.centerText,
                { color: t.textSecondary },
              ]}
            >
              {uploadText(queued)}
            </Text>
          </View>
        ) : barNotice ? (
          <Text
            style={[
              styles.small,
              styles.centerText,
              { color: dirty ? t.warningText : t.textSecondary },
            ]}
          >
            {barNotice}
          </Text>
        ) : null}
        <Counts>
          <Count mark="yes" label={estanLabel(counts.came)} />
          <Count mark="no_unjustified" label={faltanLabel(counts.missed)} />
          {counts.unmarked > 0 ? (
            <Count mark={null} label={unmarkedLabel(counts.unmarked)} warn />
          ) : null}
        </Counts>
        <SaveRollButton
          label={saveLabel}
          enabled={!pick.locked && saveLabel !== 'Guardada ✓'}
          onPress={() => void save()}
        />
      </BottomActionBar>
      <MarkSheet
        person={sheetPerson?.person ?? null}
        when={when}
        mark={sheetFor ? (draft.marks[sheetFor] ?? null) : null}
        note={sheetFor ? (draft.notes[sheetFor] ?? '') : ''}
        onMark={(m) => {
          if (sheetFor) setDraft((d) => withMark(d, sheetFor, m));
        }}
        onNote={(n) => {
          if (sheetFor) {
            setDraft((d) => ({ ...d, notes: { ...d.notes, [sheetFor]: n } }));
          }
        }}
        onClose={() => setSheetFor(null)}
        // La ficha es por grupo: solo con grupo de los sábados.
        onOpenFicha={
          sheetPerson?.homeGroup
            ? () =>
                router.push({
                  pathname: '/comunica/grupos/persona/[personId]',
                  params: {
                    personId: sheetPerson.person.id,
                    groupId: sheetPerson.homeGroup!.id,
                  },
                })
            : undefined
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  block: { paddingHorizontal: 16, paddingTop: 12, gap: 12 },
  body: { ...typography.body },
  small: { ...typography.caption },
  bold: { fontWeight: '700' },
  link: { ...typography.button },
  centerText: { textAlign: 'center' },
  center: { alignItems: 'center', gap: 2 },
  outcome: { padding: 12, borderRadius: radii.md, gap: 8 },
  byBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    minHeight: 44,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 4,
  },
  foldHead: { alignItems: 'center' },
  sectionTitle: { ...typography.h3 },
  sectionCount: { ...typography.subhead, fontWeight: '600' },
  course: {
    ...typography.footnote,
    fontWeight: '700',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 6,
  },
  note: { ...typography.caption, paddingHorizontal: 20, paddingBottom: 6 },
  help: { paddingTop: 24, alignItems: 'flex-start' },
});
