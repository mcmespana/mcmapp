import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '@/constants/colors';
import { useColorScheme } from '@/hooks/useColorScheme';

export default function OfflineBanner({
  text = 'Mostrando datos sin conexión',
}: {
  text?: string;
}) {
  const scheme = useColorScheme() || 'light';
  const styles = React.useMemo(() => createStyles(scheme), [scheme]);

  return (
    <View style={styles.container}>
      <Text style={styles.text}>{text}</Text>
    </View>
  );
}

const createStyles = (scheme: 'light' | 'dark') => {
  const isDark = scheme === 'dark';
  return StyleSheet.create({
    container: {
      backgroundColor: isDark ? '#444' : '#e0e0e0',
      paddingVertical: 6,
      paddingHorizontal: 10,
    },
    text: {
      color: isDark ? Colors.dark.text : Colors.light.text,
      textAlign: 'center',
    },
  });
};
