/**
 * Test de `constants/iconAssets.ts`.
 *
 * Solo garantiza que el módulo se pueda importar (los `require()` de los PNG
 * no rompen) y que expone los iconos tanto agrupados como sueltos — es lo
 * único que hace este fichero, pero si un `require()` señala mal a un asset
 * borrado, Expo deja de incluir el icono en el bundle web sin avisar.
 */
import {
  iconAssets,
  icon120,
  icon152,
  icon167,
  icon180,
  icon192,
  icon512,
  favicon,
} from '@/constants/iconAssets';

describe('iconAssets', () => {
  it('expone los 6 tamaños de icono y el favicon agrupados', () => {
    expect(Object.keys(iconAssets).sort()).toEqual(
      [
        'icon120',
        'icon152',
        'icon167',
        'icon180',
        'icon192',
        'icon512',
        'favicon',
      ].sort(),
    );
  });

  it('cada export individual coincide con su entrada en iconAssets', () => {
    expect(iconAssets.icon120).toBe(icon120);
    expect(iconAssets.icon152).toBe(icon152);
    expect(iconAssets.icon167).toBe(icon167);
    expect(iconAssets.icon180).toBe(icon180);
    expect(iconAssets.icon192).toBe(icon192);
    expect(iconAssets.icon512).toBe(icon512);
    expect(iconAssets.favicon).toBe(favicon);
  });

  it('ningún asset es undefined', () => {
    Object.values(iconAssets).forEach((asset) => {
      expect(asset).toBeDefined();
    });
  });
});
