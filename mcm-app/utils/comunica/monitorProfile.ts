// utils/comunica/monitorProfile.ts
//
// Las reglas de «Mis datos de monitor» (plan 09), sin React:
//
//   · El formulario y su vuelta: los textos vacíos son `null` («sin indicar»)
//     y «Monitor/a desde…» es un año de cuatro cifras (el 1 de enero que guarda
//     el CRM no se enseña nunca).
//   · Qué se manda: SOLO lo que difiere de lo último que confirmó el servidor.
//     Como en la cola gana la última, cada entrada lleva TODO lo pendiente, no
//     solo lo del último «Guardar» (si no, dos guardados sin cobertura
//     perderían el primero).
//   · El aviso del certificado (`stic-comunica-roles.php` l. 284-286).
//   · Qué archivo vale: PDF, JPG o PNG de hasta 6 MB (`stic-security.php`).

import type {
  DocumentKind,
  MonitorProfile,
  MonitorProfileEditable,
  MonitorProfileWrite,
} from '@/services/comunica/contract';

export type MonitorChanges = MonitorProfileWrite['changes'];
type Editable = MonitorProfileEditable;

/** La clave de la cola del `PATCH`: una sola, gana la última. */
export const MONITOR_OUTBOX_KEY = 'me.monitor';
export const MONITOR_OUTBOX_KIND = 'me-monitor';

// ── Etiquetas (las del CRM, `CAMPOS.md` § Monitores) ────────────────────────

export const MONITOR_OF_LABEL: Record<
  NonNullable<Editable['monitorOf']>,
  string
> = { mic: 'MIC', com: 'COM', lc: 'LC', apoyo: 'Apoyo', other: 'Otros' };

export const PRE_MONITOR_LABEL: Record<
  NonNullable<Editable['preMonitors1']>,
  string
> = { no: 'No', in_progress: 'En curso', finished: 'Finalizado' };

export const COURSE_LABEL: Record<NonNullable<Editable['mat']>, string> = {
  no: 'No',
  in_progress: 'En curso',
  internship: 'Prácticas',
  pending_certificate: 'Pendiente Título',
  certified: 'Titulado',
};

/** Las opciones de un `Record` de etiquetas, en su orden. */
export const optionsOf = <K extends string>(labels: Record<K, string>) =>
  (Object.keys(labels) as K[]).map((value) => ({
    value,
    label: labels[value],
  }));

// ── El formulario ───────────────────────────────────────────────────────────

/** Lo que se edita en pantalla: los textos como texto, el año también. */
export type MonitorForm = Omit<
  Editable,
  | 'monitorSince'
  | 'preMonitorsYear'
  | 'datYearAndSchool'
  | 'faYearAndSchool'
  | 'academicBackground'
  | 'volunteeringDescription'
  | 'volunteeringPrograms'
> & {
  monitorSince: string;
  preMonitorsYear: string;
  datYearAndSchool: string;
  faYearAndSchool: string;
  academicBackground: string;
  volunteeringDescription: string;
  volunteeringPrograms: string;
};

const TEXT_KEYS = [
  'preMonitorsYear',
  'datYearAndSchool',
  'faYearAndSchool',
  'academicBackground',
  'volunteeringDescription',
  'volunteeringPrograms',
] as const;

const EDITABLE_KEYS: readonly (keyof Editable)[] = [
  'monitorSince',
  'monitorOf',
  'preMonitors1',
  'preMonitors2',
  'preMonitorsYear',
  'mat',
  'matCourse',
  'dat',
  'fa',
  'datYearAndSchool',
  'faYearAndSchool',
  'foodHandling',
  'congresses',
  'academicBackground',
  'volunteeringDescription',
  'volunteeringPrograms',
  'sexOffenceCertificateMode',
];

/** Lo editable de una lectura (sin `generatedAt`, `files` ni `options`). */
export function editableOf(p: MonitorProfile): Editable {
  const out = {} as Record<string, unknown>;
  for (const k of EDITABLE_KEYS) out[k] = p[k];
  return out as Editable;
}

/** Lo confirmado, con lo que aún espera en la cola encima. */
export function withPending(
  confirmed: Editable,
  pending?: MonitorChanges | null,
): Editable {
  return pending ? { ...confirmed, ...pending } : confirmed;
}

export function formFrom(e: Editable): MonitorForm {
  const texts = Object.fromEntries(
    TEXT_KEYS.map((k) => [k, e[k] ?? '']),
  ) as Pick<MonitorForm, (typeof TEXT_KEYS)[number]>;
  return {
    ...e,
    ...texts,
    monitorSince: e.monitorSince === null ? '' : String(e.monitorSince),
  };
}

/**
 * «AAAA» → el año; vacío → `null`; cualquier otra cosa (`19`, `20199`,
 * letras) → `'invalid'`.
 */
export function yearFromText(text: string): number | null | 'invalid' {
  const t = text.trim();
  if (!t) return null;
  return /^\d{4}$/.test(t) ? Number(t) : 'invalid';
}

/** Lo que no deja guardar. Nada es obligatorio: solo el año mal escrito. */
export function formErrors(f: MonitorForm): { monitorSince?: string } {
  return yearFromText(f.monitorSince) === 'invalid'
    ? { monitorSince: 'Escribe el año con cuatro cifras (AAAA).' }
    : {};
}

/** El formulario de vuelta a la forma del contrato. Un año mal, `null`. */
export function editableFrom(f: MonitorForm): Editable {
  const year = yearFromText(f.monitorSince);
  const texts = Object.fromEntries(
    TEXT_KEYS.map((k) => [k, f[k].trim() ? f[k].trim() : null]),
  ) as Pick<Editable, (typeof TEXT_KEYS)[number]>;
  return {
    ...f,
    ...texts,
    monitorSince: year === 'invalid' ? null : year,
  };
}

