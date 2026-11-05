# Traspaso — rediseño del área nativa de Comunica y limpieza de «tics de IA»

> **Para quien siga.** Rama: `claudito/area-nativa-estilo-plugin` (parte de `main`
> y lleva `main` fusionado a 2026-11-05 17:50, incluido el afinador del cantoral).
> Estado: **trabajo hecho y verificado en iPhone y Android; sin PR abierto.**
> Lo que falta está en §5. Lo decidido por el propietario está en §3: no se
> re-discute.

## 1. Qué se pidió y por qué

El propietario quería que el área privada **nativa** de Comunica (`mcm-app/app/(tabs)/comunica/`,
`mcm-app/components/comunica/`) se pareciera al área privada de antes (el plugin de
WordPress `comunicaAreaPrivada`: degradado de marca, cápsulas de fecha, tarjetas con borde,
etiquetas en mayúsculas), **adaptada a iOS y Android**, y después que toda la app tuviera
«la misma sinergia» sin perder el carácter de cada zona y sin rasgos «muy de IA»
(rayitas de color, ceros repetidos, emoji como icono…).

## 2. Qué está hecho (17 commits propios; `git log origin/main..HEAD`)

| Bloque | Qué | Dónde |
|---|---|---|
| Cimientos | `BrandGradient` (única pieza que pinta el degradado), `CardSurface` (borde + sombra en dos capas), roles nuevos del tema | `components/comunica/comun/` |
| Piezas | `DateCapsule` (brand/neutral/onGradient), `StatusChip`, `RecordCard` + `FeaturedRecordCard`, `SectionLabel`, `NavRow` con baldosa, `PersonAvatar tone`, `AreaHero` (con ×), `ListCell` movido a `comun/` | idem |
| Pantallas | Actividades, pagos, inscripciones, documentos, calendario, fichas adoptan las piezas | `components/comunica/*` |
| Cabecera | Degradado en iOS, Android y web (`BrandHeaderBackground`), tinta blanca, `useHeaderGlyph` para iOS 26 | `app/(tabs)/comunica/_layout.tsx` |
| Rayitas | Quitadas de toda la app; las vigila `__tests__/noEdgeStripes.test.ts` | varios |
| Auditoría | Informe en `AUDITORIA_TICS_Y_SINERGIA.md`; aplicadas las oleadas 1 y 2 y parte de la 3 y de radios/baldosas | `docs/planes/` |
| Desarrollo | Datos de prueba de Firebase (`utils/devFirebaseFixtures.ts`) y modo «servidor falso» en nativo | ver §4 |
| Reglas | `design.md` §2/§4/§5/§8 al día; `__tests__/comunica/territorio.test.ts` (lista blanca de quién pinta degradado, tope de bloques por fichero, contrastes) | raíz y tests |

CHANGELOG: entrada `2026-11-05 17:40` en `mcm-app/CHANGELOG.md`. **OTA: ✅ solo JS** (nada nativo nuevo
por esta rama; el paquete `react-native-audio-api` que se ve en el diff es de `main`, del afinador).

## 3. Decisiones del propietario (cerradas)

- Territorio «Comunica» = violeta `#6c4b9e`, y **estilo del plugin adaptado al nativo** (28/10 y 05/11/2026).
- El degradado de marca es **firma con tope**: bloques (cabecera del área, acción principal, hero de
  portada, tarjeta destacada; dos como mucho por pantalla contando la cabecera, uno de contenido) y
  marcas ≤ 72 pt (cápsula, avatar). Nunca en filas de listas virtualizadas, nunca marca sobre bloque.
- Etiquetas de sección en mayúsculas con tracking (token `typography.sectionLabel`) y chips en píldora.
- **Fuera las «rayitas» de color en bordes** en toda la app. Se queda la barra del estribillo (notación
  musical) y la línea de tiempo.
- Emoji nunca como icono de UI. Botón primario por defecto en azul MCM, no en `#007AFF`.
- Tarjeta de contenido = `radii.lg` en toda la app; `xl` solo héroes, destacadas y chips; Contigo
  conserva su excepción.
- Contigo mantiene su identidad (paleta cálida, serif, hero marrón); se le quitaron solo los ceros repetidos.

## 4. Cómo verlo en local (sin credenciales reales; no se toca `.env.local`)

Variables (todas de marcador): `EXPO_PUBLIC_COMUNICA_API=fake`, `EXPO_PUBLIC_FIREBASE_FIXTURES=1`,
`EXPO_PUBLIC_FIREBASE_*` con valores «demo» (la URL de la base debe tener forma
`https://demo-mcm-default-rtdb.firebaseio.com`). Entrar en Comunica: `familia@ejemplo.org` o
`monitor@ejemplo.org`, código `123456`. Sin las variables (tienda, web publicada) nada cambia.

- **iPhone:** `npx expo run:ios --device "iPhone 17 Pro"` con esas variables; abrir con
  `exp+mcm-app://expo-development-client/?url=…&__expo_disable_fab=1` para que no salga el engranaje de Expo.
- **Android (sin Android Studio):** `brew install openjdk@17 && brew install --cask android-commandlinetools`,
  SDK en `/opt/homebrew/share/android-commandlinetools`, imagen `system-images;android-35;google_apis;arm64-v8a`,
  emulador `Pixel_API35` **con la partición de datos a 2G** (con 10G no arranca si queda poco disco).
  Hace falta `JAVA_HOME`, `ANDROID_HOME` y `adb reverse tcp:8081 tcp:8081`.
