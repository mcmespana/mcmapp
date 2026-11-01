// La ficha de un documento (plan 16, reglas 5, 7 y 8): el archivo (abrir,
// compartir, sustituir), los datos de solo lectura (fecha, caducidad,
// estado, categoría, enlace compartido), el nombre y la descripción
// editables y «Eliminar documento» al final. Editar manda solo lo que
// cambia; borrar solo sale del botón destructivo de la confirmación. Un 403:
// «Este documento ya no está disponible», nunca «no es tuyo».

import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { PressableFeedback } from 'heroui-native';
import EmptyState from '@/components/ui/EmptyState';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { useToast } from '@/contexts/AppToastContext';
import { radii } from '@/constants/uiStyles';
import typography from '@/constants/typography';
import { comunicaNow, getComunicaApi } from '@/services/comunica';
import { isComunicaApiError } from '@/services/comunica/client';
import type { DocumentDetail } from '@/services/comunica/contract';
import { useProfileScope } from '@/hooks/comunica/useActiveProfile';
import {
  useDocument,
  useDocumentWrites,
  useOnline,
} from '@/hooks/comunica/useDocuments';
import {
  DOCUMENT_SHEET_HINT,
  useDocumentPick,
} from '@/hooks/comunica/useDocumentPick';
import { OPEN_FILE_TEXT, useOpenFile } from '@/hooks/comunica/useOpenFile';
import {
  documentChanges,
  documentChip,
  formOfDocument,
  isExpired,
  longDate,
  nameProblem,
} from '@/utils/comunica/documents';
import { documentKind } from '@/utils/comunica/files';
import { madridDay } from '@/utils/comunica/madrid';
import { h } from '@/utils/haptics';
import AreaPrimaryButton from '../comun/AreaPrimaryButton';
import AreaScreen from '../comun/AreaScreen';
import AreaState from '../comun/AreaState';
import { confirmAction } from '../comun/confirm';
import FileField from '../comun/form/FileField';
import { TextFormField } from '../comun/form/FormField';
import FormSection from '../comun/form/FormSection';
import StatusChip from '../comun/StatusChip';
import { useComunicaTheme } from '../comun/useComunicaTheme';
import { KindCapsule } from './DocumentCard';

export const DOCUMENT_GONE = {
  title: 'Este documento ya no está disponible',
  subtitle: 'Vuelve al listado y entra de nuevo desde ahí.',
};

export const DELETE_CONFIRM = {
  title: 'Eliminar documento',
  message: '¿Seguro que quieres borrar este documento? No se puede deshacer.',
};

export default function DocumentDetailScreen({ id }: { id: string }) {
  const t = useComunicaTheme();
  const router = useRouter();
  useProfileScope('personal', 'documents');
  const q = useDocument(id);
  const gone = isComunicaApiError(q.error) && q.error.code === 'forbidden';

  return (
    <AreaScreen onRefresh={gone ? undefined : () => q.refetch()}>
      <Stack.Screen options={{ title: 'Documento' }} />
      {gone ? (
        <EmptyState
          icon="lock"
          title={DOCUMENT_GONE.title}
          subtitle={DOCUMENT_GONE.subtitle}
          actionLabel="Volver"
          onAction={() =>
            router.canGoBack()
              ? router.back()
              : router.replace('/comunica/documentos')
          }
          accentColor={t.accentText}
          titleColor={t.text}
          subtitleColor={t.textSecondary}
        />
      ) : (
        <AreaState query={q} skeleton="cards">
          {(data) => (
            <DocumentForm
              key={data.generatedAt}
              pid={q.pid}
              doc={data.document}
            />
          )}
        </AreaState>
      )}
    </AreaScreen>
  );
}

