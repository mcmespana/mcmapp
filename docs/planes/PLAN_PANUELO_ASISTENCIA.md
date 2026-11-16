# Plan — Piezas del pañuelo por asistencia

> **Estado (2026-11-16, tarde): EN CURSO.** Hecho lo que vive en este repo
> y no necesita servidor: **F1** (tipos y lógica pura), **F1b** (test del
> seed y `npm run panuelo:subir`), **F5** (el desvelado, con la simulación
> del Laboratorio) y **F6** («Colocarlas» y documentación; el tutorial
> espera a F4, ver abajo). **Pendiente:** F0 (comprobar el middleware),
> F2 (Cloud Function y reglas), F3 (endpoint del middleware), **F4**
> (reclamar y reflejar: el punto de enganche está marcado con `// F4:` en
> `mcm-app/services/panueloAwards.ts`, `loadAwards`), F7 y F8. Sin servidor,
> una pieza por asistencia no le llega a nadie: solo se ve con la simulación.
> No se archiva hasta cerrar la última fase que se haga.
>
> **Diferencias con lo escrito abajo (manda el código):**
>
> 1. **La pieza de ejemplo no va en `firebase-seed/panuelo.json`**: desde
>    hoy ese catálogo solo lleva piezas de verdad (con foto y `.glb`; lo
>    vigila un test). Hay **tres piezas de prueba** por asistencia (chapa,
>    pin y medalla, eventos `f-evt-salida`, `f-evt-convivencia`,
>    `f-evt-pascua` del servidor falso) en `constants/panueloEjemplo.json`,
>    y solo entran en el catálogo mientras hay simulación.
> 2. **La simulación no pasa por el servidor falso de Comunica**: es un
>    sustituto local (`@panuelo_awards_simulados`, `{ attended, awards }`)
>    con la forma de `/panueloAwards/{personId}`, calculado con
>    `computeAwards`. Botones del Laboratorio: «Simular asistencia a
>    <evento>», «Simular que la quitan: <evento>» y «Borrar la simulación».
>    F4 solo cambia `loadAwards()`.
> 3. **No hace falta `?nuevas=1`**: la pantalla empieza el desvelado sola
>    cuando hay piezas por asistencia sin ver en la caja. F4 puede abrir
>    `/panuelo` sin más.
> 4. **`usePanueloIntro`** (nuevo) junta tutorial y desvelado para la
>    pantalla; `usePanueloTutorialStage` recibe `sections`, `catalog` y el
>    pañuelo de `base`; `PanueloTutorial`, `nextLabel`/`finishLabel`/
>    `secondaryLabel`/`pageLabel`/`catalog`; `PanueloTutorialHeader`,
>    `title`/`closeLabel`; `PanueloStageBurst`, `tint`. Sin «muelle de
>    celebración» aparte: ya anima el `reveal` del visor.
> 5. **Lo retirado se avisa con un toast** (una vez, cuando la pantalla está
>    libre), no con una línea fija en la pantalla. Se recuerda en
>    `@panuelo_retiradas` hasta enseñarlo.
> 6. **`reconcileAwards` no toca `via: demo`** (las de muestra del
>    Laboratorio). Cualquier otra pieza `attendance` sin award se quita,
>    también si alguien la apuntó a mano con `via: manual`.
> 7. **`minDays` cuenta días de UN mismo evento**, no sumando eventos.
> 8. **El script es `scripts/panuelo-subir.js`** (CommonJS como los demás
>    scripts, para probar `planUpload` con Jest), no `.mjs`. Opciones:
>    `--dry-run`, `--yes`, `--export`, `--project`, `--instance`. No se ha
>    probado contra Firebase (aquí no hay credenciales): solo `--dry-run` y
>    una CLI de mentira.
> 9. **Adelantado de F4**: analítica `panuelo_pieza_retirada` y vía
>    `attendance`; `syncPanueloRevoked` (borra en la nube lo retirado);
>    reflejo en `usePanuelo` al abrir y tras juntar con la nube.
> 10. **El tutorial no cambia todavía**: «solo lo que la app hace hoy», y hoy
>     nadie recibe piezas por asistencia. Con F4: fila «Por ir a una
>     actividad» en «Chapas y pines» («Cuando te pasan lista, te llega sola.
>     Si se corrige la lista, se quita.») y `PANUELO_TUTORIAL_VERSION` → 5.
>     Se apoya en el pañuelo tal como está hoy
>     ([`../funcionalidades/PANUELO.md`](../funcionalidades/PANUELO.md), contrato
>     en [`../contratos/PANUELO_CONTRATO.md`](../contratos/PANUELO_CONTRATO.md)) y
>     en el pasar lista del área nativa de Comunica
>     ([`area-nativa/04-pasar-lista.md`](area-nativa/04-pasar-lista.md),
>     [`area-nativa/07-eventos.md`](area-nativa/07-eventos.md)).
>     Es la primera pieza que se concede **en servidor**: adelanta la Fase 7 de
>     [`PLAN_PANEL_PANUELO.md`](PLAN_PANEL_PANUELO.md) («canje y reparto validados
>     en servidor») para este caso concreto.

## Lo que pidió el usuario

1. A ciertos eventos se les asigna una pieza (chapa, pin o medalla). Cuando a
   un chaval **le marcan la asistencia** en ese evento —los monitores ya pasan
   lista en el área nativa de Comunica—, la consigue.
2. La siguiente vez que entra en la app y tiene piezas nuevas, le sale **una
   animación con la explicación de cada pieza nueva, una por una**, dándole a
   «Siguiente». Al terminar ya puede **colocarlas** en el pañuelo.

