/**
 * Diálogo reutilizable para introducir / generar un código corto
 * (4 dígitos por defecto). Lo usamos en 4 flujos:
 *
 *   - Subir playlist a la nube  (variant="cloud-upload")
 *   - Descargar desde la nube   (variant="cloud-download")
 *   - Iniciar sesión coro       (variant="choir-start")
 *   - Unirse a sesión coro      (variant="choir-join")
 *
 * El componente no sabe nada del backend: el caller decide qué hacer con
 * el código vía `onSubmit`. Devolver una promesa permite mostrar un
 * estado "cargando" durante la operación.
 */
import { radii } from '@/constants/uiStyles';
import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useColorScheme } from '@/hooks/useColorScheme';
import {
  CODE_LENGTH,
  generateRandomCode,
  isValidCode,
  todayCode,
} from '@/utils/playlistCodes';
import BottomSheet from '../BottomSheet';

export type CodeDialogVariant =
  | 'cloud-upload'
  | 'cloud-download'
  | 'choir-start'
  | 'choir-join'
  | 'change-code';

interface Props {
  visible: boolean;
  variant: CodeDialogVariant;
  /** Código inicial sugerido. Si no se pasa, se autogenera para "upload" / "start". */
  initialCode?: string;
  onClose: () => void;
  /**
   * Se llama cuando el usuario pulsa el botón principal. Si la promesa
   * rechaza, se muestra el `message` del error en rojo y el modal sigue
   * abierto para que reintente o cambie el código.
   */
  onSubmit: (code: string, name?: string) => Promise<void>;
}

interface VariantCopy {
  title: string;
  description: string;
  primaryLabel: string;
  showSuggestButtons: boolean;
  askForName?: boolean;
}

const COPY: Record<CodeDialogVariant, VariantCopy> = {
  'cloud-upload': {
    title: 'Subir playlist a la nube',
    description:
      'Dale un nombre (opcional) y elige un código de 4 dígitos. Cualquiera con el código podrá importar tu playlist.',
    primaryLabel: 'Subir',
    showSuggestButtons: true,
    askForName: true,
  },
  'cloud-download': {
    title: 'Descargar playlist',
    description: 'Introduce el código de 4 dígitos que te han compartido.',
    primaryLabel: 'Descargar',
    showSuggestButtons: false,
  },
  'choir-start': {
    title: 'Iniciar sesión de coro',
    description:
      'Tu dispositivo será el director. Los demás se conectarán con este código.',
    primaryLabel: 'Iniciar',
    showSuggestButtons: true,
  },
  'choir-join': {
    title: 'Unirse al coro',
    description:
      'Introduce el código proporcionado para seguir las canciones automáticamente.',
    primaryLabel: 'Unirse',
    showSuggestButtons: false,
  },
  'change-code': {
    title: 'Cambiar código',
    description: 'Elige un nuevo código para esta sesión.',
    primaryLabel: 'Cambiar',
    showSuggestButtons: true,
  },
};

const CodeInputModal: React.FC<Props> = ({
  visible,
  variant,
  initialCode,
  onClose,
  onSubmit,
}) => {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const styles = useMemo(() => createStyles(isDark), [isDark]);
  const copy = COPY[variant];

  const [code, setCode] = useState<string>('');
  const [name, setName] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Al abrir, sembrar valor inicial.
  useEffect(() => {
    if (!visible) return;
    setError(null);
    setSubmitting(false);
    if (initialCode && isValidCode(initialCode)) {
      setCode(initialCode);
    } else if (
      variant === 'cloud-upload' ||
      variant === 'choir-start' ||
      variant === 'change-code'
    ) {
      setCode(generateRandomCode());
    } else {
      setCode('');
    }

    // Auto-completar un nombre chulo por defecto para la nube
    if (variant === 'cloud-upload') {
      const monthNames = [
        'ene',
        'feb',
        'mar',
        'abr',
        'may',
        'jun',
        'jul',
        'ago',
        'sep',
        'oct',
        'nov',
        'dic',
      ];
      const now = new Date();
      setName(`Playlist ${now.getDate()} ${monthNames[now.getMonth()]}`);
    } else {
      setName('');
    }
  }, [visible, variant, initialCode]);

  const valid = isValidCode(code);

  const handleSubmit = async () => {
    if (!valid || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(code, name.trim() || undefined);
    } catch (e: any) {
      setError(e?.message ?? 'Algo salió mal');
      setSubmitting(false);
    }
  };

  const handleChangeText = (txt: string) => {
    const digits = txt.replace(/\D/g, '').slice(0, CODE_LENGTH);
    setCode(digits);
    if (error) setError(null);
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={() => {
        if (!submitting) onClose();
      }}
      title={copy.title}
    >
      <View style={styles.container}>
        <Text style={styles.description}>{copy.description}</Text>

        {copy.askForName && (
          <View style={styles.nameRow}>
            <Text style={styles.inputLabel}>Nombre</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Ej. Eucaristía domingo 7 abril 2031"
              placeholderTextColor={isDark ? '#636366' : '#A0A0A8'}
              style={styles.nameInput}
              editable={!submitting}
            />
          </View>
        )}

        <Text style={[styles.inputLabel, copy.askForName && { marginTop: 12 }]}>
          Código (4 dígitos)
        </Text>
        <View style={styles.codeRow}>
          {/* Para máxima fiabilidad cross-platform (web + RN) usamos un
              único TextInput de N dígitos en lugar de N TextInputs
              separados. Visualmente lo presentamos con celdas. */}
          <TextInput
            value={code}
            onChangeText={handleChangeText}
            keyboardType="number-pad"
            inputMode="numeric"
            autoFocus
            maxLength={CODE_LENGTH}
            selectTextOnFocus
            style={styles.hiddenInput}
            editable={!submitting}
            onSubmitEditing={handleSubmit}
            returnKeyType="done"
          />
          <View style={styles.cells} pointerEvents="none">
            {Array.from({ length: CODE_LENGTH }).map((_, i) => {
              const char = code[i] ?? '';
              const active = i === code.length;
              return (
                <View
                  key={i}
                  style={[
                    styles.cell,
                    active && !submitting && styles.cellActive,
                    !!char && styles.cellFilled,
                  ]}
                >
                  <Text style={styles.cellText}>{char}</Text>
                </View>
              );
            })}
          </View>
        </View>

        {copy.showSuggestButtons && (
          <View style={styles.suggestRow}>
            <TouchableOpacity
              style={styles.suggestBtn}
              onPress={() => setCode(generateRandomCode())}
              disabled={submitting}
            >
              <MaterialIcons
                name="casino"
                size={16}
                color={isDark ? '#7AB3FF' : '#253883'}
              />
              <Text style={styles.suggestText}>Aleatorio</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.suggestBtn}
              onPress={() => setCode(todayCode())}
              disabled={submitting}
            >
              <MaterialIcons
                name="event"
                size={16}
                color={isDark ? '#7AB3FF' : '#253883'}
              />
              <Text style={styles.suggestText}>Hoy (DDMM)</Text>
            </TouchableOpacity>
          </View>
        )}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.buttons}>
          <TouchableOpacity
            style={[styles.btn, styles.btnSecondary]}
            onPress={onClose}
            disabled={submitting}
          >
            <Text style={styles.btnSecondaryText}>Cancelar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.btn,
              styles.btnPrimary,
              (!valid || submitting) && styles.btnDisabled,
            ]}
            onPress={handleSubmit}
            disabled={!valid || submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnPrimaryText}>{copy.primaryLabel}</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </BottomSheet>
  );
};

