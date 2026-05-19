# TODO — MCM App · Checklist de mantenimiento y mejoras

> Lista de tareas pendientes para mantener y mejorar la app.
> Agentes IA: consultad esta lista antes de trabajar. Marcad como completadas las tareas que terminéis.

---

## Completado recientemente

- [x] ~~Activar pestaña Cantoral~~ → cancionero presente en `tabs` de todos los perfiles del Sistema de Perfiles (antes era `cancionero: true` en `constants/featureFlags.ts`)
- [x] ~~Sistema de perfiles de usuario~~ → Fases 0–8 completadas. Ver `TODO_SISTEMA_PERFILES.md`. El antiguo `constants/featureFlags.ts` y `FeatureFlagsContext` han sido eliminados.
- [x] ~~Limpiar ReportBugsModal\* muertos~~ → eliminados New, Fixed, Simple, .bak, .broken, .complex (el principal sigue en uso por SongControls.tsx)
- [x] ~~Eliminar scripts de debug y configs de test~~ → eliminados test-\*.js, jest.config.js
- [x] ~~Mover eslint-config-expo a devDependencies~~ → hecho en package.json
- [x] ~~Eliminar dotenv~~ → solo se usaba en test-firebase.js (eliminado). Expo carga .env nativamente
- [x] ~~Añadir ErrorBoundary global~~ → `components/ErrorBoundary.tsx` envolviendo RootLayout
- [x] ~~Mejorar splash screen~~ → reducido de 1.5s a 0.9s (3 repeticiones en vez de 4)
- [x] ~~Consolidar documentación NOTIS\_\*.md~~ → unificado en `NOTIFICACIONES.md` en la raíz
- [x] ~~Eliminar agents.md duplicado~~ → mantenemos solo `AGENTS.md`
- [x] ~~Verificar bug de IDs de notificaciones~~ → ya estaba corregido (usa `data?.id || identifier`)
- [x] ~~Notificaciones — mejoras del cliente~~ → NotificationsContext, suscripción real-time, modal detalle, marcar todas como leídas, iOS action buttons
- [x] ~~Pre-commit hooks~~ → husky + lint-staged en raíz del monorepo (Prettier)
- [x] ~~Actualizar dependencias~~ → todas al máximo dentro de Expo SDK 54 (`npm update`)
- [x] ~~Accesibilidad~~ → `accessibilityLabel` y `accessibilityRole` en Home y Notificaciones
- [x] ~~Dark mode~~ → corregidos ErrorBoundary, SongFullscreen, Comida, Monitores, Wordle, Reflexiones
- [x] ~~Performance Home~~ → `React.memo()` en ContextualDecoration, `useRef` para animaciones

---

## Prioridad alta (hacer pronto)

- [ ] Revisar pestaña más del menu de abajo, diseñarla bien cuando no sale
- [ ] Revisar diseño en iPads y arreglarlo. 
- [ ] En iPad Contigo se ven desproporcionados los habit tracker
- [ ] Revisar modo oscuro en seccion contigo, con los colores, la lectura del evangelio....
- [ ] Arreglar los textos 



