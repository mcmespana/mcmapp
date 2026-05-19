import React, { useEffect, useState } from 'react';
import { Text, View, StyleSheet } from 'react-native';
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/colors';

export const VersionDisplay: React.FC<{ style?: any }> = ({ style }) => {
  const [updateInfo, setUpdateInfo] = useState<string>('');
  const scheme = useColorScheme();
  const theme = Colors[scheme ?? 'light'];

  useEffect(() => {
    // Solo mostramos versión + hash del bundle OTA cuando aplica. La
    // notificación de "hay update disponible" la gestiona el modal
    // <OTAUpdatePrompt> montado en el root layout — aquí no duplicamos
    // ese mensaje para evitar ruido visual en el pie de la Home.
    const appVersion = Constants.expoConfig?.version || '1.0.1';

    if (__DEV__) {
      setUpdateInfo(`v${appVersion} • dev`);
      return;
    }

    if (Updates.isEnabled && Updates.updateId) {
      const shortId = Updates.updateId.slice(0, 6);
      setUpdateInfo(`v${appVersion}+${shortId}`);
    } else {
      setUpdateInfo(`v${appVersion}`);
    }
  }, []);

  if (!updateInfo) return null;

  return (
    <View style={[styles.container, style]}>
      <Text style={[styles.versionText, { color: theme.icon }]}>
        {updateInfo}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  versionText: {
    fontSize: 11,
    opacity: 0.7,
    fontFamily: 'System',
    fontWeight: '400',
  },
});
