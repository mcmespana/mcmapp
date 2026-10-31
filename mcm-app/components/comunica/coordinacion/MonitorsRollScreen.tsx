// components/comunica/coordinacion/MonitorsRollScreen.tsx
//
// La LISTA DE MONITORES (plan 06, reglas 2-7; `single_stic_pasar_lista_monitores.php`):
// la de un sábado (por etapa, cada una sobre su evento) o la de una reunión de
// programación. Es la pantalla de marcar del plan 04 en modo `monitors`: sus
// filas (`RollRow`), su hoja (`MarkSheet`), su barra, su selector de sesión y
// su borrador (`useRollDraft`). No hay otra pantalla de marcar.
//
//   · Arranca TODO EN VERDE; el toque pone y quita faltas; mantener pulsado,
//     la hoja (justificar y escribir el motivo).
//   · Quien no va por grupos de Pasar Lista (Apoyo, otros grupos) arranca en
//     «-», va al final y no se manda si no se toca (plugin, 25/10/2026).
//   · Al guardar va una marca por fila (también los verdes) a la cola. Cuando
//     sube, se vuelve a pedir la lista y lo que diga el servidor es la verdad:
//     no se compara con lo que se tenía (el fallo del 26/09).

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Alert, Platform, StyleSheet, Text, View } from 'react-native';
import { Stack, usePreventRemove, useRouter } from 'expo-router';
import { PressableFeedback } from 'heroui-native';
import { useQueryClient, type QueryKey } from '@tanstack/react-query';
import EmptyState from '@/components/ui/EmptyState';
import { IconSymbol } from '@/components/ui/IconSymbol';
import SegmentedControl from '@/components/ui/SegmentedControl';
import typography from '@/constants/typography';
import { radii } from '@/constants/uiStyles';
import { themeColors } from '@/constants/colors';
import { comunicaNow } from '@/services/comunica';
import type {
  Mark,
  MonitorsRoll,
  MonitorsRollKind,
  MonitorsRollWriteResult,
  RollCallSummary,
  SetMark,
  Stage,
} from '@/services/comunica/contract';
import { areaKeyIn, useWorkingDelegation } from '@/hooks/comunica/useAreaQuery';
import {
  COORDINATION_KEYS,
  coordinationOutboxKeys,
  useCoordinationWrites,
  useMonitorsRoll,
} from '@/hooks/comunica/coordination';
import { useMe } from '@/hooks/comunica/useMe';
import { useFlushOutboxOnMount, useOutbox } from '@/hooks/comunica/useOutbox';
import { useRollDraft } from '@/hooks/comunica/useRollDraft';
import useNetworkStatus from '@/hooks/useNetworkStatus';
import { useColorScheme } from '@/hooks/useColorScheme';
import { h } from '@/utils/haptics';
import { longDay } from '@/utils/comunica/dates';
import { madridTime } from '@/utils/comunica/madrid';
import { monitorAlert, rowPct } from '@/utils/comunica/monitorAlert';
import {
  absencesText,
  alreadyTakenText,
  cameText,
  canMarkSession,
  effectiveMark,
  isMonitorsDirty,
  memberLine,
  monitorNote,
  monitorSections,
  monitorsCanSave,
  monitorsCountText,
  monitorsCounts,
  monitorsDraftFrom,
  monitorsMarks,
  nextMonitorMarkOnTap,
  OPTIONAL_HINT,
  OPTIONAL_HINT_MEETING,
  setMonitorMark,
} from '@/utils/comunica/monitorsRoll';
import { proposeSession } from '@/utils/comunica/pasarLista';
import { scopeLabel, STAGE_TEXT } from '@/utils/comunica/scope';
import { sessionOptions, type SessionOption } from '@/utils/comunica/sessions';
import { uploadText } from '@/utils/comunica/uploadText';
import AreaScreen from '../comun/AreaScreen';
import AreaState from '../comun/AreaState';
import BottomActionBar from '../comun/BottomActionBar';
import { confirmAction } from '../comun/confirm';
import { MarkIcon, MarkLegend } from '../comun/MarkControl';
import Section from '../comun/Section';
import UploadStatus from '../comun/UploadStatus';
import { useComunicaTheme } from '../comun/useComunicaTheme';
import MarkSheet from '../pasar-lista/MarkSheet';
import RollRow, { memberAsPerson } from '../pasar-lista/RollRow';
import { noticeFor } from '../pasar-lista/RollScreen';
import SaveRollButton, { SAVED_LABEL } from '../pasar-lista/SaveRollButton';
import SessionPicker from '../pasar-lista/SessionPicker';

