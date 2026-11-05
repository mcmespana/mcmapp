# Revisión visual en Android (Pixel_API35, Android 15)

Fecha: 2026-11-05 · Rama `claudito/area-nativa-estilo-plugin` · Build de desarrollo con datos inventados y servidor falso de Comunica. Solo lectura sobre el código; capturas en el índice del final.

Leyenda: (A) bug real de la app · (B) peculiaridad de plataforma aceptable · (C) ruido de desarrollo/emulador.

## Estado tras los arreglos (2026-11-05, rama `claudito/area-nativa-estilo-plugin`)

**Arreglados y comprobados en el emulador:** #1 pestañas sobre la canción a pantalla completa (la barra no se pinta en esa ruta), #2 y #3 sombra a través de fondos translúcidos (`warningSoft` opaco, tarjeta de fecha de Contigo opaca, tarjetas de oración sin elevación) **y el mismo fallo en tarjetas apagadas** (documento caducado, inscripción cerrada, eventos pasados del calendario: `CardSurface opacity`), #4 iconos de la barra de estado y buscador del Cantoral en Android, #5 «Subir» y «Compartir» de Documentos, #6 scrim de Fotos, #8 aire entre el pie con botón y la barra, #10 barra de pestañas al cambiar de tema, #13 emoji en títulos de hoja y del hero, #14 enlace de pie subrayado en Inicio, #17 aro violeta de la tarjeta destacada, #11 etiquetas de la ficha (`sectionLabel`).

**Cerrados después (misma rama, 2026-11-05 22:45):** #7 era un bug real y no del servidor falso: tras salir y volver a entrar, `ActiveProfileProvider` (vive en `app/(tabs)/comunica/_layout.tsx`, por encima de las pantallas) se quedaba con `me` en «pending» y no se repintaba, así que la portada de familia esperaba para siempre un perfil ya cargado; ahora lleva `key` por persona (`ProfileScope`) y se ha comprobado en el emulador. #15 el avatar neutro usa `disabledFill` con tinta `text` (contraste en oscuro; el «·» de «Participante» es el dato de prueba sin nombre). #16 icono «@» con el azul claro en oscuro. **Teclado en Android (edge-to-edge, el sistema ya no redimensiona la ventana):** `BottomActionBar` y `AccessScreen` usaban `behavior: undefined` en Android y ahora `padding`; las hojas centradas `PasswordPromptModal` y `ExportPdfModal` y el modal `CantoralOnboarding` (paso del coro) envuelven su contenido en `KeyboardAvoidingView`. `BottomSheet` ya compensaba el teclado por su cuenta.

**Decididos que se quedan como están:** #9 el selector Mes/Agenda de la cabecera del Calendario es más estrecho a propósito (deja sitio al botón de suscribirse; ver `switcherWidth`). #12 no era un recorte: los puntos suspensivos son parte del texto («Monitor/a desde…», `components/comunica/yo/copy.ts`). #18 las etiquetas de la barra las pinta la librería nativa (`expo-native-compact-tabs`) y con seis ítems caben justas; no se acorta ningún nombre. #19 el estado de «Letra y vista» va en el centro a propósito (`SheetCard`), como los ajustes agrupados de iOS; las tarjetas dentro del grupo son ese mismo patrón. #20 teal de la pestaña activa: decisión del propietario.

**Sigue sin verse (a mano):** teclado táctil real (el emulador usa un teclado flotante de ratón y no sirve para comprobarlo), un móvil Android físico y `fontScale` grande.

**Ojo al reproducir:** tras fusionar `main` (afinador) hay que recompilar la app nativa de desarrollo (`react-native-audio-api` es un módulo nativo): `npx expo prebuild --platform android --no-install` y `npx expo run:android`; con el APK anterior la app se rompe al cargar.

## Resumen

