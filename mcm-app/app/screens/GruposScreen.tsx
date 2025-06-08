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

  if (!categoria) {
    return (
      <ScrollView style={styles.container}>
        {categorias.map((c) => (
          <List.Item key={c} title={c} onPress={() => setCategoria(c)} />
        ))}
      </ScrollView>
    );
  }

  if (categoria && !grupo) {
    return (
      <ScrollView style={styles.container}>
        <List.Item
          title="Volver"
          left={(props) => <IconButton {...props} icon="arrow-back" />}
          onPress={() => setCategoria(null)}
        />
        {data[categoria].map((g, idx) => (
          <List.Item
            key={idx}
            title={g.nombre}
            description={g.subtitulo}
            onPress={() => setGrupo(g)}
          />
        ))}
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <List.Item
        title="Volver"
        left={(props) => <IconButton {...props} icon="arrow-back" />}
        onPress={() => setGrupo(null)}
      />
      {grupo && (
        <View style={styles.groupContainer}>
          <Text style={styles.groupTitle}>{grupo.nombre}</Text>
          {grupo.responsable && (
            <List.Item title="Responsable" description={grupo.responsable} />
          )}
          <List.Subheader>Miembros</List.Subheader>
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
  groupContainer: { paddingHorizontal: 16 },
  groupTitle: { fontSize: 20, fontWeight: 'bold', marginVertical: 8 },
});
