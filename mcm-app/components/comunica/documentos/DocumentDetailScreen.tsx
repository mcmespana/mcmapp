// La ficha de un documento (plan 16, `single_stic_documents`): el tipo y el nombre del archivo, la fecha, la caducidad, el estado, la categoría y el enlace compartido (solo
// lectura); el nombre y la descripción, editables; «Sustituir archivo»; «Eliminar documento» al final.
//
//   · Un 403 (ajeno, borrado, inexistente): «Este documento ya no está disponible» · «Vuelve al listado y entra de nuevo desde ahí.» · «Volver». Nunca «no es tuyo».
//   · Editar manda SOLO lo que difiere de lo confirmado; «Guardar» (la única principal) apagado sin cambios o sin conexión.
//   · Borrar solo desde el botón destructivo, tras la confirmación nativa: nunca por un enlace.
//   · Nada se guarda en el móvil; sin conexión, «Abrir», «Guardar» y «Eliminar» apagados.

import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { PressableFeedback } from 'heroui-native';
import EmptyState from '@/components/ui/EmptyState';
import typography from '@/constants/typography';
import { radii } from '@/constants/uiStyles';
import { useToast } from '@/contexts/AppToastContext';
import {
  isComunicaApiError,
  type UploadFile,
} from '@/services/comunica/client';
import type { DocumentDetail } from '@/services/comunica/contract';
import { useActiveProfile } from '@/hooks/comunica/useActiveProfile';
import {
  useClearOpenCopies,
  useDocument,
  useDocumentWrites,
  useOpenFile,
} from '@/hooks/comunica/useDocuments';
import { fullDay } from '@/utils/comunica/dates';
import {
  DOCUMENTS_TEXT as TXT,
  documentChanges,
  documentKind,
} from '@/utils/comunica/documents';
import { SAVE_ERROR } from '@/utils/comunica/registrationNotes';
import { h } from '@/utils/haptics';
import AreaPrimaryButton from '../comun/AreaPrimaryButton';
import AreaScreen from '../comun/AreaScreen';
import { AreaSkeleton, isNetwork } from '../comun/AreaState';
import BottomActionBar from '../comun/BottomActionBar';
import { confirmAction } from '../comun/confirm';
import FactList, { type Fact } from '../comun/record/FactList';
import RecordNote from '../comun/record/RecordNote';
import { TextFormField } from '../comun/form/FormField';
import FormSection from '../comun/form/FormSection';
import { useComunicaTheme } from '../comun/useComunicaTheme';
import FilePickerRows from './FilePickerRows';

export default function DocumentDetailScreen({ id }: { id: string }) {
  const t = useComunicaTheme();
  const router = useRouter();
  const { active } = useActiveProfile();
  const q = useDocument(active?.id, id);
  const toList = () => router.replace('/comunica/documentos' as never);
  const colors = {
    accentColor: t.accentText,
    titleColor: t.text,
    subtitleColor: t.textSecondary,
  };
  if (
    isComunicaApiError(q.error) &&
    ['forbidden', 'not_found'].includes(q.error.code)
  ) {
    return (
      <AreaScreen>
        <EmptyState
          icon="lock"
          title={TXT.unavailable}
          subtitle={TXT.unavailableBody}
          actionLabel={TXT.back}
          onAction={toList}
          {...colors}
        />
      </AreaScreen>
    );
  }
  if (!q.data) {
    return (
      <AreaScreen onRefresh={() => q.refetch()}>
        {q.error ? (
          <EmptyState
            icon={isNetwork(q.error) ? 'wifi-off' : 'error-outline'}
            title={
              isNetwork(q.error)
                ? TXT.needsConnection
                : 'No se ha podido cargar'
            }
            actionLabel="Reintentar"
            onAction={() => void q.refetch()}
            {...colors}
          />
        ) : (
          <AreaSkeleton kind="cards" />
        )}
      </AreaScreen>
    );
  }
  return (
    <Detail
      pid={active!.id}
      doc={q.data.document}
      offline={isNetwork(q.error)}
      refetch={() => q.refetch()}
    />
  );
}

