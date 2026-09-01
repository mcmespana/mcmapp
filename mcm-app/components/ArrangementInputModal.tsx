import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import BottomSheet from './BottomSheet';
import AppTextField from '@/components/ui/AppTextField';
import AppPrimaryButton from '@/components/ui/AppPrimaryButton';
import { Colors, themeColors } from '@/constants/colors';
import { radii } from '@/constants/uiStyles';
import { useColorScheme } from '@/hooks/useColorScheme';

interface ArrangementInputModalProps {
  visible: boolean;
  /** Texto de la línea sobre la que se insertará (preview, opcional). */
  previewLine?: string;
  saving?: boolean;
  error?: string | null;
  onCancel: () => void;
  onSave: (text: string) => void;
}

/**
 * Hoja compacta para escribir una anotación de arreglo `{arr: ...}`. Se abre al
 * hacer long-press sobre una línea de la canción (modo admin). El arreglo se
 * insertará ENCIMA de la línea indicada.
 */
export default function ArrangementInputModal({
  visible,
  previewLine,
  saving = false,
  error,
  onCancel,
  onSave,
}: ArrangementInputModalProps) {
  const scheme = useColorScheme();
  const theme = Colors[scheme ?? 'light'];
  const isDark = scheme === 'dark';
  const [text, setText] = useState('');
  const inputRef = useRef<TextInput>(null);

  // El campo se vacía al ABRIR, ajustando el estado durante el render (el
  // patrón que documenta React para "cambiar estado cuando cambia una prop").
  // Antes lo hacía un efecto, que pintaba un render con el texto anterior.
  const [lastVisible, setLastVisible] = useState(visible);
  if (visible !== lastVisible) {
    setLastVisible(visible);
    if (visible) setText('');
  }

  // El foco sí es un efecto de verdad: toca el input nativo, y con un pequeño
  // retardo para que el sheet termine de montar antes.
  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(() => inputRef.current?.focus(), 250);
    return () => clearTimeout(t);
  }, [visible]);

  const canSave = text.trim().length > 0 && !saving;

  return (
    <BottomSheet visible={visible} onClose={onCancel} title="✍️ Añadir arreglo">
      <View style={styles.container}>
        <Text style={[styles.hint, { color: theme.icon }]}>
          Se insertará una línea de arreglo{' '}
          <Text style={styles.mono}>{'{arr: …}'}</Text> encima de:
        </Text>
        {previewLine ? (
          <View
            style={[
              styles.previewBox,
              { backgroundColor: themeColors(isDark).background },
            ]}
          >
            <Text
              style={[styles.previewText, { color: theme.text }]}
              numberOfLines={2}
            >
              {previewLine}
            </Text>
          </View>
        ) : null}

        <AppTextField
          ref={inputRef}
          accentWhenFilled
          accentColor="#E15C62"
          style={styles.input}
          placeholder="Ej: Intro: solo guitarra (x2)"
          value={text}
          onChangeText={setText}
          multiline
          editable={!saving}
          onSubmitEditing={() => canSave && onSave(text)}
          returnKeyType="done"
          blurOnSubmit
        />

        {error ? (
          <Text style={styles.error}>{error}</Text>
        ) : (
          <Text style={[styles.note, { color: theme.icon }]}>
            Se verá al instante en tu dispositivo y se propondrá como edición.
          </Text>
        )}

        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.btn, styles.cancelBtn, { borderColor: theme.icon }]}
            onPress={onCancel}
            disabled={saving}
            activeOpacity={0.8}
          >
            <Text style={[styles.cancelText, { color: theme.text }]}>
              Cancelar
            </Text>
          </TouchableOpacity>
          <AppPrimaryButton
            label={saving ? 'Guardando…' : 'Añadir'}
            icon="check"
            color="#E15C62"
            onPress={() => onSave(text)}
            disabled={!canSave}
            loading={saving}
            style={styles.btn}
          />
        </View>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 24,
  },
  hint: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  mono: {
    fontFamily: 'Courier',
    fontWeight: '600',
  },
  previewBox: {
    borderRadius: radii.sm,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 14,
  },
  previewText: {
    fontSize: 14,
    fontStyle: 'italic',
  },
  input: {
    minHeight: 52,
  },
  note: {
    fontSize: 12,
    marginTop: 8,
    lineHeight: 16,
  },
  error: {
    fontSize: 13,
    marginTop: 8,
    color: '#C62828',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 18,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    paddingHorizontal: 18,
    borderRadius: radii.sm,
  },
  cancelBtn: {
    borderWidth: 1,
  },
  cancelText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
