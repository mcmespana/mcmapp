# MCM App — Revisión de Calidad

> Generado: 2026-05-19  
> Revisado por: Claude Code  
> Rama base: `claude/review-app-quality-miVM2`

---

## 🔴 Prioridad Alta

### Seguridad — Firebase sin autenticación

- [ ] **Añadir Firebase Anonymous Auth** para proteger escrituras en Firebase.  
  Sin auth, cualquiera con la URL de la RTDB puede escribir reflexiones, resultados Wordle o sugerencias.  
  _Archivos:_ `ReflexionesScreen.tsx:148`, `useWordleStats.ts:70`, `SuggestSongModal.tsx:67`  
  _Fix:_ `getAuth(app)` + `signInAnonymously()` al arrancar la app. Reglas Firebase: `".write": "auth != null"`.

- [ ] **Restringir reglas Firebase RTDB** para que solo usuarios autenticados puedan escribir en:
  - `*/compartiendo/data` (reflexiones)
  - `wordle/*/` (resultados)
  - `suggestedSongs/` (sugerencias)
  - `playlistShares/` (playlists compartidas — actualmente "sin permisos" por diseño, pero merece revisión)

### Datos personales — pérdida al desinstalar

- [ ] **Sincronizar `@contigo_habits` con Firebase** bajo `users/<uid>/habits`.  
  Es el dato más valioso: el historial completo de oraciones, lecturas y revisiones diarias.  
  Sin sync, se pierde irrecuperablemente al desinstalar.  
  _Archivo:_ `hooks/useContigoHabits.ts:25`

- [ ] **Sincronizar `@user_profile` con Firebase** bajo `users/<uid>/profile`.  
  Evita repetir el onboarding al reinstalar.  
  _Archivo:_ `contexts/UserProfileContext.tsx:24`

- [ ] **Sincronizar `@contigo_bookmarks` con Firebase** bajo `users/<uid>/bookmarks`.  
  _Archivos:_ `app/(tabs)/contigo/evangelio.tsx:126`, `app/(tabs)/contigo/bookmarks.tsx`

- [ ] **Sincronizar el `userId` del Wordle** con el UID de Firebase Auth.  
  Actualmente el `userId` es generado localmente con `Date.now().toString(36)` y se pierde al desinstalar,
  rompiendo el historial del leaderboard.  
  _Archivo:_ `hooks/useWordleStats.ts:9-11`

---

## 🟠 Prioridad Media

### Seguridad — XSS en parser BBCode

- [ ] **Sanitizar URLs en el parser BBCode** para bloquear el esquema `javascript:`.  
  _Archivo:_ `utils/formatText.ts:18`  
  ```typescript
  // Antes:
  replaceIteratively(/\[url=(.*?)\](.*?)\[\/url\]/gis, '<a href="$1">$2</a>');
  // Después (solo permite http/https):
  replaceIteratively(/\[url=(https?:\/\/[^\]]*?)\](.*?)\[\/url\]/gis, '<a href="$1">$2</a>');
  ```
  _Aplica también a_ `[btn-primary=...]` y `[btn-secondary=...]` en las líneas siguientes.

### Logs en producción

- [ ] **Eliminar/guardar tras flag los `console.log` de `SecretPanelModal.tsx`** (9 logs, líneas 155–243).  
  Exponen rutas Firebase, nombres de canciones y paths internos.

- [ ] **Eliminar/reducir los `console.log` de `pushNotificationService.ts`** (7 logs, líneas 147–198).  
  Exponen flujos del token push. Dejar solo `console.error` para errores reales.

- [ ] **Eliminar los `console.log` de `useStatusBarTheme.ts:90`** (`🎨 Theme updated for...`).

- [ ] **Eliminar los `console.log` de `useWordleWords.ts:26-39`** (logs de fallback de palabras).

- [ ] **Eliminar los `console.log` de `WordleScreen.tsx:217-219`** (`'No hay suficientes letras'`, `'Palabra no válida'`).

### Código huérfano — componentes del template Expo

- [ ] **Eliminar `components/Collapsible.tsx`** — no tiene importadores fuera de sí mismo.
- [ ] **Eliminar `components/ParallaxScrollView.tsx`** — no se usa en la app.
- [ ] **Eliminar `components/MobileSlider.tsx`** — sin importadores encontrados.
- [ ] **Eliminar `components/CrossPlatformSlider.tsx`** — sin importadores encontrados.
- [ ] **Eliminar `assets/old/`** — contiene `comunica.tsx`, `notificationsLog.tsx`, `showToken.tsx` archivados.  
  Ya están en el historial de git; no hace falta tenerlos en el árbol de trabajo.

### Consistencia de carga — pantallas Firebase

- [ ] **Crear un componente `<FirebaseScreenShell>`** (o similar) que encapsule el patrón `loading → spinner / data → children`.  
  Actualmente cada pantalla lo reimplementa de forma distinta:
  - `HorarioScreen`, `VisitasScreen`, `GruposScreen` usan `ActivityIndicator` de RN
  - `ContactosScreen`, `MaterialesScreen` usan `Spinner` de heroui-native
  - `ProfundizaScreen` no muestra nada mientras carga

---

## 🟡 Prioridad Baja

### Rendimiento — renders innecesarios

- [ ] **Envolver el `.sort()` de `ReflexionesScreen` en `useMemo`** para no re-ordenar en cada render.  
  _Archivo:_ `app/screens/ReflexionesScreen.tsx:190`  
  ```tsx
  // Antes (dentro del return):
  {list.sort((a, b) => ...).map(...)}
  // Después:
  const sortedList = useMemo(
    () => [...list].sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime()),
    [list]
  );
  ```

