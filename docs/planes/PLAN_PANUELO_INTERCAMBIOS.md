# Plan — Intercambios del pañuelo (la pantalla)

> Detalla la **Fase 5** de [`PLAN_PANEL_PANUELO.md`](PLAN_PANEL_PANUELO.md)
> («Intercambios en persona con código: servicio, pantalla, reglas de
> Firebase»). No la contradice: la amplía. Las reglas del juego ya están
> escritas en `mcm-app/utils/panueloTrade.ts`; el flujo, en
> [`../funcionalidades/PANUELO.md`](../funcionalidades/PANUELO.md)
> («Intercambios»). Aquí: qué falta, en qué orden y cómo se prueba.
>
> Fecha: 2026-11-16. Estado: ⏳ sin empezar. Todo es **OTA** (ver §6).

---

## 1. Estado de partida (verificado en el código)

| Qué                                  | Dónde                                                                                         | Estado                                                                                                                                                                                                                      |
| ------------------------------------ | --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Reglas del intercambio (puras)       | `mcm-app/utils/panueloTrade.ts`                                                               | ✅ `createTradeOffer`, `answerTrade`, `acceptTrade`, `cancelTrade`, `applyTrade`, `generateTradeCode` / `normalizeTradeCode` / `isTradeCode`, `isTradeExpired`. TTL 10 min, código de 6 sin `0 O 1 I L`                      |
| Sus tests                            | `mcm-app/__tests__/panueloTrade.test.ts`                                                      | ✅ código, abrir, contestar, aceptar/cancelar, aplicar (idempotente, regalo, `gone` frente a la nube)                                                                                                                       |
| Qué pieza se puede cambiar           | `isTradeable` en `mcm-app/utils/panuelo.ts`                                                   | ✅ `tradeable` del catálogo; ausente → solo `pulsera`                                                                                                                                                                       |
| Registro de lo dado                  | `gone` en `PanueloUserState`; `withGone` / `mergePanuelo` en `utils/panuelo.ts`               | ✅ con un fallo latente (§1.1)                                                                                                                                                                                              |
| Subida de `gone`                     | `syncPanueloLayout` en `mcm-app/utils/authHelpers.ts`                                         | 🟡 sube `gone` entero junto a color y colocación, pero **nadie borra `items/{id}`** en la nube al dar una pieza                                                                                                            |
| `via: 'trade'`                       | `types/panuelo.ts`, `constants/analyticsEvents.ts` (`panuelo_pieza_conseguida`)               | ✅ ya existe el valor                                                                                                                                                                                                       |
| Chip «Intercambiable» en la ficha    | `mcm-app/components/panuelo/PanueloItemDetail.tsx` (l. 169)                                   | ✅ solo el chip; ninguna acción                                                                                                                                                                                             |
| Acciones de la ficha                 | `actions` (`useMemo`) en `mcm-app/app/panuelo.tsx` (l. 420)                                   | Se añade una más                                                                                                                                                                                                            |
| Presentar una pieza recién llegada   | `unseen` / `markSeen` en `mcm-app/hooks/usePanuelo.ts` + orden `reveal` del visor             | ✅ lo que entra por intercambio **se presenta solo** si no está en `@panuelo_seen`                                                                                                                                          |
| Hoja con campo de código             | `mcm-app/components/panuelo/PanueloRedeemSheet.tsx` (`BottomSheet` + `AppTextField` + `AppPrimaryButton`) | ✅ patrón a copiar                                                                                                                                                                                                 |
| QR                                   | `react-native-qrcode-svg` (en `package.json`), usado en `components/playlist/ShareQrModal.tsx`  | ✅                                                                                                                                                                                                                          |
| Escáner                              | `components/playlist/QrScannerModal.tsx` + `QrScanFrame.tsx`; parser `utils/qrScan.ts`        | ✅ pero **atado a playlist/coro** (`QrTarget = 'playlist' \| 'choir'`); `expo-camera` ya en `app.json` y cargado con `require` defensivo                                                                                     |
| `CodeInputModal`                     | `components/playlist/CodeInputModal.tsx`                                                      | ❌ no sirve: solo 4 dígitos y `number-pad`                                                                                                                                                                                  |
| `ShareQrModal`                       | idem                                                                                          | ❌ no sirve tal cual: es un `Modal` estático (no puede enseñar la propuesta que llega en vivo) y su copy es de playlists. Se reutiliza su **receta visual** del código grande + QR                                            |
| Patrón de servicio RTDB en vivo      | `mcm-app/services/choirSessionService.ts` (`onValue`, TTL, `remove`)                          | ✅ referencia                                                                                                                                                                                                               |
| `runTransaction`                     | —                                                                                             | ❌ no se usa en la app; `__mocks__/firebase.ts` no lo exporta                                                                                                                                                               |
| Login dentro de una hoja             | `components/SocialLoginSection.tsx` (lo usan `LoginSheet`, `SettingsBottomSheet`, onboarding) | ✅ reutilizable                                                                                                                                                                                                             |
| Estado de red                        | `hooks/useNetworkStatus.ts`                                                                   | ✅                                                                                                                                                                                                                          |
| Reglas RTDB                          | `mcm-app/database.rules.json`                                                                 | ❌ no hay `panueloTrades`. `users/$uid` es solo del dueño (confirma que cada móvil aplica su mitad)                                                                                                                          |
| Test de reglas                       | `__tests__/databaseRules.test.ts` + `__tests__/helpers/rulesEngine.ts`                        | El evaluador **falla a propósito** con expresiones nuevas: hay que enseñarle la de `panueloTrades`                                                                                                                         |
| Tutorial                             | `constants/panueloTutorial.ts` (7 pasos, el tope), versión 3                                  | `__tests__/panuelo.test.ts` l. 995 **prohíbe** la palabra «intercambi» hasta que haya pantalla                                                                                                                             |
| Pantalla                             | `app/panuelo.tsx`                                                                             | 991 líneas (≈924 sin blancos ni comentarios; `max-lines` avisa a 1.000 contando así). La lógica nueva va a un hook y a componentes nuevos para **no añadir un warning**; no se trocea nada de lo que ya hay |

