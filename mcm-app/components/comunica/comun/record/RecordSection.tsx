// Una sección con título de una ficha de registro («Toda la información»,
// «Sobre esta actividad»): título fuerte y el contenido suelto debajo, sin
// tarjeta dentro de tarjeta.

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import typography from '@/constants/typography';
import { useComunicaTheme } from '../useComunicaTheme';

export default function RecordSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const t = useComunicaTheme();
  return (
    <View style={styles.wrap}>
      <Text
        accessibilityRole="header"
        style={[styles.title, { color: t.text }]}
      >
        {title}
      </Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  title: { ...typography.h3 },
});
