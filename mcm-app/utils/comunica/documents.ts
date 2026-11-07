// utils/comunica/documents.ts
//
// «Documentos» (plan 16, `stic-documents.php`), lógica pura: el tipo de la cápsula, qué está caducado, el orden, el chip y los textos. Nada de React.
//
//   · Tipo por extensión (`documentKind`): JPEG→JPG, DOCX→DOC, XLSX→XLS…; sin extensión válida, `null` (icono de archivo).
//   · Orden: lo más reciente arriba y lo caducado al final y apagado. Caducado = `expiresOn` anterior a hoy (hora de Madrid, en la app).
//   · La tarjeta NO enseña el nombre del archivo. El chip: «Caducado» en rojo, o el estado con color por CLAVE (neutro ante la duda).

import type {
  DocumentDetail,
  DocumentSummary,
} from '@/services/comunica/contract';
import { fullDay } from './dates';
import { fileExtension } from './files';

export function documentKind(fileName: string | null): string | null {
  if (!fileName) return null;
  const ext = fileExtension(fileName);
  if (!ext) return null;
  const map: Record<string, string> = { jpeg: 'JPG', docx: 'DOC', xlsx: 'XLS' };
  return map[ext] ?? ext.toUpperCase();
}

export const isExpired = (
  d: Pick<DocumentSummary, 'expiresOn'>,
  today: string,
): boolean => !!d.expiresOn && d.expiresOn < today;

/** Lo más reciente primero (sin fecha, al final de lo vigente) y lo caducado al final. */
export function orderDocuments<T extends DocumentSummary>(
  docs: readonly T[],
  today: string,
): T[] {
  const byRecent = (a: T, b: T) =>
    a.activeOn === b.activeOn
      ? 0
      : !a.activeOn
        ? 1
        : !b.activeOn
          ? -1
          : a.activeOn > b.activeOn
            ? -1
            : 1;
  return [
    ...docs.filter((d) => !isExpired(d, today)).sort(byRecent),
    ...docs.filter((d) => isExpired(d, today)).sort(byRecent),
  ];
}

/** El nombre visible: el del documento y, si no lo tiene, el del archivo. */
export const documentTitle = (d: Pick<DocumentSummary, 'name' | 'fileName'>) =>
  d.name.trim() || d.fileName || 'Documento';

/** «Del 3 de octubre de 2026», si hay fecha. */
export const dateLine = (
  d: Pick<DocumentSummary, 'activeOn'>,
): string | null => (d.activeOn ? `Del ${fullDay(d.activeOn)}` : null);

export interface DocChip {
  label: string;
  tone: 'negative' | 'positive' | 'neutral';
}

/** «Caducado» en rojo; si no, el estado con su color por CLAVE (`Active` en verde, `Expired` en rojo, lo demás —y lo desconocido— neutro). */
export function documentChip(
  d: Pick<DocumentSummary, 'status' | 'expiresOn'>,
  today: string,
): DocChip | null {
  if (isExpired(d, today)) return { label: 'Caducado', tone: 'negative' };
  if (!d.status) return null;
  const key = d.status.key.toLowerCase();
  const tone =
    key === 'active' ? 'positive' : key === 'expired' ? 'negative' : 'neutral';
  return { label: d.status.label, tone };
}

/** Lo que difiere de lo confirmado: nombre y descripción (el archivo, aparte). `{}` = nada que mandar. */
export function documentChanges(
  confirmed: Pick<DocumentDetail, 'name' | 'description'>,
  draft: { name: string; description: string },
): { name?: string; description?: string } {
  const out: { name?: string; description?: string } = {};
  if (draft.name.trim() !== confirmed.name.trim()) out.name = draft.name.trim();
  if (draft.description.trim() !== (confirmed.description ?? '').trim())
    out.description = draft.description.trim();
  return out;
}

export const DOCUMENTS_TEXT = {
  titleOwn: 'Mis documentos',
  titleOf: (child: string) => `Documentos de ${child}`,
  titleOfNoName: 'Documentos del participante',
  emptyOwn: 'Todavía no tienes documentos',
  emptyOf: (child: string) => `Todavía no hay documentos de ${child}`,
  emptyOfNoName: 'Todavía no hay documentos del participante',
  emptyBodyOwn:
    'Aquí guardas y descargas lo tuyo: autorizaciones, certificados, justificantes.',
  emptyBodyOf:
    'Aquí se guarda y se descarga lo suyo: autorizaciones, certificados, justificantes.',
  upload: 'Subir un documento',
  needsConnection: 'Los documentos se ven con conexión',
  unavailable: 'Este documento ya no está disponible',
  unavailableBody: 'Vuelve al listado y entra de nuevo desde ahí.',
  back: 'Volver',
  openNeedsConnection: 'Necesitas conexión para abrir el documento',
  downloadFailed: 'No se ha podido descargar. Inténtalo otra vez.',
  uploaded: 'Documento subido',
  deleted: 'Documento eliminado',
  saved: 'Cambios guardados.',
  deleteTitle: 'Eliminar documento',
  deleteBody:
    '¿Seguro que quieres borrar este documento? No se puede deshacer.',
  paperHint:
    '¿Lo tienes en papel? Escanéalo con Notas o Archivos y elígelo aquí.',
  uploadNeedsConnection: 'Necesitas conexión para subir',
} as const;
