/**
 * Candado: en `app/` no se monta ningún navegador «a mano».
 *
 * En expo-router 58 el estado de navegación se crea globalmente a partir de
 * las rutas de fichero. Un `createNativeStackNavigator` dentro de una pantalla
 * es un navegador que el router no conoce, y la app se cierra al abrirla
 * («A navigator received a missing, partial, or incompatible navigation
 * state», build 60). Lo correcto es una carpeta con `_layout.tsx` (`Stack` de
 * expo-router) y un fichero por pantalla: ver `app/(tabs)/contigo/`.
 *
 * `PENDIENTES` es la migración en curso (`docs/planes/PLAN_EXPO_58.md`): los
 * ficheros que todavía lo hacen. Solo puede encogerse: un fichero nuevo con
 * un navegador a mano falla aquí, y uno migrado obliga a quitarse de la lista.
 * Cuando esté vacía, se borra la lista y queda la regla pelada.
 */
import fs from 'fs';
import path from 'path';

const APP = path.join(__dirname, '..', '..', 'app');

const PENDIENTES = ['app/(tabs)/cancionero.tsx'];

function ficheros(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return ficheros(p);
    return /\.(ts|tsx)$/.test(e.name) ? [p] : [];
  });
}

// Se busca el USO (import o llamada), no la mención en un comentario.
const USO = /^\s*(?:import[^;]*|.*=\s*)createNativeStackNavigator\b/m;

const culpables = ficheros(APP)
  .filter((f) => USO.test(fs.readFileSync(f, 'utf8')))
  .map((f) => path.relative(path.join(APP, '..'), f).split(path.sep).join('/'))
  .sort();

describe('nada monta un navegador a mano en app/', () => {
  it('no hay ficheros nuevos con createNativeStackNavigator', () => {
    const nuevos = culpables.filter((f) => !PENDIENTES.includes(f));
    expect(nuevos).toEqual([]);
  });

  it('los pendientes que ya se migraron salen de la lista', () => {
    const migrados = PENDIENTES.filter((f) => !culpables.includes(f));
    expect(migrados).toEqual([]);
  });
});
