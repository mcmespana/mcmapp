// El aviso «Te falta subir tu Certificado de Delitos Sexuales» (plan 09,
// regla 7; `sticpa_ds_pending_alert_html` del plugin). Arriba en «Mis datos de
// monitor» sin botón, y en la portada «Hoy» con «Subir certificado».
// La alerta ámbar del área (`warningSoft`, el mismo tono que «Te faltan N
// listas»), sin hex nuevos.

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PressableFeedback } from 'heroui-native';
import { IconSymbol } from '@/components/ui/IconSymbol';
import typography from '@/constants/typography';
import { radii } from '@/constants/uiStyles';
import { h } from '@/utils/haptics';
import { CERTIFICATE_ALERT } from '@/utils/comunica/monitorProfile';
import { useComunicaTheme } from '../comun/useComunicaTheme';

export default function CertificatePendingAlert({
  onPress,
}: {
  /** Con él, la tarjeta entera lleva a subirlo («Subir certificado»). */
  onPress?: () => void;
}) {
  const t = useComunicaTheme();
  const body = (
    <>
      <View style={styles.head}>
        <IconSymbol
          name="exclamationmark.triangle.fill"
          size={20}
          color={t.warningIcon}
        />
        <Text style={[styles.title, { color: t.text }]}>
          {CERTIFICATE_ALERT.title}
        </Text>
      </View>
      <Text style={[styles.text, { color: t.text }]}>
        {CERTIFICATE_ALERT.text}
      </Text>
      {onPress ? (
        <View style={styles.cta}>
          <Text style={[styles.ctaText, { color: t.accentText }]}>
            {CERTIFICATE_ALERT.cta}
          </Text>
          <IconSymbol name="chevron.right" size={14} color={t.accentText} />
        </View>
      ) : null}
    </>
  );
  const style = [styles.card, { backgroundColor: t.warningSoft }];
  if (!onPress) {
    return (
      <View style={style} accessibilityRole="alert">
        {body}
      </View>
    );
  }
  return (
    <PressableFeedback
      onPress={() => {
        h.tap();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={`${CERTIFICATE_ALERT.title}. ${CERTIFICATE_ALERT.cta}`}
      style={style}
    >
      {body}
      <PressableFeedback.Highlight />
    </PressableFeedback>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radii.lg, padding: 16, gap: 8, overflow: 'hidden' },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  title: { ...typography.title, flex: 1 },
  text: { ...typography.subhead, lineHeight: 20 },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 32,
    marginTop: 4,
  },
  ctaText: { ...typography.button },
});
