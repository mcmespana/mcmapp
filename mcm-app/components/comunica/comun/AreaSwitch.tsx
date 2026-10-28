// El interruptor del sistema con los colores del área: pista del acento al
// encender y bolita blanca (en web, sin esto, la bolita sale en verde azulado).

import React from 'react';
import { Platform, Switch } from 'react-native';
import { h } from '@/utils/haptics';
import { useComunicaTheme } from './useComunicaTheme';

export default function AreaSwitch({
  value,
  onChange,
  label,
  disabled = false,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
  label: string;
  /** Apagado y sin tocar (p. ej. sin permiso de avisos, plan 08). */
  disabled?: boolean;
}) {
  const t = useComunicaTheme();
  const web =
    Platform.OS === 'web' ? ({ activeThumbColor: '#fff' } as object) : {};
  return (
    <Switch
      value={value}
      onValueChange={(v) => {
        h.toggle();
        onChange(v);
      }}
      trackColor={{ true: t.accentFill, false: t.separator }}
      thumbColor={Platform.OS === 'android' ? '#fff' : undefined}
      accessibilityLabel={label}
      disabled={disabled}
      {...web}
    />
  );
}
