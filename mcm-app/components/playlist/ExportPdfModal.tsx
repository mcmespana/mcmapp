/**
 * Modal de configuración antes de exportar la playlist como PDF.
 *
 * El usuario decide:
 *   - Nombre de la playlist (cabecera del PDF)
 *   - La fecha que sale impresa en la portada (texto libre; vacío = sin fecha)
 *   - Si quiere una canción por página (page-break-after)
 *   - Si quiere mostrar los acordes o sólo la letra
 *   - Tamaño base de la letra
 *
 * Independientemente de "salto por canción", el HTML aplica
 * `break-inside: avoid` a cada canción, así que si caben enteras en una
 * página no se parten; si una canción es más larga que A4, el motor de
 * impresión la parte por filas (sin perder cabecera).
 *
 * Los toggles son un componente propio (track+thumb con StyleSheet): el
 * Switch de heroui-native se pintaba invisible dentro de este Modal RN
 * (pista clara sobre tarjeta blanca / estilos Tailwind sin resolver).
 */
import React, { useState, useEffect, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Platform,
  ActivityIndicator,
} from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useColorScheme } from '@/hooks/useColorScheme';
import { h } from '@/utils/haptics';

export interface PdfExportConfig {
  playlistName: string;
  /** Texto de fecha que se imprime en la portada. Vacío = no imprimir. */
  printedDate: string;
  pageBreakPerSong: boolean;
  showChords: boolean;
  lyricsFontPt: number;
}

interface Props {
  visible: boolean;
  initialName: string;
  songCount: number;
  onClose: () => void;
  onSubmit: (cfg: PdfExportConfig) => Promise<void> | void;
}

const FONT_SIZES = [11, 12, 13, 14, 15];

const todayPrintedDate = () =>
  new Date().toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

/**
 * Toggle propio con tamaño y colores explícitos (no depende de Tailwind
 * ni de los colores de tema de heroui-native, que dentro de este Modal
 * dejaban el switch invisible).
 */
const ToggleSwitch: React.FC<{
  value: boolean;
  onToggle: (v: boolean) => void;
  isDark: boolean;
  accessibilityLabel: string;
}> = ({ value, onToggle, isDark, accessibilityLabel }) => (
  <TouchableOpacity
    accessibilityRole="switch"
    accessibilityState={{ checked: value }}
    accessibilityLabel={accessibilityLabel}
    activeOpacity={0.85}
    onPress={() => {
      h.toggle();
      onToggle(!value);
    }}
    style={[
      toggleStyles.track,
      {
        backgroundColor: value ? '#0055A4' : isDark ? '#48484A' : '#D1D1D6',
        alignItems: value ? 'flex-end' : 'flex-start',
      },
    ]}
  >
    <View style={toggleStyles.thumb} />
  </TouchableOpacity>
);

const toggleStyles = StyleSheet.create({
  track: {
    width: 48,
    height: 28,
    borderRadius: 14,
    padding: 2,
    justifyContent: 'center',
  },
  thumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    ...Platform.select({
      web: { boxShadow: '0 1px 3px rgba(0,0,0,0.25)' },
      default: {
        shadowColor: '#000',
        shadowOpacity: 0.25,
        shadowRadius: 2,
        shadowOffset: { width: 0, height: 1 },
        elevation: 2,
      },
    }),
  },
});

