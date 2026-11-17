// Compartir una foto del pañuelo. El visor 3D la saca (`snapshot`) como
// `data:image/jpeg;base64,…` y aquí se convierte en algo que el sistema sabe
// compartir: un archivo en la caché en el móvil, una descarga en web.

import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

const FILE_NAME = 'mi-panuelo-mcm.jpg';
const PREFIX = /^data:image\/jpeg;base64,/;

/** ¿Es la foto que esperamos? El visor es un WebView: no se da por bueno. */
export function isPanueloSnapshot(dataUrl: unknown): dataUrl is string {
  return typeof dataUrl === 'string' && PREFIX.test(dataUrl);
}

/** Abre la hoja de compartir (o descarga la imagen, en web). */
export async function sharePanueloSnapshot(dataUrl: string): Promise<void> {
  if (!isPanueloSnapshot(dataUrl)) return;
  if (Platform.OS === 'web') {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = FILE_NAME;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return;
  }
  const path = `${FileSystem.cacheDirectory}${FILE_NAME}`;
  await FileSystem.writeAsStringAsync(path, dataUrl.replace(PREFIX, ''), {
    encoding: FileSystem.EncodingType.Base64,
  });
  await Sharing.shareAsync(path, {
    mimeType: 'image/jpeg',
    dialogTitle: 'Compartir mi pañuelo',
    UTI: 'public.jpeg',
  });
}
