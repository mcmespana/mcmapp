/**
 * Visor a pantalla completa de los enlaces de una canción que NO son audio
 * embebido: partituras de Drive (`driveLinks`) y cualquier otra web o PDF
 * (`otherLinks`).
 *
 * Por qué a pantalla completa y no en el reproductor flotante: una partitura
 * hay que LEERLA mientras se toca; el PiP de `FloatingMediaPlayer` está pensado
 * para que la letra siga visible detrás, que es justo lo contrario.
 *
 * Spotify no pasa por aquí: no hay embed posible, sale de la app (ver
 * `SongMediaSheet`).
 */
import React from 'react';
import {
  ActivityIndicator,
  Linking,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { h } from '@/utils/haptics';
import { toDrivePreviewUrl } from '@/utils/googleDrive';
import typography from '@/constants/typography';

export interface SongLinkSource {
  /** 'drive' → documento de Drive · 'otro' → cualquier web o PDF. */
  kind: 'drive' | 'otro';
  url: string;
  label: string;
}

interface SongLinkViewerProps {
  source: SongLinkSource | null;
  onClose: () => void;
}

/**
 * URL que se carga dentro del visor. Para Drive es el endpoint `/preview`, que
 * es el que Google permite embeber; el enlace de compartir (`/view`) se niega a
 * pintarse en un iframe/WebView. Lo que no es Drive se carga tal cual.
 */
export function toViewerUrl(source: SongLinkSource): string {
  if (source.kind === 'drive') {
    return toDrivePreviewUrl(source.url) ?? source.url;
  }
  return source.url;
}

export default function SongLinkViewer({
  source,
  onClose,
}: SongLinkViewerProps) {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = React.useState(true);
  const [failed, setFailed] = React.useState(false);

  // Cada enlace arranca su propia carga: si no se resetea, el segundo que se
  // abre hereda el "ya cargado" (o el error) del anterior. Se ajusta DURANTE el
  // render (el patrón que documenta React para "resetear estado cuando cambia
  // una prop", el mismo que usa SongDetailScreen al cambiar de canción), no con
  // un efecto: así el enlace nuevo ya nace con su spinner en el primer render.
  const [lastUrl, setLastUrl] = React.useState(source?.url ?? null);
  if (lastUrl !== (source?.url ?? null)) {
    setLastUrl(source?.url ?? null);
    setLoading(true);
    setFailed(false);
  }

  if (!source) return null;

  const uri = toViewerUrl(source);

  const openOutside = async () => {
    h.tap();
    try {
      // Fuera de la app se abre el enlace ORIGINAL (el `/view` de Drive), que
      // es el que captura la app de Google Drive por universal link.
      await Linking.openURL(source.url);
    } catch {
      /* sin navegador ni app no hay nada que hacer */
    }
  };

  return (
    <Modal
      visible
      animationType="slide"
      onRequestClose={onClose}
      supportedOrientations={['portrait', 'landscape']}
    >
      <View style={styles.root}>
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={() => {
              h.tap();
              onClose();
            }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel="Cerrar"
          >
            <MaterialIcons name="close" size={24} color="#F5F5F7" />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {source.label}
          </Text>
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={openOutside}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel="Abrir fuera de la app"
          >
            <MaterialIcons name="open-in-new" size={21} color="#F5F5F7" />
          </TouchableOpacity>
        </View>

        <View style={styles.body}>
          {Platform.OS === 'web' ? (
            // @ts-ignore — iframe sólo existe en web
            <iframe
              src={uri}
              style={{
                width: '100%',
                height: '100%',
                border: 'none',
                display: 'block',
                backgroundColor: '#000',
              }}
              allowFullScreen
              title={source.label}
              onLoad={() => setLoading(false)}
              onError={() => {
                setLoading(false);
                setFailed(true);
              }}
            />
          ) : (
            <WebView
              source={{ uri }}
              style={styles.web}
              originWhitelist={['*']}
              allowsFullscreenVideo
              // Un PDF en Android no se pinta sin esto.
              allowFileAccess
              onLoadEnd={() => setLoading(false)}
              onError={() => {
                setLoading(false);
                setFailed(true);
              }}
            />
          )}

          {loading && !failed && (
            <View style={styles.overlay} pointerEvents="none">
              <ActivityIndicator size="large" color="#F5F5F7" />
            </View>
          )}

          {failed && (
            <View style={styles.overlay}>
              <MaterialIcons name="cloud-off" size={34} color="#8E8E93" />
              <Text style={styles.errorText}>
                No se ha podido mostrar aquí dentro.
              </Text>
              <TouchableOpacity
                style={styles.errorBtn}
                onPress={openOutside}
                accessibilityRole="button"
                accessibilityLabel="Abrir fuera de la app"
              >
                <MaterialIcons name="open-in-new" size={17} color="#0B0B0C" />
                <Text style={styles.errorBtnText}>Abrir fuera de la app</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0B0B0C',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingBottom: 10,
    backgroundColor: '#0B0B0C',
  },
  headerBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    ...typography.button,
    fontWeight: '700',
    letterSpacing: -0.2,
    color: '#F5F5F7',
    textAlign: 'center',
  },
  body: {
    flex: 1,
    backgroundColor: '#000',
  },
  web: {
    flex: 1,
    backgroundColor: '#000',
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: 'rgba(11,11,12,0.92)',
  },
  errorText: {
    ...typography.subhead,
    color: '#C7C7CC',
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  errorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingVertical: 9,
    paddingHorizontal: 15,
    borderRadius: 11,
    backgroundColor: '#F5F5F7',
  },
  errorBtnText: {
    ...typography.caption,
    fontWeight: '700',
    color: '#0B0B0C',
  },
});