function DocumentForm({
  pid,
  doc,
}: {
  pid: string | null;
  doc: DocumentDetail;
}) {
  const t = useComunicaTheme();
  const router = useRouter();
  const { toast } = useToast();
  const online = useOnline();
  const opener = useOpenFile();
  const writes = useDocumentWrites(pid, doc.id);
  const pick = useDocumentPick();
  // Cada lectura nueva remonta el formulario (`key`): parte de lo confirmado.
  const base = useMemo(() => formOfDocument(doc), [doc]);
  const [form, setForm] = useState(base);

  const today = madridDay(comunicaNow());
  const chip = documentChip(doc, today);
  const changes = documentChanges(base, form);
  const dirty = Object.keys(changes).length > 0 || !!pick.file;
  const nameError = nameProblem(form.name);
  const working = writes.phase === 'working';
  const download = (p: (f: number) => void) =>
    getComunicaApi().getProfileDocumentFile(pid!, doc.id, p);

  const save = async () => {
    if (!dirty || nameError) return;
    const ok = await writes.save(changes, pick.file ?? undefined);
    if (ok) {
      h.formSuccess();
      pick.clear();
      toast.show({ label: 'Documento guardado', variant: 'success' });
    }
  };

  const remove = async () => {
    h.select();
    const yes = await confirmAction(
      DELETE_CONFIRM.title,
      DELETE_CONFIRM.message,
      'Eliminar',
      true,
    );
    if (!yes) return;
    if (await writes.remove()) {
      h.remove();
      toast.show({ label: 'Documento eliminado', variant: 'success' });
      if (router.canGoBack()) router.back();
      else router.replace('/comunica/documentos');
    }
  };

  const rows: [string, React.ReactNode][] = [
    ['Fecha', doc.activeOn ? longDate(doc.activeOn) : null],
    [
      'Caducidad',
      doc.expiresOn
        ? `${longDate(doc.expiresOn)}${isExpired(doc, today) ? ' (caducado)' : ''}`
        : null,
    ],
    [
      'Estado',
      chip ? <StatusChip label={chip.label} tone={chip.tone} /> : null,
    ],
    ['Categoría', doc.category?.label ?? null],
  ];

  return (
    <View style={styles.stack}>
      <FormSection title="Archivo">
        <View style={styles.fileRow}>
          <KindCapsule kind={documentKind(doc.fileName)} />
          <View style={styles.fileBody}>
            <Text style={[styles.title, { color: t.text }]}>{doc.name}</Text>
            <Text
              style={[styles.sub, { color: t.textSecondary }]}
              numberOfLines={1}
              ellipsizeMode="middle"
            >
              {doc.fileName ?? 'Sin archivo'}
            </Text>
          </View>
        </View>
        {doc.fileName ? (
          <View style={styles.fileActions}>
            <ActionButton
              icon="arrow.up.right"
              label={opener.busyKey === 'open' ? 'Abriendo…' : 'Abrir'}
              disabled={!online || !pid || opener.busyKey !== null}
              onPress={() => void opener.open('open', download)}
            />
            <ActionButton
              icon="square.and.arrow.up"
              label={opener.busyKey === 'share' ? 'Preparando…' : 'Compartir'}
              disabled={!online || !pid || opener.busyKey !== null}
              onPress={() => void opener.share('share', download)}
            />
          </View>
        ) : null}
        {!online ? (
          <Text style={[styles.offline, { color: t.textSecondary }]}>
            {OPEN_FILE_TEXT.offline}.
          </Text>
        ) : null}
        <FileField
          label={doc.fileName ? 'Sustituir archivo' : 'Añadir archivo'}
          hasFile={false}
          selected={pick.selected}
          problem={pick.problem}
          onChoose={(s) => void pick.choose(s)}
          sheetHint={DOCUMENT_SHEET_HINT}
        />
      </FormSection>

      <FormSection title="Datos">
        {rows.map(([label, value]) =>
          value ? (
            <View key={label} style={styles.dataRow}>
              <Text style={[styles.dataLabel, { color: t.textSecondary }]}>
                {label}
              </Text>
              {typeof value === 'string' ? (
                <Text style={[styles.dataValue, { color: t.text }]}>
                  {value}
                </Text>
              ) : (
                value
              )}
            </View>
          ) : null,
        )}
        {doc.sharedLink ? (
          <PressableFeedback
            onPress={() => void WebBrowser.openBrowserAsync(doc.sharedLink!)}
            accessibilityRole="link"
            accessibilityLabel="Abrir el enlace compartido"
            style={styles.dataRow}
          >
            <Text style={[styles.dataLabel, { color: t.textSecondary }]}>
              Enlace compartido
            </Text>
            <Text style={[styles.link, { color: t.accentText }]}>Abrir</Text>
            <PressableFeedback.Highlight />
          </PressableFeedback>
        ) : null}
      </FormSection>

      <FormSection title="Nombre y descripción">
        <TextFormField
          label="Nombre"
          value={form.name}
          onChangeText={(name) => setForm((f) => ({ ...f, name }))}
          error={nameError ?? undefined}
          maxLength={200}
        />
        <TextFormField
          label="Descripción"
          value={form.description}
          onChangeText={(description) =>
            setForm((f) => ({ ...f, description }))
          }
          multiline
          maxLength={2000}
        />
      </FormSection>

      <View style={styles.actions}>
        {writes.phase === 'failed' && writes.message ? (
          <View style={[styles.error, { backgroundColor: t.warningSoft }]}>
            <Text style={[styles.sub, { color: t.warningText }]}>
              {writes.message}
            </Text>
            <PressableFeedback
              onPress={() => void writes.retry()}
              accessibilityRole="button"
              accessibilityLabel="Reintentar"
              hitSlop={12}
            >
              <Text style={[styles.link, { color: t.accentText }]}>
                Reintentar
              </Text>
            </PressableFeedback>
          </View>
        ) : null}
        <AreaPrimaryButton
          label={working ? 'Guardando…' : 'Guardar'}
          onPress={() => void save()}
          disabled={!dirty || !!nameError || !online || !pid}
          loading={working && writes.failedKind === null}
        />
        {!online ? (
          <Text style={[styles.offline, { color: t.textSecondary }]}>
            Necesitas conexión para guardar o eliminar.
          </Text>
        ) : null}
        <PressableFeedback
          onPress={() => void remove()}
          isDisabled={!online || working || !pid}
          accessibilityRole="button"
          accessibilityLabel="Eliminar documento"
          accessibilityState={{ disabled: !online || working }}
          style={styles.delete}
        >
          <IconSymbol
            name="trash"
            size={18}
            color={online ? t.dangerText : t.textMuted}
          />
          <Text
            style={[
              styles.deleteText,
              { color: online ? t.dangerText : t.textMuted },
            ]}
          >
            Eliminar documento
          </Text>
          <PressableFeedback.Highlight />
        </PressableFeedback>
      </View>
    </View>
  );
}

