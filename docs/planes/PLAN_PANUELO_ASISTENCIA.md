# Plan — Piezas del pañuelo por asistencia

> **Estado (2026-11-16): propuesta, sin empezar.** Plan ejecutable por fases.
> Se apoya en el pañuelo tal como está hoy
> ([`../funcionalidades/PANUELO.md`](../funcionalidades/PANUELO.md), contrato
> en [`../contratos/PANUELO_CONTRATO.md`](../contratos/PANUELO_CONTRATO.md)) y
> en el pasar lista del área nativa de Comunica
> ([`area-nativa/04-pasar-lista.md`](area-nativa/04-pasar-lista.md),
> [`area-nativa/07-eventos.md`](area-nativa/07-eventos.md)).
> Es la primera pieza que se concede **en servidor**: adelanta la Fase 7 de
> [`PLAN_PANEL_PANUELO.md`](PLAN_PANEL_PANUELO.md) («canje y reparto validados
> en servidor») para este caso concreto.

## Lo que pidió el usuario

1. A ciertos eventos se les asigna una pieza (chapa, pin o medalla). Cuando a
   un chaval **le marcan la asistencia** en ese evento —los monitores ya pasan
   lista en el área nativa de Comunica—, la consigue.
2. La siguiente vez que entra en la app y tiene piezas nuevas, le sale **una
   animación con la explicación de cada pieza nueva, una por una**, dándole a
   «Siguiente». Al terminar ya puede **colocarlas** en el pañuelo.

---

## 0. Lo que hay hoy (verificado en el código)

### La pregunta clave: ¿la cuenta de Comunica y la del pañuelo son la misma persona?

**No son la misma identidad, pero hay un puente que ya funciona en el servidor.**

| Lado             | Quién es                                                                                  | Dónde                                                                                     |
| ---------------- | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Pañuelo          | El **uid de Firebase Auth** (Google/Apple). Sin sesión, el pañuelo vive solo en el móvil  | `hooks/usePanuelo.ts` (`useAuth().user.uid`), nodo `/users/{uid}/panuelo`                 |
| Comunica         | El **`personId` del CRM** (`Me.personId`, `profiles.self.id`), con tokens propios (~15 min + refresco) | `services/comunica/session.ts`, `contract.ts` (`Me`, `MyProfiles`)                        |
| El puente        | `POST /v1/auth/app-account`: la app manda el **pase (idToken) de Firebase** y el middleware lo verifica y busca las fichas de **ese correo** (o «¿Quién eres?» si son varias) | `services/comunica/appAccount.ts`; servidor: `comunicaMiddleware:docs/ACCESO-APP.md`      |

Consecuencias que mandan en el diseño:

- **Una sesión de Comunica en el móvil no prueba nada sobre el uid.** Desde el
  14/11/2026 se entra sola con la cuenta de la app, pero también se puede
  entrar por código de correo, DNI o enlace, o como otra ficha del mismo correo
  (un padre y sus hijos comparten correo a menudo). El pañuelo ya lee el color
  de `profiles.self` de esa sesión (`hooks/usePanueloScarf.ts`) sin comprobar
  que es el mismo que el uid: para un color vale; para conceder piezas, no.
- **El único sitio donde uid y ficha se atan de verdad es el middleware**, al
  verificar el idToken de Firebase con la regla «correo ↔ fichas». Este repo
  no guarda esa relación en ninguna parte (la app no tiene `firebase/functions`
  ni nodo de enlace).
- **El dueño de `/users/{uid}` puede escribir lo que quiera en su nodo**
  (`database.rules.json`: `.write: auth.uid === $uid`). Por eso hoy un código
  canjeado es trampeable, y por eso una pieza de asistencia **no puede vivir
  solo en `/users/{uid}/panuelo/items`**.

### La asistencia

- Hay dos listas: la de los **sábados** (`/v1/sessions/:sid/groups/:gid/roll`) y
  la de **eventos** (`GET/PUT /v1/events/:id/roll`, `EventRollWrite` en
  `contract.ts`, pantallas en `components/comunica/eventos/`). Este plan es de
  **eventos**.
- Una marca de evento es por **día** (`sessionId`/`day`) y vale `yes` ·
  `partial` · `no_justified` · `no_unjustified` (`MARKS`). Quitar una marca la
  borra en el CRM (decisión `desmarcar`).
- Guardar una lista **no espera al CRM**: cola del móvil (`services/comunica/outbox.ts`)
  y cola del servidor (`comunicaMiddleware:docs/COLA.md`, estado `queued`). La
  asistencia puede llegar al CRM minutos después.
- La propia persona ve su asistencia en `GET /v1/profiles/:pid/calendar`
  (`CalendarSession.attendance`, ventana de 14 meses atrás), solo de eventos con
  inscripción no cancelada.
- Los ids de evento son del CRM, opacos (`Id`). **El mismo encuentro en dos
  delegaciones son dos eventos distintos.**

### El pañuelo

