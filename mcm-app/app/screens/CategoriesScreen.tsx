import {
  FlatList,
  TouchableOpacity,
  Text,
  StyleSheet,
  View,
  ScrollView,
  Alert,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useLayoutEffect, useMemo, useState, useEffect } from 'react';
import ProgressWithMessage from '@/components/ProgressWithMessage';
import { useFirebaseData } from '@/hooks/useFirebaseData';
import { useColorScheme } from '@/hooks/useColorScheme';
import colors, { Colors } from '@/constants/colors';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { FAB, Portal, Modal, TextInput, Button } from 'react-native-paper';

import { Picker } from '@react-native-picker/picker';
import { getDatabase, ref, push, set } from 'firebase/database';
import { getFirebaseApp } from '@/hooks/firebaseApp';
import spacing from '@/constants/spacing';
import { filterSongsData } from '@/utils/filterSongsData';

const ALL_SONGS_CATEGORY_ID = '__ALL__';
const ALL_SONGS_CATEGORY_NAME = '🔎 Buscar una canción...';
const SELECTED_SONGS_CATEGORY_ID = '__SELECTED_SONGS__';
const SELECTED_SONGS_CATEGORY_NAME = '🎵 Tu selección de canciones';

export default function CategoriesScreen({
  navigation,
}: {
  navigation: NativeStackNavigationProp<{
    Categories: undefined;
    SongsList: { categoryId: string; categoryName: string };
    SongDetail: { songId: string; songTitle?: string };
    SelectedSongs: undefined; // Added SelectedSongs for navigation
  }>;
}) {
  const scheme = useColorScheme();
  const styles = useMemo(() => createStyles(scheme), [scheme]);
  const { data: songsData, loading } = useFirebaseData<
    Record<string, { categoryTitle: string; songs: any[] }>
  >('songs', 'songs', filterSongsData);
  const actualCategories = songsData ? Object.keys(songsData) : [];
  const sortedCategories = actualCategories.sort((a, b) => {
    const titleA = songsData?.[a]?.categoryTitle ?? a;
    const titleB = songsData?.[b]?.categoryTitle ?? b;
    return titleA.localeCompare(titleB);
  });
  const displayCategories = [
    { id: SELECTED_SONGS_CATEGORY_ID, name: SELECTED_SONGS_CATEGORY_NAME },
    ...sortedCategories.map((cat) => ({
      id: cat,
      name: songsData?.[cat]?.categoryTitle ?? cat,
    })),
  ];

  const [showForm, setShowForm] = useState(false);
  const [titulo, setTitulo] = useState('');
  const [artista, setArtista] = useState('');
  const [letra, setLetra] = useState('');
  const [categoria, setCategoria] = useState('');
  const [tono, setTono] = useState('');
  const [cejilla, setCejilla] = useState(0);
  const [saving, setSaving] = useState(false);

  const tonos = [
    'C',
    'Cm',
    'C#',
    'C#m',
    'D',
    'Dm',
    'D#',
    'D#m',
    'E',
    'Em',
    'F',
    'Fm',
    'F#',
    'F#m',
    'G',
    'Gm',
    'G#',
    'G#m',
    'A',
    'Am',
    'A#',
    'A#m',
    'B',
    'Bm',
  ];

  // Set initial selected category when data loads
  useEffect(() => {
    if (!categoria && sortedCategories.length > 0) {
      setCategoria(sortedCategories[0]);
    }
  }, [sortedCategories, categoria]);

  async function enviarCancion() {
    if (!titulo.trim() || !artista.trim()) {
      Alert.alert('Error', 'Título y artista son obligatorios');
      return;
    }
    setSaving(true);
    try {
      const db = getDatabase(getFirebaseApp());
      const newRef = push(ref(db, 'songs/solicitudes'));
      const keyVal = tono || 'REVISAR';
      const capoVal = cejilla ?? 0;
      const contenido = `{title: ${titulo}}\n{author: ${artista}}\n{key: ${keyVal}}\n{capo: ${capoVal}}\n\n${letra}`;
      await set(newRef, {
        title: titulo,
        author: artista,
        ...(tono ? { key: tono } : {}),
        ...(cejilla ? { capo: cejilla } : {}),
        category: categoria,
        content: contenido,
        status: 'pendiente',
      });
      await set(ref(db, 'songs/updatedAt'), Date.now().toString());
      Alert.alert(
        'Enviado',
        'Se ha enviado tu petición de canción, se revisará y añadirá a la base de datos en unos días',
      );
    } catch (e) {
      console.error('Error enviando canción', e);
    }
    setSaving(false);
    setShowForm(false);
    setTitulo('');
    setArtista('');
    setLetra('');
    setTono('');
    setCejilla(0);
  }

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          onPress={() =>
            navigation.navigate('SongsList', {
              categoryId: ALL_SONGS_CATEGORY_ID,
              categoryName: ALL_SONGS_CATEGORY_NAME,
            })
          }
          style={{ paddingHorizontal: 12 }}
        >
          <MaterialIcons name="search" size={26} color="#fff" />
        </TouchableOpacity>
      ),
    });
  }, [navigation]);

  if (loading && actualCategories.length === 0) {
    return <ProgressWithMessage message="Cargando canciones..." />;
  }

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={displayCategories}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => {
              if (item.id === SELECTED_SONGS_CATEGORY_ID) {
                navigation.navigate('SelectedSongs');
              } else {
                navigation.navigate('SongsList', {
                  categoryId: item.id,
                  categoryName: item.name,
                });
              }
            }}
            style={styles.itemRow}
          >
            <Text
              style={[
                styles.itemText,
                (item.id === ALL_SONGS_CATEGORY_ID ||
                  item.id === SELECTED_SONGS_CATEGORY_ID) &&
                  styles.specialText,
              ]}
            >
              {item.id === ALL_SONGS_CATEGORY_ID ||
              item.id === SELECTED_SONGS_CATEGORY_ID ? (
                item.name
              ) : (
                <>
                  <Text style={{ fontWeight: 'bold' }}>
                    {item.name.substring(0, 2)}
                  </Text>
                  {item.name.substring(2)}
                </>
              )}
            </Text>
          </TouchableOpacity>
        )}
      />
      <FAB icon="plus" style={styles.fab} onPress={() => setShowForm(true)} />
      <Portal>
        <Modal
          visible={showForm}
          onDismiss={() => setShowForm(false)}
          contentContainerStyle={styles.modal}
          style={styles.modalWrapper}
        >
          <ScrollView>
            <Button
              mode="contained"
              onPress={enviarCancion}
              loading={saving}
              style={styles.saveBtn}
            >
              Enviar
            </Button>
            <TextInput
              label="Título"
              value={titulo}
              onChangeText={setTitulo}
              style={styles.input}
              theme={{ colors: { primary: colors.success } }}
            />
            <TextInput
              label="Artista"
              value={artista}
              onChangeText={setArtista}
              style={styles.input}
              theme={{ colors: { primary: colors.success } }}
            />
            <TextInput
              label="Letra o acordes (opcional)"
              value={letra}
              onChangeText={setLetra}
              multiline
              numberOfLines={4}
              style={[styles.input, { minHeight: 100 }]}
              theme={{ colors: { primary: colors.success } }}
            />
            <View style={styles.pickerWrapper}>
              <Picker
                selectedValue={categoria}
                onValueChange={(v) => setCategoria(v)}
              >
                {sortedCategories.map((cat) => (
                  <Picker.Item
                    key={cat}
                    label={songsData?.[cat]?.categoryTitle ?? cat}
                    value={cat}
                  />
                ))}
              </Picker>
            </View>
            <View style={styles.pickerWrapper}>
              <Picker selectedValue={tono} onValueChange={(v) => setTono(v)}>
                <Picker.Item label="(Tono opcional)" value="" />
                {tonos.map((t) => (
                  <Picker.Item key={t} label={t} value={t} />
                ))}
              </Picker>
            </View>
            <View style={styles.pickerWrapper}>
              <Picker
                selectedValue={cejilla}
                onValueChange={(v) => setCejilla(Number(v))}
              >
                {[...Array(9).keys()].map((n) => (
                  <Picker.Item key={n} label={`Cejilla ${n}`} value={n} />
                ))}
              </Picker>
            </View>
          </ScrollView>
        </Modal>
      </Portal>
    </View>
  );
}

const createStyles = (scheme: 'light' | 'dark' | null) => {
  const isDark = scheme === 'dark';
  return StyleSheet.create({
    itemRow: {
      padding: 20,
      borderBottomWidth: 1,
      borderColor: isDark ? '#444' : '#ddd',
      backgroundColor: isDark
        ? Colors.dark.background
        : Colors.light.background,
    },
    itemText: {
      fontSize: 18,
      color: isDark ? Colors.dark.text : Colors.light.text,
    },
    specialText: {
      color: isDark ? '#BBBBBB' : '#4A4A4A',
    },
    fab: {
      position: 'absolute',
      right: 16,
      bottom: 16,
      backgroundColor: colors.success,
    },
    modal: {
      backgroundColor: isDark
        ? Colors.dark.background
        : Colors.light.background,
      margin: 20,
      padding: 20,
      borderRadius: 8,
    },
    modalWrapper: {
      justifyContent: 'flex-start',
    },
    input: { marginBottom: spacing.md },
    pickerWrapper: { marginBottom: spacing.md },
    saveBtn: { marginTop: spacing.md, marginBottom: spacing.md },
  });
};
