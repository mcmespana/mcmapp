# TODO — MCM App · Checklist de mantenimiento y mejoras

> Lista de tareas pendientes para mantener y mejorar la app.
> Agentes IA: consultad esta lista antes de trabajar. Marcad como completadas las tareas que terminéis.

---

## Completado recientemente

- [x] ~~Activar pestaña Cantoral~~ → `cancionero: true` en `constants/featureFlags.ts`
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
- [ ] **Verificar orden de tabs con cantoral activo**: ahora que `cancionero: true`, probar en dispositivo que TABS_CONFIG muestra los tabs en el orden correcto (Inicio → Cantoral → Calendario → Fotos → Más).

## Prioridad media (mejoras importantes)

- [ ] **Sección "Contigo"** — nuevo tab con Evangelio del Día, Mi Rato de Oración, Examen del Día + habit tracker espiritual. **Ver `TODO_CONTIGO.md` para el diseño técnico completo.**

- [ ] **Pantalla de inicio (Home)**: rediseñar la home screen (ver sección Ideas más abajo).
- [ ] **Notificaciones — backend (panel admin)**: en desarrollo en `mcmespana/mcmpanel`. La app (cliente) ya está lista para recibir notificaciones. Ver `NOTIFICACIONES.md` para la especificación del backend y formato de mensajes Expo Push.
- [ ] **Sistema de perfiles de usuario**: onboarding con selección de perfil (Familia / Monitor/a / Miembro MCM) + delegación local. Config remota en Firebase RTDB que controla tabs, home, calendarios, álbumes y notificaciones por perfil/delegación. Absorbe y reemplaza el sistema de feature flags actual. **Ver `TODO_SISTEMA_PERFILES.md` para el diseño técnico completo.**
- [ ] **Firebase Remote Config para feature flags**: ~~actualmente los flags están hardcodeados en `constants/featureFlags.ts`~~. **NOTA**: este punto queda absorbido por el sistema de perfiles (ver arriba). La config remota se haría via Firebase RTDB con el patrón `useFirebaseData` existente, no con Remote Config SDK.
- [ ] **Configurar tests**: cuando se retome testing, instalar jest-expo, @testing-library/react-native, crear jest.config.js. Priorizar tests para utils/ y hooks/.

## Prioridad baja (nice to have)

- [ ] **Limpiar carpeta `(tabsdesactivados)/`**: decidir si eliminar o mantener `comunica.tsx` como referencia.
- [ ] **Accesibilidad — ampliar cobertura**: las pantallas principales (Home, Notificaciones) ya tienen labels. Falta cubrir el resto de pantallas (Cantoral, Calendario, Fotos, Reflexiones, etc.).
- [ ] **Borrar rama `origin/notificaciones`**: es un artefacto histórico, todo está superado por main.
- [ ] **Notificaciones — mejoras extra (Fase 3)**: agrupación por fecha, filtros/búsqueda, notificaciones programadas, segmentación por plataforma. Ver `NOTIFICACIONES.md`.

---

## Inconsistencias del Design System

> Detectadas al documentar `DESIGN.md`. Revisar y unificar cuando se pueda.

- [ ] **Dos sistemas de colores "primary" en conflicto**: `constants/colors.ts` define `primary: '#253883'` (azul MCM) y `app/styles/theme.ts` define `AppColors.primary: '#007bff'` (azul genérico Bootstrap). Varios componentes importan de uno u otro sin criterio claro.
- [ ] **Border radius inconsistente**: no hay tokens centralizados. Los valores varían entre 6px, 8px, 10px, 12px, 14px, 18px, 20px según el componente. Solo `buttonBorderRadius: 8` está definido como constante en `uiStyles.ts`, el resto son valores inline.
- [ ] **Sombras ad-hoc por componente**: `uiStyles.ts` define `commonShadow` (opacity 0.2, radius 3), pero casi ningún componente lo usa. Toast usa opacity 0.3/radius 8, Home cards usan 0.07/radius 6 o 0.04/radius 3, SettingsPanel usa shadowColor tintado con primary. Cada componente define su propia sombra inline.
- [ ] **Color de fondo dark mode hardcodeado**: varias pantallas usan `#3A3A3C` como fondo de cards en dark mode, pero `Colors.dark.background` es `#2C2C2E`. No hay un token para "card background" en dark mode.
- [ ] **Tipografía no conectada a componentes**: `constants/typography.ts` define h1/h2/body/caption/button, pero la mayoría de componentes definen fontSize y fontWeight inline en sus StyleSheets. El archivo typography apenas se importa.
- [ ] **Colores de toast no centralizados**: los colores (#4CAF50, #F44336, etc.) están hardcodeados dentro de `Toast.tsx`. No usan los tokens de `colors.ts` (success, danger, etc.), que tienen valores distintos (#A3BD31 vs #4CAF50, #9D1E74 vs #F44336).
- [ ] **spacing.js debería ser .ts**: es el único archivo de constants en JavaScript plano; el resto son TypeScript.
- [ ] **Falta token para modal borderRadius**: modales usan 8px o 12px según el componente, sin un valor estándar exportado.
- [ ] **Peso de fuente inconsistente en labels**: labels de sección usan `fontWeight: '800'`, badges usan `'800'`, títulos de cards usan `'700'`, botones usan `'500'`/`'700'` — no hay una guía clara de qué peso usar para qué nivel.

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
