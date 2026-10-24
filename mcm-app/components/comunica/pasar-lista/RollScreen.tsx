// components/comunica/pasar-lista/RollScreen.tsx
//
// Marcar la lista de un grupo en una sesión (plan 04; diseño de origen:
// `design/pasar-lista/Marcar` y `pages/single_stic_pasar_lista_marcar.php`).
//
//   · Tocar la fila: sin marcar → Vino → No vino → sin marcar (desde Parcial o
//     Justificada, a Vino). Mantener pulsado (o «Más opciones» del lector de
//     pantalla): la hoja con los cuatro estados, el motivo y quitar la marca.
//   · «Han venido todos» / «El resto ha venido (N)» solo rellena lo sin marcar.
//   · «¿No hubo sesión? · Sin registro», solo sin lista y con confirmación.
//   · Del futuro no se pasa lista: filas apagadas y el botón también.
//   · Lo marcado se guarda en el móvil a cada toque (borrador); «Guardar» lo
//     pasa a la cola, que lo sube sola. Al contestar, se compara lo mandado con
//     lo releído: nunca «guardada» sin comprobarlo.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Platform, StyleSheet, Text, View } from 'react-native';
import { Stack, useNavigation, useRouter } from 'expo-router';
import { PressableFeedback } from 'heroui-native';
import { useQueryClient } from '@tanstack/react-query';
import { IconSymbol } from '@/components/ui/IconSymbol';
import typography from '@/constants/typography';
import { radii } from '@/constants/uiStyles';
import { themeColors } from '@/constants/colors';
import { comunicaNow } from '@/services/comunica';
import type {
  GroupWithMonitors,
  Mark,
  RollCallSummary,
  RollDetail,
  RollWrite,
  RollWriteResult,
  SetMark,
  TodayResponse,
} from '@/services/comunica/contract';
import { areaKey } from '@/hooks/comunica/useAreaQuery';
import { useGroups, useRoll, useToday } from '@/hooks/comunica/usePasarLista';
import { useOutbox } from '@/hooks/comunica/useOutbox';
import { useRollDraft } from '@/hooks/comunica/useRollDraft';
import useNetworkStatus from '@/hooks/useNetworkStatus';
import { useColorScheme } from '@/hooks/useColorScheme';
import { h } from '@/utils/haptics';
import { longDay } from '@/utils/comunica/dates';
import { madridTime } from '@/utils/comunica/madrid';
import {
  absenceStreak,
  cameLabel,
  countMarks,
  groupLabel,
  MARK_LABEL,
  MARK_NOTE,
  missedLabel,
  nextMarkOnTap,
  participantsLabel,
  streakLabel,
  unmarkedLabel,
} from '@/utils/comunica/marks';
import {
  proposeSession,
  rollIndex,
  sessionsForGroup,
  type Proposal,
} from '@/utils/comunica/pasarLista';
import {
  applyDraft,
  checkSaved,
  draftAfterSave,
  draftFrom,
  fillRestLabel,
  hasSomethingToSave,
  isDirty,
  markAllUnmarked,
  toRollWrite,
} from '@/utils/comunica/rollDraft';
import {
  isFutureSession,
  sessionOptions,
  shortDate,
  type SessionOption,
} from '@/utils/comunica/sessions';
import { uuidV4 } from '@/utils/comunica/uuid';
import AreaScreen from '../comun/AreaScreen';
import AreaState from '../comun/AreaState';
import BottomActionBar from '../comun/BottomActionBar';
import { MarkIcon, MarkLegend } from '../comun/MarkControl';
import PersonRow from '../comun/PersonRow';
import Section from '../comun/Section';
import UploadStatus from '../comun/UploadStatus';
import { useComunicaTheme } from '../comun/useComunicaTheme';
import MarkSheet from './MarkSheet';
import SessionPicker from './SessionPicker';

