import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCurrentTabColor } from '@/hooks/useCurrentTabColor';

interface TabScreenWrapperProps {
  children: React.ReactNode;
  style?: any;
  edges?: Array<'top' | 'right' | 'bottom' | 'left'>;
}

export default function TabScreenWrapper({
  children,
  style,
  edges = ['top'],
}: TabScreenWrapperProps) {
  const tabColor = useCurrentTabColor();

  if (Platform.OS !== 'ios') {
    // On Android/Web, just use regular SafeAreaView
    return (
      <SafeAreaView style={style} edges={edges}>
        {children}
      </SafeAreaView>
    );
  }

  // On iOS, add the color bar at the top
  return (
    <View style={styles.container}>
      {tabColor && (
        <View style={[styles.colorBar, { backgroundColor: tabColor }]} />
      )}
      <SafeAreaView style={[styles.content, style]} edges={edges}>
        {children}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  colorBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    zIndex: 1000,
  },
  content: {
    flex: 1,
  },
});