### 1.1 Fallo latente que hay que arreglar antes (Fase 0)

`mergePanuelo` se queda, de una pieza repetida, con **la fecha más antigua**, y
luego `withGone` quita las que tienen `gone[id] >= at`. Caso: Ana dio la
pulsera X en `t1` (en la nube sigue `items/X = t0`, porque nadie lo borra) y en
`t2` la recupera en otro intercambio (`items/X = t2` en su móvil). Al juntar:
gana `t0` (la antigua), `gone t1 >= t0` → **X desaparece**. Lo mismo en un
segundo móvil de Ana que aún guarde `X = t0`.

Arreglo (puro): al elegir la fecha de una pieza, descartar las copias con
`at <= gone[id]` antes de quedarse con la más antigua. Y, en la subida, borrar
`items/{id}` de la nube al dar la pieza (Fase 1).

---

## 2. El flujo de usuario

Ana **ofrece**, Luis **contesta**. Los dos con sesión (Google/Apple) y con red.
Solo hay **un intercambio a la vez por móvil**: mientras hay uno abierto, la
acción «Intercambiar» lleva a ese, no abre otro (evita comprometer la misma
pieza dos veces).

### 2.1 Quien ofrece (Ana)

1. Toca una pieza suya intercambiable → ficha → **«Intercambiar»**
   (icono `swap-horiz`). También desde el botón de icono «Intercambiar» de la
   cabecera de la colección (junto a «Canjear» y «Mis pañuelos»), que abre la
   hoja en modo «elige qué ofreces» con sus intercambiables.
2. Se abre la hoja **«Intercambiar»**: la pieza (`PanueloItemArt`), el **código
   en grande** (`K7W Q4M`, partido en dos grupos de 3 para dictarlo) y su **QR**
   (`mcmapp://panuelo?intercambio=K7WQ4M`). Debajo, «Caduca en 9 min» (cuenta
   atrás por minutos, no por segundos: no es un cronómetro) y el estado:
   «Esperando a que lo escriba».
3. Llega la propuesta (en vivo, `onValue`): la hoja cambia a **«Luis te da …»**
   con las dos piezas lado a lado (o «Luis no te da nada: es un regalo»).
   Botón principal **«Aceptar el cambio»**; secundario **«No, gracias»**
   (cancela). Háptico `h.select` al llegar.
4. Acepta → transacción `proposed → accepted` → **aplica su mitad** (sale la
   suya, entra la de Luis cosida en el mismo sitio) → la hoja se cierra y el
   visor presenta la pieza nueva (`reveal`, ya existe). `h.formSuccess` y
   anuncio para el lector de pantalla.

### 2.2 Quien contesta (Luis)

1. Escanea el QR con la cámara del sistema (abre `/panuelo?intercambio=…`) o,
   dentro del pañuelo, botón «Intercambiar» → **«Tengo un código»** → campo de
   6 caracteres (`AppTextField`, `autoCapitalize="characters"`) con botón de
   escanear (`QrScannerModal`, solo si `isQrScanSupported()`).