- [ ] **Envolver el `.sort()` de `AppsScreen` en `useMemo`**.  
  _Archivo:_ `app/screens/AppsScreen.tsx:79`

- [ ] **Documentar en `useFirebaseData`** que el parámetro `transform` debe ser una referencia estable  
  (función de módulo o `useCallback`), ya que está en el array de dependencias del `useEffect`.  
  Si se pasa una función inline, el hook refetcha Firebase en cada render.  
  _Archivo:_ `hooks/useFirebaseData.ts:80`

- [ ] **Verificar que `ChoirSessionContext` envuelve su `value` en `useMemo`**.  
  Si no lo hace, cualquier re-render del provider provoca re-render en todos los consumidores.  
  _Archivo:_ `contexts/ChoirSessionContext.tsx`

### Código duplicado — FormattedContent

- [ ] **Refactorizar los renderers `btn-primary` y `btn-secondary`** en `FormattedContent.tsx`.  
  Son ~70 líneas casi idénticas (solo cambia el color). Extraer un componente interno:  
  ```tsx
  function RenderButton({ color, tnode }: { color: string; tnode: any }) { ... }
  ```
  _Archivo:_ `components/FormattedContent.tsx:228-301`

### Convenciones de código

- [ ] **Reemplazar rutas relativas por `@/` en `SongDetailScreen.tsx`** (líneas 6–16).  
  ```typescript
  // Antes:
  import SongDisplay from '../../components/SongDisplay';
  // Después:
  import SongDisplay from '@/components/SongDisplay';
  ```

- [ ] **Extraer los colores hardcodeados de `ReflexionesScreen.tsx`** a constantes.  
  Colores usados: `'#2D3B20'`, `'#E6F4D7'`, `'#d4e8c0'`, `'#1a3000'`, `'#c0d8a8'`, `'#a0b888'`.  
  Podrían ir en `constants/colors.ts` como `Colors.reflexionGroupDark/Light`.

- [ ] **Extraer los colores del Wordle a constantes**.  
  `'#6aaa64'` (correcto), `'#c9b458'` (presente), `'#787c7e'` (ausente) están hardcodeados  
  en `WordleScreen.tsx:231-233`. Deberían ser constantes con nombre semántico.

- [ ] **Eliminar/migrar `components/ThemedText.tsx` y `ThemedView.tsx`**.  
  Son del template original de Expo. Solo se usan en `+not-found.tsx` y `HorarioScreen.tsx`.  
  El resto de la app usa `Colors[scheme]` directamente. Migrar esas dos pantallas y eliminar.

### TypeScript — `any` innecesarios

- [ ] **Tipar las respuestas Firebase en pantallas de eventos**.  
  `HorarioScreen.tsx:32`, `MaterialesScreen.tsx:39`, `ProfundizaScreen.tsx:31` usan  
  `useFirebaseData<any[]>` / `useFirebaseData<any>`. Crear interfaces concretas.

- [ ] **Tipar el parámetro `navigation` en `SongListScreen.tsx:68`** (`navigation: any`).

- [ ] **Validar el rango de `attempts` en `useWordleStats`** antes del cast `as 1|2|3|4|5|6`.  
  Un valor 0 o 7 actualizaría silenciosamente una clave incorrecta en `distribution`.  
  _Archivo:_ `hooks/useWordleStats.ts:54`  
  ```typescript
  if (attempts < 1 || attempts > 6) return; // guardia antes de recordGame
  ```

---

## 📋 Inventario completo de datos en AsyncStorage

> Referencia para saber qué se pierde al desinstalar la app.

| Clave | Contexto/Hook | Sincronizado Firebase | Pérdida |
|---|---|---|---|
| `@user_profile` | `UserProfileContext` | ❌ | Alto |
| `@contigo_habits` | `useContigoHabits` | ❌ | **Muy alto** |
| `@contigo_bookmarks` | `evangelio.tsx`, `bookmarks.tsx` | ❌ | Medio |
| `@wordle_stats` | `useWordleStats` | Parcial (solo resultados por partida) | Medio |
| `@mcm_playlist_v2` | `SelectedSongsContext` | Opcional (cloudPlaylist manual) | Medio |
| `@mcm_song_settings` | `SettingsContext` | ❌ | Bajo |
| `@app_settings` | `AppSettingsContext` | ❌ | Bajo |
| `@mcm_push_token` | `pushNotificationService` | ✅ (se regenera) | Nulo |
| `wordle_completed_*` | `WordleScreen` | ❌ | Bajo |
| `*_data` / `*_updatedAt` / `*_hidden` | `useFirebaseData` (caché) | ✅ (se recarga) | Nulo |

---

## 🗺️ Plan sugerido para sync de datos (si se implementa)

1. **Instalar Firebase Auth** en `hooks/firebaseApp.ts` — llamar `signInAnonymously` al arrancar.
2. **Crear `hooks/useFirebaseUser.ts`** — expone el UID anónimo una vez autenticado.
3. **Modificar `useContigoHabits`** — en cada `saveRecords`, también hacer `set(ref(db, 'users/<uid>/habits'), records)`.
4. **Modificar `UserProfileContext`** — en cada `setProfile`, también hacer `set(ref(db, 'users/<uid>/profile'), profile)`.
5. **Añadir lógica de restore** en onboarding — si el UID ya tiene datos en Firebase, preguntar "¿Restaurar mis datos?".
6. **Actualizar reglas Firebase** para proteger `users/<uid>/*` con `auth.uid === $uid`.
