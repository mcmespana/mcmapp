# Estado del área nativa y qué hacer ahora (24/10/2026, repasado el 26/10)

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
- **El parche `revision-24-10/a-medias-f1.patch` sigue sin aplicar.** Es lo
  primero de la lista de abajo (A1, A2, A4, A6, A7, QA).
- **Build de TestFlight**: el 24/10 por la mañana se lanzó el workflow
  `eas-build.yml` desde esta rama (iOS, `production`, con envío); según la nota
  de abajo, la build falló por las credenciales de Apple. Antes de otra:
  credenciales en interactivo y el perfil `production-comunica-falso`.
- `docs/planes/BACKLOG.md` §I y la tabla de `README.md` puestas al día con
  esto (decisiones todas contestadas; 04 y 05 hechos; 06 empezado).

## Lo que falta, en este orden

El trabajo de la capa de servicios se quedó a medias (límite de uso): está
guardado, sin aplicar, en
[`revision-24-10/a-medias-f1.patch`](revision-24-10/a-medias-f1.patch). Úsalo
de referencia; **no lo apliques sin revisarlo y pasar los tests**.

**1. Antes de que lo use nadie con datos de verdad** (A-servicios.md):

| # | Qué | Dónde |
|---|---|---|
| A1 | La cola sigue viva tras «Salir»: puede subir lo de una persona con la sesión de otra | `outbox.ts` (`dispose`), `ComunicaAreaProvider.tsx`, `signOut` |
| A2 | Abrir el enlace de otra persona borra listas sin subir sin avisar | `useComunicaLinks.ts` |
| A4 | El token de un enlace se queda en el hueco del legado sin caducar | `+native-intent.ts`, `useComunicaLinks.ts` |
| A6 | El guardarraíl de salud no puede fallar: que `persist` salga de `ROUTES` y test con los hooks reales | `useAreaQuery.ts`, `persistence.test.ts` |
| A7 | El token se manda a cualquier dominio de foto: solo a la `baseUrl` | `client.ts`, `photos.ts` |
| QA | Guardar sin conexión dice «No se ha guardado» aunque se suba sola: un error de red es `pending`, no `failed` | `outbox.ts` + textos de `RollScreen` |

**2. Pronto:** A3 (un rechazo definitivo se reenvía en cada arranque), A8
(caché en un solo JSON: puede perderse en Android), A9 (enlace a una actividad
abre el portal entero), A10 (guardarraíles: tokens fuera de los logs, «Salir
borra todo» con la cola real), 400 → `validation`, los 401 no cuentan para el
límite de 5, y la sesión revocada a mitad de pila vuelve a la puerta.

**3. Pulido de pantallas** (QA y B-pantallas.md, BAJA): aviso de sin conexión
repetido en «Hoy»; «1 grupos»; COM I/II/III igual en portada y árbol; decir qué
lista falta en el árbol; chip seleccionado del Laboratorio más visible;
buscadores con `headerSearchBarOptions`; anillo de la pulsación larga.

**4. Fuera del área pero visto en el QA:** en oscuro la barra de pestañas no
marca la activa; en web la barra lleva elementos de más («⏷», «visitapapa»).

**5. Después, por planes:** cerrar 02 (`expo-secure-store` con la 2.2), 03
(catálogo y revisar el territorio con capturas), 04-05 (lo que dice su fila
en la tabla del README), y seguir con 06-09 y 11-16.

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
