/**
 * Estilos de `QrScannerModal`. Van aparte porque el escáner ya tiene bastante
 * lógica (permisos, antirrebote, animación de éxito) y la convención del
 * proyecto es no dejar crecer los archivos por encima de las 400 líneas.
 *
 * El escáner es siempre oscuro, en las dos apariencias: la cámara ocupa toda la
 * pantalla y un tema claro solo restaría contraste al marco.
 */
import { StyleSheet } from 'react-native';
import { radii } from '@/constants/uiStyles';
import { FRAME_SIZE } from './QrScanFrame';
import colors from '@/constants/colors';
import typography from '@/constants/typography';

/** Penumbra que rodea el hueco de escaneo. */
const DIM = 'rgba(0,0,0,0.62)';

export const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },

  // --- Penumbra en cuatro paneles (arriba / fila central / abajo) ----------
  dimTop: {
    flex: 1,
    backgroundColor: DIM,
  },
  dimBottom: {
    flex: 1,
    backgroundColor: DIM,
  },
  dimRow: {
    flexDirection: 'row',
    height: FRAME_SIZE,
  },
  dimSide: {
    flex: 1,
    backgroundColor: DIM,
  },
  frameSlot: {
    width: FRAME_SIZE,
    height: FRAME_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // --- Éxito ---------------------------------------------------------------
  check: {
    position: 'absolute',
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: colors.green,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // --- Cabecera y pie ------------------------------------------------------
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingBottom: 12,
    gap: 12,
  },
  title: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    paddingHorizontal: 24,
    minHeight: 90,
    justifyContent: 'flex-end',
  },
  help: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 14.5,
    fontWeight: '600',
    textAlign: 'center',
  },
  hintText: {
    color: '#FFD8D6',
    fontSize: 14.5,
    fontWeight: '700',
    textAlign: 'center',
    backgroundColor: 'rgba(255,69,58,0.35)',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: radii.xl,
    overflow: 'hidden',
  },
  foundText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
  },

  // --- Permiso denegado ----------------------------------------------------
  deniedTitle: {
    color: '#F5F5F7',
    fontSize: 18,
    fontWeight: '700',
    marginTop: 6,
    textAlign: 'center',
  },
  deniedText: {
    color: '#AEAEB2',
    ...typography.subhead,
    lineHeight: 20,
    textAlign: 'center',
  },
  deniedBtn: {
    marginTop: 10,
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: radii.md,
    backgroundColor: colors.primary,
  },
  deniedBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
