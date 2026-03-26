import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  Platform,
  ScrollView,
} from 'react-native';
import BottomSheet from './BottomSheet';
import { Button, CloseButton, TextField, Input, TextArea, Chip } from 'heroui-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Colors } from '@/constants/colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { getDatabase, ref, push, set } from 'firebase/database';
import { getFirebaseApp } from '@/hooks/firebaseApp';
import { useUserProfile } from '@/contexts/UserProfileContext';

interface SuggestSongModalProps {
  visible: boolean;
  onClose: () => void;
  availableCategories: string[];
  songsData: Record<string, { categoryTitle: string; songs: any[] }> | null;
  onSuccess: () => void;
}

export default function SuggestSongModal({
  visible,
  onClose,
  availableCategories,
  songsData,
  onSuccess,
}: SuggestSongModalProps) {
  const scheme = useColorScheme();
  const theme = Colors[scheme];
  const { profile } = useUserProfile();

  const [titulo, setTitulo] = useState('');
  const [artista, setArtista] = useState('');
  const [letra, setLetra] = useState('');
  const [categoria, setCategoria] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Establecer categoría inicial cuando se cargan los datos
  useEffect(() => {
    if (!categoria && availableCategories.length > 0) {
      setCategoria(availableCategories[0]);
    }
  }, [availableCategories, categoria]);

  const handleSubmit = async () => {
    if (!titulo.trim() || !artista.trim()) {
      Alert.alert('Error', 'Título y artista son obligatorios');
      return;
    }

    setIsSubmitting(true);

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
        timestamp: Date.now(),
        platform: Platform.OS,
        requestedAt: new Date().toISOString(),
        userName: profile.name || 'Anónimo',
        userLocation: profile.location || 'Sin ubicación',
      });

      await set(ref(db, 'songs/updatedAt'), Date.now().toString());

      // Limpiar formulario
      setTitulo('');
      setArtista('');
      setLetra('');
      onClose();

      // Notificar éxito al componente padre
      onSuccess();
    } catch (error) {
      console.error('Error enviando sugerencia:', error);
      Alert.alert(
        'Error',
        'No se pudo enviar la sugerencia. Inténtalo de nuevo.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (titulo.trim() || artista.trim() || letra.trim()) {
      Alert.alert(
        'Cancelar sugerencia',
        '¿Estás seguro de que quieres cancelar? Se perderá lo que has escrito.',
        [
          { text: 'Seguir escribiendo', style: 'cancel' },
          {
            text: 'Cancelar',
            style: 'destructive',
            onPress: () => {
              setTitulo('');
              setArtista('');
              setLetra('');
              onClose();
            },
          },
        ],
      );
    } else {
      onClose();
    }
  };

  const sortedCategories = availableCategories.sort((a, b) => {
    const titleA = songsData?.[a]?.categoryTitle ?? a;
    const titleB = songsData?.[b]?.categoryTitle ?? b;
    return titleA.localeCompare(titleB);
  });

  return (
    <BottomSheet visible={visible} onClose={handleClose}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        bounces={false}
        overScrollMode="never"
      >
        <View style={styles.header}>
          <CloseButton onPress={handleClose} />
          <Text style={[styles.title, { color: theme.text }]}>
            Sugerir canción 🎵
          </Text>
          <View style={{ width: 36 }} />
        </View>

        <TextField isRequired style={styles.field}>
          <Input
            placeholder="Nombre de la canción"
            value={titulo}
            onChangeText={setTitulo}
            maxLength={100}
          />
        </TextField>

        <TextField isRequired style={styles.field}>
          <Input
            placeholder="Nombre del artista o banda"
            value={artista}
            onChangeText={setArtista}
            maxLength={100}
          />
        </TextField>

        <TextField style={styles.field}>
          <TextArea
            placeholder="Puedes incluir la letra, acordes o cualquier información adicional"
            value={letra}
            onChangeText={setLetra}
            maxLength={10000}
          />
        </TextField>

        <Text style={[styles.charCount, { color: theme.icon }]}>
          {letra.length}/1000 caracteres
        </Text>

        <Text style={[styles.label, { color: theme.text }]}>Categoría</Text>
        <View style={styles.categorySelector}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.categoryScroll}
          >
            {sortedCategories.map((cat) => (
              <Chip
                key={cat}
                variant={categoria === cat ? 'primary' : 'soft'}
                color="default"
                onPress={() => setCategoria(cat)}
                style={{ marginRight: 8 }}
              >
                <Chip.Label>
                  {songsData?.[cat]?.categoryTitle ?? cat}
                </Chip.Label>
              </Chip>
            ))}
          </ScrollView>
        </View>

        <Button
          variant="primary"
          isDisabled={!titulo.trim() || !artista.trim() || isSubmitting}
          onPress={handleSubmit}
          style={styles.submitButton}
        >
          <MaterialIcons
            name={isSubmitting ? 'hourglass-empty' : 'send'}
            size={20}
            color="#fff"
          />
          <Button.Label>
            {isSubmitting ? 'Enviando...' : 'Enviar sugerencia'}
          </Button.Label>
        </Button>

        <Text style={[styles.disclaimer, { color: theme.icon }]}>
          Recibiremos tu sugerencia de canción y, con algo de tiempo y suerte,
          la añadiremos al cantoral. ¡Gracias por ayudarnos a mejorar!
        </Text>
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 16,
  },
  field: {
    marginBottom: 8,
  },
  charCount: {
    fontSize: 12,
    textAlign: 'right',
    marginBottom: 8,
  },
  categorySelector: {
    marginBottom: 20,
  },
  categoryScroll: {
    flexGrow: 0,
  },
  submitButton: {
    marginBottom: 16,
    marginTop: 8,
  },
  disclaimer: {
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
});
