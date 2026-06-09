import React, { useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
} from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useColorScheme } from '@/hooks/useColorScheme';
import BottomSheet from '@/components/BottomSheet';

export interface PlaylistAction {
  id: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  label: string;
  description?: string;
  onPress: () => void;
  variant?: 'normal' | 'danger';
  disabled?: boolean;
}

export interface PlaylistActionSection {
  /** Cabecera de la sección. Sin título = solo separador (p.ej. zona peligro). */
  title?: string;
  actions: PlaylistAction[];
}

interface Props {
  visible: boolean;
  sections: PlaylistActionSection[];
  onClose: () => void;
  title?: string;
}

const PlaylistActionsBottomSheet: React.FC<Props> = ({
  visible,
  sections,
  onClose,
  title = 'Acciones',
}) => {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const styles = useMemo(() => createStyles(isDark), [isDark]);
  const maxListHeight = Dimensions.get('window').height * 0.6;

  // Store the action to fire once the sheet is fully dismissed.
  // Using a ref (not state) avoids a re-render between press and close.
  const pendingActionRef = useRef<PlaylistAction | null>(null);

  const handleCloseComplete = useCallback(() => {
    const action = pendingActionRef.current;
    pendingActionRef.current = null;
    action?.onPress();
  }, []);

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={title}
      onCloseComplete={handleCloseComplete}
    >
      <ScrollView
        style={[styles.list, { maxHeight: maxListHeight }]}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      >
        {sections
          .filter((s) => s.actions.length > 0)
          .map((section, sIdx) => (
            <React.Fragment key={section.title ?? `section-${sIdx}`}>
              {sIdx > 0 ? <View style={styles.separator} /> : null}
              {section.title ? (
                <Text style={styles.sectionTitle}>{section.title}</Text>
              ) : null}
              {section.actions.map((a) => (
                <TouchableOpacity
                  key={a.id}
                  style={[styles.item, a.disabled && styles.itemDisabled]}
                  onPress={() => {
                    if (a.disabled) return;
                    // Store the action so handleCloseComplete fires it after
                    // the sheet Modal is fully dismissed. iOS cannot present a
                    // second Modal while the first one is still mounted.
                    pendingActionRef.current = a;
                    onClose();
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
              ))}
            </React.Fragment>
          ))}
      </ScrollView>
    </BottomSheet>
  );
};

const createStyles = (isDark: boolean) =>
  StyleSheet.create({
    list: {},
    listContent: {
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
      color: '#8E8E93',
      marginTop: 2,
    },
    separator: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
      marginVertical: 6,
      marginHorizontal: 20,
    },
    sectionTitle: {
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 0.6,
      textTransform: 'uppercase',
      color: isDark ? '#8E8E93' : '#6B6B70',
      paddingHorizontal: 12,
      paddingTop: 8,
      paddingBottom: 4,
    },
  });

export default PlaylistActionsBottomSheet;
