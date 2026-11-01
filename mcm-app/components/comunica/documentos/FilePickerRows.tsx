// Elegir el archivo de un documento (plan 16): «Hacer una foto», «Elegir de la galería» y «Elegir un archivo» (`fotos-documentos` = sí; en web, sin cámara). Lo elegido
// se COMPRUEBA antes de enviar (`fileProblem`: más de 0 bytes, 4 MB, extensión de la lista) y se devuelve ya como el `UploadFile` que sube el cliente. En iOS,
// debajo, «¿Lo tienes en papel? Escanéalo con Notas o Archivos y elígelo aquí.».

import React, { useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { PressableFeedback } from 'heroui-native';
import { IconSymbol } from '@/components/ui/IconSymbol';
import typography from '@/constants/typography';
import { radii, shadows } from '@/constants/uiStyles';
import type { UploadFile } from '@/services/comunica/client';
import { localFileSize } from '@/services/comunica/localFiles';
import {
  ANY_FILE,
  pickFile,
  PickerPermissionError,
} from '@/hooks/comunica/pickFile';
import { fileProblem, mimeOf } from '@/utils/comunica/files';
import { DOCUMENTS_TEXT as TXT } from '@/utils/comunica/documents';
import { h } from '@/utils/haptics';
import { useComunicaTheme } from '../comun/useComunicaTheme';
import type { FileSource } from '../comun/form/FileField';

type IconName = React.ComponentProps<typeof IconSymbol>['name'];
const SOURCES: { source: FileSource; label: string; icon: IconName }[] = [
  { source: 'camera', label: 'Hacer una foto', icon: 'camera' },
  {
    source: 'library',
    label: 'Elegir de la galería',
    icon: 'photo.on.rectangle',
  },
  { source: 'file', label: 'Elegir un archivo', icon: 'doc.text' },
];

export default function FilePickerRows({
  onPicked,
  disabled = false,
}: {
  /** El archivo elegido y válido, o `null` con el problema si no vale. */
  onPicked: (file: UploadFile | null, problem: string | null) => void;
  disabled?: boolean;
}) {
  const t = useComunicaTheme();
  const [busy, setBusy] = useState(false);
  const choose = async (source: FileSource) => {
    if (busy || disabled) return;
    setBusy(true);
    try {
      const p = await pickFile(source, ANY_FILE);
      if (!p) return;
      const name = p.name ?? p.uri.split('/').pop() ?? 'archivo';
      const size = p.size ?? localFileSize(p.uri) ?? 0;
      const bad = fileProblem({ name, size });
      if (bad) {
        h.error();
        onPicked(null, bad);
        return;
      }
      onPicked(
        {
          uri: p.uri,
          name,
          mimeType: p.mimeType ?? mimeOf(name),
          size,
          blob: p.blob,
        },
        null,
      );
    } catch (e) {
      h.error();
      onPicked(
        null,
        e instanceof PickerPermissionError
          ? 'Para hacer una foto, da permiso a la cámara en los Ajustes del móvil.'
          : 'No se ha podido abrir. Prueba otra vez.',
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <View style={styles.wrap}>
      {SOURCES.filter(
        (s) => !(s.source === 'camera' && Platform.OS === 'web'),
      ).map((s) => (
        <PressableFeedback
          key={s.source}
          onPress={() => void choose(s.source)}
          isDisabled={disabled || busy}
          accessibilityRole="button"
          accessibilityLabel={s.label}
          style={[styles.row, shadows.card, { backgroundColor: t.card }]}
        >
          <IconSymbol name={s.icon} size={20} color={t.accentText} />
          <Text style={[styles.label, { color: t.text }]}>{s.label}</Text>
        </PressableFeedback>
      ))}
      {Platform.OS === 'ios' ? (
        <Text style={[styles.hint, { color: t.textSecondary }]}>
          {TXT.paperHint}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 52,
    paddingHorizontal: 16,
    borderRadius: radii.md,
  },
  label: { ...typography.body },
  hint: { ...typography.caption },
});