const NOT_SAVED_COPY = {
  not_in_group: 'ya no está en el grupo',
  no_registration: 'no se ha podido inscribir',
  crm_error: 'el CRM no lo ha guardado',
} as const;

export default function RollScreen({
  groupId,
  sessionId,
}: {
  groupId: string;
  /** Sin ella, la que propone la regla. */
  sessionId?: string;
}) {
  const router = useRouter();
  const groups = useGroups();
  const today = useToday();
  const isDark = useColorScheme() === 'dark';
  const tint = Platform.OS === 'ios' ? themeColors(isDark).headerTint : '#fff';
  const now = comunicaNow();

  const group = groups.data?.groups.find((g) => g.id === groupId);
  const sessions = useMemo(
    () =>
      group && groups.data
        ? sessionsForGroup(group, groups.data.stageEvents)
        : [],
    [group, groups.data],
  );
  const proposal = useMemo(
    () => proposeSession(sessions, now),
    // Por día basta: la regla no cambia a cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sessions],
  );
  const session =
    (sessionId && sessions.find((s) => s.id === sessionId)) ||
    proposal?.session ||
    null;
  const byRule = !sessionId || sessionId === proposal?.session.id;

  const rolls = useMemo(() => {
    const idx = rollIndex(today.data?.rollCalls ?? []);
    const m = new Map<string, RollCallSummary>();
    for (const s of sessions) {
      const r = idx.get(`${s.id}:${groupId}`);
      if (r) m.set(s.id, r);
    }
    return m;
  }, [today.data, sessions, groupId]);
  const options = useMemo(
    () => sessionOptions(sessions, rolls, now),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sessions, rolls],
  );
  // La sesión abierta, aunque sea futura (para el selector).
  const position = session
    ? sessions
        .slice()
        .sort((a, b) => (a.startsAt < b.startsAt ? -1 : 1))
        .findIndex((s) => s.id === session.id) + 1
    : 0;
  const current: SessionOption | null =
    options.find((o) => o.session.id === session?.id) ??
    (session
      ? {
          session,
          number: position,
          label: `${position} · ${shortDate(session.date)}`,
          state: 'missing',
          roll: null,
        }
      : null);

  const roll = useRoll(session?.id ?? '', groupId);
  const title = group ? groupLabel(group) : 'Lista';

  return (
    <>
      <Stack.Screen
        options={{
          title,
          headerLargeTitle: false,
          headerRight: () => (
            <SessionPicker
              options={options}
              current={current}
              tint={tint}
              onPick={(sid) => router.setParams({ sesion: sid })}
            />
          ),
        }}
      />
      <AreaState query={groups} skeleton="list">
        {() =>
          !group ? (
            <Message text="No tienes acceso a esto." />
          ) : !session ? (
            <Message
              text={
                group.stage
                  ? 'Este evento aún no tiene sesiones.'
                  : 'Este grupo no tiene evento de sesiones semanales en el curso actual. Avisa a coordinación.'
              }
            />
          ) : (
            <AreaState
              query={roll}
              skeleton="list"
              empty={{
                title:
                  'Este grupo no tiene a nadie apuntado este curso todavía.',
                subtitle:
                  'Suele pasar al empezar el curso: avisa a coordinación.',
                isEmpty: (d) => d.entries.length === 0,
              }}
            >
              {(data) => (
                <RollEditor
                  key={`${data.session.id}:${data.groupId}`}
                  roll={data}
                  group={group}
                  proposal={byRule ? proposal : null}
                  refetch={() => roll.refetch()}
                />
              )}
            </AreaState>
          )
        }
      </AreaState>
    </>
  );
}

function Message({ text }: { text: string }) {
  const t = useComunicaTheme();
  return (
    <View style={styles.message}>
      <Text style={[styles.body, { color: t.textSecondary }]}>{text}</Text>
    </View>
  );
}