1. El rediseño del área nativa aguanta bien en Android: el degradado de la cabecera de Comunica llega bajo la barra de estado, iconos y título son legibles, y los bloques con degradado (hero, tarjeta destacada, botón principal, cápsulas, avatares) respetan el radio y no muestran banding.
2. El fallo más repetido es de plataforma pero es un bug de la app: **fondo translúcido + `elevation`**. Android dibuja la sombra a través del fondo semitransparente y salen rectángulos/marcos tostados (`Te faltan N listas`, tarjeta de fecha de Contigo, tarjeta de «¿Cómo ha ido tu oración?»).
3. **Pantalla completa de una canción**: la barra de pestañas flotante sigue visible y se solapa con el botón de reproducir y el del lector.
4. **Modo oscuro con cabecera amarilla del Cantoral**: iconos de la barra de estado (y el icono de búsqueda en la lista de canciones) en blanco sobre amarillo, contraste ~1,6:1.
5. El botón «Subir» de la cabecera de «Mis documentos» es casi invisible (violeta sobre degradado).
6. Los pies de pantalla con botón («Guardar lista», «Guardar» de datos) quedan pegados a la barra de pestañas flotante.
7. Hay incoherencias de diseño menores y repetibles (etiquetas de sección en Title case en la ficha, emoji en títulos de hoja, enlaces subrayados solo en unas pantallas, selector Mes/Agenda sin ocupar el ancho).
8. No pude ver: onboarding, Revisión de Contigo, lectura del Evangelio (sin red), «Evalúa la app» completa, Gestión, Eventos pasados, Coordinación, pagos/documentos con datos, teclado en pantalla (ver listado).

Nota de método: el tema de la app estaba fijado en «Claro» desde Ajustes, así que `cmd uimode night` no cambia nada; el modo oscuro se activó desde Ajustes → Tema → Oscuro y se dejó de nuevo en Claro al terminar. La sesión de Comunica quedó iniciada como `familia@ejemplo.org` (antes era monitor).

## Hallazgos

