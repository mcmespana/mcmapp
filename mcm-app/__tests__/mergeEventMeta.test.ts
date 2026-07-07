import { mergeEventMeta } from '@/utils/mergeEventMeta';
import type { EventConfig } from '@/constants/events';

// Base falsa: solo los campos que toca el merge (+ los obligatorios del tipo).
const base = {
  id: 'visitapapa26',
  title: 'Visita del Papa',
  tintColor: '#253883',
  bannerText: 'Banner original',
  status: 'active',
  firebasePrefix: 'activities/visitapapa26',
  sections: [],
} as unknown as EventConfig;

describe('mergeEventMeta', () => {
  it('sin meta remoto → devuelve la base sin tocar', () => {
    expect(mergeEventMeta(base, null)).toEqual(base);
    expect(mergeEventMeta(base, undefined)).toEqual(base);
    expect(mergeEventMeta(base, {} as never)).toEqual(base);
  });

  it('pisa título y bannerText cuando vienen no vacíos', () => {
    const merged = mergeEventMeta(base, {
      title: 'Visita Papa León XIV',
      bannerText: '¡Bienvenidos!',
    });
    expect(merged.title).toBe('Visita Papa León XIV');
    expect(merged.bannerText).toBe('¡Bienvenidos!');
    // No tocados:
    expect(merged.tintColor).toBe('#253883');
  });

  it('ignora strings vacíos o en blanco (conserva la base)', () => {
    const merged = mergeEventMeta(base, { title: '   ', bannerText: '' });
    expect(merged.title).toBe('Visita del Papa');
    expect(merged.bannerText).toBe('Banner original');
  });

  it('pisa tintColor solo si es hex #RRGGBB válido', () => {
    expect(mergeEventMeta(base, { tintColor: '#E15C62' }).tintColor).toBe(
      '#E15C62',
    );
    expect(mergeEventMeta(base, { tintColor: 'rojo' }).tintColor).toBe(
      '#253883',
    );
    expect(mergeEventMeta(base, { tintColor: '#FFF' }).tintColor).toBe(
      '#253883',
    );
  });

  it('pisa status solo con "active" o "archived"', () => {
    expect(mergeEventMeta(base, { status: 'archived' }).status).toBe(
      'archived',
    );
    expect(mergeEventMeta(base, { status: 'active' }).status).toBe('active');
    expect(mergeEventMeta(base, { status: 'loquesea' }).status).toBe('active');
  });

  it('recorta espacios de los valores aceptados', () => {
    const merged = mergeEventMeta(base, {
      title: '  Nuevo  ',
      tintColor: '  #ABCDEF  ',
    });
    expect(merged.title).toBe('Nuevo');
    expect(merged.tintColor).toBe('#ABCDEF');
  });

  it('no muta la base recibida', () => {
    const snapshot = { ...base };
    mergeEventMeta(base, { title: 'Otro' });
    expect(base).toEqual(snapshot);
  });
});
