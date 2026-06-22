/**
 * Modal que pide una contraseña antes de una acción destructiva
 * (p.ej. sobrescribir una playlist en la nube que ya existe).
 * La validación es local: se compara con `expectedPassword` y, si
 * coincide, se llama a `onSuccess`.
 */
import { radii } from '@/constants/uiStyles';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Platform,
} from 'react-native';
import { useColorScheme } from '@/hooks/useColorScheme';
import { h } from '@/utils/haptics';

interface Props {
  visible: boolean;
  title: string;
  description?: string;
  expectedPassword: string;
  /** Texto del botón de confirmar (p.ej. "Sobrescribir"). */
  confirmLabel?: string;
  onSuccess: () => void;
  onClose: () => void;
}

const PasswordPromptModal: React.FC<Props> = ({
  visible,
  title,
  description,
  expectedPassword,
  confirmLabel = 'Confirmar',
  onSuccess,
  onClose,
}) => {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const styles = useMemo(() => createStyles(isDark), [isDark]);

  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);

  useEffect(() => {
    if (visible) {
      setPassword('');
      setError(false);
    }
  }, [visible]);

  const handleConfirm = () => {
    if (password.trim().toLowerCase() === expectedPassword.toLowerCase()) {
      h.formSuccess();
      onSuccess();
    } else {
      h.tap();
      setError(true);
    }
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
              {description ? (
                <Text style={styles.description}>{description}</Text>
              ) : null}
              <TextInput
                value={password}
                onChangeText={(t) => {
                  setPassword(t);
                  setError(false);
                }}
                placeholder="Contraseña"
                placeholderTextColor={isDark ? '#636366' : '#A0A0A8'}
                style={[styles.input, error && styles.inputError]}
                autoFocus
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry
                onSubmitEditing={handleConfirm}
                returnKeyType="done"
              />
              {error ? (
                <Text style={styles.errorText}>Contraseña incorrecta</Text>
              ) : null}
              <View style={styles.buttons}>
                <TouchableOpacity
                  onPress={onClose}
                  style={[styles.btn, styles.btnSecondary]}
                >
                  <Text style={styles.btnSecondaryText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleConfirm}
                  disabled={!password.trim()}
                  style={[
                    styles.btn,
                    styles.btnPrimary,
                    !password.trim() && styles.btnDisabled,
                  ]}
                >
                  <Text style={styles.btnPrimaryText}>{confirmLabel}</Text>
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
      maxWidth: 380,
      backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF',
      borderRadius: 18,
      padding: 20,
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
    },
    description: {
      fontSize: 13.5,
      lineHeight: 19,
      color: isDark ? '#AEAEB2' : '#48484A',
      marginTop: 6,
    },
    input: {
      borderWidth: 1,
      borderColor: isDark ? '#3A3A3C' : '#D1D1D6',
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: Platform.OS === 'ios' ? 12 : 10,
      fontSize: 15,
      color: isDark ? '#F5F5F7' : '#1C1C1E',
      backgroundColor: isDark ? '#2C2C2E' : '#F2F2F7',
      marginTop: 14,
    },
    inputError: {
      borderColor: '#FF453A',
    },
    errorText: {
      color: '#FF453A',
      fontSize: 12.5,
      marginTop: 6,
    },
    buttons: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 16,
    },
    btn: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: radii.md,
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
    btnDisabled: { opacity: 0.5 },
  });

export default PasswordPromptModal;