Y al contestar las decisiones (2026-11-16):

3. **La pieza sigue siempre a la asistencia**, sin plazos: si la marcan tarde,
   llega cuando la marquen; si la corrigen, se quita. Habrá gente apuntada
   tarde o sin ficha al principio.
4. **La pieza es del niño** (de la ficha de quien fue), **nunca del padre**.
   Si el padre entra en Comunica y ve a su hijo, la pieza no va a su pañuelo.
5. La pieza de cada evento la asigna el Panel; mientras no tenga editor,
   **se hace con IA desde una sesión como esta** y el usuario la sube sin
   complicarse.

---

## 0. Lo que hay hoy (verificado en el código)

### Las identidades: la cuenta de la app, la ficha y «soy yo» frente a «veo a mi hijo»

| Lado                       | Quién es                                                                                                                                                                                                  | Dónde                                                                                                          |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Pañuelo                    | El **uid de Firebase Auth** (Google/Apple). Sin sesión, el pañuelo vive solo en el móvil                                                                                                                  | `hooks/usePanuelo.ts` (`useAuth().user.uid`), nodo `/users/{uid}/panuelo`                                      |
| Comunica: quien ha entrado | **`Me.personId`** (`GET /v1/me`) = **`profiles.self.id`** (`GET /v1/me/profiles`). Es la ficha con la que se entró: por la cuenta de la app, código de correo, DNI o enlace                               | `services/comunica/contract.ts` (`Me`, `MyProfiles`), `services/comunica/session.ts`                           |
| Comunica: a quién se ve    | **`activeId`** de `useActiveProfile` (`hooks/comunica/useActiveProfile.tsx`): `self` o uno de `profiles.children`. Es la barra «Viendo a · Lucía ▾» (`components/comunica/perfiles/ActiveProfileBar.tsx`) | Se recuerda en el almacén del área; solo elige qué `pid` se pide en `/v1/profiles/:pid/…`, **no concede nada** |
| Hijos                      | `profiles.children`: los que tienen una relación vigente de padre, madre, tutor o cuidador **en el CRM** con quien ha entrado. No salen del correo                                                        | `MyProfiles` en el contrato                                                                                    |
| El puente cuenta ↔ ficha   | `POST /v1/auth/app-account`: la app manda el **idToken de Firebase**; el middleware lo verifica y busca las fichas **con ese correo** (si son varias, «¿Quién eres?», `PersonChoice`)                     | `services/comunica/appAccount.ts`; servidor: `comunicaMiddleware:docs/ACCESO-APP.md`                           |

Consecuencias que mandan en el diseño:

- **«Soy yo» es `self`; «veo a mi hijo» es `activeId ≠ self`.** El pañuelo
  ya usa `profiles.self` para el color (`hooks/usePanueloScarf.ts`) e ignora la
  barra «Viendo a». Para las piezas, igual: **nunca** se usa `activeId`.
- **Una sesión de Comunica en el móvil no prueba nada sobre el uid**: se
  puede entrar por código, DNI, enlace o como otra ficha del mismo correo (un
  padre y sus hijos comparten correo a menudo). Para conceder piezas manda la
  ficha que el **middleware** saca del idToken, no la sesión del móvil.
- **El dueño de `/users/{uid}` puede escribir lo que quiera en su nodo**
  (`database.rules.json`). Por eso una pieza de asistencia **no puede vivir
  solo en `/users/{uid}/panuelo/items`**.

### La asistencia

- Listas de **sábados** (`/v1/sessions/:sid/groups/:gid/roll`) y de **eventos**
  (`GET/PUT /v1/events/:id/roll`, `EventRollWrite`). Este plan es de
  **eventos**.
- Una marca de evento es por **día** y vale `yes` · `partial` · `no_justified`
  · `no_unjustified` (`MARKS`). Quitar una marca la borra en el CRM.
- Guardar una lista **no espera al CRM** (cola del móvil y del servidor): la
  asistencia puede llegar al CRM minutos después.
- La propia persona —y su padre, viendo al hijo— ve la asistencia en
  `GET /v1/profiles/:pid/calendar` (`CalendarSession.attendance`, 14 meses
  atrás), solo de eventos con inscripción no cancelada.
- Los ids de evento son del CRM, opacos. **El mismo encuentro en dos
  delegaciones son dos eventos distintos.**

### El pañuelo

- `grant.type` hoy: `all` · `code` · `manual`. `PanueloVia`: `all` · `code` ·
  `manual` · `demo` · `trade`.
- Piezas «sin ver»: `@panuelo_seen` (AsyncStorage) y `unseen` en `usePanuelo`.
- Al abrir `/panuelo`, una pieza sin sitio **se cose sola** (efecto `loose`) y
  se presenta en 3D una a una (`nextUnseen` + `reveal`).
- El **tutorial** (`components/panuelo/PanueloTutorial.tsx`) ya es la pieza
  del desvelado: mismo visor, puntos de página, botón único, `sections` por
  prop y un `example` por paso (`usePanueloTutorialStage`).
- La orden `reveal` del visor **no mira «reducir movimiento»**.
- Está en el Laboratorio Alpha (`hooks/usePanueloAvailable.ts`).

### Cómo se sube hoy el catálogo

- `mcm-app/firebase-seed/panuelo.json` es el nodo `/panuelo/data` y, además,
  el **catálogo empaquetado** de respaldo (`constants/panueloCatalog.ts`).
