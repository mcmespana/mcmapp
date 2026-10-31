/**
 * Guardarraíl: toda pestaña con pila (carpeta `app/(tabs)/<tab>/` con más
 * pantallas que su portada) vuelve a la portada al re-tocar su pestaña.
 *
 * Con la barra del sistema oculta, el re-tap lo emite nuestra barra y cada
 * pestaña tiene que suscribirse (`useTabReselect` / `useTabReselectToRoot`).
 * Contigo y Comunica no lo hacían y el segundo toque no hacía nada (build 61).
 */
import fs from 'fs';
import path from 'path';

const TABS = path.join(__dirname, '..', '..', 'app', '(tabs)');

function rutas(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return rutas(p);
    return /\.tsx$/.test(e.name) && !e.name.startsWith('_') ? [p] : [];
  });
}

const conPila = fs
  .readdirSync(TABS, { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => e.name)
  .filter((tab) => rutas(path.join(TABS, tab)).length > 1);

it('hay pestañas con pila (si no, el test no prueba nada)', () => {
  expect(conPila).toEqual(
    expect.arrayContaining(['cancionero', 'contigo', 'mas', 'comunica']),
  );
});

it.each(conPila)('%s vuelve a su portada al re-tocar la pestaña', (tab) => {
  const layout = fs.readFileSync(path.join(TABS, tab, '_layout.tsx'), 'utf8');
  expect(layout).toMatch(/useTabReselect(ToRoot)?\(\s*'/);
});
