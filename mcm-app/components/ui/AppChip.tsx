import React from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

import { themeColors } from '@/constants/colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { hexAlpha, readableOn } from '@/utils/colorUtils';
import { radii } from '@/constants/uiStyles';
import typography from '@/constants/typography';

/**
 * Chip informativo: una etiqueta teñida con el color de lo que representa.
 *
 * Es el patrón que estaba escrito cinco veces —la categoría y el destino de una
 * notificación (en la lista, en el detalle y en la campana de Inicio)— siempre
 * con la misma receta: relleno al 12-14 % del color, borde al 60 % y el texto
 * en el color a pelo. Aquí se queda una vez (Fase 2 de PLAN_UI_NATIVA §5).
 *
 * **Lo que NO es.** No es el chip de filtro del calendario (ese se pulsa y
 * tiene estado seleccionado, y vive en un solo sitio: un componente para un
 * uso es peor que el uso), ni el `TagChip` del cantoral (relleno sólido con
 * emoji, contador y botón de quitar, ya canónico para su función), ni una
 * insignia de contador. Si lo que tienes es un número sobre un icono, esto no.
 *
 * **Por qué el texto no es el color que le pasas.** Porque medido no se lee.
 * Los seis colores de categoría de las notificaciones son UN valor usado en
 * los dos modos, y sobre el fondo oscuro daban 1,91:1 (morado), 2,48
 * (urgente), 2,60 (fotos), 2,83 (mantenimiento) y 3,30 (cantoral): cinco de
 * seis ilegibles, y dos también en claro. El relleno y el borde sí usan el
 * color tal cual —ahí es decoración—, pero la etiqueta y el icono pasan por
 * `readableOn`, que conserva el tono y mueve la luminosidad lo justo. Con eso
 * cualquier color que mande el Panel mañana entra ya legible, sin tabla que
 * mantener.
 *
 * El contraste se mide contra el FONDO de la pantalla, no contra el chip: el
 * tinte del 12 % lo desvía tan poco que no cambia el veredicto, y medir contra
 * el fondo es el caso conservador en claro.
 */
export interface AppChipProps {
  label: string;
  /** Color de lo que representa el chip. Por defecto, el rol de enlace. */
  color?: string;
  icon?: keyof typeof MaterialIcons.glyphMap;
  /** `sm` para dentro de una fila de lista; `md` para cabeceras. */
  size?: 'sm' | 'md';
  style?: ViewStyle;
}

export default function AppChip({
  label,
  color,
  icon,
  size = 'sm',
  style,
}: AppChipProps) {
  const isDark = useColorScheme() === 'dark';
  const roles = themeColors(isDark);
  const base = color ?? roles.link;
  const ink = readableOn(base, roles.background);
  const compacto = size === 'sm';

  return (
    <View
      style={[
        styles.chip,
        compacto ? styles.chipSm : styles.chipMd,
        {
          borderColor: hexAlpha(base, '60'),
          backgroundColor: hexAlpha(base, '14'),
        },
        style,
      ]}
    >
      {icon ? (
        <MaterialIcons name={icon} size={compacto ? 11 : 13} color={ink} />
      ) : null}
      <Text
        style={[compacto ? styles.labelSm : styles.labelMd, { color: ink }]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: radii.pillFull,
    borderWidth: 1,
  },
  chipSm: {
    gap: 3,
    paddingVertical: 3,
    paddingHorizontal: 7,
  },
  chipMd: {
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  // `micro` (11) para dentro de una fila y `footnote` (12) para cabeceras: la
  // escala de `typography` ya tenía el escalón, era el chip el que llevaba un
  // `fontSize: 10` y un `12` a mano.
  labelSm: {
    ...typography.micro,
    fontWeight: '600',
  },
  labelMd: {
    ...typography.footnote,
    fontWeight: '600',
  },
});
