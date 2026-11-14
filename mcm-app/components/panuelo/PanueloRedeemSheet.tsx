import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import BottomSheet from '@/components/BottomSheet';
import AppPrimaryButton from '@/components/ui/AppPrimaryButton';
import AppTextField from '@/components/ui/AppTextField';
import { themeColors } from '@/constants/colors';
import spacing from '@/constants/spacing';
import typography from '@/constants/typography';
import { h } from '@/utils/haptics';
import type { RedeemResult } from '@/utils/panuelo';

type Props = {
  visible: boolean;
  isDark: boolean;
  /** Código con el que se abre ya escrito (enlace `/panuelo?codigo=…`). */
  initialCode?: string;
  onClose: () => void;
  onRedeem: (code: string) => RedeemResult;
};

const MESSAGES: Record<
  Exclude<RedeemResult, { ok: true }>['reason'] | 'already',
  string
> = {
  empty: 'Escribe el código que te han dado.',
  unknown: 'Ese código no abre ninguna pieza. Revisa que esté bien escrito.',
  early: 'Ese código todavía no se puede canjear.',
  late: 'Ese código ya ha caducado.',
  already: 'Esa pieza ya la tienes.',
};

/**
 * La hoja para canjear el código de una actividad. Si el código abre una
 * pieza nueva, la hoja se cierra y el pañuelo la presenta; si no, dice por
 * qué y se queda abierta para corregirlo.
 */
export function PanueloRedeemSheet({
  visible,
  isDark,
  initialCode,
  onClose,
  onRedeem,
}: Props) {
  return (
    <BottomSheet visible={visible} onClose={onClose} title="Canjear un código">
      {/* El formulario se monta con la hoja: cada vez que se abre, empieza
          limpio (o con el código del enlace). */}
      <RedeemForm
        isDark={isDark}
        initialCode={initialCode}
        onClose={onClose}
        onRedeem={onRedeem}
      />
    </BottomSheet>
  );
}

function RedeemForm({
  isDark,
  initialCode,
  onClose,
  onRedeem,
}: Omit<Props, 'visible'>) {
  const t = themeColors(isDark);
  const [code, setCode] = useState(initialCode ?? '');
  const [message, setMessage] = useState<string | null>(null);

  const submit = () => {
    const result = onRedeem(code);
    if (result.ok && !result.already) {
      onClose();
      return;
    }
    h.error();
    setMessage(MESSAGES[result.ok ? 'already' : result.reason]);
  };

  return (
    <View style={styles.body}>
      <Text style={[styles.help, { color: t.textSecondary }]}>
        En algunas actividades se reparte un código. Escríbelo aquí y la pieza
        es tuya.
      </Text>
      <AppTextField
        value={code}
        onChangeText={(text) => {
          setCode(text);
          setMessage(null);
        }}
        placeholder="Código"
        autoCapitalize="characters"
        autoCorrect={false}
        autoFocus
        maxLength={32}
        returnKeyType="done"
        onSubmitEditing={submit}
        error={message !== null}
        accentColor={t.link}
        accessibilityLabel="Código de la pieza"
      />
      {message ? (
        <Text
          style={[styles.message, { color: t.text }]}
          accessibilityLiveRegion="polite"
        >
          {message}
        </Text>
      ) : null}
      <AppPrimaryButton
        label="Canjear"
        icon="redeem"
        onPress={submit}
        disabled={code.trim() === ''}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  body: {
    gap: spacing.md,
    paddingBottom: spacing.md,
  },
  help: {
    ...typography.body,
  },
  message: {
    ...typography.subhead,
  },
});
