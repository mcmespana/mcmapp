import React, { useEffect, useRef } from 'react';
import { Animated, View, Text, StyleSheet } from 'react-native';
import { ProgressBar } from 'react-native-paper';

export default function LoadingBar({ message }: { message: string }) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(progress, { toValue: 1, duration: 1000, useNativeDriver: false }),
        Animated.timing(progress, { toValue: 0, duration: 1000, useNativeDriver: false }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [progress]);

  return (
    <View style={styles.container}>
      <Text style={styles.message}>{message}</Text>
      <ProgressBar progress={progress} style={styles.bar} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  message: {
    marginBottom: 12,
    fontSize: 16,
  },
  bar: {
    width: '80%',
  },
});
