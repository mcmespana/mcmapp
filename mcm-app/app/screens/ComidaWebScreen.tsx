import React, { useLayoutEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  Platform,
  TouchableOpacity,
  Linking,
  Text,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { ActivityIndicator, Portal, Snackbar } from 'react-native-paper';
import { MaterialIcons } from '@expo/vector-icons';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { JubileoStackParamList } from '../(tabs)/jubileo';
import spacing from '@/constants/spacing';
import { Colors as ThemeColors } from '@/constants/colors';
import { useColorScheme } from '@/hooks/useColorScheme';
// Usando el mismo CSS que funcionó en comunica.tsx
import iframeStyles from '../(tabsdesactivados)/comunica.module.css';
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

  // URLs que sabemos que no funcionan en iframe por políticas de seguridad
  const isBlockedUrl = (url: string) => {
    const blockedDomains = [
      'google.com/maps',
      'app.amicidelpellegrino.it', // Solo la app, no el store locator
      'iubilaeum2025.va',
    ];
    return blockedDomains.some((domain) => url.includes(domain));
  };

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
        <TouchableOpacity
          onPress={openExternal}
          style={{ padding: 8, marginRight: 4 }}
        >
          <MaterialIcons name="open-in-new" size={24} color="#fff" />
        </TouchableOpacity>
      ),
    });
  }, [navigation, url, title, openExternal]);

  const onLoadEnd = () => setIsLoading(false);
  const onError = () => {
    setError(
      'Error al cargar el contenido. Por favor, verifica tu conexión a internet.',
    );
    setVisible(true);
    setIsLoading(false);
  };

  // Para URLs bloqueadas, mostramos directamente la pantalla de redirección
  if (Platform.OS === 'web' && isBlockedUrl(url)) {
    return (
      <View style={styles.redirectContainer}>
        <View style={styles.redirectContent}>
          <MaterialIcons name="open-in-new" size={64} color="#2196F3" />
          <Text style={styles.redirectTitle}>{title}</Text>
          <Text style={styles.redirectSubtitle}>
            Esta página se verá más linda en una pestaña
          </Text>
          <TouchableOpacity
            style={styles.redirectButton}
            onPress={openExternal}
          >
            <MaterialIcons name="open-in-new" size={20} color="#fff" />
            <Text style={styles.redirectButtonText}>Abrir sitio web</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonText}>Volver</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (Platform.OS === 'web') {
    return (
      <View style={styles.containerWeb}>
        <iframe
          src={url}
          title={title}
          className={iframeStyles.iframe}
          onError={onError}
          onLoad={onLoadEnd}
          // Configuraciones adicionales para mejorar la compatibilidad
          sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-top-navigation allow-popups-to-escape-sandbox"
          referrerPolicy="no-referrer-when-downgrade"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
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
  const theme =
    scheme === 'dark'
      ? { text: '#fff', background: '#1a1a1a', cardBg: '#2d2d2d' }
      : { text: '#000', background: '#fff', cardBg: '#f5f5f5' };

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
    // Estilos para la pantalla de redirección
    redirectContainer: {
      flex: 1,
      backgroundColor: theme.background,
      justifyContent: 'center',
      alignItems: 'center',
      padding: spacing.lg,
    },
    redirectContent: {
      backgroundColor: theme.cardBg,
      borderRadius: 16,
      padding: spacing.xl,
      alignItems: 'center',
      maxWidth: 400,
      width: '100%',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 8,
    },
    redirectTitle: {
      fontSize: 24,
      fontWeight: 'bold',
      color: theme.text,
      textAlign: 'center',
      marginTop: spacing.md,
      marginBottom: spacing.sm,
    } as any,
    redirectSubtitle: {
      fontSize: 16,
      color: theme.text,
      opacity: 0.7,
      textAlign: 'center',
      marginBottom: spacing.xl,
      lineHeight: 22,
    } as any,
    redirectButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#2196F3',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderRadius: 12,
      marginBottom: spacing.md,
      shadowColor: '#2196F3',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
      elevation: 4,
    },
    redirectButtonText: {
      color: '#fff',
      marginLeft: spacing.sm,
      fontWeight: 'bold',
      fontSize: 16,
    } as any,
    backButton: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
    },
    backButtonText: {
      color: '#666',
      fontSize: 16,
    } as any,
  });
};
