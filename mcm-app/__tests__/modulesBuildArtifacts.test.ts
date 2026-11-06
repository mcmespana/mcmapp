// Guardarraíl: los módulos nativos locales (`modules/*`) no pueden llevar
// commiteadas las salidas de Gradle/CMake.
//
// El 2026-11-05 se colaron 120 ficheros de `modules/highlight-menu/android/build/`
// (clases compiladas, cachés de Kotlin, manifiestos fusionados) en un commit.
// No rompen nada en runtime, pero meten ruido en cada merge, inflan el repo y
// el guard de OTA los toma por cambios nativos. Las fuentes (`android/src`,
// `build.gradle`, `ios/*.swift`…) SÍ van al repo: la regla de `.gitignore` es
// estrecha a propósito para no tragárselas.

import { execFileSync } from 'child_process';
import path from 'path';

const ROOT = path.resolve(__dirname, '..');

function trackedUnderModules(): string[] | null {
  try {
    const out = execFileSync('git', ['ls-files', '--', 'modules'], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return out.split('\n').filter(Boolean);
  } catch {
    // Sin git (un tarball, un entorno raro): no hay nada que comprobar.
    return null;
  }
}

describe('artefactos de build en modules/', () => {
  const tracked = trackedUnderModules();
  const maybe = tracked ? it : it.skip;

  maybe('ningún fichero de salida de Gradle/CMake está en git', () => {
    const artifacts = (tracked ?? []).filter((f) =>
      /\/(android|ios)\/(build|\.gradle|\.cxx)\//.test(f),
    );
    expect(artifacts).toEqual([]);
  });

  maybe('las fuentes nativas del módulo siguen trackeadas', () => {
    // Si alguien "arregla" el problema ignorando `android/` entero, este test
    // lo canta: el módulo llegó a EAS sin fuentes y la build reventó.
    const files = tracked ?? [];
    expect(files).toContain('modules/highlight-menu/android/build.gradle');
    expect(
      files.some((f) => f.startsWith('modules/highlight-menu/android/src/')),
    ).toBe(true);
    expect(files.some((f) => f.startsWith('modules/highlight-menu/ios/'))).toBe(
      true,
    );
  });
});
