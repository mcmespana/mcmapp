/**
 * Diálogo con N opciones (1-3 acciones + cancelar). Lo usamos para:
 *   - "Este código ya existe → sobrescribir / cambiar / cancelar"
 *   - "Descargada → reemplazar tu lista / añadir / cancelar"
 *   - Confirmaciones genéricas.
 */
import React, { useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Platform,
} from 'react-native';
import { useColorScheme } from '@/hooks/useColorScheme';

export interface ConfirmChoiceAction {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
}

interface Props {
  visible: boolean;
  title: string;
  description?: string;
  actions: ConfirmChoiceAction[];
  onClose: () => void;
}

const ConfirmChoiceModal: React.FC<Props> = ({
  visible,
  title,
  description,
  actions,
  onClose,
}) => {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const styles = useMemo(() => createStyles(isDark), [isDark]);

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
              <View style={styles.actions}>
                {actions.map((a, i) => (
                  <TouchableOpacity
                    key={i}
                    style={[
                      styles.btn,
                      a.variant === 'primary' && styles.btnPrimary,
                      a.variant === 'danger' && styles.btnDanger,
                      (!a.variant || a.variant === 'secondary') &&
                        styles.btnSecondary,
                    ]}
                    onPress={a.onPress}
                  >
                    <Text
                      style={[
                        styles.btnText,
                        a.variant === 'primary' && styles.btnPrimaryText,
                        a.variant === 'danger' && styles.btnDangerText,
                        (!a.variant || a.variant === 'secondary') &&
                          styles.btnSecondaryText,
                      ]}
                    >
                      {a.label}
                    </Text>
                  </TouchableOpacity>
                ))}
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
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20,
    },
    card: {
      width: '100%',
      maxWidth: 420,
      backgroundColor: isDark ? '#2C2C2E' : '#FFFFFF',
      borderRadius: 18,
      padding: 22,
      ...Platform.select({
        web: { boxShadow: '0 12px 40px rgba(0,0,0,0.25)' },
        default: {
          shadowColor: '#000',
          shadowOpacity: 0.25,
          shadowRadius: 20,
          shadowOffset: { width: 0, height: 8 },
          elevation: 12,
        },
      }),
    },
    title: {
      fontSize: 18,
      fontWeight: '700',
      color: isDark ? '#F5F5F7' : '#1C1C1E',
      marginBottom: 8,
    },
    description: {
      fontSize: 14,
      color: isDark ? '#A0A0A8' : '#6B6B70',
      lineHeight: 20,
      marginBottom: 18,
    },
    actions: {
      gap: 8,
    },
    btn: {
      paddingVertical: 13,
      paddingHorizontal: 18,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    btnText: {
      fontSize: 15,
      fontWeight: '600',
    },
    btnSecondary: {
      backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#F2F2F7',
    },
    btnSecondaryText: {
      color: isDark ? '#F5F5F7' : '#1C1C1E',
    },
    btnPrimary: {
      backgroundColor: '#253883',
    },
    btnPrimaryText: {
      color: '#fff',
      fontWeight: '700',
    },
    btnDanger: {
      backgroundColor: isDark ? '#3A1517' : '#FFE5E4',
    },
    btnDangerText: {
      color: '#FF453A',
      fontWeight: '700',
    },
  });

export default ConfirmChoiceModal;
