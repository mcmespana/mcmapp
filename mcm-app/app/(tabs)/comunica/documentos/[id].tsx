// La ficha de un documento (plan 16).

import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import DocumentDetailScreen from '@/components/comunica/documentos/DocumentDetailScreen';

export default function ComunicaDocumento() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <DocumentDetailScreen id={String(id)} />;
}
