/**
 * `utils/tintInk` — tinta del hero de un evento y relleno del CTA de encuesta.
 *
 * Sustituyen los dos últimos umbrales de brillo a ojo (`> 175` en
 * EventHomeScreen, `> 200` en SurveyBanner) por contraste real. El caso que
 * lo destapó: con el verde del Jubileo, el umbral elegía texto blanco a 2,1:1.
 */
import brand from '@/constants/colors';
import { contrastRatio } from '@/utils/colorUtils';
import { eventHeroColors, fillForWhiteText } from '@/utils/tintInk';
import { JUBILEO, VISITAPAPA } from '@/constants/events';

describe('eventHeroColors', () => {
  it.each([
    ['amarillo (Visita Papa)', '#FCD200'],
    ['verde (Jubileo)', brand.green],
    ['celeste', brand.info],
  ])('tinte claro %s → tinta oscura legible', (_, tint) => {
    const c = eventHeroColors(tint);
    expect(c.tintIsLight).toBe(true);
    expect(contrastRatio(c.fg, tint)).toBeGreaterThanOrEqual(4.5);
    // El subtítulo es la misma tinta, apagada (0,72).
    expect(c.muted).toMatch(/^rgba\(28, 28, 30, 0\.72\)$/);
    expect(c.emblemBg).toBe('rgba(255, 255, 255, 0.50)');
  });

  it.each([
    ['azul MCM', brand.primary],
    ['morado', brand.purple],
    ['casi negro', '#1A1A1A'],
  ])('tinte oscuro %s → tinta blanca', (_, tint) => {
    const c = eventHeroColors(tint);
    expect(c.tintIsLight).toBe(false);
    expect(c.fg.toLowerCase()).toBe('#ffffff');
    expect(contrastRatio(c.fg, tint)).toBeGreaterThanOrEqual(4.5);
    expect(c.muted).toBe('rgba(255, 255, 255, 0.90)');
    expect(c.emblemBg).toBe('rgba(255, 255, 255, 0.16)');
  });

  it('los eventos reales salen legibles', () => {
    for (const ev of [JUBILEO, VISITAPAPA]) {
      const { fg } = eventHeroColors(ev.tintColor);
      expect(contrastRatio(fg, ev.tintColor)).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe('fillForWhiteText', () => {
  it('un acento donde el blanco se lee se queda', () => {
    expect(fillForWhiteText(brand.primary)).toBe(brand.primary);
    expect(fillForWhiteText(brand.purple)).toBe(brand.purple);
  });

  it.each([
    ['amarillo', brand.yellow],
    ['secundario', brand.secondary],
    ['verde', brand.green],
    ['celeste', brand.info],
  ])('un acento %s donde el blanco no se lee cae al azul', (_, accent) => {
    expect(fillForWhiteText(accent)).toBe(brand.primary);
  });

  it('respeta el fallback que se le pase', () => {
    expect(fillForWhiteText(brand.yellow, brand.purple)).toBe(brand.purple);
  });
});

describe('lema de los eventos', () => {
  it('solo la Visita del Papa tiene «Alzad la mirada»', () => {
    expect(VISITAPAPA.motto).toBe('Alzad la mirada');
    expect(JUBILEO.motto).toBeUndefined();
  });
});

describe('eventAccentColors (acentos de las pantallas de un evento)', () => {
  const { eventAccentColors } = jest.requireActual('@/utils/tintInk');
  const { contrastRatio } = jest.requireActual('@/utils/colorUtils');
  const PAGE_LIGHT = '#F8F9FA';
  const PAGE_DARK = '#000000';

  it.each([
    ['naranja (Congreso M+C)', '#F07C2B'],
    ['amarillo (Visita Papa)', '#FCD200'],
    ['verde (Jubileo)', '#A3BD31'],
    ['azul MCM', '#253883'],
    ['rojo MIC', '#E15C62'],
  ])(
    '%s: el blanco se lee sobre el relleno y el texto sobre la página',
    (_n, tint) => {
      const light = eventAccentColors(tint, PAGE_LIGHT);
      expect(contrastRatio('#FFFFFF', light.fill)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(light.text, PAGE_LIGHT)).toBeGreaterThanOrEqual(4.5);
      const dark = eventAccentColors(tint, PAGE_DARK);
      expect(contrastRatio(dark.text, PAGE_DARK)).toBeGreaterThanOrEqual(4.5);
    },
  );

  it('un tinte que ya es oscuro no se toca', () => {
    expect(eventAccentColors('#253883', PAGE_LIGHT).fill.toUpperCase()).toBe(
      '#253883',
    );
  });

  it('el naranja se oscurece lo justo, sin irse a negro', () => {
    const { fill } = eventAccentColors('#F07C2B', PAGE_LIGHT);
    expect(fill).not.toBe('#000000');
    expect(contrastRatio('#FFFFFF', fill)).toBeLessThan(6);
  });
});
