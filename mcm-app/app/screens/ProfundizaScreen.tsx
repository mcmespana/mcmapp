import React, { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { Collapsible } from '@/components/Collapsible';
import colors from '@/constants/colors';
import spacing from '@/constants/spacing';
import profundizaData from '@/assets/jubileo-profundiza.json';

interface Pagina {
  titulo: string;
  texto: string;
  subtitulo?: string;
  color?: string;
}

export default function ProfundizaScreen() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const paginas: Pagina[] = (profundizaData as any).paginas as Pagina[];

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <ThemedText style={styles.intro}>{(profundizaData as any).introduccion}</ThemedText>
      {paginas.map((p, idx) => (
        <Collapsible
          key={idx}
          title={p.titulo}
          isOpen={openIndex === idx}
          onToggle={(value) => setOpenIndex(value ? idx : null)}
        >
          <ThemedText style={styles.text}>{p.texto}</ThemedText>
        </Collapsible>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.lg,
    backgroundColor: colors.background,
  },
  intro: {
    fontSize: 17,
    textAlign: 'justify',
    marginBottom: spacing.lg,
    color: colors.text,
  },
  text: {
    fontSize: 16,
    color: colors.text,
  },
});
