// La asistencia en la ficha (plan 05, regla 19; `ficha.php` l.645-716 y
// `sticpa_pl_att_track`): porcentaje sobre las sesiones MARCADAS («Sin datos»
// si no hay ninguna, nunca 0 %), horas, barra, cuadraditos por mes con los
// eventos del curso en su fecha y redondos (fuera del porcentaje), la lista
// de eventos y la racha. En el móvil no hay `title` al pasar el ratón: tocar
// los cuadraditos abre una hoja con cada sesión.

import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { PressableFeedback } from 'heroui-native';
import BottomSheet from '@/components/BottomSheet';
import { IconSymbol } from '@/components/ui/IconSymbol';
import typography from '@/constants/typography';
import { radii } from '@/constants/uiStyles';
import type {
  ParticipantProfile,
  PersonEvent,
  SetMark,
} from '@/services/comunica/contract';
import { h } from '@/utils/haptics';
import {
  attendanceTrack,
  byMonth,
  EVENT_STATUS_LABEL,
  eventSquares,
  formatHours,
  STREAK_THRESHOLD,
  streakOf,
  timeline,
  type AttendanceTrack,
  type TimelineSquare,
} from '@/utils/comunica/attendance';
import { madridDay } from '@/utils/comunica/madrid';
import { MARK_LABEL } from '@/utils/comunica/marks';
import { shortDate } from '@/utils/comunica/sessions';
import { MARK_FILL } from '../comun/theme';
import { useComunicaTheme } from '../comun/useComunicaTheme';
import { FichaSection } from './FichaParts';

const SQ = 14;

const isMark = (s: PersonEvent['status']): s is SetMark => s in MARK_LABEL;

export const eventStatusLabel = (s: PersonEvent['status']) =>
  isMark(s) ? MARK_LABEL[s] : EVENT_STATUS_LABEL[s];

/** «10 oct – 11 oct · motivo». */
export function eventWhen(e: PersonEvent): string {
  const a = madridDay(new Date(e.startsAt));
  const b = madridDay(new Date(e.endsAt));
  const days = a === b ? shortDate(a) : `${shortDate(a)} – ${shortDate(b)}`;
  return e.reason ? `${days} · ${e.reason}` : days;
}

/** La línea de la hoja por sesión: «12 sep · Justificada · Examen». */
function squareLine(sq: TimelineSquare): string {
  if (sq.kind === 'event') {
    return [shortDate(sq.date), sq.name, eventStatusLabel(sq.status), sq.reason]
      .filter(Boolean)
      .join(' · ');
  }
  return [
    shortDate(sq.date),
    sq.mark ? MARK_LABEL[sq.mark] : 'Sin lista',
    sq.reason,
  ]
    .filter(Boolean)
    .join(' · ');
}

/** La pista de asistencia (barata: unas cuarenta sesiones; sin memo). */
export function useAttendance(profile: ParticipantProfile, now: Date) {
  const track: AttendanceTrack | null = profile.attendance
    ? attendanceTrack(
        profile.attendance.sessions,
        profile.attendance.marks,
        now,
        profile.attendance.reasons,
      )
    : null;
  const events = eventSquares(profile.events, now);
  return {
    track,
    streak: track ? streakOf(track) : 0,
    squares: timeline(track?.squares ?? [], events),
  };
}

