/**
 * Escáner de QR a pantalla completa para los flujos de "meter un código":
 * importar una playlist de la nube y unirse a una sesión de coro.
 *
 * Lee los tres QR que genera `ShareQrModal` (playlist con código, coro con
 * código y playlist offline con la lista embebida) — ver `utils/qrScan.ts`.
 *
 * ## Sobre `expo-camera`
 *
 * Es un módulo NATIVO: no existe en un binario publicado antes de añadirlo. Por
 * eso lo cargamos con `require` dentro de un try/catch en vez de importarlo
 * arriba — si una OTA llegase a una build antigua, el botón de escanear
 * simplemente no aparece en lugar de reventar la pantalla entera.
 *
 * ## Sobre Reanimated dentro de este `Modal`
 *
 * Comprobado en simulador iOS el 2026-08-09: aquí Reanimated SÍ corre (el
 * láser barre, las esquinas entran, los `entering={FadeIn}` acaban visibles).
 * No comparte el fallo de `BottomSheet.tsx`, así que no hay que migrarlo a
 * `Animated`.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeOut, ZoomIn } from 'react-native-reanimated';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import CelebrationBurst from '@/components/ui/CelebrationBurst';
import QrScanFrame from '@/components/playlist/QrScanFrame';
import {
  describeMismatch,
  parseScannedQr,
  type QrScanResult,
  type QrTarget,
} from '@/utils/qrScan';
import { h } from '@/utils/haptics';
import { logger } from '@/utils/logger';
import { styles } from './qrScannerStyles';

/** Milisegundos que dejamos ver la animación de éxito antes de resolver. */
const CELEBRATION_MS = 850;
/** Antirrebote de los avisos ("ese QR es de coro") para no parpadear. */
const HINT_COOLDOWN_MS = 2200;

type CameraModule = typeof import('expo-camera');

let cached: CameraModule | null | undefined;

/** `null` si el binario instalado no trae el módulo nativo de cámara. */
function getCamera(): CameraModule | null {
  if (cached === undefined) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      cached = require('expo-camera') as CameraModule;
    } catch (e) {
      logger.warn('expo-camera no disponible en este binario', e);
      cached = null;
    }
  }
  return cached;
}

/**
 * ¿Se puede ofrecer el botón de escanear? En web `expo-camera` necesita
 * permisos de getUserMedia y el decodificador no es fiable en todos los
 * navegadores, así que ahí no lo enseñamos: quien esté en el navegador ya
 * puede pinchar el enlace del QR directamente.
 */
export function isQrScanSupported(): boolean {
  return Platform.OS !== 'web' && getCamera() !== null;
}

interface Props {
  visible: boolean;
  /** Flujo desde el que se abre, para avisar si el QR es del otro. */
  expected: QrTarget;
  onClose: () => void;
  /** QR con código de 4 dígitos. */
  onCode: (code: string) => void;
  /** QR offline con la playlist embebida (solo llega en `expected: playlist`). */
  onOffline?: (payload: string) => void;
  /**
   * La cámara ya NO está en pantalla. Quien nos abrió tiene que esperar a esto
   * para volver a enseñar su propio Modal: iOS rechaza en silencio un Modal que
   * se presenta en el mismo ciclo de render en que otro se cierra.
   */
  onDismissed?: () => void;
}