- `grant.type` hoy: `all` · `code` · `manual` (`types/panuelo.ts`). `PanueloVia`:
  `all` · `code` · `manual` · `demo` · `trade`.
- Piezas «sin ver»: `@panuelo_seen` (AsyncStorage, por móvil) y `unseen` en
  `usePanuelo`. En un móvil nuevo, lo que ya estaba en la nube se da por visto.
- Al abrir `/panuelo`, una pieza conseguida sin sitio **se cose sola**
  (efecto `loose` de `usePanuelo`) y luego se presenta en 3D, una a una,
  esperando a que se cierre la ficha (`nextUnseen` + orden `reveal` en
  `app/panuelo.tsx`).
- El **tutorial** (`components/panuelo/PanueloTutorial.tsx`) ya es la pieza que
  hace falta para el desvelado: pantalla re-maquetada (≈45 % visor / 55 %
  contenido) con **el mismo visor** dentro, puntos de página
  (`PanueloPageDots`), un único botón abajo, X arriba, `sections` por prop y un
  `example` por paso que mueve el visor (`usePanueloTutorialStage`, hoy atado
  al catálogo de muestra).
- La orden `reveal` del visor (`panuelo-3d/src/main.ts`) gira la pieza dos
  vueltas en 1,3 s y **no mira «reducir movimiento»** (el `reducedMotion` del
  visor solo apaga el vaivén y sale de `prefers-reduced-motion` del WebView,
  que en Android no refleja el ajuste del sistema).
- Está en el Laboratorio Alpha: `global.panuelo` (`hooks/usePanueloAvailable.ts`).

### Servidor que ya tenemos

- `mcm-app/functions/` (Cloud Functions v2, `us-central1`, plan Blaze,
  `firebase-admin`). Ya copia lógica pura de la app con un script
  (`functions/scripts/sync-ics-parser.mjs` → `src/generated/`): el mismo truco
  sirve aquí.
- El middleware (`comunicaMiddleware`, repo aparte, Vercel + Supabase) es el
  único que habla con el CRM y el único que sabe verificar el idToken contra
  las fichas.

---

## 1. Arquitectura recomendada

```
Monitor pasa lista (área nativa) ─► middleware ─► cola ─► CRM
                                                          ▲
App al abrirse (si hay piezas de asistencia en el catálogo)│
  └─ callable panueloClaimAttendance  ──(servidor a servidor, secreto)──┐
       Cloud Function (este repo, Admin SDK)                            │
         1. uid + idToken de quien llama (Firebase Auth)               │
         2. POST /v1/panuelo/attendance { idToken, personId?, eventIds }┘
            → el middleware verifica el idToken (regla de app-account),
              resuelve la ficha y devuelve SUS marcas en ESOS eventos
         3. Cruza con el catálogo y escribe /panueloAwards/{uid}/{itemId}
            (el cliente NO puede escribir ahí)
  └─ La app lee /panueloAwards/{uid}, lo refleja en su estado y
     presenta lo nuevo, una a una, con «Siguiente» → «Colocarlas»
```

### Opciones comparadas (quién concede)

| Opción                                                                                       | Trampas desde el cliente                                                       | Identidad uid ↔ ficha                                                | Cambios fuera de este repo                                         | Veredicto                         |
| -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | -------------------------------------------------------------------- | ------------------------------------------------------------------ | --------------------------------- |
| **A. El middleware concede al guardar la lista** (empuja a Firebase)                         | No                                                                             | Necesita una tabla uid↔ficha que hoy no existe y credenciales de Firebase en Vercel | Muchos: tabla, cuenta de servicio, escribir en RTDB, reintentos de la cola | Demasiado acoplado                |
| **B. Cloud Function que usa el token de Comunica del móvil** (`/v1/me/profiles` + calendario) | No (la función pregunta ella)                                                 | **Débil**: vale la ficha que tenga abierta el móvil, sea de quien sea | Ninguno                                                            | Puente si el middleware se retrasa |
| **C. Cloud Function + endpoint nuevo del middleware que verifica el idToken** ★              | No                                                                             | **Fuerte**: la misma regla «correo ↔ fichas» que entrar en Comunica | Un endpoint pequeño y un secreto compartido                         | **Recomendada**                   |
| **D. La app lee su asistencia y se escribe la pieza**                                        | **Sí**: cualquiera escribe en su `/users/{uid}`                                | Ninguna                                                              | Ninguno                                                            | Descartada (es lo que pidió evitar) |

**Por qué C.** El cliente no puede ni inventarse una asistencia (la pide el
servidor) ni escribirse la pieza (nodo cerrado a todos menos el Admin SDK), y
la ficha sale del pase de Firebase verificado, no de la sesión que el móvil
tenga abierta. El middleware sigue siendo el único que toca el CRM y Firebase
sigue siendo cosa de este repo. No hace falta que el chaval haya abierto nunca
Comunica: basta con la cuenta de la app.

