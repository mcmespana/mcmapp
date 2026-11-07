// app/(tabs)/comunica/documentos/subir.tsx — «Subir un documento» (plan 16). Una hoja (`formSheet`); sin conexión, «Subir documento» apagado.

import React from 'react';
import DocumentUploadScreen from '@/components/comunica/documentos/DocumentUploadScreen';
import { isNetwork } from '@/components/comunica/comun/AreaState';
import { useActiveProfile } from '@/hooks/comunica/useActiveProfile';
import { useDocuments } from '@/hooks/comunica/useDocuments';

export default function ComunicaDocumentUpload() {
  const { active } = useActiveProfile();
  const q = useDocuments(active?.id);
  return <DocumentUploadScreen offline={isNetwork(q.error)} />;
}
