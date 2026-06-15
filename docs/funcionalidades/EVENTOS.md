# Eventos — MCM App

> Guía para crear y mantener "eventos" (Jubileo, encuentros, retiros, etc.) en la app.

La app agrupa contenido relacionado con un encuentro (horario, materiales, grupos, etc.) bajo un "evento". Jubileo 2025 es el primer evento. La infraestructura está preparada para añadir más eventos con muy poco código.

## Estructura en Firebase

Hay dos convenciones según el origen del evento:

### 1. Evento legacy (Jubileo) — en la raíz

```
jubileo/
├── horario/       { updatedAt, data }
├── materiales/    { updatedAt, data }
├── comida/        { updatedAt, data }
├── visitas/       { updatedAt, data }
├── profundiza/    { updatedAt, data }
├── grupos/        { updatedAt, data }
├── contactos/     { updatedAt, data }
├── apps/          { updatedAt, data }
├── compartiendo/  { updatedAt, data }   (reflexiones)
└── calendarios/   { updatedAt, data }
```

### 2. Evento creado desde el panel MCM — bajo `activities/`

```
activities/
├── updatedAt: <timestamp>                  (cambia cuando se crea/edita un evento)
└── <nombreDelEvento>/                      p.ej. "evento2027"
    ├── horario/     { updatedAt, data, hidden? }
    ├── materiales/  { updatedAt, data, hidden? }
    ├── profundiza/  { updatedAt, data, hidden? }
    └── …
```

### Forma de cada sección

Cada sección (nodo hijo del evento) tiene siempre:

| Campo       | Tipo      | Obligatorio | Descripción                                                       |
| ----------- | --------- | ----------- | ----------------------------------------------------------------- |
| `updatedAt` | string    | sí          | Timestamp para invalidar caché. Cambia en cada modificación.      |
| `data`      | cualquier | sí          | Contenido real de la sección (array, objeto, string…).            |
| `hidden`    | boolean   | no          | Si `true`, oculta la sección en el hub. Ausente = `false`.        |

## Cómo añadir un evento nuevo

Sólo tocas código y Firebase. Tres pasos.

### Paso 1 — Registrar el evento en el código

Edita `mcm-app/constants/events.ts` y añade una config nueva:

```ts
export const EVENTO_2027: EventConfig = {
  id: 'evento2027',                        // identificador único en código
  title: 'Evento 2027',                    // título del header
  tintColor: '#E15C62',                    // color de acento del evento
  firebasePrefix: 'activities/evento2027', // ← prefijo en Firebase
  sections: [
    {
      label: 'Horario',
      subtitle: 'Programa del encuentro',
      emoji: '⏰',
      materialIcon: 'schedule',
      target: 'Horario',        // nombre de la sub-pantalla (ya registrada)
      tintColor: '#FF8A65',
      firebaseKey: 'horario',   // path final: activities/evento2027/horario
    },
    {
      label: 'Materiales',
      subtitle: 'Recursos y dinámicas',
      emoji: '📦',
      materialIcon: 'inventory-2',
      target: 'Materiales',
      tintColor: '#4FC3F7',
      firebaseKey: 'materiales',
    },
    // … añadir las secciones que tenga el evento
  ],
};

export const EVENTS: Record<string, EventConfig> = {
  [JUBILEO.id]: JUBILEO,
  [EVENTO_2027.id]: EVENTO_2027,  // ← registrar aquí
};
```

> Para Jubileo, `firebasePrefix` es `'jubileo'` (no `'activities/jubileo'`) porque Jubileo vive en la raíz de Firebase por motivos históricos.

### Paso 2 — Subir los datos a Firebase

Desde el panel MCM (o a mano), crear los nodos:

```
activities/
├── updatedAt: "1714000000"
└── evento2027/
    ├── horario/
    │   ├── updatedAt: "1714000000"
    │   └── data: [ … ]
    ├── materiales/
    │   ├── updatedAt: "1714000000"
    │   └── data: [ … ]
    └── …
```

El path de cada sección es `<firebasePrefix>/<firebaseKey>`.

### Paso 3 — Añadir el evento al menú de "Más"

Edita `mcm-app/app/screens/MasHomeScreen.tsx`. Dentro de `getAllNavigationItems` hay una plantilla comentada — descoméntala y ajústala:

```ts
items.push({
  label: 'Evento 2027',
  subtitle: 'Programa y materiales',
  emoji: '✨',
  materialIcon: 'auto-awesome',
  target: 'JubileoHome',        // mismo hub genérico — no cambiar
  tintColor: '#E15C62',
  eventId: 'evento2027',        // ← id declarado en events.ts
});
```

Listo. No hay que tocar ninguna sub-pantalla ni el stack de navegación.

## Ocultar secciones

Dos formas, ambas respetadas por el hub:

1. **Desde el panel MCM (recomendado)** — poner `hidden: true` en el nodo Firebase de la sección. Ejemplo: `activities/evento2027/comida/hidden = true`. Al volver a abrir la app, el hub esconde la tarjeta. Cambiar `hidden` a `false` (o borrar el campo) la muestra de nuevo.
2. **Desde el código** — poner `hidden: true` en la entrada de la sección en `events.ts`. Útil mientras preparas el evento en local.

Ambas tienen el mismo efecto visual: la tarjeta no aparece y el espacio se reacomoda.

## Evaluación del evento y de la app

