// El bloque «Foto» de «Mis datos» (plan 12): la foto (o la inicial), «Cambiar foto» y el estado de la subida.
//
//   · «Cambiar foto» abre una hoja: hacer una foto o elegir de la galería (con el recorte cuadrado del propio selector del sistema). En
//     web, sin cámara.
//   · Se sube en cuanto se elige, sin esperar a «Guardar»: mientras tanto se ve la foto elegida con su `UploadStatus`; si falla, el motivo y
//     «Reintentar» (con el mismo `clientId`) o, si el servidor la rechazó, elegir otra. Al subir, la foto nueva se ve al momento.
//   · Sin conexión, apagado: la foto, como todo lo de familias, necesita conexión.
//
// Este componente solo pinta: elegir y subir lo hace `usePhotoUpload` (por `services/comunica/`).

import React, { useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { PressableFeedback } from 'heroui-native';
import BottomSheet from '@/components/BottomSheet';
import { IconSymbol } from '@/components/ui/IconSymbol';
import typography from '@/constants/typography';
import { radii } from '@/constants/uiStyles';
import {
  usePhotoUpload,
  type PhotoSource,
} from '@/hooks/comunica/usePhotoUpload';
import { h } from '@/utils/haptics';
import PersonAvatar from '../comun/PersonAvatar';
import UploadStatus from '../comun/UploadStatus';
import { useComunicaTheme } from '../comun/useComunicaTheme';
import { DATOS_COPY as C } from './copy';

const AVATAR = 96;

const SOURCES: {
  source: PhotoSource;
  label: string;
  icon: React.ComponentProps<typeof IconSymbol>['name'];
}[] = [
  { source: 'camera', label: C.photo.camera, icon: 'camera' },
  { source: 'library', label: C.photo.library, icon: 'photo.on.rectangle' },
];

export default function PhotoBlock({
  pid,
  person,
  offline,
}: {
  pid: string;
  person: {
    id: string;
    firstName: string;
    lastName: string;
    photoUrl?: string;
  };
  offline: boolean;
}) {
  const t = useComunicaTheme();
  const { entry, problem, uploading, choose, retry } = usePhotoUpload(pid);
  const [choosing, setChoosing] = useState(false);
  const hasPhoto = !!person.photoUrl;
  const disabled = uploading || offline;
  const sources = SOURCES.filter(
    (s) => Platform.OS !== 'web' || s.source !== 'camera',
  );
  // Mientras sube o si falla, la foto elegida (su copia local); subida, la del servidor, que ya viene en `person`.
  const preview = entry && entry.phase !== 'applied' ? entry.file.uri : null;
  const label = hasPhoto || entry ? C.photo.change : C.photo.add;
  const button = hasPhoto || entry ? C.photo.buttonChange : C.photo.buttonAdd;

  return (
    <View style={styles.block}>
      <View style={styles.row}>
        {preview ? (
          <Image
            source={{ uri: preview }}
            style={[
              styles.preview,
              { backgroundColor: t.backgroundSunken },
              uploading && styles.dim,
            ]}
            contentFit="cover"
            accessible={false}
            importantForAccessibility="no-hide-descendants"
          />
        ) : (
          <PersonAvatar person={person} size={AVATAR} />
        )}
        <View style={styles.text}>
          <Text style={[styles.label, { color: t.text }]}>{label}</Text>
          <PressableFeedback
            onPress={() => {
              h.tap();
              setChoosing(true);
            }}
            isDisabled={disabled}
            accessibilityRole="button"
            accessibilityLabel={
              hasPhoto || entry
                ? 'Cambiar foto de perfil'
                : 'Subir una foto de perfil'
            }
            accessibilityState={{ disabled }}
            style={[
              styles.button,
              { borderColor: disabled ? t.separator : t.accentText },
            ]}
          >
            <IconSymbol
              name="camera"
              size={16}
              color={disabled ? t.textMuted : t.accentText}
            />
            <Text
              style={[
                styles.buttonText,
                { color: disabled ? t.textMuted : t.accentText },
              ]}
            >
              {button}
            </Text>
            {/* Al final: en web, delante, el hueco (`gap`) movía el contenido. */}
            <PressableFeedback.Highlight />
          </PressableFeedback>
        </View>
      </View>
      {entry ? (
        <View style={styles.status}>
          <UploadStatus
            state={entry.phase}
            onRetry={entry.retryable === false ? undefined : retry}
          />
          {entry.phase === 'failed' && entry.message ? (
            <Text style={[styles.hint, { color: t.textSecondary }]}>
              {entry.message}
            </Text>
          ) : null}
        </View>
      ) : null}
      {problem ? (
        <Text
          style={[styles.hint, { color: t.warningText }]}
          accessibilityRole="alert"
        >
          {problem}
        </Text>
      ) : null}
      <Text style={[styles.hint, { color: t.textSecondary }]}>
        {offline ? C.photo.offline : C.photo.hint}
      </Text>
      <BottomSheet
        visible={choosing}
        onClose={() => setChoosing(false)}
        title={C.photo.sheetTitle}
      >
        <View style={[styles.list, { backgroundColor: t.card }]}>
          {sources.map((s, i) => (
            <PressableFeedback
              key={s.source}
              onPress={() => {
                setChoosing(false);
                void choose(s.source);
              }}
              accessibilityRole="button"
              accessibilityLabel={s.label}
              style={[
                styles.option,
                i > 0 && {
                  borderTopWidth: StyleSheet.hairlineWidth,
                  borderTopColor: t.separator,
                },
              ]}
            >
              <IconSymbol name={s.icon} size={20} color={t.accentText} />
              <Text style={[styles.optionText, { color: t.text }]}>
                {s.label}
              </Text>
              <PressableFeedback.Highlight />
            </PressableFeedback>
          ))}
        </View>
        <Text style={[styles.sheetHint, { color: t.textSecondary }]}>
          {Platform.OS === 'web' ? C.photo.sheetHintWeb : C.photo.sheetHint}
        </Text>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { padding: 16, gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  preview: { width: AVATAR, height: AVATAR, borderRadius: radii.full },
  dim: { opacity: 0.6 },
  text: { flex: 1, gap: 8, alignItems: 'flex-start' },
  label: { ...typography.body, fontWeight: '600' },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: radii.sm,
    borderWidth: 1,
    overflow: 'hidden',
  },
  buttonText: { ...typography.button },
  status: { gap: 4 },
  hint: { ...typography.caption },
  list: { borderRadius: radii.md, overflow: 'hidden', marginBottom: 12 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 52,
    paddingHorizontal: 16,
  },
  optionText: { ...typography.body, flex: 1 },
  sheetHint: { ...typography.caption, textAlign: 'center', marginBottom: 16 },
});