**Por qué tirar del cliente y no empujar.** El usuario pidió que salga «la
siguiente vez que entra en la app»: el momento natural de conceder es ese.
Además, tirar resuelve solo los casos difíciles: quien aún no tiene la app la
consigue cuando entre (retroactivo), y una corrección de la lista se ve en la
siguiente reclamación.

**La interfaz de la app no depende de A/B/C**: la app solo llama a
`panueloClaimAttendance`. Si el endpoint del middleware tarda, la función puede
empezar por B (con el token de Comunica que le pase la app) y cambiar a C sin
tocar la app.

---

## 2. Los casos (decididos aquí salvo los 🔒)

| Caso                                             | Qué pasa                                                                                                                                                                                                                                                                                                                                                      |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Qué cuenta como «ha ido»**                     | Alguna marca `yes` o `partial` en cualquier día del evento (🔒 2). Configurable por pieza con `marks` y `minDays`                                                                                                                                                                                                                                              |
| **Familias: un padre viendo a su hijo**          | No cambia nada. El pañuelo es de **quien ha iniciado sesión en la app** (`profiles.self`), igual que el color. La ficha activa del área no cuenta                                                                                                                                                                                                             |
| **Varias fichas con el mismo correo**            | El middleware contesta `choose`. La app manda como pista el `personId` de su sesión de Comunica si lo tiene; si no, pregunta una vez «¿De quién es este pañuelo?» con la lista (`PersonChoice`) y lo recuerda. El middleware comprueba que la ficha es de ese correo                                                                                      |
| **Una ficha, una cuenta**                        | La primera cuenta que reclama una ficha se queda con ella (`/panueloOwners/{personId}`). Otra cuenta recibe `other_owner` y la app dice «Estas piezas ya están en otra cuenta» (🔒 4)                                                                                                                                                                       |
| **Sin cuenta de la app** (solo móvil, o Comunica por código) | No hay piezas por asistencia: no hay uid donde guardarlas. Nada se pierde: son retroactivas. En el pañuelo, un aviso discreto «Inicia sesión para recibir las piezas de las actividades»                                                                                                                                                  |
| **Quien no tiene la app**                        | Nada. Cuando la instale e inicie sesión, la primera reclamación le da todas las de los eventos a los que fue (retroactivo, sin límite de fecha: se pregunta por los `eventIds` del catálogo, no por una ventana)                                                                                                                                              |
| **Piezas de eventos pasados**                    | Asignar una pieza a un evento ya celebrado funciona igual: en la siguiente apertura, a todos los que fueron                                                                                                                                                                                                                                                |
| **Asistencia que llega tarde** (colas)           | Se concede en la siguiente reclamación después de que el CRM la tenga                                                                                                                                                                                                                                                                                       |
| **Asistencia corregida después**                 | La función recalcula en cada reclamación. Si una marca desaparece o pasa a «no» y la pieza se concedió hace **menos de 7 días**, se retira (`revoked`); pasado ese plazo, se queda y solo se quita a mano borrando su `/panueloAwards` (🔒 3). Una pieza retirada sale del estado de la app sin anuncio; si estaba en la cola de desvelado, se cae de ella |
| **Varios eventos dan la misma pieza** (una por delegación) | `events` es una lista: con ir a uno basta. Una pieza se tiene una vez                                                                                                                                                                                                                                                                             |
| **Monitores**                                    | Si están inscritos y les marcan, también la consiguen (la pieza es «haber estado»). Si se quiere excluirlos, campo `roles` en el futuro; no en la v1                                                                                                                                                                                                     |
| **Servidor falso** (Laboratorio)                 | Con `comunicaApiTarget().kind === 'fake'` la reclamación se simula en el móvil contra el calendario falso, y el Laboratorio tiene «Simular piezas por asistencia»: así la interfaz se prueba sin la función desplegada                                                                                                                                  |

---

## 3. El desvelado

### Cuándo salta

- **Al abrir la app** (lo que pidió el usuario), no solo al abrir el pañuelo.
  Un componente de fondo en la raíz, `PanueloAwardsBackground`, montado junto a
  `ComunicaBackground` en `app/_layout.tsx`, que solo actúa si:
  1. el pañuelo está disponible (`usePanueloAvailable`: hoy, Laboratorio Alpha;
     el día de `global.panuelo = "all"`, todos),
  2. hay uid de Firebase,
  3. el catálogo tiene al menos una pieza `attendance`,
  4. no se reclamó hace menos de **6 h** (o el usuario tira para refrescar en
     el pañuelo). La función además limita por uid (1 por minuto).
- Si tras reclamar hay **piezas sin ver**, espera a que la app esté en primer
  plano en una pestaña (no en onboarding, ni en una pantalla abierta por enlace,
  ni con la entrada animada de Comunica) y abre **`/panuelo?nuevas=1`**. Una
  vez por arranque. Las pantallas de mantenimiento y versión mínima ya
  sustituyen al `Stack` entero, así que con ellas el componente ni se monta.
- **También al abrir el pañuelo** (hoy, desde el Laboratorio): si hay piezas
  sin ver, la misma secuencia antes que nada, después del tutorial (que va
  siempre primero, `tutorial.busy`).

