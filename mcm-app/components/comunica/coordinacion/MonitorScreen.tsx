// components/comunica/coordinacion/MonitorScreen.tsx
//
// La FICHA DEL MONITOR (plan 06, regla 12; `single_stic_pasar_lista_monitor.php`),
// en este orden: quién es (y si le falta algo OBLIGATORIO), cómo contactarle,
// cómo va este curso (tres pistas que NO se promedian: sábados, reuniones y
// las listas de sus grupos), sus grupos, los seguimientos, por dónde ha pasado
// y el papeleo al final, plegado. Sin familia y sin salud. Anterior/siguiente
// sobre «Tu equipo» o, con `desde=grupo:<id>`, sobre los de ese grupo.

import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { PressableFeedback } from 'heroui-native';
import BottomSheet from '@/components/BottomSheet';
import { IconSymbol } from '@/components/ui/IconSymbol';
import typography from '@/constants/typography';
import { radii } from '@/constants/uiStyles';
import type {
  Mark,
  MonitorDetail,
  Phone,
  Square,
  TeamMember,
} from '@/services/comunica/contract';
import {
  useCoordination,
  useMonitorDetail,
} from '@/hooks/comunica/coordination';
import { useGroupDetail } from '@/hooks/comunica/useGrupos';
import { useMe } from '@/hooks/comunica/useMe';
import { useToast } from '@/contexts/AppToastContext';
import { h } from '@/utils/haptics';
import {
  complianceFlag,
  complianceNote,
  groupMeta,
  identityLine,
  LIST_SQUARE_LABEL,
  meetingsTrack,
  missingRequirements,
  ROLL_CALL_FOOTNOTE,
  rollCallTrack,
  squareLine,
  trainingSummary,
  weeklyTrack,
  withNames,
  type TrackView,
} from '@/utils/comunica/monitorDetail';
import { coordinationAccess } from '@/utils/comunica/scope';
import { shortDate } from '@/utils/comunica/sessions';
import { neighborsOf, teamOrder } from '@/utils/comunica/team';
import AreaScreen from '../comun/AreaScreen';
import AreaState from '../comun/AreaState';
import PersonAvatar from '../comun/PersonAvatar';
import StatusChip from '../comun/StatusChip';
import { MARK_FILL } from '../comun/theme';
import { useComunicaTheme } from '../comun/useComunicaTheme';
import AssignSheet from '../grupos/AssignSheet';
import { FichaSection, Fold, openUrl, Pager } from '../grupos/FichaParts';
import { useGroups } from '@/hooks/comunica/usePasarLista';
import FollowUps from './FollowUps';

export const FORBIDDEN_MONITOR = {
  title: 'Este monitor no está en los grupos de tu alcance.',
};

export default function MonitorScreen({
  monitorId,
  from,
}: {
  monitorId: string;
  /** `grupo:<id>`: anterior/siguiente sobre los de ese grupo. */
  from?: string;
}) {
  const q = useMonitorDetail(monitorId);
  return (
    <>
      <Stack.Screen
        options={{
          title: q.data
            ? `${q.data.monitor.firstName} ${q.data.monitor.lastName.split(' ')[0]}`
            : 'Ficha',
        }}
      />
      <AreaState query={q} skeleton="cards" forbidden={FORBIDDEN_MONITOR}>
        {(data) => (
          <Ficha data={data} from={from} refetch={() => q.refetch()} />
        )}
      </AreaState>
    </>
  );
}

