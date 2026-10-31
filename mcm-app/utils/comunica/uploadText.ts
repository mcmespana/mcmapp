// utils/comunica/uploadText.ts
//
// Lo que dice la barra de una lista mientras está en la cola (plan 01 §4):
// sin red sigue «guardada en el móvil» y sube sola; CRM caído se reintenta
// solo; atascada pide «Reintentar»; un rechazo dice por qué. Lo comparten la
// lista de un grupo (plan 04) y la de monitores (plan 06). Sin React.

import type { OutboxEntry } from '@/services/comunica/outbox';

export function uploadText(
  queued: Pick<OutboxEntry, 'status' | 'error'> | undefined,
): string {
  if (!queued) return '';
  if (queued.status === 'pending')
    return 'Guardado en el móvil. Se enviará solo al volver la cobertura.';
  if (queued.status === 'sending') return 'Guardando…';
  if (queued.status === 'stuck')
    return 'Comunica lleva un rato sin responder. Tus marcas siguen en el móvil: pulsa «Reintentar».';
  if (queued.error?.auto)
    return 'Comunica no responde ahora. Se volverá a intentar sola.';
  if (queued.error?.reason === 'session_in_future')
    return 'Esta sesión aún no ha llegado.';
  if (queued.error?.code === 'forbidden') return 'No tienes acceso a esto.';
  if (queued.error?.code === 'validation' && queued.error.message)
    return queued.error.message;
  return 'No se ha guardado. Tus marcas siguen aquí: vuelve a guardar.';
}