function Detail({
  pid,
  doc,
  offline,
  refetch,
}: {
  pid: string;
  doc: DocumentDetail;
  offline: boolean;
  refetch: () => Promise<unknown>;
}) {
  const t = useComunicaTheme();
  const router = useRouter();
  const { toast } = useToast();
  const writes = useDocumentWrites(pid);
  const { open, share, downloading } = useOpenFile(pid);
  useClearOpenCopies();
  const [name, setName] = useState(doc.name);
  const [description, setDescription] = useState(doc.description ?? '');
  const [problem, setProblem] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const changes = documentChanges(doc, { name, description });
  const dirty = Object.keys(changes).length > 0;
  const kind = documentKind(doc.fileName);

  const say = (r: 'opened' | 'offline' | 'failed') => {
    if (r === 'offline')
      toast.show({ variant: 'warning', label: TXT.openNeedsConnection });
    else if (r === 'failed')
      toast.show({ variant: 'danger', label: TXT.downloadFailed });
  };

  const onSave = async () => {
    if (!dirty || offline || name.trim() === '') return;
    setError(null);
    try {
      await writes.edit(doc.id, changes);
      h.formSuccess();
      toast.show({ variant: 'success', label: TXT.saved });
      await refetch();
    } catch (e) {
      h.error();
      setError(
        isComunicaApiError(e) && e.code === 'validation'
          ? e.message
          : SAVE_ERROR,
      );
    }
  };

  const onReplace = async (f: UploadFile | null, p: string | null) => {
    setProblem(p);
    if (!f) return;
    setError(null);
    try {
      await writes.edit(doc.id, {}, f);
      h.formSuccess();
      toast.show({ variant: 'success', label: TXT.saved });
      await refetch();
    } catch (e) {
      h.error();
      setError(
        isComunicaApiError(e) && e.code === 'validation'
          ? e.message
          : SAVE_ERROR,
      );
    }
  };

  const onDelete = async () => {
    if (offline || writes.busy === 'delete') return;
    const ok = await confirmAction(
      TXT.deleteTitle,
      TXT.deleteBody,
      'Eliminar documento',
      true,
    );
    if (!ok) return;
    setError(null);
    try {
      await writes.remove(doc.id);
      h.remove();
      toast.show({ variant: 'success', label: TXT.deleted });
      router.replace('/comunica/documentos' as never);
    } catch {
      h.error();
      setError(SAVE_ERROR);
    }
  };

  const facts: Fact[] = [];
  if (doc.fileName)
    facts.push({
      icon: 'doc.text',
      label: kind ? `Archivo · ${kind}` : 'Archivo',
      value: doc.fileName,
    });
  if (doc.activeOn)
    facts.push({
      icon: 'calendar',
      label: 'Fecha',
      value: fullDay(doc.activeOn),
    });
  if (doc.expiresOn)
    facts.push({
      icon: 'clock',
      label: 'Caduca',
      value: fullDay(doc.expiresOn),
    });
  if (doc.status)
    facts.push({
      icon: 'checkmark.seal.fill',
      label: 'Estado',
      value: doc.status.label,
    });
  if (doc.category)
    facts.push({
      icon: 'list.bullet.clipboard',
      label: 'Categoría',
      value: doc.category.label,
    });
  if (doc.sharedLink)
    facts.push({
      icon: 'link',
      label: 'Enlace compartido',
      value: doc.sharedLink,
      onPress: () => void WebBrowser.openBrowserAsync(doc.sharedLink!),
      actionLabel: 'Abrir el enlace compartido',
    });

  const busy = writes.busy;
  return (
    <AreaScreen
      onRefresh={refetch}
      footer={
        <BottomActionBar>
          {offline ? (
            <Text style={[styles.hint, { color: t.textSecondary }]}>
              Necesitas conexión
            </Text>
          ) : null}
          <AreaPrimaryButton
            label={busy === 'edit' ? 'Guardando…' : 'Guardar'}
            onPress={() => void onSave()}
            disabled={!dirty || offline || name.trim() === ''}
            loading={busy === 'edit'}
            haptic
          />
        </BottomActionBar>
      }
    >
      <Stack.Screen options={{ title: 'Documento' }} />
      <Text
        accessibilityRole="header"
        style={[styles.title, { color: t.text }]}
      >
        {doc.name || doc.fileName || 'Documento'}
      </Text>
      <FactList facts={facts} />

      {doc.fileName ? (
        <View style={styles.actions}>
          <Secondary
            label={downloading === doc.id ? 'Descargando…' : 'Abrir'}
            disabled={offline || !!downloading}
            onPress={async () => say(await open(doc))}
          />
          <Secondary
            label="Compartir"
            disabled={offline || !!downloading}
            onPress={async () => say(await share(doc))}
          />
        </View>
      ) : null}

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

      <FormSection title="Sustituir archivo">
        <View style={styles.inner}>
          <FilePickerRows
            onPicked={(f, p) => void onReplace(f, p)}
            disabled={offline || busy === 'edit'}
          />
          {problem ? (
            <Text style={[styles.problem, { color: t.dangerText }]}>
              {problem}
            </Text>
          ) : null}
        </View>
      </FormSection>

      {error ? <RecordNote tone="danger" text={error} /> : null}

      <PressableFeedback
        onPress={() => void onDelete()}
        isDisabled={offline || busy === 'delete'}
        accessibilityRole="button"
        accessibilityLabel="Eliminar documento"
        style={styles.delete}
      >
        <Text style={[styles.deleteLabel, { color: t.dangerText }]}>
          {busy === 'delete' ? 'Eliminando…' : 'Eliminar documento'}
        </Text>
      </PressableFeedback>
    </AreaScreen>
  );
}

function Secondary({
  label,
  disabled,
  onPress,
}: {
  label: string;
  disabled: boolean;
  onPress: () => void;
}) {
  const t = useComunicaTheme();
  return (
    <PressableFeedback
      onPress={() => {
        if (disabled) return;
        h.tap();
        onPress();
      }}
      isDisabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[
        styles.secondary,
        { borderColor: t.accentText, opacity: disabled ? 0.5 : 1 },
      ]}
    >
      <Text style={[styles.secondaryLabel, { color: t.accentText }]}>
        {label}
      </Text>
    </PressableFeedback>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.h2 },
  actions: { flexDirection: 'row', gap: 12 },
  secondary: {
    flex: 1,
    minHeight: 48,
    borderWidth: 1.5,
    borderRadius: radii.pillFull,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryLabel: { ...typography.button },
  inner: { padding: 16, gap: 12 },
  problem: { ...typography.caption },
  hint: { ...typography.caption, textAlign: 'center' },
  delete: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  deleteLabel: { ...typography.button },
});