Cada evento puede ofrecer una sección de **evaluación** (valorar la actividad con
estrellas + preguntas abiertas) y, aparte, una **evaluación de la app**. Forman
parte del **sistema de encuestas** — guía completa en `ENCUESTAS.md` y contrato de
datos en `ENCUESTAS_CONTRATO.md`. Aquí va solo lo específico del evento.

### Nodo Firebase (config + respuestas)

```
activities/<evento>/evaluacion
├── updatedAt: <timestamp>
├── hidden?:   boolean              (oculta la tarjeta en el hub)
├── data:                           ← configuración (editable sin desplegar OTA)
│   ├── status: 'open'              (preferido; o legacy evaluationOpen: true)
│   ├── opensAt? / closesAt?        (epoch ms — ventana de apertura)
│   ├── title / intro / thanksTitle / thanksBody
│   └── questions: [ { id, type, label, optional?, ... } ]   ← 6 tipos, ver ENCUESTAS.md
└── respuestas/<deviceId>           ← las escribe la app sola (una por dispositivo)
    └── { answers, userName, userProfileType, userDelegation, platform, timestamp }
```

- La app **lee la config de Firebase** (con caché) y, si falta, cae a
  `constants/evaluation.ts` (`DEFAULT_EVENT_EVALUATION`). Si `data.questions` está
  vacío usa las del fallback, pero el resto de campos (`status`, título…) sí se
  aplican.
- Tipos de pregunta: `stars`, `text`, `yesno`, `scale`, `single`, `multi`.
- La **evaluación de la app** no es del evento: config en `app/evaluationConfig`
  (fallback `DEFAULT_APP_EVALUATION`) y respuestas en `app/evaluations/<deviceId>`.

### Pasos para activarla

1. **Importar el seed** `mcm-app/firebase-seed/evaluacion.json` en el nodo
   `activities/<evento>/evaluacion` (consola de Firebase → Realtime Database →
   ⋮ → _Importar JSON_). ⚠️ Importar **reemplaza** el nodo; hazlo antes de que
   haya respuestas.
2. Añadir las secciones al hub en `constants/events.ts` (ya hechas para Visita
   Papa): tarjeta `Evaluacion` (con `firebaseKey: 'evaluacion'`) y `EvaluacionApp`.
3. Cuando quieras pedir la evaluación (típicamente al terminar el evento), pon
   `data.status = "open"` (y toca `updatedAt`). Aparecerá el banner **"Evalúa la
   actividad"** en la Home a quien tenga acceso al evento. Se oculta solo cuando
   esa persona ya ha evaluado. Para cerrarla, `status: "closed"`.

> El anti-duplicado es **por dispositivo**: caché local (`evaluacion_done_<id>`) +
> comprobación en Firebase (`respuestas/<deviceId>`). Una persona no puede reenviar
> la evaluación desde el mismo dispositivo.

## Cómo navega la app

```
MasHomeScreen
   │
   └─ navigate('JubileoHome', { eventId: 'evento2027' })
      │
      └─ EventHomeScreen (hub)
         ├─ useCurrentEvent() → resuelve config desde events.ts
         ├─ Filtra secciones con hidden=true (config local)
         └─ Para cada sección visible:
            ├─ Prefetch de Firebase (<prefix>/<key>)
            ├─ Si Firebase dice hidden=true → no renderiza
            └─ Al pulsar: navigate('Horario', { eventId: 'evento2027' })
               │
               └─ HorarioScreen
                  ├─ useCurrentEvent() → misma config
                  └─ useFirebaseData(<prefix>/horario, cacheKey)
```

Las sub-pantallas (HorarioScreen, MaterialesScreen, etc.) son las mismas para todos los eventos — no se duplica código.

## Archivos clave

| Archivo                                           | Qué hace                                                 |
| ------------------------------------------------- | -------------------------------------------------------- |
| `mcm-app/constants/events.ts`                     | Registry de eventos + `getEventFirebasePath`/`…CacheKey` |
| `mcm-app/hooks/useCurrentEvent.ts`                | Lee `eventId` del route, resuelve config                 |
| `mcm-app/hooks/useFirebaseData.ts`                | Fetch + caché + lectura de `hidden`                      |
| `mcm-app/app/screens/EventHomeScreen.tsx`         | Hub genérico (grid de secciones)                         |
| `mcm-app/app/screens/MasHomeScreen.tsx`           | Menú de "Más" — añadir entrada por evento                |
| `mcm-app/app/(tabs)/mas.tsx`                      | Stack con header dinámico por evento                     |

## Preguntas frecuentes

**¿Puedo reutilizar sólo algunas sub-pantallas para un evento nuevo?**
Sí. Cada sección es opcional; incluye en `sections[]` sólo las que tenga el evento. Las demás no aparecerán en el hub.

**¿Dos eventos pueden tener los mismos `firebaseKey`?**
Sí. El path final es `<firebasePrefix>/<firebaseKey>`, y la caché usa `<id>_<firebaseKey>`, así que no colisionan.

**¿Qué pasa si `eventId` no llega al route?**
`useCurrentEvent()` cae al evento por defecto (`DEFAULT_EVENT_ID` en `events.ts`, que apunta a Jubileo).

**¿Hay que añadir nuevas pantallas al stack para un evento nuevo?**
No, mientras reuse las pantallas existentes (Horario, Materiales, etc.). El stack es genérico: cada pantalla resuelve el `eventId` del route. Sólo tocarías el stack si el evento introduce una **sub-pantalla nueva** que no existe aún.
