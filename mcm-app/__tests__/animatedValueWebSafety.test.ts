/**
 * Candado: `useAnimatedValue` no se importa de `react-native`.
 *
 * React Native lo exporta desde la 0.71, pero **`react-native-web` no**: a día
 * de hoy (0.21.2) no está entre sus exports, así que en web el import se
 * resuelve a `undefined` y el componente revienta al renderizar con
 * «useAnimatedValue is not a function». No es teórico: se cazó el 2026-09-09
 * ejecutando la app en web, y afectaba a `BottomSheet` —y con él a CUALQUIER
 * hoja de la app en web— además de `TransposeBottomSheet`,
 * `ReaderSettingsSheet`, `CarismochitoDialogs` y `OTAUpdatePrompt`. Los tests
 * no lo veían porque `jest-expo` resuelve el preset nativo, y `tsc` tampoco,
 * porque los tipos de RN sí declaran el hook.
 *
 * El sustituto es `hooks/useAnimatedValue.ts`, que hace lo mismo con el
 * inicializador perezoso de `useState` y funciona igual en las dos
 * plataformas. Este test existe para que el import cómodo (el que sugiere el
 * autocompletado) no vuelva a colarse.
 *
 * Es el mismo fallo de familia que `tabsLayoutWebSafety.test.ts`: código que
 * también se empaqueta para web tocando algo que solo existe en nativo.
 */
import fs from 'fs';
import path from 'path';

const ROOT = path.join(__dirname, '..');

/** Todos los .ts/.tsx del proyecto, sin dependencias ni artefactos. */
function sourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (
      entry.name === 'node_modules' ||
      entry.name === '.expo' ||
      entry.name === 'dist' ||
      entry.name.startsWith('.')
    ) {
      continue;
    }
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      sourceFiles(full, acc);
    } else if (/\.tsx?$/.test(entry.name)) {
      acc.push(full);
    }
  }
  return acc;
}

describe('useAnimatedValue es seguro para web', () => {
  const files = sourceFiles(ROOT);

  it('nadie lo importa de react-native', () => {
    const culpables = files.filter((file) => {
      const code = fs.readFileSync(file, 'utf8');
      // Bloque `import { … } from 'react-native'` que incluya el hook.
      const imports = code.match(
        /import\s*\{[^}]*\}\s*from\s*'react-native'/gs,
      );
      return (imports ?? []).some((block) =>
        /\buseAnimatedValue\b/.test(block),
      );
    });

    expect(culpables.map((f) => path.relative(ROOT, f))).toEqual([]);
  });

  it('quien lo usa lo coge del hook propio', () => {
    const usuarios = files.filter(
      (file) =>
        !file.includes('__tests__') &&
        !file.endsWith(path.join('hooks', 'useAnimatedValue.ts')) &&
        /\buseAnimatedValue\s*\(/.test(fs.readFileSync(file, 'utf8')),
    );

    // Si esto sale vacío el test ha dejado de comprobar nada.
    expect(usuarios.length).toBeGreaterThan(0);

    for (const file of usuarios) {
      expect(fs.readFileSync(file, 'utf8')).toMatch(
        /from '@\/hooks\/useAnimatedValue'/,
      );
    }
  });

  it('el hook devuelve el MISMO Animated.Value en cada render', () => {
    // Es todo su contrato: si algún día se reescribe con `useMemo` (que React
    // puede descartar) o construyendo el valor en el cuerpo, la animación se
    // reinicia a mitad de gesto.
    const code = fs.readFileSync(
      path.join(ROOT, 'hooks', 'useAnimatedValue.ts'),
      'utf8',
    );
    expect(code).toMatch(/useState\(\(\)\s*=>\s*new Animated\.Value\(/);
  });
});
