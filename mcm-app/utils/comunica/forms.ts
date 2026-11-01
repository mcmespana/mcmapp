// utils/comunica/forms.ts
//
// El motor de formularios declarativo del área (plan 12, «El motor de
// formularios»): un formulario es una lista de secciones con sus campos, y de
// esa lista salen, sin React, qué se ve, qué ha cambiado y qué está mal. Lo
// pinta `components/comunica/comun/form/DeclarativeForm.tsx` con las piezas
// del plan 09. Declararlo así deja comprobar en un test que el orden y los
// textos son los del plugin.
//
// Los valores van en un registro plano con claves con punto
// (`contact.email`): qué significa cada clave lo decide quien declara el
// formulario (`personDetails.ts`), no el motor.

export type FormValue = string | boolean | null;
export type FormValues = Readonly<Record<string, FormValue>>;

export type FieldKind =
  | 'text'
  | 'email'
  | 'phone'
  | 'postalCode'
  | 'year'
  | 'date'
  | 'textarea'
  | 'select'
  | 'consent'
  | 'locked'
  | 'note';

export interface FieldSpec {
  key: string;
  kind: FieldKind;
  /** La etiqueta; en una nota, el texto (con `**negrita**`). */
  label: string;
  /** La ⓘ (párrafos con línea en blanco, `**negrita**`). */
  help?: string;
  /** La línea gris de debajo. */
  hint?: string;
  placeholder?: string;
  /** Se ve solo si… (el `data-visible-when` del plugin). */
  visibleWhen?: (values: FormValues) => boolean;
  /** De dónde salen las opciones de un desplegable. */
  optionsKey?: string;
  autoComplete?: string;
  maxLength?: number;
  /** Solo se enseña si lo confirmado ya tiene valor (soporte del DNI). */
  onlyIfPresent?: boolean;
  /** Una autorización: su «Ver condiciones»; una nota: su enlace. */
  url?: string;
  /** El texto del enlace de una nota. */
  urlLabel?: string;
  /** Un dato bloqueado: cómo se enseña (la fecha en lenguaje humano…). */
  format?: (value: FormValue) => string;
  /** Una nota con aspecto de aviso (el 📣 del plugin). */
  tone?: 'soft' | 'warning';
  /** Una comprobación más, propia del campo. */
  validate?: (value: FormValue, values: FormValues) => string | null;
}

export interface SectionSpec {
  id: string;
  title: string;
  fields: FieldSpec[];
}

/** Lo que no se edita: ni viaja ni se valida. */
const isEditable = (f: FieldSpec) => f.kind !== 'locked' && f.kind !== 'note';

/** Texto vacío y `null` son lo mismo («sin indicar»); el texto, recortado. */
export function normValue(v: FormValue | undefined): FormValue {
  if (v === undefined || v === null) return null;
  if (typeof v === 'boolean') return v;
  const t = v.trim();
  return t === '' ? null : t;
}

const hasValue = (v: FormValue | undefined) => normValue(v) !== null;

/** Los campos que se ven de una sección, con lo que hay ahora en pantalla. */
export function visibleFields(
  section: SectionSpec,
  values: FormValues,
  confirmed: FormValues = values,
): FieldSpec[] {
  return section.fields.filter(
    (f) =>
      (!f.visibleWhen || f.visibleWhen(values)) &&
      (!f.onlyIfPresent || hasValue(confirmed[f.key])),
  );
}

/**
 * Solo lo que cambia, contra lo CONFIRMADO. Un campo escondido (por la etapa)
 * conserva su valor y no viaja; una autorización sin tocar (`null`) tampoco:
 * solo viaja si en pantalla es `true` o `false` y no coincide.
 */
export function formChanges(
  spec: readonly SectionSpec[],
  confirmed: FormValues,
  draft: FormValues,
): Record<string, FormValue> {
  const out: Record<string, FormValue> = {};
  for (const section of spec) {
    for (const f of visibleFields(section, draft, confirmed)) {
      if (!isEditable(f)) continue;
      const now = normValue(draft[f.key]);
      if (f.kind === 'consent' && typeof now !== 'boolean') continue;
      if (now !== normValue(confirmed[f.key])) out[f.key] = now;
    }
  }
  return out;
}

/** El patrón del correo del plugin (`single_stic_comunica_perfil.php`). */
export const EMAIL_PATTERN =
  /^[a-zA-Z0-9.!#$%&’*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)+$/;

export const FORM_ERRORS = {
  email: 'Escribe un correo válido',
  postalCode: 'El código postal son cinco cifras',
  year: 'Escribe el año con cuatro cifras',
} as const;

/** El error de un valor según su tipo (vacío nunca es error: nada obliga). */
function kindError(f: FieldSpec, v: FormValue): string | null {
  if (typeof v !== 'string') return null;
  if (f.kind === 'email' && !EMAIL_PATTERN.test(v)) return FORM_ERRORS.email;
  if (f.kind === 'postalCode' && !/^\d{5}$/.test(v)) {
    return FORM_ERRORS.postalCode;
  }
  if (f.kind === 'year') {
    const n = Number(v);
    if (!/^\d{4}$/.test(v) || n < 1900 || n > 2100) return FORM_ERRORS.year;
  }
  return null;
}

/** Los errores de lo que se ve, por clave. Vacío = se puede guardar. */
export function validateForm(
  spec: readonly SectionSpec[],
  values: FormValues,
  confirmed: FormValues = values,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const section of spec) {
    for (const f of visibleFields(section, values, confirmed)) {
      if (!isEditable(f)) continue;
      const v = normValue(values[f.key]);
      const e =
        (v === null ? null : kindError(f, v)) ??
        f.validate?.(v, values) ??
        null;
      if (e) out[f.key] = e;
    }
  }
  return out;
}

/** `**negrita**` → trozos, para pintarlos sin HTML. */
export function boldParts(text: string): { text: string; bold: boolean }[] {
  return text
    .split(/(\*\*[^*]+\*\*)/)
    .filter(Boolean)
    .map((p) =>
      p.startsWith('**') && p.endsWith('**')
        ? { text: p.slice(2, -2), bold: true }
        : { text: p, bold: false },
    );
}
