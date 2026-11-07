// Fila de persona: iniciales (o foto), nombre, línea secundaria, marcas y lo
// que vaya a la derecha (la marca de asistencia, un chevron…). Tocar y
// mantener pulsado son de quien la usa; las dos cosas tienen que tener también
// un camino visible (accesibilidad), que pone la pantalla.

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PressableFeedback } from 'heroui-native';
import typography from '@/constants/typography';
import { radii } from '@/constants/uiStyles';
import type { PersonSummary } from '@/services/comunica/contract';
import PersonAvatar, { initialsOf } from './PersonAvatar';
import PersonBadges, { badgesLabel } from './PersonBadges';
import { useComunicaTheme } from './useComunicaTheme';

interface Props {
  person: Pick<
    PersonSummary,
    'id' | 'firstName' | 'lastName' | 'photoUrl' | 'badges'
  >;
  subtitle?: string;
  right?: React.ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  /** Lo que dice el lector de pantalla además del nombre («Vino»…). */
  stateLabel?: string;
  disabled?: boolean;
  /** Pista de qué hace tocar («Toca para marcar»). */
  accessibilityHint?: string;
  /**
   * Lo que va debajo de la línea secundaria en vez de los iconos de las
   * marcas (las pastillas de texto de Grupos y fichas, plan 05).
   */
  below?: React.ReactNode;
  /** El texto de las marcas para el lector, si `below` las pinta. */
  marksLabel?: string;
  /** Acciones del lector de pantalla (la hoja de salud, «Vincular»). */
  accessibilityActions?: { name: string; label: string }[];
  onAccessibilityAction?: (name: string) => void;
  /** Una pastilla delante de la línea secundaria («Sin grupo» en ámbar). */
  subtitleLead?: { text: string; color: string; background: string };
  /** Avatar en el acento (los monitores en las listas de un evento). */
  avatarTone?: 'accent';
}

export const initials = initialsOf;

export default function PersonRow({
  person,
  subtitle,
  right,
  onPress,
  onLongPress,
  stateLabel,
  disabled,
  accessibilityHint,
  below,
  marksLabel,
  accessibilityActions,
  onAccessibilityAction,
  subtitleLead,
  avatarTone,
}: Props) {
  const t = useComunicaTheme();
  const name = `${person.firstName} ${person.lastName}`;
  const label = [
    name,
    subtitleLead?.text,
    subtitle,
    below ? marksLabel : badgesLabel(person.badges),
    stateLabel,
  ]
    .filter(Boolean)
    .join(', ');

  const content = (
    <>
      <PersonAvatar
        person={person}
        background={avatarTone ? t.accentFill : undefined}
        ink={avatarTone ? t.onAccent : undefined}
      />
      <View style={styles.body}>
        <Text style={[styles.name, { color: t.text }]} numberOfLines={2}>
          <Text style={styles.first}>{person.firstName}</Text> {person.lastName}
        </Text>
        {subtitle || subtitleLead || person.badges ? (
          <View style={styles.meta}>
            {subtitleLead ? (
              <View
                style={[
                  styles.lead,
                  { backgroundColor: subtitleLead.background },
                ]}
              >
                <Text
                  style={[styles.leadText, { color: subtitleLead.color }]}
                  numberOfLines={1}
                >
                  {subtitleLead.text}
                </Text>
              </View>
            ) : null}
            {subtitle ? (
              <Text
                style={[styles.subtitle, { color: t.textSecondary }]}
                numberOfLines={2}
              >
                {subtitle}
              </Text>
            ) : null}
            {below ? null : <PersonBadges badges={person.badges} />}
          </View>
        ) : null}
        {below}
      </View>
      {right}
    </>
  );

  if (!onPress && !onLongPress) {
    return (
      <View
        style={styles.row}
        accessible
        accessibilityLabel={label}
        accessibilityActions={accessibilityActions}
        onAccessibilityAction={(e) =>
          onAccessibilityAction?.(e.nativeEvent.actionName)
        }
      >
        {content}
      </View>
    );
  }

  return (
    <PressableFeedback
      onPress={onPress}
      onLongPress={onLongPress}
      isDisabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      accessibilityActions={accessibilityActions}
      onAccessibilityAction={(e) =>
        onAccessibilityAction?.(e.nativeEvent.actionName)
      }
      style={[styles.row, disabled && styles.disabled]}
    >
      {content}
      <PressableFeedback.Highlight />
    </PressableFeedback>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 56,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  disabled: { opacity: 0.5 },
  body: { flex: 1, gap: 2 },
  name: { ...typography.body },
  first: { fontWeight: '600' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  subtitle: { ...typography.caption, flexShrink: 1 },
  lead: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: radii.xs },
  leadText: { ...typography.footnote, fontWeight: '700' },
});
