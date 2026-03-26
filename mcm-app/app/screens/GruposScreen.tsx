import React, { useState, useMemo } from 'react';
import {
  ScrollView,
  StyleSheet,
  View,
  TouchableOpacity,
  Linking,
  Platform,
  Text,
  Pressable,
} from 'react-native';
import { SearchField, ListGroup, Separator, Button } from 'heroui-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import colors, { Colors } from '@/constants/colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import ProgressWithMessage from '@/components/ProgressWithMessage';
import { useFirebaseData } from '@/hooks/useFirebaseData';

type MaterialIconName = React.ComponentProps<typeof MaterialIcons>['name'];

const CATEGORY_CONFIG: Record<string, { icon: MaterialIconName; color: string }> = {
  Movilidad: { icon: 'directions-walk', color: colors.info },
  'Conso+': { icon: 'shopping-cart', color: colors.success },
  Autobuses: { icon: 'directions-bus', color: colors.warning },
  Alojamiento: { icon: 'home', color: colors.accent },
};

interface Grupo {
  nombre: string;
  responsable?: string;
  miembros?: string[];
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
            icon: 'group' as MaterialIconName,
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
      if (!grupos || !Array.isArray(grupos)) return;
      grupos.forEach((g) => {
        if (!g) return;
        const matches: string[] = [];
        if (
          g.nombre &&
          typeof g.nombre === 'string' &&
          g.nombre.toLowerCase().includes(q)
        ) {
          matches.push('__match_name__');
        }
        if (
          g.responsable &&
          typeof g.responsable === 'string' &&
          g.responsable.toLowerCase().includes(q)
        ) {
          matches.push(g.responsable);
        }
        if (g.miembros && Array.isArray(g.miembros)) {
          g.miembros.forEach((m) => {
            if (m && typeof m === 'string' && m.toLowerCase().includes(q)) {
              matches.push(m);
            }
          });
        }
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

  // Si hay un grupo seleccionado, mostrar la vista del grupo (prioridad máxima)
  if (grupo) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={Platform.OS === 'ios' ? { paddingBottom: 100 } : undefined}>
        <View style={styles.backWrapper}>
          <Pressable
            onPress={() => {
              setGrupo(null);
              if (search.trim().length >= 3) {
                setShowSearch(true);
                setCategoria(null);
              }
            }}
            style={styles.iconBtn}
          >
            <MaterialIcons name="arrow-back" size={24} color="#888" />
          </Pressable>
        </View>
        <View style={styles.groupContainer}>
          <View style={styles.groupHeader}>
            <Text style={styles.groupTitle}>{grupo.nombre}</Text>
          </View>

          {grupo.subtitulo && (
            <View style={styles.quoteContainer}>
              <View style={styles.quoteBorder} />
              <Text style={styles.quoteText}>{grupo.subtitulo}</Text>
            </View>
          )}

          {grupo.mapa && (
            <Button
              variant="secondary"
              onPress={() => openMap(grupo.mapa)}
              className="my-3"
            >
              <Button.Label>📍 Ubicación</Button.Label>
            </Button>
          )}

          {grupo.responsable && (
            <>
              <Text style={styles.sectionHeader}>Acompaña...</Text>
              <View style={styles.listItem}>
                <Text style={styles.listItemTitle}>{grupo.responsable}</Text>
              </View>
            </>
          )}
          <Text style={styles.sectionHeader}>
            Forman parte... ({grupo.miembros?.length || 0})
          </Text>
          {(grupo.miembros || [])
            .filter((m) => m && typeof m === 'string')
            .map((m, idx) => (
              <View key={idx} style={styles.listItem}>
                <Text style={styles.listItemTitle}>{m}</Text>
              </View>
            ))}
        </View>
      </ScrollView>
    );
  }