- `firebase-seed/README.md`: importar el fichero entero como `data` y cambiar
  `/panuelo/updatedAt` a mano. **Importar en la consola reemplaza el nodo
  entero** (lo avisa también `docs/funcionalidades/EVENTOS.md`): si el Panel o
  alguien añadió una pieza en Firebase que no está en el seed, se pierde.
- Reglas: `/panuelo` se lee por todos y solo se escribe con
  `_config/legacyPanelWrites`. La CLI de Firebase del propietario
  (`firebase login`, proyecto `mcmapp-39b71` en `mcm-app/.firebaserc`) escribe
  como administrador y no pasa por las reglas.
- No hay ningún script de subida en `mcm-app/scripts/`.

### Servidor que ya tenemos

- `mcm-app/functions/` (Cloud Functions v2, `us-central1`, Blaze,
  `firebase-admin`). Ya copia lógica pura de la app con un script
  (`functions/scripts/sync-ics-parser.mjs`).
- El middleware (`comunicaMiddleware`, otro repo) es el único que habla con el
  CRM y el único que verifica el idToken contra las fichas.

---

## 1. Arquitectura (vía C, aceptada)

```
Monitor pasa lista (área nativa) ─► middleware ─► cola ─► CRM
                                                          ▲
App al abrirse (si hay piezas de asistencia en el catálogo)│
  └─ callable panueloClaimAttendance  ──(servidor a servidor, secreto)──┐
       Cloud Function (este repo, Admin SDK)                            │
         1. uid + idToken de quien llama (Firebase Auth)               │
         2. POST /v1/panuelo/attendance { idToken, personId?, eventIds }┘
            → el middleware verifica el idToken, resuelve LA FICHA PROPIA
              (correo ↔ fichas, nunca hijos) y devuelve SUS marcas
         3. Ata la cuenta a esa ficha (/panueloAccounts, /panueloOwners)
         4. Recalcula y escribe /panueloAwards/{personId}  (la pieza es de la ficha)
  └─ La app lee /panueloAwards/{su personId}, lo refleja en su estado y
     presenta lo nuevo, una a una, con «Siguiente» → «Colocarlas»
```

**Por qué C** (contestado: aceptada). El cliente ni se inventa la asistencia
(la pide el servidor) ni se escribe la pieza (nodo cerrado salvo al Admin SDK),
y la ficha sale del idToken verificado, no de la sesión que el móvil tenga
abierta. Si el endpoint del middleware tarda, la función puede empezar por la
vía B (token de Comunica del móvil, solo `self`) sin tocar la app.

**Por qué tirar del cliente.** El momento de conceder es «la siguiente vez que
entra». Y tirar resuelve solo los casos difíciles: la pieza **espera** a quien
aún no tiene cuenta (se calcula cuando reclama, desde lo que hay en el CRM) y
cualquier corrección se ve en la siguiente reclamación.

### 1.1 Identidad: la pieza es de la ficha

- **La verdad es por ficha**: `/panueloAwards/{personId}/{itemId}`. El uid solo
  decide **quién la ve en su pañuelo**.
- **Cada cuenta de la app tiene como mucho una ficha propia, y cada ficha como
  mucho una cuenta**: `/panueloAccounts/{uid} = { personId }` y
  `/panueloOwners/{personId} = { uid }`, escritos solo por la función en una
  transacción.
- **Cuál es la ficha propia de una cuenta**: la que resuelve el middleware con
  la regla de `app-account` (fichas **con el correo** de la cuenta). Nunca un
  hijo por relación del CRM: el endpoint no mira `children`.
  - Un solo resultado: esa.
  - Varios (padre e hijo con el mismo correo): `choose`. La app manda como
    pista **`Me.personId` de su sesión de Comunica** (quien entró, nunca el
    `activeId` de «Viendo a»); si no hay sesión, pregunta una vez «¿De quién
    es este pañuelo?» con la lista y lo recuerda.
- **Padre que ve a su hijo en Comunica**: no cambia nada. Su pañuelo es el de
  su ficha propia; las piezas del hijo **no** le llegan. Como mucho las ve en
  **modo lectura** en la ficha del evento de familias (F7): «Lucía tiene la
  Chapa de Pascua», calculado con el calendario que el padre ya puede ver
  (`/v1/profiles/:pid/calendar` + el catálogo). Ni la reclama, ni la coloca,
  ni abre el pañuelo del hijo.
- **Niño sin cuenta propia todavía**: la pieza le espera. No se guarda nada
  hasta que reclama; cuando inicie sesión con una cuenta cuyo correo esté en
  su ficha (la suya, o la de la familia eligiéndose a sí mismo en «¿De quién
  es este pañuelo?»), la primera reclamación le da todas las de los eventos a
  los que fue, sin límite de fecha.
- **Si un padre se queda por error la ficha del hijo** (correo compartido y
  elige al hijo): esa cuenta queda atada al hijo. Se libera a mano borrando
  `/panueloOwners/{personId}` y `/panueloAccounts/{uid}` (documentado en
  `FIREBASE_REGLAS.md`). Las piezas no se pierden: son de la ficha.
- **Límite conocido**: si el niño crea su cuenta con un correo que no está en
  su ficha, el middleware contesta `no_match`. Se arregla poniendo ese correo
  en el CRM, como para entrar en Comunica.

---

## 2. Los casos

