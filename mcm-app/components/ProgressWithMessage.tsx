import React from 'react';
import { View, Text } from 'react-native';
import { Spinner } from 'heroui-native';
import { useColorScheme } from '@/hooks/useColorScheme';
import colors, { Colors, themeColors } from '@/constants/colors';

export default function ProgressWithMessage({ message }: { message?: string }) {
  const scheme = useColorScheme();
  const theme = Colors[scheme ?? 'light'];

  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.background,
        gap: 16,
        padding: 20,
      }}
    >
      <Spinner size="lg" color={colors.info} />
      {message && (
        <Text
          style={{
            fontSize: 15,
            color: themeColors(scheme === 'dark').textSecondary,
            textAlign: 'center',
          }}
        >
          {message}
        </Text>
      )}
    </View>
  );
}
