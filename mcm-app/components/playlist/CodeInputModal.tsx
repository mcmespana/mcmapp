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
import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Keyboard,
} from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import AppTextField from '@/components/ui/AppTextField';
import { useColorScheme } from '@/hooks/useColorScheme';
import {
  CODE_LENGTH,
  defaultPlaylistName,
  generateRandomCode,
  isValidCode,
  todayCode,
} from '@/utils/playlistCodes';
import QrScannerModal, {
  isQrScanSupported,
} from '@/components/playlist/QrScannerModal';
import type { QrTarget } from '@/utils/qrScan';
import { h } from '@/utils/haptics';
import BottomSheet from '../BottomSheet';
import { createStyles } from './codeInputModalStyles';

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
  /**
   * Se llama cuando el QR escaneado era una playlist OFFLINE (lleva las
   * canciones embebidas, no un código): no hay nada que descargar, así que lo
   * resuelve la pantalla. Si no se pasa, esos QR se rechazan con un aviso.
   */
  onScanOffline?: (payload: string) => void;
  /**
   * Se llama cuando el QR escaneado era el de un CORO (`?coro=<id>`): no hay
   * código que descargar, hay que traerse la última playlist de ese coro.
   */
  onScanChoir?: (choirId: string) => void;
}

interface VariantCopy {
  title: string;
  description: string;
  primaryLabel: string;
  showSuggestButtons: boolean;
  askForName?: boolean;
  /**
   * Flujo al que apunta el escáner de QR. Solo lo tienen las variantes en las
   * que el usuario TECLEA un código que le han dado; en las que lo genera él
   * (subir, iniciar coro, cambiar código) no hay nada que escanear.
   */
  scanTarget?: QrTarget;
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
    description:
      'Escanea el QR que te han compartido o introduce el código de 4 dígitos.',
    primaryLabel: 'Descargar',
    showSuggestButtons: false,
    scanTarget: 'playlist',
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
      'Escanea el QR del coro o introduce el código para seguir las canciones automáticamente.',
    primaryLabel: 'Unirse',
    showSuggestButtons: false,
    scanTarget: 'choir',
  },
  'change-code': {
    title: 'Cambiar código',
    description: 'Elige un nuevo código para esta sesión.',
    primaryLabel: 'Cambiar',
    showSuggestButtons: true,
  },
};

/** Código y nombre con los que arranca el diálogo al abrirse. */
function seedFor(
  variant: CodeDialogVariant,
  initialCode?: string,
): { code: string; name: string } {
  let code = '';
  if (initialCode && isValidCode(initialCode)) {
    code = initialCode;
  } else if (
    variant === 'cloud-upload' ||
    variant === 'choir-start' ||
    variant === 'change-code'
  ) {
    code = generateRandomCode();
  }

  // Nombre por defecto solo para la nube, con la fecha de hoy.
  const name = variant === 'cloud-upload' ? defaultPlaylistName() : '';

  return { code, name };
}

/**
 * Estado del escáner. Tiene un paso a cada lado a propósito: iOS rechaza en
 * silencio un Modal que aparece en el mismo ciclo de render en que otro se
 * cierra. Así que al ABRIR escondemos la hoja y esperamos a que `BottomSheet`
 * confirme que está desmontada (`onCloseComplete` → `scanning`), y al CERRAR
 * esperamos a que la cámara confirme que se ha ido (`onDismissed` → `idle`)
 * antes de dejar que la hoja vuelva.
 */
type ScanState = 'idle' | 'pending' | 'scanning' | 'closing';