2. Se lee el intercambio: **«Ana te ofrece …»** con la pieza.
3. Elige qué da: rejilla de **sus** intercambiables (radio, una sola) + la
   opción **«Nada: que sea un regalo»**. Las que Ana ya tiene salen
   deshabilitadas con «Ya la tiene» (gracias a `offer.have`, §4.1).
4. **«Proponer el cambio»** → transacción `open → proposed` → «Esperando a que
   Ana acepte». Puede **«Echarme atrás»** (cancela).
5. Ve `accepted` (en vivo) → **aplica su mitad** → la hoja se cierra y se
   presenta la pieza recibida.

### 2.3 Estados de error y qué se dice

Copy corto, de tú, sin exclamaciones (`design.md` §8). Todos con
`accessibilityLiveRegion` + anuncio fuera de Android, como `PanueloRedeemSheet`.

| Situación                                                                    | Dónde se detecta                                                    | Qué ve la persona                                                                                             |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| **Sin sesión** (cualquiera de los dos)                                       | Al abrir la hoja (`useAuth().user == null`)                         | «Para intercambiar tenéis que haber entrado los dos con vuestra cuenta.» + `SocialLoginSection` en la hoja    |
| **Sin red** al abrir / contestar / aceptar                                   | `useNetworkStatus` + `.info/connected`; la transacción no vuelve en 8 s | «Sin conexión. Intercambiar necesita internet en los dos móviles.» Botones deshabilitados; reintento solo     |
| Se pierde la red a mitad                                                     | `.info/connected` = false con un intercambio abierto                | Aviso en la hoja; el estado se recupera al volver (§2.4)                                                       |
| Código mal escrito                                                           | `isTradeCode` (local)                                               | «Son 6 letras y números.»                                                                                     |
| Código que no existe                                                         | lectura vacía                                                       | «No hay ningún intercambio con ese código.»                                                                   |
| **Caducado**                                                                 | `isTradeExpired` con hora del servidor (§4.3)                       | Luis: «Este intercambio ha caducado. Pídele que abra otro.» Ana: la cuenta llega a 0 → «Ha caducado» + «Abrir otro» |
| Es su propio código                                                          | `own-offer`                                                         | «Ese código es tuyo: enséñaselo a la otra persona.»                                                           |
| Luis ya tiene la pieza de Ana                                                | `already-have` en `answerTrade`                                     | «Ya tienes «X». En el pañuelo cada pieza va una vez.» No puede seguir                                          |
| Otra persona contestó antes                                                  | `closed` (transacción ve `status !== 'open'`)                       | «Otra persona ya ha contestado a este código.»                                                                |
| **Pieza ya no disponible** — Ana ya no tiene la que ofreció al aceptar       | `acceptTrade` → `not-owned`                                         | Se cancela solo. Ana: «Ya no tienes «X»: el intercambio se ha cancelado.» Luis lo ve como cancelado            |
| Ana consiguió entre tanto la pieza de Luis                                   | `acceptTrade` → `already-have`                                      | Ana: «Ya tienes «Y». Pídele a Luis que te ofrezca otra.» Botón «No, gracias» (cancela)                         |
| La pieza de Ana no está en el catálogo de Luis (caché vieja)                 | `answerTrade` → `unknown-item`                                      | «Tu app todavía no conoce esa pieza. Abre el pañuelo con conexión y vuelve a probar.»                          |
| La otra parte cancela                                                        | `onValue` → `cancelled`                                             | «Ana ha cancelado el intercambio.» / «Luis se ha echado atrás.»                                               |
| Pañuelo cerrado para quien escanea (`global.panuelo`)                        | la ruta ya redirige a Inicio                                        | Nada nuevo                                                                                                    |

### 2.4 Recuperación (la app se cierra a mitad)

Cada móvil guarda el código en curso en AsyncStorage (`@panuelo_trade_pending`:
`{ code, role }`). Al abrir el pañuelo con sesión: se lee el intercambio; si
está `accepted`, se aplica la mitad que falte (`applyTrade` es idempotente) y
se presenta; si está `open`/`proposed` y vivo, se reabre la hoja; si está
cancelado, caducado o no existe, se olvida. Así nadie se queda sin su pieza
por cerrar la app justo al aceptar.

---

## 3. Piezas a crear o reutilizar

