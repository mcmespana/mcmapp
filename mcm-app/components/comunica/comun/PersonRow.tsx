// Fila de persona: iniciales (o foto), nombre, línea secundaria, marcas y lo
// que vaya a la derecha (la marca de asistencia, un chevron…). Tocar y
// mantener pulsado son de quien la usa; las dos cosas tienen que tener también
// un camino visible (accesibilidad), que pone la pantalla.

import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { PressableFeedback } from 'heroui-native';
import { radii } from '@/constants/uiStyles';
import typography from '@/constants/typography';
import type { PersonSummary } from '@/services/comunica/contract';
import PersonBadges, { badgesLabel } from './PersonBadges';
import { useComunicaTheme } from './useComunicaTheme';

const AVATAR = 40;

interface Props {
  person: PersonSummary;
  subtitle?: string;
  right?: React.ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  /** Lo que dice el lector de pantalla además del nombre («Vino»…). */
  stateLabel?: string;
  disabled?: boolean;
  /** Pista de qué hace tocar («Toca para marcar»). */
  accessibilityHint?: string;
}

export const initials = (p: Pick<PersonSummary, 'firstName' | 'lastName'>) =>
  `${p.firstName.charAt(0)}${p.lastName.charAt(0)}`.toUpperCase();

export default function PersonRow({
  person,
  subtitle,
  right,
  onPress,
  onLongPress,
  stateLabel,
  disabled,
  accessibilityHint,
}: Props) {
  const t = useComunicaTheme();
  const name = `${person.firstName} ${person.lastName}`;
  const label = [name, subtitle, badgesLabel(person.badges), stateLabel]
    .filter(Boolean)
    .join(', ');

  const content = (
    <>
      {person.photoUrl ? (
        <Image source={{ uri: person.photoUrl }} style={styles.avatar} />
      ) : (
        <View style={[styles.avatar, { backgroundColor: t.backgroundSunken }]}>
          <Text style={[styles.initials, { color: t.textSecondary }]}>
            {initials(person)}
          </Text>
        </View>
      )}
      <View style={styles.body}>
        <Text style={[styles.name, { color: t.text }]} numberOfLines={2}>
          <Text style={styles.first}>{person.firstName}</Text> {person.lastName}
        </Text>
        {subtitle || person.badges ? (
          <View style={styles.meta}>
            {subtitle ? (
              <Text
                style={[styles.subtitle, { color: t.textSecondary }]}
                numberOfLines={1}
              >
                {subtitle}
              </Text>
            ) : null}
            <PersonBadges badges={person.badges} />
          </View>
        ) : null}
      </View>
      {right}
    </>
  );

  if (!onPress && !onLongPress) {
    return (
      <View style={styles.row} accessible accessibilityLabel={label}>
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
      style={[styles.row, disabled && styles.disabled]}
    >
      <PressableFeedback.Highlight />
      {content}
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
  avatar: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: radii.pillFull,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: { ...typography.subhead, fontWeight: '600' },
  body: { flex: 1, gap: 2 },
  name: { ...typography.body },
  first: { fontWeight: '600' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  subtitle: { ...typography.caption, flexShrink: 1 },
});
