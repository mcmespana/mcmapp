# Estado del área nativa y qué hacer ahora (24/10/2026, repasado el 26 y el 28/10)

> Para desarrollar poco a poco. La tabla de qué plan está hecho sigue en
> [`README.md`](README.md) («Estado»); las decisiones, en
> [`decisiones/`](decisiones/README.md) (todas contestadas). Este documento es
> la revisión del código del 23-24/10 y la lista de lo que falta, en orden.

## ⭐ 31/10/2026 (noche): MVP de monitores contra el middleware de verdad

Decisión del propietario: sacar ya **toda la parte de monitores y coordinación** en nativo, contra el
middleware real (`comunicaMiddleware`), y arreglar lo que falte por OTA.

- **Por qué decía «no se ha podido»**: el middleware de producción contesta 503 `app_not_configured` a
  `/v1/auth/code` porque en Vercel faltan `MW_APP_SECRET` y `MW_AUTH_DB_URL` (y, para guardar listas y ver
  fotos, `MW_CRM_URL/USER/PASS`). Es del propietario: `comunicaMiddleware:docs/SIGUIENTE.md` arriba. El acceso
  ahora enseña debajo del mensaje el código técnico (`crm_unavailable · app_not_configured · 503`).
- **Builds y OTA apuntan al middleware**: `EXPO_PUBLIC_COMUNICA_API=https://comunica-middleware.vercel.app` en
  `eas.json` (preview y production) y en `ota-preview.yml` y `ota-production.yml` (un test vigila que sea la
  misma: una OTA sin ella apagaría el área). Quién la ve sigue igual: Laboratorio Alpha o
  `global.comunicaNativa = all`. Con datos inventados: el perfil `production-comunica-falso`.
  Cuando Vercel valide `api.comunica.movimientoconsolacion.com`, cambiar la URL en los cuatro sitios.
- **Entrar con la cuenta de la app** (`identidad-app`): «Entrar como <correo>» en «Entra en tu área», con
  `POST /v1/auth/app-account` (pase de Firebase; misma regla que el código, «¿Quién eres?» si el correo es de
  varias fichas). La primera vez entra solo; tras «Salir» (Tu cuenta → Salir) ya no, para poder entrar con
  otro correo, el DNI o como otra ficha. `services/comunica/appAccount.ts`; servidor:
  `comunicaMiddleware:docs/ACCESO-APP.md`.
- **Quien no es del equipo** (familias, socios): en vez de un 403, «Tu área, de momento en la web» con
  «Abrir la versión web» (pase con sesión) hasta que lleguen los planes 11-16.
- **Familias (planes 11-16)**: **en `main` desde el 1/11/2026** (PRs #358-#364: perfiles, mis datos, eventos y ficha, inscripciones, pagos con la hoja de la pasarela, documentos y
  calendario). La rama `plan11` quedó obsoleta (se rehízo desde `main`). Servidor al completo en `comunicaMiddleware` (fase 3, incluido el 15b «pagar con tarjeta», apagado). **Todo
  hecho contra el servidor falso; falta verlo con el servidor real.**
- **Reuniones como el plugin del 31/10** (plan 06 §«Cambios del plugin»): toda la delegación para quien
  coordina una etapa (`outOfScope`: sin ficha ni aviso) y los sin grupo con «-» también en reuniones.
- **Rediseño con cariño** (apuntado, sin pensar aún): al propietario le gusta más ahora la web que el nativo.
  Ver `docs/planes/PLAN_DISENO.md` §«Área nativa de Comunica: rediseño».

## ⭐ 1/11/2026: dónde estamos y qué falta

- **Las variables del servidor ya están en Vercel y el acceso funciona** (Izan probó una build del 31/10: entró y le llegaron correos). El correo del acceso es ahora **el mismo que el de la web**
  (middleware, `src/app/mailer.ts`). El dominio `api.comunica…` **no se cambia por ahora** (la URL sigue `comunica-middleware.vercel.app` en los cuatro sitios).
- **Para ver 11-16 en un móvil de verdad**: una build/OTA contra el middleware (ya apuntan: `EXPO_PUBLIC_COMUNICA_API` en `eas.json` y los workflows OTA); se ve en el Laboratorio Alpha o con
  `global.comunicaNativa = all`. Los paquetes que usan estas pantallas (`expo-image-picker`, `expo-document-picker`, `expo-sharing`, `react-native-webview`) ya están en `package.json`, así que
  si la build instalada los lleva, **basta con la OTA** (si no, build nativa con `[skip-ota]`). Pagar con tarjeta seguirá sin funcionar hasta encender el 15b del servidor.
