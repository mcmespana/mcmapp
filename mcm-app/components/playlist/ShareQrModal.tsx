/**
 * Modal de QR para compartir una playlist o sesión de coro. Soporta dos modos:
 *
 *  - **En la nube** (`url` + `code`): enlace universal
 *    https://mcm.expo.app/playlist?p=XXXX (o /coro?c=XXXX). El receptor
 *    descarga la playlist de Firebase → requiere internet.
 *  - **Sin conexión** (`offlineUrl`): enlace mcmapp://playlist?d=<payload> con
 *    la playlist entera embebida. El receptor (con la app cacheada) la abre sin
 *    internet escaneando con la cámara normal.
 *
 * Si se pasan ambos, muestra un toggle para alternar entre los dos QR.
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
  /** Enlace universal "en la nube" (requiere internet en el receptor). */
  url?: string;
  /** Código de 4 dígitos, mostrado en grande bajo el QR (modo nube). */
  code?: string;
  /** Enlace offline mcmapp://playlist?d=... con la playlist embebida. */
  offlineUrl?: string;
  /** Modo inicial cuando ambos están disponibles. Por defecto 'online'. */
  defaultMode?: 'online' | 'offline';
  /**
   * Si se pasa, la pestaña "con código" sigue disponible aunque todavía no
   * haya `url`: muestra una invitación a subir la playlist a la nube.
   */
  onRequestUpload?: () => void;
  onClose: () => void;
}

