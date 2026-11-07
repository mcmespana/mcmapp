import { Alert, Platform } from 'react-native';

export interface ConfirmOptions {
  title: string;
  message: string;
  /** Texto del botón que confirma. */
  confirmLabel: string;
  /** Texto del botón que cancela. Por defecto «Cancelar». */
  cancelLabel?: string;
  /** Pinta el botón de confirmar como destructivo (rojo en iOS). */
  destructive?: boolean;
}

/**
 * Pide confirmación y devuelve `true` si la persona acepta.
 *
 * Multiplataforma: `Alert.alert` en nativo y `window.confirm` en web, porque
 * `Alert.alert` de react-native-web está vacío (no hace nada, y el gesto
 * destructivo se perdería sin aviso o, peor, se haría sin preguntar). Cerrar la
 * alerta de Android tocando fuera cuenta como cancelar.
 */
export function confirmAsync({
  title,
  message,
  confirmLabel,
  cancelLabel = 'Cancelar',
  destructive = false,
}: ConfirmOptions): Promise<boolean> {
  if (Platform.OS === 'web') {
    const ok =
      typeof window !== 'undefined' &&
      typeof window.confirm === 'function' &&
      window.confirm(`${title}\n\n${message}`);
    return Promise.resolve(!!ok);
  }
  return new Promise((resolve) => {
    Alert.alert(
      title,
      message,
      [
        { text: cancelLabel, style: 'cancel', onPress: () => resolve(false) },
        {
          text: confirmLabel,
          style: destructive ? 'destructive' : 'default',
          onPress: () => resolve(true),
        },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}
