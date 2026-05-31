import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Clipboard,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';

interface Props {
  error: string;
}

/**
 * Pantalla de error de configuración de Firebase.
 * Solo aparece cuando las variables de entorno EXPO_PUBLIC_FIREBASE_* están
 * mal o vacías en el build — nunca debería verla un usuario normal.
 *
 * Muestra el error completo y los pasos para arreglarlo.
 */
export default function FirebaseConfigErrorScreen({ error }: Props) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = () => {
    Clipboard.setString(
      `[MCM App] Firebase config error\n\n${error}\n\nPasos:\n` +
        `1. npx eas-cli secret:list\n` +
        `2. Compara con Firebase Console → ⚙️ → Configuración del proyecto → app web\n` +
        `3. npx eas-cli secret:create --name EXPO_PUBLIC_FIREBASE_API_KEY --value "..." --scope project\n` +
        `4. npm run eas:build:ios -- --profile production`,
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <View style={styles.iconCircle}>
          <MaterialIcons name="settings-suggest" size={36} color="#fff" />
        </View>
        <Text style={styles.title}>Error de configuración Firebase</Text>
        <Text style={styles.subtitle}>
          Las credenciales de Firebase en este build son incorrectas o están
          vacías. Este error solo lo ves tú (el desarrollador).
        </Text>
      </View>

      <ScrollView
        style={styles.errorBox}
        contentContainerStyle={styles.errorContent}
      >
        <Text style={styles.errorText}>{error}</Text>
      </ScrollView>

      <View style={styles.fixSection}>
        <Text style={styles.fixTitle}>Cómo arreglarlo:</Text>
        <Text style={styles.fixStep}>
          1. <Text style={styles.mono}>npx eas-cli secret:list</Text>
        </Text>
        <Text style={styles.fixStep}>
          2. Compara con Firebase Console → ⚙️ → Configuración → app web
        </Text>
        <Text style={styles.fixStep}>
          3. Actualiza los secrets incorrectos con{' '}
          <Text style={styles.mono}>eas-cli secret:create</Text>
        </Text>
        <Text style={styles.fixStep}>
          4. Recompila:{' '}
          <Text style={styles.mono}>
            npm run eas:build:ios -- --profile production
          </Text>
        </Text>
      </View>

      <TouchableOpacity
        style={[styles.copyButton, copied && styles.copyButtonDone]}
        onPress={handleCopy}
        activeOpacity={0.8}
      >
        <MaterialIcons
          name={copied ? 'check' : 'content-copy'}
          size={18}
          color="#fff"
        />
        <Text style={styles.copyButtonText}>
          {copied ? 'Copiado' : 'Copiar error + pasos'}
        </Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a0a0a',
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#c0392b',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 13,
    color: '#aaa',
    textAlign: 'center',
    lineHeight: 19,
  },
  errorBox: {
    flex: 1,
    backgroundColor: '#2a0a0a',
    borderRadius: 10,
    marginBottom: 16,
    maxHeight: 160,
  },
  errorContent: {
    padding: 14,
  },
  errorText: {
    fontSize: 12,
    fontFamily: 'monospace',
    color: '#ff6b6b',
    lineHeight: 18,
  },
  fixSection: {
    backgroundColor: '#0f1a0f',
    borderRadius: 10,
    padding: 14,
    marginBottom: 16,
    gap: 6,
  },
  fixTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#7ed321',
    marginBottom: 4,
  },
  fixStep: {
    fontSize: 12,
    color: '#ccc',
    lineHeight: 18,
  },
  mono: {
    fontFamily: 'monospace',
    color: '#7ed321',
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#c0392b',
    borderRadius: 10,
    paddingVertical: 14,
  },
  copyButtonDone: {
    backgroundColor: '#27ae60',
  },
  copyButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
});
