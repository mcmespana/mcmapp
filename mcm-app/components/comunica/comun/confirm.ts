// Confirmación nativa (`Alert`) que también funciona en web, donde `Alert`
// con botones no hace nada (react-native-web): allí, `window.confirm`.

import { Alert, Platform } from 'react-native';

export function confirmAction(
  title: string,
  message: string | undefined,
  actionLabel: string,
  destructive = false,
): Promise<boolean> {
  if (Platform.OS === 'web') {
    const w = globalThis as { confirm?: (m: string) => boolean };
    return Promise.resolve(
      w.confirm
        ? w.confirm([title, message].filter(Boolean).join('\n\n'))
        : true,
    );
  }
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
      {
        text: actionLabel,
        style: destructive ? 'destructive' : 'default',
        onPress: () => resolve(true),
      },
    ]);
  });
}
