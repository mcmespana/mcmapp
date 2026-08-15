/**
 * Mini-evaluador de reglas de la Realtime Database, SOLO para tests.
 *
 * `database.rules.json` no se puede probar sin desplegarlo (o sin levantar el
 * emulador, que necesita Java y red). Este módulo reimplementa la parte de la
 * semántica de RTDB que de verdad usamos, para poder afirmar en un test que
 * cada path que la app y el panel tocan de verdad está permitido — y, más
 * importante, que los que NO deben estarlo siguen denegados.
 *
 * Semántica reproducida (la documentada por Firebase):
 *
 *  1. **Resolución del path**: se camina segmento a segmento. En cada nivel
 *     gana el hijo con NOMBRE exacto; si no lo hay, se usa el comodín `$var`
 *     (y se enlaza `$var` = segmento). Si no hay ninguno, se deja de bajar.
 *  2. **`.read`/`.write` CASCADEAN hacia abajo**: basta con que UNA regla del
 *     camino (la raíz incluida) sea cierta para conceder el acceso. Un `false`
 *     más abajo NO revoca un `true` de más arriba — de ahí que en el fichero
 *     real el `.read` de `activities` no pueda ser `true`.
 *  3. **`.validate` NO cascadea** y no se evalúa en los ancestros del path
 *     escrito, así que un `.validate` colgado del padre no valida los
 *     `update()` parciales de sus hijos. Por eso este evaluador solo mira
 *     `.read`/`.write`: replicar `.validate` daría una falsa sensación de
 *     cobertura.
 *
 * Las expresiones se interpretan con un parser diminuto que SOLO entiende las
 * formas que usa el fichero. Cualquier otra revienta a propósito: si alguien
 * mete una expresión nueva, el test falla en vez de aprobarla en silencio.
 */

import fs from 'fs';
import path from 'path';

export type RuleValue = boolean | string;
export interface RuleNode {
  [key: string]: RuleNode | RuleValue;
}

export interface RulesContext {
  /** Usuario autenticado, o null si es un cliente anónimo (app sin login, panel). */
  auth?: { uid: string } | null;
  /** Contenido del nodo `/_config` (los interruptores). */
  config?: Record<string, boolean>;
  /** uids que tienen `users/<uid>/isAdmin === true` en la base de datos. */
  admins?: string[];
}