«Sin ver» = concedida (`/panueloAwards`) y fuera de `@panuelo_seen`. En un
móvil nuevo se da por visto lo que ya estaba concedido **antes** de esta
reclamación; lo que la función acaba de conceder (`granted`) sí se presenta.

### Cómo se ve (reutilizando el tutorial y el visor)

No es una pantalla nueva ni un segundo visor: es el **modo tutorial de
`/panuelo` alimentado con las piezas nuevas**.

- `PanueloTutorial` recibe `sections` generadas desde las piezas
  (`newPiecesSections(catalog, ids, awards)`) y los textos del botón por prop
  (`nextLabel`, `finishLabel`). Cada página:
  - título: el nombre de la pieza (`h1`);
  - frase de entrada: «Por ir a {origin}» (o el nombre del evento si no hay
    `origin`);
  - filas: clase y rareza (`KIND_LABEL`, `RARITY_LABEL`), la descripción, y la
    fecha «La conseguiste el 12 de abril de 2027»;
  - indicador «Pieza 2 de 3» con `PanueloPageDots`.
- Arriba, **el visor** con el pañuelo de la persona y la pieza presentándose
  con la orden `reveal` (sale, gira, flota delante). `usePanueloTutorialStage`
  se generaliza para recibir el catálogo de verdad y un `example` por página
  (`{ color: el suyo, pieces: lo que lleva cosido, reveal: id }`).
- **Botón único abajo: «Siguiente»**; en la última, **«Colocarlas»** (con una
  sola pieza: «Colocarla»). Debajo, en la última, un enlace secundario
  «Ahora no». La X de arriba cierra.
  > El tutorial dice «Continuar» siguiendo a Apple; aquí se usa «Siguiente»
  > porque es la palabra que pidió el usuario.
- **Al pasar de página**: `h.select`; la pieza nueva entra con el muelle de
  celebración y `PanueloStageBurst` (confeti) con el primer color de la pieza.
  En la primera, `h.formSuccess`.
- **«Colocarlas»**: se cierra la secuencia **en la misma pantalla**, entra en
  modo decorar con el filtro «Sin poner» y la primera pieza nueva
  seleccionada. Las piezas de asistencia **no se cosen solas** (🔒 5): esperan
  en la caja, que es lo que pidió el usuario («al terminar ya puede
  colocarlas»).
- **«Ahora no» o X**: lo enseñado queda visto; lo que no se llegó a ver se
  presenta la próxima vez que se abra el pañuelo (no al abrir la app: no se
  insiste).
- **Sin visor** (error del WebView, `Panuelo3D` en `error`): las mismas
  páginas con la pieza dibujada en plano (`PanueloItemArt`, ya lo hace el
  tutorial con `art`).

### Reducir movimiento y accesibilidad

- `useReducedMotion()` en la app: sin muelle de entrada, sin confeti, cambio de
  página sin animar (como el tutorial).
- El visor: la orden pasa a ser `{ type: 'reveal', id, still?: boolean }`; con
  `still` la pieza aparece delante **sin girar** (fundido corto). La app manda
  `still` desde `useReducedMotion()`, no del `prefers-reduced-motion` del
  WebView. Hay que regenerar el bundle (`npm run build:panuelo`).
- Anuncio al entrar en cada página: «Pieza nueva, 2 de 3: Chapa de Pascua
  Joven. Por ir a Pascua Joven 2027.» y foco al título
  (`moveScreenReaderFocus`). Los puntos ya son `adjustable`.
- Claro y oscuro, letra grande con scroll (el tutorial ya lo resuelve).

---

## 4. Contrato de datos propuesto

> Para añadir a `PANUELO_CONTRATO.md` en la última fase. Fuente de verdad
> futura: `types/panuelo.ts`.

### 4.1 Catálogo `/panuelo/data/items/{id}.grant` — tipo nuevo `attendance`

```json
{
  "type": "attendance",
  "events": ["<id de evento del CRM>", "<otro, de otra delegación>"],
  "marks": ["yes", "partial"],
  "minDays": 1
}
```

| Campo     | Oblig. | Notas                                                                                         |
| --------- | ------ | --------------------------------------------------------------------------------------------- |
| `events`  | Sí     | 1–50 ids de evento del CRM (cadenas opacas). Con ir a uno basta                               |
| `marks`   | No     | Qué marcas cuentan. Por defecto `["yes", "partial"]`. Valores de `MARKS` del contrato del área |
| `minDays` | No     | Días con marca que cuentan, como mínimo. Por defecto 1                                        |

Sin `from`/`to`: lo que manda es la asistencia. Una pieza `attendance` mal
escrita (sin `events`) se descarta entera, como hoy. Los ids de evento son
públicos en el catálogo: son opacos y no dicen nada de nadie.

### 4.2 `/panueloAwards/{uid}/{itemId}` — lo concedido por el servidor (nuevo)

