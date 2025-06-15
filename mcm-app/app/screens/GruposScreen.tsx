import React, { useState } from 'react';
import { ScrollView, StyleSheet, View, TouchableOpacity } from 'react-native';
import { List, IconButton, Text } from 'react-native-paper';
import colors, { Colors } from '@/constants/colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useJubileoData } from '@/contexts/JubileoDataContext';

interface Grupo {
  nombre: string;
  responsable?: string;
  miembros: string[];
  subtitulo?: string;
}

type Data = Record<string, Grupo[]>;

export default function GruposScreen() {
  const scheme = useColorScheme();
  const styles = React.useMemo(() => createStyles(scheme), [scheme]);
  const { grupos } = useJubileoData();
  const data = grupos as Data;
  const categorias = [
    { name: 'Movilidad', icon: 'walk', color: colors.info },
    { name: 'Conso+', icon: 'cart', color: colors.success },
    { name: 'Autobuses', icon: 'bus', color: colors.warning },
  ];
  const [categoria, setCategoria] = useState<string | null>(null);
  const [grupo, setGrupo] = useState<Grupo | null>(null);

  if (!categoria) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.catList}>
        {categorias.map((c) => (
          <TouchableOpacity
            key={c.name}
            style={[styles.catCard, { backgroundColor: c.color }]}
            onPress={() => setCategoria(c.name)}
            activeOpacity={0.8}
          >
            <List.Icon icon={c.icon} color={colors.white} style={styles.catIcon} />
            <Text style={styles.catLabel}>{c.name}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    );
  }

  if (categoria && !grupo) {
    return (
      <ScrollView style={styles.container}>
        <View style={styles.backWrapper}>
          <IconButton icon="arrow-left" size={24} onPress={() => setCategoria(null)} />
        </View>
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
      <View style={styles.backWrapper}>
        <IconButton icon="arrow-left" size={24} onPress={() => setGrupo(null)} />
      </View>
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

const createStyles = (scheme: 'light' | 'dark' | null) => {
  const theme = Colors[scheme ?? 'light'];
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  catList: { padding: 16 },
  catCard: {
    height: 120,
    borderRadius: 16,
    marginBottom: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  catIcon: { marginBottom: 4 },
  catLabel: { fontSize: 18, fontWeight: 'bold', color: colors.white },
  groupListTitle: { fontSize: 16 },
  backWrapper: { padding: 8 },
  sectionHeader: { fontSize: 16, fontWeight: 'bold', color: theme.text },
  groupContainer: { paddingHorizontal: 16 },
  groupTitle: { fontSize: 22, fontWeight: 'bold', marginVertical: 8, color: theme.text },
});
};
