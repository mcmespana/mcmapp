/**
 * Hueco de la barra de pestañas flotante al final de las pantallas.
 *
 * Desde agosto de 2026 la `CompactTabBar` FLOTA en iOS y en Android, pero
 * una docena de pantallas seguían con el patrón de cuando la barra de Android
 * era opaca —`paddingBottom: Platform.OS === 'ios' ? 100 : 24`—, así que en
 * Android la última canción de Seleccionadas, el último grupo, contacto o
 * elemento del horario quedaban debajo de la barra, sin poder pulsarlos.
 */
import fs from 'fs';
import path from 'path';

import { TAB_BAR_CLEARANCE } from '@/constants/spacing';
import { tabBarPaddingBottom } from '@/hooks/useTabBarClearance';

describe('tabBarPaddingBottom', () => {
  it('en iOS y Android reserva la barra más el safe-area inferior', () => {
    expect(tabBarPaddingBottom('ios', 34, 24)).toBe(TAB_BAR_CLEARANCE + 34);
    expect(tabBarPaddingBottom('android', 24, 24)).toBe(TAB_BAR_CLEARANCE + 24);
  });

  it('en web (la barra ocupa su sitio) deja el padding normal', () => {
    expect(tabBarPaddingBottom('web', 0, 24)).toBe(24);
  });
});

const ROOT = path.join(__dirname, '..');

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (/\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

/**
 * Un hueco grande (≥ 50) SOLO para iOS es el patrón viejo de "reservar la
 * barra", que en Android ya no vale. Usa `useTabBarPaddingBottom()` o
 * `useTabBarClearance()` (hooks/useTabBarClearance.ts).
 */
const IOS_ONLY_BAR_GAP = [
  /(padding|margin)Bottom:\s*Platform\.OS === 'ios'\s*\?\s*(\d{3}|[5-9]\d)\b/,
  /Platform\.OS === 'ios' && \{\s*(padding|margin)Bottom/,
];

describe('guardarraíl: nada de huecos de barra solo para iOS', () => {
  it.each(['app', 'components'])('%s/ no los tiene', (dir) => {
    const offenders: string[] = [];
    for (const file of walk(path.join(ROOT, dir))) {
      const lines = fs.readFileSync(file, 'utf8').split('\n');
      lines.forEach((line, i) => {
        if (IOS_ONLY_BAR_GAP.some((re) => re.test(line))) {
          offenders.push(`${path.relative(ROOT, file)}:${i + 1}`);
        }
      });
    }
    expect(offenders).toEqual([]);
  });
});
