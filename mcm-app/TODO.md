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

- [ ] **Upgrade a Expo SDK 55**: actualizar expo y todos los paquetes expo-\* a la versión 55. Requiere `npx expo install --fix` y testing completo. React Native 0.81→0.84, React 19.1→19.2. Ver `npm outdated` para la lista completa.
- [ ] **Firebase 11 → 12**: major version upgrade. Revisar [guía de migración](https://firebase.google.com/support/release-notes/js) antes de actualizar. Puede haber breaking changes en la API.
- [ ] **Seguridad — contraseña hardcodeada**: en `components/SecretPanelModal.tsx` la contraseña "coco" está en el código. Mover a variable de entorno o Firebase Remote Config.
- [ ] **Verificar orden de tabs por perfil**: probar en dispositivo iOS/Android que `TABS_CONFIG` filtrado por `resolved.tabs` muestra los tabs en el orden correcto para cada perfil (Inicio → Cantoral → Contigo → Calendario → Fotos → Más).

## Prioridad media (mejoras importantes)

- [ ] **Sección "Contigo"** — nuevo tab con Evangelio del Día, Mi Rato de Oración, Examen del Día + habit tracker espiritual. **Ver `TODO_CONTIGO.md` para el diseño técnico completo.**

- [ ] **Pantalla de inicio (Home)**: rediseñar la home screen (ver sección Ideas más abajo).
- [ ] **Notificaciones — backend (panel admin)**: en desarrollo en `mcmespana/mcmpanel`. La app (cliente) ya está lista para recibir notificaciones. Ver `NOTIFICACIONES.md` para la especificación del backend y formato de mensajes Expo Push.
- [ ] **Pendiente del admin para Sistema de Perfiles**: subir `firebase-seed/profileConfig.json` al nodo `/profileConfig`, rellenar `defaultCalendars` por perfil con los IDs reales de `/calendars`, y añadir entradas en `delegations.{id}` para delegaciones con calendario/topic propio. Ver `TODO_SISTEMA_PERFILES.md`.
- [ ] **Configurar tests**: cuando se retome testing, instalar jest-expo, @testing-library/react-native, crear jest.config.js. Priorizar tests para utils/ y hooks/.

## Prioridad baja (nice to have)

- [ ] **Limpiar carpeta `(tabsdesactivados)/`**: decidir si eliminar o mantener `comunica.tsx` como referencia.
- [ ] **Accesibilidad — ampliar cobertura**: las pantallas principales (Home, Notificaciones) ya tienen labels. Falta cubrir el resto de pantallas (Cantoral, Calendario, Fotos, Reflexiones, etc.).
- [ ] **Borrar rama `origin/notificaciones`**: es un artefacto histórico, todo está superado por main.
- [ ] **Notificaciones — mejoras extra (Fase 3)**: agrupación por fecha, filtros/búsqueda, notificaciones programadas, segmentación por plataforma. Ver `NOTIFICACIONES.md`.

---

## Inconsistencias del Design System

> Detectadas al documentar `DESIGN.md`. Revisar y unificar cuando se pueda.

- [x] ~~Dos sistemas de colores "primary" en conflicto~~ → `theme.ts` ahora re-exporta `UIColors` desde `colors.ts`. Los colores de UI (`#007bff`) están en `UIColors` con nombre explícito (`activePrimary`), separados de los de marca (`#253883` en `brand.primary`).
- [x] ~~Border radius inconsistente~~ → tokens centralizados en `uiStyles.ts` (`radii.sm=8, radii.md=12, radii.lg=14, radii.xl=18, radii.pill=20, radii.full=28`). Los componentes existentes siguen con valores inline pero los nuevos deben usar `radii.*`.
- [x] ~~Sombras ad-hoc por componente~~ → 3 presets en `uiStyles.ts` (`shadows.sm`, `shadows.md`, `shadows.lg`). Los componentes existentes siguen con valores inline pero los nuevos deben usar `shadows.*`.
- [x] ~~Color de fondo dark mode hardcodeado~~ → añadido `Colors.dark.card: '#3A3A3C'` y `Colors.light.card: '#FFFFFF'`. Reemplazadas 20+ ocurrencias de `#3A3A3C` hardcodeado en 8 archivos.
- [ ] **Tipografía no conectada a componentes**: `constants/typography.ts` define h1/h2/body/caption/button, pero la mayoría de componentes definen fontSize y fontWeight inline en sus StyleSheets. El archivo typography solo se importa en 5 archivos.
- [x] ~~Colores de toast no centralizados~~ → exportados como `ToastColors` desde `colors.ts`. `Toast.tsx` actualizado para usarlos.
- [x] ~~spacing.js debería ser .ts~~ → renombrado a `spacing.ts` con `as const`.
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
