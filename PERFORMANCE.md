# PERFORMANCE.md — Análisis técnico de fluidez y velocidad

> Documento guía para mejorar el rendimiento percibido de la MCM App.
> Fecha del análisis: 2026-05-21. Stack analizado: Expo 55 · React Native 0.83 · React 19.2 · Firebase RTDB · ChordSheetJS · heroui-native.
>
> **Cómo leerlo:** cada hallazgo lleva archivo:línea para localizarlo. Las recomendaciones están ordenadas por impacto/esfuerzo. La sección **Plan recomendado** resume el orden por el que conviene atacarlas.

---

## Resumen ejecutivo

La app funciona, no tiene problemas estructurales graves, y el patrón **caché local + revalidación remota** de `useFirebaseData` es sólido. Hay sin embargo varias mejoras concretas y de bajo riesgo que reducirían arranque, consumo de datos y el "parpadeo" típico al cambiar tono/fuente en una canción:

1. **Descarga Firebase**: bajar primero `updatedAt`, descargar `data` solo si cambió → ahorra el 80–95 % de bytes en arranques posteriores con `songs`/`albums`.
2. **WebView de canción**: aplicar cambios de tono/fuente/notación inyectando JS, sin recrear el HTML ni el WebView → elimina el flash de 200–500 ms.
3. **ChordPro parser**: memoizar el `Song` parseado por contenido; opcionalmente preprocesar en build (Metro Transformer).
4. **Listas no virtualizadas** en `GruposScreen` y `ContactosScreen` → migrar a `FlatList`/`SectionList`.
5. **`expo-image` ya instalado pero sin usar**: reemplazar `ImageBackground` en `AlbumCard` por `expo-image` con `placeholder` (blurhash) y caché.
6. **`react-compiler`** (React 19): activar en `babel.config.js` → memoización automática sin tocar componentes.
7. **`freezeOnBlur`** en los stacks anidados (`cancionero`, `mas`) → libera CPU/memoria al cambiar de tab.
8. **HelloWave** bloquea 900 ms al arrancar; reducir a 600 ms (o saltar tras el primer launch).
9. **Limpieza menor**: borrar `lodash` (dep muerta), `React.memo` en `SongSearch` y `AlbumCard`.

Estimación combinada de mejora percibida en un dispositivo medio (gama media Android, iPhone 12/13):

- **Cold start**: −400 a −700 ms.
- **Cambio de tono / fuente en una canción**: −250 a −500 ms y sin parpadeo.
- **Apertura de canción tras la primera**: −150 a −300 ms.
- **Consumo de datos en arranques posteriores**: −80 % o más sobre `songs`.

---

## 1. Firebase: descarga el nodo entero aunque no haya cambiado nada

**Archivo:** `mcm-app/hooks/useFirebaseData.ts:44-69`

`get(ref(db, path))` siempre baja `{ data, updatedAt, hidden }` completo y luego compara `updatedAt` con el cacheado. Si `songs` pesa varios MB, lo descarga cada arranque aunque no haya cambios.

**Propuesta** (bajo riesgo, alto impacto):

```ts
// 1. Bajar SOLO updatedAt (~ pocos bytes)
const metaSnap = await get(ref(db, `${path}/updatedAt`));
const remoteUpdatedAt = String(metaSnap.val() ?? '0');

// 2. Bajar el resto solo si cambió
if (!localUpdatedAt || localUpdatedAt !== remoteUpdatedAt) {
  const dataSnap = await get(ref(db, `${path}/data`));
  // …guardar en AsyncStorage…
}
const hiddenSnap = await get(ref(db, `${path}/hidden`));
```

Hacer las tres llamadas en `Promise.all`. La ganancia en `songs` y `albums` (los nodos grandes) es sustancial.

**Impacto:** ahorro masivo de datos y de tiempo de arranque cuando hay caché. **Esfuerzo:** bajo.

---

## 2. WebView del cantoral: se reconstruye en cada interacción

**Archivos:** `mcm-app/components/SongDisplay.tsx:78`, `mcm-app/hooks/useSongProcessor.ts:439-454`

`useSongProcessor` regenera el HTML completo (con estilos inline y todo) cada vez que cambia `currentTranspose`, `chordsVisible`, `currentFontSizeEm`, `currentFontFamily`, `notation`, `isDark`, `isFullscreen`, `topInset`, `bottomInset`, etc. Después `SongDisplay` lo pasa por `source={{ html: songHtml }}` y el WebView se **recrea entero**.

Resultado: parpadeo y delay de 200–500 ms en cualquier cambio de ajustes.

**Propuestas**:

a) **Cambios de estilo vía `injectedJavaScriptBeforeContentLoaded` + `postMessage`**: tener una WebView estable y aplicar `.font-size`, `.theme-dark`, `.chords-hidden`, `.notation-es/en` con CSS classes en `<body>`. Solo cambia el tono/transposición justifica regenerar HTML (porque cambia el contenido), y aún así se puede hacer con `injectJavaScript` cambiando los `<span class="chord">`.