| Pieza                                      | Ruta                                                       | Nueva / reutiliza                                                                                                                                                                                                                                    |
| ------------------------------------------ | ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Servicio RTDB                              | `mcm-app/services/panueloTradeService.ts`                  | Nueva. Patrón de `choirSessionService.ts`, pero **todas las escrituras con `runTransaction` sobre el nodo entero** aplicando las funciones puras al valor actual                                                                                     |
| Subida de la mitad propia                  | `syncPanueloTradeHalf` en `mcm-app/utils/authHelpers.ts`   | Nueva, junto a `syncPanueloItem`. Un solo `update()` multi-ruta en `users/{uid}/panuelo`: `items/{dada}: null`, `gone/{dada}`, `items/{recibida}`, `layout`, `layoutAt`                                                                              |
| Aplicar la mitad en el estado              | `applyTradeHalf(trade)` en `mcm-app/hooks/usePanuelo.ts`   | Nuevo método: `applyTrade` → `persist` → `syncPanueloTradeHalf`; saca la recibida de `@panuelo_seen` para que se presente                                                                                                                            |
| Máquina de estados del intercambio         | `mcm-app/hooks/usePanueloTrade.ts`                         | Nuevo hook: rol, suscripción, hora del servidor, pendiente en AsyncStorage, limpieza, errores → mensajes. La pantalla solo lo monta                                                                                                                  |
| La hoja                                    | `mcm-app/components/panuelo/PanueloTradeSheet.tsx`         | Nueva. `BottomSheet` (como `PanueloRedeemSheet`) con pasos: ofrecer · elegir qué ofrezco · escribir código · elegir qué doy · esperando · propuesta recibida · error. `AppPrimaryButton`, `AppTextField`, `PanueloItemArt`, `EmptyState` si no tiene intercambiables |
| Código + QR                                | `mcm-app/components/panuelo/PanueloTradeCode.tsx`          | Nueva, pequeña: `react-native-qrcode-svg` + el código en dos grupos. Receta visual de `ShareQrModal` (sin copiar su `Modal`)                                                                                                                         |
| Selector de pieza a dar                    | dentro de `PanueloTradeSheet.tsx`                          | Rejilla de `PanueloItemArt` con `accessibilityRole="radio"`, ≥44 pt, `PressableFeedback`                                                                                                                                                              |
| Escáner                                    | `QrScannerModal.tsx` + `utils/qrScan.ts`                   | Reutiliza. Añadir `QrTarget = … \| 'panuelo'` y `{ kind: 'trade', code }` para `…/panuelo?intercambio=XXXXXX` y para 6 caracteres sueltos; `describeMismatch` avisa si enseñan un QR de playlist. Respetar `onDismissed` (iOS no presenta un `Modal` en el mismo ciclo en que se cierra otro) |
| Login                                      | `components/SocialLoginSection.tsx`                        | Reutiliza dentro de la hoja                                                                                                                                                                                                                          |
| Acción en la ficha                         | `actions` de `app/panuelo.tsx`                             | Una entrada `{ key: 'trade', label: 'Intercambiar', icon: 'swap-horiz' }` si `owned && isTradeable && !memory && !tutorial.open`                                                                                                                     |
| Botón en la cabecera de la colección       | `app/panuelo.tsx` (junto a «Canjear», l. ~658)             | Botón de icono `swap-horiz`, 44 pt, `accessibilityLabel="Intercambiar una pieza"`, igual que el de «Mis pañuelos»                                                                                                                                     |
| Enlace                                     | `useLocalSearchParams` de `app/panuelo.tsx`                | Añadir `intercambio` (igual que `codigo`). Sin cambios en `+native-intent.ts`: `mcmapp://panuelo?…` ya llega a la ruta                                                                                                                                |
| Analítica                                  | `constants/analyticsEvents.ts`                             | `panuelo_intercambio: { paso: 'abierto' \| 'propuesto' \| 'aceptado' \| 'cancelado'; regalo: boolean }`; sin ids ni nombres                                                                                                                          |

Nada de colores nuevos: la hoja es territorio institucional (`themeColors`,
`t.link` para la acción, `colors.info` ya es el del chip «Intercambiable»).
Modo claro y oscuro a la vez; `fontScale` grande con scroll en la hoja.

---

## 4. Datos y reglas de Firebase

### 4.1 `/panueloTrades/{code}`

La forma del contrato (`PANUELO_CONTRATO.md` §4) se mantiene, con **un campo
opcional nuevo** (aditivo; el nodo no lo lee nadie todavía):

```json
{
  "code": "K7WQ4M",
  "status": "proposed",
  "createdAt": 1800000000000,
  "expiresAt": 1800000600000,
  "offer": {
    "uid": "<uid>",
    "name": "Ana",
    "itemId": "pulsera-amistad",
    "have": ["pulsera-encuentro"]
  },
  "answer": { "uid": "<uid>", "name": "Luis", "itemId": "pulsera-camino" }
}
```

