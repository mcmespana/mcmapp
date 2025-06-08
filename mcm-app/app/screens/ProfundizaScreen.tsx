import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { List, Text } from 'react-native-paper';
import colors from '@/constants/colors';
import profundiza from '@/assets/jubileo-profundiza.json';

interface Pagina {
  titulo: string;
  subtitulo?: string;
  texto?: string;
  color?: string;
}

export default function ProfundizaScreen() {
  const data = profundiza as {
    titulo: string;
    introduccion: string;
    paginas: Pagina[];
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.mainTitle}>{data.titulo}</Text>
      <Text style={styles.intro}>{data.introduccion}</Text>
      <View style={{ marginTop: 16 }}>
        <List.AccordionGroup>
          {data.paginas.map((p, idx) => (
            <List.Accordion
              key={idx}
              id={String(idx)}
              title={p.titulo}
              titleStyle={styles.accordionTitle}
              style={[styles.accordion, { backgroundColor: p.color || colors.primary }]}
            >
              <View style={styles.accordionContent}>
                {p.subtitulo && <Text style={styles.subtitulo}>{p.subtitulo}</Text>}
                {p.texto && <Text style={styles.texto}>{p.texto}</Text>}
              </View>
            </List.Accordion>
          ))}
        </List.AccordionGroup>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16 },
  mainTitle: { fontSize: 24, fontWeight: 'bold', marginBottom: 8 },
  intro: { fontSize: 16, marginBottom: 16 },
  accordion: { marginBottom: 12, borderRadius: 16 },
  accordionTitle: { color: colors.white, fontWeight: 'bold' },
  accordionContent: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    margin: 8,
  },
  subtitulo: { fontWeight: 'bold', marginBottom: 8 },
  texto: { marginBottom: 12 },
});
