import React from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import BottomSheet from '@/components/BottomSheet';
import SocialLoginSection from '@/components/SocialLoginSection';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/colors';
import spacing from '@/constants/spacing';

interface Props {
  visible: boolean;
  onClose: () => void;
}

export default function LoginSheet({ visible, onClose }: Props) {
  const scheme = useColorScheme();
  const theme = Colors[scheme ?? 'light'];

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Cuenta">
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Text style={[styles.body, { color: theme.icon }]}>
          Guarda tus hábitos de oración, evangelios y reflexiones entre
          dispositivos.
        </Text>
        <SocialLoginSection />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 40,
    gap: spacing.md,
  } as ViewStyle,
  body: {
    fontSize: 14,
    lineHeight: 20,
  } as TextStyle,
});
