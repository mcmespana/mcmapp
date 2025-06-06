import React from 'react';
import { View, StyleSheet } from 'react-native';
import colors from '@/constants/colors';

export default function NotificationsScreen() {
  return <View style={styles.container} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
});