export function noticeFor(p: Proposal | null): string | null {
  switch (p?.notice?.kind) {
    case 'not_started':
      return `Empieza a las ${madridTime(p.notice.startsAt)} — aún no han llegado`;
    case 'days_ago':
      return p.notice.days === 1
        ? 'Es la sesión de ayer'
        : `Es la sesión de hace ${p.notice.days} días`;
    case 'next':
      return `La próxima sesión es el ${longDay(p.notice.date)}`;
    default:
      return null;
  }
}

function RollEditor({
  roll,
  group,
  proposal,
  refetch,
}: {
  roll: RollDetail;
  group: GroupWithMonitors;
  proposal: Proposal | null;
  refetch: () => Promise<unknown>;
}) {
  const t = useComunicaTheme();
  const qc = useQueryClient();
  const router = useRouter();
  const navigation = useNavigation();
  const online = useNetworkStatus();
  const { outbox, get } = useOutbox();
  const key = `roll:${roll.session.id}:${roll.groupId}`;
  const initial = useMemo(() => draftFrom(roll), [roll]);
  const { draft, setDraft, resetTo, restored } = useRollDraft(key, initial);
  const [sheetFor, setSheetFor] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<{ ok: boolean; text: string } | null>(
    null,
  );
  const handled = useRef<string | null>(null);

  const now = comunicaNow();
  const future = isFutureSession(roll.session, now);
  const counts = countMarks(
    roll.entries.map((e) => draft.marks[e.person.id] ?? null),
  );
  const dirty = isDirty(roll, draft);
  const canSave = !future && hasSomethingToSave(roll, draft);
  const fillLabel = future ? null : fillRestLabel(draft);
  const queued = get(key);
  const when = `${longDay(roll.session.date)} · ${madridTime(roll.session.startsAt)}`;
  const rollKeyQ = useMemo(
    () => areaKey(['pasar-lista', 'roll', roll.session.id, roll.groupId]),
    [roll.session.id, roll.groupId],
  );
  const names = useMemo(
    () =>
      Object.fromEntries(
        roll.entries.map((e) => [e.person.id, e.person.firstName]),
      ),
    [roll.entries],
  );

  // Cuando la cola contesta: comparar lo mandado con lo releído. Se escucha a
  // la cola (no un efecto sobre su estado) y se leen los valores del último
  // render desde `latest`.
  const latest = useRef({ draft, names, refetch });
  useEffect(() => {
    latest.current = { draft, names, refetch };
  });
  useEffect(() => {
    if (!outbox) return;
    const onChange = () => {
      const q = outbox.get(key);
      if (!q) return;
      if (q.status === 'applied') {
        if (handled.current === q.clientId) return;
        handled.current = q.clientId;
        const res = q.result as RollWriteResult | undefined;
        if (!res) return;
        const sent = q.payload as RollWrite;
        const missing = checkSaved(sent, res.roll, res.notSaved);
        qc.setQueryData(rollKeyQ, res.roll);
        void qc.invalidateQueries({
          queryKey: areaKey(['pasar-lista', 'today']),
        });
        const fresh = draftFrom(res.roll);
        if (missing.length === 0) {
          h.success();
          resetTo(fresh);
          setOutcome({
            ok: true,
            text:
              res.rollCall.status === 'skipped'
                ? 'Guardada como «sin registro»'
                : res.status === 'queued'
                  ? 'Subida. Falta que la confirme el CRM.'
                  : `Lista guardada · ${cameLabel(res.rollCall.counts.came)}, ${missedLabel(res.rollCall.counts.missed)}`,
          });
        } else {
          h.error();
          // El borrador sigue con lo que no entró.
          const left = draftAfterSave(latest.current.draft, missing);
          if (left) {
            resetTo(
              {
                marks: { ...fresh.marks, ...left.marks },
                notes: { ...fresh.notes, ...left.notes },
              },
              true,
            );
          }
          const why = res.notSaved
            .map(
              (n) =>
                `${latest.current.names[n.personId] ?? 'Alguien'}: ${NOT_SAVED_COPY[n.reason]}`,
            )
            .join('; ');
          setOutcome({
            ok: false,
            text: `${
              missing.length === 1
                ? '1 marca no ha quedado guardada'
                : `${missing.length} marcas no han quedado guardadas`
            }${why ? ` (${why})` : ''}.`,
          });
        }
      } else if (q.status === 'failed' || q.status === 'stuck') {
        const tag = `${q.clientId}:fail`;
        if (handled.current === tag) return;
        handled.current = tag;
        // Se relee del servidor; las marcas siguen en el borrador.
        void latest.current.refetch();
      }
    };
    return outbox.subscribe(onChange);
  }, [outbox, key, qc, rollKeyQ, resetTo]);

  // Salir con cambios sin guardar pregunta (el borrador se queda igual).
  useEffect(() => {
    const unsub = navigation.addListener('beforeRemove', (e) => {
      if (!dirty || future || Platform.OS === 'web') return;
      if (queued && queued.status !== 'applied') return;
      e.preventDefault();
      Alert.alert(
        'Tienes cambios sin guardar',
        'Se quedan en el móvil si sales.',
        [
          { text: 'Guardar', onPress: () => void save('save') },
          {
            text: 'Salir sin guardar',
            style: 'destructive',
            onPress: () => navigation.dispatch(e.data.action),
          },
        ],
      );
    });
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigation, dirty, future, queued?.status]);

  const setMark = (id: string, mark: Mark) =>
    setDraft((d) => ({
      marks: { ...d.marks, [id]: mark },
      // Quitar la marca se lleva el motivo.
      notes: mark ? d.notes : { ...d.notes, [id]: '' },
    }));

  async function save(action: 'save' | 'skip') {
    if (!outbox) return;
    if (action === 'save' && !Object.values(draft.marks).some((m) => m)) {
      h.error();
      setOutcome({
        ok: false,
        text: 'No has marcado a nadie, así que no se ha guardado nada. Marca al menos a una persona, o usa «Sin registro» si no hubo sesión.',
      });
      return;
    }
    setOutcome(null);
    const takenAt = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
    const optimistic = applyDraft(roll, draft, action, takenAt);
    qc.setQueryData(rollKeyQ, optimistic);
    qc.setQueryData<TodayResponse>(areaKey(['pasar-lista', 'today']), (td) =>
      td && optimistic.roll
        ? {
            ...td,
            rollCalls: [
              ...td.rollCalls.filter(
                (r) =>
                  !(
                    r.sessionId === roll.session.id &&
                    r.groupId === roll.groupId
                  ),
              ),
              optimistic.roll,
            ],
          }
        : td,
    );
    await outbox.enqueue({
      key,
      kind: 'roll',
      clientId: uuidV4(),
      payload:
        action === 'save'
          ? toRollWrite(draft, '')
          : { action: 'skip', marks: {}, notes: {} },
      meta: {
        sessionId: roll.session.id,
        groupId: roll.groupId,
        date: roll.session.date,
        label: groupLabel(group),
      },
    });
    h.tap();
  }

  const confirmSkip = () => {
    const marked = Object.values(draft.marks).some((m) => m);
    const body = marked
      ? 'Se quedará como «sin registro» y no se guardará ninguna de las marcas que has puesto. ¿Seguro?'
      : '¿No hubo sesión con este grupo ese día? La lista se queda como «sin registro» y se deja de avisar.';
    if (Platform.OS === 'web') {
      void save('skip');
      return;
    }
    Alert.alert('Sin registro', body, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Sin registro',
        style: 'destructive',
        onPress: () => void save('skip'),
      },
    ]);
  };

  const confirmDiscard = () =>
    Alert.alert('¿Descartar esta lista?', 'Lo que no se ha subido se pierde.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Descartar',
        style: 'destructive',
        onPress: () => void outbox?.discard(key),
      },
    ]);

  const sheetEntry = roll.entries.find((e) => e.person.id === sheetFor) ?? null;
  const saved = !!roll.roll && !dirty && roll.roll.status === 'taken';
  const saveLabel = future
    ? 'Aún no ha llegado'
    : saved
      ? 'Guardada ✓'
      : counts.unmarked > 0 && counts.came + counts.missed > 0
        ? `Guardar (${unmarkedLabel(counts.unmarked)})`
        : 'Guardar lista';

  const uploading = queued && queued.status !== 'applied';
  const barNotice = uploading
    ? null
    : online === false
      ? 'Sin cobertura. Puedes marcar: se guardará en el móvil.'
      : restored && dirty
        ? 'Tienes marcas sin guardar de antes.'
        : dirty && !future && roll.roll
          ? 'Cambios sin guardar · los datos están solo en tu móvil'
          : null;

  const uploadText = !queued
    ? ''
    : queued.status === 'pending'
      ? 'Guardado en el móvil. Se enviará solo al volver la cobertura.'
      : queued.status === 'sending'
        ? 'Guardando…'
        : queued.error && !queued.error.auto
          ? queued.error.reason === 'session_in_future'
            ? 'Esta sesión aún no ha llegado.'
            : queued.error.code === 'forbidden'
              ? 'No tienes acceso a esto.'
              : queued.error.message
          : 'No se ha guardado. Tus marcas siguen aquí: vuelve a guardar.';

  return (
    <AreaScreen
      onRefresh={refetch}
      footer={
        <BottomActionBar>
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
                {uploadText}
              </Text>
              {queued.status === 'stuck' ? (
                <PressableFeedback
                  onPress={confirmDiscard}
                  accessibilityRole="button"
                  hitSlop={8}
                >
                  <Text style={[styles.small, { color: t.dangerText }]}>
                    Descartar
                  </Text>
                </PressableFeedback>
              ) : null}
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
          <View style={styles.counts} accessibilityLiveRegion="polite">
            <Count mark="yes" label={cameLabel(counts.came)} />
            <Count mark="no_unjustified" label={missedLabel(counts.missed)} />
            {counts.unmarked > 0 ? (
              <Count mark={null} label={unmarkedLabel(counts.unmarked)} warn />
            ) : null}
          </View>
          <PressableFeedback
            isDisabled={!canSave}
            onPress={() => void save('save')}
            accessibilityRole="button"
            accessibilityLabel={saveLabel}
            accessibilityState={{ disabled: !canSave }}
            style={[
              styles.save,
              { backgroundColor: canSave ? t.accentFill : t.separator },
            ]}
          >
            <PressableFeedback.Scale />
            <Text
              style={[
                styles.saveLabel,
                { color: canSave ? t.onAccent : t.textSecondary },
              ]}
            >
              {saveLabel}
            </Text>
          </PressableFeedback>
        </BottomActionBar>
      }
    >
      <View style={styles.head}>
        <Text
          style={[styles.day, { color: t.text }]}
          accessibilityRole="header"
        >
          {longDay(roll.session.date, true)}
        </Text>
        <Text style={[styles.small, { color: t.textSecondary }]}>
          {[
            roll.monitors.map((m) => m.firstName).join(', '),
            group.schoolLevels.join(', '),
            participantsLabel(roll.entries.length),
          ]
            .filter(Boolean)
            .join(' · ')}
        </Text>
        {noticeFor(proposal) && !roll.roll ? (
          <Notice icon="clock" text={noticeFor(proposal)!} />
        ) : null}
        {future ? (
          <Notice
            icon="clock"
            text="Esta sesión aún no ha llegado: no se puede pasar lista."
          />
        ) : null}
        {roll.roll?.status === 'taken' ? (
          <Text style={[styles.small, { color: t.textSecondary }]}>
            Esta lista ya está pasada. Si la cambias, se actualiza.
          </Text>
        ) : roll.roll?.status === 'skipped' ? (
          <Text style={[styles.small, { color: t.textSecondary }]}>
            Esta sesión está marcada como «sin registro».
          </Text>
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
            <Text style={[styles.body, { color: t.text }]}>{outcome.text}</Text>
            {outcome.ok ? (
              <View style={styles.nextSteps}>
                <PressableFeedback
                  onPress={() => router.push('/comunica/pasar-lista/grupos')}
                  accessibilityRole="button"
                  hitSlop={8}
                >
                  <Text style={[styles.link, { color: t.accentText }]}>
                    Otro grupo
                  </Text>
                </PressableFeedback>
                <PressableFeedback
                  onPress={() => router.dismissTo('/comunica')}
                  accessibilityRole="button"
                  hitSlop={8}
                >
                  <Text style={[styles.link, { color: t.accentText }]}>
                    Volver a la portada
                  </Text>
                </PressableFeedback>
              </View>
            ) : null}
          </View>
        ) : null}
        {!roll.roll && !future ? (
          <PressableFeedback
            onPress={confirmSkip}
            accessibilityRole="button"
            accessibilityLabel="¿No hubo sesión? Sin registro"
            hitSlop={8}
            style={styles.skip}
          >
            <Text style={[styles.small, { color: t.textSecondary }]}>
              ¿No hubo sesión? ·{' '}
              <Text style={{ color: t.accentText, fontWeight: '600' }}>
                Sin registro
              </Text>
            </Text>
          </PressableFeedback>
        ) : null}
      </View>

      {fillLabel ? (
        <PressableFeedback
          onPress={() => {
            h.add();
            setDraft(markAllUnmarked);
          }}
          accessibilityRole="button"
          style={[
            styles.allCame,
            { backgroundColor: t.chip('positive').background },
          ]}
        >
          <PressableFeedback.Scale />
          <IconSymbol name="checkmark" size={18} color={t.text} />
          <Text style={[styles.allCameLabel, { color: t.text }]}>
            {fillLabel}
          </Text>
        </PressableFeedback>
      ) : null}

      <Section>
        {roll.entries.map((e) => {
          const id = e.person.id;
          const mark = draft.marks[id] ?? null;
          return (
            <RollRow
              key={id}
              entry={e}
              mark={mark}
              note={draft.notes[id] ?? ''}
              streak={absenceStreak(e.previousMarks)}
              disabled={future}
              onTap={() => {
                h.select();
                setMark(id, nextMarkOnTap(mark));
              }}
              onSet={(m) => {
                h.select();
                setMark(id, m);
              }}
              onMore={() => {
                h.tap();
                setSheetFor(id);
              }}
            />
          );
        })}
      </Section>

      <View style={styles.help}>
        <MarkLegend />
        <Text style={[styles.small, { color: t.textSecondary }]}>
          Toca la fila para{' '}
          <Text style={{ fontWeight: '700' }}>vino / no vino</Text>. Mantén
          pulsado para parcial o justificar.
        </Text>
        <PressableFeedback
          onPress={() =>
            router.push({
              pathname: '/comunica/pasar-lista/[groupId]/historial',
              params: { groupId: roll.groupId },
            })
          }
          accessibilityRole="button"
          hitSlop={8}
        >
          <Text style={[styles.link, { color: t.accentText }]}>
            Ver todas las fechas
          </Text>
        </PressableFeedback>
      </View>

      <MarkSheet
        person={sheetEntry?.person ?? null}
        when={when}
        mark={sheetFor ? (draft.marks[sheetFor] ?? null) : null}
        note={sheetFor ? (draft.notes[sheetFor] ?? '') : ''}
        onMark={(m) => {
          if (sheetFor) setMark(sheetFor, m);
        }}
        onNote={(n) => {
          if (sheetFor) {
            setDraft((d) => ({ ...d, notes: { ...d.notes, [sheetFor]: n } }));
          }
        }}
        onClose={() => setSheetFor(null)}
      />
    </AreaScreen>
  );
}