const CodeInputModal: React.FC<Props> = ({
  visible,
  variant,
  initialCode,
  onClose,
  onSubmit,
  onScanOffline,
  onScanChoir,
}) => {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const styles = useMemo(() => createStyles(isDark), [isDark]);
  const copy = COPY[variant];

  const [code, setCode] = useState<string>('');
  const [name, setName] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scan, setScan] = useState<ScanState>('idle');

  const canScan = !!copy.scanTarget && isQrScanSupported();

  // Al abrir se siembran los valores iniciales, ajustando el estado durante el
  // render (el patrón que documenta React para "cambiar estado cuando cambia
  // una prop"). Antes lo hacía un efecto, que dejaba un render con el código
  // del intento anterior antes de sustituirlo.
  const [lastSeed, setLastSeed] = useState({ visible, variant, initialCode });
  if (
    lastSeed.visible !== visible ||
    lastSeed.variant !== variant ||
    lastSeed.initialCode !== initialCode
  ) {
    setLastSeed({ visible, variant, initialCode });
    if (visible) {
      const seed = seedFor(variant, initialCode);
      setError(null);
      setSubmitting(false);
      setScan('idle');
      setCode(seed.code);
      setName(seed.name);
    }
  }

  const valid = isValidCode(code);

  /**
   * `override` llega desde el escáner: el código recién leído todavía no está
   * en el estado (React lo aplica en el siguiente render) y no queremos hacer
   * esperar al usuario un toque más.
   */
  const handleSubmit = async (override?: string) => {
    const value = override ?? code;
    if (!isValidCode(value) || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(value, name.trim() || undefined);
    } catch (e: any) {
      setError(e?.message ?? 'Algo salió mal');
      setSubmitting(false);
    }
  };

  /**
   * QR leído con código: se rellena y se envía sin pedir confirmación — que es
   * justo la gracia de escanear. El envío arranca ya, mientras la cámara se va:
   * si sale bien, la pantalla cierra el diálogo entero y la hoja no llega a
   * reaparecer; si falla, vuelve con el código puesto y el error escrito.
   */
  const handleScannedCode = (scanned: string) => {
    setScan('closing');
    setCode(scanned);
    void handleSubmit(scanned);
  };

  const handleScannedOffline = (payload: string) => {
    setScan('closing');
    onScanOffline?.(payload);
  };

  const handleScannedChoir = (choirId: string) => {
    setScan('closing');
    onScanChoir?.(choirId);
  };

  const handleChangeText = (txt: string) => {
    const digits = txt.replace(/\D/g, '').slice(0, CODE_LENGTH);
    setCode(digits);
    if (error) setError(null);
  };

  return (
    <>
      <BottomSheet
        visible={visible && scan === 'idle'}
        onClose={() => {
          if (!submitting) onClose();
        }}
        onCloseComplete={() => {
          // Solo abrimos la cámara si la hoja se escondió PARA escanear; un
          // cierre normal (cancelar, swipe) pasa por aquí igualmente.
          setScan((s) => (s === 'pending' ? 'scanning' : s));
        }}
        title={copy.title}
      >
        <View style={styles.container}>
          <Text style={styles.description}>{copy.description}</Text>

          {copy.askForName && (
            <View style={styles.nameRow}>
              <Text style={styles.inputLabel}>Nombre</Text>
              <AppTextField
                value={name}
                onChangeText={setName}
                placeholder="Ej. Eucaristía domingo 7 abril 2031"
                editable={!submitting}
                accentColor={isDark ? '#7AB3FF' : '#253883'}
                accentWhenFilled
              />
            </View>
          )}

          <Text
            style={[styles.inputLabel, copy.askForName && { marginTop: 12 }]}
          >
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
              onSubmitEditing={() => void handleSubmit()}
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

          {canScan && (
            <TouchableOpacity
              style={styles.scanBtn}
              onPress={() => {
                if (submitting) return;
                h.tap();
                // El teclado numérico está abierto por el `autoFocus` del código:
                // sin esto se queda flotando sobre la cámara al abrirse.
                Keyboard.dismiss();
                setScan('pending');
              }}
              disabled={submitting}
              accessibilityRole="button"
              accessibilityLabel="Escanear un código QR con la cámara"
            >
              <MaterialIcons name="qr-code-scanner" size={20} color="#fff" />
              <Text style={styles.scanBtnText}>Escanear QR</Text>
            </TouchableOpacity>
          )}

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
              onPress={() => void handleSubmit()}
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

      {copy.scanTarget ? (
        <QrScannerModal
          visible={scan === 'scanning'}
          expected={copy.scanTarget}
          onClose={() => setScan('closing')}
          onDismissed={() => setScan('idle')}
          onCode={handleScannedCode}
          onOffline={onScanOffline ? handleScannedOffline : undefined}
          onChoir={onScanChoir ? handleScannedChoir : undefined}
        />
      ) : null}
    </>
  );
};

export default CodeInputModal;
