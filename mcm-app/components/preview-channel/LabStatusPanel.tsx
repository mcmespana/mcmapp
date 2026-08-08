import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type {
  ChannelDiagnostics,
  PreviewChannelStatus,
} from '@/contexts/PreviewChannelContext';
import type { UnsupportedReason } from '@/services/previewChannel';

/**
 * Panel de estado del Laboratorio Alpha.
 *
 * Existe porque la versión anterior se tragaba TODOS los errores en un
 * `logger.warn`: la palanca se movía, el pie ponía "· alpha" y el dispositivo
 * seguía tan campante en `production`. Sin señal en pantalla nadie podía
 * detectarlo. Aquí se cuenta siempre qué ha pasado y, sobre todo, en qué canal
 * está corriendo el bundle AHORA mismo.
 */

const UNSUPPORTED_COPY: Record<UnsupportedReason, string> = {
  web: 'En la versión web no hay actualizaciones OTA que cambiar. Esto solo funciona en la app de móvil.',
  dev: 'Estás en una build de desarrollo: los updates OTA no aplican aquí. Pruébalo en la app instalada desde la tienda.',
  disabled:
    'Esta instalación no tiene las actualizaciones OTA activadas, así que no hay canal que cambiar.',
  build:
    'Esta versión instalada es anterior al sistema de canales y no admite el cambio. Hará falta actualizar la app desde la tienda.',
};

function statusCopy(
  status: PreviewChannelStatus,
  enabled: boolean,
): {
  tone: 'info' | 'good' | 'bad';
  title: string;
  body?: string;
} | null {
  switch (status.kind) {
    case 'idle':
      return null;
    case 'switching':
      return {
        tone: 'info',
        title: 'Cambiando de canal y buscando novedades…',
      };
    case 'ready':
      return {
        tone: 'good',
        title: '¡Novedades descargadas!',
        body: `Reinicia para estrenar la versión ${enabled ? 'alpha' : 'estable'}.`,
      };
    case 'up-to-date':
      return {
        tone: 'good',
        title: enabled
          ? 'Ya estás en el canal alpha'
          : 'De vuelta al canal estable',
        body: 'Ahora mismo no hay nada nuevo que descargar. Las próximas novedades te llegarán solas.',
      };
    case 'offline':
      return {
        tone: 'info',
        title: 'Canal cambiado, pero sin conexión',
        body: 'No se ha podido comprobar si hay novedades. Se intentará de nuevo al abrir la app con datos.',
      };
    case 'unsupported':
      return {
        tone: 'bad',
        title: 'Aquí no se puede cambiar de canal',
        body: UNSUPPORTED_COPY[status.reason],
      };
    case 'error':
      return {
        tone: 'bad',
        title: 'No se ha podido cambiar de canal',
        body: status.message,
      };
  }
}

export function LabStatusPanel({
  status,
  enabled,
  diagnostics,
  onRestart,
}: {
  status: PreviewChannelStatus;
  enabled: boolean;
  diagnostics: ChannelDiagnostics;
  onRestart: () => void;
}) {
  const copy = statusCopy(status, enabled);
  const busy = status.kind === 'switching';

  return (
    <View style={styles.wrap}>
      {copy && (
        <View style={[styles.banner, TONE_STYLE[copy.tone]]}>
          <View style={styles.bannerTitleRow}>
            {busy && (
              <ActivityIndicator
                size="small"
                color="#FFFFFF"
                style={styles.spinner}
              />
            )}
            <Text style={styles.bannerTitle}>{copy.title}</Text>
          </View>
          {copy.body ? (
            <Text style={styles.bannerBody}>{copy.body}</Text>
          ) : null}
        </View>
      )}

      {status.kind === 'ready' && (
        <Pressable
          onPress={onRestart}
          style={({ pressed }) => [
            styles.restartButton,
            pressed && { transform: [{ scale: 0.97 }] },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Reiniciar la app para estrenar la versión descargada"
        >
          <Text style={styles.restartLabel}>🚀 REINICIAR Y ESTRENARLO</Text>
        </Pressable>
      )}

      {/*
        Diagnóstico honesto: `Updates.channel` es el canal del bundle que corre
        ahora, y NO refleja el override hasta reiniciar. Enseñar esa diferencia
        es lo que permite saber si el modo tester está surtiendo efecto de
        verdad, en vez de fiarse de la palanca.
      */}
      <View style={styles.diagBox}>
        <DiagRow
          label="canal en uso ahora"
          value={diagnostics.activeChannel ?? '—'}
        />
        <DiagRow
          label="canal tras reiniciar"
          value={
            enabled ? 'preview' : (diagnostics.activeChannel ?? 'production')
          }
        />
        <DiagRow label="runtime" value={diagnostics.runtimeVersion ?? '—'} />
        <DiagRow
          label="bundle"
          value={
            diagnostics.isEmbeddedLaunch
              ? 'el de la build (sin OTA aún)'
              : (diagnostics.updateId?.slice(0, 8) ?? '—')
          }
        />
      </View>
    </View>
  );
}

function DiagRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.diagRow}>
      <Text style={styles.diagLabel}>{label}</Text>
      <Text style={styles.diagValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const TONE_STYLE = StyleSheet.create({
  info: { backgroundColor: 'rgba(49, 170, 223, 0.85)' },
  good: { backgroundColor: 'rgba(89, 158, 45, 0.9)' },
  bad: { backgroundColor: 'rgba(157, 30, 116, 0.92)' },
});

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    maxWidth: 460,
    gap: 12,
  },
  banner: {
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    gap: 6,
  },
  bannerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  spinner: {
    marginRight: 8,
  },
  bannerTitle: {
    flexShrink: 1,
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  bannerBody: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 13,
    lineHeight: 19,
  },
  restartButton: {
    alignItems: 'center',
    paddingVertical: 16,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: 'rgba(0,0,0,0.15)',
  },
  restartLabel: {
    color: '#1A1230',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  diagBox: {
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(0,0,0,0.38)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    gap: 4,
  },
  diagRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  diagLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  diagValue: {
    flexShrink: 1,
    color: 'rgba(255,255,255,0.95)',
    fontSize: 12,
    fontWeight: '700',
    fontFamily: Platform.select({
      ios: 'Menlo',
      android: 'monospace',
      default: 'monospace',
    }),
  },
});
