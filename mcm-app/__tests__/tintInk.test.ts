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
