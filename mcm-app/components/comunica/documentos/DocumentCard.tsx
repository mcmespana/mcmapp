// La tarjeta de un documento (plan 16, reglas 2-4; `sticpa_documents_list_html`):
// la cápsula con el TIPO («PDF», «JPG»; sin extensión, el icono de archivo),
// el nombre, «Del 25 de octubre de 2026» y UN chip («Caducado» en rojo o el
// estado). Sin el nombre del archivo: está en la ficha. Tocarla abre la
// ficha; el botón redondo de al lado, hermano y no hijo, abre el archivo.

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PressableFeedback } from 'heroui-native';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { radii, shadows } from '@/constants/uiStyles';
import typography from '@/constants/typography';
import type { DocumentSummary } from '@/services/comunica/contract';
import { documentCard } from '@/utils/comunica/documents';
import { h } from '@/utils/haptics';
import FileQuickAction from '../comun/FileQuickAction';
import StatusChip from '../comun/StatusChip';
import { useComunicaTheme } from '../comun/useComunicaTheme';

/** El tipo en el hueco del mes de la cápsula de fecha. */
export function KindCapsule({ kind }: { kind: string }) {
  const t = useComunicaTheme();
  return (
    <View
      style={[styles.capsule, { backgroundColor: t.backgroundSunken }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {kind ? (
        <Text
          style={[styles.kind, { color: t.textSecondary }]}
          maxFontSizeMultiplier={1.3}
        >
          {kind}
        </Text>
      ) : (
        <IconSymbol name="doc.text" size={22} color={t.textSecondary} />
      )}
    </View>
  );
}

export default function DocumentCard({
  doc,
  today,
  busy,
  canOpen,
  onPress,
  onOpen,
}: {
  doc: DocumentSummary;
  today: string;
  busy: boolean;
  canOpen: boolean;
  onPress: () => void;
  onOpen: () => void;
}) {
  const t = useComunicaTheme();
  const c = documentCard(doc, today);
  const a11y = [c.kind || 'Documento', c.title, c.line, c.chip?.label]
    .filter(Boolean)
    .join(', ');
  return (
    <View
      style={[
        styles.card,
        shadows.card,
        { backgroundColor: t.card },
        // Lo caducado, apagado (y al final de la lista).
        c.expired && styles.past,
      ]}
    >
      <PressableFeedback
        onPress={() => {
          h.tap();
          onPress();
        }}
        accessibilityRole="button"
        accessibilityLabel={a11y}
        style={styles.main}
      >
        <KindCapsule kind={c.kind} />
        <View style={styles.body}>
          <Text style={[styles.title, { color: t.text }]} numberOfLines={2}>
            {c.title}
          </Text>
          {c.line ? (
            <Text style={[styles.line, { color: t.textSecondary }]}>
              {c.line}
            </Text>
          ) : null}
          {c.chip ? (
            <StatusChip label={c.chip.label} tone={c.chip.tone} />
          ) : null}
        </View>
        <PressableFeedback.Highlight />
      </PressableFeedback>
      {c.hasFile ? (
        <View style={styles.quick}>
          <FileQuickAction
            label={`Abrir ${c.title}`}
            busy={busy}
            disabled={!canOpen}
            onPress={onOpen}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radii.lg,
    overflow: 'hidden',
  },
  past: { opacity: 0.6 },
  main: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
  },
  body: { flex: 1, gap: 4 },
  title: { ...typography.title },
  line: { ...typography.subhead },
  quick: { paddingRight: 12 },
  capsule: {
    width: 52,
    height: 52,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kind: { ...typography.overline, fontWeight: '800' },
});
