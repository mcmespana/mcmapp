// Piezas de «Mis datos de monitor» (plan 09): la sección del certificado, un
// archivo con su subida y un enlace externo. Van aparte para que la pantalla
// se lea de arriba abajo como el plugin.

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PressableFeedback } from 'heroui-native';
import * as WebBrowser from 'expo-web-browser';
import { IconSymbol } from '@/components/ui/IconSymbol';
import typography from '@/constants/typography';
import type { DocumentKind } from '@/services/comunica/contract';
import { useDocumentUpload } from '@/hooks/comunica/useDocumentUpload';
import { h } from '@/utils/haptics';
import FileField from '../comun/form/FileField';
import FormSection from '../comun/form/FormSection';
import OptionCards from '../comun/form/OptionCards';
import { FieldHint } from '../comun/form/FormField';
import Section from '../comun/Section';
import { openUrl } from '../grupos/FichaParts';
import { useComunicaTheme } from '../comun/useComunicaTheme';
import { LINKS, MONITOR_COPY } from './copy';

const C = MONITOR_COPY.certificate;

/** Abre una web fuera del área (`expo-web-browser`, regla 12). */
export async function openExternal(url: string) {
  h.tap();
  try {
    await WebBrowser.openBrowserAsync(url);
  } catch {
    await openUrl(url);
  }
}

/** Un enlace que sale de la app: texto en acento y su flecha, 44 pt. */
export function ExternalLink({ label, url }: { label: string; url: string }) {
  const t = useComunicaTheme();
  return (
    <PressableFeedback
      onPress={() => void openExternal(url)}
      accessibilityRole="link"
      accessibilityLabel={label}
      accessibilityHint="Se abre en el navegador"
      style={styles.link}
    >
      <Text style={[styles.linkText, { color: t.accentText }]}>{label}</Text>
      <IconSymbol name="arrow.up.right" size={14} color={t.accentText} />
    </PressableFeedback>
  );
}

/** Un archivo del monitor, con su subida (directa, sin la cola). */
export function DocumentField({
  kind,
  label,
  hasFile,
  onReview,
  children,
}: {
  kind: DocumentKind;
  label: string;
  hasFile: boolean;
  onReview: () => void;
  children?: React.ReactNode;
}) {
  const u = useDocumentUpload(kind);
  return (
    <FileField
      label={label}
      hasFile={hasFile}
      upload={u.upload}
      problem={u.problem}
      onChoose={(s) => void u.choose(s)}
      onRetry={u.retry}
      onReview={onReview}
    >
      {children}
    </FileField>
  );
}

/**
 * «Certificado de Delitos Sexuales»: la nota de la sección (entera, con sus
 * dos enlaces), las tarjetas Automático / Manual y el bloque de la elegida.
 */
export function CertificateSection({
  mode,
  onMode,
  hasFile,
  onReview,
}: {
  mode: 'automatic' | 'manual' | null;
  onMode: (m: 'automatic' | 'manual') => void;
  hasFile: boolean;
  onReview: () => void;
}) {
  const t = useComunicaTheme();
  const strong = [styles.strong, { color: t.text }];
  const link = (label: string, url: string) => (
    <Text
      accessibilityRole="link"
      onPress={() => void openExternal(url)}
      style={[styles.inlineLink, { color: t.accentText }]}
    >
      {label}
    </Text>
  );
  return (
    <View style={styles.block}>
      <FormSection title={MONITOR_COPY.sections.certificate}>
        <View style={styles.legal}>
          <Text style={[styles.p, { color: t.text }]}>
            {C.lead1}
            <Text style={strong}>{C.leadStrong}</Text>
            {C.lead2}
            {link(C.aepdLink, LINKS.aepd)}
            {C.lead3}
          </Text>
          <Text style={[styles.p, { color: t.text }]}>
            {C.secure1}
            <Text style={strong}>{C.secureStrong}</Text>
            {C.secure2}
            <Text style={strong}>{C.secure3}</Text>
          </Text>
          <View style={styles.bullet}>
            <IconSymbol name="arrow.clockwise" size={18} color={t.accentText} />
            <Text style={[styles.p, styles.flex, { color: t.text }]}>
              <Text style={strong}>{C.autoStrong}</Text>
              {C.auto1}
              {link(C.guideLink, LINKS.guide)}
              {C.auto2}
            </Text>
          </View>
          <View style={styles.bullet}>
            <IconSymbol
              name="square.and.arrow.up.on.square"
              size={18}
              color={t.accentText}
            />
            <Text style={[styles.p, styles.flex, { color: t.text }]}>
              <Text style={strong}>{C.manualStrong}</Text>
              {C.manual}
            </Text>
          </View>
        </View>
      </FormSection>

      <OptionCards
        label={C.choiceLabel}
        value={mode}
        onChange={onMode}
        options={[
          {
            value: 'automatic',
            title: C.automatic.title,
            description: C.automatic.description,
            icon: 'arrow.clockwise',
          },
          {
            value: 'manual',
            title: C.manualCard.title,
            description: C.manualCard.description,
            icon: 'square.and.arrow.up.on.square',
          },
        ]}
      />
      {mode === null ? (
        <View style={styles.choose}>
          <FieldHint hint={C.choose} />
        </View>
      ) : null}

      {mode === 'automatic' ? (
        <Section>
          <View style={styles.pad}>
            <ExternalLink label={C.tutorial} url={LINKS.guide} />
          </View>
        </Section>
      ) : null}
      {mode === 'manual' ? (
        <Section>
          <DocumentField
            kind="sex_offence_certificate"
            label={C.upload}
            hasFile={hasFile}
            onReview={onReview}
          >
            <ExternalLink label={C.ministry} url={LINKS.ministry} />
          </DocumentField>
        </Section>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: 12 },
  legal: { padding: 16, gap: 12 },
  p: { ...typography.subhead, lineHeight: 21 },
  strong: { fontWeight: '600' },
  inlineLink: { fontWeight: '600', textDecorationLine: 'underline' },
  bullet: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  flex: { flex: 1 },
  choose: { paddingHorizontal: 4 },
  pad: { paddingHorizontal: 16, paddingVertical: 4 },
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 44,
    alignSelf: 'flex-start',
  },
  linkText: { ...typography.button, flexShrink: 1 },
});