const QrScannerModal: React.FC<Props> = ({
  visible,
  expected,
  onClose,
  onCode,
  onOffline,
  onDismissed,
}) => {
  const insets = useSafeAreaInsets();
  const camera = getCamera();

  const [granted, setGranted] = useState<boolean | null>(null);
  const [found, setFound] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  // Una vez encontrado dejamos de mirar fotogramas: si no, el mismo QR entra
  // veinte veces mientras corre la animación de celebración.
  const lockedRef = useRef(false);
  const hintAtRef = useRef(0);
  const celebrationRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Al ABRIR se olvida el escaneo anterior. Se ajusta durante el render (el
  // patrón que documenta React para "cambiar estado cuando cambia una prop"),
  // no en un efecto: así la cámara nunca llega a pintarse un fotograma con el
  // marco todavía en verde de la vez pasada.
  const [lastVisible, setLastVisible] = useState(visible);
  if (visible !== lastVisible) {
    setLastVisible(visible);
    if (visible) {
      lockedRef.current = false;
      setFound(false);
      setHint(null);
    }
  }

  // Aviso de "ya no estoy en pantalla". En iOS lo da UIKit por el `onDismiss`
  // del Modal, que es el único momento en que de verdad se ha ido; en el resto
  // de plataformas basta con el cambio de la prop.
  const wasVisibleRef = useRef(visible);
  useEffect(() => {
    if (Platform.OS !== 'ios' && wasVisibleRef.current && !visible) {
      onDismissed?.();
    }
    wasVisibleRef.current = visible;
  }, [visible, onDismissed]);

  // Pedimos permiso al abrir. `getCameraPermissionsAsync` primero para no
  // enseñar el diálogo del sistema a quien ya dijo que sí.
  useEffect(() => {
    if (!visible || !camera) return;
    let alive = true;
    (async () => {
      try {
        const current = await camera.Camera.getCameraPermissionsAsync();
        const res = current.granted
          ? current
          : await camera.Camera.requestCameraPermissionsAsync();
        if (alive) setGranted(res.granted);
      } catch (e) {
        logger.warn('No se pudo pedir permiso de cámara', e);
        if (alive) setGranted(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [visible, camera]);

  /** Aviso efímero que no cierra la cámara: se sigue escaneando. */
  const showHint = useCallback((text: string) => {
    const now = Date.now();
    if (now - hintAtRef.current < HINT_COOLDOWN_MS) return;
    hintAtRef.current = now;
    h.error();
    setHint(text);
  }, []);

  const resolve = useCallback(
    (result: QrScanResult) => {
      lockedRef.current = true;
      setHint(null);
      setFound(true);
      h.formSuccess();
      celebrationRef.current = setTimeout(() => {
        celebrationRef.current = null;
        if (result.kind === 'offline') onOffline?.(result.payload);
        else onCode(result.code);
      }, CELEBRATION_MS);
    },
    [onCode, onOffline],
  );

  // Si cierran la cámara a mano mientras corre la celebración, el código leído
  // se descarta: no queremos importar una playlist que acaban de cancelar. La
  // limpieza va atada a `visible` para que salte también al cerrar, no solo al
  // desmontar (el escáner se queda montado entre aperturas).
  useEffect(
    () => () => {
      if (celebrationRef.current) {
        clearTimeout(celebrationRef.current);
        celebrationRef.current = null;
      }
    },
    [visible],
  );

  const handleScan = useCallback(
    ({ data }: { data: string }) => {
      if (lockedRef.current) return;
      const result = parseScannedQr(data);
      if (!result) {
        showHint('Ese QR no es de la app');
        return;
      }
      const mismatch = describeMismatch(result, expected);
      if (mismatch) {
        showHint(mismatch);
        return;
      }
      if (result.kind === 'offline' && !onOffline) {
        showHint('Ese QR lleva la playlist entera; ábrelo con la cámara');
        return;
      }
      resolve(result);
    },
    [expected, onOffline, resolve, showHint],
  );

  if (!camera) return null;
  const { CameraView } = camera;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={false}
      statusBarTranslucent
      onRequestClose={onClose}
      onDismiss={onDismissed}
    >
      <View style={styles.root}>
        {granted === null ? (
          <View style={styles.center}>
            <ActivityIndicator color="#fff" size="large" />
          </View>
        ) : granted === false ? (
          <PermissionDenied onClose={onClose} />
        ) : (
          <>
            <CameraView
              style={StyleSheet.absoluteFill}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={handleScan}
            />

            {/* Penumbra alrededor del hueco: cuatro paneles en vez de una
                máscara, que es lo único que se ve igual en iOS, Android y web. */}
            <View style={styles.dimTop} />
            <View style={styles.dimRow} pointerEvents="box-none">
              <View style={styles.dimSide} />
              <View style={styles.frameSlot} pointerEvents="none">
                <QrScanFrame found={found} />
                {found ? (
                  <>
                    <CelebrationBurst visible emoji="🎉" emojiSize={54} />
                    <Animated.View
                      style={styles.check}
                      entering={ZoomIn.springify().damping(11)}
                    >
                      <MaterialIcons name="check" size={44} color="#fff" />
                    </Animated.View>
                  </>
                ) : null}
              </View>
              <View style={styles.dimSide} />
            </View>
            <View style={styles.dimBottom} />

            <Animated.View
              entering={FadeIn.delay(150)}
              style={[styles.header, { paddingTop: insets.top + 10 }]}
            >
              <Text style={styles.title}>
                {expected === 'choir'
                  ? 'Escanea el QR del coro'
                  : 'Escanea el QR de la playlist'}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  h.tap();
                  onClose();
                }}
                style={styles.closeBtn}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel="Cerrar el escáner"
              >
                <MaterialIcons name="close" size={26} color="#fff" />
              </TouchableOpacity>
            </Animated.View>

            <View
              style={[styles.footer, { paddingBottom: insets.bottom + 24 }]}
              pointerEvents="none"
            >
              {found ? (
                <Animated.Text
                  entering={ZoomIn.springify()}
                  style={styles.foundText}
                >
                  ¡Lo tengo! 🎶
                </Animated.Text>
              ) : hint ? (
                <Animated.Text
                  key={hint}
                  entering={FadeIn}
                  exiting={FadeOut}
                  style={styles.hintText}
                >
                  {hint}
                </Animated.Text>
              ) : (
                <Animated.Text entering={FadeIn.delay(400)} style={styles.help}>
                  Apunta al QR · se lee solo
                </Animated.Text>
              )}
            </View>
          </>
        )}
      </View>
    </Modal>
  );
};

/** Pantalla de "no hay permiso", con la salida a mano. */
function PermissionDenied({ onClose }: { onClose: () => void }) {
  return (
    <View style={styles.center}>
      <MaterialIcons name="no-photography" size={56} color="#8E8E93" />
      <Text style={styles.deniedTitle}>Sin acceso a la cámara</Text>
      <Text style={styles.deniedText}>
        Dale permiso a MCM App en los ajustes del móvil para escanear los QR. Si
        no, siempre puedes teclear el código de 4 dígitos.
      </Text>
      <TouchableOpacity onPress={onClose} style={styles.deniedBtn}>
        <Text style={styles.deniedBtnText}>Escribir el código</Text>
      </TouchableOpacity>
    </View>
  );
}

export default QrScannerModal;