function RollRow({
  entry,
  mark,
  note,
  streak,
  disabled,
  onTap,
  onSet,
  onMore,
}: {
  entry: RollDetail['entries'][number];
  mark: Mark;
  note: string;
  streak: number;
  disabled: boolean;
  onTap: () => void;
  onSet: (m: SetMark) => void;
  onMore: () => void;
}) {
  const t = useComunicaTheme();
  const lines = [mark ? MARK_NOTE[mark] : undefined, note || undefined].filter(
    Boolean,
  ) as string[];
  // Nombre y primer apellido.
  const person = {
    ...entry.person,
    lastName: entry.person.lastName.split(' ')[0],
  };
  return (
    <View
      accessible
      accessibilityLabel={[
        `${entry.person.firstName} ${entry.person.lastName}`,
        ...lines,
        streak >= 2 ? streakLabel(streak) : null,
        mark ? MARK_LABEL[mark] : 'Sin marcar',
      ]
        .filter(Boolean)
        .join(', ')}
      accessibilityHint="Toca para vino o no vino"
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      accessibilityActions={[
        { name: 'activate' },
        { name: 'partial', label: 'Parcial' },
        { name: 'justified', label: 'Justificada' },
        { name: 'more', label: 'Más opciones' },
      ]}
      onAccessibilityAction={(e) => {
        if (disabled) return;
        const name = e.nativeEvent.actionName;
        if (name === 'activate') onTap();
        if (name === 'partial') onSet('partial');
        if (name === 'justified') onSet('no_justified');
        if (name === 'more') onMore();
      }}
    >
      <PersonRow
        person={person}
        subtitle={lines.join(' · ') || undefined}
        disabled={disabled}
        onPress={onTap}
        onLongPress={onMore}
        right={
          <View style={styles.right}>
            {streak >= 2 ? (
              <Text style={[styles.streak, { color: t.dangerText }]}>
                {streakLabel(streak)}
              </Text>
            ) : null}
            <MarkIcon mark={mark} />
          </View>
        }
      />
    </View>
  );
}

