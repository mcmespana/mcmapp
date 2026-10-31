// El aviso del certificado en la portada «Hoy» (plan 09, regla 7): solo para
// quien tiene papel de monitor, con «Subir certificado» hacia «Mis datos de
// monitor». Cuesta una lectura más (`/v1/me/monitor`), que se guarda en el
// móvil; lo que espera en la cola (un cambio de modo) y lo que está subiendo
// cuentan, como en la pantalla.

import React from 'react';
import { useRouter } from 'expo-router';
import type { Me } from '@/services/comunica/contract';
import {
  useMyMonitorProfile,
  usePendingMonitorChanges,
} from '@/hooks/comunica/useMonitorProfile';
import { useUploadPhase } from '@/hooks/comunica/useDocumentUpload';
import { isCertificatePending } from '@/utils/comunica/monitorProfile';
import CertificatePendingAlert from './CertificatePendingAlert';

export default function HomeCertificateAlert({ me }: { me: Me | null }) {
  const router = useRouter();
  const isMonitor = !!me?.roles.includes('monitor');
  const q = useMyMonitorProfile(isMonitor);
  const { changes } = usePendingMonitorChanges();
  const phase = useUploadPhase('sex_offence_certificate');
  if (!isMonitor || !q.data) return null;
  const pending = isCertificatePending({
    mode:
      changes?.sexOffenceCertificateMode !== undefined
        ? changes.sexOffenceCertificateMode
        : q.data.sexOffenceCertificateMode,
    hasFile: q.data.files.sexOffenceCertificate || phase === 'applied',
    uploading: phase === 'sending',
  });
  if (!pending) return null;
  return (
    <CertificatePendingAlert
      onPress={() => router.push('/comunica/yo/monitor')}
    />
  );
}
