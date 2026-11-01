// La tarjeta de un documento (plan 16, `stic-documents.php` l. 165-234): cápsula con el TIPO (JPG, PDF, DOC…; sin extensión, un icono de archivo), el nombre, «Del
// 3 de octubre de 2026» y un chip («Caducado» en rojo o el estado con color por clave). SIN el nombre del archivo. Tocar la tarjeta abre la ficha, NUNCA descarga;
// la descarga es un botón redondo de 44 pt HERMANO de la tarjeta («Descargar …»), solo si hay archivo. Lo caducado, apagado.

import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { PressableFeedback } from 'heroui-native';
import { IconSymbol } from '@/components/ui/IconSymbol';
import typography from '@/constants/typography';
import { radii, shadows } from '@/constants/uiStyles';
import type { DocumentSummary } from '@/services/comunica/contract';
import {
  dateLine,
  documentChip,
  documentKind,
  documentTitle,
  isExpired,
} from '@/utils/comunica/documents';
import { h } from '@/utils/haptics';
import StatusChip from '../comun/StatusChip';
import { useComunicaTheme } from '../comun/useComunicaTheme';

export default function DocumentCard({
  doc,
  today,
  downloading,
  onOpen,
  onDownload,
}: {
  doc: DocumentSummary;
  today: string;
  downloading: boolean;
  onOpen: () => void;
  onDownload: () => void;
}) {
  const t = useComunicaTheme();
  const kind = documentKind(doc.fileName);
  const chip = documentChip(doc, today);
  const title = documentTitle(doc);
  const when = dateLine(doc);
  const dim = isExpired(doc, today);
  return (
    <View style={styles.row}>
      <PressableFeedback
        onPress={() => {
          h.tap();
          onOpen();
        }}
        accessibilityRole="button"
        accessibilityLabel={[chip?.label, title, when]
          .filter(Boolean)
          .join(', ')}
        accessibilityHint="Abre el documento"
        style={[
          styles.card,
          shadows.card,
          { backgroundColor: t.card, opacity: dim ? 0.65 : 1 },
        ]}
      >
        <View style={[styles.kind, { backgroundColor: t.backgroundSunken }]}>
          {kind ? (
            <Text
              style={[styles.kindText, { color: t.text }]}
              maxFontSizeMultiplier={1.2}
            >
              {kind}
            </Text>
          ) : (
            <IconSymbol name="doc.text" size={22} color={t.textSecondary} />
          )}
        </View>
        <View style={styles.main}>
          {chip ? <StatusChip label={chip.label} tone={chip.tone} /> : null}
          <Text style={[styles.title, { color: t.text }]} numberOfLines={2}>
            {title}
          </Text>
          {when ? (
            <Text style={[styles.when, { color: t.textSecondary }]}>
              {when}
            </Text>
          ) : null}
        </View>
      </PressableFeedback>
      {doc.fileName ? (
        <PressableFeedback
          onPress={() => {
            h.tap();
            onDownload();
          }}
          isDisabled={downloading}
          accessibilityRole="button"
          accessibilityLabel={`Descargar ${title}`}
          style={[styles.download, { backgroundColor: t.accentFill }]}
        >
          {downloading ? (
            <ActivityIndicator color={t.onAccent} />
          ) : (
            <IconSymbol
              name="tray.and.arrow.down"
              size={20}
              color={t.onAccent}
            />
          )}
        </PressableFeedback>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  card: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: radii.lg,
  },
  kind: {
    width: 52,
    height: 52,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kindText: { ...typography.button, fontVariant: ['tabular-nums'] },
  main: { flex: 1, gap: 4 },
  title: { ...typography.title },
  when: { ...typography.subhead },
  download: {
    width: 44,
    height: 44,
    borderRadius: radii.pillFull,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