  if (showSearch || search.trim().length >= 3) {
    const grouped: Record<string, { grupo: Grupo; matches: string[] }[]> = {};
    searchResults.forEach((r) => {
      if (!grouped[r.categoria]) grouped[r.categoria] = [];
      grouped[r.categoria].push({ grupo: r.grupo, matches: r.matches });
    });
    return (
      <ScrollView style={styles.container} contentContainerStyle={Platform.OS === 'ios' ? { paddingBottom: 100 } : undefined}>
        <View style={styles.searchContainer}>
          <SearchField value={search} onChange={setSearch}>
            <SearchField.Group>
              <SearchField.SearchIcon />
              <SearchField.Input
                placeholder="Buscar grupo o persona"
                autoFocus={showSearch}
              />
              <SearchField.ClearButton />
            </SearchField.Group>
          </SearchField>
        </View>
        {search.trim().length < 3 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.hintText}>Escribe al menos 3 caracteres</Text>
          </View>
        ) : searchResults.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              No he encontrado nada, ya lo siento 😔
            </Text>
          </View>
        ) : (
          Object.entries(grouped).map(([cat, grupos]) => (
            <View key={cat}>
              <Text style={styles.sectionHeader}>{cat}</Text>
              <ListGroup variant="transparent">
                {grupos.map(({ grupo: g, matches }, idx) => (
                  <React.Fragment key={idx}>
                    <ListGroup.Item
                      onPress={() => {
                        setCategoria(cat);
                        setGrupo(g);
                        setShowSearch(false);
                      }}
                    >
                      <ListGroup.ItemContent>
                        <ListGroup.ItemTitle>{g.nombre}</ListGroup.ItemTitle>
                        {g.subtitulo ? (
                          <ListGroup.ItemDescription>{g.subtitulo}</ListGroup.ItemDescription>
                        ) : null}
                      </ListGroup.ItemContent>
                    </ListGroup.Item>
                    {matches
                      .filter((m) => m !== '__match_name__')
                      .map((m, j) => (
                        <View key={j} style={[styles.listItem, styles.matchItem]}>
                          <Text style={styles.listItemTitle}>{m}</Text>
                        </View>
                      ))}
                    {idx < grupos.length - 1 && <Separator />}
                  </React.Fragment>
                ))}
              </ListGroup>
            </View>
          ))
        )}
      </ScrollView>
    );
  }

  if (!categoria && !showSearch && search.trim().length < 3) {
    return (
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.catList}
      >
        <View style={styles.searchButtonWrapper}>
          <Pressable onPress={() => setShowSearch(true)} style={styles.iconBtn}>
            <MaterialIcons name="search" size={24} color="#888" />
          </Pressable>
        </View>
        {categorias.map((c) => (
          <TouchableOpacity
            key={c.name}
            style={[styles.catCard, { backgroundColor: c.color }]}
            onPress={() => setCategoria(c.name)}
            activeOpacity={0.8}
          >
            <MaterialIcons name={c.icon} size={40} color={colors.white} style={styles.catIcon} />
            <Text style={styles.catLabel}>{c.name}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    );
  }

  if (categoria && !grupo) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={Platform.OS === 'ios' ? { paddingBottom: 100 } : undefined}>
        <View style={styles.backWrapper}>
          <Pressable onPress={() => setCategoria(null)} style={styles.iconBtn}>
            <MaterialIcons name="arrow-back" size={24} color="#888" />
          </Pressable>
        </View>
        <ListGroup variant="transparent">
          {(data?.[categoria] || []).map((g, idx) => (
            <React.Fragment key={idx}>
              <ListGroup.Item onPress={() => setGrupo(g)}>
                <ListGroup.ItemContent>
                  <ListGroup.ItemTitle>{g.nombre}</ListGroup.ItemTitle>
                  {g.subtitulo ? (
                    <ListGroup.ItemDescription>{g.subtitulo}</ListGroup.ItemDescription>
                  ) : null}
                </ListGroup.ItemContent>
              </ListGroup.Item>
              {idx < (data?.[categoria]?.length ?? 0) - 1 && <Separator />}
            </React.Fragment>
          ))}
        </ListGroup>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={Platform.OS === 'ios' ? { paddingBottom: 100 } : undefined}>
      <View style={styles.backWrapper}>
        <Pressable onPress={() => setCategoria(null)} style={styles.iconBtn}>
          <MaterialIcons name="arrow-back" size={24} color="#888" />
        </Pressable>
      </View>
      <ListGroup variant="transparent">
        {(categoria && data?.[categoria] ? data[categoria] : []).map((g: Grupo, idx: number) => {
          const list = categoria && data?.[categoria] ? data[categoria] : [];
          return (
            <React.Fragment key={idx}>
              <ListGroup.Item onPress={() => setGrupo(g)}>
                <ListGroup.ItemContent>
                  <ListGroup.ItemTitle>{g.nombre}</ListGroup.ItemTitle>
                  {g.subtitulo ? (
                    <ListGroup.ItemDescription>{g.subtitulo}</ListGroup.ItemDescription>
                  ) : null}
                </ListGroup.ItemContent>
              </ListGroup.Item>
              {idx < list.length - 1 && <Separator />}
            </React.Fragment>
          );
        })}
      </ListGroup>
    </ScrollView>
  );
}

const createStyles = (scheme: 'light' | 'dark' | null) => {
  const theme = Colors[scheme ?? 'light'];
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    catList: { padding: 16, paddingBottom: Platform.OS === 'ios' ? 100 : 16 },
    catCard: {
      height: 120,
      borderRadius: 16,
      marginBottom: 16,
      justifyContent: 'center',
      alignItems: 'center',
    },
    catIcon: { marginBottom: 4 },
    catLabel: { fontSize: 18, fontWeight: 'bold', color: colors.white },
    groupListTitle: { fontSize: 16, color: theme.text },
    backWrapper: { padding: 8 },
    sectionHeader: {
      fontSize: 16,
      fontWeight: 'bold',
      color: theme.text,
      paddingHorizontal: 16,
      paddingVertical: 8,
    },
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
    iconBtn: {
      padding: 8,
      borderRadius: 20,
    },
    listItem: {
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: scheme === 'dark' ? '#333' : '#E0E0E0',
    },
    listItemTitle: {
      fontSize: 16,
      color: theme.text,
    },
    listItemDesc: {
      fontSize: 13,
      color: scheme === 'dark' ? '#AAAAAA' : '#888',
      marginTop: 2,
    },
    searchbar: {
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
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
    },
    searchContainer: {
      marginHorizontal: 16,
      marginVertical: 12,
    },
    searchbarInput: {
      flex: 1,
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
    quoteContainer: {
      flexDirection: 'row',
      marginVertical: 12,
      marginHorizontal: 4,
    },
    quoteBorder: {
      width: 4,
      backgroundColor: colors.info,
      borderRadius: 2,
      marginRight: 12,
    },
    quoteText: {
      flex: 1,
      fontSize: 16,
      fontStyle: 'italic',
      color: scheme === 'dark' ? '#CCCCCC' : '#666',
      lineHeight: 22,
      paddingVertical: 8,
    },
    locationButton: {
      backgroundColor: colors.info,
      borderRadius: 12,
      paddingVertical: 12,
      paddingHorizontal: 20,
      marginVertical: 12,
      marginHorizontal: 4,
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    locationButtonText: {
      color: colors.white,
      fontSize: 16,
      fontWeight: '600',
      letterSpacing: 0.5,
    },
  });
};
