#!/usr/bin/env node
/**
 * Sube a Firebase UNA pieza del pañuelo (o varias) del catálogo del repo
 * (`firebase-seed/panuelo.json`), sin tocar las demás:
 *
 *   npm run panuelo:subir -- <id> [<id>…]            pregunta antes de escribir
 *   npm run panuelo:subir -- <id> --dry-run          solo enseña lo que haría
 *   npm run panuelo:subir -- <id> --yes              sin preguntar
 *   npm run panuelo:subir -- <id> --export           deja el JSON de esa pieza
 *                                                    para importarlo a mano
 *
 * Escribe SOLO `/panuelo/data/items/<id>` (cada pieza) y luego
 * `/panuelo/updatedAt` con la hora de ahora (la app mira esa fecha para volver
 * a descargar el catálogo). **Nunca** escribe `/panuelo` ni `/panuelo/data`
 * enteros: no puede borrar una pieza que alguien añadió por otro lado. Antes
 * lee `/panuelo/data/items` para avisar de lo que va a sustituir y de las
 * piezas que hay en Firebase y no en el repo (no las toca).
 *
 * Usa la CLI de Firebase de quien lo lanza (`firebase login`, la misma con la
 * que se despliega): escribe como administrador y no lleva credenciales en el
 * repo. Funciona igual en Windows con Git Bash.
 *
 * El flujo entero (pedirle la pieza a la IA, el test del seed, este comando)
 * está en `docs/funcionalidades/PANUELO.md` («Asignar una pieza a un evento»).
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const readline = require('readline');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const SEED = path.join(ROOT, 'firebase-seed', 'panuelo.json');
const ITEMS_PATH = '/panuelo/data/items';
const UPDATED_AT_PATH = '/panuelo/updatedAt';
/** El id de una pieza (contrato): `kebab-case`, de 1 a 64 caracteres. */
const ID = /^[a-z0-9][a-z0-9-]{0,63}$/;

/** El proyecto de `.firebaserc` (el primero), si no se dice otro. */
function defaultProject() {
  try {
    const rc = JSON.parse(
      fs.readFileSync(path.join(ROOT, '.firebaserc'), 'utf8'),
    );
    return Object.values(rc.projects || {})[0] || null;
  } catch {
    return null;
  }
}

function parseArgs(argv) {
  const out = {
    ids: [],
    dryRun: false,
    yes: false,
    exportOnly: false,
    project: null,
    instance: null,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--dry-run') out.dryRun = true;
    else if (arg === '--yes' || arg === '-y') out.yes = true;
    else if (arg === '--export') out.exportOnly = true;
    else if (arg === '--project') out.project = argv[++i] || null;
    else if (arg === '--instance') out.instance = argv[++i] || null;
    else if (arg.startsWith('-')) throw new Error(`Opción desconocida: ${arg}`);
    else out.ids.push(arg);
  }
  out.ids = [...new Set(out.ids)];
  return out;
}