const createStyles = (isDark: boolean) =>
  StyleSheet.create({
    container: {
      paddingBottom: 24,
    },
    description: {
      fontSize: 14,
      color: isDark ? '#A0A0A8' : '#6B6B70',
      marginBottom: 18,
      lineHeight: 20,
    },
    codeRow: {
      position: 'relative',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 14,
      marginTop: 6,
    },
    nameRow: {
      marginBottom: 8,
    },
    inputLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: isDark ? '#A0A0A8' : '#6B6B70',
      marginBottom: 6,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    nameInput: {
      backgroundColor: isDark ? '#1C1C1E' : '#F8F8FA',
      borderRadius: radii.md,
      paddingHorizontal: 16,
      paddingVertical: 14,
      fontSize: 16,
      color: isDark ? '#F5F5F7' : '#1C1C1E',
      borderWidth: 1.5,
      borderColor: isDark ? '#48484A' : '#D1D1D6',
    },
    hiddenInput: {
      position: 'absolute',
      width: '100%',
      height: 56,
      opacity: 0.01,
      color: 'transparent',
      // En web, dejamos un caret invisible para no ver doble cursor.
      ...(Platform.OS === 'web' ? ({ caretColor: 'transparent' } as any) : {}),
      fontSize: 1,
    },
    cells: {
      flexDirection: 'row',
      gap: 10,
    },
    cell: {
      width: 52,
      height: 60,
      borderRadius: radii.md,
      borderWidth: 1.5,
      borderColor: isDark ? '#48484A' : '#D1D1D6',
      backgroundColor: isDark ? '#1C1C1E' : '#F8F8FA',
      alignItems: 'center',
      justifyContent: 'center',
    },
    cellFilled: {
      borderColor: isDark ? '#7AB3FF' : '#253883',
    },
    cellActive: {
      borderColor: isDark ? '#7AB3FF' : '#253883',
      backgroundColor: isDark ? '#1A2744' : '#EEF4FF',
    },
    cellText: {
      fontSize: 26,
      fontWeight: '700',
      color: isDark ? '#F5F5F7' : '#1C1C1E',
      fontVariant: ['tabular-nums'],
    },
    suggestRow: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 14,
      justifyContent: 'center',
    },
    suggestBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: radii.sm,
      backgroundColor: isDark ? '#1A2744' : '#EEF4FF',
    },
    suggestText: {
      fontSize: 13,
      fontWeight: '600',
      color: isDark ? '#7AB3FF' : '#253883',
    },
    error: {
      color: '#FF453A',
      fontSize: 13,
      marginBottom: 8,
      textAlign: 'center',
    },
    buttons: {
      flexDirection: 'row',
      gap: 10,
      justifyContent: 'flex-end',
      marginTop: 4,
    },
    btn: {
      paddingVertical: 11,
      paddingHorizontal: 18,
      borderRadius: 10,
      minWidth: 110,
      alignItems: 'center',
      justifyContent: 'center',
    },
    btnSecondary: {
      backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#F2F2F7',
    },
    btnSecondaryText: {
      fontSize: 15,
      fontWeight: '600',
      color: isDark ? '#F5F5F7' : '#1C1C1E',
    },
    btnPrimary: {
      backgroundColor: '#253883',
    },
    btnPrimaryText: {
      fontSize: 15,
      fontWeight: '700',
      color: '#FFFFFF',
    },
    btnDisabled: {
      opacity: 0.45,
    },
  });

export default CodeInputModal;
