import React, { useLayoutEffect, useState } from 'react';
import { View, StyleSheet, Platform, TouchableOpacity, Linking } from 'react-native';
import { WebView } from 'react-native-webview';
import { ActivityIndicator, Portal, Snackbar } from 'react-native-paper';
import { MaterialIcons } from '@expo/vector-icons';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { JubileoStackParamList } from '../(tabs)/jubileo';
import spacing from '@/constants/spacing';
import { Colors as ThemeColors } from '@/constants/colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import iframeStyles from '../(tabsdesactivados)/comunica.module.css';

interface Params {
  url: string;
  title: string;
}

type Route = RouteProp<JubileoStackParamList, 'ComidaWeb'>;

export default function ComidaWebScreen() {
  const route = useRoute<Route>();
  const { url, title } = route.params;
  const navigation = useNavigation();
  const scheme = useColorScheme();
  const styles = React.useMemo(() => createStyles(scheme), [scheme]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);

  const openExternal = () => {
    if (Platform.OS === 'web') {
      window.open(url, '_blank');
    } else {
      Linking.openURL(url);
    }
  };

  useLayoutEffect(() => {
    navigation.setOptions({
      title,
      headerRight: () => (
        <TouchableOpacity onPress={openExternal} style={{ padding: 8, marginRight: 4 }}>
          <MaterialIcons name="open-in-new" size={24} color="#fff" />
        </TouchableOpacity>
      ),
    });
  }, [navigation, url, title]);

  const onLoadEnd = () => setIsLoading(false);
  const onError = () => {
    setError('Error al cargar el contenido. Por favor, verifica tu conexión a internet.');
    setVisible(true);
    setIsLoading(false);
  };

  if (Platform.OS === 'web') {
    return (
      <View style={styles.containerWeb}>
        <iframe
          src={url}
          title={title}
          className={iframeStyles.iframe}
          onError={onError}
          onLoad={onLoadEnd}
        />
        {isLoading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={ThemeColors.light.tint} />
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <WebView
        source={{ uri: url }}
        style={styles.webview}
        startInLoadingState={true}
        renderLoading={() => (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={ThemeColors.light.tint} />
          </View>
        )}
        onLoadEnd={onLoadEnd}
        onError={onError}
      />
      <Portal>
        <Snackbar
          visible={visible}
          onDismiss={() => setVisible(false)}
          action={{ label: 'Cerrar', onPress: () => setVisible(false) }}
          duration={Snackbar.DURATION_MEDIUM}
          style={{ backgroundColor: '#f44336' }}
        >
          {error}
        </Snackbar>
      </Portal>
    </View>
  );
}

const createStyles = (scheme: 'light' | 'dark') => {
  return StyleSheet.create({
    container: {
      flex: 1,
      margin: spacing.sm,
      position: 'relative',
    },
    webview: {
      flex: 1,
      borderRadius: 8,
      overflow: 'hidden',
    } as any,
    loadingContainer: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'rgba(255, 255, 255, 0.8)',
    },
    containerWeb: {
      flex: 1,
      margin: 0,
      padding: 0,
      position: 'relative',
    },
  });
};
