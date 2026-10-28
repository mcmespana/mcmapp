// Una sección del formulario (plan 09): el título pequeño y UNA superficie con
// los campos separados por un hairline. Es `Section` (la lista agrupada de
// iOS que ya usa la portada), así que se ve igual que el resto del área.
// `FormNote` es la nota de sección del plugin (`stic-form-note`): una fila más,
// sin caja dentro de la caja.

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { IconSymbol } from '@/components/ui/IconSymbol';
import typography from '@/constants/typography';
import Section from '../Section';
import { useComunicaTheme } from '../useComunicaTheme';

type IconName = React.ComponentProps<typeof IconSymbol>['name'];

export default function FormSection({
  title,
  footer,
  children,
}: {
  title: string;
  /** Una línea gris bajo la tarjeta (lo que aclara la sección entera). */
  footer?: string;
  children: React.ReactNode;
}) {
  const t = useComunicaTheme();
  return (
    <View style={styles.wrap}>
      <Section title={title}>{children}</Section>
      {footer ? (
        <Text style={[styles.footer, { color: t.textSecondary }]}>
          {footer}
        </Text>
      ) : null}
    </View>
  );
}

export function FormNote({
  icon,
  children,
}: {
  icon?: IconName;
  children: React.ReactNode;
}) {
  const t = useComunicaTheme();
  return (
    <View style={styles.note}>
      {icon ? (
        <IconSymbol name={icon} size={18} color={t.textSecondary} />
      ) : null}
      <Text style={[styles.noteText, { color: t.textSecondary }]}>
        {children}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  footer: { ...typography.caption, paddingHorizontal: 4 },
  note: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  noteText: { ...typography.subhead, flex: 1, lineHeight: 20 },
});