| # | Pantalla | Modo | Qué ocurre | Tipo | Sev. | Causa probable | Arreglo propuesto |
|---|----------|------|-----------|------|------|----------------|-------------------|
| 1 | Canción en pantalla completa (`SongFullscreenScreen`) | Oscuro (a-87) | La barra de pestañas flotante sigue encima y tapa/solapa el botón de reproducir (badge «3») y el del lector abajo a la derecha. | A | Alta | La pantalla completa no oculta `CompactTabBar` (la barra la pinta `AndroidTabsLayout` como overlay del navegador). | Ocultar la barra mientras la ruta sea la pantalla completa (estado en `tabBarController` o `display:'none'` según segmento) o subir los botones con `useTabBarClearance()`. |
| 2 | Comunica, «Te faltan N listas» | Claro (a-42, a-43, a-48) y oscuro (a-80) | La tarjeta se ve con un marco tostado/marrón y un rectángulo crema/oscuro dentro con esquinas duras. | A | Media | `Section.tsx:61` pasa `background={t.warningSoft}`; `warningSoft = hexAlpha(ToastColors.warning, '1F'/'33')` (`comun/theme.ts:159`) es translúcido y `CardSurface` le añade `elevation` (`shadows.card`): Android dibuja la sombra por detrás y se ve a través. | Usar un color opaco (mezclar `warningSoft` sobre `t.card` en el tema) o poner `elevation: 0` en superficies con fondo translúcido y quedarse con el borde. |
| 3 | Contigo: tarjeta selector de fecha (Evangelio, Oración) y tarjeta «¿Cómo ha ido tu oración?» | Oscuro (a-88, a-89); claro (a-22, a-23) | Rectángulo interior de esquinas duras dentro de la tarjeta redondeada. | A | Media | Mismo patrón: `DateNavigator.tsx:129` (`hexAlpha(accent,'12'/'09')`) + `...shadows.card` en `styles.card` (línea ~241). | Fondo opaco precalculado o `elevation: 0` en Android para esas tarjetas. Revisar el resto de usos de `hexAlpha` + `shadows.*`. |
| 4 | Cantoral (portada y lista de categoría) | Oscuro (a-76, a-81) | Iconos de la barra de estado en blanco sobre cabecera amarilla `#f5c320`; en la lista de canciones el icono de búsqueda también sale claro (flecha y título sí oscuros). | A | Media | `app/(tabs)/_layout.tsx` fija `StatusBar style={scheme==='dark'?'light':'dark'}` sin mirar el color de la cabecera; el tinte del botón de búsqueda no usa el color de cabecera. | Estilo de barra de estado por ruta según luminancia de la cabecera (oscura sobre amarillo en ambos modos); revisar `headerTint` del icono de búsqueda. |
| 5 | Comunica, «Mis documentos» | Claro (a-64) | El botón «Subir» de la cabecera es violeta tenue sobre el degradado: casi ilegible. | A | Media | Acción de cabecera con color de acento sobre el degradado de marca (o estado deshabilitado). | Texto blanco (`onAccent`) sobre el degradado, o icono blanco; mantener un objetivo táctil ≥44 dp. |
| 6 | Fotos, tarjetas de álbum | Oscuro (a-90) | Título y metadatos blancos sobre portadas claras («Jubileo»): se funden con el logo/fondo blanco. | A | Media | Scrim demasiado suave en el tercio inferior. | Subir opacidad del degradado inferior o añadir sombra de texto; comprobar en iPhone. |
| 7 | Comunica: tras entrar como familia | Oscuro (a-98, a-99, a-103) | Tras el código, la portada queda vacía (solo «Tu cuenta») más de 10 s; tras recargar JS aparece la portada de familia completa. | A (a verificar) | Media | Posible refresco del modelo tras `session` → `signedIn` en `ComunicaHome` (familia) o ausencia de datos en el servidor falso. | Reproducir con el servidor falso y revisar si la consulta de familia se lanza al cambiar la sesión. |
| 8 | Pasar lista de un grupo, «Mis datos de monitor», «Datos de X» | Claro y oscuro (a-46, a-49, a-50, a-106) | El pie con botón («Guardar lista», «Guardar») queda pegado al borde superior de la barra de pestañas flotante, sin aire. | A | Baja | La barra del pie no suma `useTabBarClearance()` por encima de la barra flotante. | Añadir margen igual al hueco de la barra o elevar el pie. |
| 9 | Calendario, selector Mes/Agenda | Oscuro (a-78, a-113) | El segmento no ocupa todo el ancho (acaba en x≈742 de 900) y la franja superior tiene un escalón de fondo más oscuro; en Comunica>Calendario (a-65) sí ocupa el ancho. | A | Baja | Contenedor sin `alignSelf:'stretch'`/ancho en la cabecera del Calendario. | Igualar con el del área de Comunica. |
| 10 | Barra de pestañas tras cambiar el tema | Oscuro (a-75) | Justo tras elegir «Oscuro» la barra salió clara con iconos claros (ilegible); en la pestaña siguiente ya era oscura. | A | Baja | `NativeCompactTabBar` no se repinta al cambiar `Appearance.setColorScheme` en caliente. | Remontar la barra con `key` dependiente del esquema (ya hay `itemsKey`). |
| 11 | Ficha de participante | Claro (a-53, a-54) | Las etiquetas «Contacto», «Asistencia», «Avisos de comportamiento», «Pañuelo» van en Title case, no con `typography.sectionLabel`. | A | Baja | Etiquetas propias en la ficha en lugar de `SectionLabel`. | Usar la etiqueta de sección única. |
| 12 | Comunica, «Mis datos de monitor» | Claro (a-46) | Etiquetas truncadas («Monitor/a desde…», «Monitor/a de…») con espacio libre. | A | Baja | Columna de etiqueta estrecha por el icono de info y el campo de la derecha. | Permitir 2 líneas o recortar el campo. |
| 13 | Hojas «Feedback 💬», «Sugerir canción 🎵» y hero «Hola, Marta 👋» | Claro y oscuro (a-37, a-112, a-103) | Emoji como adorno de títulos. | A | Baja | Contra `design.md` §8 (emoji como iconografía). | Quitar el emoji o sustituir por `IconSymbol`. |
| 14 | Pie de Inicio vs Más | Oscuro (a-75 vs a-79) | «¿Algún fallo? Cuéntanoslo» va sin subrayar en Inicio y subrayado en Más. | A | Baja | Estilos distintos de enlace de pie. | Unificar. |
| 15 | Familia, «A quién tienes a tu cargo» | Oscuro (a-103) | Avatar de hijos casi negro con inicial gris (bajo contraste) y «Participante» con avatar «·» (inicial vacía). | A | Baja | Tono de avatar sin degradado + nombre vacío en el dato de prueba. | Contraste mínimo en el tono neutro; manejar inicial vacía. |
| 16 | Ajustes, aviso «@movimientoconsolacion.com» | Oscuro (a-73) | Icono «@» azul oscuro sobre gris oscuro. | A | Baja | Color de icono sin variante oscura. | Variante clara en oscuro. |
| 17 | Hero/tarjeta destacada de Comunica | Claro y oscuro (a-42, a-80) | Aro violeta de 1 px visible contra el azul del degradado a la izquierda. | A | Baja | `borderColor: t.accentFill` en `RecordCard` destacada. | Borde transparente en Android o color del extremo del degradado. |
| 18 | Barra de pestañas | Claro (a-48) | Las etiquetas «Comunica» y «Calendario» casi se tocan. | A | Baja | Seis ítems con etiqueta en 1080 px de ancho. | Reducir tamaño de etiqueta o abreviar. |
| 19 | Hoja «Letra y vista» | Oscuro (a-84, a-85) | Cabe entera (Tamaño, Fuente, Vista). El valor «Original»/«Sistema» no queda alineado a la derecha. Sin botón «Restablecer» visible con valores por defecto. | A | Baja | Layout de cabecera de tarjeta. | Alinear a la derecha. |
| 20 | Pestaña activa | Claro y oscuro | El activo de la barra usa `Colors.tint` `#0a7ea4` (teal de plantilla), no el azul MCM. | B/A | Baja | Valor por defecto de Expo en `constants/colors.ts`. | Decidir si se mantiene. |
| 21 | Diálogos nativos (`Alert`): «Tienes cambios sin guardar», «¿Salir del área?» | Claro y oscuro (a-59, a-92) | Botones en MAYÚSCULAS y teal del sistema, no violeta de Comunica. | B | Baja | `Alert` de React Native en Android. | Aceptable. |
| 22 | Diálogo «Try out your stylus» | Claro (a-39) | Aparece al enfocar un campo de texto. | C | – | Escritura a mano del teclado del emulador. | Ninguno. |
| 23 | Menú de Expo, toast `[push]…`, LogBox, «Preparando la Palabra…», teclado en pantalla ausente | Todas | Engranaje flotante, toast rojo sobre la barra, pantalla de log, lectura sin cargar, sin teclado. | C | – | Ruido de desarrollo y emulador. | Ninguno. |

