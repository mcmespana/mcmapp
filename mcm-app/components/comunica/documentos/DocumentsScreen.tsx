// «Mis documentos» / «Documentos de Lucía» (plan 16, reglas 1-4 y 8-9):
// las tarjetas con su botón de abrir, la subida en curso arriba y «Subir»
// en la cabecera. Solo con conexión: los documentos no se guardan en el
// móvil (lo que haya en memoria se enseña sin cobertura).

import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { PressableFeedback } from 'heroui-native';
import EmptyState from '@/components/ui/EmptyState';
import { radii } from '@/constants/uiStyles';
import typography from '@/constants/typography';
import { comunicaNow, getComunicaApi } from '@/services/comunica';
import { clearOpenFiles } from '@/services/comunica/openFiles';
import {
  useActiveProfile,
  useProfileScope,
} from '@/hooks/comunica/useActiveProfile';
import {
  useDocumentUploads,
  useDocuments,
} from '@/hooks/comunica/useDocuments';
import { useOpenFile } from '@/hooks/comunica/useOpenFile';
import {
  documentsEmpty,
  documentsTitle,
  sortDocuments,
} from '@/utils/comunica/documents';
import { madridDay } from '@/utils/comunica/madrid';
import { isSectionVisible } from '@/utils/comunica/profiles';
import ActiveProfileBar from '../perfiles/ActiveProfileBar';
import AreaScreen from '../comun/AreaScreen';
import AreaState, { isNetwork } from '../comun/AreaState';
import HeaderIconButton from '../comun/HeaderIconButton';
import SyncBadge from '../comun/SyncBadge';
import UploadStatus from '../comun/UploadStatus';
import { useComunicaTheme } from '../comun/useComunicaTheme';
import DocumentCard from './DocumentCard';

/** El familiar que solo es familiar, viéndose a sí mismo, no tiene Documentos. */
export const GUARDIAN_ONLY_DOCUMENTS =
  'Los documentos de quienes tienes a tu cargo están en su ficha.';

export default function DocumentsScreen() {
  const t = useComunicaTheme();
  const router = useRouter();
  const active = useActiveProfile();
  useProfileScope('shared', 'documents');
  const q = useDocuments();
  const { uploads, retry, dismiss } = useDocumentUploads(q.pid);
  const opener = useOpenFile();
  const today = madridDay(comunicaNow());
  const title = documentsTitle(active.childFirstName);
  const empty = documentsEmpty(active.childFirstName);
  const toUpload = () => router.push('/comunica/documentos/subir');

  // Abrir Documentos vacía los archivos que quedaran abiertos de antes.
  useEffect(() => {
    void clearOpenFiles();
  }, []);

  const visible = isSectionVisible('documents', active.audience);

  return (
    <AreaScreen onRefresh={() => q.refetch()}>
      <Stack.Screen
        options={{
          title,
          headerRight: visible
            ? () => (
                <HeaderIconButton
                  icon="plus"
                  label="Subir un documento"
                  onPress={toUpload}
                />
              )
            : undefined,
        }}
      />
      <ActiveProfileBar />
      {!visible ? (
        <EmptyState
          icon="folder"
          title="Aquí no hay documentos"
          subtitle={GUARDIAN_ONLY_DOCUMENTS}
          titleColor={t.text}
          subtitleColor={t.textSecondary}
        />
      ) : (
        <>
          {uploads.length ? (
            <View style={styles.list}>
              {uploads.map((u) => (
                <View
                  key={u.clientId}
                  style={[styles.upload, { backgroundColor: t.card }]}
                >
                  <Text
                    style={[styles.uploadName, { color: t.text }]}
                    numberOfLines={1}
                  >
                    {u.name}
                  </Text>
                  <UploadStatus
                    state={u.phase === 'failed' ? 'failed' : 'sending'}
                    onRetry={() => retry(u.clientId)}
                  />
                  {u.phase === 'failed' ? (
                    <>
                      {u.message ? (
                        <Text
                          style={[styles.message, { color: t.textSecondary }]}
                        >
                          {u.message}
                        </Text>
                      ) : null}
                      <PressableFeedback
                        onPress={() => dismiss(u.clientId)}
                        accessibilityRole="button"
                        accessibilityLabel={`Descartar ${u.name}`}
                        hitSlop={12}
                        style={styles.dismiss}
                      >
                        <Text style={[styles.message, { color: t.accentText }]}>
                          Descartar
                        </Text>
                      </PressableFeedback>
                    </>
                  ) : null}
                </View>
              ))}
            </View>
          ) : null}
          {!q.data && isNetwork(q.error) ? (
            <EmptyState
              icon="wifi-off"
              title="Los documentos se ven con conexión"
              subtitle="No se guardan en el móvil."
              actionLabel="Reintentar"
              onAction={() => void q.refetch()}
              accentColor={t.accentText}
              titleColor={t.text}
              subtitleColor={t.textSecondary}
            />
          ) : (
            <AreaState query={q} skeleton="cards">
              {(data) =>
                data.documents.length === 0 && uploads.length === 0 ? (
                  <EmptyState
                    icon="folder-open"
                    title={empty.title}
                    subtitle={empty.subtitle}
                    actionLabel="Subir un documento"
                    onAction={toUpload}
                    accentColor={t.accentText}
                    titleColor={t.text}
                    subtitleColor={t.textSecondary}
                  />
                ) : (
                  <View style={styles.list}>
                    {sortDocuments(data.documents, today).map((d) => (
                      <DocumentCard
                        key={d.id}
                        doc={d}
                        today={today}
                        busy={opener.busyKey === d.id}
                        canOpen={opener.busyKey === null}
                        onPress={() =>
                          router.push({
                            pathname: '/comunica/documentos/[id]',
                            params: { id: d.id },
                          })
                        }
                        onOpen={() => {
                          const pid = q.pid;
                          if (!pid) return;
                          void opener.open(d.id, (p) =>
                            getComunicaApi().getProfileDocumentFile(
                              pid,
                              d.id,
                              p,
                            ),
                          );
                        }}
                      />
                    ))}
                    <SyncBadge generatedAt={q.generatedAt} />
                  </View>
                )
              }
            </AreaState>
          )}
        </>
      )}
    </AreaScreen>
  );
}

const styles = StyleSheet.create({
  list: { gap: 12 },
  upload: { borderRadius: radii.lg, padding: 16, gap: 6 },
  uploadName: { ...typography.title },
  message: { ...typography.caption },
  dismiss: { alignSelf: 'flex-start' },
});