| Caso                                                            | Qué pasa                                                                                                                                                                    |
| --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Qué cuenta como «ha ido»**                                    | Una marca `yes` o `partial` en **cualquier día** del evento (contestado, «por ahora»). Configurable por pieza con `marks` y `minDays` para cuando cambie                    |
| **Padre viendo a su hijo**                                      | Ver §1.1: la pieza es del hijo; el padre, como mucho, la ve en lectura en la ficha del evento                                                                               |
| **Varias fichas con el mismo correo**                           | `choose`; pista `Me.personId`; si no, «¿De quién es este pañuelo?» una vez. El middleware comprueba que la ficha es de ese correo                                           |
| **Una ficha, una cuenta**                                       | La primera cuenta que reclama una ficha se queda con ella; otra recibe `other_owner` («Estas piezas ya están en otra cuenta»). Se libera a mano                             |
| **Sin cuenta de la app**                                        | No hay piezas por asistencia en ese móvil; nada se pierde. Aviso discreto en el pañuelo: «Inicia sesión para recibir las piezas de las actividades»                         |
| **Niño sin cuenta o apuntado sin ficha al principio**           | Espera. En cuanto tenga ficha con la marca y entre con su cuenta, le llega                                                                                                  |
| **Piezas de eventos pasados**                                   | Asignar una pieza a un evento ya celebrado funciona igual                                                                                                                   |
| **Asistencia marcada tarde** (colas, lista pasada días después) | Llega en la siguiente reclamación después de que el CRM la tenga. **Sin límite de tiempo**                                                                                  |
| **Asistencia corregida** (quitan la marca o pasa a «no»)        | La pieza **se quita**, sin límite de tiempo (contestado). Ver §2.1                                                                                                          |
| **Varios eventos dan la misma pieza**                           | `events` es una lista: con ir a uno basta. Una pieza se tiene una vez                                                                                                       |
| **Monitores**                                                   | Si están inscritos y les marcan, también la consiguen. Excluirlos (`roles`) no entra en la v1                                                                               |
| **Intercambios**                                                | Las piezas `attendance` **no se pueden intercambiar** (`tradeable` se fuerza a `false` al sanear): si no, quitar una pieza corregida tras un intercambio no tendría arreglo |
| **Servidor falso** (Laboratorio)                                | Con `comunicaApiTarget().kind === 'fake'` la reclamación se simula en el móvil contra el calendario falso, y el Laboratorio tiene «Simular piezas por asistencia»           |

### 2.1 Una pieza que se retira

La función recalcula en cada reclamación: **la pieza existe si y solo si la
asistencia la respalda hoy**. Si deja de respaldarla, borra su
`/panueloAwards/{personId}/{itemId}` y la devuelve en `revoked`. En la app
(`reconcileAwards`, pura):

- **Estaba sin desvelar** (en la cola de «nuevas»): se cae de la cola, sin
  anuncio.
- **Ya desvelada, en la caja**: sale de la colección. Si no es `secret`, vuelve
  a verse en silueta como cualquier pieza que no se tiene.
- **Ya cosida en el pañuelo**: **se descose** (desaparece de su sitio; las
  demás no se mueven) y sale de la colección.
- En los dos últimos casos, la siguiente vez que se abre el pañuelo sale **una
  línea discreta, una sola vez**: «Ya no tienes la Chapa de Pascua: se corrigió
  la lista de Pascua Joven». Sin sonido ni háptica de error.
- **Si luego vuelven a marcarla**: llega como nueva (se desvela otra vez) y
  espera en la caja; no vuelve sola a su sitio antiguo.
- **Sin red** o sin poder leer `/panueloAwards`: no se quita nada (se respeta
  lo que había en el móvil).

---

## 3. El desvelado

### Cuándo salta

- **Al abrir la app**. Un componente de fondo, `PanueloAwardsBackground`,
  montado junto a `ComunicaBackground` en `app/_layout.tsx`, que solo actúa si:
  1. el pañuelo está disponible (`usePanueloAvailable`),
  2. hay uid de Firebase,
  3. el catálogo tiene al menos una pieza `attendance`,
  4. no se reclamó hace menos de **6 h** (o el usuario tira para refrescar en
     el pañuelo). La función limita además a 1 por minuto y uid.
- Si tras reclamar hay **piezas sin ver**, espera a que la app esté en primer
  plano en una pestaña (no en onboarding, ni en una pantalla abierta por
  enlace, ni con la entrada de Comunica) y abre **`/panuelo?nuevas=1`**. Una vez
  por arranque.
- **También al abrir el pañuelo**: si hay piezas sin ver, la misma secuencia,
  después del tutorial.

«Sin ver» = concedida y fuera de `@panuelo_seen`. En un móvil nuevo se da por
visto lo que ya estaba concedido **antes** de esta reclamación; lo que la
función acaba de conceder (`granted`) sí se presenta.

### Cómo se ve (reutilizando el tutorial y el visor)

Es el **modo tutorial de `/panuelo` alimentado con las piezas nuevas**:

- `PanueloTutorial` recibe `sections` generadas desde las piezas
  (`newPiecesSections`) y los textos del botón por prop. Cada página: nombre de
  la pieza; «Por ir a {origin}» (o el nombre del evento); clase, rareza,
  descripción y «La conseguiste el 12 de abril de 2027»; «Pieza 2 de 3» con
  `PanueloPageDots`.
- Arriba, **el visor** con el pañuelo de la persona y la pieza presentándose
  con `reveal`.
- **Botón único: «Siguiente»**; en la última, **«Colocarlas»** («Colocarla» si
  es una). En la última, enlace secundario «Ahora no». La X cierra.
