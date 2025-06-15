import React from 'react';
import { View, StyleSheet } from 'react-native';
import { ProgressBar, Text } from 'react-native-paper';
import { useColorScheme } from '@/hooks/useColorScheme';
import colors, { Colors } from '@/constants/colors';

export default function LoadingOverlay({ message }: { message?: string }) {
  const scheme = useColorScheme();
  const theme = Colors[scheme];
  return (
    <View style={styles.container}>
      <ProgressBar indeterminate color={colors.tint} style={styles.progress} />
      <Text style={[styles.text, { color: theme.text }]}>{message || 'Recopilando la información...'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  progress: {
    width: '80%',
    height: 8,
    borderRadius: 4,
  },
  text: {
    marginTop: 10,
    fontSize: 16,
  },
});
