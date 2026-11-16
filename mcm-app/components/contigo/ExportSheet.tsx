/**
 * Exportar lo tuyo de Contigo: qué (subrayados, revisiones) y cómo (PDF o
 * texto). Los datos no salen del móvil hasta que tú los compartes.
 */
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PressableFeedback } from 'heroui-native';
import BottomSheet from '@/components/BottomSheet';
import { warm } from '@/components/contigo/theme';
import AppPrimaryButton from '@/components/ui/AppPrimaryButton';
import { MaterialIcons } from '@/components/ui/icons';
import spacing from '@/constants/spacing';
import typography from '@/constants/typography';
import { radii } from '@/constants/uiStyles';
import { useToast } from '@/contexts/AppToastContext';
import { useColorScheme } from '@/hooks/useColorScheme';
import {
  loadExportDays,
  shareExportPdf,
  shareExportText,
} from '@/services/contigoExport';
import type { ExportDay } from '@/utils/contigoExport';
import { h } from '@/utils/haptics';
import { logger } from '@/utils/logger';

interface Props {
  visible: boolean;
  onClose: () => void;
}

export default function ExportSheet({ visible, onClose }: Props) {
  return (
    <BottomSheet visible={visible} onClose={onClose} title="Exportar">
      {visible ? <Body onClose={onClose} /> : null}
    </BottomSheet>
  );
}

function Body({ onClose }: { onClose: () => void }) {
  const isDark = useColorScheme() === 'dark';
  const w = warm(isDark);
  const { toast } = useToast();
  const [highlights, setHighlights] = useState(true);
  const [revisions, setRevisions] = useState(true);
  const [days, setDays] = useState<ExportDay[] | null>(null);
  const [busy, setBusy] = useState<'pdf' | 'text' | null>(null);

  useEffect(() => {
    let alive = true;
    loadExportDays({ highlights, revisions })
      .then((d) => alive && setDays(d))
      .catch((e) => {
        logger.warn('contigo export', e);
        if (alive) setDays([]);
      });
    return () => {
      alive = false;
    };
  }, [highlights, revisions]);

  const empty = days !== null && days.length === 0;
  const run = async (kind: 'pdf' | 'text') => {
    if (!days?.length) return;
    setBusy(kind);
    try {
      if (kind === 'pdf') await shareExportPdf(days);
      else await shareExportText(days, (label) => toast.show({ label }));
      onClose();
    } catch (e) {
      logger.warn('contigo export', e);
      toast.show({ variant: 'danger', label: 'No se ha podido exportar' });
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={styles.root}>
      <View style={[styles.group, { backgroundColor: w.bgDeep }]}>
        <Check
          label="Frases subrayadas"
          on={highlights}
          onPress={() => setHighlights((v) => !v || !revisions)}
        />
        <View style={[styles.sep, { backgroundColor: w.border }]} />
        <Check
          label="Revisiones del día"
          on={revisions}
          onPress={() => setRevisions((v) => !v || !highlights)}
        />
      </View>
      <Text style={[styles.count, { color: w.textSec }]}>
        {days === null
          ? ' '
          : empty
            ? 'Aún no hay nada que exportar.'
            : days.length === 1
              ? '1 día'
              : `${days.length} días`}
      </Text>
      <AppPrimaryButton
        label="PDF"
        icon="picture-as-pdf"
        color={w.accent}
        disabled={!days?.length || busy !== null}
        loading={busy === 'pdf'}
        onPress={() => void run('pdf')}
      />
      <PressableFeedback
        onPress={() => void run('text')}
        isDisabled={!days?.length || busy !== null}
        style={[styles.secondary, !days?.length && styles.off]}
        accessibilityRole="button"
        accessibilityLabel="Exportar como texto"
      >
        <MaterialIcons name="notes" size={18} color={w.accentText} />
        <Text style={[styles.secondaryText, { color: w.accentText }]}>
          Solo texto
        </Text>
      </PressableFeedback>
    </View>
  );
}

function Check({
  label,
  on,
  onPress,
}: {
  label: string;
  on: boolean;
  onPress: () => void;
}) {
  const w = warm(useColorScheme() === 'dark');
  return (
    <PressableFeedback
      onPress={() => {
        h.toggle();
        onPress();
      }}
      style={styles.check}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: on }}
      accessibilityLabel={label}
    >
      <Text style={[styles.checkLabel, { color: w.text }]}>{label}</Text>
      <MaterialIcons
        name={on ? 'check-circle' : 'radio-button-unchecked'}
        size={24}
        color={on ? w.accent : w.textMuted}
      />
    </PressableFeedback>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.md, paddingBottom: spacing.md },
  group: { borderRadius: radii.lg, overflow: 'hidden' },
  sep: { height: StyleSheet.hairlineWidth, marginLeft: spacing.md },
  check: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 52,
    paddingHorizontal: spacing.md,
  },
  checkLabel: { ...typography.body },
  count: { ...typography.caption, textAlign: 'center' },
  secondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    minHeight: 44,
  },
  secondaryText: { ...typography.button },
  off: { opacity: 0.4 },
});
