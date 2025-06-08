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
        {data.paginas.map((p, idx) => (
          <List.Accordion
            key={idx}
            title={p.titulo}
            titleStyle={styles.accordionTitle}
            style={[styles.accordion, { backgroundColor: p.color || colors.primary }]}
          >
            {p.subtitulo && <Text style={styles.subtitulo}>{p.subtitulo}</Text>}
            {p.texto && <Text style={styles.texto}>{p.texto}</Text>}
          </List.Accordion>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16 },
  mainTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 8 },
  intro: { fontSize: 14, marginBottom: 16 },
  accordion: { marginBottom: 12 },
  accordionTitle: { color: colors.white, fontWeight: 'bold' },
  subtitulo: { fontWeight: 'bold', marginBottom: 8 },
  texto: { marginBottom: 12 },
});
