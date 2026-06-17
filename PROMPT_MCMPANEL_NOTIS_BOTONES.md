# Prompt para el agente de **mcmpanel** — Botones de acción + descripción extendida en notificaciones

> Contexto: en la app MCM (repo `mcmapp`, carpeta `mcm-app/`) las notificaciones
> push ahora soportan **(A) hasta 3 botones de acción** por notificación (antes solo
> uno) y **(B) una descripción extendida `bodyLong`** que se ve en el detalle. El
> panel `mcmpanel` debe poder componer ambas cosas en el formulario de envío y
> mandarlas en el payload con el formato correcto. Este documento describe qué
> cambió en la app y qué implementar en el panel.

---

## 1. Qué cambió en la app (contexto)

- Antes la app solo renderizaba **un** botón de acción (campo `data.actionButton`,
  objeto). El array `data.actionButtons` se aceptaba pero **solo se usaba el primer
  elemento**.
- Ahora la app renderiza **hasta 3 botones** (`MAX_ACTION_BUTTONS = 3`):
  - En la **tarjeta** del centro de notificaciones: un chip tappable por botón.
  - En el **modal de detalle**: botones apilados (el 1.º primario, el resto
    secundarios).
- Lógica de la app en `mcm-app/utils/notificationRoutes.ts` → `extractActionButtons()`.
- Compatibilidad: el objeto único `data.actionButton` (legacy) se sigue aceptando y
  equivale a un array de un elemento.

## 2. Formato que debe enviar el panel (canónico)

En el `data` del mensaje de Expo Push (y en el registro de Firebase
`/notifications/{id}`), enviad **`actionButtons`** como **array** de 1 a 3 objetos:

```jsonc
"data": {
  "id": "uuid-de-firebase",            // CRÍTICO, mantenedlo siempre
  "internalRoute": "/(tabs)/cancionero",
  "actionButtons": [
    {
      "text": "Apuntarme",             // texto del botón (obligatorio en la práctica)
      "url": "https://mcmespana.com/inscripcion", // URL externa o ruta interna
      "isInternal": false              // true = navega dentro de la app; false = abre navegador
    },
    { "text": "Ver fechas", "url": "/(tabs)/calendario", "isInternal": true }
  ]
}
```

### Reglas que aplica la app (validar también en el panel)

- **Máximo 3 botones.** Si se mandan más, la app usa los 3 primeros. Mejor limitarlo
  en el formulario.
- Cada botón **necesita `url`**. Los que no la tengan se descartan.
- `text`: si falta, la app pone `"Ver"`. Recomendado: obligar a rellenarlo (máx. ~20
  caracteres para que no se corte en el chip).
- `isInternal`: si no viene, la app lo **infiere** (interno si la `url` NO empieza por
  `http(s)://`). Recomendado: mandarlo **explícito** desde el panel.
  - `isInternal: true` → `url` debe ser una **ruta interna** válida (ver tabla de
    rutas en `NOTIFICACIONES_CONTRATO.md` §2; p. ej. `/(tabs)/fotos`).
  - `isInternal: false` → `url` debe ser una **URL externa** `https://…`.

### Compatibilidad (no romper envíos antiguos)

- El formato legacy `data.actionButton` (objeto único) sigue funcionando. El panel
  puede dejar de usarlo, pero si lo mantiene, la app lo entiende.
- Si el panel manda **ambos** (`actionButton` + `actionButtons`), la app los combina
  y deduplica por `url|text`. Para evitar confusión, mandad **solo `actionButtons`**.

## 2.bis. Descripción extendida (`bodyLong`)

La app ahora distingue dos textos de cuerpo:

| Campo      | Dónde se ve                              | Límite                |
| ---------- | ---------------------------------------- | --------------------- |
| `body`     | Push del sistema + tarjeta (2 líneas)    | 200 chars (como hoy)  |
| `bodyLong` | Solo el **modal de detalle** (scrollable) | ~2000 chars (blando) |

- En el detalle, la app muestra **`bodyLong` si existe; si no, `body`** (fallback).
- La **tarjeta** sigue mostrando siempre `body`. `bodyLong` nunca va en la push del
  sistema ni en la tarjeta.