b) **Mientras tanto, separar dependencias**: el `useEffect` de `useSongProcessor` agrupa cosas que cambian la estructura (transpose, chordsVisible) con cosas que son puro CSS (`fontSize`, `fontFamily`, `isDark`, `topInset`/`bottomInset`). Dividir en dos efectos y/o dos `useMemo` ya reduce reparseos innecesarios.

**Impacto:** alto en la pantalla más usada de la app. **Esfuerzo:** medio.

---

## 3. ChordPro se parsea en cada apertura sin caché

**Archivo:** `mcm-app/hooks/useSongProcessor.ts:90-95, 107-122`

- `new ChordProParser().parse(processedChordPro)` se ejecuta en cada render del efecto.
- Además, para calcular `displayKey` se hace un **segundo parseo** (`new ChordProParser().parse(`{key: ${key}}\n[${key}]`)`).

**Propuesta:**

- Memoizar el `Song` parseado por `originalChordPro + currentTranspose` (`useMemo`).
- Para `displayKey`, usar la utilidad `utils/transposeKey.ts` ya existente en lugar de instanciar otro parser.
- A más largo plazo: **preprocesar `.cho` en build time** con un Metro Transformer (ya listado en TODO como "Mejoras técnicas a valorar #1"). Reduce el coste a cero en runtime para las canciones embebidas.

**Impacto:** medio-alto en cambios de tono. **Esfuerzo:** bajo (memo) / alto (Metro transformer).

---

## 4. Listas sin virtualización en Grupos y Contactos

**Archivos:**

- `mcm-app/app/screens/GruposScreen.tsx:131-465` — múltiples `ScrollView` con `.map()` anidados (categorías → grupos → miembros) en cuatro variantes.
- `mcm-app/app/screens/ContactosScreen.tsx:98-160` — `ScrollView` + `.map()` sobre todos los contactos.
- `mcm-app/app/screens/ReflexionesScreen.tsx:194-245` — `ScrollView` + `.map()` (probablemente OK por volumen actual).

Las pantallas críticas (`CategoriesScreen`, `SongListScreen`, `SelectedSongsScreen`) sí usan `FlatList` y están bien.

**Propuesta:**

- `ContactosScreen` → `FlatList` plana.
- `GruposScreen` → `SectionList` (categoría = sección, grupos = items, miembros como subcomponente memoizado).
- Si las búsquedas internas siguen siendo cuellos, extraer `GrupoItem` y `MiembroRow` como `React.memo`.

**Impacto:** medio (depende del volumen real de datos; con muchas familias/contactos sí se nota). **Esfuerzo:** medio.

---

## 5. `expo-image` instalado pero no usado para las portadas

**Archivos:** `mcm-app/components/AlbumCard.tsx:34`, `mcm-app/package.json:42`

`expo-image` está en `dependencies` pero **ninguna** parte del código lo importa. Las portadas de álbumes y reflexiones siguen usando `ImageBackground` de RN, sin caché en disco, sin `placeholder` ni `transition`.

**Propuesta:** reemplazar `ImageBackground` por `<Image>` de `expo-image` con `placeholder` (blurhash o miniatura precalculada) y `transition={200}`. Para el gradiente, usar un `<Image>` + `<LinearGradient>` superpuestos.

**Impacto:** percepción de fluidez muy notable en la galería (sin "pop-in"). **Esfuerzo:** bajo.

---

## 6. `babel.config.js` vacío — falta `react-compiler`

**Archivo:** `mcm-app/babel.config.js:1-7`

React 19 + Babel 7.25 soportan `babel-plugin-react-compiler`, que memoiza automáticamente sin necesidad de añadir `useMemo`/`useCallback` manualmente. La app ya está en React 19.2.

**Propuesta:** instalar `babel-plugin-react-compiler` y añadirlo al `plugins`. Validar en `npm run lint` y benchmark de arranque. Si causa warnings con `react-native-reanimated` revisar orden de plugins.

> Esta tarea ya estaba listada en `mcm-app/TODO.md` como "Mejoras técnicas a valorar #2". Se mantiene allí y se enlaza desde aquí.

**Impacto:** medio (mejora general en re-renders). **Esfuerzo:** bajo (instalar + probar).

---

## 7. Stacks anidados sin `freezeOnBlur`

**Archivos:** `mcm-app/app/_layout.tsx:182-202`, `mcm-app/app/(tabs)/_layout.tsx`

Los stacks anidados de `cancionero` y `mas` no usan `freezeOnBlur` (opción de `react-navigation` que congela las pantallas que no están visibles). En tabs como `cancionero` el WebView y la lista grande de canciones siguen "vivos" consumiendo memoria/CPU al cambiar de tab.

**Propuesta:** añadir `screenOptions={{ freezeOnBlur: true }}` (o `detachInactiveScreens` en NativeStack) en los stacks internos. Validar que no rompe estado al volver.

**Impacto:** medio en dispositivos con poca RAM. **Esfuerzo:** muy bajo.

---

## 8. Splash post-launch de 900 ms (HelloWave)

**Archivos:** `mcm-app/components/HelloWave.tsx:22`, `mcm-app/app/_layout.tsx:116-121`

