# 01 — Cimientos del área nativa

> **Estado:** 🟢 listo para ejecutar en `nuevoComunicaChulo` · **Depende de:**
> 00 · **Tamaño:** L · Índice y reglas comunes: [`README.md`](README.md).

## Para qué

Todo lo que comparten las pantallas de los planes 02-09 y que nadie debería
reinventar: dónde viven las rutas, cómo se decide si se ve lo nativo o la
WebView, cómo se piden y se guardan los datos en el móvil, cómo se escribe sin
esperar al CRM, cómo se pinta cada estado de una pantalla, y los tests que
impiden romperlo sin enterarse.

Al acabar este plan, la pestaña Comunica enseña una portada nativa vacía (la
rellena el plan 04) con datos del servidor falso, o la WebView de siempre si
el interruptor está apagado.

---

## 1. Rutas y convivencia con la WebView

- `app/(tabs)/comunica.tsx` pasa a ser la carpeta `app/(tabs)/comunica/`, con
  el mismo modelo que `contigo/`:
  - `_layout.tsx`: `Stack` con cabecera nativa (título grande en iOS donde
    toque, `design.md` §1 «que se sienta del sistema»).
  - `index.tsx`: **la puerta** (`ComunicaGate`). Decide qué se ve
    (actualizado el 22/10 con el plan 10):
    1. El enrutador del plan 10 dice «legado» (modo alpha apagado con el
       interruptor en `alpha`, o interruptor en `off`), o no hay servidor
       configurado → la WebView de hoy (`app/screens/ComunicaScreen.tsx`, sin
       tocarla).
    2. Nativa y sin sesión → entrar (plan 02).
    3. Con sesión y algún papel de equipo (`monitor`, `coordination`,
       `accompaniment`) → la portada «Hoy» (plan 04), con lo de familia debajo
       si también es familia (plan 11).
    4. Con sesión y sin papel de equipo (familia o miembro) → la portada de
       familia (plan 11). Ya no va a la WebView: familias también es nativo.
  - `web.tsx`: **el legado**. La WebView del plugin, entera o abierta en una
    página concreta con sesión por `openLegacy` (plan 10), para lo poco que no
    sea nativo. Reutiliza `ComunicaScreen` y `useComunicaWebView`.
  - Subcarpetas de cada bloque (`pasar-lista/`, `grupos/`, `coordinacion/`,
    `eventos/`, `yo/`): las crean sus planes.
- **Interruptor** `global.comunicaNativa: 'off' | 'alpha' | 'all'` en
  `/profileConfig` (ausente = `alpha`), combinado con el modo alpha: lo define
  el plan 10 §1. `alpha` = solo lo ve quien enciende el Laboratorio Alpha;
  `all` = el lanzamiento para todos; `off` = vuelta atrás de emergencia, sin
  build ni OTA. Documentarlo en `docs/contratos/PANEL_PERFILES.md` para que el
  Panel lo enseñe; hasta entonces se cambia desde la consola de Firebase.
- Los enlaces de acceso que ya abre la app (`app/+native-intent.ts`,
  `/app/acceso?acceso_magico=…`) siguen yendo a la pestaña: con el interruptor
  apagado, a la WebView como hoy; encendido, al acceso nativo (plan 02).
- Las rutas nuevas no se añaden a `KNOWN_TABS`: la pestaña ya existe. Lo que sí
  se añade es la clave del interruptor al tipo y al seed.

## 2. Cliente y consultas

- **TanStack Query v5** (JS puro, se añade sin preguntar). Un `QueryClient`
  propio del área, montado en `_layout.tsx` (no en la raíz de la app: así no
  toca al resto y desaparece con el interruptor).
- Hook **`useAreaQuery({ key, fetch, persist = true, staleTime })`**: la clave
  siempre empieza por `['comunica', <bloque>, …]`. Devuelve los datos, el
  estado y `generatedAt` para el «actualizado hace».
- **Stale-while-revalidate**, como `hooks/useFirebaseData.ts`: se pinta lo
  guardado al instante y se refresca por detrás. Al volver a la app y al
  reconectar, se refresca lo que está en pantalla.
- **`useMe()`**: la persona que ha entrado, sus papeles, su alcance y si puede
  ver la salud (`Me` del plan 00). Toda pantalla decide qué enseña con esto, y
  **además** el servidor lo vuelve a comprobar: la app nunca es la barrera de
  seguridad.
- Un 401 lleva a entrar otra vez (plan 02); un 403 pinta «No tienes acceso a
  esto» sin decir si existe.

## 3. Datos guardados en el móvil

- Persistencia de las consultas en **`expo-sqlite`** (su `kv-store`, sin el
  tope de 6 MB de AsyncStorage en Android). Llega a la rama con la 2.2.
- **Nada con `persist: false` toca el disco**: la salud siempre. Se comprueba
  con un test (§7).
- Todo va **con espacio por persona**: si entra otra persona en el mismo
  móvil, no ve lo de la anterior, y al **salir se borra todo** (consultas,
  cola, sesión). Es la regla del service worker del plugin
  (`PASAR-LISTA-ROADMAP.md` del plugin, «Privacidad»).
- Lo que se guarda para usar sin cobertura (decisión `offline`): portada,
  grupos, listas y fichas básicas (nombre, foto, teléfonos de tutores,
  marcas). Lo demás se puede guardar también como caché, pero ninguna
  pantalla promete funcionar sin cobertura salvo esas.
- En web (para las capturas con el servidor falso) el almacén cae a memoria:
  un adaptador con la misma interfaz, sin `expo-sqlite`.

## 4. La cola de escrituras

`services/comunica/outbox.ts`, también sobre `expo-sqlite`:

