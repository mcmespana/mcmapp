/**
 * Guardarraíl: heroui-native no puede leer `Platform.constants.<algo>` a pelo.
 *
 * En react-native-web `Platform.constants` NO existe. heroui-native 1.1.1 lo
 * leía al cargar el módulo (`scroll-shadow.constants`) y la web entera se caía
 * al renderizar en servidor —`expo start --web` y el `expo export` de la web—
 * con «Cannot read properties of undefined (reading 'reactNativeVersion')».
 * Los tests de Jest no lo ven porque corren con el `Platform` de iOS.
 *
 * Lo tapa `patches/heroui-native+<versión>.patch` (`?.`). Si esto sale en
 * rojo tras subir heroui-native: o el parche ya no aplica (rehazlo con
 * `npx patch-package heroui-native`) o la versión nueva añade otro acceso sin
 * proteger. Arréglalo con un parche; no borres el test.
 */
import fs from 'fs';
import path from 'path';

const LIB = path.join(__dirname, '..', 'node_modules', 'heroui-native', 'lib');

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return walk(full);
    return e.name.endsWith('.js') ? [full] : [];
  });
}

describe('heroui-native en web', () => {
  it('no lee Platform.constants sin protegerlo (no existe en react-native-web)', () => {
    const offenders = walk(LIB)
      .filter((file) =>
        /Platform\.constants\.\w/.test(fs.readFileSync(file, 'utf8')),
      )
      .map((file) => path.relative(LIB, file));
    expect(offenders).toEqual([]);
  });
});
