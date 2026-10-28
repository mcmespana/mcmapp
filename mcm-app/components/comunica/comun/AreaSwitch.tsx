// El interruptor del sistema con los colores del área: pista del acento al
// encender y bolita blanca (en web, sin esto, la bolita sale en verde azulado).

import React from 'react';
import { Platform, Switch } from 'react-native';
import { SystemGray } from '@/constants/colors';
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
      // Apagado: en oscuro el `separator` es el mismo gris que la card y la
      // pista desaparecía (solo se veía la bolita); va el gris 2 de Apple.
      trackColor={{
        true: t.accentFill,
        false: t.isDark ? SystemGray.dark.gray2 : t.separator,
      }}
      thumbColor={Platform.OS === 'android' ? '#fff' : undefined}
      accessibilityLabel={label}
      disabled={disabled}
      {...web}
    />
  );
}
