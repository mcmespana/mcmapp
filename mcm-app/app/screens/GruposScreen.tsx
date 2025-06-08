import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { List, IconButton, Text } from 'react-native-paper';
import colors from '@/constants/colors';
import gruposData from '@/assets/jubileo-grupos.json';

interface Grupo {
  nombre: string;
  responsable?: string;
  miembros: string[];
  subtitulo?: string;
}

type Data = Record<string, Grupo[]>;

export default function GruposScreen() {
  const data = gruposData as Data;
  const categorias = ['Movilidad', 'Conso+', 'Autobuses'];
  const [categoria, setCategoria] = useState<string | null>(null);
  const [grupo, setGrupo] = useState<Grupo | null>(null);

  const totals: Record<string, number> = React.useMemo(() => {
    const result: Record<string, number> = {};
    categorias.forEach(c => {
      result[c] = data[c].reduce((acc, g) => acc + g.miembros.length, 0);
    });
    return result;
  }, []);

  if (!categoria) {
    return (
      <ScrollView style={styles.container}>
        {categorias.map((c) => (
          <List.Item
            key={c}
            title={c}
            description={`${totals[c]} personas`}
            onPress={() => setCategoria(c)}
            titleStyle={styles.categoryTitle}
          />
        ))}
      </ScrollView>
    );
  }

  if (categoria && !grupo) {
    return (
      <ScrollView style={styles.container}>
        <List.Item
          title="Volver"
          left={() => <List.Icon icon="arrow-left" color={colors.text} />}
          onPress={() => setCategoria(null)}
          titleStyle={styles.backTitle}
        />
        {data[categoria].map((g, idx) => (
          <List.Item
            key={idx}
            title={g.nombre}
            description={g.subtitulo}
            onPress={() => setGrupo(g)}
            titleStyle={styles.groupListTitle}
          />
        ))}
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <List.Item
        title="Volver"
        left={() => <List.Icon icon="arrow-left" color={colors.text} />}
        onPress={() => setGrupo(null)}
        titleStyle={styles.backTitle}
      />
      {grupo && (
        <View style={styles.groupContainer}>
          <Text style={styles.groupTitle}>{grupo.nombre}</Text>
          {grupo.responsable && (
            <>
              <List.Subheader style={styles.sectionHeader}>Responsable</List.Subheader>
              <List.Item title={grupo.responsable} />
            </>
          )}
          <List.Subheader style={styles.sectionHeader}>Miembros ({grupo.miembros.length})</List.Subheader>
          {grupo.miembros.map((m, idx) => (
            <List.Item key={idx} title={m} />
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  categoryTitle: { fontSize: 18, fontWeight: 'bold' },
  groupListTitle: { fontSize: 16 },
  backTitle: { fontSize: 16 },
  sectionHeader: { fontSize: 16, fontWeight: 'bold' },
  groupContainer: { paddingHorizontal: 16 },
  groupTitle: { fontSize: 22, fontWeight: 'bold', marginVertical: 8 },
});
