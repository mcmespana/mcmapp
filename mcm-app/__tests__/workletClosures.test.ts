/**
 * Guardarraíl: un worklet no puede usar una variable de fuera en el VALOR POR
 * DEFECTO de un parámetro.
 *
 * El plugin de worklets lleva las variables de fuera al hilo de UI metiéndolas
 * en el cuerpo: `function f(a, b = FUERA) { const [FUERA] = this.__closure; … }`.
 * Los valores por defecto se evalúan ANTES del cuerpo, donde `FUERA` no existe
 * en el hilo de UI → ReferenceError → la app se cierra. En los tests de Jest
 * no se ve (allí el worklet corre como JS normal). Pasó el 2026-11-08 con
 * `rubberBand(…, factor = RUBBER_BAND)`: deslizar el calendario o el vídeo
 * flotante cerraba la app.
 *
 * Este test compila con el preset de Expo cada fichero que tiene worklets y
 * mira el código que de verdad se manda al hilo de UI.
 */
import fs from 'fs';
import path from 'path';
import { transformSync } from '@babel/core';

const ROOT = path.join(__dirname, '..');
const DIRS = ['app', 'components', 'hooks', 'contexts', 'utils'];

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
 * Del código de un worklet tal como lo emite el plugin, los nombres de sus
 * parámetros-con-valor-por-defecto que usan una variable de `__closure`.
 */
export function closureNamesInDefaults(workletCode: string): string[] {
  const m = workletCode.match(
    /^\(function [\w$]*\(([^)]*)\)\{const\[([^\]]*)\]=this\.__closure;/,
  );
  if (!m) return [];
  const params = m[1];
  const closure = m[2].split(',').map((s) => s.trim().replace(/:.*/, ''));
  const defaults = params
    .split(',')
    .filter((p) => p.includes('='))
    .map((p) => p.slice(p.indexOf('=') + 1));
  return closure.filter((name) =>
    defaults.some((d) => new RegExp(`\\b${name}\\b`).test(d)),
  );
}

describe('worklets sin variables de fuera en valores por defecto', () => {
  it('el detector reconoce el caso del crash', () => {
    expect(
      closureNamesInDefaults(
        '(function f(a,b=0,c=RUBBER){const[RUBBER]=this.__closure;return a;})',
      ),
    ).toEqual(['RUBBER']);
    expect(
      closureNamesInDefaults(
        '(function f(a,c){const[RUBBER]=this.__closure;return a;})',
      ),
    ).toEqual([]);
  });

  it('ningún worklet de la app lo hace', () => {
    const offenders: string[] = [];
    for (const dir of DIRS) {
      for (const file of walk(path.join(ROOT, dir))) {
        const src = fs.readFileSync(file, 'utf8');
        if (!src.includes('worklet')) continue;
        const out = transformSync(src, {
          filename: file,
          presets: ['babel-preset-expo'],
          babelrc: false,
          configFile: false,
          caller: { name: 'metro', platform: 'ios', bundler: 'metro' } as never,
        });
        const codes = [
          ...(out?.code ?? '').matchAll(
            /init_data=\{code:"((?:[^"\\]|\\.)*)"/g,
          ),
        ].map((x) => JSON.parse(`"${x[1]}"`) as string);
        for (const code of codes) {
          const bad = closureNamesInDefaults(code);
          if (bad.length) {
            offenders.push(
              `${path.relative(ROOT, file)}: ${bad.join(', ')} en ${code.slice(0, 80)}…`,
            );
          }
        }
      }
    }
    expect(offenders).toEqual([]);
  }, 120_000);
});
