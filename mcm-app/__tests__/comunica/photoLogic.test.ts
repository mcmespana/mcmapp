/**
 * La foto de perfil (plan 12), lógica pura: la calidad que se pide al selector, si lo elegido vale ANTES de subirlo y qué se le dice a la persona.
 */
import {
  hasLowerQuality,
  MAX_PHOTO_BYTES,
  PHOTO_PROBLEM_TEXT,
  PHOTO_QUALITIES,
  photoErrorText,
  photoFileName,
  photoProblem,
  photoQuality,
  photoRetryable,
  photoTooBigText,
  photoTypeOf,
} from '@/utils/comunica/photo';

describe('la calidad que se pide al selector', () => {
  it('parte de la primera y baja un escalón por intento, sin pasarse del último', () => {
    expect(photoQuality(0)).toBe(PHOTO_QUALITIES[0]);
    expect(photoQuality(1)).toBe(PHOTO_QUALITIES[1]);
    expect(photoQuality(2)).toBe(PHOTO_QUALITIES[2]);
    expect(photoQuality(9)).toBe(PHOTO_QUALITIES[2]);
  });

  it('los escalones bajan de verdad y caen en (0, 1)', () => {
    for (let i = 1; i < PHOTO_QUALITIES.length; i++)
      expect(PHOTO_QUALITIES[i]).toBeLessThan(PHOTO_QUALITIES[i - 1]);
    for (const q of PHOTO_QUALITIES) {
      expect(q).toBeGreaterThan(0);
      expect(q).toBeLessThan(1);
    }
  });

  it('un intento raro (negativo, NaN) se trata como el primero', () => {
    expect(photoQuality(-3)).toBe(PHOTO_QUALITIES[0]);
    expect(photoQuality(Number.NaN)).toBe(PHOTO_QUALITIES[0]);
  });

  it('sabe si queda un escalón más bajo', () => {
    expect(hasLowerQuality(0)).toBe(true);
    expect(hasLowerQuality(PHOTO_QUALITIES.length - 2)).toBe(true);
    expect(hasLowerQuality(PHOTO_QUALITIES.length - 1)).toBe(false);
  });
});

describe('el tipo de la foto', () => {
  it('JPEG y PNG, por el tipo del selector (con `image/jpg` también)', () => {
    expect(photoTypeOf('image/jpeg', null)).toBe('image/jpeg');
    expect(photoTypeOf('IMAGE/JPG', 'x')).toBe('image/jpeg');
    expect(photoTypeOf('image/png', null)).toBe('image/png');
  });

  it('el tipo manda sobre el nombre: un HEIC con nombre .jpg no vale', () => {
    expect(photoTypeOf('image/heic', 'IMG_1.jpg')).toBeNull();
  });

  it('sin tipo, la extensión del nombre o de la ruta (con o sin consulta)', () => {
    expect(photoTypeOf(null, 'IMG_1.JPG')).toBe('image/jpeg');
    expect(photoTypeOf(undefined, 'file:///cache/a.jpeg?x=1')).toBe(
      'image/jpeg',
    );
    expect(photoTypeOf('', 'captura.png')).toBe('image/png');
  });

  it('lo demás no vale: HEIC, GIF, WebP, SVG, sin nada', () => {
    for (const t of ['image/heic', 'image/gif', 'image/webp', 'image/svg+xml'])
      expect(photoTypeOf(t, null)).toBeNull();
    expect(photoTypeOf(null, 'a.heic')).toBeNull();
    expect(photoTypeOf(null, 'sin-extension')).toBeNull();
    expect(photoTypeOf(null, null)).toBeNull();
  });

  it('se manda con un nombre fijo y su extensión', () => {
    expect(photoFileName('image/jpeg')).toBe('foto.jpg');
    expect(photoFileName('image/png')).toBe('foto.png');
  });
});