function Notice({
  icon,
  text,
}: {
  icon: 'clock' | 'exclamationmark.triangle.fill';
  text: string;
}) {
  const t = useComunicaTheme();
  return (
    <View style={styles.notice}>
      <IconSymbol name={icon} size={16} color={t.warningIcon} />
      <Text style={[styles.noticeText, { color: t.warningText }]}>{text}</Text>
    </View>
  );
}

function Count({
  label,
  mark,
  warn,
}: {
  label: string;
  mark: Mark;
  warn?: boolean;
}) {
  const t = useComunicaTheme();
  return (
    <View style={styles.count}>
      <MarkIcon mark={mark} size={14} />
      <Text
        style={[styles.countText, { color: warn ? t.warningText : t.text }]}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  message: { padding: 24 },
  head: { gap: 6 },
  day: { ...typography.h3 },
  body: { ...typography.body },
  small: { ...typography.caption },
  centerText: { textAlign: 'center' },
  center: { alignItems: 'center', gap: 2 },
  notice: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  noticeText: { ...typography.caption, flex: 1 },
  outcome: { padding: 12, borderRadius: radii.md, gap: 8 },
  nextSteps: { flexDirection: 'row', gap: 24 },
  link: { ...typography.button },
  skip: { alignSelf: 'flex-start', paddingVertical: 4 },
  allCame: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 48,
    borderRadius: radii.md,
  },
  allCameLabel: { ...typography.button },
  right: { alignItems: 'center', gap: 8, flexDirection: 'row' },
  streak: {
    ...typography.footnote,
    fontWeight: '600',
    maxWidth: 96,
    textAlign: 'right',
  },
  help: { gap: 8 },
  counts: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 16,
  },
  count: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  countText: { ...typography.caption, fontWeight: '600' },
  save: {
    minHeight: 52,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveLabel: { ...typography.button },
});
