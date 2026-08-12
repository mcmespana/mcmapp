import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCurrentTabColor } from '@/hooks/useCurrentTabColor';

interface TabScreenWrapperProps {
  children: React.ReactNode;
  style?: any;
  edges?: ('top' | 'right' | 'bottom' | 'left')[];
  /** Override the tint color derived from the current tab pathname. Useful
   *  cuando la pantalla se alcanza desde un stack (p.ej. Fotos vía MasHome
   *  overflow en iOS) y el pathname no coincide con un tab conocido. */
  tintColor?: string;
}

export default function TabScreenWrapper({
  children,
  style,
  edges = ['top'],
  tintColor,
}: TabScreenWrapperProps) {
  const tabColor = useCurrentTabColor();
  const resolvedColor = tintColor ?? tabColor;

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
      {resolvedColor && (
        <View style={[styles.colorBar, { backgroundColor: resolvedColor }]} />
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
    height: 8,
    zIndex: 1000,
  },
  content: {
    flex: 1,
  },
});
