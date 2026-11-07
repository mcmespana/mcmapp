// utils/comunica/photo.ts
//
// La foto de perfil (plan 12), PURO: qué calidad pedirle al selector, si lo elegido vale ANTES de subirlo y qué se le dice a la persona cuando algo
// falla. El servidor (`PUT /v1/profiles/:pid/photo`) vuelve a mirar todo; aquí solo se evita ir y volver con una foto que se sabe mala.
//
//   · JPEG o PNG, más de 0 bytes y 4 MB como mucho (lo que cabe en una función de Vercel). El servidor no procesa la imagen: la app la manda ya
//     recortada en cuadrado.
//   · El recorte cuadrado lo hace el selector del sistema (`allowsEditing` + `aspect: [1, 1]`). El selector NO deja fijar el tamaño en píxeles
//     (ni 800×800 ni ningún otro): solo la calidad de compresión. Después `expo-image-manipulator` la reduce a 800×800 y la pasa a JPEG (1/11);
//     si ese paso fallara, la palanca es bajar la calidad un escalón cada vez que una foto se pasa: ver `PHOTO_QUALITIES`.

export const MAX_PHOTO_BYTES = 4 * 1024 * 1024;

/**
 * La calidad (0-1) que se pide al selector, de más a menos: la primera vez la primera; si la foto se pasa de 4 MB, la siguiente vez, la
 * siguiente. Para el JPEG de una cámara actual, 0,6 deja un cuadrado de unos 2 MB; los escalones de abajo son para móviles de muchos megapíxeles.
 */
export const PHOTO_QUALITIES = [0.6, 0.4, 0.2] as const;

/** La calidad del intento `attempt` (0 = el primero); pasado el último escalón, se queda en él. */
export function photoQuality(attempt: number): number {
  const i = Math.min(
    Math.max(Math.trunc(attempt) || 0, 0),
    PHOTO_QUALITIES.length - 1,
  );
  return PHOTO_QUALITIES[i];
}

/** ¿Queda un escalón más bajo después de este intento? */
export const hasLowerQuality = (attempt: number) =>
  attempt < PHOTO_QUALITIES.length - 1;

export type PhotoType = 'image/jpeg' | 'image/png';

/**
 * El tipo de la foto elegida: el que dice el selector (`image/jpg` también vale) o, si no lo dice, el de la extensión del nombre o de la ruta.
 * `null` si no es JPEG ni PNG (HEIC, GIF, WebP, SVG…).
 */
export function photoTypeOf(
  mimeType: string | null | undefined,
  nameOrUri: string | null | undefined,
): PhotoType | null {
  const mime = (mimeType ?? '').toLowerCase().trim();
  if (mime === 'image/jpeg' || mime === 'image/jpg') return 'image/jpeg';
  if (mime === 'image/png') return 'image/png';
  if (mime) return null;
  // Sin tipo: la extensión de lo que haya (una ruta puede traer `?consulta`).
  const m = /\.([A-Za-z0-9]{1,5})(?:[?#].*)?$/.exec(nameOrUri ?? '');
  const ext = m?.[1].toLowerCase();
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'png') return 'image/png';
  return null;
}

/** El nombre con el que se manda (el del selector puede ser un UUID sin extensión o traer caracteres raros). */
export const photoFileName = (type: PhotoType) =>
  type === 'image/png' ? 'foto.png' : 'foto.jpg';

export type PhotoProblem = 'empty' | 'too_big' | 'bad_type';

/** El problema de lo elegido antes de subirlo, o `null` si vale. */
export function photoProblem(file: {
  size: number;
  type: PhotoType | null;
}): PhotoProblem | null {
  if (file.type === null) return 'bad_type';
  if (!(file.size > 0)) return 'empty';
  if (file.size > MAX_PHOTO_BYTES) return 'too_big';
  return null;
}

export const PHOTO_PROBLEM_TEXT: Record<PhotoProblem, string> = {
  empty: 'La foto está vacía. Elige otra.',
  too_big: 'La foto pesa más de 4 MB.',
  bad_type: 'La foto tiene que ser JPG o PNG.',
};

/**
 * Lo que se dice cuando la foto se pasa de 4 MB. Si aún queda un escalón de calidad, se promete que la próxima vez se comprime más (es cierto:
 * `usePhotoUpload` lo baja); un PNG no se comprime (el selector ignora la calidad), así que ahí se pide otra foto.
 */
export function photoTooBigText(type: PhotoType | null, attempt: number) {
  if (type === 'image/png')
    return `${PHOTO_PROBLEM_TEXT.too_big} Un PNG no se puede comprimir: elige otra foto o hazla con la cámara.`;
  return hasLowerQuality(attempt)
    ? `${PHOTO_PROBLEM_TEXT.too_big} Elígela otra vez: ahora la comprimiremos más.`
    : `${PHOTO_PROBLEM_TEXT.too_big} Prueba con otra foto.`;
}

/** Por qué no ha subido la foto, en palabras de persona. */
export function photoErrorText(code: string, reason?: string): string {
  switch (code) {
    case 'network':
      return 'Sin conexión: la foto no se ha subido. Reinténtalo cuando tengas cobertura.';
    case 'crm_unavailable':
      if (reason === 'crm_timeout')
        return 'El CRM ha tardado en contestar. Puede que la foto ya esté guardada: vuelve a intentarlo.';
      if (reason === 'crm_not_confirmed')
        return 'No hemos podido confirmar que la foto se guardara. Vuelve a intentarlo.';
      if (reason === 'crm_not_configured')
        return 'Subir la foto no está disponible ahora mismo.';
      return 'El CRM no responde ahora mismo. Reinténtalo en un rato.';
    case 'validation':
      if (reason === 'file_too_big') return PHOTO_PROBLEM_TEXT.too_big;
      if (reason === 'bad_file_type') return PHOTO_PROBLEM_TEXT.bad_type;
      if (reason === 'empty_file') return PHOTO_PROBLEM_TEXT.empty;
      return 'No se ha podido enviar la foto. Prueba con otra.';
    case 'forbidden':
      return 'No tienes acceso a esto.';
    case 'unauthenticated':
      return 'Tu sesión ha terminado. Vuelve a entrar y súbela otra vez.';
    default:
      return 'No se ha podido subir la foto. Prueba otra vez.';
  }
}

/**
 * ¿Tiene sentido «Reintentar» con la misma foto y el mismo `clientId`? Sí si el fallo es de la red o del CRM (puede que ya esté guardada);
 * no si el servidor la ha rechazado por lo que es (tipo, tamaño, vacía) o si no hay acceso: ahí hay que elegir otra.
 */
export function photoRetryable(code: string): boolean {
  return !['validation', 'forbidden', 'unauthenticated'].includes(code);
}