- `offer.have`: ids de las piezas **intercambiables** que Ana ya tiene (solo
  esas, no su colección). Sirve para que Luis no ofrezca algo que Ana no puede
  recibir. `answerTrade` lo comprueba (error nuevo `they-have`).
- `name`: el nombre de pila (`displayName` hasta el primer espacio), o nada.
- Un intercambio `accepted` **no se borra al momento**: se queda 24 h para que
  la otra parte se recupere (§2.4). Lo abierto, propuesto o cancelado puede
  borrarse en cuanto caduca.

### 4.2 Reglas (sustituyen a la propuesta de `PANUELO.md`)

La propuesta actual deja que **cualquiera con sesión reescriba un intercambio
sin contestar** (incluido `offer`). Estas fijan las transiciones. En el fichero
van en una sola línea; aquí, partidas para leerlas:

```text
"panueloTrades": {
  ".read": false, ".write": false,
  "$code": {
    ".read": "auth != null",
    ".write": "auth != null && (
      // crear (o reutilizar un código abandonado hace más de 24 h)
      ((!data.exists() || data.child('expiresAt').val() + 86400000 < now)
        && newData.child('offer/uid').val() === auth.uid
        && newData.child('status').val() === 'open'
        && newData.child('expiresAt').val() <= now + 660000)
      // borrar: quien lo abrió, o cualquiera pasadas 24 h de la caducidad
      || (data.exists() && !newData.exists()
        && (data.child('offer/uid').val() === auth.uid
            || data.child('expiresAt').val() + 86400000 < now))
      // cambiar de estado sin tocar lo que ofreció Ana ni la caducidad
      || (data.exists() && newData.exists()
        && newData.child('offer/uid').val() === data.child('offer/uid').val()
        && newData.child('offer/itemId').val() === data.child('offer/itemId').val()
        && newData.child('expiresAt').val() === data.child('expiresAt').val()
        && (
          (data.child('status').val() === 'open' && newData.child('status').val() === 'proposed'
            && newData.child('answer/uid').val() === auth.uid
            && auth.uid !== data.child('offer/uid').val()
            && now < data.child('expiresAt').val())
          || (data.child('status').val() === 'proposed' && newData.child('status').val() === 'accepted'
            && auth.uid === data.child('offer/uid').val()
            && newData.child('answer/uid').val() === data.child('answer/uid').val()
            && newData.child('answer/itemId').val() === data.child('answer/itemId').val())
          || (newData.child('status').val() === 'cancelled'
            && (data.child('status').val() === 'open' || data.child('status').val() === 'proposed')
            && (auth.uid === data.child('offer/uid').val() || auth.uid === data.child('answer/uid').val()))
        )))",
    ".validate": "$code.matches(/^[A-HJKMNP-Z2-9]{6}$/) && newData.child('code').val() === $code && newData.hasChildren(['code', 'status', 'createdAt', 'expiresAt', 'offer'])"
  }
}
```

- La raíz no se lee: no se pueden listar intercambios ajenos. 31⁶ ≈ 887 M
  códigos y 10 min de vida: adivinar uno no compensa.
- Aceptar **no** comprueba la caducidad en el servidor (la comprueba el móvil
  con la hora del servidor): un «Aceptar» pulsado en el segundo 599 que llega
  en el 601 no debe fallar.
- **El servicio escribe siempre el nodo entero** (transacción): lección de
  `FIREBASE_REGLAS.md` §3, un `update()` parcial no reevalúa el `.validate` de
  un ancestro.
- No depende de las banderas de `/_config`: se puede añadir a las reglas que
  estén desplegadas hoy sin esperar a la Integración D (🔒 decisión 3).
- Límite que no cambia (`PANUELO.md` «El límite que hay que conocer»): cada
  móvil aplica su mitad en su nodo; no es atómico ni a prueba de trampas.

### 4.3 Hora del servidor

La caducidad se compara con `Date.now() + offset`, leyendo
`.info/serverTimeOffset` una vez al abrir la hoja. Si el reloj del móvil de
Luis va 5 min adelantado, sin esto vería caducado un intercambio vivo.

### 4.4 Limpieza

Cada móvil apunta los códigos que abre (`@panuelo_trade_mine`) y, al abrir el
pañuelo, borra los suyos ya caducados (los `accepted`, pasadas 24 h). Lo que
dejen móviles que ya no abren la app se queda en la base de datos (pocos bytes)
hasta que haya función programada (🔒 decisión 2).

---

## 5. Fases

Cada fase deja `npx tsc --noEmit && npm run lint && npm test` en verde, sin
warnings nuevos (techo en `docs/desarrollo/WARNINGS.md`) y su entrada en
`mcm-app/CHANGELOG.md` si cambia lógica de datos o Firebase.

