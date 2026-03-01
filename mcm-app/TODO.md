# TODO — MCM App · Checklist de mantenimiento y mejoras

> Lista de tareas pendientes para mantener y mejorar la app.
> Agentes IA: consultad esta lista antes de trabajar. Marcad como completadas las tareas que terminéis.

---

## Prioridad alta (hacer pronto)

- [ ] **Activar pestaña Cantoral**: cambiar `cancionero: false` → `true` en `constants/featureFlags.ts`. Verificar que el orden de tabs sea correcto en `TABS_CONFIG` (Inicio, Cantoral, Calendario, Fotos, Más). Verificar que la Home también muestre el botón del Cantoral.
- [ ] **Limpiar código muerto**: eliminar `components/ReportBugsModal.tsx`, `ReportBugsModalFixed.tsx`, `ReportBugsModalNew.tsx`, `ReportBugsModalSimple.tsx` (reemplazados por `AppFeedbackModal.tsx`). Verificar que ningún archivo los importe.
- [ ] **Eliminar scripts de debug**: mover o eliminar `test-calendar-fix.js`, `test-firebase.js`, `test-new-logic.js` de la raíz de mcm-app (no son tests de Jest).
- [ ] **Seguridad — contraseña hardcodeada**: en `components/SecretPanelModal.tsx` la contraseña "coco" está en el código. Mover a variable de entorno o a Firebase Remote Config.
- [ ] **Mover eslint-config-expo a devDependencies**: está en `dependencies` en package.json, debería estar en `devDependencies`.
- [ ] **Evaluar eliminar `dotenv`**: Expo carga variables `.env` nativamente. El paquete `dotenv` en dependencies puede ser innecesario.

## Prioridad media (mejoras importantes)

- [ ] **Añadir ErrorBoundary**: no hay componente de captura de errores. Crear un ErrorBoundary en `app/_layout.tsx` que envuelva toda la app y muestre un fallback amigable en caso de crash.
- [ ] **Escribir tests básicos**: hay Jest configurado pero cero tests. Priorizar tests para:
  - `utils/filterSongsData.ts`
  - `utils/chordNotation.ts`
  - `utils/songUtils.ts`
  - `hooks/useFirebaseData.ts` (mock de Firebase)
- [ ] **Pantalla de inicio (Home)**: rediseñar la home screen (ver sección Ideas más abajo).
- [ ] **Mejorar splash screen**: actualmente muestra `HelloWave` durante 1.5s. Considerar usar el splash screen nativo de Expo (ya configurado en app.json) en lugar del componente React.
- [ ] **Revisar sistema de notificaciones**: bug documentado en `NOTIS_APP_MEJORAS.md` — el ID de notificación del cliente no coincide con el de Firebase. Fix: usar `data.id` en lugar de `notification.request.identifier`.
- [ ] **Configurar Firebase Remote Config**: para feature flags remotos en vez de hardcodeados. El `FeatureFlagsContext` ya está preparado para recibirlos.
- [ ] **Unificar archivos NOTIS_*.md**: 4 archivos de documentación de notificaciones en la raíz. Consolidar en uno solo o mover a una carpeta `docs/`.

## Prioridad baja (nice to have)

- [ ] **Limpiar carpeta `(tabsdesactivados)/`**: el archivo `comunica.tsx` está ahí pero la carpeta rompe la convención de Expo Router. Decidir si se elimina o se mantiene como referencia.
- [ ] **Añadir pre-commit hooks**: configurar lint-staged + husky para formateo automático antes de commits.
- [ ] **Optimizar imágenes**: verificar que las imágenes en `assets/images/` están optimizadas para mobile.
- [ ] **Actualizar dependencias**: revisar actualizaciones disponibles con `npx expo install --check`.
- [ ] **Mejorar accesibilidad**: añadir `accessibilityLabel` a botones e iconos, verificar contraste de colores.
- [ ] **Dark mode completo**: verificar que todas las pantallas se ven bien en modo oscuro. Algunas screens pueden tener colores hardcodeados.
- [ ] **Eliminar duplicado agents.md/AGENTS.md**: ya eliminado `agents.md` (minúsculas), mantener `AGENTS.md`.
- [ ] **Performance**: auditar re-renders innecesarios. El Home recrea animaciones en cada render.

---

## Ideas para la Home Screen

La home actual es un grid de botones de colores con animaciones de entrada. Funciona, pero es muy estática y no aporta información útil al usuario. Ideas de mejora:

### Opción A: Home con contenido dinámico
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
- Versión más limpia, sin animaciones pesadas

### Recomendación
La **Opción A** es la más equilibrada: mantiene la navegación rápida pero añade contenido útil que da razones para abrir la app. El próximo evento del calendario y la canción destacada son los ganchos más fuertes.

---

## Conexión Firebase para agentes IA

Para que un agente IA pueda interactuar con Firebase directamente:

### Opción 1: Firebase Admin SDK (recomendada para backend)
- Descargar la service account key desde Firebase Console → Project Settings → Service Accounts
- Guardar como `firebase-admin-key.json` (NUNCA commitear, añadir a .gitignore)
- Usar `firebase-admin` SDK de Node.js para lectura/escritura directa
- Esto es útil para scripts de mantenimiento, no para la app en sí

### Opción 2: REST API de Firebase
- Firebase Realtime Database tiene REST API: `https://[PROJECT_ID].firebaseio.com/[PATH].json`
- Para lectura pública: `curl https://tu-proyecto.firebaseio.com/songs.json`
- Para escritura: necesita auth token (service account o custom token)
- Útil para que agentes lean/escriban datos sin instalar SDKs

### Opción 3: .env.local con credenciales web
- Crear `.env.local` siguiendo `.env.example`
- El agente puede usar los scripts de test existentes (`test-firebase.js`) como referencia
- Limitación: las credenciales web solo permiten lo que las Security Rules permitan

### Configuración de Security Rules
Actualmente las rules probablemente permiten lectura pública. Para dar acceso de escritura seguro:
```json
{
  "rules": {
    "songs": { ".read": true, ".write": "auth != null" },
    "jubileo": { ".read": true, ".write": "auth != null" }
  }
}
```

### Recomendación práctica
1. Descarga la service account key y guárdala como `firebase-admin-key.json` en la raíz (gitignored)
2. Crea un script `scripts/firebase-admin.ts` que use el Admin SDK
3. Los agentes pueden usar ese script para leer/escribir datos
4. Añade `firebase-admin-key.json` al `.gitignore` de mcm-app
