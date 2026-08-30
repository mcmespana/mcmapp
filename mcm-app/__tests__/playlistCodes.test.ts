/**
 * Tests de `utils/playlistCodes.ts`.
 *
 * Estos códigos de 4 dígitos son lo único que teclea a mano un usuario para
 * unirse a una sesión de coro o descargar una playlist compartida: si
 * `isValidCode` deja pasar algo mal formado, la petición a Firebase falla más
 * abajo con un error confuso en vez de un aviso claro en el propio input.
 */
import {
  CODE_LENGTH,
  CODE_REGEX,
  isValidCode,
  generateRandomCode,
  todayCode,
  nextChoirDate,
  defaultPlaylistName,
} from '@/utils/playlistCodes';

describe('isValidCode', () => {
  it('acepta exactamente 4 dígitos', () => {
    expect(isValidCode('1234')).toBe(true);
    expect(isValidCode('0000')).toBe(true);
  });

  it('rechaza longitudes distintas', () => {
    expect(isValidCode('123')).toBe(false);
    expect(isValidCode('12345')).toBe(false);
    expect(isValidCode('')).toBe(false);
  });

  it('rechaza caracteres no numéricos', () => {
    expect(isValidCode('12a4')).toBe(false);
    expect(isValidCode('abcd')).toBe(false);
    expect(isValidCode('12 4')).toBe(false);
  });
});

describe('CODE_REGEX / CODE_LENGTH', () => {
  it('la regex coincide con CODE_LENGTH dígitos', () => {
    expect(CODE_LENGTH).toBe(4);
    expect(CODE_REGEX.test('9876')).toBe(true);
  });
});

describe('generateRandomCode', () => {
  it('siempre devuelve CODE_LENGTH dígitos, con padding de ceros', () => {
    const spy = jest.spyOn(Math, 'random').mockReturnValue(0);
    expect(generateRandomCode()).toBe('0000');
    spy.mockRestore();
  });

  it('genera siempre un código válido según isValidCode', () => {
    for (let i = 0; i < 20; i++) {
      expect(isValidCode(generateRandomCode())).toBe(true);
    }
  });
});

describe('todayCode', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('usa DDMM recortado/rellenado a CODE_LENGTH', () => {
    jest.setSystemTime(new Date(2026, 3, 7)); // 7 de abril de 2026
    expect(todayCode()).toBe('0704');
  });

  it('rellena con ceros si la fecha compone menos de CODE_LENGTH', () => {
    jest.setSystemTime(new Date(2026, 0, 1)); // 1 de enero
    expect(todayCode()).toBe('0101');
  });
});

describe('nextChoirDate', () => {
  it('de lunes a viernes salta al sábado siguiente', () => {
    expect(nextChoirDate(new Date(2026, 3, 7)).getDate()).toBe(11); // martes → sábado 11 abr
    expect(nextChoirDate(new Date(2026, 0, 15)).getDate()).toBe(17); // jueves → sábado 17 ene
    expect(nextChoirDate(new Date(2026, 11, 25)).getDate()).toBe(26); // viernes → sábado 26 dic
  });

  it('si ya es sábado o domingo, se queda esa misma fecha', () => {
    const saturday = new Date(2026, 3, 11);
    const sunday = new Date(2026, 3, 12);
    expect(nextChoirDate(saturday)).toBe(saturday);
    expect(nextChoirDate(sunday)).toBe(sunday);
  });
});

describe('defaultPlaylistName', () => {
  it('formatea "Canciones <día> <mes abreviado>" con la fecha del próximo fin de semana', () => {
    expect(defaultPlaylistName(new Date(2026, 3, 7))).toBe('Canciones 11 abr'); // martes → sábado 11
  });

  it('usa el nombre correcto para cada mes', () => {
    expect(defaultPlaylistName(new Date(2026, 0, 15))).toBe(
      'Canciones 17 ene',
    );
    expect(defaultPlaylistName(new Date(2026, 11, 25))).toBe(
      'Canciones 26 dic',
    );
  });

  it('si ya es fin de semana, mantiene esa fecha', () => {
    expect(defaultPlaylistName(new Date(2026, 3, 11))).toBe(
      'Canciones 11 abr',
    ); // sábado
    expect(defaultPlaylistName(new Date(2026, 3, 12))).toBe(
      'Canciones 12 abr',
    ); // domingo
  });

  it('usa "ahora" por defecto si no se pasa fecha', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 5, 3)); // miércoles → sábado 6 jun
    expect(defaultPlaylistName()).toBe('Canciones 6 jun');
    jest.useRealTimers();
  });
});
