/**
 * Menú principal de acciones de la pantalla "Seleccionadas". Reemplaza
 * los 4 iconitos del header anterior por un único botón "…" que abre
 * este menú. Permite muchas más acciones sin saturar.
 */
import React, { useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  ScrollView,
} from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export interface PlaylistAction {
  id: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  label: string;
  description?: string;
  onPress: () => void;
  variant?: 'normal' | 'danger';
  /** Si true, se renderiza un separador visual ANTES de este item. */
  separator?: boolean;
  disabled?: boolean;
}

interface Props {
  visible: boolean;
  actions: PlaylistAction[];
  onClose: () => void;
  title?: string;
}

/**
 * Implementado como modal de RN con un panel "bottom sheet" estático
 * (sin gestos). Es suficiente para esta UX y evita pelearnos con la
 * portabilidad del BottomSheet de heroui en web.
 */
const PlaylistActionsSheet: React.FC<Props> = ({
  visible,
  actions,
  onClose,
  title = 'Acciones',
}) => {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const insets = useSafeAreaInsets();
  const styles = useMemo(
    () => createStyles(isDark, insets.bottom),
    [isDark, insets.bottom],
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop}>
          <TouchableWithoutFeedback>
            <View style={styles.sheet}>
              <View style={styles.handle} />
              <Text style={styles.title}>{title}</Text>
              <ScrollView
                style={styles.list}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
              >
                {actions.map((a, i) => (
                  <React.Fragment key={a.id}>
                    {a.separator && i > 0 ? (
                      <View style={styles.separator} />
                    ) : null}
                    <TouchableOpacity
                      style={[styles.item, a.disabled && styles.itemDisabled]}
                      onPress={() => {
                        if (a.disabled) return;
                        onClose();
                        // Defer slightly so the modal can dismiss before the
                        // action triggers another modal (avoids race on web).
                        setTimeout(() => a.onPress(), 50);
                      }}
                      disabled={a.disabled}
                    >
                      <View
                        style={[
                          styles.iconWrap,
                          a.variant === 'danger' && styles.iconWrapDanger,
                        ]}
                      >
                        <MaterialIcons
                          name={a.icon}
                          size={22}
                          color={
                            a.variant === 'danger'
                              ? '#FF453A'
                              : isDark
                                ? '#7AB3FF'
                                : '#253883'
                          }
                        />
                      </View>
                      <View style={styles.itemText}>
                        <Text
                          style={[
                            styles.itemLabel,
                            a.variant === 'danger' && styles.itemLabelDanger,
                          ]}
                        >
                          {a.label}
                        </Text>
                        {a.description ? (
                          <Text style={styles.itemDescription}>
                            {a.description}
                          </Text>
                        ) : null}
                      </View>
                    </TouchableOpacity>
                  </React.Fragment>
                ))}
              </ScrollView>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const createStyles = (isDark: boolean, bottomInset: number) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF',
      borderTopLeftRadius: 22,
      borderTopRightRadius: 22,
      paddingTop: 8,
      paddingBottom: bottomInset + 16,
      maxHeight: '85%',
    },
    handle: {
      width: 40,
      height: 5,
      borderRadius: 3,
      backgroundColor: isDark ? '#48484A' : '#D1D1D6',
      alignSelf: 'center',
      marginBottom: 8,
    },
    title: {
      fontSize: 17,
      fontWeight: '700',
      color: isDark ? '#F5F5F7' : '#1C1C1E',
      paddingHorizontal: 20,
      paddingVertical: 8,
    },
    list: {
      maxHeight: '100%',
    },
    listContent: {
      paddingHorizontal: 8,
      paddingBottom: 8,
    },
    item: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      paddingHorizontal: 12,
      borderRadius: 12,
      gap: 14,
    },
    itemDisabled: {
      opacity: 0.4,
    },
    iconWrap: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: isDark ? '#1A2744' : '#EEF4FF',
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconWrapDanger: {
      backgroundColor: isDark ? '#3A1517' : '#FFE5E4',
    },
    itemText: {
      flex: 1,
    },
    itemLabel: {
      fontSize: 15,
      fontWeight: '600',
      color: isDark ? '#F5F5F7' : '#1C1C1E',
    },
    itemLabelDanger: {
      color: '#FF453A',
    },
    itemDescription: {
      fontSize: 13,
      color: isDark ? '#8E8E93' : '#8E8E93',
      marginTop: 2,
    },
    separator: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
      marginVertical: 6,
      marginHorizontal: 20,
    },
  });

export default PlaylistActionsSheet;
