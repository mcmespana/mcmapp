// components/comunica/pasar-lista/RollScreen.tsx
//
// Marcar la lista de un grupo en una sesión (primer corte del plan 04; diseño
// de origen: `design/pasar-lista/Marcar` del plugin).
//
//   · Tocar la fila: vino / no vino. Mantener pulsado (o «Más opciones» del
//     lector de pantalla): las cuatro marcas y el motivo.
//   · «Han venido todos» marca a los que faltan por marcar.
//   · «Sin registro» solo si la lista no está pasada.
//   · Del futuro no se pasa lista: filas apagadas y el botón también.
//
// Falta, y lo trae el plan 04 con la cola del plan 01: el borrador guardado en
// el móvil a cada toque y la subida en segundo plano. Hoy se guarda contra el
// servidor directamente y la pantalla espera la respuesta.

import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { Stack } from 'expo-router';
import { PressableFeedback } from 'heroui-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { useToast } from '@/contexts/AppToastContext';
import typography from '@/constants/typography';
import { radii } from '@/constants/uiStyles';
import { comunicaNow, getComunicaApi } from '@/services/comunica';
import { isComunicaApiError } from '@/services/comunica/client';
import type { RollDetail, SetMark } from '@/services/comunica/contract';
import { NOTE_MAX } from '@/services/comunica/contract';
import { areaKey } from '@/hooks/comunica/useAreaQuery';
import { useGroups, useRoll } from '@/hooks/comunica/usePasarLista';
import { h } from '@/utils/haptics';
import { longDay } from '@/utils/comunica/dates';
import { madridDay, madridTime } from '@/utils/comunica/madrid';
import {
  countMarks,
  absenceStreak,
  groupLabel,
  MARK_LABEL,
  nextMarkOnTap,
  participantsLabel,
} from '@/utils/comunica/marks';
import {
  draftFrom,
  isDirty,
  markAllUnmarked,
  toRollWrite,
  type RollDraft,
} from '@/utils/comunica/rollDraft';
import { uuidV4 } from '@/utils/comunica/uuid';
import AreaScreen from '../comun/AreaScreen';
import AreaState from '../comun/AreaState';
import BottomActionBar from '../comun/BottomActionBar';
import { MarkIcon, MarkLegend, MarkPicker } from '../comun/MarkControl';
import PersonRow from '../comun/PersonRow';
import Section from '../comun/Section';
import { useComunicaTheme } from '../comun/useComunicaTheme';

const NOT_SAVED_COPY = {
  not_in_group: 'ya no está en el grupo',
  no_registration: 'no se ha podido inscribir',
  crm_error: 'el CRM no lo ha guardado',
} as const;

export default function RollScreen({
  sessionId,
  groupId,
}: {
  sessionId: string;
  groupId: string;
}) {
  const roll = useRoll(sessionId, groupId);
  const groups = useGroups();
  const group = groups.data?.groups.find((g) => g.id === groupId);
  const title = group ? groupLabel(group) : 'Lista';

  return (
    <>
      <Stack.Screen options={{ title, headerLargeTitle: false }} />
      <AreaState query={roll} skeleton="list">
        {(data) => (
          <RollEditor
            key={data.roll?.takenAt ?? 'nueva'}
            roll={data}
            subtitle={[
              data.monitors.map((m) => m.firstName).join(', '),
              group?.schoolLevels.join(', '),
              participantsLabel(data.entries.length),
            ]
              .filter(Boolean)
              .join(' · ')}
            refetch={roll.refetch}
          />
        )}
      </AreaState>
    </>
  );
}