const ShareQrModal: React.FC<Props> = ({
  visible,
  title,
  url,
  code,
  offlineUrl,
  defaultMode = 'online',
  onRequestUpload,
  onClose,
}) => {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const styles = useMemo(() => createStyles(isDark), [isDark]);
  const [copied, setCopied] = useState<'link' | 'code' | null>(null);

  const hasOnline = !!url;
  const hasOffline = !!offlineUrl;
  // La pestaña "con código" se puede elegir si ya hay enlace o si podemos
  // ofrecer subir la playlist en el momento.
  const onlineSelectable = hasOnline || !!onRequestUpload;
  const [mode, setMode] = useState<'online' | 'offline'>(
    defaultMode === 'offline' && hasOffline ? 'offline' : 'online',
  );

  useEffect(() => {
    if (visible) {
      setCopied(null);
      setMode(defaultMode === 'offline' && hasOffline ? 'offline' : 'online');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // Modo efectivo: si solo hay uno disponible, ignoramos el toggle.
  const effectiveMode: 'online' | 'offline' = !onlineSelectable
    ? 'offline'
    : !hasOffline
      ? 'online'
      : mode;
  // En la pestaña online sin enlace todavía, invitamos a subir.
  const showUploadPrompt = effectiveMode === 'online' && !hasOnline;
  const showTabs = hasOffline && onlineSelectable;
  const activeUrl = (effectiveMode === 'offline' ? offlineUrl : url) ?? '';

  const switchMode = (next: 'online' | 'offline') => {
    h.tap();
    setMode(next);
    setCopied(null);
  };

  const copy = (what: 'link' | 'code') => {
    h.tap();
    void Clipboard.setStringAsync(what === 'link' ? activeUrl : (code ?? ''));
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

              {showTabs ? (
                <View style={styles.toggle}>
                  <TouchableOpacity
                    onPress={() => switchMode('online')}
                    style={[
                      styles.toggleBtn,
                      effectiveMode === 'online' && styles.toggleBtnActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.toggleText,
                        effectiveMode === 'online' && styles.toggleTextActive,
                      ]}
                    >
                      En la nube
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => switchMode('offline')}
                    style={[
                      styles.toggleBtn,
                      effectiveMode === 'offline' && styles.toggleBtnActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.toggleText,
                        effectiveMode === 'offline' && styles.toggleTextActive,
                      ]}
                    >
                      Sin conexión
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : null}

              <Text style={styles.subtitle}>
                {showUploadPrompt
                  ? 'Sube la playlist a la nube para compartir un QR con código que se abre por internet'
                  : effectiveMode === 'offline'
                    ? 'Funciona sin internet · Escanéalo con la cámara y se abre la app con la playlist ya cargada'
                    : 'Escanea con la cámara · Se abre en la app si la tienes, o en el navegador si no'}
              </Text>

              {showUploadPrompt ? (
                <View style={styles.uploadPrompt}>
                  <MaterialIcons
                    name="cloud-upload"
                    size={48}
                    color={isDark ? '#7AB3FF' : '#253883'}
                  />
                  <Text style={styles.uploadPromptText}>
                    Esta playlist aún no está en la nube
                  </Text>
                </View>
              ) : (
                <>
                  {/* Marco blanco siempre: los lectores QR necesitan contraste. */}
                  <View style={styles.qrWrap}>
                    <QRCode
                      value={activeUrl}
                      size={200}
                      backgroundColor="#FFFFFF"
                    />
                  </View>

                  {effectiveMode === 'online' && code ? (
                    <Text style={styles.code}>{code}</Text>
                  ) : (
                    <View style={styles.codeSpacer} />
                  )}
                </>
              )}

              <View style={styles.buttons}>
                {showUploadPrompt ? (
                  <TouchableOpacity
                    onPress={() => {
                      h.tap();
                      onRequestUpload?.();
                    }}
                    style={[styles.btn, styles.btnPrimary]}
                  >
                    <MaterialIcons name="cloud-upload" size={18} color="#fff" />
                    <Text style={styles.btnPrimaryText}>
                      Subir playlist a la nube
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <>
                    <TouchableOpacity
                      onPress={() => copy('link')}
                      style={[styles.btn, styles.btnPrimary]}
                    >
                      <MaterialIcons name="link" size={18} color="#fff" />
                      <Text style={styles.btnPrimaryText}>
                        {copied === 'link'
                          ? '¡Enlace copiado!'
                          : 'Copiar enlace'}
                      </Text>
                    </TouchableOpacity>
                    {effectiveMode === 'online' && code ? (
                      <TouchableOpacity
                        onPress={() => copy('code')}
                        style={[styles.btn, styles.btnSecondary]}
                      >
                        <Text style={styles.btnSecondaryText}>
                          {copied === 'code'
                            ? '¡Código copiado!'
                            : 'Copiar código'}
                        </Text>
                      </TouchableOpacity>
                    ) : null}
                  </>
                )}
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
    toggle: {
      flexDirection: 'row',
      alignSelf: 'stretch',
      backgroundColor: isDark ? '#2C2C2E' : '#F2F2F7',
      borderRadius: 10,
      padding: 3,
      marginTop: 12,
      marginBottom: 2,
    },
    toggleBtn: {
      flex: 1,
      paddingVertical: 7,
      borderRadius: 8,
      alignItems: 'center',
    },
    toggleBtnActive: {
      backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF',
      ...Platform.select({
        web: { boxShadow: '0 1px 3px rgba(0,0,0,0.15)' },
        default: {
          shadowColor: '#000',
          shadowOpacity: 0.12,
          shadowRadius: 3,
          shadowOffset: { width: 0, height: 1 },
          elevation: 2,
        },
      }),
    },
    toggleText: {
      fontSize: 13,
      fontWeight: '600',
      color: isDark ? '#8E8E93' : '#6B6B70',
    },
    toggleTextActive: {
      color: isDark ? '#7AB3FF' : '#253883',
    },
    qrWrap: {
      backgroundColor: '#FFFFFF',
      padding: 14,
      borderRadius: 14,
    },
    uploadPrompt: {
      height: 228,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
      paddingHorizontal: 16,
    },
    uploadPromptText: {
      fontSize: 14,
      fontWeight: '600',
      color: isDark ? '#AEAEB2' : '#6B6B70',
      textAlign: 'center',
    },
    codeSpacer: {
      height: 26,
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