```json
{
  "at": 1807000000000,
  "via": "attendance",
  "eventId": "<id del CRM>",
  "personId": "<id del CRM>",
  "grantedAt": 1807100000000
}
```

- `at`: el día del evento (el primero con marca que cuenta), para que la ficha
  diga cuándo se consiguió de verdad. `grantedAt`: cuándo lo escribió la función.
- **Lo escribe solo la Cloud Function** (Admin SDK). Reglas:

  ```json
  "panueloAwards": {
    "$uid": {
      ".read": "auth != null && auth.uid === $uid",
      ".write": false
    }
  },
  "panueloOwners": { ".read": false, ".write": false }
  ```

- Es **la verdad** de las piezas de asistencia. Lo que el Panel cuente
  («cuántas se han dado») se cuenta aquí (lectura del Panel: Integración D).

### 4.3 `/panueloOwners/{personId}` — una ficha, una cuenta (nuevo)

```json
{ "uid": "<uid>", "at": 1807100000000 }
```

Solo la función lo lee y lo escribe. Quitarlo a mano libera la ficha.

### 4.4 `/users/{uid}/panuelo/items/{id}` — el reflejo

La app copia cada award como `{ "at": …, "via": "attendance" }` para que la
colección, la colocación y la mezcla entre móviles sigan como siempre. **Una
pieza cuyo `grant.type` es `attendance` solo cuenta como tenida si está en
`/panueloAwards/{uid}`** (`reconcileAwards`, pura): escribirse el reflejo a mano
no da nada. Si no se pudo leer `/panueloAwards` (sin red), se respeta lo que
había en el móvil.

`PanueloVia` gana `attendance`.

### 4.5 Callable `panueloClaimAttendance` (Cloud Function, este repo)

```ts
// petición (requiere Firebase Auth)
{ personId?: string }   // pista: la ficha de la sesión de Comunica, o la elegida en «¿De quién es?»

// respuesta
| { status: 'ok'; personId: string; granted: string[]; revoked: string[];
    awards: Record<string, Award> }
| { status: 'choose'; choices: { personId: string; name: string; delegation: string }[] }
| { status: 'no_match' }        // ese correo no está en el CRM
| { status: 'other_owner' }     // esa ficha ya es de otra cuenta
| { status: 'unavailable'; retryAfter?: number } // middleware o CRM caído: se reintenta en la siguiente apertura
```

### 4.6 Endpoint nuevo en `comunicaMiddleware`: `POST /v1/panuelo/attendance`

Servidor a servidor. Cabecera `Authorization: Bearer <MW_PANUELO_SECRET>`
(secreto en Vercel y en Secret Manager de Firebase; nunca en la app).

```json
// petición
{ "idToken": "<pase de Firebase>", "personId": "<opcional>", "eventIds": ["…"] }

// respuesta 200
{
  "generatedAt": "2027-04-14T10:00:00+02:00",
  "personId": "<id>",
  "attended": {
    "<eventId>": [ { "day": "2027-04-12", "mark": "yes" } ]
  }
}
```

- Verifica el idToken **con la misma función que `app-account`** (incluido el
  arreglo de `email_verified` de cuentas de Workspace del 14/11).
- Errores como `app-account`: 422 `validation` con `reason` `bad_app_token`,
  `no_match` o `choose` (lista `PersonChoice`). 503 `crm_unavailable`.
- Solo la ficha resuelta (nunca hijos), solo los `eventIds` pedidos (≤ 100),
  solo marcas puestas. Sin datos personales.
- No crea sesión ni tokens. Límite de peticiones propio.

---

## 5. Fases

Orden: **F0 → F1 → (F2 ∥ F3) → F4 → F6**, y **F5 puede empezar tras F1** con la
simulación del Laboratorio, sin servidores. F7 y F8 cuando se quiera.

| Fase | Qué                                                     | Repo                   | Modelo | OTA                       |
| ---- | ------------------------------------------------------- | ---------------------- | ------ | ------------------------- |
| F0   | Comprobar supuestos contra el servidor real             | este + middleware (leer) | Sonnet | —                         |
| F1   | Contrato, tipos y lógica pura                           | este                   | Sonnet | ✅ solo JS                |
| F2   | Cloud Function y reglas                                 | este (`functions/`)    | Opus   | — despliegue de Firebase  |
| F3   | Endpoint del middleware                                 | `comunicaMiddleware`   | Opus   | — despliegue de Vercel    |
| F4   | Reclamar y reflejar en la app (fondo + estado)          | este                   | Sonnet | ✅ solo JS                |
| F5   | El desvelado una a una                                  | este (+ visor)         | Opus   | ✅ solo JS                |
| F6   | «Colocarlas», caja, tutorial y documentación            | este                   | Sonnet | ✅ solo JS                |
| F7   | La pieza en el evento (área nativa)                     | este                   | Haiku  | ✅ solo JS                |
| F8   | Panel: asignar eventos y contar                         | `mcmpanel`             | Sonnet | —                         |

### F0 — Comprobar antes de construir (sin código)

