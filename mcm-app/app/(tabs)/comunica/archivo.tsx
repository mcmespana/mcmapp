// El visor de archivos (plan 16; lo usa también el 13 para los de un
// evento). Recibe un archivo YA bajado a la caché (`useOpenFile`), nunca una
// URL del servidor.

import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import FileViewerScreen from '@/components/comunica/comun/FileViewerScreen';

export default function ComunicaArchivo() {
  const { uri, name, mime } = useLocalSearchParams<{
    uri: string;
    name?: string;
    mime?: string;
  }>();
  return (
    <FileViewerScreen
      uri={String(uri ?? '')}
      name={String(name ?? '')}
      mime={String(mime ?? 'application/octet-stream')}
    />
  );
}
