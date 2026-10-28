// Un archivo para subir (plan 09, reglas 8-10): el título o el certificado.
//
//   · Con archivo ya en el CRM: «Ya subido» como dato y «Revisarlo en
//     Documentos →»; la pista invita a sustituirlo.
//   · «Elegir archivo» abre una hoja: hacer una foto, elegir de la galería o
//     un archivo (`fotos-documentos` = sí). En web, sin cámara.
//   · Lo elegido se comprueba ANTES de subir (PDF, JPG o PNG, 6 MB) y se sube
//     en el acto, sin esperar a «Guardar», con su `UploadStatus`.
//
// Este componente solo pinta y avisa: elegir y subir lo hace
// `useDocumentUpload` (por `services/comunica/`).

import React, { useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { PressableFeedback } from 'heroui-native';
import BottomSheet from '@/components/BottomSheet';
import { IconSymbol } from '@/components/ui/IconSymbol';
import typography from '@/constants/typography';
import { radii } from '@/constants/uiStyles';
import { h } from '@/utils/haptics';
import UploadStatus, { type UploadState } from '../UploadStatus';
import { useComunicaTheme } from '../useComunicaTheme';
import { FieldHint, FieldLabel } from './FormField';
import LockedRow from './LockedRow';

export type FileSource = 'camera' | 'library' | 'file';

export interface FileFieldUpload {
  name: string;
  sizeText: string;
  state: Extract<UploadState, 'sending' | 'applied' | 'failed'>;
  /** Por qué no ha subido, en palabras de persona. */
  message?: string;
}

const SOURCES: {
  source: FileSource;
  label: string;
  icon: React.ComponentProps<typeof IconSymbol>['name'];
}[] = [
  { source: 'camera', label: 'Hacer una foto', icon: 'camera' },
  {
    source: 'library',
    label: 'Elegir de la galería',
    icon: 'photo.on.rectangle',
  },
  { source: 'file', label: 'Elegir un archivo', icon: 'doc.text' },
];

export const FILE_HINT_EMPTY =
  'Formatos: pdf, jpg, png · Tamaño máximo: 6MB · Puedes subirlo ahora o más adelante.';
export const FILE_HINT_REPLACE =
  'Ya tienes un archivo guardado. Sube uno nuevo para sustituirlo.';
export const PAPER_HINT =
  '¿Lo tienes en papel? Escanéalo con Notas o Archivos y elígelo aquí.';

export default function FileField({
  label,
  hasFile,
  upload,
  problem,
  onChoose,
  onRetry,
  onReview,
  children,
}: {
  label: string;
  /** El CRM ya tiene un archivo de este tipo. */
  hasFile: boolean;
  upload?: FileFieldUpload | null;
  /** Lo elegido no vale («Ese archivo pesa más de 6 MB.»). */
  problem?: string | null;
  onChoose: (source: FileSource) => void;
  onRetry?: () => void;
  /** «Revisarlo en Documentos →». */
  onReview?: () => void;
  /** Lo que va debajo (el enlace al trámite del Ministerio). */
  children?: React.ReactNode;
}) {
  const t = useComunicaTheme();
  const [choosing, setChoosing] = useState(false);
  const sending = upload?.state === 'sending';
  const uploaded = hasFile || upload?.state === 'applied';
  const sources = SOURCES.filter(
    (s) => Platform.OS !== 'web' || s.source !== 'camera',
  );
  return (
    <View style={styles.field}>
      <FieldLabel label={label} />
      {uploaded && upload?.state !== 'applied' ? (
        <LockedRow
          value="Ya subido"
          action={
            onReview
              ? { label: 'Revisarlo en Documentos →', onPress: onReview }
              : undefined
          }
        />
      ) : null}
      {upload ? (
        <View
          style={[styles.upload, { backgroundColor: t.backgroundSunken }]}
          accessible
          accessibilityLabel={`${upload.name}, ${upload.sizeText}`}
        >
          <IconSymbol name="paperclip" size={18} color={t.textSecondary} />
          <View style={styles.uploadBody}>
            <Text
              style={[styles.fileName, { color: t.text }]}
              numberOfLines={1}
              ellipsizeMode="middle"
            >
              {upload.name}
            </Text>
            <UploadStatus state={upload.state} onRetry={onRetry} />
            {upload.state === 'failed' && upload.message ? (
              <Text style={[styles.message, { color: t.textSecondary }]}>
                {upload.message}
              </Text>
            ) : null}
          </View>
        </View>
      ) : null}
      <FieldHint
        hint={uploaded ? FILE_HINT_REPLACE : FILE_HINT_EMPTY}
        error={problem ?? undefined}
      />
      <PressableFeedback
        onPress={() => {
          h.tap();
          setChoosing(true);
        }}
        isDisabled={sending}
        accessibilityRole="button"
        accessibilityLabel={`${uploaded ? 'Sustituir' : 'Elegir'}: ${label}`}
        accessibilityState={{ disabled: sending }}
        style={[styles.button, { borderColor: t.accentText }]}
      >
        <PressableFeedback.Highlight />
        <IconSymbol name="paperclip" size={18} color={t.accentText} />
        <Text style={[styles.buttonText, { color: t.accentText }]}>
          {uploaded ? 'Subir otro archivo' : 'Elegir archivo'}
        </Text>
      </PressableFeedback>
      {Platform.OS === 'ios' ? (
        <Text style={[styles.message, { color: t.textSecondary }]}>
          {PAPER_HINT}
        </Text>
      ) : null}
      {children}
      <BottomSheet
        visible={choosing}
        onClose={() => setChoosing(false)}
        title={label}
      >
        <View style={[styles.list, { backgroundColor: t.card }]}>
          {sources.map((s, i) => (
            <PressableFeedback
              key={s.source}
              onPress={() => {
                setChoosing(false);
                onChoose(s.source);
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
              <PressableFeedback.Highlight />
              <IconSymbol name={s.icon} size={20} color={t.accentText} />
              <Text style={[styles.optionText, { color: t.text }]}>
                {s.label}
              </Text>
            </PressableFeedback>
          ))}
        </View>
        <Text style={[styles.sheetHint, { color: t.textSecondary }]}>
          PDF, JPG o PNG de hasta 6 MB.
        </Text>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { paddingHorizontal: 16, paddingVertical: 14, gap: 10 },
  upload: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 12,
    borderRadius: radii.md,
  },
  uploadBody: { flex: 1, gap: 4 },
  fileName: { ...typography.subhead, fontWeight: '600' },
  message: { ...typography.caption },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
    gap: 8,
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: radii.sm,
    borderWidth: 1,
    overflow: 'hidden',
  },
  buttonText: { ...typography.button },
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