| Fase | Qué                                    | Modelo     | OTA | Depende de          |
| ---- | -------------------------------------- | ---------- | --- | ------------------- |
| 0    | Arreglos en lo puro                    | Sonnet     | ✅  | —                   |
| 1    | Servicio + subida de la mitad          | Sonnet     | ✅  | 0                   |
| 2    | Reglas de Firebase y su test           | **Opus**   | ✅¹ | 0                   |
| 3    | Hook `usePanueloTrade` (estado, recuperación, limpieza) | **Opus** | ✅ | 1 |
| 4    | Hoja: quien ofrece                     | Sonnet     | ✅  | 3                   |
| 5    | Hoja: quien contesta + escáner + enlace | Sonnet    | ✅  | 4                   |
| 6    | (Opcional) la pieza que sale «vuela»   | Sonnet     | ✅  | 4                   |
| 7    | Tutorial, docs y cierre                | Haiku      | ✅  | 5                   |

¹ Las reglas no viajan en la OTA: se despliegan aparte (🔒 decisión 3). Sin
ellas desplegadas, la Fase 4 en producción falla con permiso denegado.

### Fase 0 — Arreglos en lo puro

- `utils/panuelo.ts`: en `mergePanuelo`, descartar las copias con
  `at <= gone[id]` antes de elegir la más antigua (§1.1).
- `utils/panueloTrade.ts`:
  - `offer.have?: string[]` en `PanueloTrade`; `createTradeOffer` lo rellena
    (intercambiables que se tienen, sin la ofrecida); `answerTrade` devuelve
    `they-have` si `itemId` está en `have`. Nuevo `TradeError 'they-have'`.
  - `sanitizeTrade(raw: unknown): PanueloTrade | null` (todo lo que llega de
    fuera se sanea: estados válidos, números, ids `[a-z0-9-]`, `answer.itemId`
    `string | null`).
  - `tradeableOwned(catalog, state)` y `answerChoices(catalog, state, trade)`
    (lo que puede dar Luis, con `disabled: 'they-have'`), ordenadas con
    `sortCatalog`.
  - `firstName(displayName)`.
- **Tests**: en `__tests__/panueloTrade.test.ts` — `have` y `they-have`,
  `sanitizeTrade` (basura, `answer` sin `itemId`, estado desconocido),
  `answerChoices`; en `__tests__/panuelo.test.ts` — «recuperar una pieza que
  se dio no la hace desaparecer al juntarse con la nube» (el caso de §1.1, con
  y sin `items/X` viejo en la nube).
- Archivos: `utils/panuelo.ts`, `utils/panueloTrade.ts`, los dos tests.
  `types/panuelo.ts` no se toca (si se tocara, `npm run build:panuelo`).

### Fase 1 — Servicio y subida de la mitad

- `services/panueloTradeService.ts`:
  `openTrade(input)` (transacción; si el código existe y está vivo, aborta y
  reintenta con otro, hasta 3), `fetchTrade(code)`, `subscribeTrade(code, cb)`
  (`onValue`, saneado), `answer…`, `accept…`, `cancel…` (todas
  `runTransaction` + la función pura sobre el valor actual: si la pura dice
  `ok: false`, se aborta y se devuelve la razón), `removeTrade(code)`,
  `getServerOffset()`. Timeout de 8 s → `{ ok: false, reason: 'offline' }`.
- `utils/authHelpers.ts`: `syncPanueloTradeHalf(uid, state, trade)` con un solo
  `update()` multi-ruta.
- `hooks/usePanuelo.ts`: `applyTradeHalf(trade)` en `PanueloValue`.
- `__mocks__/firebase.ts`: exportar `runTransaction` (mock que aplica la
  función al valor que se le dé).
- **Tests**: `__tests__/panueloTradeService.test.ts` (abrir con colisión,
  contestar dos a la vez → uno `closed`, aceptar, cancelar tras aceptar →
  `closed`, timeout → `offline`, saneado de lo leído); en
  `__tests__/panuelo.test.ts` o uno nuevo, que `syncPanueloTradeHalf` escribe
  `items/{dada}: null` y `gone/{dada}` en la misma llamada.

### Fase 2 — Reglas de Firebase

- `database.rules.json`: el bloque de §4.2, con su comentario de cabecera como
  los demás nodos.
- `__tests__/helpers/rulesEngine.ts`: reconocer **esa** expresión (igual que se
  hizo con la de `isAdmin`: por igualdad de texto) y evaluarla con una
  reimplementación en TS de las tres ramas.