- `bodyLong` es **texto plano** y respeta saltos de línea (`\n`). No se renderiza
  HTML/Markdown/BBCode.

Formato en el payload / Firebase:

```jsonc
"data": {
  "id": "uuid-de-firebase",
  "bodyLong": "Texto largo con detalles...\n\nMás párrafos, horarios, etc."
}
```

- **Recomendado**: incluid `bodyLong` en `data.bodyLong` **y** en el registro de
  Firebase `/notifications/{id}`.
- Si el texto fuese tan largo que se acerca a reventar el payload (~4 KB de APNs/FCM),
  mandadlo **solo a Firebase** y omitidlo del `data` de la push: la app lo recupera
  igual del registro de Firebase al abrir la notificación. El `body` corto sí debe ir
  **siempre** en la push.

### UX sugerida en el panel (lo que pediste)

- En el formulario, **dos campos**: `body` ("Descripción", 200 chars) y `bodyLong`
  ("Descripción detallada").
- Un **checkbox "Añadir descripción detallada"**: si está **desmarcado**, NO mandéis
  `bodyLong` (la app usará `body` como fallback automáticamente — más limpio que
  duplicar el texto). Si está **marcado**, se muestra el textarea y se envía
  `bodyLong`.
- Evitad mandar `bodyLong` igual a `body`: no aporta nada y desperdicia payload. Mejor
  omitirlo y dejar que actúe el fallback.

## 3. Cambios en la UI del panel (formulario de envío)

1. Sustituir el bloque de "botón de acción" único por una **lista dinámica de botones**
   (repeater) con botón **"Añadir botón"**, hasta un **máximo de 3**.
2. Cada fila del repeater: `text` (input), `url` (input), `isInternal` (toggle/select
   "Interno" vs "Externo"). Botón para **eliminar** la fila.
3. Validación:
   - 0 botones permitido (notificación sin CTA).
   - Si `isInternal` = interno → validar contra la lista blanca de rutas internas.
   - Si externo → validar que empiece por `https://`.
4. Al enviar y al guardar en Firebase, serializar como `data.actionButtons: [...]`.
   - **Importante**: no enviéis claves `undefined`/vacías dentro de los objetos del
     array; Firebase RTDB no admite `undefined`. Omitid el campo o usad `null` según
     vuestra convención (mejor omitir).
5. Añadir el campo **`bodyLong`** (textarea) con el checkbox descrito en §2.bis. No
   enviar la clave si está vacía (Firebase RTDB no admite `undefined`).

## 4. Notas / límites

- Estos botones son **in-app** (tarjeta + modal del centro de notificaciones de la
  app). Los botones de la **notificación del sistema iOS** dependen de *categorías*
  pre-registradas en la app (`categoryId` ∈ `general`/`eventos`/`fotos`, 1 botón cada
  una) y **no** se pueden definir dinámicamente desde el payload. No confundir ambos.
- En Android la notificación del sistema tampoco pinta estos botones dinámicos; son
  para dentro de la app.
- El cambio en la app es **OTA** (JS puro), así que no requiere build de tienda: en
  cuanto la OTA esté publicada, los dispositivos verán varios botones y la descripción
  extendida.
- `bodyLong` también es solo in-app (modal de detalle). No cambia nada de la push del
  sistema.

## 5. Referencias en el repo de la app

- Contrato completo: `NOTIFICACIONES_CONTRATO.md` (§3 botones, §3.bis `bodyLong`, §2 rutas).
- Guía funcional: `NOTIFICACIONES.md` (§"Contenido de texto: body y bodyLong" y
  §"Arquitectura de botones y navegación").
- Implementación: `mcm-app/utils/notificationRoutes.ts`
  (`extractActionButtons`, `MAX_ACTION_BUTTONS`), `mcm-app/types/notifications.ts`
  (`NotificationActionButtonData`, campo `bodyLong`), `mcm-app/app/notifications.tsx`
  (render del detalle con fallback `bodyLong || body`).