3 repeticiones × 300 ms + `setTimeout(900)` bloquean la app antes de mostrar contenido. Es una decisión deliberada pero excesiva.

**Propuesta:**

- Reducir a 2 repeticiones (600 ms total) — el "saludo" sigue siendo reconocible.
- O alternativamente, saltarlo a partir del segundo arranque (`AsyncStorage` flag `seenWelcomeOnce`).

**Impacto:** bajo, pero muy visible en cold start. **Esfuerzo:** trivial.

---

## 9. Componentes sin `React.memo` que sí lo necesitan

**Archivos:**

- `mcm-app/components/SongSearch.tsx` — se renderiza en cada keystroke del padre.
- `mcm-app/components/AlbumCard.tsx` — se renderiza N veces en galerías sin necesidad.
- `mcm-app/components/EventItem.tsx` — verificar.

`SongListItem.tsx:45` sí usa `React.memo` correctamente (referencia de buen patrón).

**Propuesta:** envolver en `React.memo(...)` y, en `AlbumCard`, mover `createStyles(width)` fuera o memoizarlo por `width` para no recrear `StyleSheet` en cada render.

**Impacto:** bajo individualmente, agregado puede notarse al hacer scroll/buscar. **Esfuerzo:** trivial.

---

## 10. Dependencias muertas y posibles candidatas a quitar

**Archivo:** `mcm-app/package.json`

- `lodash` (`^4.17.21`) — **0 importaciones** en el código. Eliminar de `dependencies`.
- `react-native-render-html` (`^6.3.4`) — se usa solo en `components/FormattedContent.tsx`. Revisar si compensa frente a una solución simple BBCode → texto enriquecido (`Text` + `Linking`), porque `render-html` arrastra peso.

**Impacto:** bajo en runtime, mejora el bundle. **Esfuerzo:** lodash es trivial; render-html requiere refactor.

---

## 11. Otros hallazgos menores (anotados, no urgentes)

- `mcm-app/contexts/SettingsContext.tsx:85-117` — dos `useEffect` guardan settings (el segundo solo "por si el componente se desmonta antes"). Suele ser suficiente con uno bien hecho; revisar si el caso de desmonte aún ocurre.
- Múltiples providers anidados en `mcm-app/app/_layout.tsx:51-83` (12 niveles). No es un problema de rendimiento en sí, pero combinar contextos relacionados (`UserProfile` + `Onboarding`, p.ej.) reduce re-renders en cascada.
- `useFirebaseData` no expone una variante "solo metadata" (`hidden`/`updatedAt`) ligera. `EventHomeScreen.tsx:126` solo consume `hidden`, pero igualmente fuerza la descarga del `data` completo.

---

## Plan recomendado (orden sugerido)

| # | Tarea                                                        | Impacto | Esfuerzo | Riesgo |
| - | ------------------------------------------------------------ | ------- | -------- | ------ |
| 1 | `useFirebaseData`: cargar `updatedAt` antes de `data`        | Alto    | Bajo     | Bajo   |
| 2 | Memoizar parser ChordPro + eliminar segundo parser de `key`  | Alto    | Bajo     | Bajo   |
| 3 | `freezeOnBlur` en stacks anidados                            | Medio   | Trivial  | Bajo   |
| 4 | `expo-image` en `AlbumCard` con `placeholder`                | Medio   | Bajo     | Bajo   |
| 5 | `babel-plugin-react-compiler`                                | Medio   | Bajo     | Medio  |
| 6 | `React.memo` en `SongSearch`, `AlbumCard`, `EventItem`       | Bajo    | Trivial  | Bajo   |
| 7 | Quitar `lodash` de `package.json`                            | Bajo    | Trivial  | Nulo   |
| 8 | `HelloWave`: 600 ms o saltar tras primer launch              | Bajo    | Trivial  | Bajo   |
| 9 | `GruposScreen` → `SectionList`; `ContactosScreen` → `FlatList` | Medio | Medio    | Medio  |
| 10 | WebView con `postMessage` para estilo (sin recrear)         | Alto    | Alto     | Medio  |
| 11 | Preprocesado de `.cho` en build (Metro Transformer)         | Alto    | Alto     | Medio  |

Recomendación pragmática: hacer **1 → 8** en una primera iteración (todo bajo esfuerzo, riesgo bajo). Después medir y atacar **9 → 11** si las métricas lo justifican.

---

## Cómo medir

Antes de optimizar:

1. **Cold start**: cronometrar desde tap del icono hasta interactividad (5 medidas en dispositivo medio, descartar outliers).
2. **Tiempo de cambio de transpose**: marcar `console.time` en `SongDetailScreen.handleSetTranspose` y `useSongProcessor` final → log con `Performance.now()`.
3. **Tráfico de red**: Charles/Proxyman para medir bytes descargados al abrir la app con caché poblada.
4. **Memoria**: Xcode Instruments / Android Studio Profiler para detectar fugas al cambiar de tab.

Repetir tras cada cambio para validar.

---

> Este documento se mantiene en la raíz del monorepo. Cuando se complete una tarea, marcarla en `mcm-app/TODO.md` (sección "Mejoras técnicas — rendimiento") y opcionalmente añadir notas aquí.