describe('lo elegido, antes de subir', () => {
  it('vale hasta 4 MB justos; 4 MB + 1 no', () => {
    expect(MAX_PHOTO_BYTES).toBe(4 * 1024 * 1024);
    expect(photoProblem({ size: MAX_PHOTO_BYTES, type: 'image/jpeg' })).toBe(
      null,
    );
    expect(
      photoProblem({ size: MAX_PHOTO_BYTES + 1, type: 'image/jpeg' }),
    ).toBe('too_big');
  });

  it('vacía, y de un tipo que no es', () => {
    expect(photoProblem({ size: 0, type: 'image/png' })).toBe('empty');
    expect(photoProblem({ size: 10, type: null })).toBe('bad_type');
    expect(photoProblem({ size: 10, type: 'image/png' })).toBeNull();
  });

  it('los textos son los de la pantalla', () => {
    expect(PHOTO_PROBLEM_TEXT.too_big).toBe('La foto pesa más de 4 MB.');
    expect(PHOTO_PROBLEM_TEXT.bad_type).toBe(
      'La foto tiene que ser JPG o PNG.',
    );
  });
});

describe('«pesa más de 4 MB»', () => {
  it('con escalones por bajar, promete comprimir más; sin ellos, pide otra foto', () => {
    expect(photoTooBigText('image/jpeg', 0)).toMatch(/comprimiremos más/);
    expect(photoTooBigText('image/jpeg', PHOTO_QUALITIES.length - 1)).toMatch(
      /otra foto/,
    );
  });

  it('un PNG no se comprime: pide otra, aunque queden escalones', () => {
    const t = photoTooBigText('image/png', 0);
    expect(t).toMatch(/PNG/);
    expect(t).not.toMatch(/comprimiremos/);
  });
});

describe('qué se le dice cuando falla la subida', () => {
  it('lo que rechaza el servidor', () => {
    expect(photoErrorText('validation', 'file_too_big')).toBe(
      'La foto pesa más de 4 MB.',
    );
    expect(photoErrorText('validation', 'bad_file_type')).toBe(
      'La foto tiene que ser JPG o PNG.',
    );
    expect(photoErrorText('validation', 'empty_file')).toMatch(/vacía/);
    expect(photoErrorText('validation', 'bad_body')).toMatch(/con otra/);
    expect(photoErrorText('validation')).toMatch(/con otra/);
  });

  it('el CRM: un timeout avisa de que puede estar guardada; cada motivo, el suyo', () => {
    expect(photoErrorText('crm_unavailable', 'crm_timeout')).toMatch(
      /ya esté guardada/,
    );
    expect(photoErrorText('crm_unavailable', 'crm_not_confirmed')).toMatch(
      /confirmar/,
    );
    expect(photoErrorText('crm_unavailable', 'crm_not_configured')).toMatch(
      /no está disponible/,
    );
    expect(photoErrorText('crm_unavailable', 'crm_error')).toMatch(
      /no responde/,
    );
    expect(photoErrorText('crm_unavailable')).toMatch(/no responde/);
  });

  it('red, acceso, sesión y lo desconocido', () => {
    expect(photoErrorText('network')).toMatch(/Sin conexión/);
    expect(photoErrorText('forbidden', 'profile_out_of_scope')).toMatch(
      /No tienes acceso/,
    );
    expect(photoErrorText('unauthenticated')).toMatch(/sesión/);
    expect(photoErrorText('internal')).toMatch(/No se ha podido subir/);
  });

  it('«Reintentar» solo cuando tiene sentido: red y CRM sí; lo rechazado por lo que es, no', () => {
    expect(photoRetryable('network')).toBe(true);
    expect(photoRetryable('crm_unavailable')).toBe(true);
    expect(photoRetryable('internal')).toBe(true);
    expect(photoRetryable('validation')).toBe(false);
    expect(photoRetryable('forbidden')).toBe(false);
    expect(photoRetryable('unauthenticated')).toBe(false);
  });
});
