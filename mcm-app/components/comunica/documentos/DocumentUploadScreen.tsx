// «Subir un documento» (plan 16, `single_stic_documents&action=create`): se elige el archivo, se pone el nombre (sin extensión, editable) y una descripción.
//
//   · Se valida ANTES de enviar (más de 0 bytes, 4 MB, extensión de la lista). «Subir documento» no se activa sin archivo (el plugin dejaba crear uno vacío).
//   · Directo, con conexión y con `clientId` (el mismo en los reintentos de esta subida): con el CRM caído sale el error y el mismo botón reintenta sin duplicar.
//   · El archivo elegido se copia a la caché de la app solo mientras sube y se borra al acabar y al salir.

import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import typography from '@/constants/typography';
import { useToast } from '@/contexts/AppToastContext';
import {
  isComunicaApiError,
  type UploadFile,
} from '@/services/comunica/client';
import { deleteLocalCopy } from '@/services/comunica/localFiles';
import { useActiveProfile } from '@/hooks/comunica/useActiveProfile';
import { useDocumentWrites } from '@/hooks/comunica/useDocuments';
import { DOCUMENTS_TEXT as TXT } from '@/utils/comunica/documents';
import { defaultDocumentName, FILE_ERRORS } from '@/utils/comunica/files';
import { h } from '@/utils/haptics';
import AreaPrimaryButton from '../comun/AreaPrimaryButton';
import AreaScreen from '../comun/AreaScreen';
import BottomActionBar from '../comun/BottomActionBar';
import RecordNote from '../comun/record/RecordNote';
import { TextFormField } from '../comun/form/FormField';
import FormSection from '../comun/form/FormSection';
import { useComunicaTheme } from '../comun/useComunicaTheme';
import FilePickerRows from './FilePickerRows';

export default function DocumentUploadScreen({
  offline = false,
}: {
  offline?: boolean;
}) {
  const t = useComunicaTheme();
  const router = useRouter();
  const { toast } = useToast();
  const { active } = useActiveProfile();
  const writes = useDocumentWrites(active?.id ?? '');
  const [file, setFile] = useState<UploadFile | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const copy = useRef<string | null>(null);

  // La copia del archivo elegido no sobrevive a la pantalla.
  useEffect(
    () => () => {
      if (copy.current) deleteLocalCopy(copy.current);
    },
    [],
  );

  const onPicked = (f: UploadFile | null, p: string | null) => {
    if (copy.current && copy.current !== f?.uri) deleteLocalCopy(copy.current);
    copy.current = f?.uri ?? null;
    setProblem(p);
    setError(null);
    if (f) {
      setFile(f);
      if (!name.trim()) setName(defaultDocumentName(f.name));
    }
  };

  const canSend = !!file && name.trim() !== '' && !offline;
  const onSend = async () => {
    if (!file || !canSend) return;
    setError(null);
    try {
      await writes.create(
        {
          name: name.trim(),
          ...(description.trim() ? { description: description.trim() } : {}),
        },
        file,
      );
      h.formSuccess();
      toast.show({ variant: 'success', label: TXT.uploaded });
      if (copy.current) deleteLocalCopy(copy.current);
      copy.current = null;
      router.back();
    } catch (e) {
      h.error();
      if (isComunicaApiError(e) && e.code === 'validation') {
        setProblem(e.message || FILE_ERRORS.badType);
        return;
      }
      setError(
        'No hemos podido subir el documento. Inténtalo otra vez en un rato.',
      );
    }
  };

  return (
    <AreaScreen
      footer={
        <BottomActionBar>
          {offline ? (
            <Text style={[styles.hint, { color: t.textSecondary }]}>
              {TXT.uploadNeedsConnection}
            </Text>
          ) : null}
          <AreaPrimaryButton
            label="Subir documento"
            onPress={() => void onSend()}
            disabled={!canSend}
            loading={writes.busy === 'create'}
            haptic
          />
        </BottomActionBar>
      }
    >
      <Stack.Screen options={{ title: 'Subir un documento' }} />
      <FormSection title="Archivo">
        <View style={styles.inner}>
          <FilePickerRows
            onPicked={onPicked}
            disabled={writes.busy === 'create'}
          />
          {file ? (
            <Text
              style={[styles.picked, { color: t.text }]}
              accessibilityLabel={`Archivo elegido: ${file.name}`}
            >
              {file.name}
            </Text>
          ) : null}
          {problem ? (
            <Text style={[styles.problem, { color: t.dangerText }]}>
              {problem}
            </Text>
          ) : null}
        </View>
      </FormSection>
      <FormSection title="Datos">
        <TextFormField
          label="Nombre"
          value={name}
          onChangeText={setName}
          maxLength={200}
        />
        <TextFormField
          label="Descripción"
          value={description}
          onChangeText={setDescription}
          multiline
          maxLength={2000}
        />
      </FormSection>
      {error ? <RecordNote tone="danger" text={error} /> : null}
    </AreaScreen>
  );
}

const styles = StyleSheet.create({
  inner: { padding: 16, gap: 12 },
  picked: { ...typography.body, fontWeight: '600' },
  problem: { ...typography.caption },
  hint: { ...typography.caption, textAlign: 'center' },
});