- Al pasar de página: `h.select`, muelle de celebración y `PanueloStageBurst`
  con el primer color de la pieza. En la primera, `h.formSuccess`.
- **«Colocarlas»**: modo decorar con el filtro «Sin poner» y la primera pieza
  nueva seleccionada. Las piezas de asistencia **esperan en la caja**
  (contestado): no se cosen solas.
- **«Ahora no» o X**: lo enseñado queda visto; lo demás sale la próxima vez
  que se abra el pañuelo.
- **Sin visor**: las mismas páginas con `PanueloItemArt`.

### Reducir movimiento y accesibilidad

- `useReducedMotion()`: sin muelle, sin confeti, cambio de página sin animar.
- Visor: `{ type: 'reveal', id, still?: boolean }`; con `still`, fundido corto
  sin giro. Lo manda la app desde `useReducedMotion()`. `npm run build:panuelo`.
- Anuncio por página («Pieza nueva, 2 de 3: Chapa de Pascua Joven. Por ir a
  Pascua Joven 2027.») y foco al título.

---

## 4. Contrato de datos propuesto

> Para `PANUELO_CONTRATO.md` en la última fase. Fuente de verdad futura:
> `types/panuelo.ts`.

### 4.1 Catálogo `/panuelo/data/items/{id}.grant` — tipo nuevo `attendance`

```json
{
  "type": "attendance",
  "events": ["<id de evento del CRM>", "<otro, de otra delegación>"],
  "marks": ["yes", "partial"],
  "minDays": 1
}
```

| Campo     | Oblig. | Notas                                                           |
| --------- | ------ | --------------------------------------------------------------- |
| `events`  | Sí     | 1–50 ids de evento del CRM (cadenas opacas). Con ir a uno basta |
| `marks`   | No     | Qué marcas cuentan. Por defecto `["yes", "partial"]`            |
| `minDays` | No     | Días con marca, como mínimo. Por defecto 1                      |

Sin `from`/`to`: manda la asistencia. Sin `events`, la pieza se descarta
entera. Una pieza `attendance` **nunca es intercambiable** (aunque diga
`tradeable: true`).

### 4.2 `/panueloAwards/{personId}/{itemId}` — lo concedido (nuevo)

```json
{
  "at": 1807000000000,
  "via": "attendance",
  "eventId": "<id del CRM>",
  "grantedAt": 1807100000000
}
```

- `at`: el primer día con marca que cuenta. `grantedAt`: cuándo lo escribió la
  función.
- **Lo escribe solo la Cloud Function.** Lo lee **la cuenta atada a esa
  ficha**:

  ```json
  "panueloAwards": {
    "$personId": {
      ".read": "auth != null && root.child('panueloAccounts').child(auth.uid).child('personId').val() === $personId",
      ".write": false
    }
  },
  "panueloAccounts": {
    "$uid": { ".read": "auth != null && auth.uid === $uid", ".write": false }
  },
  "panueloOwners": { ".read": false, ".write": false },
  "panueloClaims": { ".read": false, ".write": false }
  ```

- Es **la verdad** de estas piezas; lo que el Panel cuente se cuenta aquí.

### 4.3 `/panueloAccounts/{uid}` y `/panueloOwners/{personId}` (nuevos)

```json
// /panueloAccounts/{uid}
{ "personId": "<id>", "at": 1807100000000 }
// /panueloOwners/{personId}
{ "uid": "<uid>", "at": 1807100000000 }
```

Siempre a la vez, en transacción, solo la función. La app lee el suyo de
`panueloAccounts` para saber qué `panueloAwards` leer. Borrar los dos libera.

### 4.4 `/users/{uid}/panuelo/items/{id}` — el reflejo

La app copia cada award como `{ "at": …, "via": "attendance" }`. **Una pieza
`attendance` solo cuenta si está en `/panueloAwards/{su personId}`**
(`reconcileAwards`): escribirse el reflejo a mano no da nada, y lo que el
servidor ya no respalda se quita (§2.1). `PanueloVia` gana `attendance`.

### 4.5 Callable `panueloClaimAttendance` (Cloud Function, este repo)

```ts
// petición (requiere Firebase Auth)
{ personId?: string }   // pista: Me.personId de la sesión de Comunica, o la elegida en «¿De quién es?»

// respuesta
| { status: 'ok'; personId: string; granted: string[]; revoked: string[];
    awards: Record<string, Award> }
| { status: 'choose'; choices: { personId: string; name: string; delegation: string }[] }
| { status: 'no_match' }        // ese correo no está en el CRM
| { status: 'other_owner' }     // esa ficha ya es de otra cuenta
| { status: 'unavailable'; retryAfter?: number }
```

Si la cuenta ya está atada a una ficha, la pista se ignora y se usa esa.

### 4.6 Endpoint nuevo en `comunicaMiddleware`: `POST /v1/panuelo/attendance`

Servidor a servidor, `Authorization: Bearer <MW_PANUELO_SECRET>` (secreto en
Vercel y en Secret Manager; nunca en la app).

```json
// petición
{ "idToken": "<pase de Firebase>", "personId": "<opcional>", "eventIds": ["…"] }
// respuesta 200
{ "generatedAt": "…", "personId": "<id>",
  "attended": { "<eventId>": [ { "day": "2027-04-12", "mark": "yes" } ] } }
```

- Verifica el idToken **con la misma función que `app-account`**.
- Errores como `app-account`: 422 `bad_app_token` · `no_match` · `choose`.
  503 `crm_unavailable`.
