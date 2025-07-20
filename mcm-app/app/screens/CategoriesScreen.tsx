import {
  FlatList,
  TouchableOpacity,
  Text,
  StyleSheet,
  View,
  ScrollView,
  Alert,
  Platform,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useLayoutEffect, useMemo, useState, useEffect } from 'react';
import ProgressWithMessage from '@/components/ProgressWithMessage';
import OfflineBanner from '@/components/OfflineBanner';
import { useFirebaseData } from '@/hooks/useFirebaseData';
import { useColorScheme } from '@/hooks/useColorScheme';
import colors, { Colors } from '@/constants/colors';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { 
  FAB, 
  Portal, 
  Modal, 
  TextInput, 
  Button,
  Snackbar,
} from 'react-native-paper';

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
  const { data: songsData, loading } = useFirebaseData<Record<
    string,
    { categoryTitle: string; songs: any[] }
  > | null>('songs', 'songs', filterSongsData);
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
  const [saving, setSaving] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState(false);

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
      const contenido = `{title: ${titulo}}\n{author: ${artista}}\n\n${letra}`;
      await set(newRef, {
        title: titulo,
        author: artista,
        category: categoria,
        content: contenido,
        status: 'pendiente',
      });
      await set(ref(db, 'songs/updatedAt'), Date.now().toString());
      
      // Mostrar toast de éxito en lugar del Alert
      setShowSuccessToast(true);
      
      // Limpiar el formulario y cerrarlo
      setShowForm(false);
      setTitulo('');
      setArtista('');
      setLetra('');
    } catch (e) {
      console.error('Error enviando canción', e);
      Alert.alert(
        'Error',
        'No se pudo enviar la sugerencia. Inténtalo de nuevo.',
      );
    }
    setSaving(false);
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
              buttonColor={colors.warning}
            >
              Sugerir canción
            </Button>
            <TextInput
              label="Título"
              value={titulo}
              onChangeText={setTitulo}
              style={styles.input}
              theme={{ colors: { primary: colors.warning } }}
            />
            <TextInput
              label="Artista"
              value={artista}
              onChangeText={setArtista}
              style={styles.input}
              theme={{ colors: { primary: colors.warning } }}
            />
            <TextInput
              label="Letra o acordes (opcional)"
              value={letra}
              onChangeText={setLetra}
              multiline
              numberOfLines={4}
              style={[styles.input, { minHeight: 100 }]}
              theme={{ colors: { primary: colors.warning } }}
            />
            
            {/* Selector elegante de categoría */}
            <View style={styles.categorySelector}>
              <Text style={styles.categoryLabel}>Categoría:</Text>
              <View style={styles.categoryOptions}>
                {sortedCategories.map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={[
                      styles.categoryOption,
                      categoria === cat && styles.categoryOptionSelected,
                    ]}
                    onPress={() => setCategoria(cat)}
                  >
                    <Text
                      style={[
                        styles.categoryOptionText,
                        categoria === cat && styles.categoryOptionTextSelected,
                      ]}
                    >
                      {songsData?.[cat]?.categoryTitle ?? cat}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </ScrollView>
        </Modal>
      </Portal>
      
      {/* Toast de éxito */}
      <Snackbar
        visible={showSuccessToast}
        onDismiss={() => setShowSuccessToast(false)}
        duration={3000}
        style={{
          backgroundColor: colors.warning,
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
        }}
        action={{
          label: '✨',
          textColor: '#000',
          onPress: () => setShowSuccessToast(false),
        }}
      >
        <Text style={{ color: '#000', fontWeight: 'bold' }}>
          ¡Sugerencia de canción enviada! 📮
        </Text>
      </Snackbar>
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
      backgroundColor: '#f4c11e', // Mismo amarillo que el header
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
    picker: {
      color: isDark ? Colors.dark.text : Colors.light.text,
    },
    saveBtn: { marginTop: spacing.md, marginBottom: spacing.md },
    // Estilos para el selector elegante de categorías
    categorySelector: {
      marginBottom: spacing.md,
    },
    categoryLabel: {
      fontSize: 16,
      fontWeight: '600',
      marginBottom: spacing.sm,
      color: isDark ? Colors.dark.text : Colors.light.text,
    },
    categoryOptions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    categoryOption: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.warning,
      backgroundColor: isDark
        ? Colors.dark.background
        : Colors.light.background,
      marginBottom: spacing.sm,
    },
    categoryOptionSelected: {
      backgroundColor: colors.warning,
    },
    categoryOptionText: {
      fontSize: 14,
      color: isDark ? Colors.dark.text : Colors.light.text,
      fontWeight: '500',
    },
    categoryOptionTextSelected: {
      color: '#000',
      fontWeight: 'bold',
    },
  });
};
