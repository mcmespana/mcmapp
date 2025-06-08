import React, { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { Collapsible } from '@/components/Collapsible';
import groupsData from '@/assets/jubileo-grupos.json';
import colors from '@/constants/colors';
import spacing from '@/constants/spacing';

interface Grupo {
  nombre: string;
  responsable: string;
  miembros: string[];
  subtitulo?: string;
}

export default function GruposScreen() {
  const categorias = Object.keys(groupsData) as Array<keyof typeof groupsData>;
  const [openCat, setOpenCat] = useState<string | null>(null);
  const [openGroup, setOpenGroup] = useState<string | null>(null);

  const total = categorias.reduce(
    (sum, c) =>
      sum + (groupsData as any)[c].reduce((s: number, g: Grupo) => s + g.miembros.length, 0),
    0
  );

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <ThemedText style={styles.total}>{`Total participantes: ${total}`}</ThemedText>
      {categorias.map((cat) => {
        const grupos: Grupo[] = (groupsData as any)[cat] as Grupo[];
        const catCount = grupos.reduce((s, g) => s + g.miembros.length, 0);
        return (
          <Collapsible
            key={cat}
            title={`${cat} (${catCount})`}
            isOpen={openCat === cat}
            onToggle={(open) => {
              setOpenCat(open ? cat : null);
              setOpenGroup(null);
            }}
          >
            {grupos.map((g, idx) => (
              <Collapsible
                key={idx}
                title={`${g.nombre} - ${g.responsable} (${g.miembros.length})`}
                isOpen={openGroup === `${cat}-${idx}`}
                onToggle={(open) => setOpenGroup(open ? `${cat}-${idx}` : null)}
              >
                {g.subtitulo && <ThemedText style={styles.subtitle}>{g.subtitulo}</ThemedText>}
                {g.miembros.map((m, i) => (
                  <ThemedText key={i} style={styles.member}>{m}</ThemedText>
                ))}
              </Collapsible>
            ))}
          </Collapsible>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.lg,
    backgroundColor: colors.background,
  },
  total: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: spacing.lg,
    color: colors.text,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: spacing.sm,
    color: colors.text,
  },
  member: {
    fontSize: 15,
    color: colors.text,
  },
});
