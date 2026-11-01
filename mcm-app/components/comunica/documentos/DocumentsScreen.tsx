// «Mis documentos» / «Documentos de Lucía» (plan 16, `list_stic_documents`): lo más reciente arriba y lo caducado al final y apagado. Subir, en la cabecera.
//
//   · Nada se guarda en el móvil. Sin conexión y sin lo de esta sesión: «Los documentos se ven con conexión».
//   · Tocar la tarjeta abre la ficha; el botón redondo descarga y abre el archivo (visor, o la hoja de compartir).
//   · Cambiar de hijo recarga la lista con el otro (documentos es una sección compartida).

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { PressableFeedback } from 'heroui-native';
import EmptyState from '@/components/ui/EmptyState';
import typography from '@/constants/typography';
import { useToast } from '@/contexts/AppToastContext';
import { comunicaNow } from '@/services/comunica';
import { useActiveProfile } from '@/hooks/comunica/useActiveProfile';
import {
  useClearOpenCopies,
  useDocuments,
  useOpenFile,
} from '@/hooks/comunica/useDocuments';
import {
  DOCUMENTS_TEXT as TXT,
  orderDocuments,
} from '@/utils/comunica/documents';
import { madridDay } from '@/utils/comunica/madrid';
import { firstNameOf } from '@/utils/comunica/profiles';
import ActiveProfileBar from '../perfiles/ActiveProfileBar';
import AreaPrimaryButton from '../comun/AreaPrimaryButton';
import AreaScreen from '../comun/AreaScreen';
import AreaState, { isNetwork } from '../comun/AreaState';
import SyncBadge from '../comun/SyncBadge';
import { useComunicaTheme } from '../comun/useComunicaTheme';
import DocumentCard from './DocumentCard';

export default function DocumentsScreen() {
  const t = useComunicaTheme();
  const router = useRouter();
  const { toast } = useToast();
  const { active, isSelf } = useActiveProfile();
  const q = useDocuments(active?.id);
  const { open, downloading } = useOpenFile(active?.id);
  useClearOpenCopies();
  const today = madridDay(comunicaNow());
  const first = active ? firstNameOf(active) : '';
  const child = !isSelf && first ? first : null;
  const toUpload = () => router.push('/comunica/documentos/subir' as never);
  const toDoc = (id: string) =>
    router.push({
      pathname: '/comunica/documentos/[id]',
      params: { id },
    } as never);

  return (
    <AreaScreen onRefresh={() => q.refetch()}>
      <Stack.Screen
        options={{
          title: child ? TXT.titleOf(child) : TXT.titleOwn,
          headerRight: () => (
            <PressableFeedback
              onPress={toUpload}
              accessibilityRole="button"
              accessibilityLabel="Subir un documento"
              style={styles.headerButton}
            >
              <Text style={[styles.headerLabel, { color: t.accentText }]}>
                Subir
              </Text>
            </PressableFeedback>
          ),
        }}
      />
      <ActiveProfileBar scope="shared" section="documents" />
      {q.error && !q.data && isNetwork(q.error) ? (
        <EmptyState
          icon="wifi-off"
          title={TXT.needsConnection}
          actionLabel="Reintentar"
          onAction={() => void q.refetch()}
          accentColor={t.accentText}
          titleColor={t.text}
          subtitleColor={t.textSecondary}
        />
      ) : (
        <AreaState query={q} skeleton="cards">
          {(data) => {
            if (data.documents.length === 0)
              return (
                <View>
                  <EmptyState
                    icon="inbox"
                    title={
                      child
                        ? TXT.emptyOf(child)
                        : !isSelf
                          ? TXT.emptyOfNoName
                          : TXT.emptyOwn
                    }
                    subtitle={!isSelf ? TXT.emptyBodyOf : TXT.emptyBodyOwn}
                    titleColor={t.text}
                    subtitleColor={t.textSecondary}
                  />
                  <AreaPrimaryButton
                    label={TXT.upload}
                    onPress={toUpload}
                    haptic
                  />
                </View>
              );
            return (
              <View style={styles.list}>
                {orderDocuments(data.documents, today).map((d) => (
                  <DocumentCard
                    key={d.id}
                    doc={d}
                    today={today}
                    downloading={downloading === d.id}
                    onOpen={() => toDoc(d.id)}
                    onDownload={async () => {
                      const r = await open(d);
                      if (r === 'offline')
                        toast.show({
                          variant: 'warning',
                          label: TXT.openNeedsConnection,
                        });
                      else if (r === 'failed')
                        toast.show({
                          variant: 'danger',
                          label: TXT.downloadFailed,
                        });
                    }}
                  />
                ))}
                <View style={styles.sync}>
                  <SyncBadge generatedAt={q.generatedAt} />
                </View>
              </View>
            );
          }}
        </AreaState>
      )}
    </AreaScreen>
  );
}

const styles = StyleSheet.create({
  list: { gap: 12 },
  sync: { alignItems: 'center' },
  headerButton: {
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  headerLabel: { ...typography.button },
});
