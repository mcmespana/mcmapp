import React, { useState, useEffect } from 'react';
import {
  Platform,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/colors';
import { IconSymbol } from './ui/IconSymbol';

export default function AddToHomeScreenPrompt() {
  const [visible, setVisible] = useState(false);
  const [installEvent, setInstallEvent] = useState<any>(null);
  const scheme = useColorScheme() || 'light';

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const ua = window.navigator.userAgent;
    const isIOS = /iPhone|iPad|iPod/i.test(ua);
    const isSafari = /Safari/i.test(ua) && !/CriOS|FxiOS|OPiOS|EdgiOS/.test(ua);
    const inStandalone =
      (window.navigator as any).standalone === true ||
      window.matchMedia('(display-mode: standalone)').matches;
    const dismissed = window.localStorage.getItem('addToHomeDismissed');

    const promptHandler = (e: any) => {
      e.preventDefault();
      setInstallEvent(e);
      if (!dismissed) setVisible(true);
    };

    if (isIOS && isSafari && !inStandalone && !dismissed) {
      setVisible(true);
    } else {
      window.addEventListener('beforeinstallprompt', promptHandler);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', promptHandler);
    };
  }, []);

  if (!visible) return null;
  const theme = Colors[scheme];

  const handleInstall = () => {
    if (installEvent) {
      installEvent.prompt();
      installEvent.userChoice.finally(() => {
        setInstallEvent(null);
        window.localStorage.setItem('addToHomeDismissed', 'true');
        setVisible(false);
      });
    } else {
      window.localStorage.setItem('addToHomeDismissed', 'true');
      setVisible(false);
    }
  };

  const handleClose = () => {
    window.localStorage.setItem('addToHomeDismissed', 'true');
    setVisible(false);
  };

  const isAndroidPrompt = !!installEvent;

  return (
    <View style={styles.overlay} pointerEvents="box-none">
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        {isAndroidPrompt ? (
          <>
            <Text style={[styles.text, { color: theme.text }]}>
              Añade esta app para un acceso directo.
            </Text>
            <TouchableOpacity
              onPress={handleInstall}
              style={styles.installButton}
            >
              <Text style={{ color: theme.text, fontWeight: 'bold' }}>
                Instalar
              </Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={[styles.text, { color: theme.text }]}>
              <IconSymbol name="square.and.arrow.up" color={theme.text} /> Añade
              esta app a tu pantalla de inicio
            </Text>
            <Text style={[styles.subtext, { color: theme.text }]}>
              Pulsa Compartir y luego Añadir a pantalla de inicio
            </Text>
            <View
              style={[styles.arrowDown, { borderTopColor: theme.background }]}
            />
          </>
        )}
        <TouchableOpacity onPress={handleClose} style={styles.close}>
          <IconSymbol name="close" color={theme.text} size={20} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 1000,
  },
  container: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    flexDirection: 'column',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  text: {
    fontSize: 14,
    marginBottom: 4,
  },
  subtext: {
    fontSize: 12,
  },
  close: {
    position: 'absolute',
    top: 4,
    right: 4,
    padding: 4,
  },
  installButton: {
    marginTop: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ccc',
  },
  arrowDown: {
    position: 'absolute',
    bottom: -10,
    left: '50%',
    marginLeft: -10,
    width: 0,
    height: 0,
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderTopWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
});
