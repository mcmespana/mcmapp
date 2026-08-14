/**
 * Contrato de `database.rules.json`.
 *
 * Cada caso es un path REAL que alguien toca hoy: la columna "quién" dice el
 * fichero y la línea de donde sale. Si mueves una escritura de sitio, este
 * test es el que se entera.
 *
 * Los tres escenarios que importan:
 *   - `FLAGS_ON`  → cómo queda el día del despliegue (banderas de `/_config`
 *     en `true`, que es lo que hay que sembrar ANTES de desplegar).
 *   - `FLAGS_OFF` → a dónde vamos: el panel con auth real y las funciones con
 *     credencial de servidor. Aquí se comprueba que lo privado queda cerrado.
 *   - Sin `/_config` → el escenario del olvido. Se documenta qué se rompe.
 */

import { isAllowed, loadRules, type RulesContext } from './helpers/rulesEngine';

const rules = loadRules();

/** Cliente anónimo (la app sin login, y el panel entero) con banderas puestas. */
const FLAGS_ON: RulesContext = {
  auth: null,
  config: { legacyPanelWrites: true, legacyNotificationsOpen: true },
};

/** El futuro: banderas apagadas. */
const FLAGS_OFF: RulesContext = {
  auth: null,
  config: { legacyPanelWrites: false, legacyNotificationsOpen: false },
};

/** El escenario del olvido: `/_config` no existe en la base de datos. */
const NO_CONFIG: RulesContext = { auth: null };

const ALICE: RulesContext = { ...FLAGS_ON, auth: { uid: 'alice' } };

const EV = 'activities/visitapapa26';
const DEVICE = 'device-abc';

function can(path: string, op: 'read' | 'write', ctx: RulesContext) {
  return isAllowed(rules, path, op, ctx);
}

// ─────────────────────────────────────────────────────────────────────────────
// LA APP — tiene que funcionar con las banderas en CUALQUIER estado.
// La app no depende de `/_config` para nada: si algo de aquí falla con
// FLAGS_OFF, es que hemos colado un permiso de la app dentro de una bandera.
// ─────────────────────────────────────────────────────────────────────────────

describe('app: lecturas públicas', () => {
  const reads: [string, string][] = [
    ['songs/data', 'CategoriesScreen / SongListScreen'],
    ['songs/updatedAt', 'useFirebaseData'],
    ['songs/tags/data', 'useSongTags — catálogo de etiquetas'],
    ['songs/tags/updatedAt', 'useSongTags'],
    ['albums/data', 'AlbumListScreen'],
    ['calendars/data', 'useCalendarConfigs'],
    ['profileConfig/data', 'ProfileConfigContext'],
    ['profileConfig/updatedAt', 'ProfileConfigContext'],
    ['seccion_oracion/lecturas/2026-08-13', 'useDailyReadings'],
    ['notifications', 'pushNotificationService'],
    ['activities/_meta/data', 'ActiveEventContext'],
    [`${EV}/_meta`, 'useEventsMeta'],
    [`${EV}/horario/data`, 'HorarioScreen'],
    [`${EV}/compartiendo/data`, 'ReflexionesScreen'],
    [`${EV}/evaluacion/data`, 'EvaluacionScreen'],
    [`${EV}/evaluacion/updatedAt`, 'useFirebaseData'],
    ['jubileo/materiales/data', 'MaterialesScreen'],
    ['jubileo/evaluacion/data', 'EvaluacionScreen (evento legacy)'],
    ['surveys/_index/data', 'useActiveSurveys'],
    ['surveys/enc1/data', 'SurveyScreen'],
    ['surveys/enc1/updatedAt', 'useFirebaseData'],
    ['app/evaluationConfig/data', 'EvaluacionAppScreen'],
    [`app/evaluations/${DEVICE}`, 'EvaluacionAppScreen (la suya)'],
    ['wordle/daily-words', 'useWordleWords'],
    ['wordle/stats', 'useWordleLeaderboard'],
    ['choirs', 'choirDirectoryService.listChoirs'],
    ['choirs/coro-1', 'choirDirectoryService.fetchChoir'],
    ['playlistShares/1234', 'cloudPlaylistService'],
    ['choirSessions/coro-1', 'choirSessionService'],
    [`pushTokens/${DEVICE}`, 'pushNotificationService (el suyo)'],
    [
      `${EV}/evaluacion/respuestas/${DEVICE}`,
      'EvaluacionScreen.checkSubmitted',
    ],
    [`surveys/enc1/respuestas/${DEVICE}`, 'SurveyScreen.checkSubmitted'],
  ];

  it.each(reads)('lee %s (%s) con las banderas puestas', (path) => {
    expect(can(path, 'read', FLAGS_ON)).toBe(true);
  });

  it.each(reads)('lee %s (%s) con las banderas APAGADAS', (path) => {
    expect(can(path, 'read', FLAGS_OFF)).toBe(true);
  });
});

