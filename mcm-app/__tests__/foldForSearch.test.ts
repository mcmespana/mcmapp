import { foldForSearch } from '@/utils/songTags';

describe('foldForSearch', () => {
  it('quita tildes y pasa a minúsculas', () => {
    expect(foldForSearch('Señor, Jesús')).toBe('senor, jesus');
  });

  it('deja igual lo que ya está plegado', () => {
    expect(foldForSearch('pescador de hombres')).toBe('pescador de hombres');
  });

  it('casa la consulta sin tildes con el título con tildes', () => {
    expect(foldForSearch('Canción del Espíritu')).toContain(
      foldForSearch('cancion del espiritu'),
    );
  });
});
