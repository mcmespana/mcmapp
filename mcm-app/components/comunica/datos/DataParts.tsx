// Las piezas propias de «Mis datos» (plan 12): un dato bloqueado con su etiqueta, una autorización con su enlace y el aviso de «faltan datos para pagar».

import React from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { PressableFeedback } from 'heroui-native';
import { IconSymbol } from '@/components/ui/IconSymbol';
import typography from '@/constants/typography';
import { radii } from '@/constants/uiStyles';
import { h } from '@/utils/haptics';
import { useComunicaTheme } from '../comun/useComunicaTheme';
import LockedRow from '../comun/form/LockedRow';
import SwitchField from '../comun/form/SwitchField';
import { DATOS_COPY as C } from './copy';

/** Un dato que aquí no se edita: la etiqueta y el valor COMO DATO, con candado (nunca un campo apagado que parezca que guarda). */
export function LockedField({
  label,
  value,
}: {
  label: string;
  value: string | null;
}) {
  const t = useComunicaTheme();
  return (
    <View style={styles.locked}>
      <Text style={[styles.lockedLabel, { color: t.textSecondary }]}>
        {label}
      </Text>
      <LockedRow value={value ?? C.identity.unset} icon="lock" />
    </View>
  );
}

/** Abre una dirección sin romper si el móvil no sabe abrirla. */
async function open(url: string) {
  try {
    await Linking.openURL(url);
  } catch {
    /* sin aplicación que lo abra: no pasa nada */
  }
}

/** Una autorización: el interruptor (apagado y «Sin contestar» si nadie ha contestado) y «Ver condiciones» en el navegador del sistema. */
export function ConsentRow({
  statement,
  url,
  value,
  onChange,
}: {
  statement: string;
  url: string;
  value: boolean | null;
  onChange: (v: boolean) => void;
}) {
  const t = useComunicaTheme();
  return (
    <View>
      <SwitchField label={statement} value={value} onChange={onChange} />
      <View style={styles.consentFoot}>
        {value === null ? (
          <Text style={[styles.unanswered, { color: t.textSecondary }]}>
            {C.consents.unanswered}
          </Text>
        ) : (
          <View />
        )}
        <PressableFeedback
          onPress={() => {
            h.tap();
            void open(url);
          }}
          accessibilityRole="link"
          accessibilityLabel={`${C.consents.seeTerms}: ${statement}`}
          style={styles.link}
        >
          <Text style={[styles.linkText, { color: t.accentText }]}>
            {C.consents.seeTerms}
          </Text>
          <IconSymbol name="arrow.up.right" size={14} color={t.accentText} />
        </PressableFeedback>
      </View>
    </View>
  );
}

/** El correo del referente, tocable. */
export function ReferentLink() {
  const t = useComunicaTheme();
  return (
    <Text
      onPress={() => void open(`mailto:${C.identity.referent}`)}
      accessibilityRole="link"
      style={[styles.mail, { color: t.accentText }]}
    >
      {C.identity.referent}
    </Text>
  );
}

/** «Te faltan datos para poder pagar» (regla 9): la alerta ámbar del área. */
export function PayMissingAlert() {
  const t = useComunicaTheme();
  return (
    <View
      style={[styles.alert, { backgroundColor: t.warningSoft }]}
      accessibilityRole="alert"
    >
      <View style={styles.alertHead}>
        <IconSymbol
          name="exclamationmark.triangle.fill"
          size={20}
          color={t.warningIcon}
        />
        <Text style={[styles.alertTitle, { color: t.text }]}>
          {C.pay.title}
        </Text>
      </View>
      <Text style={[styles.alertText, { color: t.text }]}>{C.pay.body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  locked: { paddingHorizontal: 16, paddingVertical: 12, gap: 4 },
  lockedLabel: { ...typography.caption },
  consentFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 4,
  },
  unanswered: { ...typography.caption },
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 44,
  },
  linkText: { ...typography.subhead, fontWeight: '600' },
  mail: { fontWeight: '600' },
  alert: { borderRadius: radii.lg, padding: 16, gap: 8 },
  alertHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  alertTitle: { ...typography.title, flex: 1 },
  alertText: { ...typography.subhead, lineHeight: 20 },
});