function Ficha({
  data,
  from,
  refetch,
}: {
  data: MonitorDetail;
  from?: string;
  refetch: () => Promise<unknown>;
}) {
  const t = useComunicaTheme();
  const router = useRouter();
  const { me } = useMe();
  const access = coordinationAccess(me?.roles);
  const groups = useGroups();
  const [assigning, setAssigning] = useState(false);
  const m = data.monitor;
  const missing = missingRequirements(data.paperwork.compliance);
  const neighbors = useNeighbors(m.id, from);

  return (
    <AreaScreen onRefresh={refetch}>
      <View style={styles.identity}>
        <PersonAvatar person={m} size={72} />
        <View style={styles.identityText}>
          <Text
            style={[styles.name, { color: t.text }]}
            accessibilityRole="header"
          >
            {m.firstName} {m.lastName}
          </Text>
          <Text style={[styles.small, { color: t.textSecondary }]}>
            {identityLine(m)}
          </Text>
          {missing ? <StatusChip label={missing} tone="warning" /> : null}
        </View>
      </View>

      <Contact monitor={m} />

      <FichaSection title="Cómo va este curso">
        <View style={[styles.card, { backgroundColor: t.card }]}>
          <TrackRow title="Sábados" view={weeklyTrack(data.weekly)} />
          <TrackRow title="Reuniones" view={meetingsTrack(data.meetings)} />
          {data.rollCalls.map((rc) => {
            const tr = rollCallTrack(rc.squares);
            return (
              <ListsRow
                key={rc.group.id}
                title={`Listas del ${rc.group.code ?? 'grupo'}`}
                score={tr.score}
                foot={tr.foot}
                squares={rc.squares}
              />
            );
          })}
        </View>
        {data.rollCalls.length > 0 ? (
          <Text style={[styles.small, { color: t.textSecondary }]}>
            {ROLL_CALL_FOOTNOTE}
          </Text>
        ) : null}
      </FichaSection>

      <FichaSection title="Sus grupos">
        <View style={[styles.card, { backgroundColor: t.card }]}>
          {data.groups.length === 0 ? (
            <View style={styles.row}>
              <Text style={[styles.body, { color: t.text }]}>
                Sin grupo asignado
              </Text>
              {access.coordination && m.unassigned?.kind === 'none' ? (
                <PressableFeedback
                  onPress={() => {
                    h.tap();
                    setAssigning(true);
                  }}
                  accessibilityRole="button"
                  style={styles.tapTarget}
                >
                  <Text style={[styles.link, { color: t.accentText }]}>
                    Vincular
                  </Text>
                </PressableFeedback>
              ) : null}
            </View>
          ) : (
            data.groups.map((g) => {
              const leads = g.role === 'leads' && g.group.inRollCall;
              const body = (
                <>
                  <Text style={[styles.body, { color: t.text }]}>
                    <Text style={styles.bold}>
                      {g.group.code ? `${g.group.code} ` : ''}
                    </Text>
                    {g.group.name}
                    <Text style={{ color: t.textSecondary }}>
                      {' · '}
                      {g.role === 'leads' ? 'lo lleva' : 'su grupo'}
                    </Text>
                  </Text>
                  <Text style={[styles.small, { color: t.textSecondary }]}>
                    {[
                      groupMeta(g),
                      g.colleagues.length
                        ? `Con ${withNames(g.colleagues.map((c) => c.name.split(' ')[0]))}`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                </>
              );
              return leads ? (
                <PressableFeedback
                  key={g.group.id}
                  onPress={() =>
                    router.push({
                      pathname: '/comunica/pasar-lista/[groupId]',
                      params: { groupId: g.group.id },
                    })
                  }
                  accessibilityRole="button"
                  accessibilityHint="Abre su lista"
                  style={styles.groupRow}
                >
                  <View style={styles.flex}>{body}</View>
                  <IconSymbol
                    name="chevron.right"
                    size={16}
                    color={t.textMuted}
                  />
                  <PressableFeedback.Highlight />
                </PressableFeedback>
              ) : (
                <View key={g.group.id} style={styles.groupRow}>
                  <View style={styles.flex}>{body}</View>
                </View>
              );
            })
          )}
        </View>
      </FichaSection>

      <FollowUps monitorId={m.id} />

      {data.history.length > 0 ? (
        <FichaSection title="Por dónde ha pasado">
          <View style={[styles.card, { backgroundColor: t.card }]}>
            {data.history.map((season) => (
              <View key={season.season} style={styles.row}>
                <Text style={[styles.body, styles.bold, { color: t.text }]}>
                  {season.season}
                  {season.current ? (
                    <Text style={{ color: t.textSecondary }}>
                      {' '}
                      · este curso
                    </Text>
                  ) : null}
                </Text>
                {season.groups.map((g, i) => (
                  <Text
                    key={`${g.code}-${i}`}
                    style={[styles.small, { color: t.textSecondary }]}
                  >
                    {[
                      [g.code, g.name].filter(Boolean).join(' '),
                      g.schoolLevels.join(', '),
                      g.colleagues.length
                        ? `con ${withNames(g.colleagues)}`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                ))}
              </View>
            ))}
          </View>
        </FichaSection>
      ) : null}

      <Paperwork paperwork={data.paperwork} />

      <Pager
        prev={neighbors.prev}
        next={neighbors.next}
        onGo={(id) =>
          router.replace({
            pathname: '/comunica/coordinacion/monitor/[id]',
            params: { id, ...(from ? { desde: from } : {}) },
          })
        }
      />

      <AssignSheet
        person={
          assigning && m.unassigned
            ? {
                id: m.id,
                firstName: m.firstName,
                schoolLevel: m.schoolLevel,
                unassignedMembershipId: m.unassigned.membershipId,
              }
            : null
        }
        groups={groups.data?.groups ?? []}
        onClose={() => setAssigning(false)}
      />
    </AreaScreen>
  );
}

/** Anterior y siguiente: los de «Tu equipo» o, desde un grupo, los suyos. */
function useNeighbors(id: string, from?: string) {
  const groupId = from?.startsWith('grupo:') ? from.slice(6) : '';
  const home = useCoordination(!groupId);
  const group = useGroupDetail(groupId);
  const list: { id: string; firstName: string }[] = groupId
    ? (group.data?.monitors ?? []).map((x) => ({
        id: x.id,
        firstName: x.firstName,
      }))
    : teamOrder(home.data?.team ?? ([] as TeamMember[]));
  return neighborsOf(list, id);
}

function Contact({ monitor: m }: { monitor: MonitorDetail['monitor'] }) {
  const t = useComunicaTheme();
  const { toast } = useToast();
  const name = m.firstName;
  if (!m.mobile && !m.otherPhone && !m.email) return null;
  return (
    <View style={[styles.card, { backgroundColor: t.card }]}>
      {m.mobile ? (
        <View style={styles.contactRow}>
          <View style={styles.flex}>
            <Text style={[styles.body, { color: t.text }]}>
              {m.mobile.display}
            </Text>
            <Text style={[styles.small, { color: t.textSecondary }]}>
              Móvil
            </Text>
          </View>
          {!m.doNotCall ? (
            <>
              <Round
                icon="message.fill"
                label={`WhatsApp a ${name}`}
                onPress={() => void openUrl(whatsapp(m.mobile!))}
              />
              <Round
                icon="phone.fill"
                label={`Llamar a ${name}`}
                onPress={() => void openUrl(`tel:${m.mobile!.tel}`)}
              />
            </>
          ) : (
            <Round
              icon="message.fill"
              label={`WhatsApp a ${name}`}
              onPress={() => void openUrl(whatsapp(m.mobile!))}
            />
          )}
        </View>
      ) : null}
      {m.doNotCall ? (
        <Text style={[styles.small, styles.pad, { color: t.textSecondary }]}>
          Ha pedido que no se le llame por teléfono.
        </Text>
      ) : null}
      {m.email ? (
        <View style={styles.contactRow}>
          <Text style={[styles.body, styles.flex, { color: t.text }]}>
            {m.email}
          </Text>
          <PressableFeedback
            onPress={() => {
              h.tap();
              void Clipboard.setStringAsync(m.email!).then(() =>
                toast.show({ variant: 'success', label: 'Correo copiado' }),
              );
            }}
            accessibilityRole="button"
            accessibilityLabel={`Copiar el correo de ${name}`}
            style={styles.tapTarget}
          >
            <Text style={[styles.link, { color: t.accentText }]}>Copiar</Text>
          </PressableFeedback>
        </View>
      ) : null}
      {m.otherPhone ? (
        <View style={styles.contactRow}>
          <View style={styles.flex}>
            <Text style={[styles.body, { color: t.text }]}>
              {m.otherPhone.display}
            </Text>
            <Text style={[styles.small, { color: t.textSecondary }]}>
              Otro teléfono · para una urgencia
            </Text>
          </View>
          <Round
            icon="phone.fill"
            label={`Llamar al otro teléfono de ${name}`}
            onPress={() => void openUrl(`tel:${m.otherPhone!.tel}`)}
          />
        </View>
      ) : null}
    </View>
  );
}

const whatsapp = (p: Phone) => `https://wa.me/${p.whatsapp}`;

function Round({
  icon,
  label,
  onPress,
}: {
  icon: 'message.fill' | 'phone.fill';
  label: string;
  onPress: () => void;
}) {
  const t = useComunicaTheme();
  return (
    <PressableFeedback
      onPress={() => {
        h.tap();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[styles.round, { backgroundColor: t.backgroundSunken }]}
    >
      <IconSymbol name={icon} size={18} color={t.accentText} />
      <PressableFeedback.Highlight />
    </PressableFeedback>
  );
}

/** Una pista entera se toca: abre una hoja con cada sesión y su porqué. */
function TrackRow({ title, view }: { title: string; view: TrackView | null }) {
  const t = useComunicaTheme();
  const [open, setOpen] = useState(false);
  if (!view) return null;
  if (view.kind === 'message') {
    return (
      <View style={styles.row}>
        <Text style={[styles.body, styles.bold, { color: t.text }]}>
          {title}
        </Text>
        <Text style={[styles.small, { color: t.textSecondary }]}>
          {view.text}
        </Text>
      </View>
    );
  }
  return (
    <>
      <PressableFeedback
        onPress={() => {
          h.tap();
          setOpen(true);
        }}
        accessibilityRole="button"
        accessibilityLabel={`${title}: ${view.score}. ${view.foot}`}
        accessibilityHint="Abre cada sesión con su marca"
        style={styles.row}
      >
        <View style={styles.trackHead}>
          <Text style={[styles.body, styles.bold, { color: t.text }]}>
            {title}
          </Text>
          <Text
            style={[
              styles.body,
              { color: view.scoreMuted ? t.textMuted : t.text },
            ]}
          >
            {view.score}
          </Text>
        </View>
        <Squares marks={view.squares.map((s) => s.mark)} />
        {view.foot ? (
          <Text style={[styles.small, { color: t.textSecondary }]}>
            {view.foot}
          </Text>
        ) : null}
        {view.absences?.map((a) => (
          <Text key={a.what} style={[styles.small, { color: t.textSecondary }]}>
            {a.what} · {a.why}
          </Text>
        ))}
        <PressableFeedback.Highlight />
      </PressableFeedback>
      <SquaresSheet
        title={title}
        visible={open}
        squares={view.squares}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

function ListsRow({
  title,
  score,
  foot,
  squares,
}: {
  title: string;
  score: string;
  foot: string;
  squares: MonitorDetail['rollCalls'][number]['squares'];
}) {
  const t = useComunicaTheme();
  const [open, setOpen] = useState(false);
  return (
    <>
      <PressableFeedback
        onPress={() => {
          h.tap();
          setOpen(true);
        }}
        accessibilityRole="button"
        accessibilityLabel={`${title}: ${score}. ${foot}`}
        style={styles.row}
      >
        <View style={styles.trackHead}>
          <Text style={[styles.body, styles.bold, { color: t.text }]}>
            {title}
          </Text>
          <Text style={[styles.body, { color: t.text }]}>{score}</Text>
        </View>
        <View style={styles.squares}>
          {squares.map((s) => (
            <View
              key={s.sessionId}
              style={[
                styles.square,
                s.state === 'mine'
                  ? { backgroundColor: MARK_FILL.yes }
                  : s.state === 'other'
                    ? { backgroundColor: MARK_FILL.partial }
                    : s.state === 'skipped'
                      ? { backgroundColor: t.separator }
                      : {
                          borderColor: t.warningIcon,
                          borderWidth: StyleSheet.hairlineWidth * 2,
                        },
              ]}
            />
          ))}
        </View>
        {foot ? (
          <Text style={[styles.small, { color: t.textSecondary }]}>{foot}</Text>
        ) : null}
        <PressableFeedback.Highlight />
      </PressableFeedback>
      <BottomSheet visible={open} onClose={() => setOpen(false)} title={title}>
        <View style={styles.sheet}>
          {squares.map((s) => (
            <Text key={s.sessionId} style={[styles.body, { color: t.text }]}>
              {shortDate(s.date)} · {LIST_SQUARE_LABEL[s.state]}
            </Text>
          ))}
        </View>
      </BottomSheet>
    </>
  );
}

function Squares({ marks }: { marks: Mark[] }) {
  const t = useComunicaTheme();
  return (
    <View style={styles.squares}>
      {marks.map((mk, i) => (
        <View
          key={i}
          style={[
            styles.square,
            mk
              ? { backgroundColor: MARK_FILL[mk] }
              : {
                  borderColor: t.textMuted,
                  borderWidth: StyleSheet.hairlineWidth * 2,
                },
          ]}
        />
      ))}
    </View>
  );
}

function SquaresSheet({
  title,
  visible,
  squares,
  onClose,
}: {
  title: string;
  visible: boolean;
  squares: Square[];
  onClose: () => void;
}) {
  const t = useComunicaTheme();
  return (
    <BottomSheet visible={visible} onClose={onClose} title={title}>
      <View style={styles.sheet}>
        {[...squares].reverse().map((s) => (
          <Text key={s.sessionId} style={[styles.body, { color: t.text }]}>
            {squareLine(s)}
          </Text>
        ))}
      </View>
    </BottomSheet>
  );
}

function Paperwork({
  paperwork: p,
}: {
  paperwork: MonitorDetail['paperwork'];
}) {
  const t = useComunicaTheme();
  const flag = complianceFlag(p.compliance);
  return (
    <FichaSection title="Papeleo">
      <Fold title="En regla" summary={flag.text}>
        {p.compliance.map((c) => (
          <View key={c.label} style={styles.kv}>
            <IconSymbol
              name={c.ok ? 'checkmark.circle.fill' : 'xmark.circle.fill'}
              size={18}
              color={
                c.ok ? MARK_FILL.yes : c.required ? t.dangerText : t.textMuted
              }
            />
            <View style={styles.flex}>
              <Text style={[styles.body, { color: t.text }]}>{c.label}</Text>
              {complianceNote(c) ? (
                <Text style={[styles.small, { color: t.textSecondary }]}>
                  {complianceNote(c)}
                </Text>
              ) : null}
            </View>
          </View>
        ))}
      </Fold>
      {p.mcm.length > 0 ? (
        <Fold title="Datos MCM">
          {p.mcm.map((r) => (
            <KeyValue key={r.label} label={r.label} value={r.value} />
          ))}
        </Fold>
      ) : null}
      {p.training.length > 0 || p.congresses.length > 0 ? (
        <Fold title="Formación" summary={trainingSummary(p.training)}>
          {p.training.map((r) => (
            <KeyValue
              key={r.label}
              label={r.label}
              value={[r.value, r.note, r.warn].filter(Boolean).join(' · ')}
            />
          ))}
          {p.congresses.length > 0 ? (
            <KeyValue label="Congresos" value={p.congresses.join(', ')} />
          ) : null}
          {p.academic ? <KeyValue label="Estudios" value={p.academic} /> : null}
        </Fold>
      ) : null}
      {p.personal.length > 0 ? (
        <Fold title="Datos personales">
          {p.personal.map((r) => (
            <KeyValue key={r.label} label={r.label} value={r.value} />
          ))}
        </Fold>
      ) : null}
    </FichaSection>
  );
}

function KeyValue({ label, value }: { label: string; value: string }) {
  const t = useComunicaTheme();
  return (
    <View style={styles.kvText}>
      <Text style={[styles.small, { color: t.textSecondary }]}>{label}</Text>
      <Text style={[styles.body, { color: t.text }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  identity: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  identityText: { flex: 1, gap: 4, alignItems: 'flex-start' },
  name: { ...typography.h2 },
  body: { ...typography.body },
  bold: { fontWeight: '600' },
  small: { ...typography.caption },
  link: { ...typography.button },
  flex: { flex: 1 },
  pad: { paddingHorizontal: 16, paddingBottom: 12 },
  card: { borderRadius: radii.lg, overflow: 'hidden' },
  row: { padding: 16, gap: 6 },
  groupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 16,
    minHeight: 56,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    minHeight: 56,
  },
  round: {
    width: 44,
    height: 44,
    borderRadius: radii.pillFull,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tapTarget: { minHeight: 44, justifyContent: 'center' },
  trackHead: { flexDirection: 'row', justifyContent: 'space-between' },
  squares: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  square: { width: 14, height: 14, borderRadius: radii.xs },
  sheet: { gap: 8, paddingBottom: 16 },
  kv: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingVertical: 6,
  },
  kvText: { paddingVertical: 6, gap: 2 },
});
