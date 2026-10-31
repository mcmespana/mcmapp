# PLAN_EXPO_58 — Migrar a Expo SDK 58 (React Native 0.88)

> ⚠️ **ESTE FICHERO SE BORRA SOLO AL TERMINAR.** Quien cierre este trabajo lo
> **borra** (no lo archiva) en el mismo commit que deja la migración hecha, y
> quita su fila de `docs/planes/README.md`. El registro de lo hecho va al
> `mcm-app/CHANGELOG.md`. Si sigue existiendo, la migración NO está hecha.

**Escrito el 2026-10-29** para arrancar en una conversación nueva.
**Esfuerzo recomendado:** alto. Es un cambio de navegación con muchas piezas
cruzadas, y lo que falla solo se ve en el móvil.

## Cómo arrancar (copiar esto en la conversación nueva)

> Lee `docs/planes/PLAN_EXPO_58.md` entero y ejecútalo. Usa la rama
> `claude/deps-expo-58` (PR #353), trae `main` y sigue los pasos. Al acabar,
> lanza una build de TestFlight y borra el plan.

## Estado (2026-10-31, tarde) — pasos 1-9 hechos, faltan 10-11

Hechos en la rama `claude/deps-expo-58` (PR #353): **1** `main` traído y
`expo install --check` al día; **2** Comunica sobre Expo 58 (`anchor`,
`usePreventRemove`); **3** guardarraíles en `__tests__/router/`; **4** Fotos,
Calendario, Visita del Papa y Más migradas a carpetas de rutas; **5-6**
Cantoral migrado a `app/(tabs)/cancionero/` con todo lo que colgaba de su
stack; **7** `freezeOnBlur` quitado (no tiene efecto en 58); **8** `defaultTab`
sin tocar (no hace falta, ver abajo); **9** verificación hecha, incluida la web.
Detalle y decisiones en las entradas del CHANGELOG del 2026-10-31 (12:00 y
18:00). Ya no queda ningún navegador montado a mano: las listas de pendientes
de `__tests__/router/` se han borrado y la regla queda pelada.

**Primera build de TestFlight (31/10, noche):** salieron iconos en blanco en
iOS, pestañas que volvían a su portada, el re-tap de Contigo y el panel
secreto. Arreglados en la entrada del CHANGELOG de las 21:00; **hace falta
otra build** para comprobarlos. Pendiente aparte: el login del área nativa de
Comunica en modo alpha («no se ha podido»), a mirar en su propia sesión.

**Lo que falta es lo que solo se ve en el móvil (paso 10)**: build de
TestFlight desde la rama y recorrido en dispositivo; después, mergear (11).
La build la lanza el usuario.

Decisiones de este tramo que conviene saber:

- **`defaultTab` (paso 8):** es un valor GLOBAL del Panel (`global.defaultTab`,
  hoy `index`), no por perfil, y ninguna pantalla lo lee: en iOS nunca se
  respetó y en Android/web lo perdió la rama al quitar `initialRouteName`. Con
  el valor actual no cambia nada. Si algún día el Panel pone otra pestaña, la
  vía es que Inicio redirija una vez al arrancar en frío (cuidando no pisar un
  enlace o una notificación de arranque).
- **`freezeOnBlur` (paso 7):** en expo-router 58 está marcado «sin efecto» y
  los navegadores lo fijan a `false`; se quitó de `AndroidTabsLayout`,
  `eventStackScreens` y del cantoral. Las pestañas ya visitadas vuelven a
  re-renderizar en segundo plano: mirar en el móvil si se nota (ver
  `docs/desarrollo/TABS_MAINTENANCE.md`).
- **Web en blanco (encontrado en el paso 9, ya arreglado):** en 58 el export
  estático ya no inyecta el JS en el HTML; `app/+html.tsx` tiene que pintar
  `headNodes`/`bodyNodes`. Lo vigila `__tests__/htmlTemplateAssets.test.tsx`.

Lo aprendido que conviene saber: el `Stack` de expo-router 58 no aplana
fragmentos (devolver `<>…</>` de un helper revienta); los params de ruta son
texto; las pantallas compartidas entre stacks se re-exportan en un fichero de
una línea por carpeta (`export { default } from '@/app/screens/X'`). En tests
con `renderRouter`, un toque que navega va en `await act(async () => …)` (la
cola del router se vacía después del `act` síncrono de `fireEvent`), y a
`renderRouter` se le pasa el MÓDULO del `_layout`, no su `default`, o se pierde
`unstable_settings`.

## Dónde estamos (antes de este tramo)

- `main` (31f345b) está en **Expo 57**, con el arreglo del NFC (#352) y el área
  nativa de Comunica (#350). Funciona; build 61 en TestFlight.
- **PR #353 / rama `claude/deps-expo-58` (996f159)**: el salto a Expo 58 ya
  está casi hecho (dependencias, tipos, tests en verde), pero su build (la 60)
  **se cierra al abrir la app** con:
  > A navigator received a missing, partial, or incompatible navigation state.
  > Navigation state is created globally now, so the container must provide a
  > complete seeded state for every mounted navigator.
- La rama es de ANTES de mergear Comunica: va 1 commit por delante y muchos
  por detrás de `main`. Lo primero es traer `main` (merge, no rebase).

## La causa

En expo-router 58 el estado de navegación se crea **globalmente a partir de
las rutas de fichero**. Ya no se admite montar un navegador «a mano» dentro de
una pantalla. Hoy hay cinco pestañas que lo hacen con
`createNativeStackNavigator`:

| Pestaña         | Fichero                     | Pantallas                                                                                                  |
| --------------- | --------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Cantoral        | `app/(tabs)/cancionero.tsx` | Categories → SongsList → SongDetail → SongFullscreen (+ selección)                                         |
| Más             | `app/(tabs)/mas.tsx`        | MasHome → Fotos, Calendario, Comunica, ComunicaGestion, McmPanel, EventosPasados + todo el stack de evento |
| Fotos           | `app/(tabs)/fotos.tsx`      | FotosMain → álbum                                                                                          |
| Calendario      | `app/(tabs)/calendario.tsx` | CalendarMain → …                                                                                           |
| Visita del Papa | `app/(tabs)/visitapapa.tsx` | JubileoHome + stack de evento (`app/screens/eventStackScreens.tsx`, `renderEventScreens`)                  |

Hay que convertir cada una en una **carpeta con `_layout.tsx` (`Stack` de
expo-router) y una ruta por pantalla**. Unas 29 pantallas. **El modelo ya está
en el repo:** `app/(tabs)/comunica/` (área nativa) se hizo así desde el
principio, y `app/(tabs)/contigo/` también.

Los tests no lo detectaron porque montan las pantallas sin el router.

## Lo que ya resuelve la rama (no rehacer)

- `expo install expo@^58 --fix` y devDependencies (Jest 30, jest-expo 58…),
  `firebase` 13, `chordsheetjs` 18, `@aptabase/react-native` 0.6.
- **No hace falta `legacy-peer-deps`**: el ERESOLVE solo sale con `expo install`
  pasando paquetes sueltos. Un `npm install` normal resuelve. (Con
  `legacy-peer-deps` faltaban `tailwind-merge` y `tailwind-variants`, que
  `heroui-native` necesita en ejecución.)
- `runtimeVersion` 2.1.0 → **2.2.0** (cambio de SDK). La `version` sigue 2.1.0.
- Node 24 en los workflows que construyen la app (verify, OTA, tienda, web).
- `Swipeable` → `ReanimatedSwipeable` + `components/ui/SwipeActionContent.tsx`.
- Tipos de RN 0.88: refs con `ScrollViewInstance` / `TextInputInstance` /
  `ViewInstance`; `StatusBar` sin `backgroundColor`/`translucent`;
  `ListEmptyComponent` sin `null`; `StyleSheet.create<T>` con `type`.
- Parches `patch-package`: `react-native-webview` 14.0.1 (`WebView<P = {}>`) y
  `expo-native-compact-tabs` (tipo de `ScrollView`).
- `initialParams` de la Visita del Papa → `EventIdContext`
  (`hooks/useCurrentEvent.ts`).
- Jest: proyecto `dom` aparte (`*.dom.test.ts`), resolver de Reanimated,
  `jestSetup` de gesture-handler, mock de worklets y del registro de assets,
  `react-test-renderer` 19.3 declarado. Detalle en la entrada del CHANGELOG de
  la rama («2026-10-29 18:00 — Expo 58…»).

## Pasos

1. **Traer `main`** a `claude/deps-expo-58` y resolver. Después:
   `npm install` (sin `.npmrc`), `npx expo install --check`.
2. **Comunica también usa `initialRouteName`**:
   `app/(tabs)/comunica/_layout.tsx` (`<Stack initialRouteName="index">`) →
   `export const unstable_settings = { anchor: 'index' }`, como ya se hizo en
   `contigo/_layout.tsx`. Repasar con `tsc` todo lo que trae `main`.
3. **Un test-guardarraíl primero** (regla de `mcm-app/CLAUDE.md`: lo que se
   puede romper sin enterarse va en un test). Montar la app con el router de
   verdad (`expo-router/testing-library`, `renderRouter`; en 58 hay que
   `await`-arlo) y abrir cada pestaña: tiene que fallar HOY con el error de
   arriba. Más un test que prohíba importar `createNativeStackNavigator` en
   `app/`.
4. **Migrar pestaña a pestaña**, de la más simple a la más compleja: Fotos →
   Calendario → Visita del Papa → Más → Cantoral. Cada una:
   - carpeta `app/(tabs)/<tab>/` con `_layout.tsx` (`Stack`, las mismas
     `screenOptions` y headers que hoy) y un fichero por pantalla que monta la
     de `app/screens/`;
   - cambiar `navigation.navigate('Pantalla', params)` por
     `router.push({ pathname, params })`;
   - los parámetros de ruta ahora son **texto**: nada de objetos.
5. **Cantoral (lo delicado):** `SongDetail` y `SongFullscreen` reciben hoy la
   canción entera (`content`, `media`, `navigationList`, `currentIndex`…). Pasar
   solo `filename` (+ `source`, `firebaseCategory`, `currentIndex`) y que la
   pantalla lea la canción de la caché que ya existe (`useFirebaseData` de
   `songs`). La lista para anterior/siguiente, en un almacén pequeño en memoria
   (p. ej. `utils/songNavList.ts`), no en la URL. Ojo: `SelectedSongs`, coro y
   playlists abren canciones también; buscar todos los `navigate('SongDetail'`.
6. **Lo que se apoya en el stack propio** y hay que rehacer: `stackNavRef`,
   `screenListeners` (pestaña activa), la vuelta a la raíz al re-tocar la
   pestaña (`useTabReselect`, `components/tabs/tabBarController.ts`),
   `utils/eventNavigation.ts` (`takePendingEventScreen`), `+native-intent.ts` y
   `hooks/useTabNavigation.ts` / `utils/tabNavigation.ts` (rutas de
   notificaciones y del panel), que hoy entran en los stacks por nombre de
   pantalla.
7. `freezeOnBlur`: la guía de 58 dice que se quite de los layouts de
   expo-router; comprobar que las pestañas siguen sin re-renderizar en segundo
   plano.
8. `defaultTab` del perfil: los `Tabs` de Android y web ya no aceptan
   `initialRouteName` (la rama lo quitó). En iOS no se usaba. Si hace falta,
   que Inicio redirija al arrancar.
9. Verificar: `npm run typecheck && npm run typecheck:tests && npm run lint &&
npm test`, y la web con `npx expo export -p web` + recorrido de pestañas.
   **Lint: 38 avisos**, ni uno más (`docs/desarrollo/WARNINGS.md`).
10. Build de TestFlight desde la rama (workflow «EAS Build (tienda)»,
    iOS, production, envío) y probar en el móvil: arrancar, cada pestaña, ida
    y vuelta en el cantoral, deslizar filas, notificaciones que abren
    pantallas, enlaces de Comunica, animaciones.
11. Mergear #353 cuando el usuario lo haya probado. Recordarle que con
    `runtimeVersion` 2.2.0 las builds 2.1 dejan de recibir OTA.

## Avisos para no perder tiempo

- Metro (`expo start --web`) se queda sin memoria en recorridos largos: usar
  `NODE_OPTIONS=--max-old-space-size=8192` o, mejor, `expo export -p web` y
  servir la carpeta.
- La web registra un _service worker_ (`public/sw.js`) que cachea el JS: en
  Playwright, `newContext({ serviceWorkers: 'block' })`.
- `pkill -f "expo start"` desde Bash se mata a sí mismo; matar por PID.

## Decisión pendiente del usuario (no bloquea)

La portada del área de Comunica titula «Pasar lista · <fecha del atajo>» (plan
04), pero encima salen tarjetas de «Hoy». ¿Cabecera con la fecha de hoy cuando
hay evento hoy? Preguntar si no lo ha contestado.
