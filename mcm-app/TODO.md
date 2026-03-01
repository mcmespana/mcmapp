# TODO — MCM App · Checklist de mantenimiento y mejoras

> Lista de tareas pendientes para mantener y mejorar la app.
> Agentes IA: consultad esta lista antes de trabajar. Marcad como completadas las tareas que terminéis.

---

## Completado recientemente

- [x] ~~Activar pestaña Cantoral~~ → `cancionero: true` en `constants/featureFlags.ts`
- [x] ~~Limpiar ReportBugsModal* muertos~~ → eliminados New, Fixed, Simple, .bak, .broken, .complex (el principal sigue en uso por SongControls.tsx)
- [x] ~~Eliminar scripts de debug y configs de test~~ → eliminados test-*.js, jest.config.js
- [x] ~~Mover eslint-config-expo a devDependencies~~ → hecho en package.json
- [x] ~~Eliminar dotenv~~ → solo se usaba en test-firebase.js (eliminado). Expo carga .env nativamente
- [x] ~~Añadir ErrorBoundary global~~ → `components/ErrorBoundary.tsx` envolviendo RootLayout
- [x] ~~Mejorar splash screen~~ → reducido de 1.5s a 0.9s (3 repeticiones en vez de 4)
- [x] ~~Consolidar documentación NOTIS_*.md~~ → unificado en `NOTIFICACIONES.md` en la raíz
- [x] ~~Eliminar agents.md duplicado~~ → mantenemos solo `AGENTS.md`
- [x] ~~Verificar bug de IDs de notificaciones~~ → ya estaba corregido (usa `data?.id || identifier`)

---

## Prioridad alta (hacer pronto)

- [ ] **Seguridad — contraseña hardcodeada**: en `components/SecretPanelModal.tsx` la contraseña "coco" está en el código. Mover a variable de entorno o Firebase Remote Config.
- [ ] **Verificar orden de tabs con cantoral activo**: ahora que `cancionero: true`, probar que TABS_CONFIG muestra los tabs en el orden correcto (Inicio → Cantoral → Calendario → Fotos → Más) y que la Home muestra el botón del cantoral.
- [ ] **npm install tras cambios en package.json**: se eliminaron dotenv, jest-expo, testing-library y react-test-renderer de dependencies. Se movió eslint-config-expo a devDependencies. Ejecutar `npm install` para regenerar package-lock.json.

## Prioridad media (mejoras importantes)

- [ ] **Pantalla de inicio (Home)**: rediseñar la home screen (ver sección Ideas más abajo).
- [ ] **Notificaciones — mejoras del cliente (sin backend)**:
  - [ ] Usar `subscribeToNotifications()` en `notifications.tsx` para suscripción en tiempo real (ya existe en el servicio pero no se usa)
  - [ ] Crear `contexts/NotificationsContext.tsx` para que el badge se actualice cuando llega una notificación en foreground
  - [ ] Crear pantalla o modal de detalle de notificación (body completo + imagen + botón acción)
  - [ ] Añadir botón "Marcar todas como leídas"
  - Ver `NOTIFICACIONES.md` para detalles completos
- [ ] **Notificaciones — backend (panel admin Next.js)**: crear el panel para enviar notificaciones. Ver `NOTIFICACIONES.md` Fase 2 para la especificación completa. Incluye:
  - API `/api/notifications/send` (Firebase + Expo Push API)
  - API `/api/notifications/stats` (estadísticas de dispositivos)
  - UI con formulario + dashboard
  - Limpieza automática de tokens inválidos
- [ ] **Firebase Remote Config para feature flags**: actualmente los flags están hardcodeados en `constants/featureFlags.ts`. Alternativas:
  - **Firebase Remote Config** (recomendado): requiere `firebase/remote-config` en el cliente. Ventaja: dashboard en Firebase Console, cambios sin deploy. Desventaja: añade latencia al arranque.
  - **Firebase Realtime Database** (alternativa simple): guardar flags en un nodo `/config/featureFlags`. Usa el mismo patrón `useFirebaseData` que ya tiene la app. Menos sofisticado pero no requiere SDKs adicionales.
  - **Expo Updates OTA** (actual): cambiar flags y publicar OTA update. Funciona pero requiere un deploy (aunque sea rápido).
  - El `FeatureFlagsContext.tsx` ya está preparado para recibir flags remotos.
- [ ] **Configurar tests**: cuando se retome testing, instalar jest-expo, @testing-library/react-native, crear jest.config.js. Priorizar tests para utils/ y hooks/.

## Prioridad baja (nice to have)

- [ ] **Limpiar carpeta `(tabsdesactivados)/`**: decidir si eliminar o mantener `comunica.tsx` como referencia.
- [ ] **Pre-commit hooks**: configurar lint-staged + husky.
- [ ] **Actualizar dependencias**: `npx expo install --check`.
- [ ] **Accesibilidad**: `accessibilityLabel` en botones/iconos, contraste de colores.
- [ ] **Dark mode completo**: verificar todas las pantallas en modo oscuro.
- [ ] **Performance Home**: auditar re-renders. Las animaciones de entrada se recrean en cada render.
- [ ] **Borrar rama `origin/notificaciones`**: es un artefacto histórico, todo está superado por main.

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