function RollEditor({
  roll,
  subtitle,
  refetch,
}: {
  roll: RollDetail;
  subtitle: string;
  refetch: () => Promise<unknown>;
}) {
  const t = useComunicaTheme();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [draft, setDraft] = useState<RollDraft>(() => draftFrom(roll));
  const [open, setOpen] = useState<string | null>(null);
  const [notSaved, setNotSaved] = useState<string[]>([]);

  const now = comunicaNow();
  const today = madridDay(now);
  const future = roll.session.date > today;
  const notStarted =
    roll.session.date === today &&
    new Date(roll.session.startsAt).getTime() > now.getTime();
  const counts = countMarks(Object.values(draft.marks));
  const dirty = isDirty(roll, draft);
  const names = useMemo(
    () =>
      Object.fromEntries(
        roll.entries.map((e) => [e.person.id, e.person.firstName]),
      ),
    [roll.entries],
  );

  const invalidate = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: areaKey(['pasar-lista', 'today']) }),
      qc.invalidateQueries({
        queryKey: areaKey([
          'pasar-lista',
          'roll',
          roll.session.id,
          roll.groupId,
        ]),
      }),
    ]);

  const save = useMutation({
    mutationFn: (action: 'save' | 'skip') =>
      getComunicaApi().saveRoll(
        roll.session.id,
        roll.groupId,
        action === 'save'
          ? toRollWrite(draft, uuidV4())
          : { clientId: uuidV4(), action: 'skip', marks: {}, notes: {} },
      ),
    onSuccess: async (res) => {
      h.success();
      setNotSaved(
        res.notSaved.map(
          (n) =>
            `${names[n.personId] ?? 'Alguien'}: ${NOT_SAVED_COPY[n.reason]}`,
        ),
      );
      qc.setQueryData(
        areaKey(['pasar-lista', 'roll', roll.session.id, roll.groupId]),
        res.roll,
      );
      toast.show({
        variant: res.notSaved.length ? 'warning' : 'success',
        label:
          res.rollCall.status === 'skipped' ? 'Sin registro' : 'Lista guardada',
      });
      await invalidate();
    },
    onError: (e) => {
      h.error();
      const offline =
        isComunicaApiError(e) &&
        (e.code === 'network' || e.code === 'crm_unavailable');
      toast.show({
        variant: 'danger',
        label: offline
          ? 'No se ha podido enviar. Vuelve a intentarlo con cobertura.'
          : isComunicaApiError(e) && e.reason === 'nothing_marked'
            ? 'No has marcado a nadie'
            : 'No se ha podido guardar la lista',
      });
    },
  });

  const setMark = (id: string, mark: SetMark) =>
    setDraft((d) => ({ ...d, marks: { ...d.marks, [id]: mark } }));

  const saveLabel = future
    ? 'Aún no ha llegado'
    : roll.roll
      ? 'Guardar cambios'
      : 'Guardar lista';

  return (
    <AreaScreen
      onRefresh={refetch}
      footer={
        <BottomActionBar>
          <View style={styles.counts} accessibilityLiveRegion="polite">
            <Count color={t.text} dot="yes" n={counts.came} label="vinieron" />
            <Count
              color={t.text}
              dot="no_unjustified"
              n={counts.missed}
              label="ausencias"
            />
            {counts.unmarked > 0 ? (
              <Count
                color={t.warningText}
                n={counts.unmarked}
                label="sin marcar"
              />
            ) : null}
          </View>
          <PressableFeedback
            isDisabled={future || save.isPending || (!dirty && !!roll.roll)}
            onPress={() => save.mutate('save')}
            accessibilityRole="button"
            accessibilityLabel={saveLabel}
            accessibilityState={{ busy: save.isPending }}
            style={[
              styles.save,
              {
                backgroundColor:
                  future || (!dirty && roll.roll) ? t.separator : t.accentFill,
              },
            ]}
          >
            <PressableFeedback.Scale />
            <Text
              style={[
                styles.saveLabel,
                {
                  color:
                    future || (!dirty && roll.roll)
                      ? t.textSecondary
                      : t.onAccent,
                },
              ]}
            >
              {save.isPending ? 'Guardando…' : saveLabel}
            </Text>
          </PressableFeedback>
        </BottomActionBar>
      }
    >
      <View style={styles.head}>
        <Text style={[styles.day, { color: t.text }]}>
          {longDay(roll.session.date, true)}
        </Text>
        <Text style={[styles.sub, { color: t.textSecondary }]}>{subtitle}</Text>
        {notStarted ? (
          <Notice
            icon="clock"
            text={`Empieza a las ${madridTime(roll.session.startsAt)} — aún no han llegado`}
          />
        ) : null}
        {future ? (
          <Notice
            icon="clock"
            text="Esta sesión aún no ha llegado: no se puede pasar lista."
          />
        ) : null}
        {notSaved.length > 0 ? (
          <Notice
            icon="exclamationmark.triangle.fill"
            text={`Sin guardar — ${notSaved.join('; ')}`}
          />
        ) : null}
      </View>

      {!future && counts.unmarked > 0 ? (
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
            Han venido todos
          </Text>
        </PressableFeedback>
      ) : null}

      <Section>
        {roll.entries.map((e) => {
          const id = e.person.id;
          const mark = draft.marks[id] ?? null;
          const streak = absenceStreak(e.previousMarks);
          const isOpen = open === id;
          return (
            <View key={id}>
              <PersonRow
                person={e.person}
                subtitle={
                  [
                    streak >= 2 ? `${streak} faltas seguidas` : null,
                    draft.notes[id] || null,
                  ]
                    .filter(Boolean)
                    .join(' · ') || undefined
                }
                stateLabel={mark ? MARK_LABEL[mark] : 'Sin marcar'}
                accessibilityHint="Toca para vino o no vino; mantén pulsado para más opciones"
                disabled={future}
                onPress={() => {
                  h.select();
                  setMark(id, nextMarkOnTap(mark));
                }}
                onLongPress={() => {
                  h.menuOpen();
                  setOpen(isOpen ? null : id);
                }}
                right={<MarkIcon mark={mark} />}
              />
              {isOpen ? (
                <View style={styles.more}>
                  <MarkPicker value={mark} onChange={(m) => setMark(id, m)} />
                  <TextInput
                    value={draft.notes[id] ?? ''}
                    onChangeText={(v) =>
                      setDraft((d) => ({
                        ...d,
                        notes: { ...d.notes, [id]: v },
                      }))
                    }
                    maxLength={NOTE_MAX}
                    placeholder="Motivo (opcional)"
                    placeholderTextColor={t.textMuted}
                    accessibilityLabel={`Motivo de ${e.person.firstName}`}
                    style={[
                      styles.note,
                      { color: t.text, backgroundColor: t.backgroundSunken },
                    ]}
                  />
                </View>
              ) : null}
            </View>
          );
        })}
      </Section>

      <View style={styles.help}>
        <MarkLegend />
        <Text style={[styles.sub, { color: t.textSecondary }]}>
          Toca la fila para vino / no vino. Mantén pulsado para parcial o
          justificar.
        </Text>
      </View>

      {!roll.roll && !future ? (
        <PressableFeedback
          onPress={() => save.mutate('skip')}
          isDisabled={save.isPending}
          accessibilityRole="button"
          style={[styles.skip, { borderColor: t.separator }]}
        >
          <PressableFeedback.Highlight />
          <Text style={[styles.skipLabel, { color: t.textSecondary }]}>
            Sin registro — no me avises más
          </Text>
        </PressableFeedback>
      ) : null}
    </AreaScreen>
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
  n,
  label,
  color,
  dot,
}: {
  n: number;
  label: string;
  color: string;
  dot?: SetMark;
}) {
  return (
    <View style={styles.count}>
      {dot ? (
        <MarkIcon mark={dot} size={14} />
      ) : (
        <MarkIcon mark={null} size={14} />
      )}
      <Text style={[styles.countText, { color }]}>
        {n} {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { gap: 4 },
  day: { ...typography.h3 },
  sub: { ...typography.caption },
  notice: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  noticeText: { ...typography.caption, flex: 1 },
  allCame: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 48,
    borderRadius: radii.md,
  },
  allCameLabel: { ...typography.button },
  more: { paddingHorizontal: 16, paddingBottom: 12, gap: 8 },
  note: {
    ...typography.body,
    borderRadius: radii.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  help: { gap: 8 },
  skip: {
    minHeight: 48,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipLabel: { ...typography.button },
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
