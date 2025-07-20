import React, { useState, useMemo } from 'react';
import {
  ScrollView,
  StyleSheet,
  View,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { List, IconButton, Text, Searchbar } from 'react-native-paper';
import colors, { Colors } from '@/constants/colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import ProgressWithMessage from '@/components/ProgressWithMessage';
import { useFirebaseData } from '@/hooks/useFirebaseData';

const CATEGORY_CONFIG: Record<string, { icon: string; color: string }> = {
  Movilidad: { icon: 'walk', color: colors.info },
  'Conso+': { icon: 'cart', color: colors.success },
  Autobuses: { icon: 'bus', color: colors.warning },
  Alojamiento: { icon: 'home', color: colors.accent },
};

interface Grupo {
  nombre: string;
  responsable?: string;
  miembros: string[];
  subtitulo?: string;
  mapa?: string;
}

type Data = Record<string, Grupo[]>;

export default function GruposScreen() {
  const scheme = useColorScheme();
  const styles = React.useMemo(() => createStyles(scheme), [scheme]);
  const { data: gruposData, loading } = useFirebaseData<Data>(
    'jubileo/grupos',
    'jubileo_grupos',
  );
  const data = gruposData as Data | undefined;

  const categorias = useMemo(() => {
    const base = Object.keys(CATEGORY_CONFIG).map((name) => ({
      name,
      icon: CATEGORY_CONFIG[name].icon,
      color: CATEGORY_CONFIG[name].color,
    }));
    if (data) {
      Object.keys(data).forEach((cat) => {
        if (!CATEGORY_CONFIG[cat]) {
          base.push({
            name: cat,
            icon: 'account-group',
            color: colors.primary,
          });
        }
      });
    }
    return base;
  }, [data]);
  const [categoria, setCategoria] = useState<string | null>(null);
  const [grupo, setGrupo] = useState<Grupo | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [search, setSearch] = useState('');

  const openMap = (url?: string) => {
    if (url) Linking.openURL(url);
  };

  const searchResults = useMemo(() => {
    if (!data || search.trim().length < 3) return [];
    const q = search.trim().toLowerCase();
    const res: { categoria: string; grupo: Grupo; matches: string[] }[] = [];
    Object.entries(data).forEach(([cat, grupos]) => {
      grupos.forEach((g) => {
        const matches: string[] = [];
        if (g.nombre.toLowerCase().includes(q)) {
          matches.push('__match_name__');
        }
        if (g.responsable && g.responsable.toLowerCase().includes(q)) {
          matches.push(g.responsable);
        }
        g.miembros.forEach((m) => {
          if (m.toLowerCase().includes(q)) {
            matches.push(m);
          }
        });
        if (matches.length > 0) {
          res.push({ categoria: cat, grupo: g, matches });
        }
      });
    });
    return res;
  }, [search, data]);

  if (categoria && !data) {
    return <ProgressWithMessage message="Cargando grupos..." />;
  }

  if (categoria && loading) {
    return <ProgressWithMessage message="Actualizando grupos..." />;
  }

  if (showSearch) {
    const grouped: Record<string, { grupo: Grupo; matches: string[] }[]> = {};
    searchResults.forEach((r) => {
      if (!grouped[r.categoria]) grouped[r.categoria] = [];
      grouped[r.categoria].push({ grupo: r.grupo, matches: r.matches });
    });
    return (
      <ScrollView style={styles.container}>
        <View style={styles.backWrapper}>
          <IconButton
            icon="arrow-left"
            size={24}
            onPress={() => {
              setShowSearch(false);
              setSearch('');
            }}
          />
        </View>
        <Searchbar
          placeholder="Buscar grupo o persona"
          placeholderTextColor="#8A8A8D"
          iconColor="#8A8A8D"
          onChangeText={setSearch}
          value={search}
          style={styles.searchbar}
          inputStyle={styles.searchbarInput}
          autoFocus
        />
        {search.trim().length < 3 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.hintText}>Escribe al menos 3 caracteres</Text>
          </View>
        ) : searchResults.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              No se han encontrado resultados
            </Text>
          </View>
        ) : (
          Object.entries(grouped).map(([cat, grupos]) => (
            <View key={cat}>
              <List.Subheader style={styles.sectionHeader}>
                {cat}
              </List.Subheader>
              {grupos.map(({ grupo: g, matches }, idx) => (
                <View key={idx}>
                  <List.Item
                    title={g.nombre}
                    description={g.subtitulo}
                    onPress={() => {
                      setCategoria(cat);
                      setGrupo(g);
                      setShowSearch(false);
                      setSearch('');
                    }}
                    titleStyle={styles.groupListTitle}
                  />
                  {matches
                    .filter((m) => m !== '__match_name__')
                    .map((m, j) => (
                      <List.Item key={j} title={m} style={styles.matchItem} />
                    ))}
                </View>
              ))}
            </View>
          ))
        )}
      </ScrollView>
    );
  }

  if (!categoria && !showSearch) {
    return (
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.catList}
      >
        <View style={styles.searchButtonWrapper}>
          <IconButton
            icon="magnify"
            size={24}
            onPress={() => setShowSearch(true)}
          />
        </View>
        {categorias.map((c) => (
          <TouchableOpacity
            key={c.name}
            style={[styles.catCard, { backgroundColor: c.color }]}
            onPress={() => setCategoria(c.name)}
            activeOpacity={0.8}
          >
            <List.Icon
              icon={c.icon}
              color={colors.white}
              style={styles.catIcon}
            />
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
          <IconButton
            icon="arrow-left"
            size={24}
            onPress={() => setCategoria(null)}
          />
        </View>
        {(data?.[categoria] || []).map((g, idx) => (
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
        <IconButton
          icon="arrow-left"
          size={24}
          onPress={() => setGrupo(null)}
        />
      </View>
      {grupo && (
        <View style={styles.groupContainer}>
          <View style={styles.groupHeader}>
            <Text style={styles.groupTitle}>{grupo.nombre}</Text>
            {grupo.mapa && (
              <IconButton
                icon="map"
                size={24}
                onPress={() => openMap(grupo.mapa)}
              />
            )}
          </View>
          {grupo.responsable && (
            <>
              <List.Subheader style={styles.sectionHeader}>
                Responsable
              </List.Subheader>
              <List.Item title={grupo.responsable} />
            </>
          )}
          <List.Subheader style={styles.sectionHeader}>
            Miembros ({grupo.miembros.length})
          </List.Subheader>
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
    groupHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    groupTitle: {
      fontSize: 22,
      fontWeight: 'bold',
      marginVertical: 8,
      color: theme.text,
    },
    searchbar: {
      marginHorizontal: 16,
      marginVertical: 12,
      borderRadius: 20,
      backgroundColor: scheme === 'dark' ? '#2C2C2E' : '#fff',
      elevation: 2,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
      height: 44,
      borderWidth: 1,
      borderColor: scheme === 'dark' ? '#444' : '#E0E0E0',
    },
    searchbarInput: {
      fontSize: 16,
      paddingLeft: 0,
      paddingTop: 0,
      textAlignVertical: 'center',
      color: scheme === 'dark' ? Colors.dark.text : Colors.light.text,
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    emptyText: {
      fontSize: 16,
      color: scheme === 'dark' ? '#CCCCCC' : '#666',
      marginBottom: 10,
      textAlign: 'center',
    },
    hintText: {
      fontSize: 14,
      color: scheme === 'dark' ? '#AAAAAA' : '#888',
      fontStyle: 'italic',
      textAlign: 'center',
    },
    searchButtonWrapper: { alignItems: 'flex-end', padding: 8 },
    matchItem: { paddingLeft: 32 },
  });
};
