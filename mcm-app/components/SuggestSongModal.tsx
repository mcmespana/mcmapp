import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Alert,
  Platform,
  ScrollView,
} from 'react-native';
import BottomSheet from './BottomSheet';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Colors } from '@/constants/colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { getDatabase, ref, push, set } from 'firebase/database';
import { getFirebaseApp } from '@/hooks/firebaseApp';

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
          <TouchableOpacity onPress={handleClose} accessibilityLabel="Cerrar">
            <MaterialIcons name="close" size={24} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: theme.text }]}>
            Sugerir canción 🎵
          </Text>
          <View style={{ width: 24 }} />
        </View>

        <Text style={[styles.label, { color: theme.text }]}>
          Título de la canción *
        </Text>
        <TextInput
          style={[
            styles.textInput,
            {
              backgroundColor: theme.background,
              color: theme.text,
              borderColor: theme.icon,
            },
          ]}
          placeholder="Nombre de la canción"
          placeholderTextColor={theme.icon}
          value={titulo}
          onChangeText={setTitulo}
          maxLength={100}
        />

        <Text style={[styles.label, { color: theme.text }]}>Artista *</Text>
        <TextInput
          style={[
            styles.textInput,
            {
              backgroundColor: theme.background,
              color: theme.text,
              borderColor: theme.icon,
            },
          ]}
          placeholder="Nombre del artista o banda"
          placeholderTextColor={theme.icon}
          value={artista}
          onChangeText={setArtista}
          maxLength={100}
        />

        <Text style={[styles.label, { color: theme.text }]}>
          Letra o acordes (opcional)
        </Text>
        <TextInput
          style={[
            styles.textAreaInput,
            {
              backgroundColor: theme.background,
              color: theme.text,
              borderColor: theme.icon,
            },
          ]}
          placeholder="Puedes incluir la letra, acordes o cualquier información adicional"
          placeholderTextColor={theme.icon}
          value={letra}
          onChangeText={setLetra}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
          maxLength={1000}
        />

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
              <TouchableOpacity
                key={cat}
                style={[
                  styles.categoryOption,
                  {
                    backgroundColor:
                      categoria === cat ? theme.tint : 'transparent',
                    borderColor: theme.icon,
                  },
                ]}
                onPress={() => setCategoria(cat)}
              >
                <Text
                  style={[
                    styles.categoryOptionText,
                    {
                      color: categoria === cat ? '#fff' : theme.text,
                    },
                  ]}
                >
                  {songsData?.[cat]?.categoryTitle ?? cat}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <TouchableOpacity
          style={[
            styles.submitButton,
            {
              backgroundColor:
                titulo.trim() && artista.trim() ? '#4CAF50' : theme.icon,
              opacity: isSubmitting ? 0.7 : 1,
            },
          ]}
          onPress={handleSubmit}
          disabled={!titulo.trim() || !artista.trim() || isSubmitting}
        >
          <MaterialIcons
            name={isSubmitting ? 'hourglass-empty' : 'send'}
            size={20}
            color="#fff"
          />
          <Text style={styles.submitButtonText}>
            {isSubmitting ? 'Enviando...' : 'Enviar sugerencia'}
          </Text>
        </TouchableOpacity>

        <Text style={[styles.disclaimer, { color: theme.icon }]}>
          Tu sugerencia será revisada por nuestro equipo y, si es aprobada, se
          añadirá al cantoral. Los campos marcados con * son obligatorios.
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
  textInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 8,
  },
  textAreaInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    minHeight: 100,
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
  categoryOption: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderRadius: 20,
    marginRight: 8,
    minWidth: 80,
    alignItems: 'center',
  },
  categoryOptionText: {
    fontSize: 14,
    fontWeight: '500',
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginBottom: 16,
    marginTop: 8,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  disclaimer: {
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
});