Leer en `comunicaMiddleware` (`docs/ACCESO-APP.md`, el handler de
`app-account`, el de `GET /v1/events/:id/roll` y la consulta del calendario) y
apuntar aquí, en esta sección, las respuestas:

1. ¿Se puede sacar la asistencia de una ficha **por lista de eventos** en una
   consulta al CRM? ¿Las marcas de evento salen de la misma tabla que
   `marksBySession`?
2. ¿La verificación del idToken de `app-account` es una función reutilizable?
3. ¿Los monitores inscritos aparecen con marca en `EventRoll.people`?
4. Cómo consigue un admin el **id de un evento** hoy (¿sale en el enlace de
   compartir de `ShareEventButton`? ¿en la web del plugin?). Lo necesita F8 y la
   carga a mano mientras tanto.
5. Que el proyecto de Firebase admite una función `onCall` más y Secret
   Manager (ya está en Blaze por las programadas).

Si la 1 o la 2 salen mal, F2 arranca con la opción B (§1) y F3 se replantea.

### F1 — Contrato, tipos y lógica pura

Archivos:

- `mcm-app/types/panuelo.ts`: `PanueloGrant` gana
  `{ type: 'attendance'; events: string[]; marks?: SetMark[]; minDays?: number }`
  (los valores de marca copiados como literales: `types/` no importa del área);
  `PanueloVia` gana `'attendance'`; tipo `PanueloAward`; `PanueloCommand`
  `reveal` gana `still?: boolean`.
- `mcm-app/utils/panuelo.ts`: `sanitizeCatalog` acepta `attendance`;
  `sanitizeAwards`; `reconcileAwards(state, awards, catalog)` (añade lo
  concedido, quita lo que no esté respaldado, respeta `gone`);
  `pendingAutoGrants` sigue ignorando `attendance`.
- `mcm-app/utils/panueloAttendance.ts` (**nuevo, puro, sin imports de la app**,
  porque se copia a la función): `attendanceEventIds(catalog)`,
  `qualifies(grant, marksByDay)`, `computeAwards(catalog, attended, existing, now)`
  → `{ granted, revoked, awards }` con la regla de los 7 días.
- `mcm-app/firebase-seed/panuelo.json`: una pieza de ejemplo `attendance`
  apuntando a `f-evt-salida` (evento del servidor falso,
  `services/comunica/fake/fixtures.ts`).
- `npm run build:panuelo` (toca `types/panuelo.ts`) y commitear
  `panuelo-3d/generated/viewer.bundle.json`.

Tests: `__tests__/panueloAttendance.test.ts` (marcas, `minDays`, varios
eventos, revocación dentro y fuera de plazo, retroactivo), ampliar
`__tests__/panuelo.test.ts` (saneado, `reconcileAwards`: un reflejo sin award
no cuenta), `panueloViewerBundle.test.ts` en verde.

### F2 — Cloud Function y reglas (este repo, servidor)

Archivos:

- `mcm-app/functions/src/panueloAttendance.ts` (nuevo) y exportarla en
  `functions/src/index.ts`: `onCall` v2, `us-central1`, `enforceAppCheck` no
  (no hay App Check), `secrets: ['MW_PANUELO_SECRET']`, parámetro
  `COMUNICA_API_URL`. Pasos: exigir `request.auth`; sacar el idToken crudo de la
  cabecera; leer `/panuelo/data/items` y sacar los `eventIds`; si no hay, `ok`
  vacío sin llamar a nadie; llamar al middleware (F3); comprobar
  `/panueloOwners/{personId}` en transacción; `computeAwards`; escribir con un
  `update()` multi-ruta `/panueloAwards/{uid}/…`; límite de 1 llamada por
  minuto y uid (`/panueloClaims/{uid}/lastAt`, cerrado a todos). Registrar
  `granted`/`revoked` con `logger`, sin nombres.
- `mcm-app/functions/scripts/sync-panuelo-attendance.mjs` (nuevo, como el de
  ICS) y su llamada en `functions/package.json` (`build`).
- `mcm-app/database.rules.json`: `panueloAwards`, `panueloOwners`,
  `panueloClaims` (§4.2).
- Mientras F3 no esté: modo B detrás de una constante (la app manda además
  `comunicaAccessToken`, la función llama a `/v1/me/profiles` y
  `/v1/profiles/:self/calendar`). Se borra al llegar F3.

Tests: `__tests__/databaseRules.test.ts` (nadie escribe `panueloAwards` ni
`panueloOwners`; el dueño lee el suyo y no el de otro). Guardarraíl nuevo
`__tests__/panueloAwardsReadOnly.test.ts`: ningún fichero de `app/`,
`components/`, `hooks/`, `services/` ni `utils/` escribe en `panueloAwards`
(grep, como `tabsLayoutWebSafety`). La lógica ya está probada en F1.

Despliegue (lo hace el propietario): `firebase functions:secrets:set
MW_PANUELO_SECRET` y `firebase deploy --only functions:panueloClaimAttendance,database`.
Documentar en `docs/desarrollo/FIREBASE_REGLAS.md`.

