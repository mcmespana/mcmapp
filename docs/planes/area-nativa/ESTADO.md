# Estado del área nativa y qué hacer ahora (24/10/2026, repasado el 26 y el 28/10)

> Para desarrollar poco a poco. La tabla de qué plan está hecho sigue en
> [`README.md`](README.md) («Estado»); las decisiones, en
> [`decisiones/`](decisiones/README.md) (todas contestadas). Este documento es
> la revisión del código del 23-24/10 y la lista de lo que falta, en orden.

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

**3. Por planes:** 03 (catálogo y revisar el territorio con capturas), 04-05
(lo que dice su fila en la tabla del README), y seguir con 06-09 y 11-16.

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
