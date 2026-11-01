// utils/comunica/documents.ts
//
// Los documentos de un perfil (plan 16), puro. Origen:
// `inc/stic-documents.php` (`sticpa_document_view_model`, la tarjeta y el
// orden), `sticpa_record_status_tone()` y `sticpa_record_date_line()`.

import type {
  DocumentDetail,
  DocumentSummary,
} from '@/services/comunica/contract';
import type { ChipTone } from '@/components/comunica/comun/theme';
import { documentKind } from './files';

const MONTHS = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

/** «25 de octubre de 2026» (`sticpa_record_date_line` con un día). */
export function longDate(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  return `${d} de ${MONTHS[m - 1]} de ${y}`;
}

/** Caducado si su fecha es ANTERIOR a hoy (hoy aún vale). Días de Madrid. */
export const isExpired = (
  doc: Pick<DocumentSummary, 'expiresOn'>,
  today: string,
): boolean => doc.expiresOn !== null && doc.expiresOn < today;

/**
 * Lo caducado al final; el resto, lo más reciente arriba (sin fecha, al
 * final de su grupo). Estable: a igualdad, como venían.
 */
export function sortDocuments<T extends DocumentSummary>(
  docs: readonly T[],
  today: string,
): T[] {
  return docs
    .map((d, i) => ({ d, i }))
    .sort((a, b) => {
      const ea = isExpired(a.d, today);
      const eb = isExpired(b.d, today);
      if (ea !== eb) return ea ? 1 : -1;
      const da = a.d.activeOn ?? '';
      const db = b.d.activeOn ?? '';
      return db.localeCompare(da) || a.i - b.i;
    })
    .map((x) => x.d);
}

/**
 * `sticpa_record_status_tone()`: el color de un estado por su CLAVE, neutro
 * ante la duda. Lo malo primero; una clave negada («not_paid») nunca es
 * verde.
 */
export function statusTone(key: string | null | undefined): ChipTone {
  const k = (key ?? '').trim().toLowerCase();
  if (!k) return 'neutral';
  const has = (roots: string[]) => roots.some((r) => k.includes(r));
  if (
    has([
      'cancel',
      'reject',
      'denied',
      'expired',
      'caducad',
      'failed',
      'error',
      'baja',
    ])
  ) {
    return 'negative';
  }
  if (/(^|[_\s-])(no|not|non|sin|un|des)([_\s-]|$)/.test(k)) return 'neutral';
  if (has(['confirm', 'accept', 'complet', 'paid', 'active', 'activ'])) {
    return 'positive';
  }
  if (has(['pending', 'pendient', 'draft', 'borrador', 'review', 'revision'])) {
    return 'warning';
  }
  return 'neutral';
}

/** El chip de la tarjeta: «Caducado» en rojo, o el estado con su tono. */
export function documentChip(
  doc: Pick<DocumentSummary, 'expiresOn' | 'status'>,
  today: string,
): { label: string; tone: ChipTone } | null {
  if (isExpired(doc, today)) return { label: 'Caducado', tone: 'negative' };
  if (!doc.status) return null;
  return { label: doc.status.label, tone: statusTone(doc.status.key) };
}

/** Lo que pinta la tarjeta (sin el nombre del archivo: está en la ficha). */
export function documentCard(doc: DocumentSummary, today: string) {
  return {
    kind: documentKind(doc.fileName),
    title: doc.name,
    line: doc.activeOn ? `Del ${longDate(doc.activeOn)}` : null,
    chip: documentChip(doc, today),
    expired: isExpired(doc, today),
    hasFile: !!doc.fileName,
  };
}

/** «Mis documentos» o «Documentos de Lucía» (`list_stic_documents.php`). */
export const documentsTitle = (childFirstName: string) =>
  childFirstName ? `Documentos de ${childFirstName}` : 'Mis documentos';

/** El vacío, en primera o tercera persona. */
export function documentsEmpty(childFirstName: string) {
  return childFirstName
    ? {
        title: `Todavía no hay documentos de ${childFirstName}`,
        subtitle:
          'Aquí guardas y descargas lo suyo: autorizaciones, certificados, justificantes.',
      }
    : {
        title: 'Todavía no tienes documentos',
        subtitle:
          'Aquí guardas y descargas lo tuyo: autorizaciones, certificados, justificantes.',
      };
}

/** El formulario de la ficha: nombre y descripción. */
export interface DocumentForm {
  name: string;
  description: string;
}

export const formOfDocument = (d: DocumentDetail): DocumentForm => ({
  name: d.name,
  description: d.description ?? '',
});

/** Solo lo que difiere de lo confirmado (`PATCH` manda solo eso). */
export function documentChanges(
  base: DocumentForm,
  form: DocumentForm,
): Partial<DocumentForm> {
  const out: Partial<DocumentForm> = {};
  if (form.name.trim() !== base.name.trim()) out.name = form.name.trim();
  if (form.description.trim() !== base.description.trim()) {
    out.description = form.description.trim();
  }
  return out;
}

/** El nombre vale: 1-200 caracteres (`DocumentFields` del contrato). */
export const nameProblem = (name: string): string | null =>
  !name.trim()
    ? 'Escribe un nombre para el documento.'
    : name.trim().length > 200
      ? 'El nombre es demasiado largo.'
      : null;

/** Por qué no se ha guardado, en palabras de persona. */
export function documentWriteErrorText(code: string, reason?: string): string {
  if (code === 'network') {
    return 'Sin conexión: no se ha guardado. Reinténtalo cuando tengas cobertura.';
  }
  if (code === 'crm_unavailable') {
    return 'El CRM no responde ahora mismo. Reinténtalo en un rato.';
  }
  if (code === 'validation') {
    if (reason === 'file_too_big') return 'Ese archivo pesa más de 4 MB.';
    if (reason === 'empty_file') return 'Ese archivo está vacío.';
    if (reason === 'bad_file_type') {
      return 'Ese tipo de archivo no se puede subir.';
    }
    return 'Revisa el nombre y el archivo.';
  }
  if (code === 'forbidden') return 'Este documento ya no está disponible.';
  if (code === 'unauthenticated') {
    return 'Tu sesión ha terminado. Vuelve a entrar.';
  }
  return 'No se ha podido guardar. Prueba otra vez.';
}
