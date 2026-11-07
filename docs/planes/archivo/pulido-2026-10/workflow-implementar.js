export const meta = {
  name: 'mcm-implement',
  description: 'Implementa paquetes de hallazgos de la auditoría, cada uno en su worktree y rama wip/<paquete>, con verificación',
  phases: [
    { title: 'Implement', detail: 'un agente por paquete en su propio git worktree; tsc + lint + jest antes de commitear' },
  ],
}

const SP = '/tmp/claude-0/-home-user/300ee0ca-9125-5472-a7cc-3112e1ad9ad5/scratchpad'
const TRAILER = 'Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>\nClaude-Session: https://claude.ai/code/session_011uVtFRvFBg7Jx3vY4da5ag'

const WPS = {
  'A-cantoral-lista': { model: undefined, notes: `Cantoral: portada de categorías y lista de canciones. Eres dueño de hooks/useFirebaseData.ts, utils/songTags.ts, hooks/useSongListTags.ts, components/SongListItem.tsx, app/screens/SongListScreen.tsx, app/screens/CategoriesScreen.tsx, components/ProgressWithMessage.tsx.
- perf-firebasedata-cache-await-red es el de más impacto: hazlo con cuidado y AÑADE un test (hay tests de useFirebaseData en __tests__/) que cubra "con caché en memoria, el primer render ya trae data y loading=false". No rompas el patrón updatedAt/hidden.
- ux-buscador-cantoral-tildes: normaliza (NFD + quitar diacríticos + minúsculas) tanto la consulta como los campos buscados; si hay un util de normalización ya en el repo, reúsalo; añade test.
- ux-search-empty-dialects: incluye Grupos y Contactos (usa EmptyState).
- a11y-muted-text-opacity: SOLO la parte del cantoral (SongListScreen). La parte de Home/Ajustes la hace otro paquete.
- ux-copy-tone: SOLO la parte de SongListScreen (si la hay).
- delight-selection-confirm: puede tocar SongDetailScreen con un hunk mínimo (lo edita otro paquete en paralelo: no reformatees ese fichero).
- ux-selection-vocabulary: elige UN nombre según lo que proponga el hallazgo y aplícalo a los textos visibles (no renombres identificadores de código).
- web-songlist-share-unhandled: arregla las tres llamadas (SongList, Reflexiones, SelectedSongs) con un helper común si tiene sentido; hunks mínimos en ficheros ajenos.` },
  'B1-cancion-detalle': { model: undefined, notes: `Detalle de canción y su FAB/controles. Eres dueño de app/screens/SongDetailScreen.tsx, components/SongControls.tsx, components/SongDisplay.tsx, app/(tabs)/cancionero.tsx (opciones de header), y de los WebViews de McmPanelScreen/ComunicaGestionScreen para el atrás de Android.
- keep-awake: expo-keep-awake YA está instalado (viene con expo, ~57.0.2, está en node_modules): usa useKeepAwake de 'expo-keep-awake' en detalle y pantalla completa; comprueba que en web no rompe (tiene implementación web). No añadas dependencias a package.json.
- perf-transponer-recarga-webview: es el más delicado. Objetivo: transponer/cambiar notación sin recargar el WebView ni volver arriba (actualizar el contenido por injectJavaScript/postMessage en nativo y por el documento del iframe en web), manteniendo el scroll. Si tras investigarlo el cambio es frágil o no puedes garantizar que web e iOS siguen funcionando, NO lo hagas y explica por qué en skipped.
- web-song-detail-shortcuts: usa el hook existente hooks/useKeyboardShortcut.ts. Combínalo con web-iframe-keydown-forwarding (reenviar keydown del iframe al documento padre).
- anim-springs-reanimated4-defaults-regresion: aplica a SongControls y también a SwipeableMonthCalendar y QrScanFrame (hunks mínimos) usando los tokens springs de constants/animations.ts.
- android-cantoral-header-icons-contrast y android-cantoral-header-icons-unreadable son el mismo problema: resuélvelo una vez (incluye SelectedSongsScreen/SongListScreen si sus iconos de header salen del mismo sitio; hunks mínimos).
- Otro paquete (B2) toca SongFullscreenScreen, utils/songSheet*.ts y utils/songDocument.ts y añade una opción "Imprimir" al menú de SongControls: no toques esos ficheros salvo lo imprescindible.` },
  'B2-hoja-fullscreen': { model: 'sonnet', notes: `Hoja de canción, pantalla completa y PDF. Eres dueño de app/screens/SongFullscreenScreen.tsx, hooks/useImmersiveChrome.ts, utils/songSheet*.ts, utils/songDocument.ts, utils/playlistPdfHtml.ts (salvo la carrera de fuentes del PDF, que hace otro paquete).
- backlog-song-map (mapa de la canción): lee antes docs/planes/PLAN_HOJA_CANCION.md (§11) y docs/funcionalidades/HOJA_CANCION.md; implementa lo que el plan describe, con tests en __tests__ (hay tests de songSheet). Debe verse bien en claro/oscuro, compacto, y no estorbar en pantalla completa. Si el plan deja abierto algo que es decisión del usuario, implementa la versión más sobria y anótalo.
- NO ejecutes npm run build:sheet-bundle (escribe en el repo del cantoral; se regenerará al integrar). Pero sí indica en notes si has tocado utils/songSheet*.ts.
- web-print-single-song: añade "Imprimir" (solo web) al menú de la canción en components/SongControls.tsx con un hunk mínimo (otro paquete edita SongControls en paralelo).
- web-fullscreen-browser-fullscreen: Fullscreen API del navegador opcional (botón/tecla F) y ocultar cursor junto con los controles; Esc debe seguir saliendo.` },
  'C-web': { model: undefined, notes: `Web de escritorio/PWA. Eres dueño de components/CommandPalette.tsx, app/+html.tsx, public/sw.js, public/manifest.json, hooks/useRegisterServiceWorker.ts, components/FormattedContent.tsx, constants/uiStyles.ts (solo focusRing), y de las partes web de SelectedSongsScreen (copy del vacío, carrera de fuentes del PDF, ux-copy-tone en SelectedSongs).
- Command Palette v2 (web-command-palette-songs + backlog-cmdk-song-deeplink + web-command-palette-keyboard): que busque canciones (con búsqueda sin tildes) y abra la canción en el stack del cantoral; Enter/flechas/Esc; ⌘ en Mac y Ctrl en el resto. Investiga cómo se navega hoy a una canción desde fuera del stack (notificaciones, enlaces, coro, useIncomingPlaylist) y reúsalo. Mantén la paleta ligera (no cargues todas las canciones si no hay paleta abierta).
- web-document-title: título de pestaña global y por pantalla; incluye el título de la canción abierta en SongDetailScreen con un hunk mínimo (otro paquete edita ese fichero).
- web-pwa-manifest-viewport: NO cambies anchuras máximas ni layout. Si tocas app.json, ese cambio va en un commit SEPARADO con [skip-ota].
- web-renderhtml-lazy: carga perezosa de react-native-render-html solo en web o en todas las plataformas si es seguro (React.lazy + Suspense con un fallback discreto).` },
  'D-android': { model: undefined, notes: `Android. Eres dueño de components/BottomSheet.tsx, app/screens/eventStackScreens.tsx, app/onboarding.tsx (solo BackHandler, NO trocear), components/EvaluationWizard.tsx y evaluation/*, utils/haptics.ts, components/ArrangementInputModal.tsx, components/tabs/AndroidTabsLayout.tsx, opciones de header de Contigo (app/(tabs)/contigo/_layout.tsx o donde se definan), app/screens/AlbumListScreen.tsx, app/(tabs)/mas.tsx, app.json (sección android).
- BottomSheet.tsx: tiene una cabecera que explica por qué usa PanResponder + core Animated dentro de Modal transparente: NO lo migres a Reanimated. Solo: evasión de teclado en Android, curva de entrada (motionEasings.sheet de constants/animations.ts) y alturas recalculadas con useWindowDimensions en vez de leerlas al cargar el módulo.
- android-floating-tabbar-covers-content: usa el paddingBottom que da components/tabs/useTabScroll.ts (o el helper que exista) en las ~12 pantallas; hunks mínimos en ficheros ajenos.
- android-contigo-transparent-headers: solo opciones de header; otro paquete (E) edita el contenido de las pantallas de Contigo en paralelo.
- android-notification-icon-white-blob: genera un PNG monocromo (silueta blanca sobre transparente, 96x96 o el tamaño que pide Expo) a partir del logo, usando una herramienta disponible (mira scripts/generate-*.js, sharp/jimp en node_modules); ábrelo con la herramienta Read para comprobar visualmente que es una silueta reconocible; si no queda bien, no lo hagas.
- Los tres cambios nativos de app.json (icono de notificación, esquema en los alias de Carismochito, <queries> para canOpenURL) van en commits SEPARADOS con [skip-ota] en el mensaje, AL FINAL de tu rama.
- android-haptics-vibrator: centraliza en utils/haptics.ts (otro paquete hará que Contigo use ese helper).` },
  'E-contigo': { model: 'sonnet', notes: `Contigo (territorio CÁLIDO: paleta WARM de components/contigo/theme.ts, no la institucionalices). Eres dueño de app/(tabs)/contigo/* (CONTENIDO, no las opciones de header, que las toca el paquete Android) y components/contigo/* (salvo HighlightActionBar y ReadingCalendarSheet, que son de otros).
- Examen del día (revision.tsx): PULE la versión actual (estado guardado, no guardar vacío, glifos/kicker, SegmentedControl, pasos animados). NO diseñes una segunda versión.
- contigo-haptics-directos: usa el helper de utils/haptics.ts (lo edita el paquete Android en paralelo para Android; tú solo cambias las llamadas).
- delight-dia-completo: una sola celebración por día (persistida), sobria, respetando reducir movimiento; usa CelebrationBurst existente.
- delight-*: Reanimated con tokens de constants/animations.ts, nada de rebotes salvo en celebración, respeta reducir movimiento.
- oracion-tiempo-propuestas NO es tuyo (es decisión del usuario).
- El paquete de Carismochito añade una línea en revision.tsx para esconder a Carismochito; no reformatees el fichero.` },
  'F1-home-mas-notif': { model: 'sonnet', notes: `Pantallas institucionales: Home (app/(tabs)/index.tsx — NO trocear), components/home/*, Más (app/screens/MasHomeScreen.tsx), notificaciones (app/notifications.tsx, components/notifications/*, components/NotificationsBottomSheet.tsx), components/SettingsBottomSheet.tsx, components/song-media/SongMediaSheet.tsx, components/playlist/PlaylistRow.tsx (solo radios), VisitasScreen/AppsScreen (solo expo-image).
- Haz también la parte de Home y Ajustes de 'a11y-muted-text-opacity' (lee ese hallazgo en ${SP}/audit.json; la parte del cantoral la hace otro paquete).
- design-home-quick-access-offbrand-colors es decisión del usuario: NO cambies los colores de los accesos rápidos.
- design-notifications-two-list-dialects: si unificar las dos listas es grande, haz lo mínimo coherente (que la hoja enseñe la categoría y los botones múltiples reutilizando NotificationListItem) o sáltalo explicando por qué.
- perf-imagenes-remotas-rn-image: expo-image ya está instalado.` },
  'F2-cal-fotos-eventos': { model: 'sonnet', notes: `Calendario (app/(tabs)/calendario.tsx, components/calendar/*), Fotos (app/(tabs)/fotos.tsx — otro paquete toca AlbumListScreen y mas.tsx), eventos (app/screens/EventHomeScreen.tsx, constants/events.ts, components/SurveyBanner.tsx), Reflexiones (app/screens/ReflexionesScreen.tsx — otro paquete cambia una llamada a Share ahí, hunk mínimo), encuestas (SurveyScreen), app/+not-found.tsx.
- Para texto sobre un color dinámico usa onColor()/readableOn de utils/colorUtils.ts; para color de marca como texto/icono usa themeColors(isDark).link o el rol adecuado (design.md §3).
- eventhome-lema-fijo: el lema debe salir de la definición del evento (constants/events.ts) y no mostrarse si el evento no tiene.` },
  'G-anim-infra': { model: 'sonnet', notes: `Animación e infraestructura. Eres dueño de components/tabs/tabBarController.ts (y useTabScroll si hace falta), app/_layout.tsx (solo el splash), contexts/AppToastContext.tsx, components/contigo/HighlightActionBar.tsx, components/song-media/FloatingMediaPlayer.tsx, components/OTAUpdatePrompt.tsx, constants/animations.ts (solo si hace falta añadir un token), __tests__ nuevos.
- perf-tabscroll-schedule-cada-frame y perf-tabbar-scroll-scheduleonrn-por-evento son el mismo problema: una sola solución.
- hygiene-trinquete-de-tokens-de-movimiento: un test-trinquete al estilo de __tests__/noNewMagicNumbers.test.ts cuyo tope es la cuenta actual (solo puede bajar). Ojo: otros paquetes están cambiando animaciones en paralelo; pon el tope con la cuenta de la rama base y documenta en el test cómo actualizarlo.
- perf-arranque-splash-hellowave: cuidado con no dejar la app colgada en el splash si algo falla (timeout de seguridad).` },
  'H-carismochito': { model: 'sonnet', notes: `Carismochito, DENTRO del laboratorio (no lo saques del Laboratorio Alpha: eso es decisión del usuario). Eres dueño de contexts/Carismochito*.tsx, components/Carismochito*.tsx, hooks/useShakeDetector.ts, utils/carismochito*.ts, utils/appIcon.ts.
- bug-carismo-suppress-revision-songdetail: añade la supresión en revision.tsx y SongDetailScreen con el mecanismo que ya use la app para lectura/presentación; hunks de 1-3 líneas (otros paquetes editan esos ficheros en paralelo).
- La parte nativa del alias (app.json) NO es tuya: la hace el paquete Android.
- design-carismo-hex-sin-token: usa CarismoColors de constants/colors.ts.
- Carismochito no respeta reducir movimiento por decisión del usuario: no lo cambies.` },
  'I-docs-hygiene': { model: 'sonnet', notes: `Limpieza y documentación de /home/user/mcmapp. NO toques mcm-app/CHANGELOG.md (lo escribe el integrador al final). NO toques código de producto salvo borrar ficheros muertos verificados.
- Antes de borrar algo, vuelve a comprobar con git grep (código, configs, workflows, docs) que nadie lo usa. Si el hallazgo es dudoso, en vez de borrar MUEVE a /_para-borrar/ (raíz del monorepo, con git mv) y añade una línea al /_para-borrar/README.md explicando qué es y por qué se movió (crea ese README).
- hygiene-raiz-herramientas-ia: mueve .jules/ y .gemini/ (y .vscode/.eslintignore si está muerto) a _para-borrar/. No quites la devDependency @heroui/native-mcp.
- hygiene-tokens-muertos: borra solo los tokens de verdad sin uso; design.md cita 'springs' de constants/animations.ts como token aprobado — no lo confundas con otro 'springs' de uiStyles; y otros paquetes en paralelo van a EMPEZAR a usar tokens de animations.ts, así que NO borres nada de constants/animations.ts.
- hygiene-test-only-widget-payload: NO lo borres (es preparación del plan de widgets, futuro); como mucho anótalo.
- NO borres GlassFAB, TopColorBar, StatCard ni TeaserCard (decisión pendiente del usuario).
- Docs: arregla CLAUDE.md (árbol y afirmaciones falsas comprobando contra el árbol real), design.md/DESIGN.md (componentes inexistentes: corrige la tabla para que apunte a lo que existe), AGENTS.md, WARNINGS.md (cifra real: npx expo lint en la rama base da 38 warnings), referencias rotas, índices, README raíz, TODO.md (borrar lo hecho según su regla; NO borres el recordatorio del examen del día ni la nota de Contigo), PLAN_HOJA_CANCION/planes README (estado real), y documenta el flujo de promoción OTA preview → production y rollback (en docs/desarrollo/, enlazado desde el índice) leyendo los workflows .github/workflows/ota-*.yml.
- Si un plan está completamente hecho, archívalo según la regla de docs/planes/README.md (mover a archivo/ y actualizar índices).` },
  'J-cantoral-repo': { model: 'sonnet', notes: `Repo del CANTORAL /home/user/mcmapp-cantoral. Trabaja DIRECTAMENTE en /home/user/mcmapp-cantoral (rama claude/mcm-app-polish-optimize-oilpn0 ya activa; NO crees worktree). Ningún otro agente toca este repo.
- songs-backup-edits/: git rm -r --cached + añadir a .gitignore (los ficheros locales pueden quedarse). Comprueba antes que el admin/workflow no dependen de que estén versionados.
- Duplicados NFC/NFD: compara hashes; si son idénticos borra la copia redundante; si difieren, mueve la más vieja a _para-borrar/.
- PDF/docx sin referencias, ejemplos, input/ .tex, scripts duplicados dudosos: MUEVE a /home/user/mcmapp-cantoral/_para-borrar/ con git mv y explica cada uno en _para-borrar/README.md. Borra directamente solo lo que es basura segura (.DS_Store, lock de LibreOffice, 'copia' idéntica).
- songs-v0*.json antiguos: conserva el más alto (el que leen los scripts); borra los demás SOLO si confirmas que ningún script/workflow lee una versión concreta.
- NO toques: canciones .cho (contenido), scripts/admin/static/mcm-sheet.js, deploy/, peticiones/, canciones_doce_acordes.json, fuente.ttf.
- Los hallazgos marcados como decisión del usuario (workflow untracked json, tab2chordpro duplicado, benedictus) NO están en tu lista: no los toques.
- Arregla README.md (mojibake) y AGENTS.md (estructura real), .dockerignore, y actualiza las versiones de actions en los workflows si el hallazgo lo propone.
- Verifica al final: python3 scripts/test_sync.py, python3 scripts/test_revisar_cho.py, python3 scripts/test_arreglar_cho.py (y los tests del admin si existen) siguen pasando; y que crear_songs_json.py sigue funcionando en modo que no escriba (si no hay modo seco, ejecútalo en una copia temporal fuera del repo o no lo ejecutes).
- Commits en este repo con el mismo formato de trailer.` },
}

