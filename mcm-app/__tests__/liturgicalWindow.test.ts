/**
 * Candado de la ventana rodante del calendario litúrgico
 * (plan `plans/011-liturgical-json-window.md`).
 *
 * `components/contigo/LiturgicalBadge.tsx` importa el JSON de forma estática, así
 * que Metro lo inlinea en el bundle. La tabla completa son 2025→2100 (318 KB) y
 * las consultas solo tocan el año de la fecha mostrada: cada OTA descargaba y
 * cada arranque evaluaba ~300 KB inútiles. Ahora `assets/calendario-liturgico.json`
 * es una ventana de cinco años generada desde
 * `assets/calendario-liturgico-completo.json`.
 *
 * **El primer test es el que importa**: cuando la ventana esté a punto de
 * caducar, este fichero pone el CI en rojo con el comando exacto que hay que
 * correr. Sin él, el recorte caducaría en silencio y el badge se quedaría verde
 * ("Tiempo Ordinario", el fallback) para siempre.
 */
import liturgicalCalendar from '@/assets/calendario-liturgico.json';
import { getLiturgicalInfo } from '@/components/contigo/LiturgicalBadge';

const REGENERAR =
  'La ventana del calendario litúrgico ha caducado. Ejecuta ' +
  '`npm run liturgical:window` desde mcm-app/ y commitea ' +
  'assets/calendario-liturgico.json.';

const years = Object.keys(liturgicalCalendar as Record<string, unknown>);

describe('ventana del calendario litúrgico', () => {
  it('cubre el año actual y el siguiente', () => {
    const current = new Date().getFullYear();
    expect(years).toContain(String(current));
    expect(years).toContain(String(current + 1));
    if (!years.includes(String(current + 1))) throw new Error(REGENERAR);
  });

  it('cubre también el año anterior (enero consulta fechas de diciembre)', () => {
    const current = new Date().getFullYear();
    expect(years).toContain(String(current - 1));
  });

  it('no vuelve a arrastrar las siete décadas de la tabla completa', () => {
    // Si alguien reintroduce el JSON completo por error, esto lo caza.
    expect(years.length).toBeLessThanOrEqual(10);
    expect(years).not.toContain('2100');
  });

  it('una fecha del año actual devuelve un tiempo litúrgico real', () => {
    const current = String(new Date().getFullYear());
    const cal = (liturgicalCalendar as Record<string, any>)[current];
    // Tercer domingo de Adviento (Gaudete) del propio JSON: nada hardcodeado,
    // así el test sigue valiendo cuando la ventana avance.
    const gaudete: string | undefined = cal?.domingos_adviento?.[2];
    expect(typeof gaudete).toBe('string');

    const info = getLiturgicalInfo(gaudete!);
    expect(info.name).toBe('Adviento (Gaudete)');
    expect(info.name).not.toBe('Tiempo Ordinario');
  });

  it('una fecha FUERA de la ventana cae al fallback sin lanzar', () => {
    const info = getLiturgicalInfo('2099-06-15');
    expect(info.name).toBe('Tiempo Ordinario');
    expect(info.color).toBe('success');
  });
});
