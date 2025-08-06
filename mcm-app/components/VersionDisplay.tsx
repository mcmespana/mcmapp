import React, { useEffect, useState } from 'react';
import { Text, View, StyleSheet } from 'react-native';
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/colors';

export const VersionDisplay: React.FC<{ style?: any }> = ({ style }) => {
  const [updateInfo, setUpdateInfo] = useState<string>('');
  const scheme = useColorScheme();
  const theme = Colors[scheme];

  useEffect(() => {
    const getUpdateInfo = async () => {
      const appVersion = Constants.expoConfig?.version || '1.0.1';

      if (!__DEV__ && Updates.isEnabled) {
        try {
          // Obtener info del update actual
          const update = await Updates.checkForUpdateAsync();

          if (update.isAvailable) {
            // Hay un update disponible pero no aplicado aún
            setUpdateInfo(`v${appVersion} • update disponible`);
          } else {
            // Verificar si estamos en un update OTA
            const currentUpdate = Updates.updateId;
            if (currentUpdate) {
              // Estamos en un update OTA, mostrar los primeros 6 chars
              const shortId = currentUpdate.slice(0, 6);
              setUpdateInfo(`v${appVersion}+${shortId}`);
            } else {
              // Build original, sin updates
              setUpdateInfo(`v${appVersion}`);
            }
          }
        } catch {
          setUpdateInfo(`v${appVersion}`);
        }
      } else {
        // Desarrollo o Updates deshabilitados
        setUpdateInfo(__DEV__ ? `v${appVersion} • dev` : `v${appVersion}`);
      }
    };

    getUpdateInfo();
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
