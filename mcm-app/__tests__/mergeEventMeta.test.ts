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

  describe('logo del evento (heroImageUrl)', () => {
    const url =
      'https://firebasestorage.googleapis.com/v0/b/x/o/logo.webp?alt=media';

    it('una URL https se convierte en la imagen del hub', () => {
      const merged = mergeEventMeta(base, { heroImageUrl: `  ${url}  ` });
      expect(merged.heroImage).toEqual({ uri: url });
    });

    it('sin logo remoto conserva el heroImage del registry', () => {
      const withLogo = { ...base, heroImage: 4 } as unknown as EventConfig;
      expect(mergeEventMeta(withLogo, { title: 'X' }).heroImage).toBe(4);
    });

    it.each([
      ['http sin cifrar', 'http://example.com/logo.png'],
      ['otro esquema', 'javascript:alert(1)'],
      ['texto suelto', 'logo.png'],
      ['vacío', '   '],
      ['no es texto', 42],
    ])('ignora un valor inválido: %s', (_n, value) => {
      const merged = mergeEventMeta(base, { heroImageUrl: value as never });
      expect(merged.heroImage).toBeUndefined();
    });
  });

  describe('logo SVG (heroSvg)', () => {
    const svg =
      '<svg viewBox="0 0 10 10"><circle r="4" fill="currentColor"/></svg>';
    const url = 'https://example.com/logo.webp';

    it('un SVG seguro se aplica como logo del evento', () => {
      const merged = mergeEventMeta(base, { heroSvg: `  ${svg}  ` });
      expect(merged.heroSvg).toBe(svg);
      expect(merged.heroImage).toBeUndefined();
    });

    it('la imagen subida manda sobre el SVG', () => {
      const merged = mergeEventMeta(base, { heroImageUrl: url, heroSvg: svg });
      expect(merged.heroImage).toEqual({ uri: url });
      expect(merged.heroSvg).toBeUndefined();
    });

    it('un SVG remoto sustituye al heroImage del registry', () => {
      const withLogo = { ...base, heroImage: 4 } as unknown as EventConfig;
      const merged = mergeEventMeta(withLogo, { heroSvg: svg });
      expect(merged.heroImage).toBeUndefined();
      expect(merged.heroSvg).toBe(svg);
    });

    it('un SVG peligroso se ignora y se conserva lo que había', () => {
      const withLogo = { ...base, heroImage: 4 } as unknown as EventConfig;
      const merged = mergeEventMeta(withLogo, {
        heroSvg: '<svg><script>x()</script></svg>',
      });
      expect(merged.heroImage).toBe(4);
      expect(merged.heroSvg).toBeUndefined();
    });
  });
});