- **Qué comprobar con el CRM real** (clave del pasaporte, `email1`, año de incorporación LC, estados de inscripción, céntimos…): [`comunicaMiddleware:docs/PRIORITARIAS-COMPROBAR.md`](https://github.com/mcmespana/comunicaMiddleware/blob/main/docs/PRIORITARIAS-COMPROBAR.md).
- **Mejoras y lo aparcado, a la par con la web** (foto del perfil con tope de 4 MB, avisos del pago, TPV, ficha pública que NO se hará en la app, pulido): [`comunicaMiddleware:docs/MEJORAS-WEB-Y-APP.md`](https://github.com/mcmespana/comunicaMiddleware/blob/main/docs/MEJORAS-WEB-Y-APP.md).
- **Pulido de la app pendiente** (no MVP): capturas de cada pantalla; calendario de la portada de familias y deslizar de mes (16); «Abrir con…» para PDF en Android (2.2); visor con zoom y cartel a
  la izquierda en iPad (13); ficha de registro común `comun/record/`; intercepción de la vuelta del formulario avanzado (14); la foto (subir) del plan 12; rediseño «con cariño» (`PLAN_DISENO.md`).

## Veredicto de la revisión

Base buena: contrato zod único, servidor falso con la misma interfaz, caché por
persona, cola de escrituras, estados de pantalla y accesibilidad cuidada. En
web, con el servidor falso, los flujos van de punta a punta sin errores. Los
fallos estaban en el **ciclo de vida** (cola y sesión al salir o cambiar de
persona), en **guardarraíles que no podían fallar** y en **decisiones que el
código no seguía** (se escribió sin leer las respuestas del 21/10).

Informes completos: [`revision-24-10/A-servicios.md`](revision-24-10/A-servicios.md)
(capa no visual) y [`revision-24-10/B-pantallas.md`](revision-24-10/B-pantallas.md)
(pantallas).

## Arreglado el 24/10 (commits en la rama)

- **Marcas que se perdían** al salir con «Guardar» o al corregir mientras subía
  (lógica en `useRollSave`, con test).
- **Decisiones**: `desmarcar` (quitar una marca la borra en el CRM),
  `futuras` (la próxima si no ha empezado ninguna), `salud-no` (la ficha
  enseña la salud; la marca de la lista no), `territorio` (acento violeta
  `#6c4b9e`, degradado solo en la acción principal, `ComunicaColors`).
- Estados de carga/error dentro de `AreaScreen`; barra de acciones medida;
  táctiles de 44 pt; la web del plugin ya no queda tapada; «Salir» y «Sin
  registro» preguntan también en web; «Abrir la versión web» con pase; los
  datos del acceso ya no viajan en la URL; el historial no apila pantallas.
- Servidor falso: la sesión sobrevive a reiniciar la app (para TestFlight);
  `photoUrl` solo https.
- `eas.json`: el servidor falso sale de `production` → perfil
  `production-comunica-falso`, con test.

Verificado: typecheck, lint y **toda la suite** (179 ficheros, 2.130 tests) en verde.

## Reconciliación del 26/10/2026

Repaso del repo tras dos sesiones trabajando a la vez (sin desarrollar nada):

- La rama local estaba 8 commits por detrás; puesta al día. Typecheck, lint y
  la suite completa, en verde sobre `80b42e2` (ver el commit de esta nota).
- **Plan 06**: hechas las tareas 1-3 (`ad565b4`, `baed441`). Un intento de
  pantallas que se cortó por el límite de uso quedó guardado en la rama
  **`wip/plan06-pantallas-a-medias`** (lista de monitores y `coordination.ts`,
  sin terminar ni probar, sobre `baed441`). Choca con el `RollScreen.tsx`
  actual: es referencia, no se mergea tal cual.
- **El plugin cambió Coordinación después de escribirse el plan 06**: se ha
  mergeado su `main` en su rama `nuevoComunicaChulo` (lista de monitores: los
  que no van por grupos salen sin marcar; Apoyo destacado en Coordinación; la
  portada y el calendario sin sesiones de los chavales; «Sin grupo» solo
  MIC-COM). Leer esos commits del plugin antes de seguir con el 06.
- El parche `revision-24-10/a-medias-f1.patch` quedó sin aplicar ese día (se
  aplicó y revisó el 28/10, ver abajo).
- **Build de TestFlight**: el 24/10 por la mañana se lanzó el workflow
  `eas-build.yml` desde esta rama (iOS, `production`, con envío); según la nota
  de abajo, la build falló por las credenciales de Apple. Antes de otra:
  credenciales en interactivo y el perfil `production-comunica-falso`.
- `docs/planes/BACKLOG.md` §I y la tabla de `README.md` puestas al día con
  esto (decisiones todas contestadas; 04 y 05 hechos; 06 empezado).

## Arreglado el 28/10/2026

Lo de «Antes de que lo use nadie con datos de verdad» y lo de «Pronto», todo
hecho y con test:

- **El parche a medias** (`a-medias-f1.patch`) se aplicó con fusión a tres
  bandas, se revisó pieza a pieza y se borró del repo (vive en la historia):
  - **A1** la cola se apaga (`dispose`) al salir o cambiar de persona, ANTES de
    borrar; cada entrada y salida abre una «época» en `session.ts` y una
    llamada de A que acaba con B dentro falla como 401 sin repetirse con el
    token de B (`areaProvider.test.tsx`, con el proveedor de verdad).
  - **A2** el enlace de otra persona intenta subir lo pendiente, dice cuánto se
    perdería y nunca se acepta solo, tampoco en web (`linkSwitch.test.ts`).
  - **A3** un rechazo definitivo ya no se reenvía al arrancar (`NEVER` en vez
    de `Infinity`, que pasaba por JSON como `null`).
  - **A4** el hueco del legado se rellena antes que el nativo y caduca a los
    2 minutos.
  - **A6** el `persist` sale de `ROUTES` (`route:` en `useAreaQuery`) y
    `persist.ts` descarta salud y datos personales aunque vengan mal marcados.
  - **A7** la cabecera con el token solo va a fotos de nuestro servidor.
  - **A9** el enlace a una actividad abre su página pública.
  - **QA** sin red la lista sigue «Guardada en el móvil» (`pending`), sin
    gastar intentos, y sube sola al volver la red (`wake`). CRM caído: «no
    responde, se volverá a intentar sola»; atascada: «pulsa Reintentar».
  - 400 → `validation`; los 401 no cuentan para el límite de 5; un fallo de
    la app (`internal`) no se reintenta solo; la sesión revocada a mitad de
    pila vuelve a la puerta.
- **A8 de verdad**: los paquetes nativos entran en la **2.1** (PR #349), así
  que los cajones van ya a **SQLite cifrado con SQLCipher**
  (`services/comunica/nativeStores.ts`, clave de `randomblob` en el llavero) y
  el token de refresco del servidor de verdad, al **llavero**
  (`expo-secure-store`). Lo que hubiera en AsyncStorage se pasa a SQLite la
  primera vez. En web o en un binario sin los paquetes, AsyncStorage y memoria.
  Si la caché no cabe, se sacrifican las fichas más viejas (`fitForStorage`).
- **A10** guardarraíles nuevos: `noSecretsInLogs.test.ts` (el pase y los
  tokens no salen en ningún log aunque el servidor conteste roto) y el área en
  `tabsLayoutWebSafety.test.ts` (solo el adaptador carga `expo-sqlite` y
  `expo-secure-store`, con su `.web.ts`). «Salir borra todo» se prueba con la
  cola real.

## Lo que falta, en este orden

**1. Pulido de pantallas** (QA y B-pantallas.md): rendimiento de marcar con
~60 (B9: `React.memo` en `RollRow`, rachas en `useMemo`, `key` estable en
`Section`); aviso de sin conexión repetido en «Hoy»; «1 grupos»; COM I/II/III
igual en portada y árbol; decir qué lista falta en el árbol; chip
seleccionado del Laboratorio más visible; buscadores con
`headerSearchBarOptions`; anillo de la pulsación larga; bordes de 2-3 px,
«✓»/«›» como texto, `HealthSheet` vacía al cerrarse.

**2. Fuera del área pero visto en el QA:** en oscuro la barra de pestañas no
marca la activa; en web la barra lleva elementos de más («⏷», «visitapapa»).

**2 bis. ✅ (31/10 noche) Cambios del plugin del 31/10, portados** (queda la decisión de los sábados del MIC) (plan 06, sección «⚠️ Cambios
del plugin del 31/10/2026»): la ficha busca las listas de un grupo en las
sesiones de su etapa (bug «sin lista» vs «todas pasadas»); en una reunión,
la coordinación de una etapa ve a todos los monitores; y en las reuniones los
monitores sin grupo salen con «-». Revisar antes de usar el área nativa.

**3. Por planes:** 03 (catálogo y revisar el territorio con capturas), 04-05
(lo que dice su fila en la tabla del README); 06, 07, 08 y 09 hechos el 28/10;
17 (varias delegaciones) hecho en su rama; seguir con 11-16. Preguntas abiertas que dejan 08
(2: altas y bajas en la ficha del grupo; 3: «hasta el 5»; 4: el motor del
área sube a la raíz para registrar el móvil sin abrir la pestaña; 5: avisos
con la app delante) y 09 (2-5, como el plugin mientras tanto).

## Cómo probarlo

- **Web con el servidor falso** (lo más rápido): `cd mcm-app &&
  EXPO_PUBLIC_COMUNICA_API=fake npx expo start --web`. Entrar con
  `monitor@ejemplo.org` o el DNI `12345678Z`, código `123456`. Mandos (sin
  conexión, CRM caído…) en el Laboratorio Alpha (7 toques en «Movimiento
  Consolación para el Mundo», al pie de Inicio).
- **TestFlight con datos inventados**: `npm run eas:build:ios -- --profile
  production-comunica-falso` desde tu ordenador. ⚠️ El 24/10 falló por las
  credenciales de Apple (perfil de distribución caducado y certificado que ya
  no existe): la primera vez, en interactivo, deja que EAS cree certificado y
  perfil nuevos. Esa build va por el canal `production`: la siguiente OTA de
  producción le quita el área nativa.
- Antes de cada commit: `npm run typecheck && npm run typecheck:tests &&
  npm run lint && npm test`.