export default function FichaAttendance({
  profile,
  model,
}: {
  profile: ParticipantProfile;
  model: ReturnType<typeof useAttendance>;
}) {
  const t = useComunicaTheme();
  const [sheet, setSheet] = useState(false);
  const { track, streak, squares } = model;
  if (!track && profile.events.length === 0) return null;
  const lastSession = [...squares].reverse().find((s) => s.kind === 'session');
  const months = byMonth(squares);
  const summary = track
    ? `Vino a ${track.attended} de ${track.counted} sesiones marcadas`
    : 'Eventos del curso';

  return (
    <FichaSection title="Asistencia">
      <View style={[styles.card, { backgroundColor: t.card }]}>
        {track ? (
          <>
            <View style={styles.top}>
              {track.pct === null ? (
                <Text style={[styles.pctNone, { color: t.textSecondary }]}>
                  Sin datos
                </Text>
              ) : (
                <Text style={[styles.pct, { color: t.text }]}>
                  {track.pct}
                  <Text style={styles.pctSign}>%</Text>
                </Text>
              )}
              <Text style={[styles.meta, { color: t.textSecondary }]}>
                {formatHours(track.hours)} h de {formatHours(track.hoursTotal)}{' '}
                h
              </Text>
            </View>
            <View
              style={[styles.bar, { backgroundColor: t.backgroundSunken }]}
              accessible
              accessibilityRole="progressbar"
              accessibilityLabel={
                track.pct === null
                  ? 'Sin datos de asistencia'
                  : `${track.pct} % de asistencia`
              }
            >
              <View
                style={[
                  styles.fill,
                  {
                    width: `${track.pct ?? 0}%`,
                    backgroundColor: MARK_FILL.yes,
                  },
                ]}
              />
            </View>
            <View style={styles.counts}>
              <Text style={[styles.main, { color: t.text }]}>
                {track.attended} de {track.counted} sesiones marcadas
              </Text>
              {track.unknown > 0 ? (
                <Text style={[styles.meta, { color: t.textSecondary }]}>
                  {track.unknown === 1
                    ? '1 sábado sin lista'
                    : `${track.unknown} sábados sin lista`}
                </Text>
              ) : null}
            </View>
          </>
        ) : null}

        {months.length > 0 ? (
          <PressableFeedback
            onPress={() => {
              h.select();
              setSheet(true);
            }}
            accessibilityRole="button"
            accessibilityLabel={`${summary}. Toca para ver cada sesión.`}
            style={styles.months}
          >
            {months.map((m) => (
              <View key={m.month} style={styles.monthRow}>
                <Text style={[styles.month, { color: t.textSecondary }]}>
                  {m.label}
                </Text>
                <View style={styles.squares}>
                  {m.squares.map((sq) => (
                    <Square
                      key={`${sq.kind}-${sq.id}`}
                      sq={sq}
                      last={sq === lastSession}
                    />
                  ))}
                </View>
              </View>
            ))}
          </PressableFeedback>
        ) : null}

        {profile.events.length > 0 ? (
          <View style={[styles.events, { borderTopColor: t.separator }]}>
            {profile.events.map((e) => (
              <View
                key={e.eventId}
                style={styles.event}
                accessible
                accessibilityLabel={`${e.name}, ${eventWhen(e)}, ${eventStatusLabel(e.status)}`}
              >
                <EventDot status={e.status} />
                <View style={styles.eventBody}>
                  <Text style={[styles.eventName, { color: t.text }]}>
                    {e.name}
                  </Text>
                  <Text style={[styles.meta, { color: t.textSecondary }]}>
                    {eventWhen(e)}
                  </Text>
                </View>
                <Text style={[styles.eventStatus, { color: t.textSecondary }]}>
                  {eventStatusLabel(e.status)}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>

      {streak >= STREAK_THRESHOLD ? (
        <View style={styles.streak} accessibilityRole="alert">
          <IconSymbol name="clock" size={16} color={t.dangerText} />
          <Text style={[styles.streakText, { color: t.dangerText }]}>
            Lleva {streak} ausencias seguidas.
          </Text>
        </View>
      ) : null}

      <BottomSheet
        visible={sheet}
        onClose={() => setSheet(false)}
        title="Asistencia"
      >
        <ScrollView style={styles.sheetScroll}>
          <View style={styles.sheetBody}>
            {[...squares].reverse().map((sq) => (
              <View key={`${sq.kind}-${sq.id}`} style={styles.sheetRow}>
                <Square sq={sq} />
                <Text style={[styles.sheetText, { color: t.text }]}>
                  {squareLine(sq)}
                </Text>
              </View>
            ))}
          </View>
        </ScrollView>
      </BottomSheet>
    </FichaSection>
  );
}

function Square({ sq, last }: { sq: TimelineSquare; last?: boolean }) {
  const t = useComunicaTheme();
  const mark =
    sq.kind === 'session' ? sq.mark : isMark(sq.status) ? sq.status : null;
  return (
    <View
      style={[
        styles.sq,
        sq.kind === 'event' && styles.round,
        mark
          ? { backgroundColor: MARK_FILL[mark] }
          : { borderWidth: 1.5, borderColor: t.textMuted },
        // La última sesión, con el mismo trazo fino en el color del texto
        // (`design.md` §8: nada de bordes de 2 px).
        last && { borderWidth: 1.5, borderColor: t.text },
      ]}
    />
  );
}

function EventDot({ status }: { status: PersonEvent['status'] }) {
  const t = useComunicaTheme();
  return (
    <View
      style={[
        styles.sq,
        styles.round,
        isMark(status)
          ? { backgroundColor: MARK_FILL[status] }
          : { borderWidth: 1.5, borderColor: t.textMuted },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radii.lg, padding: 16, gap: 12 },
  top: { flexDirection: 'row', alignItems: 'baseline', gap: 12 },
  pct: { ...typography.h1 },
  pctSign: { ...typography.title },
  pctNone: { ...typography.h3 },
  meta: { ...typography.caption },
  bar: { height: 8, borderRadius: radii.xs, overflow: 'hidden' },
  fill: { height: 8 },
  counts: { gap: 2 },
  main: { ...typography.subhead, fontWeight: '600' },
  months: { gap: 6 },
  monthRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  month: { ...typography.footnote, width: 30 },
  squares: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, flex: 1 },
  sq: { width: SQ, height: SQ, borderRadius: radii.xs / 2 },
  round: { borderRadius: radii.pillFull },
  events: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 8, gap: 8 },
  event: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  eventBody: { flex: 1 },
  eventName: { ...typography.subhead, fontWeight: '600' },
  eventStatus: { ...typography.caption, fontWeight: '600' },
  streak: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 4,
  },
  streakText: { ...typography.subhead, fontWeight: '600' },
  sheetScroll: { maxHeight: 520 },
  sheetBody: { gap: 10, paddingBottom: 16 },
  sheetRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sheetText: { ...typography.body, flex: 1 },
});
