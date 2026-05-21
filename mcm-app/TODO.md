# TODO — MCM App · Checklist de mantenimiento y mejoras

> Lista de tareas pendientes para mantener y mejorar la app.
> Agentes IA: consultad esta lista antes de trabajar. Marcad como completadas las tareas que terminéis.

---

## Prioridad alta

- [ ] Revisar pestaña "más" del menu de abajo — diseñarla bien cuando no sale completa
- [ ] Revisar diseño en iPads y arreglarlo
- [ ] En iPad Contigo se ven desproporcionados los habit trackers
- [ ] **Command Palette v2: deep-link a contenidos** — el palette actual (`CommandPalette.tsx`) solo navega a tabs/pantallas top-level. Para saltar a una canción concreta o a un punto dentro de los stacks anidados hay que exponer un `navigation ref` (p.ej. `CancioneroNavRefContext`). Después indexar canciones (`songs/data`), reflexiones (`compartiendo/data`) y eventos del calendario.

---

## Modernización pendiente

- [ ] **Extender `useContextMenu` a otras listas**: el hook ya existe (`hooks/useContextMenu.ts`) y se usa en `SongListItem`. Pendiente aplicarlo a:
  - Notificaciones (`app/notifications.tsx`) — marcar leída / eliminar
  - Reflexiones (`app/screens/ReflexionesScreen.tsx`) — editar / copiar / compartir
  - Contactos (`app/screens/ContactosScreen.tsx`) — llamar / WhatsApp / copiar teléfono
  - Playlist (`app/screens/SelectedSongsScreen.tsx`) — subir / bajar / quitar

---

## Mantenimiento

- [ ] **Escribir tests**: infraestructura lista (jest.config.js + @testing-library/react-native). Priorizar `utils/` y `hooks/`.

---

## Prioridad baja

- [ ] **Accesibilidad — completar cobertura restante**: ya cubren `accessibilityLabel` Home, Notificaciones, Cantoral (Categories/SongList/Detail/Fullscreen/Selected), Calendario (parcial vía Contigo), Contactos, Visitas, Grupos, Apps, EventHome, Profundiza, varios bottom sheets y modales. Falta auditar Fotos (`AlbumListScreen`), Materiales, Horario, Comida, MasHome y los componentes `AlbumCard`/`EventItem`.

---

## Inconsistencias del Design System

- [ ] **Tipografía no conectada a componentes**: `constants/typography.ts` define h1/h2/body/caption/button pero la mayoría de componentes usan fontSize inline. El archivo solo se importa en 5 sitios.
- [ ] **Falta token para modal borderRadius**: los modales usan 8px o 12px según el componente. `radii.sm=8` y `radii.md=12` están disponibles pero no aplicados en los modales existentes.
- [ ] **Peso de fuente inconsistente**: section labels usan `fontWeight: '800'`, títulos de cards `'700'`, botones `'500'`/`'700'`. No hay guía clara de qué peso usar en cada nivel.
- [ ] **Migrar componentes existentes a tokens**: `radii.*` y `shadows.*` están definidos pero los componentes siguen usando valores inline. Migrar gradualmente.

---

## Ideas para la Home Screen

La home actual es un grid de botones estático. Opciones para hacerla más útil:

### Opción A: Home con contenido dinámico (recomendada)
- Próximo evento del calendario (tarjeta destacada arriba)
- Accesos rápidos más compactos
- Canción del día (si el cantoral está activo)
- Wordle pendiente con indicador más claro
- Último contenido actualizado (materiales, reflexiones)

### Opción B: Home tipo dashboard
- Saludo personalizado (si UserProfile tiene nombre)
- Fecha de hoy + próximo evento
- Cards apiladas con preview de contenido

### Opción C: Home minimalista
- Logo MCM grande arriba
- Lista simple de secciones con subtítulo
- Barra de búsqueda global

---

## Mejoras técnicas — rendimiento

> Análisis técnico completo en **`/PERFORMANCE.md`** (raíz del monorepo). Cada item de abajo tiene su sección con archivo:línea y propuesta concreta.

**Quick wins (bajo esfuerzo, bajo riesgo) — empezar por aquí:**

- [ ] **Firebase: descargar `updatedAt` antes que `data`** en `hooks/useFirebaseData.ts`. Hoy se descarga el nodo entero en cada arranque aunque no haya cambios (impacto grande en `songs`/`albums`). Ver PERFORMANCE.md §1.
- [ ] **Memoizar parser ChordPro** en `hooks/useSongProcessor.ts:90` y eliminar el segundo parser temporal usado para `displayKey` (línea 107). Ver PERFORMANCE.md §3.
- [ ] **`freezeOnBlur: true`** en los stacks anidados de `cancionero` y `mas`. Ver PERFORMANCE.md §7.
- [ ] **`expo-image` en `AlbumCard`**: ya está instalado (`package.json:42`) pero nadie lo importa. Reemplazar `ImageBackground` y añadir `placeholder`/`transition`. Ver PERFORMANCE.md §5.
- [ ] **`React.memo` en `SongSearch`, `AlbumCard`, `EventItem`**. Ver PERFORMANCE.md §9.
- [ ] **Eliminar `lodash`** de `package.json` (0 importaciones). Ver PERFORMANCE.md §10.
- [ ] **Reducir `HelloWave`** a 2 repeticiones (600 ms) o saltarlo tras el primer arranque. Ver PERFORMANCE.md §8.

**Iteraciones siguientes (más esfuerzo, más impacto):**

- [ ] **React Compiler** — activar `babel-plugin-react-compiler` (soportado en React 19). Memoiza automáticamente. Ver PERFORMANCE.md §6.
- [ ] **`GruposScreen` → `SectionList`** y **`ContactosScreen` → `FlatList`** (ahora son `ScrollView+.map()` anidados). Ver PERFORMANCE.md §4.
- [ ] **WebView estable con `postMessage`** para aplicar tono/fuente/notación sin recrear el HTML. Elimina el parpadeo al cambiar ajustes en una canción. Ver PERFORMANCE.md §2.
- [ ] **Pre-procesado ChordPro en compilación** — Metro Transformer para parsear `.cho` durante el build en vez de en runtime, eliminando el coste de CPU de ChordSheetJS al abrir canciones. Ver PERFORMANCE.md §3.

**A valorar:**

- [ ] Auditar si `react-native-render-html` compensa (solo se usa en `FormattedContent.tsx`). Si BBCode simple bastara, ahorraría peso de bundle. Ver PERFORMANCE.md §10.
- [ ] Cómo medir antes/después (cold start, transpose, bytes de red, memoria) → PERFORMANCE.md "Cómo medir".