- **`enqueueWrite({ key, kind, payload, clientId })`**: una entrada por `key`
  (p. ej. `roll:<sesión>:<grupo>`), **gana la última** (como la cola del
  plugin, `js/stic-pasar-lista.js`). El `clientId` lo genera quien encola y se
  conserva entre reintentos: el servidor no duplica.
- Estados: `pending` → `sending` → `applied` | `failed` (reintentable) |
  `stuck` (tras 5 fallos, se avisa y se puede volver a intentar a mano o
  descartar con confirmación).
- **Cuándo sube:** al encolar, al reconectar, al volver la app a primer plano y
  al abrir cualquier pantalla del área. (En el plugin solo sube al abrir Pasar
  Lista; subirla desde cualquier pantalla es lo que el propietario quiso en
  octubre, «sí, pero más adelante», plan 042 `pl-9`.)
- **Actualización optimista**: al encolar, las consultas afectadas se
  actualizan en el móvil para que la pantalla ya enseñe lo marcado; cuando el
  servidor contesta, se refrescan con lo que de verdad quedó.
- `useOutboxStatus(key?)`: el estado de una entrada o el resumen («2 listas sin
  subir»), para la portada y para `UploadStatus`.
- `crm_unavailable` y la red caída reintentan con espera creciente; `validation`
  y `forbidden` no se reintentan: pasan a `failed` con el mensaje.
- Sin límite de horas para reenviar: el de 72 h del plugin venía del nonce de
  WordPress, que aquí no existe. Si una entrada lleva más de 72 h, se enseña
  igualmente su fecha para que nadie suba una lista vieja sin darse cuenta.

## 5. Estados de pantalla (componentes de `components/comunica/comun/`)

| Componente | Qué hace |
|---|---|
| `AreaScreen` | Contenedor de cada pantalla: cabecera nativa, pull-to-refresh del sistema, `PageContainer` en pantalla ancha, hueco de la barra flotante con `useTabScroll` / `useTabListScroll` |
| `AreaState` | Cargando (esqueleto con `Skeleton` de heroui, nunca una rueda sola), vacío (`EmptyState`), error («No se ha podido cargar» + «Reintentar»), sin conexión con datos (banner + datos) y sin conexión sin datos («Necesitas conexión la primera vez») |
| `SyncBadge` | «Actualizado hace 5 min» con `generatedAt`. En gris, sin alarmar |
| `UploadStatus` | Estado de una escritura: «Guardada en el móvil», «Subiendo…», «Subida», «No se ha podido subir · Reintentar», «Atascada» |

Sin conexión se reutiliza `components/OfflineBanner.tsx` y
`hooks/useNetworkStatus.ts`. Textos cortos y en el tono del área privada.

## 6. Errores y observabilidad

- `logger.error` (Sentry) en: respuesta con forma rota, `stuck` en la cola,
  403 inesperado. Nunca con datos personales en el mensaje: ids, no nombres.
- Un panel de diagnóstico en el panel secreto (solo desarrollo y preview):
  servidor en uso, persona, cola, última sincronización. Es el `?pl_diag=1`
  del plugin.

## 7. Guardarraíles (tests que fallan solos)

- Ningún fichero de `app/(tabs)/comunica/` ni de `components/comunica/` hace
  `fetch` ni importa `services/comunica/fake/` (recorre los imports).
- Ninguna consulta con `persist: false` llega al almacén (test con el
  persistidor real y una consulta de salud del servidor falso).
- Salir borra consultas, cola y sesión (test de punta a punta con el falso).
- Con el enrutador en «legado», la pestaña pinta `ComunicaScreen` (test de la
  puerta con `screenSmoke`).
- Nada nativo en el grafo de web: el área entra en
  `__tests__/tabsLayoutWebSafety.test.ts` (`expo-sqlite` y `expo-secure-store`
  solo detrás de adaptadores).
- `noNewMagicNumbers` y `designTokens` siguen en verde.

## 8. Tareas

| # | Tarea | Cómo se comprueba |
|---|---|---|
| 1 | `comunica.tsx` → carpeta `comunica/` con `_layout.tsx`, `index.tsx` (puerta) y `web.tsx`; la WebView sigue igual | La pestaña se ve igual que hoy en modo legado (captura web y `screenSmoke`) |
| 2 | Interruptor de tres estados: lo hace el plan 10 (tarea 1); aquí la puerta lo consulta | Tests de la puerta con el enrutador simulado |
| 3 | `QueryClient` del área, `useAreaQuery`, `useMe` sobre el cliente del plan 00 | Tests con el servidor falso: datos, error, 401, 403 |
| 4 | Persistencia en `expo-sqlite` (adaptador de memoria en web), espacio por persona, borrado al salir, exclusión de `persist: false` | Guardarraíles de §7 |
| 5 | Cola `outbox.ts` con estados, disparadores, reintentos, optimista y `useOutboxStatus` | Tests: gana la última, mismo `clientId` en reintentos, `stuck` a los 5, sube al reconectar, `validation` no reintenta |
| 6 | `AreaScreen`, `AreaState`, `SyncBadge`, `UploadStatus` | Capturas web a 375 px, claro y oscuro, de cada estado con los mandos del falso |
| 7 | Panel de diagnóstico en el panel secreto | Captura; ausente en producción |
| 8 | Guardarraíles de §7 | Fallan si se rompe la regla (probar rompiéndola una vez en local) |
| 9 | Entrada en `mcm-app/CHANGELOG.md` (cambio de navegación de la pestaña) | Revisión |

## 9. Preguntas abiertas

- Ninguna que bloquee. Si al montar la puerta aparece un caso no previsto
  (p. ej. alguien con papel de equipo en una delegación y de familia en otra),
  se resuelve con la regla «si tiene papel de equipo, portada nativa con un
  acceso a lo de familia en la WebView» y se apunta aquí.
