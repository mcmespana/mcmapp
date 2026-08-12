import { normalizeRoute, tramoTamano } from '@/constants/analyticsEvents';

describe('normalizeRoute', () => {
  it('deja las rutas normales tal cual', () => {
    expect(normalizeRoute('/(tabs)/cancionero')).toBe('/(tabs)/cancionero');
    expect(normalizeRoute('/(tabs)/contigo/evangelio')).toBe(
      '/(tabs)/contigo/evangelio',
    );
    expect(normalizeRoute('/notifications')).toBe('/notifications');
  });

  it('conserva los grupos de expo-router aunque lleven paréntesis', () => {
    expect(normalizeRoute('/(tabs)/index')).toBe('/(tabs)/index');
  });

  it('sustituye los ids numéricos', () => {
    expect(normalizeRoute('/albums/1234')).toBe('/albums/:id');
  });

  it('sustituye los uuid', () => {
    expect(normalizeRoute('/evento/3f2504e0-4f89-11d3-9a0c-0305e82c3301')).toBe(
      '/evento/:id',
    );
  });

  it('sustituye los segmentos largos, que casi siempre son un título', () => {
    // Sin esto, `pantalla_vista` tendría un valor distinto por canción y el
    // gráfico sería ilegible.
    expect(
      normalizeRoute('/cancionero/alabare-a-mi-senor-con-todo-mi-corazon'),
    ).toBe('/cancionero/:id');
  });

  it('sustituye los segmentos con codificación de URL', () => {
    expect(normalizeRoute('/cancionero/Oh%20Se%C3%B1or')).toBe(
      '/cancionero/:id',
    );
  });

  it('quita los parámetros de consulta', () => {
    expect(normalizeRoute('/(tabs)/mas?eventId=jubileo')).toBe('/(tabs)/mas');
  });

  it('aguanta la raíz y la cadena vacía', () => {
    expect(normalizeRoute('/')).toBe('/');
    expect(normalizeRoute('')).toBe('/');
  });
});

describe('tramoTamano', () => {
  it('agrupa por tramos en vez de mandar el número exacto', () => {
    expect(tramoTamano(1)).toBe('1-5');
    expect(tramoTamano(5)).toBe('1-5');
    expect(tramoTamano(6)).toBe('6-15');
    expect(tramoTamano(15)).toBe('6-15');
    expect(tramoTamano(16)).toBe('16-30');
    expect(tramoTamano(30)).toBe('16-30');
    expect(tramoTamano(31)).toBe('30+');
    expect(tramoTamano(500)).toBe('30+');
  });
});
