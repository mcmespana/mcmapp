// La ayuda ⓘ de un campo (plan 09, «Traducción del diseño»): en la web era un
// globo al pasar el ratón; aquí no hay ratón, así que el botón (44 pt) abre
// una hoja corta con el texto, palabra por palabra el del plugin.

import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PressableFeedback } from 'heroui-native';
import BottomSheet from '@/components/BottomSheet';
import { IconSymbol } from '@/components/ui/IconSymbol';
import typography from '@/constants/typography';
import { h } from '@/utils/haptics';
import { boldParts } from '@/utils/comunica/forms';
import { useComunicaTheme } from '../useComunicaTheme';

/** El botón ⓘ y su hoja. `label` es el campo («MAT»). */
export default function HelpButton({
  label,
  text,
}: {
  label: string;
  text: string;
}) {
  const t = useComunicaTheme();
  const [open, setOpen] = useState(false);
  return (
    <>
      <PressableFeedback
        onPress={() => {
          h.tap();
          setOpen(true);
        }}
        accessibilityRole="button"
        accessibilityLabel={`Qué es «${label}»`}
        style={styles.button}
      >
        <IconSymbol name="info.circle" size={18} color={t.accentText} />
      </PressableFeedback>
      <HelpSheet
        visible={open}
        onClose={() => setOpen(false)}
        title={label}
        text={text}
      />
    </>
  );
}

export function HelpSheet({
  visible,
  onClose,
  title,
  text,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  text: string;
}) {
  const t = useComunicaTheme();
  return (
    <BottomSheet visible={visible} onClose={onClose} title={title}>
      <View style={styles.body}>
        {/* Los `<strong>` del plugin llegan como `**negrita**` (plan 12). */}
        <Text style={[styles.text, { color: t.text }]}>
          {boldParts(text).map((p, i) =>
            p.bold ? (
              <Text key={i} style={styles.bold}>
                {p.text}
              </Text>
            ) : (
              p.text
            ),
          )}
        </Text>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  // 44 pt de toque aunque el icono sea pequeño; sin margen extra que mueva
  // la etiqueta.
  button: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: -12,
    marginRight: -12,
  },
  body: { paddingBottom: 24 },
  text: { ...typography.body, lineHeight: 24 },
  bold: { fontWeight: '700' },
});
