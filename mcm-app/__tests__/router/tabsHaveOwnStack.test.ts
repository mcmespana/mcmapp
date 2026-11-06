/**
 * Guardarraíl: TODA pestaña de la barra tiene su propia pila (Stack).
 *
 * Una pestaña que es un fichero suelto (`app/(tabs)/algo.tsx`) no tiene pila,
 * así que no puede tener cabecera nativa ni botones de cristal (`Stack.Toolbar`)
 * y acaba pintando la suya a mano, distinta de las demás. Inicio fue la excepción
 * hasta que se movió a `(inicio)/`. Este test falla si alguien añade una pestaña
 * sin carpeta con `_layout.tsx` que monte un `Stack`.
 */
import fs from 'fs';
import path from 'path';
import { TABS_CONFIG } from '@/constants/tabsCatalog';
import { hrefForTab, routeNameForTab } from '@/utils/tabRoutes';

const TABS_DIR = path.join(__dirname, '..', '..', 'app', '(tabs)');

describe('cada pestaña tiene su propia pila', () => {
  it.each(TABS_CONFIG.map((tab) => [tab.name] as const))(
    '%s: carpeta con _layout.tsx que monta un Stack',
    (name) => {
      const layout = path.join(TABS_DIR, routeNameForTab(name), '_layout.tsx');
      expect(fs.existsSync(layout)).toBe(true);
      expect(fs.readFileSync(layout, 'utf8')).toMatch(/<Stack[\s>]/);
    },
  );

  it('no queda ningún fichero suelto de pestaña en app/(tabs)', () => {
    const sueltos = fs
      .readdirSync(TABS_DIR)
      .filter((f) => /\.(tsx|ts)$/.test(f) && f !== '_layout.tsx');
    expect(sueltos).toEqual([]);
  });
});

describe('routeNameForTab', () => {
  it('Inicio vive en el grupo (inicio); el resto, con su propio nombre', () => {
    expect(routeNameForTab('index')).toBe('(inicio)');
    expect(routeNameForTab('cancionero')).toBe('cancionero');
    expect(routeNameForTab('mas')).toBe('mas');
  });

  it('la URL de Inicio sigue siendo / (el grupo no añade nada)', () => {
    expect(hrefForTab('index')).toBe('/');
  });
});
