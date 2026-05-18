# mcm-app · Cloud Functions

Funciones programadas que mantienen Firebase Realtime Database limpio.

## Funciones

| Nombre                 | Trigger                  | Qué hace                                                                 |
| ---------------------- | ------------------------ | ------------------------------------------------------------------------ |
| `purgeExpiredShares`   | Schedule (24h, Europe/Madrid) | Borra entradas de `/playlistShares` y `/choirSessions` con `expiresAt` en el pasado. |

## Requisitos

- Node.js 20 (`engines.node` en `package.json`).
- Proyecto Firebase en **plan Blaze** (las scheduled functions lo exigen).
- `firebase-tools` instalado globalmente (`npm i -g firebase-tools`).

## Desarrollo local

```bash
cd mcm-app/functions
npm install
npm run build       # compila TypeScript → lib/
```

Para probar en el emulador:

```bash
cd mcm-app
firebase emulators:start --only functions,database
```

## Despliegue

Desde `mcm-app/` (donde vive `firebase.json`):

```bash
firebase use --add      # primera vez: vincula el proyecto Firebase
firebase deploy --only functions
```

El script `predeploy` de `firebase.json` compila TypeScript antes de subir.

## Logs

```bash
cd mcm-app
firebase functions:log --only purgeExpiredShares
```

## Coste estimado

`purgeExpiredShares` corre 1×/día. En cuotas Blaze:
- 1 invocación/día × 30 días = 30 invocaciones/mes (gratis hasta 2M).
- Coste real estimado: **0 €** (entra de sobra en el free tier).
