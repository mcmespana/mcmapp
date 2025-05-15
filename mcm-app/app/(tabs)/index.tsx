// app/(tabs)/home.tsx
import React from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import colors from '@/constants/colors';
import typography from '@/constants/typography';
import spacing from '@/constants/spacing';

export default function Home() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>¡Bienvenido a “Quiénes somos”!</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md,
  } as ViewStyle,
  title: {
    ...(typography.h1 as TextStyle),
    color: colors.text,
  } as TextStyle,
});