describe('app: escrituras sin login', () => {
  const writes: [string, string][] = [
    ['songs/ediciones/-Nabc', 'SongDetailScreen'],
    ['songs/solicitudes/-Nabc', 'SuggestSongModal'],
    ['songs/fallitos/-Nabc', 'SongDetailScreen'],
    ['songs/fallitos/entrada/Titulo/-Nabc', 'ReportBugsModal'],
    [`${EV}/compartiendo/data/-Nabc`, 'ReflexionesScreen'],
    [`${EV}/compartiendo/updatedAt`, 'ReflexionesScreen'],
    [`${EV}/evaluacion/respuestas/${DEVICE}`, 'EvaluacionScreen'],
    // El que estaba roto: la app lo escribe y las reglas viejas lo denegaban.
    [`${EV}/evaluacion/updatedAt`, 'EvaluacionScreen:77'],
    ['jubileo/compartiendo/data/-Nabc', 'ReflexionesScreen (legacy)'],
    [`jubileo/evaluacion/respuestas/${DEVICE}`, 'EvaluacionScreen (legacy)'],
    ['jubileo/evaluacion/updatedAt', 'EvaluacionScreen (legacy)'],
    [`surveys/enc1/respuestas/${DEVICE}`, 'SurveyScreen'],
    ['surveys/enc1/updatedAt', 'SurveyScreen:95'],
    ['app/feedback/bug/-Nabc', 'AppFeedbackModal'],
    [`app/evaluations/${DEVICE}`, 'EvaluacionAppScreen'],
    [`pushTokens/${DEVICE}`, 'pushNotificationService.register'],
    [`pushTokens/${DEVICE}/lastActive`, 'pushNotificationService (heartbeat)'],
    ['wordle/stats/u1', 'useWordleStats'],
    ['wordle/users/u1', 'useWordleStats'],
    ['wordle/2026-08-13/1/-Nabc', 'useWordleStats'],
    ['wordle/2026-08-13/updatedAt', 'useWordleStats:83'],
    ['playlistShares/1234', 'cloudPlaylistService'],
    ['choirSessions/coro-1', 'choirSessionService.create'],
    ['choirSessions/coro-1/playlist', 'choirSessionService.publish'],
    ['choirSessions/coro-1/master/lastSeen', 'choirSessionService.publish'],
    ['choirs/coro-1', 'choirDirectoryService.createChoir'],
    ['choirs/coro-1/name', 'choirDirectoryService.renameChoir'],
    ['choirs/coro-1/playlists/1234', 'choirDirectoryService.upsertPlaylist'],
  ];

  it.each(writes)('escribe %s (%s) con las banderas puestas', (path) => {
    expect(can(path, 'write', FLAGS_ON)).toBe(true);
  });

  it.each(writes)('escribe %s (%s) con las banderas APAGADAS', (path) => {
    expect(can(path, 'write', FLAGS_OFF)).toBe(true);
  });
});