### F3 — Endpoint del middleware (`comunicaMiddleware`)

Fuera de esta sesión. Entregar como encargo con §4.6 tal cual:

- Ruta `POST /v1/panuelo/attendance`, autenticación por secreto compartido,
  reutilizando la verificación del idToken de `app-account` y la resolución de
  fichas («¿Quién eres?»).
- Consulta de marcas de evento para una ficha y una lista de eventos.
- Tests del middleware, variable `MW_PANUELO_SECRET` en Vercel, doc en
  `comunicaMiddleware:docs/`.
- En **este** repo: añadir la ruta al contrato (`services/comunica/contract.ts`)
  solo como documentación de tipos si la función la reutiliza vía script de
  copia; la app no la llama nunca.

### F4 — Reclamar y reflejar en la app

Archivos:

- `mcm-app/services/panueloAwards.ts` (nuevo): `claimAttendance(personId?)`
  con `httpsCallable` de `firebase/functions` (va dentro del paquete
  `firebase`, es JS), `fetchAwards(uid)`, `subscribeAwards(uid)`. Con el
  servidor falso de Comunica, `claimAttendance` se resuelve en el móvil con
  `computeAwards` y el calendario falso (y no escribe en Firebase).
- `mcm-app/utils/authHelpers.ts`: leer `/panueloAwards/{uid}` junto a
  `fetchPanuelo`.
- `mcm-app/hooks/usePanuelo.ts`: aplicar `reconcileAwards` al mezclar con la
  nube; no coser solas las piezas `attendance` (filtro en el efecto `loose`);
  exponer `newFromAwards` y `claim()`.
- Para usar el estado fuera de la pantalla: sacar de `usePanuelo` lo justo
  (leer/guardar `@panuelo_state` y `@panuelo_seen`) a
  `mcm-app/services/panueloStore.ts`, para que el componente de fondo y la
  pantalla compartan almacenamiento sin montar el hook dos veces.
- `mcm-app/components/panuelo/PanueloAwardsBackground.tsx` (nuevo, no pinta):
  condiciones de §3, reclama, guarda el reflejo, y abre `/panuelo?nuevas=1`
  cuando toca. Montado en `mcm-app/app/_layout.tsx` junto a
  `ComunicaBackground`.
- «¿De quién es este pañuelo?» (respuesta `choose`): una hoja sencilla con la
  lista, del mismo patrón que `PanueloStageSheet`; se recuerda la elección en
  AsyncStorage (`@panuelo_person`).
- Analítica: `panuelo_pieza_conseguida { clase, via: 'attendance' }` por cada
  `granted`.

Tests: `__tests__/usePanuelo.test.tsx` (award entra, reflejo sin award se cae,
revocado sale, móvil nuevo no re-presenta lo antiguo), test nuevo del fondo
(throttle de 6 h, no actúa sin uid, sin piezas `attendance` ni con el pañuelo
cerrado; abre la ruta una sola vez por arranque).

### F5 — El desvelado una a una

Archivos:

- `mcm-app/components/panuelo/PanueloTutorial.tsx`: props `nextLabel`,
  `finishLabel`, `secondaryLabel`/`onSecondary` (por defecto lo de hoy), y un
  `pageLabel` para el anuncio («Pieza 2 de 3» en vez de «Paso»).
- `mcm-app/hooks/usePanueloTutorialStage.ts`: recibir `sections` y `catalog`
  por argumento (hoy lee `PANUELO_TUTORIAL` y el catálogo de muestra) y la
  orden `reveal` con `still`.
- `mcm-app/utils/panuelo.ts`: `newPiecesSections(catalog, state, ids, awards)`
  (pura) → secciones con `example: { color, pieces: lo cosido, reveal: id }`.
- `mcm-app/app/panuelo.tsx`: modo «nuevas» (por `?nuevas=1` o porque hay
  piezas `attendance` sin ver al abrir): mismo mecanismo que el tutorial
  (`headerShown: false`, mismo visor), después del tutorial y antes que el
  canje o el cambio de etapa. Marca vista cada pieza al enseñarla.
- `mcm-app/panuelo-3d/src/main.ts`: `reveal` con `still` (sin giro, fundido de
  `durations.base`). `npm run build:panuelo`.
- Laboratorio (`mcm-app/components/preview-channel/PanueloLabPanel.tsx`):
  botón «Simular piezas por asistencia» (`/panuelo?demo=asistencia`), que
  concede dos piezas de muestra como `attendance` en local y abre la secuencia.

Tests: ampliar `__tests__/panueloScreen.test.tsx` (con piezas sin ver sale la
secuencia; «Siguiente» avanza; la última dice «Colocarlas»; la X deja vistas
solo las enseñadas; el tutorial va antes); `newPiecesSections` en
`panuelo.test.ts`; `__tests__/panueloTutorialScarf.test.tsx` sigue verde con
las props nuevas. Comprobar `noLooseMotion.test.ts` y
`noNewMagicNumbers.test.ts`.

