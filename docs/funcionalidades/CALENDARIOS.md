# Calendarios (ICS) y su precacheo

Cómo llegan los eventos del calendario a la app, por qué hay una Cloud Function
en medio y qué hacer cuando algo va mal.

## El problema

Los calendarios se publican como `.ics` de Google Calendar (`/calendars` en
RTDB guarda las URLs). Google **genera ese fichero en caliente en cada
petición**. Medido contra el feed real de MCM Europa (agosto 2026):

```
run1: tls=0.36  TTFB=1.12  total=1.13   (21 KB con gzip)
run2: tls=0.30  TTFB=1.33  total=1.34
run3: tls=0.10  TTFB=0.87  total=0.87

81 147 bytes en crudo · 20 863 con gzip · 149 eventos
```

**De ~1,1 s de espera, la transferencia son ~2 ms.** El 99,8 % es Google
generando el fichero. Y los headers cierran cualquier salida por el lado del
cliente:

```
cache-control: no-cache, no-store, max-age=0, must-revalidate
content-encoding: gzip        ← pidiendo brotli, sigue dando gzip
(sin ETag, sin Last-Modified, sin alt-svc)
```

Sin `ETag` no hay revalidación (nada de `304`), con `no-store` no hay caché HTTP
y sin `alt-svc` no se anuncia HTTP/3. Es decir: **ninguna librería de red del
móvil puede arreglar esto** — no hay bytes que comprimir mejor ni caché que
reutilizar. Se evaluó `react-native-nitro-fetch` justo para esto y no aplica por
este motivo (lo único que aportaría es ~1 RTT de handshake con QUIC, sobre un
TTFB de servidor de 1 s).

La única forma de arreglarlo es **no pedírselo a Google en el camino crítico**.

## La solución

```
                      cada 2 h
  Google Calendar  ──────────────▶  cacheCalendarIcs  ──▶  /calendarEvents
   (~1,1 s por ICS)                 (Cloud Function)         (RTDB)
                                                                │
                                                                │ una lectura
                                                                │ de 3 campos
                                                                ▼
                                                          la app (~50 ms,
                                                       sobre la conexión que
                                                        ya tenía abierta)
```

Piezas:

| Fichero                              | Papel                                                              |
| ------------------------------------ | ------------------------------------------------------------------ |
| `mcm-app/utils/icsParser.ts`         | Parser puro de ICS + expansión a mapa por fecha. **Único parser.** |
| `mcm-app/functions/src/index.ts`     | `cacheCalendarIcs`: descarga, parsea y escribe el nodo cada 2 h    |
| `mcm-app/hooks/useCalendarEvents.ts` | Lee el nodo; ICS directo solo como fallback                        |
| `mcm-app/database.rules.json`        | `/calendarEvents`: lectura pública, escritura cerrada              |

### Forma del nodo

```jsonc
/calendarEvents/
  meta: {
    updatedAt:   "2026-08-27T11:00:00.000Z",  // SOLO cambia si el contenido cambió
    checkedAt:   "2026-08-27T13:00:00.000Z",  // cada ejecución del cron
    hash:        "4f5bd866…",                 // sha256 del payload
    calendarIds: ["mcm-europa", "mcm-castellon"]
  }
  data: {
    "mcm-europa": { events: [ /* PortableEvent[] */ ] }
  }
```

### Los dos detalles que no son adorno

**1. Los eventos se guardan sin localizar.** La función corre en `us-central1`.
El ICS trae las horas en UTC (sufijo `Z`) y la app las quiere en la zona del
dispositivo; si la conversión se hiciera al cachear, **todo el mundo vería los
eventos en hora de Chicago**. Por eso el parseo va en dos fases:

```
parseICSPortable(texto)   → eventos con banderas utcStart/utcEnd, SIN convertir  → cacheable
localizeEvents(eventos)   → convierte a hora local + ajusta el DTEND exclusivo   → en el móvil
parseICS(texto)           = localizeEvents(parseICSPortable(texto))
```

Esa igualdad está blindada con un test (`__tests__/icsParser.test.ts`): si las
dos fases dejaran de componer, los eventos cacheados y los descargados
directamente mostrarían horas distintas, y eso solo se ve en producción y solo
para parte de los usuarios. Verificado además contra el feed real: el payload
portable es byte a byte idéntico generado en Madrid y en Chicago, y el resultado
localizado sí cambia por zona (10:00 Madrid = 03:00 Chicago = 20:00 Auckland).

**2. `updatedAt` solo cambia si el contenido cambió de verdad.** La función
compara un `sha256` del payload con el de la ejecución anterior. Si coincide,
escribe únicamente `checkedAt` y se va. Sin esto, cada 2 h se invalidaría la
caché local de todos los móviles y cada usuario se re-descargaría el nodo
entero para nada. Con esto, **una apertura normal de la app cuesta una lectura
de `meta`** (tres campos) y cero descargas.

