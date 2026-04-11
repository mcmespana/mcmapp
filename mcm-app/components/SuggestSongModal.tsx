import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import BottomSheet from './BottomSheet';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Colors } from '@/constants/colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { radii } from '@/constants/uiStyles';
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
  const isDark = scheme === 'dark';
  const theme = Colors[scheme];
  const { profile } = useUserProfile();

  const [titulo, setTitulo] = useState('');
  const [artista, setArtista] = useState('');
  const [letra, setLetra] = useState('');
  const [categoria, setCategoria] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!categoria && availableCategories.length > 0) {
      setCategoria(availableCategories[0]);
    }
  }, [availableCategories, categoria]);

  const handleSubmit = async () => {
    if (!titulo.trim() || !artista.trim()) {
      setErrorMsg('El título y el artista son obligatorios');
      return;
    }
    setErrorMsg('');
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

      setTitulo('');
      setArtista('');
      setLetra('');
      setErrorMsg('');
      onClose();
      onSuccess();
    } catch (error) {
      console.error('Error enviando sugerencia:', error);
      setErrorMsg('No se pudo enviar. Inténtalo de nuevo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setTitulo('');
    setArtista('');
    setLetra('');
    setErrorMsg('');
    onClose();
  };

  const sortedCategories = [...availableCategories].sort((a, b) => {
    const titleA = songsData?.[a]?.categoryTitle ?? a;
    const titleB = songsData?.[b]?.categoryTitle ?? b;
    return titleA.localeCompare(titleB);
  });

  const canSubmit = titulo.trim().length > 0 && artista.trim().length > 0 && !isSubmitting;

  return (
    <BottomSheet visible={visible} onClose={handleClose}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        bounces={false}
        overScrollMode="never"
        contentContainerStyle={styles.content}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={handleClose}
            style={styles.closeBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.7}
          >
            <MaterialIcons name="close" size={22} color={theme.icon} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: theme.text }]}>Sugerir canción 🎵</Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* Título */}
        <Text style={[styles.fieldLabel, { color: theme.text }]}>Título *</Text>
        <TextInput
          style={[
            styles.textInput,
            {
              backgroundColor: isDark ? '#2C2C2E' : '#F2F2F7',
              color: theme.text,
              borderColor: titulo.trim()
                ? '#34C759'
                : isDark ? '#3A3A3C' : '#E5E5EA',
            },
          ]}
          placeholder="Nombre de la canción"
          placeholderTextColor={theme.icon}
          value={titulo}
          onChangeText={(t) => { setTitulo(t); setErrorMsg(''); }}
          maxLength={100}
          returnKeyType="next"
          editable={!isSubmitting}
        />

        {/* Artista */}
        <Text style={[styles.fieldLabel, { color: theme.text }]}>Artista *</Text>
        <TextInput
          style={[
            styles.textInput,
            {
              backgroundColor: isDark ? '#2C2C2E' : '#F2F2F7',
              color: theme.text,
              borderColor: artista.trim()
                ? '#34C759'
                : isDark ? '#3A3A3C' : '#E5E5EA',
            },
          ]}
          placeholder="Nombre del artista o banda"
          placeholderTextColor={theme.icon}
          value={artista}
          onChangeText={(t) => { setArtista(t); setErrorMsg(''); }}
          maxLength={100}
          returnKeyType="next"
          editable={!isSubmitting}
        />

        {/* Letra / información adicional */}
        <Text style={[styles.fieldLabel, { color: theme.text }]}>Información adicional</Text>
        <Text style={[styles.fieldSublabel, { color: theme.icon }]}>
          Letra, acordes o cualquier detalle útil
        </Text>
        <TextInput
          style={[
            styles.textArea,
            {
              backgroundColor: isDark ? '#2C2C2E' : '#F2F2F7',
              color: theme.text,
              borderColor: letra.trim()
                ? '#34C759'
                : isDark ? '#3A3A3C' : '#E5E5EA',
            },
          ]}
          placeholder="Opcional — cualquier información que nos ayude a añadirla bien"
          placeholderTextColor={theme.icon}
          value={letra}
          onChangeText={setLetra}
          maxLength={10000}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
          editable={!isSubmitting}
        />
        <Text style={[styles.charCount, { color: theme.icon }]}>
          {letra.length}/10000
        </Text>

        {/* Categoría */}
        <Text style={[styles.fieldLabel, { color: theme.text }]}>Categoría</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.categoryScroll}
          contentContainerStyle={styles.categoryScrollContent}
        >
          {sortedCategories.map((cat) => {
            const isSelected = categoria === cat;
            return (
              <TouchableOpacity
                key={cat}
                style={[
                  styles.categoryPill,
                  {
                    backgroundColor: isSelected
                      ? isDark ? '#1A3A6E' : '#E8F0FE'
                      : isDark ? '#2C2C2E' : '#F2F2F7',
                    borderColor: isSelected
                      ? '#4A90D9'
                      : isDark ? '#3A3A3C' : '#E5E5EA',
                  },
                ]}
                onPress={() => setCategoria(cat)}
                activeOpacity={0.7}
              >
                {isSelected && (
                  <MaterialIcons name="check" size={13} color="#4A90D9" />
                )}
                <Text
                  style={[
                    styles.categoryPillText,
                    { color: isSelected ? '#4A90D9' : theme.icon },
                    isSelected && { fontWeight: '600' },
                  ]}
                >
                  {songsData?.[cat]?.categoryTitle ?? cat}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Error */}
        {errorMsg ? (
          <View style={styles.errorRow}>
            <MaterialIcons name="error-outline" size={15} color="#FF3B30" />
            <Text style={styles.errorText}>{errorMsg}</Text>
          </View>
        ) : null}

        {/* Botón enviar */}
        <TouchableOpacity
          style={[
            styles.submitBtn,
            { backgroundColor: canSubmit ? '#007AFF' : isDark ? '#3A3A3C' : '#E5E5EA' },
          ]}
          onPress={handleSubmit}
          disabled={!canSubmit}
          activeOpacity={0.8}
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <MaterialIcons
              name="send"
              size={18}
              color={canSubmit ? '#fff' : theme.icon}
            />
          )}
          <Text
            style={[
              styles.submitBtnText,
              { color: canSubmit ? '#fff' : theme.icon },
            ]}
          >
            {isSubmitting ? 'Enviando...' : 'Enviar sugerencia'}
          </Text>
        </TouchableOpacity>

        <Text style={[styles.disclaimer, { color: theme.icon }]}>
          Recibiremos tu sugerencia y, con algo de tiempo y suerte, la añadiremos al cantoral. ¡Gracias!
        </Text>
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 48,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerSpacer: {
    width: 32,
  },
  title: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
    marginTop: 16,
  },
  fieldSublabel: {
    fontSize: 12,
    marginBottom: 8,
    marginTop: -4,
  },
  textInput: {
    borderWidth: 1.5,
    borderRadius: radii.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  textArea: {
    borderWidth: 1.5,
    borderRadius: radii.md,
    padding: 14,
    fontSize: 15,
    minHeight: 100,
    lineHeight: 22,
  },
  charCount: {
    fontSize: 11,
    textAlign: 'right',
    marginTop: 6,
  },
  categoryScroll: {
    flexShrink: 0,
    marginTop: 4,
    marginBottom: 8,
  },
  categoryScrollContent: {
    gap: 8,
    paddingVertical: 4,
  },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 100,
    borderWidth: 1.5,
  },
  categoryPillText: {
    fontSize: 13,
    fontWeight: '500',
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    marginBottom: 4,
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 13,
    fontWeight: '500',
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 15,
    borderRadius: radii.md,
    marginTop: 20,
    marginBottom: 16,
  },
  submitBtnText: {
    fontSize: 16,
    fontWeight: '700',
  },
  disclaimer: {
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
});
