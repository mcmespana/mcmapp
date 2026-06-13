/**
 * Modal de éxito al subir una playlist o iniciar un coro: muestra un QR
 * con el enlace universal (https://mcm.expo.app/playlist?p=XXXX o
 * /coro?c=XXXX). Escaneado con la cámara del móvil abre la app
 * directamente en la playlist / sesión de coro (deep link ya existente).
 * Incluye el código en grande y botones para copiar enlace o código.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Platform,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import * as Clipboard from 'expo-clipboard';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useColorScheme } from '@/hooks/useColorScheme';
import { h } from '@/utils/haptics';

interface Props {
  visible: boolean;
  title: string;
  /** Enlace universal que codifica el QR. */
  url: string;
  /** Código de 4 dígitos, mostrado en grande bajo el QR. */
  code: string;
  onClose: () => void;
}

const ShareQrModal: React.FC<Props> = ({
  visible,
  title,
  url,
  code,
  onClose,
}) => {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const styles = useMemo(() => createStyles(isDark), [isDark]);
  const [copied, setCopied] = useState<'link' | 'code' | null>(null);

  useEffect(() => {
    if (visible) setCopied(null);
  }, [visible]);

  const copy = (what: 'link' | 'code') => {
    h.tap();
    void Clipboard.setStringAsync(what === 'link' ? url : code);
    setCopied(what);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop}>
          <TouchableWithoutFeedback>
            <View style={styles.card}>
              <Text style={styles.title}>{title}</Text>
              <Text style={styles.subtitle}>
                Escanea con la cámara · Se abre en la app si la tienes, o en el
                navegador si no
              </Text>

              {/* Marco blanco siempre: los lectores QR necesitan contraste. */}
              <View style={styles.qrWrap}>
                <QRCode value={url} size={200} backgroundColor="#FFFFFF" />
              </View>

              <Text style={styles.code}>{code}</Text>

              <View style={styles.buttons}>
                <TouchableOpacity
                  onPress={() => copy('link')}
                  style={[styles.btn, styles.btnPrimary]}
                >
                  <MaterialIcons name="link" size={18} color="#fff" />
                  <Text style={styles.btnPrimaryText}>
                    {copied === 'link' ? '¡Enlace copiado!' : 'Copiar enlace'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => copy('code')}
                  style={[styles.btn, styles.btnSecondary]}
                >
                  <Text style={styles.btnSecondaryText}>
                    {copied === 'code' ? '¡Código copiado!' : 'Copiar código'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={onClose}
                  style={[styles.btn, styles.btnSecondary]}
                >
                  <Text style={styles.btnSecondaryText}>Cerrar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const createStyles = (isDark: boolean) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.45)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 18,
    },
    card: {
      width: '100%',
      maxWidth: 360,
      backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF',
      borderRadius: 18,
      padding: 20,
      alignItems: 'center',
      ...Platform.select({
        web: { boxShadow: '0 10px 30px rgba(0,0,0,0.2)' },
        default: {
          shadowColor: '#000',
          shadowOpacity: 0.2,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: 8 },
          elevation: 8,
        },
      }),
    },
    title: {
      fontSize: 17,
      fontWeight: '700',
      color: isDark ? '#F5F5F7' : '#1C1C1E',
      textAlign: 'center',
    },
    subtitle: {
      fontSize: 12.5,
      color: isDark ? '#8E8E93' : '#6B6B70',
      textAlign: 'center',
      marginTop: 4,
      marginBottom: 14,
    },
    qrWrap: {
      backgroundColor: '#FFFFFF',
      padding: 14,
      borderRadius: 14,
    },
    code: {
      fontSize: 30,
      fontWeight: '800',
      letterSpacing: 8,
      color: isDark ? '#7AB3FF' : '#253883',
      marginTop: 12,
      marginBottom: 14,
      fontVariant: ['tabular-nums'],
    },
    buttons: {
      alignSelf: 'stretch',
      gap: 8,
    },
    btn: {
      flexDirection: 'row',
      gap: 6,
      paddingVertical: 12,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    btnPrimary: { backgroundColor: '#253883' },
    btnPrimaryText: {
      color: '#fff',
      fontSize: 15,
      fontWeight: '700',
    },
    btnSecondary: {
      backgroundColor: isDark ? '#2C2C2E' : '#F2F2F7',
    },
    btnSecondaryText: {
      color: isDark ? '#F5F5F7' : '#1C1C1E',
      fontSize: 15,
      fontWeight: '600',
    },
  });

export default ShareQrModal;
