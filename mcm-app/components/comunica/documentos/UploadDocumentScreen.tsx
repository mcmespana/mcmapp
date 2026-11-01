// «Subir un documento» (plan 16, regla 6), en hoja: el archivo (foto,
// galería o archivo), el nombre (el del archivo sin extensión, editable) y
// una descripción. Se comprueba ANTES de enviar; sin archivo o sin conexión,
// «Subir documento» está apagado y dice por qué. Al subir vuelve a la lista,
// que enseña la tarjeta «Subiendo…» (llamada directa, nunca por la cola).

import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useToast } from '@/contexts/AppToastContext';
import typography from '@/constants/typography';
import {
  useActiveProfile,
  useProfileScope,
} from '@/hooks/comunica/useActiveProfile';
import {
  useOnline,
  useStartDocumentUpload,
} from '@/hooks/comunica/useDocuments';
import {
  DOCUMENT_SHEET_HINT,
  useDocumentPick,
} from '@/hooks/comunica/useDocumentPick';
import { nameProblem } from '@/utils/comunica/documents';
import { baseName } from '@/utils/comunica/files';
import AreaPrimaryButton from '../comun/AreaPrimaryButton';
import AreaScreen from '../comun/AreaScreen';
import FileField from '../comun/form/FileField';
import { TextFormField } from '../comun/form/FormField';
import FormSection from '../comun/form/FormSection';
import { useComunicaTheme } from '../comun/useComunicaTheme';

export const UPLOAD_OFFLINE = 'Necesitas conexión para subir';

export default function UploadDocumentScreen() {
  const t = useComunicaTheme();
  const router = useRouter();
  const { toast } = useToast();
  const { pid } = useActiveProfile();
  useProfileScope('personal', 'documents');
  const online = useOnline();
  const pick = useDocumentPick();
  const [name, setName] = useState('');
  const [nameTouched, setNameTouched] = useState(false);
  const [description, setDescription] = useState('');
  const start = useStartDocumentUpload(() =>
    toast.show({ label: 'Documento subido', variant: 'success' }),
  );

  // El nombre sale del archivo mientras la persona no lo haya escrito.
  const shownName = nameTouched
    ? name
    : pick.file
      ? baseName(pick.file.name)
      : '';
  const problem = pick.file && nameTouched ? nameProblem(shownName) : null;
  const ready = !!pid && !!pick.file && !nameProblem(shownName) && online;

  const submit = () => {
    const file = pick.take();
    if (!pid || !file || nameProblem(shownName)) return;
    start(pid, {
      name: shownName.trim(),
      description: description.trim() || undefined,
      file,
    });
    router.back();
  };

  return (
    <AreaScreen>
      <Stack.Screen options={{ title: 'Subir un documento' }} />
      <FormSection title="Archivo" footer={DOCUMENT_SHEET_HINT}>
        <FileField
          label="Archivo"
          hasFile={false}
          selected={pick.selected}
          problem={pick.problem}
          onChoose={(s) => void pick.choose(s)}
          sheetHint={DOCUMENT_SHEET_HINT}
        />
      </FormSection>
      <FormSection title="Datos">
        <TextFormField
          label="Nombre"
          value={shownName}
          onChangeText={(v) => {
            setNameTouched(true);
            setName(v);
          }}
          error={problem ?? undefined}
          maxLength={200}
          placeholder="Autorización de imagen"
        />
        <TextFormField
          label="Descripción"
          value={description}
          onChangeText={setDescription}
          multiline
          maxLength={2000}
          hint="Opcional."
        />
      </FormSection>
      <View style={styles.actions}>
        <AreaPrimaryButton
          label="Subir documento"
          icon="icloud.and.arrow.up"
          onPress={submit}
          disabled={!ready}
        />
        {!online ? (
          <Text style={[styles.why, { color: t.textSecondary }]}>
            {UPLOAD_OFFLINE}
          </Text>
        ) : !pick.file ? (
          <Text style={[styles.why, { color: t.textSecondary }]}>
            Elige primero el archivo.
          </Text>
        ) : null}
      </View>
    </AreaScreen>
  );
}

const styles = StyleSheet.create({
  actions: { gap: 8 },
  why: { ...typography.caption, textAlign: 'center' },
});