const ExportPdfModal: React.FC<Props> = ({
  visible,
  initialName,
  songCount,
  onClose,
  onSubmit,
}) => {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const styles = useMemo(() => createStyles(isDark), [isDark]);

  const [name, setName] = useState(initialName);
  const [printedDate, setPrintedDate] = useState(todayPrintedDate);
  const [pageBreakPerSong, setPageBreakPerSong] = useState(false);
  const [showChords, setShowChords] = useState(true);
  const [lyricsFontPt, setLyricsFontPt] = useState(13);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (visible) {
      setName(initialName);
      setPrintedDate(todayPrintedDate());
      setSubmitting(false);
    }
  }, [visible, initialName]);

  const handleSubmit = async () => {
    if (!name.trim() || submitting) return;
    setSubmitting(true);
    try {
      await onSubmit({
        playlistName: name.trim(),
        printedDate: printedDate.trim(),
        pageBreakPerSong,
        showChords,
        lyricsFontPt,
      });
    } finally {
      setSubmitting(false);
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
              <View style={styles.titleRow}>
                <MaterialIcons
                  name="picture-as-pdf"
                  size={22}
                  color={isDark ? '#FF8A80' : '#C62828'}
                />
                <Text style={styles.title}>Exportar a PDF</Text>
              </View>
              <Text style={styles.subtitle}>
                {songCount} {songCount === 1 ? 'canción' : 'canciones'}
                {'  ·  '}Letra y acordes con un formato fantástico
              </Text>

              <Text style={styles.label}>Título del PDF</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Mi playlist"
                placeholderTextColor={isDark ? '#636366' : '#A0A0A8'}
                style={styles.input}
                selectTextOnFocus
                returnKeyType="done"
              />

              <Text style={styles.label}>Fecha en la portada</Text>
              <TextInput
                value={printedDate}
                onChangeText={setPrintedDate}
                placeholder="Déjalo vacío para no imprimir fecha"
                placeholderTextColor={isDark ? '#636366' : '#A0A0A8'}
                style={styles.input}
                selectTextOnFocus
                returnKeyType="done"
              />

              <View style={styles.row}>
                <View style={styles.rowText}>
                  <Text style={styles.rowTitle}>Una canción por página</Text>
                  <Text style={styles.rowDesc}>
                    Si lo desactivas, el PDF ocupará menos páginas pero quizá se
                    parte alguna canción
                  </Text>
                </View>
                <ToggleSwitch
                  value={pageBreakPerSong}
                  onToggle={setPageBreakPerSong}
                  isDark={isDark}
                  accessibilityLabel="Una canción por página"
                />
              </View>

              <View style={styles.row}>
                <View style={styles.rowText}>
                  <Text style={styles.rowTitle}>Mostrar acordes</Text>
                  <Text style={styles.rowDesc}>
                    Desactívalo para ver sólo la letra, sin acordes
                  </Text>
                </View>
                <ToggleSwitch
                  value={showChords}
                  onToggle={setShowChords}
                  isDark={isDark}
                  accessibilityLabel="Mostrar acordes"
                />
              </View>

              <Text style={[styles.label, { marginTop: 6 }]}>
                Tamaño de letra
              </Text>
              <View style={styles.fontRow}>
                {FONT_SIZES.map((s) => {
                  const active = s === lyricsFontPt;
                  return (
                    <TouchableOpacity
                      key={s}
                      onPress={() => setLyricsFontPt(s)}
                      style={[styles.fontChip, active && styles.fontChipActive]}
                    >
                      <Text
                        style={[
                          styles.fontChipText,
                          active && styles.fontChipTextActive,
                        ]}
                      >
                        {s}pt
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={styles.buttons}>
                <TouchableOpacity
                  onPress={onClose}
                  disabled={submitting}
                  style={[styles.btn, styles.btnSecondary]}
                >
                  <Text style={styles.btnSecondaryText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleSubmit}
                  disabled={!name.trim() || submitting}
                  style={[
                    styles.btn,
                    styles.btnPrimary,
                    (!name.trim() || submitting) && styles.btnDisabled,
                  ]}
                >
                  {submitting ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.btnPrimaryText}>
                      {Platform.OS === 'web' ? 'Abrir PDF' : 'Generar PDF'}
                    </Text>
                  )}
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
      maxWidth: 440,
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
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    title: {
      fontSize: 18,
      fontWeight: '700',
      color: isDark ? '#F5F5F7' : '#1C1C1E',
    },
    subtitle: {
      fontSize: 12,
      color: isDark ? '#8E8E93' : '#6B6B70',
      marginTop: 4,
      marginBottom: 14,
    },
    label: {
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 0.5,
      textTransform: 'uppercase',
      color: isDark ? '#AEAEB2' : '#6B6B70',
      marginBottom: 6,
      marginTop: 4,
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
      marginBottom: 14,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 10,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: isDark ? '#3A3A3C' : '#E5E5EA',
    },
    rowText: { flex: 1 },
    rowTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: isDark ? '#F5F5F7' : '#1C1C1E',
    },
    rowDesc: {
      fontSize: 11.5,
      color: isDark ? '#8E8E93' : '#6B6B70',
      marginTop: 2,
    },
    fontRow: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 14,
    },
    fontChip: {
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 10,
      backgroundColor: isDark ? '#2C2C2E' : '#F2F2F7',
      borderWidth: 1,
      borderColor: 'transparent',
    },
    fontChipActive: {
      backgroundColor: isDark ? '#1A2744' : '#E8EEFF',
      borderColor: '#0055A4',
    },
    fontChipText: {
      fontSize: 13,
      fontWeight: '600',
      color: isDark ? '#AEAEB2' : '#636366',
    },
    fontChipTextActive: {
      color: isDark ? '#7AB3FF' : '#0055A4',
    },
    buttons: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 8,
    },
    btn: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    btnPrimary: { backgroundColor: '#0055A4' },
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

export default ExportPdfModal;