Lo que se comprobó y está bien: edge-to-edge con gradiente bajo la barra de estado; botón atrás de Android cierra hojas y vuelve bien; sombras de `CardSurface` con borde 1 px correctas en tarjetas normales (listas, Ajustes, Pagos, Eventos); hojas inferiores (selector de pañuelo, «Añadir un aviso», «Marcar asistencia», «Ver como…», Feedback, Sugerir canción, Letra y vista) bien dimensionadas; estados vacíos de Comunica; se llega al final de cada lista (la barra flotante no impide el scroll); modo oscuro con bordes de tarjeta visibles.

## Pantallas vistas

- Inicio (claro y oscuro), hoja de Ajustes (Cuenta, Perfil/Delegación, Apariencia, tamaño de texto, Sobre la app), selector de perfil, hoja de Feedback («Fallito en la app»), notificaciones (vacía).
- Cantoral: portada, categoría, canción con acordes, menú de acciones, «Letra y vista», pantalla completa, tutorial «Personaliza tu cantoral» (paso 1/5), «Sugerir canción».
- Contigo: portada (oscuro), Evangelio (solo cabecera, sin lectura), Oración.
- Calendario: mes y agenda (oscuro; mes también en claro).
- Más (claro y oscuro), Fotos (lista de álbumes, oscuro).
- Comunica como monitor: portada completa con scroll (claro y oscuro), Pasar lista de un grupo con marcado y hoja de asistencia, ficha (contacto, asistencia, avisos, pañuelo, autorizaciones), «Añadir un aviso», Mis datos de monitor, Tu cuenta, Avisos, Calendario, Eventos, evento cerrado, Inscripciones y Pagos vacíos, Mis documentos vacío, diálogo de cambios sin guardar.
- Comunica como familia: acceso (correo y código), portada con hero, «Ver como…», «Datos de Lucía».