const RESULT_SCHEMA = {
  type: 'object',
  properties: {
    wp: { type: 'string' },
    branch: { type: 'string' },
    worktree: { type: 'string' },
    commits: { type: 'array', items: { type: 'object', properties: { sha: { type: 'string' }, message: { type: 'string' }, native: { type: 'boolean' } }, required: ['sha', 'message', 'native'] } },
    implemented: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, what: { type: 'string' } }, required: ['id', 'what'] } },
    skipped: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, reason: { type: 'string' } }, required: ['id', 'reason'] } },
    device_checks: { type: 'array', items: { type: 'string' }, description: 'qué debe comprobar el usuario en dispositivo (iPhone/Android/iPad/web) y cómo' },
    files_touched_outside_ownership: { type: 'array', items: { type: 'string' } },
    verification: { type: 'string', description: 'resultado literal de tsc, tsc tests, lint (nº warnings) y jest' },
    notes: { type: 'string' },
  },
  required: ['wp', 'branch', 'worktree', 'commits', 'implemented', 'skipped', 'device_checks', 'files_touched_outside_ownership', 'verification', 'notes'],
}

function prompt(key, wp) {
  const isCantoral = key === 'J-cantoral-repo'
  const setup = isCantoral
    ? `Trabajas en /home/user/mcmapp-cantoral directamente (git status para ver que estás en claude/mcm-app-polish-optimize-oilpn0).`
    : `PRIMER PASO — crea tu worktree aislado (otros agentes trabajan en paralelo en otros worktrees; NUNCA edites /home/user/mcmapp directamente):
  cd /home/user/mcmapp && git worktree add /home/user/wt/${key} -b wip/${key} claude/mcm-app-polish-optimize-oilpn0
  ln -s /home/user/mcmapp/mcm-app/node_modules /home/user/wt/${key}/mcm-app/node_modules
(si git dice que hay un .lock, espera unos segundos y reintenta). Todo tu trabajo va en /home/user/wt/${key}. El symlink de node_modules ya está excluido de git; aun así NUNCA uses 'git add -A' ni 'git add .': añade ficheros por ruta.`
  return `Eres un ingeniero senior de React Native/Expo (o de Python en el caso del cantoral) implementando un paquete de mejoras de MCM App. La auditoría ya está hecha; tu trabajo es VERIFICAR cada hallazgo en el código actual e implementarlo bien.

${setup}

TU PAQUETE: ${key}
Hallazgos (léelos enteros, con su evidencia y su arreglo propuesto): ${SP}/wp-${key}.json
Notas específicas del paquete:
${wp.notes}

REGLAS:
- Lee /home/user/mcmapp/design.md antes de tocar UI (tokens de mcm-app/constants/*.ts; nada de hex ni números mágicos nuevos —hay trinquetes en __tests__/noNewMagicNumbers.test.ts y designTokens.test.ts—; PressableFeedback en vez de Pressable/TouchableOpacity nuevos; EmptyState/AppTextField/AppPrimaryButton/SegmentedControl/IconSymbol; territorios). Convenciones de mcm-app/CLAUDE.md: imports con @/, nada de console.* (usa @/utils/logger), Prettier (comillas simples, trailing commas, 80 cols). No trocees ficheros grandes.
- Antes de cambiar nada por un hallazgo, compruébalo en el código: la auditoría puede equivocarse. Si es falso o el arreglo propuesto es peor que el problema, NO lo hagas y explícalo en skipped. Si encuentras algo mejor, hazlo mejor.
- Cambios mínimos y limpios: no reformatees ficheros enteros, no reordenes imports ajenos, no toques lo que no es de tu paquete salvo hunks mínimos imprescindibles (y lístalos en files_touched_outside_ownership).
- NO toques mcm-app/CHANGELOG.md ni mcm-app/TODO.md ni docs/ (salvo el paquete I y el J en su repo). Lo que haya que documentar, ponlo en notes.
- Cualquier cambio en mcm-app/app.json, app.config.ts, package.json, package-lock.json, eas.json, patches/, plugins/, modules/, targets/ va en un commit APARTE con [skip-ota] en el mensaje, al final de la rama. No añadas dependencias nuevas salvo que sea imprescindible (y entonces es nativo → [skip-ota]).
- Añade tests en __tests__/ para la lógica pura que cambies o crees (comportamiento, no snapshots).
- Cuando algo sólo pueda comprobarse en dispositivo, impleméntalo de forma conservadora y añade la comprobación concreta en device_checks.

VERIFICACIÓN OBLIGATORIA antes de cada commit final (en el directorio mcm-app de TU worktree; hay sólo 4 CPU compartidas con otros agentes, así que limita workers):
  npx tsc --noEmit
  npx tsc --noEmit -p tsconfig.test.json
  npx expo lint   → 0 errores y como mucho 38 warnings (la base tiene 38; si subes la cuenta, es tuyo y lo arreglas)
  npx prettier --check <tus ficheros cambiados>   (o --write)
  npx jest --ci -w 2   (la suite completa una vez al final; mientras iteras, solo los tests relacionados)
${isCantoral ? '(En el cantoral: los tests de Python que indican las notas.)' : ''}
Si algo falla, arréglalo. No commitees nada en rojo.

COMMITS: en castellano, estilo del repo (mira git log: p.ej. "perf(cantoral): …", "fix(android): …", "design(contigo): …", "a11y(…): …", "docs: …", "chore: …"), uno por cambio lógico o por grupo pequeño de hallazgos relacionados. Termina cada mensaje con una línea en blanco y estas dos líneas exactas:
${TRAILER}
No hagas push. No toques otras ramas.

Devuelve el resultado con el esquema pedido (verification con los números reales).`
}

const keys = (args && args.wps) || []
phase('Implement')
const results = await parallel(keys.map(key => () =>
  agent(prompt(key, WPS[key]), {
    label: 'impl:' + key,
    phase: 'Implement',
    schema: RESULT_SCHEMA,
    model: WPS[key].model,
    effort: 'high',
  })
))
return results.filter(Boolean)
