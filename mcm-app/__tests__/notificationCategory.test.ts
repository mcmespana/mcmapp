import { categoryVisual } from '@/utils/notificationCategory';

describe('categoryVisual', () => {
  it('devuelve null para "general", ausente o vacío', () => {
    expect(categoryVisual('general')).toBeNull();
    expect(categoryVisual(undefined)).toBeNull();
    expect(categoryVisual(null)).toBeNull();
    expect(categoryVisual('')).toBeNull();
  });

  it('devuelve null para categorías desconocidas (tolerante a futuras)', () => {
    expect(categoryVisual('inventada')).toBeNull();
    expect(categoryVisual(123 as never)).toBeNull();
  });

  it('devuelve etiqueta, color e icono para categorías conocidas', () => {
    const eventos = categoryVisual('eventos');
    expect(eventos).not.toBeNull();
    expect(eventos?.label).toBe('Eventos');
    expect(eventos?.icon).toBe('event');
    expect(eventos?.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });

  it('cubre todas las categorías con significado propio', () => {
    for (const cat of [
      'eventos',
      'cancionero',
      'fotos',
      'urgente',
      'mantenimiento',
      'celebraciones',
    ]) {
      const v = categoryVisual(cat);
      expect(v).not.toBeNull();
      expect(v?.label.length).toBeGreaterThan(0);
      expect(v?.icon.length).toBeGreaterThan(0);
      expect(v?.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });
});