- [ ] **Firebase 11 → 12**: major version upgrade. Revisar [guía de migración](https://firebase.google.com/support/release-notes/js) antes de actualizar. Puede haber breaking changes en la API.


- [ ] **Long-press menús contextuales en items de cantoral**.
      Usar `Menu` de heroui-native para ofrecer "Compartir", "Copiar
      letra", "Transponer rápido" sobre cada item al hacer long-press en
      `SongListScreen`. Punto de partida: `components/SongListItem.tsx`
      (mantener el `Swipeable` actual; el Menu se activa con `onLongPress`).
- [ ] **Atajos de teclado en web**.
  - `Cmd/Ctrl + K` para abrir un buscador global (cantoral, calendario,
    reflexiones). Implementar con `useEffect` + `window.addEventListener('keydown')`
    detrás de `Platform.OS === 'web'`. Posible UI: `Dialog` de
    heroui-native en modo command palette.
  - `Esc` para cerrar el sheet/diálogo abierto más reciente. Centralizar
    en un hook `useEscapeToClose` o en cada componente sheet.





## Modernización pendiente (prioridad alta)

> Tareas que extienden el trabajo de alineación de estilos hecho en la
> rama `claude/modernize-app-design-V5LuI`. Cada una es independiente
> y puede hacerse en su propio PR.

- [ ] **Reanimated 3 en NotificationsBottomSheet**.
      Migrar el `PanResponder` + `Animated.Value` a `Gesture.Pan()` (RNGH v2)
  - `useSharedValue` + `withSpring/withTiming`. Riesgo medio: requiere
    testing exhaustivo del gesto de cierre por swipe-down. Pendiente
    desde el PR de migración del ping badge en Home (se decidió no tocar
    este componente para minimizar regresiones).
- [ ] **`GruposScreen` — `PageContainer` y `ScreenHero`**.
      Hoy `ScreenHero` solo se aplica en la vista raíz. Aplicar
      `PageContainer` en las 5 ramas de render para que también centre en
      web (búsqueda activa, categoría seleccionada, grupo seleccionado, etc.).
- [ ] **Skeletons en más pantallas**.
      Replicar el patrón aplicado en Home (eventos próximos) en:
      Contactos, Visitas, Apps, Materiales, Horario, Profundiza, Grupos.
      Todas cargan de Firebase y hoy muestran un spinner full-screen
      (`ProgressWithMessage`). Un Skeleton in-place se siente más
      responsive.
- [ ] **`SongListItem` — colores de acción swipe**.
      Quedan magic numbers `#34C759` (rightAction success), `#FF453A`
      (leftAction destructive), y los `keyPill` `#1A2744`/`#EEF4FF`.
      Documentar como Apple system colors o centralizar.

## Mantenimiento


- [ ] **Configurar tests**: cuando se retome testing, instalar jest-expo, @testing-library/react-native, crear jest.config.js. Priorizar tests para utils/ y hooks/.

## Prioridad baja (nice to have)

- [ ] **Ordenar los archivos**: Hay *.tsx en app, en tabs contigo... ordenar un poco esa movida*

- [ ] **Accesibilidad — ampliar cobertura**: las pantallas principales (Home, Notificaciones) ya tienen labels. Falta cubrir el resto de pantallas (Cantoral, Calendario, Fotos, Reflexiones, etc.).


---

## Inconsistencias del Design System

> Detectadas al documentar `DESIGN.md`. Revisar y unificar cuando se pueda.


- [ ] **Tipografía no conectada a componentes**: `constants/typography.ts` define h1/h2/body/caption/button, pero la mayoría de componentes definen fontSize y fontWeight inline en sus StyleSheets. El archivo typography solo se importa en 5 archivos
- [ ] **Falta token para modal borderRadius**: modales usan 8px o 12px según el componente. `radii.sm=8` y `radii.md=12` están disponibles pero no se aplican aún a los modales existentes.
- [ ] **Peso de fuente inconsistente en labels**: labels de sección usan `fontWeight: '800'`, badges usan `'800'`, títulos de cards usan `'700'`, botones usan `'500'`/`'700'` — no hay una guía clara de qué peso usar para qué nivel.
- [ ] **Migrar componentes existentes a tokens**: los nuevos tokens (`radii.*`, `shadows.*`) están definidos pero los componentes existentes siguen usando valores inline. Ir migrando gradualmente en futuras iteraciones.

---

## Ideas para la Home Screen

La home actual es un grid de botones de colores con animaciones de entrada. Funciona, pero es muy estática y no aporta información útil al usuario.

### Opción A: Home con contenido dinámico (recomendada)

- **Próximo evento** del calendario (tarjeta destacada arriba)
- **Accesos rápidos** a las secciones (grid más compacto)
- **Canción del día / canción destacada** (si el cantoral está activo)
- **Wordle pendiente** con indicador visual más claro
- **Último contenido actualizado** (materiales, reflexiones)

### Opción B: Home tipo dashboard

- Saludo personalizado ("Hola, [nombre]" si UserProfile tiene nombre)
- Fecha de hoy + próximo evento
- Cards apiladas con preview de contenido
- Acciones frecuentes como FAB (botón flotante)

### Opción C: Home minimalista

- Logo MCM grande arriba
- Lista simple de secciones con subtítulo informativo
- Barra de búsqueda global
- Sin animaciones pesadas

**Recomendación:** La **Opción A** es la más equilibrada. El próximo evento del calendario y la canción destacada son los ganchos más fuertes para que el usuario abra la app.

---

---

## Conexión Firebase para agentes IA

### Opción 1: Firebase Admin SDK (recomendada)

1. Firebase Console → Project Settings → Service Accounts → Generate new private key
2. Guardar como `firebase-admin-key.json` en la raíz (NUNCA commitear)
3. Añadir a `.gitignore`: `firebase-admin-key.json`
4. Crear script `scripts/firebase-admin.ts` que use el Admin SDK
5. Los agentes usan ese script para leer/escribir datos

### Opción 2: REST API de Firebase

```bash
# Lectura (si rules permiten .read: true)
curl https://[PROJECT_ID].firebaseio.com/songs.json
```

### Opción 3: .env.local con credenciales web

- Crear `.env.local` siguiendo `.env.example`
- Limitación: solo permite lo que las Security Rules permitan

---

## 🚀 Visión a Futuro: Innovación y Arquitectura

> Propuestas técnicas y funcionales de alto impacto para llevar la app al nivel "Enterprise", mejorando radicalmente el rendimiento, la experiencia de desarrollo (DX) y aportando un valor único a la comunidad.

### 🏗️ Mejoras Técnicas y de Rendimiento

- [ ] **⚡ Sustitución de Context API por Zustand + Jotai (Gestión de Estado)**
  - **El problema:** La gran cantidad de Providers anidados en `_layout.tsx` (UserProfile, Notifications, SelectedSongs, etc.) obliga a re-renderizados masivos en el árbol de componentes.
  - **La solución:** Migrar el estado global dinámico a **Zustand** (para lógica de negocio general) y **Jotai** (para estado atómico ultra-preciso).
  - **Impacto:** Código mucho más limpio (adiós al anidamiento de Contextos) y un rendimiento superior al evitar actualizaciones de componentes que no necesitan repintarse.

- [ ] **⚡ Migración Masiva a `@shopify/flash-list`**
  - **El problema:** Las listas muy largas (Cantoral, eventos, directorios) usando `FlatList` o `ScrollView` consumen mucha memoria porque crean y destruyen vistas constantemente.
  - **La solución:** Sustituir los componentes estándar de lista por **FlashList** de Shopify, que recicla los componentes usando C++ en bajo nivel.
  - **Impacto:** Listas bloqueadas a 60/120 FPS sin importar lo rápido que se haga scroll, eliminando pantallas en blanco y reduciendo drásticamente el consumo de RAM.

- [ ] **🎨 Renderizado de Gráficos con React Native Skia**
  - **El problema:** Dibujar elementos complejos (como un calendario de hábitos o un heatmap en la futura sección "Contigo") generando decenas de `View` de React Native ahoga el JS Thread.
  - **La solución:** Implementar **React Native Skia** (el motor gráfico 2D de Chrome) para dibujar directamente en un Canvas mediante aceleración por hardware (GPU).
  - **Impacto:** Posibilidad de crear trackers, gráficos y animaciones ultra-fluidas e interactivas sin ningún tipo de lag.

### ✨ Nuevas Funcionalidades "Killer"



- [ ] **📻 Mini-Reproductor de Audio (Música en Background) en "Contigo"**
  - **El concepto:** Integrar un reproductor de audio sutil y flotante utilizando `expo-av` o `react-native-track-player`.
  - **La magia:** Los usuarios podrán escuchar oraciones guiadas, cantos relajantes o podcasts formativos mientras navegan libremente por el "Evangelio del Día" o el calendario, incluso con la pantalla bloqueada.
  - **Impacto:** Fomenta la retención de la app y proporciona una experiencia espiritual inmersiva que acompaña al usuario durante su rato de oración o su día a día.