describe('app: datos del usuario autenticado', () => {
  it('el dueño lee y escribe su nodo', () => {
    expect(can('users/alice/contigo/habits/2026-08-13', 'read', ALICE)).toBe(
      true,
    );
    expect(can('users/alice/contigo/habits/2026-08-13', 'write', ALICE)).toBe(
      true,
    );
    expect(
      can('users/alice/surveysAnswered/survey_done_1', 'write', ALICE),
    ).toBe(true);
    expect(can('users/alice/isAdmin', 'read', ALICE)).toBe(true);
  });

  it('nadie lee el nodo de otro', () => {
    expect(can('users/bob/contigo/habits/2026-08-13', 'read', ALICE)).toBe(
      false,
    );
    expect(can('users/bob', 'write', ALICE)).toBe(false);
  });

  it('un anónimo no toca /users', () => {
    expect(can('users/alice', 'read', FLAGS_ON)).toBe(false);
    expect(can('users', 'read', FLAGS_ON)).toBe(false);
  });

  it('NADIE se nombra admin a sí mismo', () => {
    // El `.write` de `users/$uid` cascadea hasta `isAdmin`, así que un
    // `".write": false` debajo NO lo revocaba: hacía falta un `.validate`.
    // Escalada de privilegios de libro — cualquiera con sesión se ponía
    // isAdmin = true y se abría el panel secreto del cantoral.
    expect(can('users/alice/isAdmin', 'write', ALICE)).toBe(false);
  });

  it('un admin sí puede nombrar admin a otro', () => {
    const admin: RulesContext = { ...ALICE, admins: ['alice'] };
    expect(can('users/alice/isAdmin', 'write', admin)).toBe(true);
  });

  it('borrar la cuenta entera sigue funcionando', () => {
    // `deleteUserData` hace remove() de `users/<uid>`, que arrastra isAdmin.
    // RTDB no valida los borrados, así que el `.validate` no lo bloquea.
    expect(isAllowed(rules, 'users/alice', 'write', ALICE, true)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// EL PANEL — depende de las banderas. Con ellas puestas funciona igual que hoy.
// ─────────────────────────────────────────────────────────────────────────────

describe('panel: lo que necesita con las banderas puestas', () => {
  const reads = [
    'albums',
    'app',
    'calendars',
    'songs',
    'wordle',
    'jubileo',
    'activities',
    'profileConfig',
    'surveys',
    'choirs',
    'choirSessions/coro-1',
    'playlistShares/1234',
    'notifications',
    'scheduledNotifications',
    'pushTokens',
  ];

  it.each(reads)('lee /%s', (path) => {
    expect(can(path, 'read', FLAGS_ON)).toBe(true);
  });

  const writes = [
    'albums',
    'calendars',
    'songs/data',
    'songs/updatedAt',
    'songs/tags',
    'profileConfig',
    'wordle/daily-words',
    'wordle/updatedAt',
    'app/feedback',
    'app/updatedAt',
    `${EV}/horario`,
    `${EV}/_meta`,
    'activities/_meta',
    'jubileo/horario',
    'surveys/enc1',
    'surveys/_index',
    'choirs/coro-1',
    'playlistShares/1234',
    'choirSessions/coro-1',
    'notifications/n1',
    'scheduledNotifications/s1',
    `pushTokens/${DEVICE}`,
  ];

  it.each(writes)('escribe /%s', (path) => {
    expect(can(path, 'write', FLAGS_ON)).toBe(true);
  });

  it('NO lee la raíz — ni con las banderas puestas', () => {
    // Por eso JSONManager dejó de usar onValue('/'): conceder `.read` en la
    // raíz expondría /users entero (el diario de Contigo de todo el mundo).
    expect(can('/', 'read', FLAGS_ON)).toBe(false);
  });

  it('NO lee ni escribe /users (necesita auth real)', () => {
    expect(can('users', 'read', FLAGS_ON)).toBe(false);
    expect(can('users/alice/isAdmin', 'write', FLAGS_ON)).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// A DÓNDE VAMOS — con las banderas apagadas, lo privado queda cerrado.
// ─────────────────────────────────────────────────────────────────────────────

describe('banderas apagadas: lo que se cierra', () => {
  it('las respuestas dejan de leerse en bloque', () => {
    expect(can(`${EV}/evaluacion/respuestas`, 'read', FLAGS_OFF)).toBe(false);
    expect(can('surveys/enc1/respuestas', 'read', FLAGS_OFF)).toBe(false);
    expect(can('app/evaluations', 'read', FLAGS_OFF)).toBe(false);
    // …pero cada dispositivo sigue leyendo la suya.
    expect(
      can(`${EV}/evaluacion/respuestas/${DEVICE}`, 'read', FLAGS_OFF),
    ).toBe(true);
  });

  it('los tokens push dejan de ser enumerables', () => {
    expect(can('pushTokens', 'read', FLAGS_OFF)).toBe(false);
    expect(can(`pushTokens/${DEVICE}`, 'read', FLAGS_OFF)).toBe(true);
  });

  it('el contenido deja de ser escribible por cualquiera', () => {
    expect(can('albums', 'write', FLAGS_OFF)).toBe(false);
    expect(can('calendars', 'write', FLAGS_OFF)).toBe(false);
    expect(can('profileConfig', 'write', FLAGS_OFF)).toBe(false);
    expect(can('songs/data', 'write', FLAGS_OFF)).toBe(false);
    expect(can(`${EV}/horario`, 'write', FLAGS_OFF)).toBe(false);
    expect(can('surveys/enc1/data', 'write', FLAGS_OFF)).toBe(false);
    expect(can('notifications/n1', 'write', FLAGS_OFF)).toBe(false);
    expect(can('scheduledNotifications/s1', 'write', FLAGS_OFF)).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// DENEGACIONES QUE NO DEPENDEN DE NADA
// ─────────────────────────────────────────────────────────────────────────────

describe('siempre denegado', () => {
  it('la raíz', () => {
    expect(can('/', 'read', FLAGS_ON)).toBe(false);
    expect(can('/', 'write', FLAGS_ON)).toBe(false);
  });

  it('/_config no se lee ni se escribe desde ningún cliente', () => {
    // Si se pudiera escribir, cualquiera se abriría los permisos solo.
    expect(can('_config', 'read', FLAGS_ON)).toBe(false);
    expect(can('_config/legacyPanelWrites', 'write', FLAGS_ON)).toBe(false);
    expect(can('_config/legacyPanelWrites', 'write', ALICE)).toBe(false);
  });

  it('las raíces no enumerables siguen sin serlo', () => {
    expect(can('playlistShares', 'read', FLAGS_ON)).toBe(false);
    expect(can('choirSessions', 'read', FLAGS_ON)).toBe(false);
    expect(can('playlistShares', 'write', FLAGS_ON)).toBe(false);
    expect(can('choirSessions', 'write', FLAGS_ON)).toBe(false);
    // /choirs SÍ es enumerable a propósito (la app lista los coros), pero la
    // raíz no se puede machacar de una sentada.
    expect(can('choirs', 'read', FLAGS_ON)).toBe(true);
    expect(can('choirs', 'write', FLAGS_ON)).toBe(false);
  });

  it('un path que no existe en las reglas queda bloqueado', () => {
    // Esto es lo que hacía EventHomeScreen con `__noop__/<slug>`: bajo las
    // reglas abiertas de hoy devolvía null, con estas es PERMISSION_DENIED en
    // cada render. Por eso se quitó el fetch en vez de añadirle una regla.
    expect(can('__noop__/horario/updatedAt', 'read', FLAGS_ON)).toBe(false);
    expect(can('cualquier/cosa/inventada', 'write', FLAGS_ON)).toBe(false);
  });

  it('el cantoral no se puede borrar desde la app aunque se lea', () => {
    expect(can('songs/ediciones', 'read', FLAGS_ON)).toBe(true);
    expect(can('songs', 'write', FLAGS_ON)).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// EL ESCENARIO DEL OLVIDO
// ─────────────────────────────────────────────────────────────────────────────

describe('sin sembrar /_config', () => {
  it('la app sigue funcionando entera', () => {
    expect(can('songs/data', 'read', NO_CONFIG)).toBe(true);
    expect(can(`${EV}/evaluacion/updatedAt`, 'write', NO_CONFIG)).toBe(true);
    expect(can(`pushTokens/${DEVICE}`, 'write', NO_CONFIG)).toBe(true);
    expect(can('choirs', 'read', NO_CONFIG)).toBe(true);
  });

  it('el panel se queda sin permisos (por eso hay que sembrarlo antes)', () => {
    expect(can('albums', 'write', NO_CONFIG)).toBe(false);
    expect(can('activities', 'read', NO_CONFIG)).toBe(false);
    expect(can('pushTokens', 'read', NO_CONFIG)).toBe(false);
  });
});