Corolario importante: **un `updatedAt` viejo es lo NORMAL** y no indica nada
roto. Lo que dice si el cron sigue vivo es `checkedAt`.

### El `calendarIndex` se calcula siempre en el móvil

`useCalendarConfigs` ordena los calendarios poniendo el de **tu** delegación
primero, y `calendarIndex` (que decide el color del evento) es la posición en
esa lista. Un índice calculado en el servidor pintaría los colores de otra
persona, así que el nodo guarda los eventos **por ID de calendario** y la
expansión a `fecha → eventos` la hace `buildEventsByDate` en el dispositivo.

## Qué hace la app al abrirse

1. Pinta la caché de `AsyncStorage` (`calendar_events`). **Antes** de preguntar
   por el estado de la red: `getNetworkStateAsync` es un salto al lado nativo y
   no hace falta para leer disco.
2. Si no hay conexión, se queda con eso.
3. Ventana de frescura de 5 min por lista de calendarios (evita que un paseo
   Home → Calendario → Home relance todo).
4. Lee `/calendarEvents/meta`. Si el nodo cubre todos tus calendarios y su
   `updatedAt` coincide con el de la caché pintada → **no se descarga nada más**.
5. Si cambió, baja `data`, localiza, expande y persiste.
6. **Fallback**: para los calendarios que el nodo no cubra (una delegación acaba
   de añadir un `extraCalendar` que el cron aún no conoce), o si el nodo no sirve,
   se baja el ICS directamente como siempre.

El nodo se considera no fiable si `checkedAt` tiene más de **24 h** (doce
ejecuciones fallidas seguidas): a esas alturas el problema es el cron, y es
mejor un calendario lento que uno de la semana pasada.

## El proxy CORS es solo de web

`EXPO_PUBLIC_CORS_PROXY_URL` **solo se usa en web**. En iOS/Android no hay
política de mismo origen que sortear, y antes el proxy se aplicaba en todas las
plataformas: un round-trip entero de más contra un feed que ya tarda 1 s, y si
el proxy fallaba el `catch` reintentaba directo, así que el usuario pagaba **dos**
esperas de ~1 s. Hay un test que lo fija por plataforma
(`__tests__/useCalendarEventsCache.test.ts`).

## Despliegue

La función **no se despliega sola**: no hay workflow de CI para functions (solo
para reglas). Desde `mcm-app/`:

```bash
firebase deploy --only functions
```

Requiere plan Blaze (ya lo estaba por `purgeExpiredShares`) y `firebase use --add`
hecho al menos una vez.

Al desplegar hay que subir también las reglas, que son las que abren la lectura
del nodo nuevo:

```bash
firebase deploy --only database
```

> El parser se copia a `functions/src/generated/icsParser.ts` en el `build`
> (script `sync:parser`, que lanza el `predeploy` de `firebase.json`). Ese
> fichero está en `.gitignore`: se regenera siempre, así que no se puede
> desplegar una copia rancia. El original es `mcm-app/utils/icsParser.ts`.

## Coste

- **Cloud Scheduler**: 3 jobs gratis al mes. Con `purgeExpiredShares` este es el
  segundo → 0 €.
- **Invocaciones**: 12/día ≈ 360/mes, sobre 2 M gratis → 0 €.
- **Tráfico**: descarga ~21 KB por calendario cada 2 h. Ridículo.
- **Payload en RTDB**: 35,4 KB para 149 eventos (medido), que RTDB sirve
  comprimido. Y con el hash-skip, la mayoría de las aperturas de la app no
  descargan ni eso.

Por eso el cron va cada 2 h y no cada 5 min: no es por dinero, es que **bajar de
ahí no mejora nada de lo que ve el usuario** (la app ya tiene su ventana de
frescura de 5 min y los calendarios se editan a ritmo humano). Si hay que
publicar un evento ya, se lanza a mano desde la consola de Cloud Scheduler.

## Diagnóstico

| Síntoma                         | Dónde mirar                                                                                  |
| ------------------------------- | -------------------------------------------------------------------------------------------- |
| El calendario va lento otra vez | `checkedAt` del nodo. Si tiene horas, el cron está fallando → logs de la función             |
| Falta un calendario nuevo       | `meta.calendarIds`. Si no está, el cron aún no ha corrido; la app lo baja por ICS mientras   |
| Un calendario desapareció       | La función conserva los eventos previos de un feed caído; mira `failed`/`reused` en los logs |
| Eventos con la hora desplazada  | Alguien ha localizado en el servidor. El test de `icsParser` debería estar en rojo           |
| `updatedAt` de hace semanas     | **Normal**: solo cambia si el contenido cambió. Mira `checkedAt`                             |

```bash
firebase functions:log --only cacheCalendarIcs
```
