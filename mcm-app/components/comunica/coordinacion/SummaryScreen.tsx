// components/comunica/coordinacion/SummaryScreen.tsx
//
// El RESUMEN DE GRUPOS (plan 06, regla 10; `single_stic_pasar_lista_resumen.php`):
// lo ve todo el equipo. Por etapa: una tarjeta con el recuento (la suma entera
// o nada), la última sesión con qué listas faltan (cada una abre esa lista) y,
// por grupo, quién lo lleva, su pastilla y su tira. Con alcance acotado, lo
// tuyo arriba y «El resto de la delegación» plegado. Al final, los datos por
// revisar.

import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { PressableFeedback } from 'heroui-native';
import { IconSymbol } from '@/components/ui/IconSymbol';
import StatCard from '@/components/ui/StatCard';
import typography from '@/constants/typography';
import { radii } from '@/constants/uiStyles';
import { comunicaNow } from '@/services/comunica';
import type {
  CoordinationSummary,
  StageStrip,
} from '@/services/comunica/contract';
import { useCoordinationSummary } from '@/hooks/comunica/coordination';
import { useMe } from '@/hooks/comunica/useMe';
import { h } from '@/utils/haptics';
import { coordinationAccess, STAGE_TEXT } from '@/utils/comunica/scope';
import {
  lastSessionStatus,
  lastSessionWhen,
  listsText,
  missingText,
  pctOf,
  rowGroupCount,
  stageCard,
  stripFootnote,
  stripRowState,
} from '@/utils/comunica/summary';
import AreaScreen from '../comun/AreaScreen';
import AreaState from '../comun/AreaState';
import Section from '../comun/Section';
import StatusChip from '../comun/StatusChip';
import { STAGE_COLOR } from '../comun/theme';
import { useComunicaTheme } from '../comun/useComunicaTheme';
import RollStrip from './RollStrip';

export default function SummaryScreen() {
  const q = useCoordinationSummary();
  return (
    <>
      <Stack.Screen options={{ title: 'Resumen de grupos' }} />
      <AreaState
        query={q}
        skeleton="cards"
        empty={{
          title: 'No hay grupos de tu delegación en este curso.',
          isEmpty: (d) =>
            d.mine.length === 0 &&
            d.rest.length === 0 &&
            d.review.participantsWithoutGroup.length === 0,
        }}
      >
        {(data) => <Summary data={data} refetch={() => q.refetch()} />}
      </AreaState>
    </>
  );
}

