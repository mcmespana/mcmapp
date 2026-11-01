// Los datos clave de una ficha (`stic-record-view.php`, «facts»): una fila
// por dato, con su icono, la etiqueta pequeña y el dato en grande. Nada de
// «ETIQUETA: valor». Una fila puede ser pulsable entera (el lugar abre el
// mapa): 44 pt de toque como mínimo y una flecha que lo dice.

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PressableFeedback } from 'heroui-native';
import { IconSymbol } from '@/components/ui/IconSymbol';
import typography from '@/constants/typography';
import { h } from '@/utils/haptics';
import Section from '../Section';
import { useComunicaTheme } from '../useComunicaTheme';

type IconName = React.ComponentProps<typeof IconSymbol>['name'];

export interface Fact {
  key: string;
  icon: IconName;
  label: string;
  value: string;
  /** Toda la fila es el enlace. */
  onPress?: () => void;
  /** Lo que dice el lector de pantalla («Ver en el mapa: Albergue…»). */
  accessibilityLabel?: string;
}

function FactRow({ fact }: { fact: Fact }) {
  const t = useComunicaTheme();
  const body = (
    <>
      <IconSymbol name={fact.icon} size={20} color={t.textSecondary} />
      <View style={styles.text}>
        <Text style={[styles.label, { color: t.textSecondary }]}>
          {fact.label}
        </Text>
        <Text
          style={[
            styles.value,
            { color: fact.onPress ? t.accentText : t.text },
          ]}
        >
          {fact.value}
        </Text>
      </View>
      {fact.onPress ? (
        <IconSymbol name="arrow.up.right" size={16} color={t.accentText} />
      ) : null}
    </>
  );
  if (!fact.onPress) {
    return (
      <View style={styles.row} accessible>
        {body}
      </View>
    );
  }
  const onPress = fact.onPress;
  return (
    <PressableFeedback
      onPress={() => {
        h.tap();
        onPress();
      }}
      accessibilityRole="link"
      accessibilityLabel={fact.accessibilityLabel ?? fact.value}
      style={styles.row}
    >
      {body}
      <PressableFeedback.Highlight />
    </PressableFeedback>
  );
}

export default function FactList({ facts }: { facts: Fact[] }) {
  if (facts.length === 0) return null;
  return (
    <Section>
      {facts.map((f) => (
        <FactRow key={f.key} fact={f} />
      ))}
    </Section>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  text: { flex: 1, gap: 2 },
  label: { ...typography.caption },
  value: { ...typography.body },
});