- **Solo fichas con el correo del idToken, nunca hijos por relación**; solo
  los `eventIds` pedidos (≤ 100); solo marcas puestas. Sin datos personales.

---

## 5. Fases

Orden: **F0 → F1 → F1b → (F2 ∥ F3) → F4 → F6**; **F5 puede empezar tras F1**
con la simulación del Laboratorio. F7 y F8 cuando se quiera.

| Fase | Qué                                                                | Repo                     | Modelo | OTA                      |
| ---- | ------------------------------------------------------------------ | ------------------------ | ------ | ------------------------ |
| F0   | Comprobar supuestos contra el servidor real                        | este + middleware (leer) | Sonnet | —                        |
| F1   | Contrato, tipos y lógica pura                                      | este                     | Sonnet | ✅ solo JS               |
| F1b  | Asignar piezas con IA: test del seed y script de subida            | este                     | Sonnet | — (script)               |
| F2   | Cloud Function y reglas                                            | este (`functions/`)      | Opus   | — despliegue de Firebase |
| F3   | Endpoint del middleware                                            | `comunicaMiddleware`     | Opus   | — despliegue de Vercel   |
| F4   | Reclamar y reflejar en la app (fondo + estado + retiradas)         | este                     | Sonnet | ✅ solo JS               |
| F5   | El desvelado una a una                                             | este (+ visor)           | Opus   | ✅ solo JS               |
| F6   | «Colocarlas», tutorial y documentación                             | este                     | Sonnet | ✅ solo JS               |
| F7   | La pieza en el evento (área nativa) y vista de lectura para padres | este                     | Haiku  | ✅ solo JS               |
| F8   | Panel: asignar eventos y contar                                    | `mcmpanel`               | Sonnet | —                        |

### F0 — Comprobar antes de construir (sin código)

Leer en `comunicaMiddleware` y apuntar aquí:

1. ¿Se saca la asistencia de una ficha **por lista de eventos** en una
   consulta al CRM?
2. ¿La verificación del idToken de `app-account` es reutilizable, y la
   resolución de fichas devuelve **solo** las del correo (sin hijos)?
3. ¿Los monitores inscritos salen con marca en `EventRoll.people`?
4. **Cómo consigue el propietario el id de un evento** para dárselo a la IA
   (¿sale en el enlace de compartir de `ShareEventButton`? ¿en la web del
   plugin?). Si no hay forma cómoda, F1b añade «Copiar id del evento».
5. Que el proyecto admite otra `onCall` y Secret Manager.

Si la 1 o la 2 salen mal, F2 arranca con la vía B y F3 se replantea.

### F1 — Contrato, tipos y lógica pura

- `types/panuelo.ts`: `PanueloGrant` gana
  `{ type: 'attendance'; events: string[]; marks?: SetMark[]; minDays?: number }`;
  `PanueloVia` gana `'attendance'`; tipo `PanueloAward`; `reveal` gana
  `still?: boolean`.
- `utils/panuelo.ts`: `sanitizeCatalog` acepta `attendance` (y fuerza
  `tradeable: false`); `sanitizeAwards`; `reconcileAwards(state, awards,
catalog)` → `{ state, revoked }` (añade lo concedido; quita lo no
  respaldado, **también si está cosido**; respeta `gone`); `pendingAutoGrants`
  sigue ignorando `attendance`.
- `utils/panueloAttendance.ts` (**nuevo, puro, sin imports de la app**, se
  copia a la función): `attendanceEventIds(catalog)`,
  `qualifies(grant, marksByDay)`, `computeAwards(catalog, attended, existing,
now)` → `{ granted, revoked, awards }`. **Sin plazos**: lo que no cumple se
  revoca siempre.
- `firebase-seed/panuelo.json`: una pieza de ejemplo `attendance` con
  `f-evt-salida` (servidor falso).
- `npm run build:panuelo` y commitear el bundle.

Tests: `__tests__/panueloAttendance.test.ts` (marcas, `minDays`, varios
eventos, marca tardía, revocación a los 2 días y a los 2 años, vuelta a
conceder, retroactivo); `__tests__/panuelo.test.ts` (saneado, `tradeable`
forzado, `reconcileAwards`: reflejo sin award no cuenta, revocada cosida se
descose, sin awards legibles no se quita nada); `panueloViewerBundle.test.ts`
en verde.

### F1b — Asignar piezas con IA (sin editor del Panel)

**El flujo, en una sesión como esta:**

1. El usuario dice: «Haz una chapa de Pascua Joven 2027 para los eventos
   `<id>` y `<id>`» (los ids, o los enlaces del evento de donde sacarlos, F0
   punto 4).
2. La IA añade la pieza a `mcm-app/firebase-seed/panuelo.json` con
   `grant: { "type": "attendance", "events": [ … ] }`, siguiendo
   `PANUELO_CONTRATO.md` (id nuevo en `kebab-case`, que no se reutiliza), y
   pasa `npm test -- panueloSeed`.
3. La IA hace commit (el seed es también el catálogo empaquetado: la pieza
   llega igualmente en la siguiente OTA como respaldo) y le da al usuario
   **un solo comando**:

   ```bash
   cd mcm-app && npm run panuelo:subir -- pascua-joven-2027
   ```

4. El script enseña qué va a escribir y pide «s» para confirmar. Listo.

**Piezas de la fase:**

- `__tests__/panueloSeed.test.ts` (nuevo, guardarraíl): **ninguna pieza del
  seed se descarta** al sanear (si `sanitizeCatalog` tira una, el test dice
  cuál y por qué); ids únicos y con formato; toda `attendance` tiene `events`
  no vacío y sin repetidos; `tradeable` no es `true` en una `attendance`.
