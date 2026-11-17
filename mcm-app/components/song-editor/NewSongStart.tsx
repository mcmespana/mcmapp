/**
 * Canción nueva: de dónde sale la letra. Una foto (la lee la IA del admin del
 * cantoral), un texto pegado (lo convierte el mismo admin) o en blanco.
 */
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { PressableFeedback } from 'heroui-native';
import AppPrimaryButton from '@/components/ui/AppPrimaryButton';
import { MaterialIcons } from '@/components/ui/icons';
import { themeColors } from '@/constants/colors';
import spacing from '@/constants/spacing';
import typography from '@/constants/typography';
import { radii } from '@/constants/uiStyles';
import { useToast } from '@/contexts/AppToastContext';
import { useColorScheme } from '@/hooks/useColorScheme';
import {
  convertPastedText,
  fetchSongFromUrl,
  isSongUrl,
  readSongPhotos,
  type EditorStatus,
} from '@/services/songEditorService';
import { h } from '@/utils/haptics';
import { logger } from '@/utils/logger';

const MONO = Platform.select({
  ios: 'Menlo',
  android: 'monospace',
  default: 'ui-monospace, Menlo, Consolas, monospace',
});

export default function NewSongStart({
  status,
  onReady,
}: {
  status: EditorStatus | null;
  onReady: (title: string, cho: string, category?: string) => void;
}) {
  const isDark = useColorScheme() === 'dark';
  const theme = themeColors(isDark);
  const { toast } = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [pasting, setPasting] = useState<false | 'text' | 'url'>(false);
  const [text, setText] = useState('');

  const fail = (e: unknown) =>
    toast.show({
      variant: 'danger',
      label: e instanceof Error ? e.message : 'No ha salido bien',
    });

  const fromPhoto = async (camera: boolean) => {
    try {
      if (camera && Platform.OS !== 'web') {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) return;
      }
      const opts: ImagePicker.ImagePickerOptions = {
        mediaTypes: ['images'],
        quality: 0.7,
        allowsMultipleSelection: !camera,
        selectionLimit: 4,
      };
      const res = camera
        ? await ImagePicker.launchCameraAsync(opts)
        : await ImagePicker.launchImageLibraryAsync(opts);
      if (res.canceled || !res.assets.length) return;
      setBusy('Leyendo la foto…');
      const songs = await readSongPhotos(
        res.assets.map((a, i) => ({
          uri: a.uri,
          name: a.fileName ?? `foto-${i + 1}.jpg`,
          type: a.mimeType ?? 'image/jpeg',
          file:
            Platform.OS === 'web' ? (a.file as Blob | undefined) : undefined,
        })),
      );
      const song = songs[0];
      if (!song?.cho)
        throw new Error('No he encontrado una canción en la foto');
      if (song.doubts?.length) {
        toast.show({ label: `Revisa: ${song.doubts.slice(0, 2).join(' · ')}` });
      }
      onReady(song.title, song.cho, song.category);
    } catch (e) {
      fail(e);
    } finally {
      setBusy(null);
    }
  };

  const fromText = async () => {
    // Un enlace (doceacordes y compañía): lo trae el cantoral.
    if (isSongUrl(text)) {
      try {
        setBusy('Trayendo la canción…');
        const song = await fetchSongFromUrl(text.trim());
        if (!song.cho) throw new Error('No he encontrado la canción');
        onReady(song.title, song.cho, song.category);
      } catch (e) {
        fail(e);
      } finally {
        setBusy(null);
      }
      return;
    }
    try {
      setBusy('Convirtiendo…');
      const song = await convertPastedText(text);
      onReady(song.title, song.cho || text);
    } catch (e) {
      // Sin el cantoral a mano, el texto entra tal cual.
      logger.info('song editor: convert', (e as Error).message);
      onReady('', text);
    } finally {
      setBusy(null);
    }
  };

  if (busy) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <ActivityIndicator color={theme.link} />
        <Text style={[styles.hint, { color: theme.textSecondary }]}>
          {busy}
        </Text>
      </View>
    );
  }

  if (pasting) {
    return (
      <ScrollView
        style={{ backgroundColor: theme.background }}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <TextInput
          value={text}
          onChangeText={setText}
          multiline={pasting !== 'url'}
          autoFocus
          autoCorrect={false}
          placeholder={
            pasting === 'url'
              ? 'https://doceacordes.es/cancion/972'
              : 'Pega aquí la letra (con los acordes encima o en ChordPro) o un enlace'
          }
          autoCapitalize={pasting === 'url' ? 'none' : 'sentences'}
          keyboardType={pasting === 'url' ? 'url' : 'default'}
          placeholderTextColor={theme.textMuted}
          style={[
            styles.textArea,
            { color: theme.text, backgroundColor: theme.backgroundSunken },
          ]}
        />
        <AppPrimaryButton
          label="Continuar"
          icon="arrow-forward"
          iconPosition="right"
          onPress={() => void fromText()}
          disabled={!text.trim()}
          color={theme.link}
        />
      </ScrollView>
    );
  }

  // Las fotos salen siempre: si no se pueden usar ahora, dice por qué.
  const photoBlock =
    status === null
      ? 'Necesita el cantoral conectado (ahora no contesta)'
      : !status.ai
        ? 'El cantoral no tiene la IA activada'
        : null;
  const options = [
    ...(Platform.OS !== 'web'
      ? [
          {
            icon: 'photo-camera' as const,
            title: 'Hacer una foto',
            sub: photoBlock ?? 'De un cancionero o una hoja. Luego la repasas.',
            disabled: !!photoBlock,
            onPress: () => void fromPhoto(true),
          },
        ]
      : []),
    {
      icon: 'photo-library' as const,
      title: Platform.OS === 'web' ? 'Subir fotos' : 'Elegir fotos',
      sub: photoBlock ?? 'Hasta cuatro páginas seguidas.',
      disabled: !!photoBlock,
      onPress: () => void fromPhoto(false),
    },
    {
      icon: 'content-paste' as const,
      title: 'Pegar el texto',
      sub: 'Con los acordes encima de la letra o en ChordPro.',
      onPress: () => setPasting('text'),
    },
    {
      icon: 'link' as const,
      title: 'Desde un enlace',
      sub: 'Doceacordes se convierte tal cual, sin IA.',
      onPress: () => setPasting('url'),
    },
    {
      icon: 'edit-note' as const,
      title: 'Empezar en blanco',
      sub: 'Escribir letra y acordes a mano.',
      onPress: () => onReady('', ''),
    },
  ];

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.content}
    >
      {status === null && (
        <Text style={[styles.hint, { color: theme.textSecondary }]}>
          Sin conexión con el cantoral: no se pueden leer fotos ni crear
          canciones ahora mismo.
        </Text>
      )}
      <View style={[styles.group, { backgroundColor: theme.backgroundSunken }]}>
        {options.map((o, i) => (
          <PressableFeedback
            key={o.title}
            onPress={() => {
              h.tap();
              o.onPress();
            }}
            isDisabled={'disabled' in o && !!o.disabled}
            style={[
              styles.option,
              'disabled' in o && o.disabled && styles.optionOff,
              i > 0 && {
                borderTopWidth: StyleSheet.hairlineWidth,
                borderTopColor: theme.separator,
              },
            ]}
            accessibilityRole="button"
            accessibilityState={{ disabled: 'disabled' in o && !!o.disabled }}
          >
            <MaterialIcons name={o.icon} size={24} color={theme.link} />
            <View style={styles.flex}>
              <Text style={[styles.optionTitle, { color: theme.text }]}>
                {o.title}
              </Text>
              <Text style={[styles.optionSub, { color: theme.textSecondary }]}>
                {o.sub}
              </Text>
            </View>
            <MaterialIcons
              name="chevron-right"
              size={22}
              color={theme.textMuted}
            />
          </PressableFeedback>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  content: { padding: spacing.md, gap: spacing.md },
  hint: { ...typography.caption },
  textArea: {
    fontFamily: MONO,
    fontSize: 15,
    lineHeight: 24,
    minHeight: 320,
    padding: spacing.md,
    borderRadius: radii.md,
    textAlignVertical: 'top',
  },
  group: { borderRadius: radii.lg, overflow: 'hidden' },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    minHeight: 64,
  },
  optionOff: { opacity: 0.45 },
  optionTitle: { ...typography.title },
  optionSub: { ...typography.caption, marginTop: 2 },
});
