// Una fila de la pantalla de marcar (plan 04), en sus dos modos:
//
//   · `participants` (la lista de un grupo): bajo el nombre, lo matizado
//     (Parcial, Justificada) y el motivo; a la derecha, la racha de ausencias.
//     Toca: sin marcar → vino → no vino.
//   · `monitors` (la lista de monitores, plan 06): una línea fija con sus
//     grupos y curso, el % pequeño al final (rojo si es bajo, solo con 4
//     marcas o más) y, debajo, la nota: lo matizado, el aviso en rojo («3
//     seguidas sin venir») y el motivo. Toca: vino ⇄ no vino.
//
// Mantener pulsado (o «Más opciones» del lector) abre la MISMA hoja en los dos
// modos (`MarkSheet`). No hay otra fila de marcar en el área.

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import typography from '@/constants/typography';
import type {
  Mark,
  PersonSummary,
  SetMark,
} from '@/services/comunica/contract';
import { MARK_LABEL, MARK_NOTE, streakLabel } from '@/utils/comunica/marks';
import { MarkIcon } from '../comun/MarkControl';
import PersonRow from '../comun/PersonRow';
import { useComunicaTheme } from '../comun/useComunicaTheme';

/** Un monitor no tiene marcas de chaval. */
export const NO_BADGES = {
  healthNote: false,
  noPhotos: false,
  notHomeAlone: false,
} as const;

/** Un monitor (plan 06) como persona de una fila o de la hoja. */
export const memberAsPerson = (m: {
  id: string;
  firstName: string;
  lastName: string;
  photoUrl?: string;
}): PersonSummary => ({
  id: m.id,
  firstName: m.firstName,
  lastName: m.lastName,
  ...(m.photoUrl ? { photoUrl: m.photoUrl } : {}),
  badges: { ...NO_BADGES },
});

interface Common {
  person: Pick<
    PersonSummary,
    'id' | 'firstName' | 'lastName' | 'photoUrl' | 'badges'
  >;
  mark: Mark;
  disabled: boolean;
  onTap: () => void;
  onSet: (m: SetMark) => void;
  onMore: () => void;
}

type Props = Common &
  (
    | { mode?: 'participants'; note: string; streak: number }
    | {
        mode: 'monitors';
        /** «C1 · C2 · 2 ESO» o «Sin grupo asignado». */
        line: string;
        pct: { pct: number; low: boolean; title: string } | null;
        /** La nota de debajo y si va en rojo (`monitorNote`). */
        note: { text: string | null; danger: boolean };
      }
  );

export default function RollRow(props: Props) {
  const t = useComunicaTheme();
  const { person, mark, disabled, onTap, onSet, onMore } = props;
  const monitors = props.mode === 'monitors';

  let subtitle: string | undefined;
  let below: React.ReactNode = null;
  let right: React.ReactNode = <MarkIcon mark={mark} />;
  let a11y: (string | null | undefined)[];

  if (props.mode === 'monitors') {
    // La línea fija y, al final, el % pequeño (rojo si es bajo).
    below = (
      <>
        <Text
          style={[styles.line, { color: t.textSecondary }]}
          numberOfLines={2}
        >
          {props.line}
          {props.pct ? (
            <Text style={{ color: props.pct.low ? t.dangerText : t.textMuted }}>
              {'  '}
              {props.pct.pct} %
            </Text>
          ) : null}
        </Text>
        {props.note.text ? (
          <Text
            style={[
              styles.line,
              {
                color: props.note.danger ? t.dangerText : t.textSecondary,
                fontWeight: props.note.danger ? '600' : '400',
              },
            ]}
            numberOfLines={1}
          >
            {props.note.text}
          </Text>
        ) : null}
      </>
    );
    a11y = [
      props.line,
      props.pct ? `${props.pct.pct} % de asistencia` : null,
      props.note.text,
      mark ? MARK_LABEL[mark] : MARK_LABEL.yes,
    ];
  } else {
    const lines = [
      mark ? MARK_NOTE[mark] : undefined,
      props.note || undefined,
    ].filter(Boolean) as string[];
    subtitle = lines.join(' · ') || undefined;
    if (props.streak >= 2) {
      right = (
        <View style={styles.right}>
          <Text style={[styles.streak, { color: t.dangerText }]}>
            {streakLabel(props.streak)}
          </Text>
          <MarkIcon mark={mark} />
        </View>
      );
    }
    a11y = [
      ...lines,
      props.streak >= 2 ? streakLabel(props.streak) : null,
      mark ? MARK_LABEL[mark] : 'Sin marcar',
    ];
  }

  // Nombre y primer apellido (en monitores, el nombre entero: son adultos y
  // se buscan por apellido).
  const shown = monitors
    ? person
    : { ...person, lastName: person.lastName.split(' ')[0] };

  return (
    <View
      accessible
      accessibilityLabel={[`${person.firstName} ${person.lastName}`, ...a11y]
        .filter(Boolean)
        .join(', ')}
      accessibilityHint={
        monitors ? 'Toca para marcar una falta' : 'Toca para vino o no vino'
      }
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
        person={shown}
        subtitle={subtitle}
        below={below ?? undefined}
        marksLabel={monitors ? '' : undefined}
        disabled={disabled}
        onPress={onTap}
        onLongPress={onMore}
        right={right}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  right: { alignItems: 'center', gap: 8, flexDirection: 'row' },
  streak: {
    ...typography.footnote,
    fontWeight: '600',
    maxWidth: 96,
    textAlign: 'right',
  },
  line: { ...typography.caption },
});