/** Lee y parsea `database.rules.json` quitándole los comentarios estilo JS. */
export function loadRules(
  file = path.join(__dirname, '..', '..', 'database.rules.json'),
): RuleNode {
  const raw = fs.readFileSync(file, 'utf8');
  const stripped = raw.replace(/\/\*[\s\S]*?\*\//g, '');
  const parsed = JSON.parse(stripped) as { rules: RuleNode };
  if (!parsed.rules) throw new Error('El fichero de reglas no tiene "rules"');
  return parsed.rules;
}

function isRuleNode(value: unknown): value is RuleNode {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Evalúa una expresión de regla. Soporta exactamente las formas del fichero:
 *   - `true` / `false` (booleanos del JSON)
 *   - `root.child('a/b').val() === true`
 *   - `auth != null && auth.uid === $var`
 * Cualquier otra cosa lanza.
 */
export function evaluateExpression(
  expr: RuleValue,
  ctx: RulesContext,
  vars: Record<string, string>,
): boolean {
  if (typeof expr === 'boolean') return expr;

  const normalized = expr.trim();

  const rootChild = normalized.match(
    /^root\.child\('([^']+)'\)\.val\(\) === true$/,
  );
  if (rootChild) {
    const key = rootChild[1].replace(/^_config\//, '');
    if (key.includes('/')) {
      throw new Error(`Bandera de _config anidada no soportada: ${expr}`);
    }
    return ctx.config?.[key] === true;
  }

  if (
    normalized ===
    "auth != null && root.child('users').child(auth.uid).child('isAdmin').val() === true"
  ) {
    return !!ctx.auth && (ctx.admins ?? []).includes(ctx.auth.uid);
  }

  const ownerMatch = normalized.match(
    /^auth != null && auth\.uid === (\$\w+)$/,
  );
  if (ownerMatch) {
    const bound = vars[ownerMatch[1]];
    return !!ctx.auth && bound !== undefined && ctx.auth.uid === bound;
  }

  throw new Error(
    `Expresión de regla no reconocida por el evaluador de tests: ${expr}\n` +
      'Si es intencionada, añádele soporte en __tests__/helpers/rulesEngine.ts.',
  );
}

/**
 * ¿Está permitida la operación `op` sobre `targetPath`?
 *
 * `targetPath` es el path SIN barra inicial, tal cual se le pasa a `ref()`
 * (p. ej. `activities/visitapapa26/evaluacion/respuestas/device-1`).
 */
export function isAllowed(
  rules: RuleNode,
  targetPath: string,
  op: 'read' | 'write',
  ctx: RulesContext = {},
  /** `true` = la escritura borra el nodo. RTDB no valida los borrados. */
  deleting = false,
): boolean {
  const key = op === 'read' ? '.read' : '.write';
  const segments = targetPath.split('/').filter(Boolean);
  const vars: Record<string, string> = {};

  let node: RuleNode | null = rules;
  /** Nodo de reglas donde acaba el path, si se resolvió entero. */
  let leaf: RuleNode | null = rules;
  const collected: RuleValue[] = [];

  const take = (n: RuleNode) => {
    const rule = n[key];
    if (typeof rule === 'boolean' || typeof rule === 'string') {
      collected.push(rule);
    }
  };

  take(node);

  for (const segment of segments) {
    if (!node) break;
    let next: RuleNode | null = null;

    // Anotado a mano: sin el tipo explícito, `node` se reasigna desde `next`,
    // que sale de `exact`, que sale de `node` — TS ve la circularidad y lo
    // infiere como `any` (TS7022).
    const exact: RuleNode | RuleValue | undefined = node[segment];
    if (isRuleNode(exact)) {
      next = exact;
    } else {
      // Comodín: en cada nivel puede haber como mucho uno.
      const wildcards = Object.keys(node).filter(
        (k) => k.startsWith('$') && isRuleNode(node![k]),
      );
      if (wildcards.length > 1) {
        throw new Error(
          `Varios comodines en el mismo nivel (${wildcards.join(', ')}): RTDB no lo permite`,
        );
      }
      if (wildcards.length === 1) {
        vars[wildcards[0]] = segment;
        next = node[wildcards[0]] as RuleNode;
      }
    }

    if (!next) {
      // Sin regla para este segmento: se deja de bajar, pero lo ya recogido
      // sigue valiendo (las reglas cascadean). El path no se resolvió entero,
      // así que no hay `.validate` que aplicar.
      node = null;
      leaf = null;
      break;
    }

    node = next;
    leaf = next;
    take(node);
  }

  const granted = collected.some((expr) => evaluateExpression(expr, ctx, vars));
  if (!granted || op === 'read') return granted;

  // `.validate` NO cascadea: solo cuenta el del path escrito (y el de los
  // descendientes del dato, que aquí no modelamos). Es la única forma de
  // cortar un `.write` heredado del padre — la usa `users/$uid/isAdmin`.
  // Los borrados no se validan.
  if (deleting || !leaf) return true;
  const validate = leaf['.validate'];
  if (typeof validate === 'boolean') return validate;
  if (typeof validate === 'string' && isPermissionExpression(validate)) {
    return evaluateExpression(validate, ctx, vars);
  }
  // Los `.validate` de FORMA (`newData.isString()`, longitud del nombre…) no
  // se modelan: este evaluador contesta "¿quién puede tocar esto?", no "¿el
  // dato es válido?". Para eso hace falta el emulador con datos de verdad.
  return true;
}

/**
 * ¿El `.validate` decide un PERMISO (mira quién escribe o el estado de la base)
 * o solo la forma del dato? Solo los primeros entran en este modelo.
 */
function isPermissionExpression(expr: string): boolean {
  return /\bauth\b|\broot\./.test(expr);
}