- `__tests__/databaseRules.test.ts`: casos — crear (dueño sí, otro uid no, sin
  sesión no), contestar (otro sí, el mismo no, tarde no, a uno ya propuesto
  no), aceptar (solo quien abrió, sin cambiar `answer`), cancelar (las dos
  partes; un tercero no), borrar (dueño; tercero solo pasadas 24 h), leer la
  raíz no.
- Docs: `docs/desarrollo/FIREBASE_REGLAS.md` (fila del nodo y cómo probarlo en
  el simulador de reglas de la consola), `docs/contratos/PANUELO_CONTRATO.md`
  §4 (de «futuro» a vivo, con `have`), y `PANUELO.md` sustituye su propuesta
  por un enlace a este plan.
- Modelo: **Opus** — un fallo aquí es un agujero (reescribir el intercambio de
  otro) o un intercambio imposible, y el evaluador de tests no modela todo.

### Fase 3 — `hooks/usePanueloTrade.ts`

- Estado: `idle | choosing | offering | joining | answering | waiting |
  reviewing | done | error`, con el `trade` en vivo y el `message`.
- Acciones: `offer(itemId)`, `join(code)`, `answer(itemId | null)`,
  `accept()`, `cancel()`, `close()`.
- Un intercambio a la vez; `@panuelo_trade_pending` y `@panuelo_trade_mine`
  (try/catch en cada lectura); recuperación al montar (§2.4); limpieza (§4.4);
  `offset` del servidor; al ver `accepted` llama a `applyTradeHalf` **una vez**
  (idempotente igualmente) y analítica.
- Mensajes: un mapa `TradeError | 'offline' | 'not-found' | 'no-session' →
  texto` (los de §2.3), exportado para testearlo.
- **Tests**: `__tests__/usePanueloTrade.test.ts` con `renderHook` y el servicio
  mockeado (patrón de `__tests__/useMyChoir.test.ts`): ofrecer → propuesta →
  aceptar aplica la mitad; Luis aplica al ver `accepted`; recuperación tras
  «cerrar la app» con `accepted` pendiente; caducado; cancelado por la otra
  parte; sin sesión no llama al servicio; segundo `offer` con uno abierto
  devuelve el abierto.
- Modelo: **Opus** — carreras entre dos móviles, recuperación e idempotencia.

### Fase 4 — Hoja: quien ofrece

- `components/panuelo/PanueloTradeSheet.tsx` (pasos de Ana) y
  `components/panuelo/PanueloTradeCode.tsx`.
- `app/panuelo.tsx`: montar el hook y la hoja, acción «Intercambiar» en la
  ficha, botón de icono en la cabecera de la colección, y añadir la hoja a
  `busy` de `usePanueloStage` (como `redeemOpen`). Cambios mínimos; el resto
  vive en el hook y la hoja.
- `constants/analyticsEvents.ts`: `panuelo_intercambio`.
- Revisión con `design.md` §10 (claro/oscuro, `fontScale`, 44 pt, etiquetas,
  `noNewMagicNumbers`, `noEdgeStripes`).
- **Tests**: `__tests__/panueloTradeSheet.test.tsx` — pinta código y QR, la
  cuenta atrás en minutos, la propuesta con las dos piezas, el regalo, el
  botón deshabilitado sin red, y sin sesión enseña `SocialLoginSection`.

### Fase 5 — Hoja: quien contesta, escáner y enlace

- `PanueloTradeSheet.tsx`: pasos de Luis (código, pieza de Ana, elegir qué da
  o regalo, esperando).
- `utils/qrScan.ts`: `QrTarget 'panuelo'`, `{ kind: 'trade', code }`,
  `describeMismatch` con los nuevos cruces. `QrScannerModal.tsx`: aceptar
  `expected: 'panuelo'` y su copy.
- `app/panuelo.tsx`: parámetro `?intercambio=` abre la hoja en «contestar» con
  el código puesto (después del tutorial, como `?codigo=`).
- **Tests**: `__tests__/qrScan.test.ts`:
  el QR del pañuelo, 6 caracteres sueltos, mismatch con playlist/coro y que
  los QR de siempre siguen igual; ampliar `panueloTradeSheet.test.tsx` con
  los pasos de Luis y la rejilla (`they-have` deshabilitada, radio accesible).

### Fase 6 — (Opcional) la pieza que sale «vuela»

- Orden nueva del visor `{ type: 'leave'; id }` en `types/panuelo.ts` y
  `panuelo-3d/src/main.ts`: la pieza se despega, sube y se desvanece
  (`durations.base`), luego llega el estado nuevo y la recibida se presenta con
  `reveal`. Sin ella, la dada simplemente desaparece: funciona igual.