- **Trampas de Android que costaron horas:**
  1. Sin `google-services.json` el prebuild revienta y deja `android/` a medias (paquete `com.mcmapp`, sin
     color de icono, **sin fuentes de iconos**). Solución: `GOOGLE_SERVICES_JSON=<json de marcadores fuera del repo>`,
     borrar `android/` y `npx expo prebuild --platform android --no-install`.
  2. Si `expo run:android` acaba con «Expo stopped waiting for the ADB device… boot query» **el APK nuevo no se
     instala** y se queda el viejo (los iconos salen como cuadrados vacíos). Comprobar con
     `adb shell dumpsys package com.mcmespana.mcmapp | grep lastUpdateTime` e instalar a mano con `adb install -r`.
  3. El tema de la app puede estar fijado en «Claro» desde Ajustes: `cmd uimode night` no cambia nada; usar
     Ajustes → Tema.
  4. Ruido que **no es de la app**: engranaje de Expo, toast `[push] registerAndSaveToken…` (clave de Firebase de pega),
     LogBox, «Preparando la Palabra…» (sin red).
- La web con datos falsos solo enseña Comunica (fuera de ella `app/_layout.tsx` pinta la pantalla de error de
  Firebase): para el resto, simulador.

## 5. Pendiente (en orden de valor)

**A. Bugs reales de Android** — detalle, causa y capturas en [`REVISION_ANDROID.md`](REVISION_ANDROID.md) (23 hallazgos). **Arreglados y comprobados en el emulador:** la alta (pestañas sobre la canción a pantalla completa), todas las medias salvo el #7, y casi todas las bajas (ver «Estado tras los arreglos» en ese informe). **Todos cerrados o decididos** (ver «Cerrados después» y «Decididos que se quedan» en ese informe). La lista de abajo es la ORIGINAL, conservada por la causa de cada uno:

1. **ALTA — canción en pantalla completa:** la barra de pestañas flotante (`CompactTabBar`, overlay de
   `components/tabs/AndroidTabsLayout.tsx`) tapa el botón de reproducir y el del lector. Ocultarla en esa
   ruta (`CANTORAL_SLUGS.SongFullscreen`) o subir los botones con `useTabBarClearance()`.
2. **MEDIA — fondo translúcido + `elevation`** (Android pinta la sombra a través del fondo): «Te faltan N
   listas» (`warningSoft` en `components/comunica/comun/theme.ts` + `Section.tsx`), tarjeta de fecha de Contigo
   (`components/contigo/DateNavigator.tsx`) y tarjeta «¿Cómo ha ido tu oración?». Arreglo: color opaco
   precalculado con `compositeOver` (`utils/tintColors.ts`) o `elevation: 0`.
3. **MEDIA — Cantoral en oscuro:** iconos de la barra de estado blancos sobre cabecera amarilla
   (`app/(tabs)/_layout.tsx` fija el estilo por esquema, no por el color de la cabecera) y icono de búsqueda claro.
4. **MEDIA — «Mis documentos»:** botón «Subir» de la cabecera casi invisible (acento sobre degradado):
   usar `useHeaderGlyph()`/tinta blanca.
5. **MEDIA — Fotos en oscuro:** texto blanco sobre portadas claras con scrim débil (`components/AlbumCard.tsx`).
6. **MEDIA, a verificar:** tras entrar como familia la portada tarda >10 s o queda vacía hasta recargar
   (¿servidor falso o refresco tras `signedIn`?).
7. Bajas: botón de pie pegado a la barra flotante, selector Mes/Agenda sin ancho completo, barra de pestañas
   que no se repinta al cambiar de tema en caliente, etiquetas Title case en la ficha, emoji en títulos de hoja
   y hero, avatares de familia en oscuro, aro violeta de 1 px en la tarjeta destacada, etc.

**B. De la auditoría de coherencia** (`AUDITORIA_TICS_Y_SINERGIA.md` §5): hoja «Letra y vista» (tarjeta dentro
de tarjeta, `components/SongFontBottomSheet.tsx`), título de Calendario, «Evento» genérico en la cabecera de
Comunica, bugs menores de Fotos (scrim) y Visita Papa.

**C. Sin ver todavía:** Comunica como familia en Android con datos reales, onboarding, «Completa tu perfil»,
Gestión/Eventos pasados, Coordinación, teclado en pantalla, `fontScale` grande, **un móvil Android real**
(solo se ha visto emulador y simulador de iPhone).

**Aviso al reproducir:** tras fusionar `main` (afinador) hay que **recompilar la app nativa de desarrollo** (`react-native-audio-api` es un módulo nativo): `npx expo prebuild --platform android --no-install` y `npx expo run:android`; con el APK anterior la app se rompe al cargar («native module could not be found»).

**D. `tunerMicrophoneWeb`:** el fallo no era del afinador sino de Node 20, que no tiene `navigator` global; el test lo crea si falta y pasa. La suite entera queda en verde.

## 6. Antes de dar la rama por buena

`cd mcm-app && npx tsc --noEmit && npm run typecheck:tests && npm run lint && npx jest` (con 3 workers si el
Mac va justo: hay tests que dan timeout con carga alta y pasan sueltos). Mirar capturas de claro **y oscuro**
en iPhone y Android antes de cada commit con pantallas (`docs/desarrollo/AREA_NATIVA_DISENO.md` §3).