Diseño: `design.md` §6 (muelle solo para celebración, `useReducedMotion`),
§8 (sin emoji: `PanueloStageBurst` ya lo quita), copy corto y sin
exclamaciones: «Por ir a Pascua Joven», no «¡Enhorabuena!».

### F6 — «Colocarlas», tutorial y documentación

- `mcm-app/app/panuelo.tsx`: al acabar con «Colocarlas», modo decorar + filtro
  `unplaced` + primera pieza seleccionada; al coserla, `reveal` con su
  presentación (o `still`).
- `mcm-app/constants/panueloTutorial.ts`: en «Chapas y pines», una fila «Por ir
  a una actividad» («Cuando te pasan lista, te llega sola»). Es función nueva:
  subir `PANUELO_TUTORIAL_VERSION` a 4.
- Docs: `docs/funcionalidades/PANUELO.md` («Cómo se consigue una pieza»,
  «Datos», el desvelado), `docs/contratos/PANUELO_CONTRATO.md` (§4 de este
  plan), `docs/planes/PLAN_PANEL_PANUELO.md` (fila nueva en Fases),
  `mcm-app/CHANGELOG.md`. Mover este plan a `archivo/` en el commit que cierre
  la última fase que se haga.

### F7 — La pieza en el evento (área nativa, opcional)

Lo que ya sugería `PANUELO.md` («En el hub de cada evento»):

- Monitores, `mcm-app/components/comunica/eventos/EventScreen.tsx`: una fila
  discreta «Este evento da una pieza: Chapa de Pascua» con su dibujo
  (`PanueloItemArt`). Recuerda que pasar lista importa.
- Familias, `mcm-app/components/comunica/actividades/EventDetailScreen.tsx`: la
  pieza en silueta hasta conseguirla (nunca si es `secret`).
- Solo con el pañuelo disponible. Lee el catálogo con `useFirebaseData`.
  Territorio Comunica: sin color nuevo, la pieza lleva sus propios colores.

### F8 — Panel (`mcmpanel`)

Fuera de esta sesión. En el editor de piezas (Fase 6 de
`PLAN_PANEL_PANUELO.md`): tipo de concesión «Por asistencia» con la lista de
ids de evento (pegados al principio; con selector cuando el middleware ofrezca
`GET /v1/events` al Panel) y «Concedidas: N» leyendo `/panueloAwards`
(necesita la autenticación real del Panel, Integración D). Escribir el
catálogo ya funciona hoy (`legacyPanelWrites`). Mientras no exista: el
propietario edita `/panuelo/data` a mano o con el seed.

---

## 6. Lo que NO entra

- Notificación push «Tienes una pieza nueva» (el middleware ya avisa a
  móviles registrados; se puede añadir después con el mismo `granted`).
- Piezas por asistencia a los **sábados** (rachas): es la Fase 9 de
  `PLAN_PANEL_PANUELO.md` (logros calculados).
- Validar en servidor los **códigos** y los **intercambios**: la función de F2
  es el sitio, pero es otro plan.
- Que un padre vea o gestione el pañuelo de un hijo.
- Sacar el pañuelo del Laboratorio (Fase 4 de `PLAN_PANEL_PANUELO.md`). Este
  plan funciona igual dentro y fuera.

---

## 🔒 Decisiones del usuario

1. **¿Se acepta la vía C** (endpoint nuevo en `comunicaMiddleware` + Cloud
   Function en este repo)? Es la única en la que ni se inventa la asistencia
   ni se escribe la pieza desde el móvil, y la ficha sale de la cuenta de la
   app y no de la sesión que haya abierta. **Recomendación: sí**, con la vía B
   como puente si el middleware tarda.
2. **¿Qué cuenta como haber ido?** **Recomendación:** una marca «Sí» o
   «Parcial» en cualquier día del evento. Cada pieza puede pedir más días
   (`minDays`).
3. **Si los monitores corrigen la lista después**: **Recomendación:** la pieza
   se retira sola si la corrección llega en los **7 días** siguientes a
   concederla; después se queda (lo conseguido no se pierde) y solo se quita a
   mano.
4. **Una ficha, una cuenta**: la primera cuenta que reclama las piezas de una
   persona se queda con ellas. Evita que un hermano, entrando por el correo
   compartido de la familia, se las lleve a otra cuenta. **Recomendación:
   sí**; si alguien cambia de cuenta, se libera a mano.
5. **Al acabar el desvelado, ¿las piezas se cosen solas o esperan en la
   caja?** **Recomendación: en la caja**, y «Colocarlas» abre el modo decorar
   con ellas a mano. Es lo que pediste y es más bonito ponerlas uno.
6. **¿Quién asigna una pieza a un evento?** **Recomendación: el Panel**
   (quien crea las piezas). Hasta que tenga editor, a mano en Firebase con el
   id del evento. Dejar que coordinación lo haga desde la app es posible, pero
   exige otra escritura con permisos en el servidor.