- `mcm-app/scripts/panuelo-subir.mjs` (nuevo) y `"panuelo:subir"` en
  `package.json`:
  - Recibe uno o varios ids. Lee el seed y saca **solo esas piezas**.
  - Escribe cada una con `firebase database:set
/panuelo/data/items/<id> <fichero temporal> --project mcmapp-39b71` y
    después `/panuelo/updatedAt` con la hora actual. **Nunca** escribe
    `/panuelo` ni `/panuelo/data` enteros: no puede borrar otras piezas.
  - Antes, `firebase database:get /panuelo/data/items` para avisar si la pieza
    ya existe y es distinta («se va a sustituir») y para listar las piezas que
    hay en Firebase y **no** en el seed (alguien las añadió por otro lado: se
    avisa, no se tocan).
  - Sin `--yes` pregunta; con `--dry-run` solo enseña. Necesita `firebase
login` (el usuario ya lo usa para desplegar). La CLI escribe como
    administrador, así que no depende de `legacyPanelWrites`.
- **Si no se quiere usar la terminal** (alternativa por la consola): en
  Firebase → Realtime Database, entrar en `/panuelo/data/items`, añadir un
  hijo con el id de la pieza, y en **ese hijo** ⋮ → «Importar JSON» con el
  fichero que deja `npm run panuelo:subir -- <id> --export` (solo esa pieza).
  Luego editar `/panuelo/updatedAt`. **Nunca importar en `/panuelo` ni en
  `/panuelo/data`**: reemplaza el catálogo entero.
- Si F0 punto 4 dice que no hay forma cómoda de ver el id de un evento:
  «Copiar id del evento» en el menú de `components/comunica/eventos/EventScreen.tsx`,
  visible solo con el Laboratorio Alpha.
- `firebase-seed/README.md` y `PANUELO_CONTRATO.md`: el flujo de arriba sustituye
  a «importar el fichero entero».

### F2 — Cloud Function y reglas (este repo, servidor)

- `functions/src/panueloAttendance.ts` (nuevo, exportado en `index.ts`):
  `onCall` v2, `us-central1`, `secrets: ['MW_PANUELO_SECRET']`, parámetro
  `COMUNICA_API_URL`. Pasos: exigir `request.auth`; si hay
  `/panueloAccounts/{uid}`, usar esa ficha; leer `/panuelo/data/items` y sacar
  los `eventIds` (si no hay, `ok` vacío); llamar al middleware; atar cuenta y
  ficha en transacción (`other_owner` si la ficha es de otro uid);
  `computeAwards`; `update()` multi-ruta en `/panueloAwards/{personId}/…`
  (escribir lo concedido y **borrar** lo revocado); límite de 1 por minuto y
  uid (`/panueloClaims/{uid}/lastAt`). Registrar `granted`/`revoked` sin
  nombres.
- `functions/scripts/sync-panuelo-attendance.mjs` (nuevo) y su llamada en el
  `build` de `functions/package.json`.
- `database.rules.json`: `panueloAwards`, `panueloAccounts`, `panueloOwners`,
  `panueloClaims` (§4.2).
- Mientras F3 no esté: vía B detrás de una constante (la app manda
  `comunicaAccessToken`; la función usa `/v1/me` → `personId` = **self** y
  `/v1/profiles/:self/calendar`; nunca un hijo). Se borra al llegar F3.

Tests: `__tests__/databaseRules.test.ts` (nadie escribe los cuatro nodos; una
cuenta lee los awards de su ficha y no los de otra; sin `panueloAccounts` no
lee ninguno). Guardarraíl `__tests__/panueloAwardsReadOnly.test.ts`: nada de
`app/`, `components/`, `hooks/`, `services/` ni `utils/` escribe en esos
nodos.

Despliegue (propietario): `firebase functions:secrets:set MW_PANUELO_SECRET`
y `firebase deploy --only functions:panueloClaimAttendance,database`.
Documentar en `docs/desarrollo/FIREBASE_REGLAS.md`, con cómo liberar una
ficha.

### F3 — Endpoint del middleware (`comunicaMiddleware`)

Fuera de esta sesión. Encargo con §4.6: ruta, secreto, verificación del
idToken de `app-account`, resolución de fichas **por correo y sin hijos**,
consulta de marcas por ficha y eventos, tests, `MW_PANUELO_SECRET` en Vercel,
doc. La app no la llama nunca.

### F4 — Reclamar y reflejar en la app

- `services/panueloAwards.ts` (nuevo): `claimAttendance(personId?)` con
  `httpsCallable` (va en el paquete `firebase`, es JS), `fetchAccount(uid)`,
  `fetchAwards(personId)`. Con el servidor falso se resuelve en el móvil.
- `utils/authHelpers.ts`: leer `panueloAccounts/{uid}` y sus awards junto a
  `fetchPanuelo`.
- `hooks/usePanuelo.ts`: `reconcileAwards` al mezclar con la nube; no coser
  solas las `attendance`; exponer `newFromAwards`, `revokedNotice` y `claim()`.
- `services/panueloStore.ts`: sacar de `usePanuelo` lo justo
  (`@panuelo_state`, `@panuelo_seen`) para compartirlo con el componente de
  fondo.
- `components/panuelo/PanueloAwardsBackground.tsx` (nuevo, no pinta),
  montado en `app/_layout.tsx`.
