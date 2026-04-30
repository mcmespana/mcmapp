# Firebase Seeds

Ficheros JSON listos para importar a Firebase Realtime Database desde la consola.

## `profileConfig.json`

Estructura inicial del nodo `/profileConfig` usado por el Sistema de Perfiles.
Ver `mcm-app/TODO_SISTEMA_PERFILES.md` para el diseño completo.

### Cómo subirlo

1. Abre la consola de Firebase → _Realtime Database_ de la instancia MCM.
2. En la raíz, crea el nodo `profileConfig` (si no existe).
3. Con el nodo seleccionado, menú _⋮_ → **Import JSON**.
4. Selecciona `profileConfig.json`. El contenido raíz (`updatedAt` + `data`) se
   volcará bajo `/profileConfig`.
5. Revisa que la estructura quede `/profileConfig/data/profiles/…` etc.

### Qué hay que editar a mano tras importar

- **`data.profiles.*.defaultCalendars`**: actualmente vacío en el seed. Rellena
  con los IDs reales de calendarios del nodo `/calendars` (los que se deban
  pre-seleccionar para cada perfil). Si lo dejas vacío, la app cae en el flag
  `defaultSelected` de cada calendario (retrocompatible).
- **`data.delegations.{id}`**: el seed ya incluye las 16 delegaciones con su
  `label`. Añade `notificationTopic`, `extraCalendars` o `override` solo a las
  que tengan algo especial. Las que solo tengan `label` heredan todo de
  `_default`.
- **`data.delegationList`**: ya viene con las 16 delegaciones. Reordena, añade
  o quita según necesidad — solo afecta al selector del onboarding/ajustes.
- **`data.global.minAppVersion`** y **`maintenanceMode`**: kill switches
  remotos. `0.0.0` = sin bloqueo. `maintenanceMode: true` muestra
  `MaintenanceScreen` en toda la app.

### Topics de notificación

Los `notificationTopics` del perfil se sanitizan contra
`KNOWN_NOTIFICATION_TOPICS` (`constants/profileCatalog.ts`) → solo se aceptan
los IDs definidos ahí. En cambio, `delegations[id].notificationTopic` (string
suelto, ej. `"castellon"`) **no** se sanitiza: pasa tal cual al array
`/pushTokens/{id}/topics` para que el backend (`mcmpanel`) pueda segmentar
notificaciones por delegación local sin tocar código de la app.

### Este JSON es la fuente de verdad del fallback

El mismo contenido se importa desde el código en
`mcm-app/constants/defaultProfileConfig.ts` y se usa como fallback si Firebase no
está disponible en primera carga (sin caché). **Mantén ambos sincronizados**: si
editas la estructura remota, refleja los cambios en este JSON y viceversa.