- **`npm run build:panuelo`** y commitear `panuelo-3d/generated/viewer.bundle.json`
  (`__tests__/panueloViewerBundle.test.ts`). Con «reducir movimiento», sin vuelo.

### Fase 7 — Tutorial, docs y cierre

- `constants/panueloTutorial.ts`: el tutorial ya tiene 7 pasos (el tope): el
  intercambio entra como **una fila** en «Tu colección», no como página. Subir
  `PANUELO_TUTORIAL_VERSION` a 4 (es una función nueva).
- `__tests__/panuelo.test.ts` l. 995: el guardarraíl se invierte («ahora que
  hay pantalla, el tutorial lo cuenta»).
- `PANUELO.md` («Intercambios»: de «falta la pantalla» a cómo funciona; tabla
  de ficheros de «Cómo está hecho»), `PLAN_PANEL_PANUELO.md` Fase 5 → ✅,
  `CHANGELOG.md`. **Mover este plan a `docs/planes/archivo/` en el mismo
  commit** y actualizar `docs/planes/README.md`.

---

## 6. OTA

Todo es JS: `expo-camera` ya está en `app.json` y en la build 2.5.1
(`QrScannerModal` lo carga con `require` defensivo), `react-native-qrcode-svg`
y `react-native-svg` también. El visor (Fase 6) va empaquetado en el bundle JS.
**Ninguna fase requiere build nativo.** Lo único que no sale en la OTA es el
despliegue de las reglas (Fase 2).

---

## 7. Qué hay que probar en dispositivo

Hacen falta **dos móviles** con el canal preview, el Laboratorio Alpha
encendido y **dos cuentas distintas** (idealmente un iPhone y un Android).

- [ ] El ciclo entero en los dos sentidos (iOS ofrece / Android contesta y al
      revés), con pieza a cambio y como regalo.
- [ ] Escanear el QR **con la cámara del sistema** (abre la app en la hoja) y
      con el escáner de dentro; que el QR se lea a contraluz y a un metro.
- [ ] Dictar el código en voz alta y escribirlo: que no haya confusiones.
- [ ] La propuesta llega a Ana en menos de 1-2 s; el `accepted` llega a Luis.
- [ ] Modo avión en cada paso (antes de proponer, esperando, justo al aceptar)
      y volver: el aviso, y que nadie se queda sin su pieza.
- [ ] Cerrar la app de Luis tras proponer, aceptar en la de Ana, abrir la de
      Luis: recibe la pieza y se le presenta.
- [ ] Caducidad: dejar pasar 10 min; y un móvil con la hora adelantada 5 min.
- [ ] La pieza recibida aparece **cosida donde estaba la dada** y en la nube
      (abrir con la misma cuenta en un tercer móvil o en web: la dada no
      vuelve).
- [ ] El escáner sobre la hoja en iOS (el problema de los dos `Modal`).
- [ ] VoiceOver y TalkBack: código leído carácter a carácter, la rejilla como
      radios, los anuncios de propuesta/aceptado/error.
- [ ] Letra grande y modo oscuro en la hoja.
- [ ] Reglas desplegadas: probar en el simulador de reglas de la consola un
      tercero intentando reescribir `offer` (tiene que denegar).

---

## 8. 🔒 Decisiones del usuario

1. **¿Qué piezas se pueden intercambiar?** (Es la decisión 4 de
   `PLAN_PANEL_PANUELO.md`; aquí deja de ser teórica.) Hoy solo las
   pulseras. Con una o dos pulseras en el catálogo, la función se queda en
   casi nada. **Recomendación:** pulseras y chapas comunes
   (`tradeable: true` en esas chapas); nunca medallas ni piezas `unica`. Es
   dato del catálogo: cambiarlo no toca código ni pide OTA.
2. **¿Quién limpia los intercambios viejos?** **Recomendación:** de momento,
   cada móvil los suyos al abrir (§4.4, sale por OTA); una Cloud Function
   programada en `mcm-app/functions/` cuando se haga la Integración D, que ya
   obliga a desplegar funciones. Lo que se acumule mientras tanto son bytes.
3. **¿Se pueden desplegar las reglas de `panueloTrades` ya?** Sin ellas,
   intercambiar falla con permiso denegado (salvo que las reglas de producción
   estén abiertas). Las reglas completas esperan a sembrar `/_config`
   (`FIREBASE_REGLAS.md` §5), bloqueado por la decisión D2. **Recomendación:**
   añadir **solo** el bloque `panueloTrades` a las reglas que hay hoy en
   producción desde la consola (no depende de `/_config`), cuando la Fase 5
   esté en `preview`. Lo hace el usuario: ningún agente despliega reglas.