/** JSON con las claves ordenadas: para comparar sin que importe el orden. */
function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stable(value[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

/** Lo mínimo para no subir algo que la app descartaría. El resto lo vigila
 *  `__tests__/panueloSeed.test.ts`, que hay que pasar antes. */
function pieceProblem(piece) {
  if (!piece || typeof piece !== 'object') return 'no es un objeto';
  if (typeof piece.kind !== 'string') return 'le falta `kind`';
  if (typeof piece.name !== 'string' || !piece.name.trim())
    return 'le falta `name`';
  if (!piece.look || piece.look.kind !== piece.kind)
    return '`look.kind` no coincide con `kind`';
  const grant = piece.grant;
  if (grant && grant.type === 'attendance') {
    if (!Array.isArray(grant.events) || grant.events.length === 0)
      return 'una pieza por asistencia necesita `events`';
    if (piece.tradeable === true)
      return 'una pieza por asistencia no puede ser `tradeable`';
  }
  return null;
}

/**
 * Qué se va a escribir, sin escribir nada (puro: lo prueba
 * `__tests__/panueloSubir.test.ts`).
 *
 * `remote` es lo que hay en `/panuelo/data/items` (o `null` si no se pudo
 * leer). Las escrituras son SIEMPRE hojas de una pieza y la fecha: nada más.
 */
function planUpload(seedItems, ids, remote, now) {
  const errors = [];
  const notes = [];
  const writes = [];
  if (ids.length === 0) errors.push('Di qué pieza subir: su id.');
  for (const id of ids) {
    if (!ID.test(id)) {
      errors.push(`«${id}» no es un id de pieza (kebab-case, a-z, 0-9, -).`);
      continue;
    }
    const piece = seedItems[id];
    if (!piece) {
      errors.push(`«${id}» no está en firebase-seed/panuelo.json.`);
      continue;
    }
    const problem = pieceProblem(piece);
    if (problem) {
      errors.push(`«${id}»: ${problem}.`);
      continue;
    }
    if (remote && remote[id] !== undefined) {
      notes.push(
        stable(remote[id]) === stable(piece)
          ? `«${id}» ya está igual en Firebase (se vuelve a escribir igual).`
          : `«${id}» ya existe en Firebase y es distinta: se va a SUSTITUIR.`,
      );
    } else if (remote) {
      notes.push(`«${id}» es nueva en Firebase.`);
    }
    writes.push({ path: `${ITEMS_PATH}/${id}`, value: piece });
  }
  if (remote) {
    const extra = Object.keys(remote).filter((id) => !seedItems[id]);
    if (extra.length > 0) {
      notes.push(
        `En Firebase hay piezas que no están en el repo (no se tocan): ${extra.join(', ')}.`,
      );
    }
  }
  if (errors.length === 0) writes.push({ path: UPDATED_AT_PATH, value: now });
  // Guardarraíl: ni el catálogo entero ni nada fuera de él.
  for (const w of writes) {
    const ok =
      w.path === UPDATED_AT_PATH ||
      (w.path.startsWith(`${ITEMS_PATH}/`) &&
        ID.test(w.path.slice(ITEMS_PATH.length + 1)));
    if (!ok) throw new Error(`Escritura no permitida: ${w.path}`);
  }
  return { errors, notes, writes };
}

/** La CLI de Firebase. En Windows es `firebase.cmd`: hace falta la shell. */
function firebase(args) {
  const win = process.platform === 'win32';
  const quoted = win
    ? args.map((a) => (/[\s"]/.test(a) ? `"${a.replace(/"/g, '\\"')}"` : a))
    : args;
  return spawnSync('firebase', quoted, {
    encoding: 'utf8',
    shell: win,
    maxBuffer: 64 * 1024 * 1024,
  });
}

function scope(opts) {
  const out = [];
  if (opts.project) out.push('--project', opts.project);
  if (opts.instance) out.push('--instance', opts.instance);
  return out;
}

function readRemote(opts) {
  const res = firebase(['database:get', ITEMS_PATH, ...scope(opts)]);
  if (res.error || res.status !== 0) {
    const why = res.error
      ? res.error.code === 'ENOENT'
        ? 'no encuentro la CLI de Firebase (`npm install -g firebase-tools`)'
        : res.error.message
      : (res.stderr || res.stdout || '').trim().split('\n').pop();
    return { remote: null, why };
  }
  try {
    const parsed = JSON.parse(res.stdout || 'null');
    return { remote: parsed && typeof parsed === 'object' ? parsed : {} };
  } catch {
    return { remote: null, why: 'la respuesta no es JSON' };
  }
}

function ask(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) =>
    rl.question(question, (answer) => {
      rl.close();
      resolve(/^s(i|í)?$/i.test(answer.trim()));
    }),
  );
}

function log(line = '') {
  process.stdout.write(`${line}\n`);
}

async function main() {
  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (err) {
    log(err.message);
    return 1;
  }
  opts.project = opts.project || defaultProject();
  const seedItems = JSON.parse(fs.readFileSync(SEED, 'utf8')).items || {};

  if (opts.exportOnly) {
    const { errors } = planUpload(seedItems, opts.ids, null, 0);
    if (errors.length > 0) {
      errors.forEach((e) => log(`✖ ${e}`));
      return 1;
    }
    for (const id of opts.ids) {
      const file = path.resolve(`panuelo-${id}.json`);
      fs.writeFileSync(file, `${JSON.stringify(seedItems[id], null, 2)}\n`);
      log(`✔ ${file}`);
    }
    log('');
    log(
      'Para importarlo a mano en la consola de Firebase (Realtime Database):',
    );
    log(`  1. Entra en ${ITEMS_PATH} y añade un hijo con el id de la pieza.`);
    log('  2. En ESE hijo: ⋮ → «Importar JSON» → el fichero de arriba.');
    log(`  3. Cambia ${UPDATED_AT_PATH} a la hora de ahora (${Date.now()}).`);
    log('  ⚠ Nunca importes en /panuelo ni en /panuelo/data: borra el resto.');
    return 0;
  }

  log(`Proyecto: ${opts.project || '(el activo de la CLI)'}`);
  const { remote, why } = readRemote(opts);
  if (!remote) {
    log(`⚠ No se pudo leer ${ITEMS_PATH}: ${why}`);
    log('  ¿Has hecho `firebase login`?');
    if (!opts.dryRun) return 1;
    log('  (Simulación: sigo sin comparar con lo que hay arriba.)');
  }

  const plan = planUpload(seedItems, opts.ids, remote, Date.now());
  plan.notes.forEach((n) => log(`• ${n}`));
  if (plan.errors.length > 0) {
    plan.errors.forEach((e) => log(`✖ ${e}`));
    return 1;
  }
  log('');
  log('Se va a escribir:');
  for (const w of plan.writes) {
    log(
      `  ${w.path}  ←  ${w.path === UPDATED_AT_PATH ? w.value : w.value.name}`,
    );
  }
  if (opts.dryRun) {
    log('');
    log('Simulación (--dry-run): no se ha escrito nada.');
    return 0;
  }
  if (!opts.yes && !(await ask('\n¿Subir? (s/N) '))) {
    log('No se ha subido nada.');
    return 0;
  }

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'panuelo-'));
  try {
    for (const w of plan.writes) {
      const file = path.join(dir, 'valor.json');
      fs.writeFileSync(file, JSON.stringify(w.value));
      const res = firebase([
        'database:set',
        w.path,
        file,
        '--force',
        ...scope(opts),
      ]);
      if (res.error || res.status !== 0) {
        log(`✖ Falló al escribir ${w.path}:`);
        log((res.stderr || res.stdout || String(res.error)).trim());
        return 1;
      }
      log(`✔ ${w.path}`);
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  log('Listo. La app lo descarga la próxima vez que se abra el pañuelo.');
  return 0;
}

module.exports = { parseArgs, planUpload, stable };

if (require.main === module) {
  main().then((code) => process.exit(code));
}