const same = (a: unknown, b: unknown) => {
  if (Array.isArray(a) && Array.isArray(b)) {
    return (
      a.length === b.length &&
      [...a].sort().join('\u0000') === [...b].sort().join('\u0000')
    );
  }
  return a === b;
};

/**
 * Lo que difiere de lo confirmado. Los congresos se comparan como conjunto;
 * una casilla que nadie ha tocado (`null`) sigue en `null`.
 */
export function changesFrom(
  confirmed: Editable,
  next: Editable,
): MonitorChanges {
  const out: Record<string, unknown> = {};
  for (const k of EDITABLE_KEYS) {
    if (!same(confirmed[k], next[k])) out[k] = next[k];
  }
  return out as MonitorChanges;
}

/** ¿Hay algo en el formulario que no esté ni confirmado ni en la cola? */
export function isFormDirty(base: Editable, f: MonitorForm): boolean {
  return Object.keys(changesFrom(base, editableFrom(f))).length > 0;
}

// ── El certificado de delitos sexuales ──────────────────────────────────────

/**
 * ¿Sale el aviso? Si eligió «Manual» y no hay certificado. Uno que está
 * subiendo cuenta como en camino (el aviso se esconde, y vuelve si falla).
 */
export function isCertificatePending({
  mode,
  hasFile,
  uploading = false,
}: {
  mode: Editable['sexOffenceCertificateMode'];
  hasFile: boolean;
  uploading?: boolean;
}): boolean {
  return mode === 'manual' && !hasFile && !uploading;
}

export const CERTIFICATE_ALERT = {
  title: 'Te falta subir tu Certificado de Delitos Sexuales',
  text:
    'Elegiste presentarlo de forma manual y todavía no lo tenemos. Es ' +
    'obligatorio para las actividades con menores: súbelo cuando puedas (se ' +
    'renueva cada septiembre).',
  cta: 'Subir certificado',
} as const;

// ── Archivos ────────────────────────────────────────────────────────────────

export const DOCUMENT_MAX_BYTES = 6 * 1024 * 1024;

const TYPE_OF_EXTENSION: Record<string, string> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
};
const EXTENSION_OF_TYPE: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
};

export type FileProblem = 'empty' | 'too_big' | 'bad_type';

export const FILE_PROBLEM_TEXT: Record<FileProblem, string> = {
  empty: 'Ese archivo está vacío.',
  too_big: 'Ese archivo pesa más de 6 MB.',
  bad_type: 'Tiene que ser PDF, JPG o PNG.',
};

const extensionOf = (name: string) => {
  const m = /\.([A-Za-z0-9]{1,8})$/.exec(name.trim());
  return m ? m[1].toLowerCase() : null;
};

/**
 * Por qué no vale un archivo, o `null` si vale. Manda la extensión (es lo que
 * decide cómo lo abre quien lo descargue); sin extensión, el tipo. Una foto
 * HEIC del iPhone no vale.
 */
export function fileProblem(f: {
  name: string;
  size: number;
  mimeType?: string | null;
}): FileProblem | null {
  const ext = extensionOf(f.name);
  const type = (f.mimeType ?? '').toLowerCase();
  const typeOk = ext ? ext in TYPE_OF_EXTENSION : type in EXTENSION_OF_TYPE;
  if (!typeOk || type.includes('heic') || type.includes('heif')) {
    return 'bad_type';
  }
  if (!(f.size > 0)) return 'empty';
  if (f.size > DOCUMENT_MAX_BYTES) return 'too_big';
  return null;
}

/** Nombre y tipo listos para subir (la cámara a veces no da nombre). */
export function uploadNameAndType(
  kind: DocumentKind,
  name: string | null | undefined,
  mimeType: string | null | undefined,
): { name: string; mimeType: string } {
  const ext = name ? extensionOf(name) : null;
  if (name && ext && ext in TYPE_OF_EXTENSION) {
    return { name, mimeType: TYPE_OF_EXTENSION[ext] };
  }
  const fromType = EXTENSION_OF_TYPE[(mimeType ?? '').toLowerCase()];
  const base = (name ?? '').trim() || DEFAULT_NAME[kind];
  return fromType
    ? { name: `${base}.${fromType}`, mimeType: TYPE_OF_EXTENSION[fromType] }
    : { name: base, mimeType: mimeType ?? 'application/octet-stream' };
}

const DEFAULT_NAME: Record<DocumentKind, string> = {
  sex_offence_certificate: 'certificado-delitos-sexuales',
  mat: 'titulo-mat',
  dat: 'titulo-dat',
  other_training: 'certificado-formacion',
};

/** Tamaño legible: «2,4 MB», «640 KB». */
export function fileSizeText(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
  }
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** Por qué no ha subido un archivo, en palabras de persona. */
export function uploadErrorText(code: string, reason?: string): string {
  if (code === 'network') {
    return 'Sin conexión: no se ha subido. Reinténtalo cuando tengas cobertura.';
  }
  if (code === 'crm_unavailable') {
    return 'El CRM no responde ahora mismo. Reinténtalo en un rato.';
  }
  if (code === 'validation') {
    if (reason === 'file_too_big') return FILE_PROBLEM_TEXT.too_big;
    if (reason === 'bad_file_type') return FILE_PROBLEM_TEXT.bad_type;
    if (reason === 'empty_file') return FILE_PROBLEM_TEXT.empty;
  }
  if (code === 'unauthenticated') {
    return 'Tu sesión ha terminado. Vuelve a entrar y súbelo otra vez.';
  }
  if (code === 'forbidden') return 'Esta sección es para monitores.';
  return 'No se ha podido subir. Prueba otra vez.';
}