export const FORBIDDEN_COORDINATION = {
  title: 'Esta pantalla es de coordinación.',
  subtitle: 'Si crees que deberías verla, avisa a la oficina técnica.',
};

export default function MonitorsRollScreen({
  kind,
  sessionId,
  stage,
}: {
  kind: MonitorsRollKind;
  sessionId?: string;
  stage?: Stage;
}) {
  const router = useRouter();
  const isDark = useColorScheme() === 'dark';
  const tint = Platform.OS === 'ios' ? themeColors(isDark).headerTint : '#fff';
  const q = useMonitorsRoll({ kind, stage, session: sessionId });
  // En el cuerpo, con la delegación explícita (ver `areaKey`).
  const delegation = useWorkingDelegation();
  const queryKey = areaKeyIn(
    COORDINATION_KEYS.monitorsRoll(kind, stage, sessionId),
    delegation,
  );
  useFlushOutboxOnMount();
  const data = q.data;

  const options = useMemo(() => {
    if (!data || kind !== 'weekly') return [];
    const rolls = new Map<string, RollCallSummary>(
      data.rollCalls.map((r) => [r.sessionId, r]),
    );
    return sessionOptions(data.sessions, rolls, comunicaNow());
  }, [data, kind]);
  const current: SessionOption | null =
    options.find((o) => o.session.id === data?.session?.id) ?? null;

  const title =
    kind === 'meeting'
      ? (data?.session?.name ?? 'Reunión')
      : 'Lista de monitores';

  return (
    <>
      <Stack.Screen
        options={{
          title,
          headerLargeTitle: false,
          headerRight:
            kind === 'weekly' && options.length > 0
              ? () => (
                  <SessionPicker
                    options={options}
                    current={current}
                    tint={tint}
                    onPick={(sid) => router.setParams({ sesion: sid })}
                  />
                )
              : undefined,
        }}
      />
      <AreaState query={q} skeleton="list" forbidden={FORBIDDEN_COORDINATION}>
        {(d) => (
          <Body
            data={d}
            queryKey={queryKey}
            byRule={!sessionId}
            refetch={() => q.refetch()}
          />
        )}
      </AreaState>
    </>
  );
}

function Body({
  data,
  queryKey,
  byRule,
  refetch,
}: {
  data: MonitorsRoll;
  queryKey: QueryKey;
  byRule: boolean;
  refetch: () => Promise<{ data?: MonitorsRoll }>;
}) {
  const t = useComunicaTheme();
  const router = useRouter();
  const { createSessionToday } = useCoordinationWrites();
  const { get, outbox } = useOutbox();

  // Cuando el alcance cubre más de una etapa, cada una va sobre su evento
  // (pregunta 1 del plan, resuelta el 21/10).
  const stagePicker =
    data.kind === 'weekly' && data.stages.length > 1 && data.stage ? (
      <SegmentedControl
        options={data.stages.map((s) => ({ value: s, label: STAGE_TEXT[s] }))}
        value={data.stage}
        accentColor={t.accentFill}
        onChange={(s) => router.setParams({ etapa: s, sesion: '' })}
      />
    ) : null;

  if (!data.event) {
    const meeting = data.kind === 'meeting';
    return (
      <AreaScreen onRefresh={refetch}>
        {stagePicker}
        <EmptyState
          icon="event-busy"
          title={
            meeting
              ? 'Todavía no hay ninguna reunión creada.'
              : 'No hay evento de sesiones semanales en el curso actual.'
          }
          actionLabel={meeting ? 'Crear una reunión' : undefined}
          onAction={
            meeting
              ? () => router.replace('/comunica/coordinacion/reuniones')
              : undefined
          }
          accentColor={t.accentText}
          titleColor={t.text}
          subtitleColor={t.textSecondary}
        />
      </AreaScreen>
    );
  }

  if (!data.session) {
    const eventId = data.event.id;
    const key = coordinationOutboxKeys.sessionToday(eventId);
    const queued = get(key);
    return (
      <AreaScreen onRefresh={refetch}>
        {stagePicker}
        <EmptyState
          icon="event"
          title="Este evento aún no tiene sesiones."
          actionLabel={queued ? undefined : 'Crear la sesión de hoy'}
          onAction={() => {
            h.tap();
            void createSessionToday(eventId);
          }}
          accentColor={t.accentText}
          titleColor={t.text}
          subtitleColor={t.textSecondary}
        />
        {queued && queued.status !== 'applied' ? (
          <View style={styles.center}>
            <UploadStatus
              state={queued.status}
              onRetry={() => void outbox?.retry(key)}
            />
          </View>
        ) : null}
      </AreaScreen>
    );
  }

  return (
    <Editor
      key={data.session.id}
      data={data}
      queryKey={queryKey}
      byRule={byRule}
      stagePicker={stagePicker}
      refetch={refetch}
    />
  );
}

