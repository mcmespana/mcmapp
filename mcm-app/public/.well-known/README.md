# Universal Links / App Links

Estos dos archivos son **obligatorios** para que iOS y Android abran
`https://mcm.expo.app/playlist?p=...` y `https://mcm.expo.app/coro?c=...`
directamente en la app instalada (en lugar del navegador).

## `apple-app-site-association`

- **Sin extensión** (Apple lo exige).
- Debe servirse desde `https://mcm.expo.app/.well-known/apple-app-site-association`.
- Content-Type recomendado: `application/json` (Apple ya lo acepta sin extensión).
- HTTPS obligatorio, sin redirecciones.
- Apple cachea el archivo agresivamente; tras cambios la primera apertura puede tardar.

App ID: `5P53S6QB23.com.familiaconsolacion.mcmapp` (Team ID + bundleId).

## `assetlinks.json`

- Debe servirse desde `https://mcm.expo.app/.well-known/assetlinks.json`.
- Content-Type: `application/json`.
- El campo `sha256_cert_fingerprints` **NO está rellenado** — hay que obtener la huella
  del certificado de firma de la app en producción:

  **Opción A (Play App Signing, lo más probable):**
  Play Console → Setup → App integrity → **App signing** → copiar el
  "SHA-256 certificate fingerprint" del bloque _"App signing key certificate"_.
  Pegarlo en `sha256_cert_fingerprints` con el formato `AA:BB:CC:...:99`.

  **Opción B (vía EAS):**
  ```bash
  eas credentials -p android
  # → seleccionar el keystore de producción y leer la huella SHA-256
  ```

Sin la huella correcta, Android **no** verificará el dominio y los enlaces
seguirán abriendo el navegador (con el diálogo "abrir con").

## Despliegue

Estos archivos están bajo `mcm-app/public/`, así que el `npx expo export -p web`
los copia automáticamente a `dist/.well-known/`. Asegúrate de que el servidor
estático no los filtre (los archivos que empiezan por `.` a veces se ignoran).

Tras desplegar, verifica:

- iOS: https://app-site-association.cdn-apple.com/a/v1/mcm.expo.app
- Android: https://developers.google.com/digital-asset-links/tools/generator