## Pantallas NO vistas (y motivo)

- Onboarding y selector «¿Quién eres?» al primer arranque: requiere borrar datos de la app.
- «Completa tu perfil», «Evalúa la app» (evaluación completa y envío): no llegué por tiempo.
- Política, términos y aviso legal, Gestión y Eventos pasados (con evento): no abiertos por tiempo.
- Cantoral: buscador, «Tu selección» con canciones, ajustes/multimedia, compartir.
- Contigo: lectura del Evangelio (sin red: «Preparando la Palabra…»), Revisión, Guardados, ajustes de lectura.
- Calendario: filtros de calendarios, detalle de evento, suscribirse; Fotos: abrir un álbum.
- Comunica: Grupos y fichas (listado), Coordinación (no aparece con este perfil), actividades de familia, detalle de pago/inscripción (listas vacías), subir documento, hoja «¿A quién ves?» (solo «Ver como…»).
- Teclado en pantalla: no aparece en el emulador (teclado físico), no se pudo comprobar si tapa campos.
- En claro vi la mayoría de pantallas, pero solo anoté en esta revisión lo listado arriba; el resto no mostró defectos adicionales que recuerde con seguridad.

## Índice de capturas

Directorio: `/private/tmp/claude-501/-Users-izanriro--claude-spares-spare-QX6qpJ/f87f6815-73a2-414b-a5b1-b662af618ead/scratchpad/` (`a-NN.png`).

| Captura | Contenido |
|---------|-----------|
| a-02 / a-03 | Inicio claro / intento de oscuro con `uimode` (la app no cambió: tema forzado a Claro) |
| a-04, a-06 | Más (claro), Cantoral portada (claro) |
| a-19…a-24 | Contigo (claro): portada, Evangelio/Oración, tarjeta de fecha |
| a-37, a-38 | Hoja Feedback y «Fallito en la app» |
| a-39 | Diálogo del stylus (C) |
| a-42, a-43, a-44, a-45, a-48 | Comunica monitor, portada completa (claro) |
| a-46, a-47 | Mis datos de monitor y selector «Monitor/a de…» |
| a-49, a-50, a-51, a-52 | Pasar lista de C1 · Brújula y hoja de asistencia |
| a-53, a-54, a-55, a-56, a-57, a-58 | Ficha, selector de pañuelo, «Añadir un aviso», autorizaciones |
| a-59 | Diálogo «Tienes cambios sin guardar» |
| a-62, a-63, a-64, a-65, a-66, a-67 | Inscripciones, Pagos, Mis documentos, Calendario, Eventos, evento cerrado |
| a-68, a-69 | Tu cuenta, Avisos |
| a-70, a-71 | Intento de oscuro con `uimode` en Comunica (sigue claro) |
| a-72, a-73, a-74 | Ajustes (claro, oscuro, scroll) |
| a-75, a-76, a-77, a-78 | Oscuro: Inicio (barra clara), Cantoral, Contigo, Calendario |
| a-79, a-80 | Oscuro: Más, Comunica monitor |
| a-81…a-87 | Oscuro: categoría, canción, menú, Letra y vista, pantalla completa |
| a-88, a-89 | Oscuro: Evangelio (cargando), Oración |
| a-90 | Oscuro: Fotos |
| a-92, a-94, a-95, a-96 | Oscuro: diálogo salir, acceso, código |
| a-97…a-99 | Oscuro: portada de familia vacía tras entrar |
| a-103, a-104, a-106 | Oscuro: portada de familia, «Ver como…», «Datos de Lucía» |
| a-108, a-110, a-112, a-113 | Oscuro: notificaciones, tutorial cantoral, sugerir canción, agenda |
| a-115 | Ajustes restaurados a Claro |
| `notas.md` | Notas de trabajo con los hallazgos (misma carpeta) |
