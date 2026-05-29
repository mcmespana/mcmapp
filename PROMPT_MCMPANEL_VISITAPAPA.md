# Prompt para el agente de **mcmpanel** — Visita Papa León XIV 2026

> Contexto: en la app MCM (repo `mcmapp`, carpeta `mcm-app/`) se ha añadido el
> evento **"Visita Papa León XIV 2026"** (`visitapapa26`, datos en Firebase bajo
> `activities/visitapapa26`) y un sistema de **eventos activos/archivados**. El
> panel `mcmpanel` debe poder gestionarlo. Este documento describe qué cambió en
> la app y qué hay que implementar/ajustar en el panel.

---

## 1. Qué cambió en la app (contexto para el panel)

- **Catálogo de tabs** ahora incluye `visitapapa`. El catálogo de items de "Más"
  cambia `jubileo` por `eventos-pasados`. El catálogo de botones de Home incluye
  `visitapapa`. IDs canónicos (en `mcm-app/constants/profileCatalog.ts`):
  - `KNOWN_TABS`: …, `visitapapa`, …
  - `KNOWN_HOME_BUTTONS`: …, `visitapapa`, …
  - `KNOWN_MAS_ITEMS`: `comunica`, `comunica-gestion`, `jubileo`,
    `eventos-pasados`
- **Evento activo (modo evento)**: hoy está fijado en código
  (`mcm-app/constants/events.ts` → `ACTIVE_EVENT_ID = 'visitapapa26'`, y cada
  evento tiene `status: 'active' | 'archived'`). El evento activo se resalta con
  tab propia + botón Home + banner; los archivados se ven en "Más > Eventos
  pasados".
- **Secciones de evento**: una sección puede ser un **enlace externo** (campo
  `url`) en vez de una pantalla (ej. "Comida de Domingo" → lista de Google Maps).

## 2. Cambios necesarios en el panel (gestión de perfiles)

El panel ya edita `/profileConfig/data/profiles/*`. Hay que:

1. Ofrecer `visitapapa` en los multiselects de **tabs** y **homeButtons**.
2. Sustituir `jubileo` por `eventos-pasados` en el multiselect de **masItems**
   (mantener `jubileo` reconocido por compatibilidad con configs antiguas).
3. Al guardar, recalcular `/profileConfig` y refrescar `updatedAt` (patrón
   existente). Seed de referencia: `mcm-app/firebase-seed/profileConfig.json`
   (monitor y miembro ya traen `visitapapa` en tabs+homeButtons; todos los
   perfiles usan `eventos-pasados`).

## 3. Gestión de secciones del evento `visitapapa26`

Mismo patrón que Jubileo: cada sección vive en
`activities/visitapapa26/<seccion>` con forma `{ updatedAt, data, hidden? }`.
Secciones actuales: `horario`, `materiales`, `visitas`, `profundiza`, `grupos`,
`contactos`, `apps`, `compartiendo` (reflexiones). El panel debe poder
crear/editar/ocultar (`hidden: true`) estas secciones.

> "Comida de Domingo" **no** es una sección de Firebase: es una sección-enlace
> definida en código que abre una URL de Google Maps. Si en el futuro se quiere
> editar esa URL desde el panel, ver el paso 4.

## 4. SIGUIENTES PASOS — mover "evento activo/archivado" a Firebase (nodo `activities/`)

Hoy el evento activo y el estado (`active`/`archived`) están en código. El
objetivo es gestionarlos desde el panel sin desplegar la app. Plan propuesto:

1. **Modelo en Firebase** (bajo `activities/`):
   - `activities/_meta` → `{ activeEventId: 'visitapapa26', updatedAt }`
     (qué evento entra en "modo evento": tab + banner + por defecto).
   - `activities/<evento>/_meta` → `{ status: 'active' | 'archived',
     title, tintColor, bannerText, updatedAt }` (metadatos por evento, hoy en
     `EventConfig` de `constants/events.ts`).
   - Opcional: permitir secciones-enlace editables, p.ej.
     `activities/<evento>/_sections` con entradas `{ label, emoji, url, ... }`
     para no tocar código al cambiar la URL de "Comida de Domingo".
2. **Lado app** (cuando se implemente): un hook `useFirebaseData` que lea
   `activities/_meta` y `activities/<evento>/_meta` y **sobrescriba** los valores
   de `constants/events.ts` (el código queda como fallback offline). Resolver:
   - `ACTIVE_EVENT_ID` ← `activities/_meta.activeEventId`.
   - `status` por evento ← `_meta.status` (decide tab/banner vs "Eventos pasados").
3. **Panel**: UI para (a) marcar un evento como **activo** (modo evento) o
   **archivado**, (b) editar `title`/`tintColor`/`bannerText`, y (c) gestionar
   secciones-enlace. Al cambiar, escribir el nodo correspondiente + `updatedAt`.
4. **Generalizar actividades-tab**: hoy añadir una actividad como tab requiere un
   archivo `app/(tabs)/<evento>.tsx` + entradas de catálogo. Valorar un registro
   dinámico (la app crea la tab a partir de `activities/<evento>/_meta`) para que
   lanzar un evento futuro sea 100% desde el panel.

## 5. Checklist rápido

- [ ] `visitapapa` disponible en tabs y homeButtons del editor de perfiles.
- [ ] `eventos-pasados` disponible en masItems (y `jubileo` aún reconocido).
- [ ] Edición de secciones de `activities/visitapapa26/*` con `hidden`.
- [ ] (Siguiente fase) nodo `activities/_meta` + `_meta` por evento y UI para
      activar/archivar eventos.
