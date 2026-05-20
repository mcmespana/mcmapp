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

- [ ] **Accesibilidad — ampliar cobertura**: Home y Notificaciones ya tienen `accessibilityLabel`. Falta el resto (Cantoral, Calendario, Fotos, Reflexiones, etc.).

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

## Mejoras técnicas a valorar

1. **Pre-procesado ChordPro en compilación** — crear un Metro Transformer para parsear `.cho` durante el build en vez de en runtime, eliminando el coste de CPU de ChordSheetJS al abrir canciones.

2. **React Compiler** — activar `babel-plugin-react-compiler` (soportado en React 19). Memoiza automáticamente sin necesidad de `useMemo`/`useCallback` manuales.
