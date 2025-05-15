// app/(tabs)/fotos.tsx
import React from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import colors from '@/constants/colors';
import typography from '@/constants/typography';
import spacing from '@/constants/spacing';

interface Styles {
  container: ViewStyle;
  title: TextStyle;
}

export default function Fotos() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Aquí va el Fotos 🎶</Text>
    </View>
  );
}

const styles = StyleSheet.create<Styles>({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md,
  },
  title: {
    ...typography.h1,
    fontWeight: 'bold', // or use a valid value like '700'
    color: colors.text,
  },
});
