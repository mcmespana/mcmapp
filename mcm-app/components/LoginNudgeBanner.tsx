import React, { useState } from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { useColorScheme } from '@/hooks/useColorScheme';
import colors from '@/constants/colors';
import { hexAlpha } from '@/utils/colorUtils';
import LoginSheet from '@/components/LoginSheet';

export default function LoginNudgeBanner() {
  const { user } = useAuth();
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const [sheetVisible, setSheetVisible] = useState(false);

  if (user) return null;

  return (
    <>
      <TouchableOpacity
        onPress={() => setSheetVisible(true)}
        style={[
          styles.banner,
          {
            backgroundColor: isDark
              ? 'rgba(37,56,131,0.25)'
              : hexAlpha(colors.primary, '15'),
            borderColor: isDark
              ? 'rgba(149,210,242,0.15)'
              : hexAlpha(colors.primary, '25'),
          },
        ]}
        accessibilityRole="button"
        accessibilityLabel="Iniciar sesión para guardar tu progreso"
        activeOpacity={0.7}
      >
        <MaterialIcons
          name="cloud-upload"
          size={14}
          color={isDark ? colors.secondary : colors.primary}
          style={{ opacity: 0.75 }}
        />
        <Text
          style={[
            styles.text,
            { color: isDark ? colors.secondary : colors.primary },
          ]}
        >
          Inicia sesión para guardar tu progreso
        </Text>
        <MaterialIcons
          name="chevron-right"
          size={14}
          color={isDark ? colors.secondary : colors.primary}
          style={{ opacity: 0.55 }}
        />
      </TouchableOpacity>

      <LoginSheet
        visible={sheetVisible}
        onClose={() => setSheetVisible(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    alignSelf: 'center',
    opacity: 0.88,
  } as ViewStyle,
  text: {
    fontSize: 12,
    fontWeight: '500',
    flex: 1,
  } as TextStyle,
});