- La pista de ficha: `Me.personId` si hay sesión de Comunica (**nunca**
  `useActiveProfile().active.id`). «¿De quién es este pañuelo?» si contesta
  `choose`, recordado en `@panuelo_person`.
- La línea de §2.1 para lo retirado, una vez.
- Analítica: `panuelo_pieza_conseguida { clase, via: 'attendance' }` y
  `panuelo_pieza_retirada { clase }`.

Tests: `__tests__/usePanuelo.test.tsx` (award entra; reflejo sin award se cae;
revocada cosida se descose y sale la línea una vez; móvil nuevo no re-presenta
lo antiguo); test del fondo (throttle de 6 h; sin uid, sin piezas `attendance`
o con el pañuelo cerrado no actúa; abre la ruta una vez por arranque; la pista
es `Me.personId` aunque «Viendo a» sea un hijo).

### F5 — El desvelado una a una

- `PanueloTutorial.tsx`: props `nextLabel`, `finishLabel`,
  `secondaryLabel`/`onSecondary`, `pageLabel`.
- `usePanueloTutorialStage.ts`: `sections` y `catalog` por argumento; `reveal`
  con `still`.
- `utils/panuelo.ts`: `newPiecesSections(catalog, state, ids, awards)`.
- `app/panuelo.tsx`: modo «nuevas» (por `?nuevas=1` o por piezas `attendance`
  sin ver), después del tutorial y antes del canje o el cambio de etapa.
- `panuelo-3d/src/main.ts`: `reveal` con `still`. `npm run build:panuelo`.
- Laboratorio (`PanueloLabPanel.tsx`): «Simular piezas por asistencia» y
  «Simular una pieza retirada».

Tests: `panueloScreen.test.tsx` (sale la secuencia; «Siguiente» avanza; la
última dice «Colocarlas»; la X deja vistas solo las enseñadas; el tutorial va
antes); `newPiecesSections`; `panueloTutorialScarf.test.tsx` verde;
`noLooseMotion` y `noNewMagicNumbers`.

Diseño: `design.md` §6 y §8; copy corto y sin exclamaciones.

### F6 — «Colocarlas», tutorial y documentación

- `app/panuelo.tsx`: tras «Colocarlas», modo decorar + filtro `unplaced` +
  primera pieza seleccionada.
- `constants/panueloTutorial.ts`: fila «Por ir a una actividad» («Cuando te
  pasan lista, te llega sola. Si se corrige la lista, se quita»).
  `PANUELO_TUTORIAL_VERSION` → 4.
- Docs: `PANUELO.md`, `PANUELO_CONTRATO.md` (§4), `PLAN_PANEL_PANUELO.md`,
  `CHANGELOG.md`. Mover este plan a `archivo/` en el commit que cierre la
  última fase que se haga.

### F7 — La pieza en el evento (área nativa, opcional)

- Monitores, `components/comunica/eventos/EventScreen.tsx`: fila discreta
  «Este evento da una pieza: Chapa de Pascua» con `PanueloItemArt`.
- Familias, `components/comunica/actividades/EventDetailScreen.tsx`, **según
  a quién se vea**: si es uno mismo, la pieza en silueta hasta tenerla; si es
  un hijo (`activeId ≠ self`), **solo lectura**: «Lucía tiene la Chapa de
  Pascua» si su `CalendarSession.attendance` cumple la regla
  (`qualifies`, la misma lógica pura), o la silueta. Nunca si es `secret`.
  No reclama nada ni toca ningún pañuelo.
- Solo con el pañuelo disponible. Sin color nuevo.

### F8 — Panel (`mcmpanel`)

Fuera de esta sesión. En el editor de piezas: concesión «Por asistencia» con
la lista de ids de evento y «Concedidas: N» leyendo `/panueloAwards`. Mientras
no exista: el flujo con IA de F1b.

---

## 6. Lo que NO entra

- Push «Tienes una pieza nueva».
- Piezas por asistencia a los **sábados** (rachas): Fase 9 de
  `PLAN_PANEL_PANUELO.md`.
- Validar en servidor los **códigos** y los **intercambios**.
- Que un padre **gestione** el pañuelo de un hijo (solo la lectura de F7).
- Sacar el pañuelo del Laboratorio.

---

## 🔒 Decisiones del usuario — contestadas el 2026-11-16

1. **Vía C** (endpoint en `comunicaMiddleware` + Cloud Function): **aceptada**,
   con la B como puente.
2. **Qué cuenta como haber ido**: «Sí» o «Parcial» en cualquier día del
   evento, **por ahora** (`marks`/`minDays` quedan para cambiarlo).
3. **Correcciones de la lista**: **sin plazos**. La pieza sigue siempre a la
   asistencia: llega cuando se marque y se quita si se corrige, aunque ya
   esté desvelada o cosida (§2.1).
4. **De quién es la pieza**: **del niño** (la ficha que asistió), nunca del
   padre. Las piezas se guardan por ficha; cada cuenta de la app se ata a una
   ficha propia y viceversa (§1.1); el padre, como mucho, las ve en lectura;
   si el niño no tiene cuenta, le esperan.
5. **Tras el desvelado**: las piezas **esperan en la caja**; «Colocarlas» abre
   el modo decorar.
6. **Quién asigna una pieza a un evento**: el **Panel**; mientras no tenga
   editor, **con IA** editando `firebase-seed/panuelo.json` y subiendo solo esa
   pieza con `npm run panuelo:subir` (F1b).

Sin preguntas nuevas: lo que queda abierto son comprobaciones técnicas (F0).
