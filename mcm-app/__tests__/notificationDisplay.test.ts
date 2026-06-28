/**
 * Tests de los helpers de presentación de notificaciones, extraídos de
 * NotificationsBottomSheet a components/notifications/notificationDisplay.ts.
 */
import {
  normalizeRoute,
  getRouteLabel,
  formatDate,
} from '@/components/notifications/notificationDisplay';

describe('normalizeRoute', () => {
  it('devuelve cadena vacía para entrada vacía', () => {
    expect(normalizeRoute('')).toBe('');
  });

  it('deja pasar las URLs http(s) sin tocar', () => {
    expect(normalizeRoute('https://mcm.es/a')).toBe('https://mcm.es/a');
    expect(normalizeRoute('http://x')).toBe('http://x');
  });

  it('respeta una ruta ya en forma /(tabs)/...', () => {
    expect(normalizeRoute('/(tabs)/calendario')).toBe('/(tabs)/calendario');
  });

  it('prefija /(tabs)/ a los nombres de tab pelados', () => {
    expect(normalizeRoute('cancionero')).toBe('/(tabs)/cancionero');
    expect(normalizeRoute('contigo/evangelio')).toBe(
      '/(tabs)/contigo/evangelio',
    );
  });

  it('trata las rutas no-tab como rutas de raíz', () => {
    expect(normalizeRoute('wordle')).toBe('/wordle');
    expect(normalizeRoute('/wordle')).toBe('/wordle');
  });

  it('colapsa barras duplicadas y recorta espacios', () => {
    expect(normalizeRoute('//(tabs)//mas')).toBe('/(tabs)/mas');
    expect(normalizeRoute('  calendario  ')).toBe('/(tabs)/calendario');
  });
});

describe('getRouteLabel', () => {
  it('resuelve etiqueta+icono desde un nombre de tab pelado', () => {
    expect(getRouteLabel('calendario')).toEqual({
      label: 'Calendario',
      icon: 'calendar-today',
    });
  });

  it('resuelve una ruta de raíz conocida', () => {
    expect(getRouteLabel('/wordle')).toEqual({
      label: 'Wordle',
      icon: 'games',
    });
  });

  it('devuelve null para rutas desconocidas', () => {
    expect(getRouteLabel('seccion-inexistente')).toBeNull();
  });
});

describe('formatDate', () => {
  it('"Ahora" para hace menos de un minuto', () => {
    expect(formatDate(new Date(Date.now() - 5_000))).toBe('Ahora');
  });

  it('minutos para hace menos de una hora', () => {
    expect(formatDate(new Date(Date.now() - 5 * 60_000))).toBe('Hace 5 min');
  });

  it('horas para hace menos de un día', () => {
    expect(formatDate(new Date(Date.now() - 2 * 3_600_000))).toBe('Hace 2 h');
  });

  it('días para hace menos de una semana', () => {
    expect(formatDate(new Date(Date.now() - 3 * 86_400_000))).toBe('Hace 3 d');
  });

  it('fecha absoluta para hace más de una semana', () => {
    const out = formatDate(new Date(Date.now() - 30 * 86_400_000));
    expect(typeof out).toBe('string');
    expect(out).not.toBe('Ahora');
    expect(out.startsWith('Hace')).toBe(false);
  });
});