function ActionButton({
  icon,
  label,
  disabled,
  onPress,
}: {
  icon: React.ComponentProps<typeof IconSymbol>['name'];
  label: string;
  disabled: boolean;
  onPress: () => void;
}) {
  const t = useComunicaTheme();
  const color = disabled ? t.textMuted : t.accentText;
  return (
    <PressableFeedback
      onPress={onPress}
      isDisabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={[styles.action, { borderColor: disabled ? t.separator : color }]}
    >
      <IconSymbol name={icon} size={16} color={color} />
      <Text style={[styles.actionText, { color }]}>{label}</Text>
      <PressableFeedback.Highlight />
    </PressableFeedback>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 24 },
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  fileBody: { flex: 1, gap: 2 },
  title: { ...typography.title },
  sub: { ...typography.subhead },
  fileActions: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  action: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 44,
    borderRadius: radii.sm,
    borderWidth: 1,
    overflow: 'hidden',
  },
  actionText: { ...typography.button },
  offline: { ...typography.caption, paddingHorizontal: 16, paddingTop: 8 },
  dataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    minHeight: 44,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  dataLabel: { ...typography.body },
  dataValue: { ...typography.body, flexShrink: 1, textAlign: 'right' },
  link: { ...typography.button },
  actions: { gap: 12 },
  error: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: radii.md,
  },
  delete: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 48,
    borderRadius: radii.md,
    overflow: 'hidden',
  },
  deleteText: { ...typography.button },
});