function Summary({
  data,
  refetch,
}: {
  data: CoordinationSummary;
  refetch: () => Promise<unknown>;
}) {
  const t = useComunicaTheme();
  const router = useRouter();
  const { me } = useMe();
  const access = coordinationAccess(me?.roles);
  const [restOpen, setRestOpen] = useState(false);
  const now = comunicaNow();
  const status = lastSessionStatus(data.mine);
  const cards = data.mine.map((s) => stageCard(s, now));
  const restCount = rowGroupCount(data.rest);

  return (
    <AreaScreen onRefresh={refetch}>
      {cards.length > 0 ? (
        <View style={styles.block}>
          <View style={styles.cards}>
            {cards.map((c) => (
              <StatCard
                key={c.stage}
                value={c.value}
                label={`${c.label} · ${c.unit}`}
                backgroundColor={t.card}
                borderColor={t.separator}
              />
            ))}
          </View>
          <Text style={[styles.small, { color: t.textSecondary }]}>
            {cards
              .map((c) =>
                cards.length > 1
                  ? `${c.label}: ${c.meta.join(', ')}`
                  : c.meta.join(' · '),
              )
              .join(' · ')}
          </Text>
        </View>
      ) : null}

      {status.total > 0 ? (
        <Section title={lastSessionWhen(status)}>
          <View style={styles.pad}>
            <Text style={[styles.big, { color: t.text }]}>
              {listsText(status)}
              <Text style={[styles.small, { color: t.textSecondary }]}>
                {'  '}
                {pctOf(status)} %
              </Text>
            </Text>
            <Text style={[styles.body, { color: t.textSecondary }]}>
              {missingText(status)}
            </Text>
            {status.missing.length > 0 ? (
              <View style={styles.chips}>
                {status.missing.map((m) => (
                  <PressableFeedback
                    key={m.groupId}
                    onPress={() => {
                      h.tap();
                      router.push({
                        pathname: '/comunica/pasar-lista/[groupId]',
                        params: { groupId: m.groupId, sesion: m.sessionId },
                      });
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`Pasar la lista de ${m.code}`}
                    style={styles.chipTarget}
                  >
                    <StatusChip label={m.code} tone="warning" />
                  </PressableFeedback>
                ))}
              </View>
            ) : null}
          </View>
        </Section>
      ) : null}

      {data.mine.map((strip) => (
        <StageGroups
          key={strip.stage}
          strip={strip}
          canOpenMonitors={access.any}
        />
      ))}

      {data.scoped && data.rest.length > 0 ? (
        <View style={styles.block}>
          <PressableFeedback
            onPress={() => {
              h.toggle();
              setRestOpen((o) => !o);
            }}
            accessibilityRole="button"
            accessibilityState={{ expanded: restOpen }}
            style={styles.fold}
          >
            <Text style={[styles.foldTitle, { color: t.text }]}>
              El resto de la delegación
            </Text>
            <Text style={[styles.small, { color: t.textSecondary }]}>
              {restCount === 1 ? '1 grupo' : `${restCount} grupos`}
            </Text>
            <IconSymbol
              name={restOpen ? 'chevron.up' : 'chevron.down'}
              size={16}
              color={t.textMuted}
            />
          </PressableFeedback>
          {restOpen
            ? data.rest.map((strip) => (
                <StageGroups
                  key={strip.stage}
                  strip={strip}
                  canOpenMonitors={false}
                />
              ))
            : null}
        </View>
      ) : null}

      <Review data={data} canAssign={access.coordination} />

      <Text style={[styles.small, { color: t.textSecondary }]}>
        {stripFootnote([...data.mine, ...data.rest], data.stripLimit)}
      </Text>
    </AreaScreen>
  );
}

function StageGroups({
  strip,
  canOpenMonitors,
}: {
  strip: StageStrip;
  /** Coordinación (en lo suyo) y acompañamiento: el nombre abre su ficha. */
  canOpenMonitors: boolean;
}) {
  const t = useComunicaTheme();
  const router = useRouter();
  return (
    <Section title={STAGE_TEXT[strip.stage]}>
      {strip.rows.map((row) => {
        const state = stripRowState(row);
        const code = row.group.code?.trim() || null;
        return (
          <View key={row.group.id} style={styles.groupRow}>
            <View style={styles.groupHead}>
              <View
                style={[
                  styles.dot,
                  { backgroundColor: STAGE_COLOR[strip.stage] },
                ]}
              />
              <Text style={[styles.groupTitle, { color: t.text }]}>
                {code ? <Text style={styles.code}>{`${code} `}</Text> : null}
                <Text style={code ? { color: t.textSecondary } : undefined}>
                  {row.group.name}
                </Text>
              </Text>
              <StatusChip label={state.badge.label} tone={state.badge.tone} />
            </View>
            <Monitors
              row={row}
              canOpen={canOpenMonitors}
              onOpen={(id) =>
                router.push({
                  pathname: '/comunica/coordinacion/monitor/[id]',
                  params: { id, desde: `grupo:${row.group.id}` },
                })
              }
            />
            <RollStrip
              cells={row.cells}
              label={`${code ?? row.group.name}: ${state.note}`}
              onPress={() =>
                router.push({
                  pathname: '/comunica/pasar-lista/[groupId]/historial',
                  params: { groupId: row.group.id },
                })
              }
            />
            <Text style={[styles.small, { color: t.textSecondary }]}>
              {state.note}
            </Text>
          </View>
        );
      })}
    </Section>
  );
}

function Monitors({
  row,
  canOpen,
  onOpen,
}: {
  row: StageStrip['rows'][number];
  canOpen: boolean;
  onOpen: (id: string) => void;
}) {
  const t = useComunicaTheme();
  if (row.monitors.length === 0) {
    return row.monitorsText ? (
      <Text style={[styles.small, { color: t.textSecondary }]}>
        {row.monitorsText}
      </Text>
    ) : null;
  }
  if (!canOpen) {
    return (
      <Text style={[styles.small, { color: t.textSecondary }]}>
        {row.monitors.map((m) => m.name).join(', ')}
      </Text>
    );
  }
  return (
    <View style={styles.names}>
      {row.monitors.map((m) => (
        <PressableFeedback
          key={m.id}
          onPress={() => onOpen(m.id)}
          accessibilityRole="link"
          accessibilityLabel={`Ficha de ${m.name}`}
          style={styles.nameTarget}
        >
          <Text style={[styles.small, { color: t.accentText }]}>{m.name}</Text>
        </PressableFeedback>
      ))}
    </View>
  );
}

function Review({
  data,
  canAssign,
}: {
  data: CoordinationSummary;
  canAssign: boolean;
}) {
  const t = useComunicaTheme();
  const router = useRouter();
  const loose = data.review.participantsWithoutGroup;
  const noCode = data.review.groupsWithoutCode;
  if (loose.length === 0 && noCode.length === 0) return null;
  return (
    <Section title="Datos por revisar" warning>
      {loose.length > 0 ? (
        <View style={styles.pad}>
          <Text style={[styles.body, { color: t.text }]}>
            {loose.length === 1
              ? '1 participante sin grupo asignado'
              : `${loose.length} participantes sin grupo asignado`}
          </Text>
          <Text style={[styles.small, { color: t.textSecondary }]}>
            {loose
              .slice(0, 6)
              .map((p) => `${p.firstName} ${p.lastName}`)
              .join(', ')}
            {loose.length > 6 ? ` y ${loose.length - 6} más` : ''}
          </Text>
          {canAssign ? (
            <PressableFeedback
              onPress={() => router.push('/comunica/grupos/sin-grupo')}
              accessibilityRole="button"
              style={styles.nameTarget}
            >
              <Text style={[styles.link, { color: t.accentText }]}>
                Vincularlos a su grupo
              </Text>
            </PressableFeedback>
          ) : (
            <Text style={[styles.small, { color: t.textSecondary }]}>
              A su grupo los vincula coordinación, desde Grupos y fichas.
            </Text>
          )}
        </View>
      ) : null}
      {noCode.length > 0 ? (
        <View style={styles.pad}>
          <Text style={[styles.body, { color: t.text }]}>
            {noCode.length === 1
              ? '1 grupo sin código corto'
              : `${noCode.length} grupos sin código corto`}
          </Text>
          <Text style={[styles.small, { color: t.textSecondary }]}>
            {noCode.map((g) => g.name).join(', ')}
          </Text>
        </View>
      ) : null}
    </Section>
  );
}

const styles = StyleSheet.create({
  block: { gap: 8 },
  cards: { flexDirection: 'row', gap: 8 },
  pad: { paddingHorizontal: 16, paddingVertical: 12, gap: 6 },
  big: { ...typography.h3 },
  body: { ...typography.body },
  small: { ...typography.caption },
  link: { ...typography.button },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chipTarget: { minHeight: 44, justifyContent: 'center' },
  fold: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 44,
    paddingHorizontal: 4,
  },
  foldTitle: { ...typography.subhead, fontWeight: '600', flex: 1 },
  groupRow: { paddingHorizontal: 16, paddingVertical: 12, gap: 4 },
  groupHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  groupTitle: { ...typography.body, flex: 1 },
  code: { fontWeight: '700' },
  dot: { width: 10, height: 10, borderRadius: radii.pillFull },
  names: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 12 },
  nameTarget: { minHeight: 44, justifyContent: 'center' },
});
