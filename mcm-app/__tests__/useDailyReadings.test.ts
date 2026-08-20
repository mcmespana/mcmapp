/**
 * Tests de `useDailyReadings`: descarga y parsea las lecturas litúrgicas del
 * día desde `seccion_oracion/lecturas/<fecha>`. Lo importante que cubre este
 * test:
 *
 *  - El parseo por campo `activo`/`activoTexto`/`activoComentario` (cada
 *    lectura puede venir de una fuente distinta — dominicos vs vidaNueva vs
 *    vaticanNews — y el default es 'vidaNueva' si el campo no viene).
 *  - La caché local: se pinta lo cacheado al instante y se guarda lo nuevo
 *    tras la respuesta de Firebase.
 *  - El fallback a los bookmarks de CONTIGO si el día no está en la caché
 *    normal (un día guardado no debería "perder" sus lecturas al caducar el
 *    nodo global a los 30 días).
 *  - Un `dateStr` vacío no debe intentar nada (y no oculta el loading).
 */
import { renderHook, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { get } from 'firebase/database';
import { useDailyReadings } from '@/hooks/useDailyReadings';

jest.mock('@/utils/dailyReadingsCache', () => ({
  DAILY_READINGS_PREFIX: '@daily_readings_',
  pruneDailyReadingsCache: jest.fn(() => Promise.resolve(0)),
}));

const snapshot = (value: unknown) => ({
  exists: () => value !== null && value !== undefined,
  val: () => value,
});

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
});

describe('parseo de la fuente activa', () => {
  it('usa vidaNueva por defecto cuando no viene el campo `activo`', async () => {
    (get as jest.Mock).mockResolvedValueOnce(
      snapshot({
        evangelio: {
          vidaNuevaEvangelioTexto: 'En aquel tiempo...',
          vidaNuevaCita: 'Mt 5,1-12',
          vidaNuevaComentario: 'Comentario',
          vidaNuevaComentarista: 'P. Ejemplo',
          vidaNuevaURL: 'https://x',
        },
        lectura1: { vidaNuevaLectura1Texto: 'Texto L1', vidaNuevaCita: 'Is 1,1' },
        salmo: { vidaNuevaSalmoTexto: 'Salmo', vidaNuevaCita: 'Sal 1' },
      }),
    );
    const { result } = await renderHook(() => useDailyReadings('2026-08-20'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.readings?.evangelio).toEqual({
      texto: 'En aquel tiempo...',
      cita: 'Mt 5,1-12',
      comentario: 'Comentario',
      comentarista: 'P. Ejemplo',
      url: 'https://x',
    });
    expect(result.current.readings?.lectura1).toEqual({
      texto: 'Texto L1',
      cita: 'Is 1,1',
    });
  });

  it('respeta `activoTexto`/`activoComentario` cuando difieren entre sí', async () => {
    (get as jest.Mock).mockResolvedValueOnce(
      snapshot({
        evangelio: {
          activoTexto: 'dominicos',
          activoComentario: 'vaticanNews',
          dominicosEvangelioTexto: 'Texto de dominicos',
          dominicosCita: 'Jn 1,1',
          dominicosURL: 'https://dominicos',
          vaticanNewsComentario: 'Comentario Vatican News',
          vaticanNewsComentarista: 'Mons. X',
        },
      }),
    );
    const { result } = await renderHook(() => useDailyReadings('2026-08-21'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.readings?.evangelio).toEqual({
      texto: 'Texto de dominicos',
      cita: 'Jn 1,1',
      comentario: 'Comentario Vatican News',
      comentarista: 'Mons. X',
      url: 'https://dominicos',
    });
  });

  it('lectura2 y salmo/info admiten el genérico `<fuente>Texto` como fallback', async () => {
    (get as jest.Mock).mockResolvedValueOnce(
      snapshot({
        lectura2: { vidaNuevaTexto: 'Genérico L2', vidaNuevaCita: 'Rm 1,1' },
        info: { vidaNuevaDiaLiturgico: 'Miércoles', vidaNuevaTitulo: 'Título' },
      }),
    );
    const { result } = await renderHook(() => useDailyReadings('2026-08-22'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.readings?.lectura2).toEqual({
      texto: 'Genérico L2',
      cita: 'Rm 1,1',
    });
    expect(result.current.readings?.info).toEqual({
      diaLiturgico: 'Miércoles',
      titulo: 'Título',
    });
  });
});

describe('caché', () => {
  it('la respuesta de Firebase gana a lo cacheado y se vuelve a guardar', async () => {
    const cached = { evangelio: { texto: 'viejo', cita: '', comentario: '', comentarista: '', url: '' } };
    await AsyncStorage.setItem('@daily_readings_2026-08-23', JSON.stringify(cached));
    (get as jest.Mock).mockResolvedValueOnce(
      snapshot({
        evangelio: {
          vidaNuevaEvangelioTexto: 'nuevo',
          vidaNuevaCita: '',
          vidaNuevaComentario: '',
          vidaNuevaComentarista: '',
          vidaNuevaURL: '',
        },
      }),
    );
    const { result } = await renderHook(() => useDailyReadings('2026-08-23'));
    await waitFor(() =>
      expect(result.current.readings?.evangelio?.texto).toBe('nuevo'),
    );
    const stored = await AsyncStorage.getItem('@daily_readings_2026-08-23');
    expect(JSON.parse(stored!).evangelio.texto).toBe('nuevo');
  });

  it('cae a los bookmarks de CONTIGO si el día no está en la caché normal', async () => {
    await AsyncStorage.setItem(
      '@contigo_bookmarks',
      JSON.stringify([
        { date: '2026-08-24', readings: { info: { diaLiturgico: 'Lunes', titulo: 'De un bookmark' } } },
      ]),
    );
    (get as jest.Mock).mockResolvedValueOnce(snapshot(null));
    const { result } = await renderHook(() => useDailyReadings('2026-08-24'));
    await waitFor(() =>
      expect(result.current.readings?.info?.titulo).toBe('De un bookmark'),
    );
  });

  it('sin caché ni Firebase, readings queda en null', async () => {
    (get as jest.Mock).mockResolvedValueOnce(snapshot(null));
    const { result } = await renderHook(() => useDailyReadings('2026-08-25'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.readings).toBeNull();
  });
});

describe('errores y casos límite', () => {
  it('un fallo de Firebase se expone como error sin dejar isLoading colgado', async () => {
    (get as jest.Mock).mockRejectedValueOnce(new Error('sin red'));
    const { result } = await renderHook(() => useDailyReadings('2026-08-26'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBeInstanceOf(Error);
  });

  it('con dateStr vacío no intenta nada (y se queda cargando)', async () => {
    const { result } = await renderHook(() => useDailyReadings(''));
    expect(get).not.toHaveBeenCalled();
    expect(result.current.isLoading).toBe(true);
  });
});