function Editor({
  data,
  queryKey,
  byRule,
  stagePicker,
  refetch,
}: {
  data: MonitorsRoll;
  queryKey: QueryKey;
  byRule: boolean;
  stagePicker: React.ReactNode;
  refetch: () => Promise<{ data?: MonitorsRoll }>;
}) {
  const t = useComunicaTheme();
  const qc = useQueryClient();
  const router = useRouter();
  const online = useNetworkStatus();
  const { me } = useMe();
  const { outbox, get } = useOutbox();
  const { saveMonitorsRoll } = useCoordinationWrites();
  const session = data.session!;
  const key = coordinationOutboxKeys.monitorsRoll(session.id);
  const initial = useMemo(() => monitorsDraftFrom(data.rows), [data.rows]);
  const { draft, setDraft, resetTo, restored } = useRollDraft(key, initial);
  const [sheetFor, setSheetFor] = useState<string | null>(null);
  const [othersOpen, setOthersOpen] = useState(false);
  const [outcome, setOutcome] = useState<{ ok: boolean; text: string } | null>(
    null,
  );
  const handled = useRef<string | null>(null);

  const editable = canMarkSession(
    data.kind,
    session,
    data.sessions,
    comunicaNow(),
  );
  const counts = monitorsCounts(data.rows, draft);
  const dirty = isMonitorsDirty(data.rows, draft);
  const canSave = editable && monitorsCanSave(data, draft);
  const queued = get(key);
  const uploading = !!queued && queued.status !== 'applied';
  const sections = useMemo(
    () => monitorSections(data.rows, data.borrowed),
    [data.rows, data.borrowed],
  );
  // Qué filas parten de «-»: el toque y la hoja lo necesitan por id.
  const optionalIds = useMemo(
    () => new Set(data.rows.filter((r) => r.optional).map((r) => r.member.id)),
    [data.rows],
  );
  // El aviso y el % no cambian al marcar: una vez por lista. Las filas
  // opcionales no llevan ni % ni aviso.
  const tracks = useMemo(
    () =>
      new Map(
        data.rows.map((r) => [
          r.member.id,
          // Fuera de su alcance (solo en reuniones): tampoco % ni aviso.
          r.optional || r.outOfScope
            ? { pct: null, alert: null }
            : {
                pct: rowPct(r.seasonMarks),
                alert: monitorAlert(r.seasonMarks),
              },
        ]),
      ),
    [data.rows],
  );
  const proposal = useMemo(
    () => (byRule ? proposeSession(data.sessions, comunicaNow()) : null),
    [byRule, data.sessions],
  );
  // Una reunión es de toda la delegación (plugin, 31/10/2026).
  const scope =
    data.kind === 'meeting'
      ? 'Toda la delegación'
      : me
        ? scopeLabel(me.scope)
        : '';
  const optionalHint =
    data.kind === 'meeting' ? OPTIONAL_HINT_MEETING : OPTIONAL_HINT;
  const when = `${longDay(session.date, true)} · ${madridTime(session.startsAt)}`;

  // Cuando la cola contesta: se vuelve a pedir la lista y el borrador pasa a
  // ser lo que diga el servidor. Se escucha a la cola y se leen los valores
  // del último render desde `latest`.
  const latest = useRef({ refetch });
  useEffect(() => {
    latest.current = { refetch };
  });
  useEffect(() => {
    if (!outbox) return;
    return outbox.subscribe(() => {
      const q = outbox.get(key);
      if (!q || q.status !== 'applied' || handled.current === q.clientId)
        return;
      handled.current = q.clientId;
      const res = q.result as MonitorsRollWriteResult | undefined;
      h.formSuccess();
      if (res) {
        setOutcome({
          ok: true,
          text:
            res.status === 'queued'
              ? 'Subida. Falta que la confirme el CRM.'
              : `Guardada · ${cameText(res.rollCall.counts.came)}, ${absencesText(res.rollCall.counts.missed)}`,
        });
      }
      void latest.current.refetch().then((r) => {
        if (r.data) resetTo(monitorsDraftFrom(r.data.rows));
      });
    });
  }, [outbox, key, resetTo]);

  const save = useCallback(async () => {
    if (!outbox || !canSave) return false;
    setOutcome(null);
    const marks = monitorsMarks(data.rows, draft);
    // Lo marcado se ve ya (también sin cobertura); cuando sube, se relee.
    const takenAt = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
    qc.setQueryData<MonitorsRoll>(queryKey, (old) =>
      old
        ? {
            ...old,
            rows: old.rows.map((r) => {
              const m = marks.find((x) => x.personId === r.member.id);
              return m ? { ...r, mark: m.mark, reason: m.reason ?? null } : r;
            }),
            rollCall: {
              sessionId: session.id,
              status: 'taken',
              takenAt: old.rollCall?.takenAt ?? takenAt,
              counts: { came: counts.came, missed: counts.missed },
            },
          }
        : old,
    );
    await saveMonitorsRoll({
      sessionId: session.id,
      body: { kind: data.kind, marks },
      label:
        data.kind === 'meeting'
          ? (session.name ?? 'Reunión')
          : `Monitores${data.stage ? ` ${STAGE_TEXT[data.stage]}` : ''}`,
      date: session.date,
      stage: data.stage,
    });
    resetTo(draft);
    h.tap();
    return true;
  }, [
    outbox,
    canSave,
    data,
    draft,
    qc,
    queryKey,
    session,
    counts,
    saveMonitorsRoll,
    resetTo,
  ]);

  // Salir con cambios sin guardar pregunta (el borrador se queda igual).
  const blockLeave = dirty && editable && Platform.OS !== 'web' && !uploading;
  usePreventRemove(blockLeave, ({ repeat }) => {
    Alert.alert(
      'Tienes cambios sin guardar',
      'Se quedan en el móvil si sales.',
      [
        {
          text: 'Guardar',
          onPress: () =>
            void save().then((ok) => {
              if (ok) repeat();
            }),
        },
        {
          text: 'Salir sin guardar',
          style: 'destructive',
          onPress: repeat,
        },
      ],
    );
  });

  // Callbacks por id, estables: la fila (memo) no se repinta si no cambia.
  const onTap = useCallback(
    (id: string) => {
      h.select();
      const optional = optionalIds.has(id);
      setDraft((d) =>
        setMonitorMark(
          d,
          id,
          nextMonitorMarkOnTap(effectiveMark(d, id, optional), optional),
          optional,
        ),
      );
    },
    [setDraft, optionalIds],
  );
  const onSet = useCallback(
    (id: string, m: SetMark) => {
      h.select();
      setDraft((d) => setMonitorMark(d, id, m, optionalIds.has(id)));
    },
    [setDraft, optionalIds],
  );
  const onMore = useCallback((id: string) => {
    h.tap();
    setSheetFor(id);
  }, []);

  const confirmDiscard = async () => {
    const ok = await confirmAction(
      '¿Descartar esta lista?',
      'Lo que no se ha subido se pierde.',
      'Descartar',
      true,
    );
    if (ok) void outbox?.discard(key);
  };

  const sheetRow = data.rows.find((r) => r.member.id === sheetFor) ?? null;
  const sheetOptional = !!sheetRow?.optional;
  const saved = data.rollCall?.status === 'taken' && !dirty;
  const saveLabel = !editable
    ? 'Aún no ha llegado'
    : saved
      ? SAVED_LABEL
      : 'Guardar';
  const barNotice = uploading
    ? null
    : online === false
      ? 'Sin cobertura. Puedes marcar: se guardará en el móvil.'
      : restored && dirty
        ? 'Tienes marcas sin guardar de antes.'
        : dirty && editable
          ? 'Cambios sin guardar · los datos están solo en tu móvil'
          : null;
  const stageSections = sections.filter((s) => !s.optional);
  const showHeaders = stageSections.length > 1;
  // La semanal nunca avisa en ámbar: no se pasa cada semana (regla 7).
  const notice = byRule && data.kind === 'weekly' ? noticeFor(proposal) : null;

  const renderRow = (r: MonitorsRoll['rows'][number]) => {
    const id = r.member.id;
    const mark = effectiveMark(draft, id, r.optional);
    const track = tracks.get(id);
    return (
      <RollRow
        key={id}
        mode="monitors"
        person={memberAsPerson(r.member)}
        mark={mark}
        line={memberLine(r.member)}
        pct={track?.pct ?? null}
        note={monitorNote(mark, draft.notes[id] ?? '', track?.alert ?? null)}
        disabled={!editable}
        onTap={onTap}
        onSet={onSet}
        onMore={onMore}
      />
    );
  };

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
                {uploadText(queued)}
              </Text>
              {queued.status === 'stuck' ? (
                <PressableFeedback
                  onPress={() => void confirmDiscard()}
                  accessibilityRole="button"
                  style={styles.tapTarget}
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
            <Count mark="yes" label={cameText(counts.came)} />
            <Count mark="no_unjustified" label={absencesText(counts.missed)} />
          </View>
          <SaveRollButton
            label={saveLabel}
            enabled={canSave}
            onPress={() => void save()}
          />
        </BottomActionBar>
      }
    >
      {stagePicker}
      <View style={styles.head}>
        <Text
          style={[styles.day, { color: t.text }]}
          accessibilityRole="header"
        >
          {data.kind === 'meeting'
            ? (session.name ?? 'Reunión')
            : longDay(session.date, true)}
        </Text>
        <Text style={[styles.small, { color: t.textSecondary }]}>
          {data.kind === 'meeting'
            ? [when, scope].filter(Boolean).join(' · ')
            : [scope, monitorsCountText(data.rows.length)]
                .filter(Boolean)
                .join(' · ')}
        </Text>
        {notice && !data.rollCall ? (
          <Text style={[styles.small, { color: t.textSecondary }]}>
            {notice}
          </Text>
        ) : null}
        {!editable ? (
          <Text style={[styles.small, { color: t.textSecondary }]}>
            Esta sesión aún no ha llegado: no se puede pasar lista.
          </Text>
        ) : null}
        {data.rollCall?.status === 'taken' && !outcome ? (
          <Text style={[styles.small, { color: t.textSecondary }]}>
            {alreadyTakenText(data.rollCall.counts)}
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
          </View>
        ) : null}
      </View>

      {data.rows.length === 0 ? (
        <EmptyState
          icon="groups"
          title="No hay monitores con relación vigente en los grupos de tu alcance."
          titleColor={t.text}
          compact
        />
      ) : (
        <>
          {editable && stageSections.length > 0 ? (
            <Text style={[styles.rule, { color: t.text }]}>
              Están todos en verde. Marca solo a quien no vino.
            </Text>
          ) : null}
          {sections.map((sec) => {
            if (sec.optional === 'others') {
              return (
                <View key={sec.key} style={styles.section}>
                  <PressableFeedback
                    onPress={() => {
                      h.toggle();
                      setOthersOpen((o) => !o);
                    }}
                    accessibilityRole="button"
                    accessibilityState={{ expanded: othersOpen }}
                    accessibilityLabel={`${sec.label}, ${sec.count}`}
                    style={styles.fold}
                  >
                    <Text style={[styles.foldTitle, { color: t.text }]}>
                      {sec.label}
                    </Text>
                    <Text style={[styles.small, { color: t.textSecondary }]}>
                      {sec.count}
                    </Text>
                    <IconSymbol
                      name={othersOpen ? 'chevron.up' : 'chevron.down'}
                      size={16}
                      color={t.textMuted}
                    />
                  </PressableFeedback>
                  {othersOpen ? (
                    <>
                      <Text style={[styles.small, { color: t.textSecondary }]}>
                        {optionalHint}
                      </Text>
                      <Section>{sec.rows.map(renderRow)}</Section>
                    </>
                  ) : null}
                </View>
              );
            }
            if (sec.optional === 'support') {
              return (
                <View key={sec.key} style={styles.section}>
                  <Section
                    title={`${sec.label} · ${monitorsCountText(sec.count)}`}
                  >
                    {sec.rows.map(renderRow)}
                  </Section>
                  <Text style={[styles.small, { color: t.textSecondary }]}>
                    {optionalHint}
                  </Text>
                </View>
              );
            }
            return (
              <View key={sec.key} style={styles.section}>
                {sec.borrowedNote ? (
                  <Text style={[styles.small, { color: t.textSecondary }]}>
                    {sec.borrowedNote}
                  </Text>
                ) : null}
                {sec.rows.length > 0 ? (
                  <Section
                    title={
                      showHeaders
                        ? `${sec.label} · ${monitorsCountText(sec.count)}`
                        : undefined
                    }
                  >
                    {sec.rows.map(renderRow)}
                  </Section>
                ) : showHeaders ? (
                  <Text
                    style={[styles.sectionTitle, { color: t.textSecondary }]}
                  >
                    {`${sec.label} · ${monitorsCountText(0)}`}
                  </Text>
                ) : null}
              </View>
            );
          })}
        </>
      )}

      <View style={styles.help}>
        <MarkLegend />
        <Text style={[styles.small, { color: t.textSecondary }]}>
          Toca la fila para{' '}
          <Text style={{ fontWeight: '700' }}>marcar una falta</Text>. Mantén
          pulsado para justificarla y escribir el motivo.
        </Text>
      </View>

      <MarkSheet
        mode="monitors"
        optional={sheetOptional}
        person={sheetRow ? memberAsPerson(sheetRow.member) : null}
        when={when}
        mark={sheetFor ? effectiveMark(draft, sheetFor, sheetOptional) : null}
        note={sheetFor ? (draft.notes[sheetFor] ?? '') : ''}
        onMark={(m: Mark) => {
          if (sheetFor) {
            setDraft((d) => setMonitorMark(d, sheetFor, m, sheetOptional));
          }
        }}
        onNote={(n) => {
          if (sheetFor) {
            setDraft((d) => ({ ...d, notes: { ...d.notes, [sheetFor]: n } }));
          }
        }}
        onClose={() => setSheetFor(null)}
        fichaLabel="Ficha del monitor"
        // De fuera de su alcance (en una reunión): sin ficha.
        onOpenFicha={
          sheetRow?.outOfScope
            ? undefined
            : () => {
                if (!sheetFor) return;
                router.push({
                  pathname: '/comunica/coordinacion/monitor/[id]',
                  params: { id: sheetFor },
                });
              }
        }
      />
    </AreaScreen>
  );
}

function Count({ label, mark }: { label: string; mark: Mark }) {
  const t = useComunicaTheme();
  return (
    <View style={styles.count}>
      <MarkIcon mark={mark} size={14} />
      <Text style={[styles.countText, { color: t.text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { gap: 6 },
  day: { ...typography.h3 },
  body: { ...typography.body },
  small: { ...typography.caption },
  rule: { ...typography.subhead, fontWeight: '600' },
  centerText: { textAlign: 'center' },
  center: { alignItems: 'center', gap: 2 },
  outcome: { padding: 12, borderRadius: radii.md, gap: 8 },
  section: { gap: 8 },
  sectionTitle: {
    ...typography.subhead,
    fontWeight: '600',
    paddingHorizontal: 4,
  },
  fold: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 44,
    paddingHorizontal: 4,
  },
  foldTitle: { ...typography.subhead, fontWeight: '600', flex: 1 },
  help: { gap: 8 },
  tapTarget: { minHeight: 44, justifyContent: 'center' },
  counts: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 16,
  },
  count: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  countText: { ...typography.caption, fontWeight: '600' },
});
