import { readFileSync } from 'fs';
import { join } from 'path';

// Las pantallas del stack de un evento llevan el header NATIVO transparente en
// iOS (`headerTransparent`, ver `eventStackScreens.tsx`). Un `ScreenHero` sin
// `floatingHeaderInset` se pinta DEBAJO de ese header: el título queda pisado
// por la hora y la isla dinámica (Apps y Profundiza salieron así a producción).
const EVENT_SCREENS = [
  'AppsScreen',
  'ContactosScreen',
  'GruposScreen',
  'HorarioScreen',
  'MaterialesScreen',
  'ProfundizaScreen',
  'ReflexionesScreen',
  'VisitasScreen',
];

describe('héroes de las pantallas de evento', () => {
  it.each(EVENT_SCREENS)(
    '%s: todo <ScreenHero> reserva el hueco del header (floatingHeaderInset)',
    (name) => {
      const src = readFileSync(
        join(__dirname, '..', 'app', 'screens', `${name}.tsx`),
        'utf8',
      );
      const heroes = src.match(/<ScreenHero\b[\s\S]*?\/>/g) ?? [];
      expect(heroes.length).toBeGreaterThan(0);
      for (const hero of heroes) {
        expect(hero).toMatch(/\bfloatingHeaderInset\b/);
      }
    },
  );
});
