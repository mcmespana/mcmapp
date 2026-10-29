// Elegir un archivo para subir (plan 09, `fotos-documentos` = sí): hacer una
// foto, elegirla de la galería o elegir un archivo. Devuelve lo elegido tal
// cual (sin recortar: el plugin dejaba las fotos de los títulos en cuadrado),
// o `null` si se cancela. Comprobarlo y subirlo es de `useDocumentUpload`.

import { Platform } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import type { FileSource } from '@/components/comunica/comun/form/FileField';

export interface PickedFile {
  uri: string;
  name: string | null;
  mimeType: string | null;
  size: number | null;
  /** En web, el `File` del navegador. */
  blob?: Blob;
}

export class PickerPermissionError extends Error {
  constructor() {
    super('Sin permiso para la cámara');
    this.name = 'PickerPermissionError';
  }
}

const IMAGE_OPTIONS: ImagePicker.ImagePickerOptions = {
  mediaTypes: ['images'],
  allowsEditing: false,
  // JPEG y no HEIC: en iOS, la representación «compatible».
  quality: 0.85,
  preferredAssetRepresentationMode:
    ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
  exif: false,
};

export async function pickFile(source: FileSource): Promise<PickedFile | null> {
  if (source === 'file') {
    const r = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'image/jpeg', 'image/png'],
      copyToCacheDirectory: true,
      multiple: false,
      base64: false,
    });
    const a = r.canceled ? null : r.assets[0];
    return a
      ? {
          uri: a.uri,
          name: a.name ?? null,
          mimeType: a.mimeType ?? null,
          size: a.size ?? a.file?.size ?? null,
          blob: Platform.OS === 'web' ? a.file : undefined,
        }
      : null;
  }
  if (source === 'camera' && Platform.OS !== 'web') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) throw new PickerPermissionError();
  }
  const r =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync(IMAGE_OPTIONS)
      : await ImagePicker.launchImageLibraryAsync(IMAGE_OPTIONS);
  const a = r.canceled ? null : r.assets[0];
  return a
    ? {
        uri: a.uri,
        name: a.fileName ?? null,
        mimeType: a.mimeType ?? null,
        size: a.fileSize ?? a.file?.size ?? null,
        blob: Platform.OS === 'web' ? a.file : undefined,
      }
    : null;
}
