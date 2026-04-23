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

- **`data.delegationList`**: reemplaza el único item placeholder por la lista real de
  delegaciones (~15). Formato: `{ "id": "castellon", "label": "Castellón" }`.
- **`data.delegations`**: añade entradas solo para las delegaciones que tengan algo
  especial (calendario propio, topic de notificación propio, override de tabs, etc.).
  Las delegaciones "normales" no necesitan entrada aquí — heredan de `_default`.
- **`data.profiles.*.defaultCalendars`**: rellena con los IDs reales de calendarios
  del nodo `/jubileo/calendarios`.

### Este JSON es la fuente de verdad del fallback

El mismo contenido se importa desde el código en
`mcm-app/constants/defaultProfileConfig.ts` y se usa como fallback si Firebase no
está disponible en primera carga (sin caché). **Mantén ambos sincronizados**: si
editas la estructura remota, refleja los cambios en este JSON y viceversa.
