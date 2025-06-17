import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { List, Text } from 'react-native-paper';
import colors, { Colors } from '@/constants/colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import ProgressWithMessage from '@/components/ProgressWithMessage';
import { useFirebaseData } from '@/hooks/useFirebaseData';

interface Pagina {
  titulo: string;
  subtitulo?: string;
  texto?: string;
  color?: string;
}

export default function ProfundizaScreen() {
  const scheme = useColorScheme();
  const styles = React.useMemo(() => createStyles(scheme), [scheme]);
  const { data: profundizaData, loading } = useFirebaseData<any>('jubileo/profundiza', 'jubileo_profundiza');
  const data = profundizaData as {
    titulo: string;
    introduccion: string;
    paginas: Pagina[];
  };

  if (loading || !data) {
    return <ProgressWithMessage message="Cargando profundiza..." />;
  }

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

const createStyles = (scheme: 'light' | 'dark') => {
  const theme = Colors[scheme ?? 'light'];
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    content: { padding: 16 },
    mainTitle: { fontSize: 24, fontWeight: 'bold', marginBottom: 8, color: theme.text },
    intro: { fontSize: 16, marginBottom: 16, color: theme.text },
    accordion: { marginBottom: 12, borderRadius: 16 },
    accordionTitle: { color: colors.white, fontWeight: 'bold' },
    accordionContent: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 12,
      margin: 8,
    },
    subtitulo: { fontWeight: 'bold', marginBottom: 8, color: theme.text },
    texto: { marginBottom: 12, color: theme.text },
  });
};
