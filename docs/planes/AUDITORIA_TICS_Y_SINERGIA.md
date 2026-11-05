# AUDITORIA_TICS_Y_SINERGIA.md — «Tics de IA» y sensación de una sola app

> **Fecha:** 2026-11-05. **Método:** recorrido en el simulador de iPhone 17 Pro (build de desarrollo, datos de
> prueba, servidor falso de Comunica), claro y oscuro, leyendo `design.md` y `PLAN_DISENO.md` antes. Solo se
> miró; no se tocó código.
> **Qué NO repite este informe:** las rayitas de borde (decididas y vigiladas por test), el degradado y las
> etiquetas en mayúsculas de Comunica (decisión del propietario), la barra lateral del estribillo (notación) y
> lo ya anotado en `PLAN_DISENO.md` (A5.5 hex, C6 `fontSize`, E5 radios sueltos, H10, divergencia del header de
> «Tu selección», G3).
> **Códigos de captura** (`[X1]`…): índice con rutas absolutas al final.
> **Artefacto a ignorar:** el engranaje gris flotante que sale en las capturas oscuras es el botón del menú de
> desarrollo de Expo, no la app.

---

## 1. Resumen (10 líneas)

1. La app **no es incoherente por falta de tokens, sino por «dialectos»**: cada zona tiene su propio título de
   pantalla, su propio botón principal y su propia etiqueta de sección. Se notan cinco botones primarios
   distintos (azul de sistema, degradado Comunica, degradado dorado Contigo, celeste de Calendario, píldora
   blanca de Inicio).
2. El «tic de IA» más repetido **no es visual sino de contenido**: métricas en cero (`0/3`, `0 días`, `0 / 0' / 0`,
   `0 días activos`, `0 de 7 listas 0 %`) y la misma cifra repetida 3-4 veces en una pantalla (Contigo).
3. **Emoji como icono** vivo en Cantoral (`🎵` ×4) y en Visita Papa (⏰📦🍽️🚌📖👥), con un glifo duplicado al lado.
   Es lo único que `design.md` §8 prohíbe de forma explícita y sigue en pantalla.
4. **Baldosas/círculos de icono pastel idénticos** en Inicio, Más, Comunica (8 filas), Oración: hay que decidir
   cuáles tienen función (selector de emoción, color de rama) y cuáles son decoración.
5. Hay **bugs reales** de paso: «Jueves 5 **De** Noviembre» (el `capitalize` ya anotado, vivo en Calendario),
   días de otros meses sin atenuar en Calendario oscuro, scrim insuficiente en portadas claras de Fotos,
   botón «Guardar rato de oración» con texto blanco sobre dorado claro (parece desactivado), «Salir» en rojo puro.
6. Queda un **gradiente decorativo fuera de territorio**: la barrita dorado→rojo bajo el título de la canción
   (y del texto de muestra del onboarding).
7. Inicio es la pantalla con **menos jerarquía**: cuatro bloques apilados (onboarding, notificaciones, «Evalúa la
   app», bienvenida con texto de relleno) del mismo peso y un hueco en blanco sin estado vacío.
8. Los **radios de tarjeta** se perciben en cuatro familias (≈14-16 Comunica/Inicio, ≈20 Más/Fotos/Calendario,
   22 Contigo) y los **bordes** van de hairline a ≈2 px de color (banners de Inicio).
9. Lo que **sí funciona como sistema**: botón atrás de cristal, barra de pestañas flotante, lista agrupada de
   canciones, tarjetas de Comunica sobre `CardSurface`, el estado vacío de Calendario. Es el patrón a copiar.
10. Propuesta: **ocho constantes compartidas** (§3) y **ataque en 4 oleadas** (§5); lo primero, S y barato:
    botón primario único, emoji→`IconSymbol`, bugs, y poda de los ceros de Contigo.

---

## 2. Tabla por pantalla

Leyenda: **(a) QUITAR**, **(b) SUAVIZAR**, **(c) QUEDARSE**. «Fichero» = mejor pista tras un grep rápido; verifícalo antes de editar.

### 2.1 Institucional — Inicio

| Pantalla | Hallazgo | a/b/c | Propuesta concreta (fichero) |
|---|---|---|---|
| Inicio [I1] | Tarjeta «Te damos la bienvenida a MCM App» con **texto de relleno como contenido real**: «En esta sección te mostraremos las últimas notificaciones», megáfono en círculo y flecha en otro círculo. Es una promesa, no información. | a | Si no hay notificaciones, mostrar `EmptyState` compacto («Sin novedades») o **no pintar el bloque**; si hay, la tarjeta es el último aviso real. `app/(tabs)/index.tsx` ~565. |
| Inicio [I1][I4] | Cuatro bloques seguidos del mismo peso: «En solo 1 minuto» (lavanda), «Activa las notificaciones» (lavanda), «Evalúa la app» (bloque **celeste sólido**, el más ruidoso) y la bienvenida. Todo grita igual. | b | Un solo aviso accionable arriba (el más urgente), los demás como fila fina o a Más. «Evalúa la app» no merece ser el bloque más saturado de la portada: pasarlo a tarjeta neutra. `app/(tabs)/index.tsx`, `components/home/homeStyles.ts`. |
| Inicio [I1] | Banners con **borde de color ≈2 px** (lavanda) — `design.md` §8 dice «un hairline separa». | b | Hairline `separator`, sin color de borde. |
| Inicio [I1][I4] | Accesos rápidos: **círculos pastel idénticos** (rosa, beige, amarillo) con icono suelto; en oscuro, círculos tintados con 4.º «Comunica». Función real (atajos) pero la forma es la de plantilla. | b | Mantener los atajos (aportan función) y simplificar la forma: glifo con `tintedGlyph` sobre baldosa cuadrada `radii.sm` como en Más, o fila de lista. Elegir **una** baldosa para toda la app (§3). `components/home/homeStyles.ts`. |
| Inicio [I2] | «PRÓXIMOS EVENTOS» seguido de **un hueco blanco enorme** y un botón «Ver calendario» huérfano: no hay estado vacío. | a | `EmptyState` compacto cuando no hay eventos; el botón solo si hay algo que ver. |
| Inicio [I2] | Pie: «¿Algún fallo? Cuéntanoslo» y «Movimiento Consolación para el Mundo» en cursiva casi invisible (contraste bajo). En Más el mismo pie va **subrayado y más oscuro**. | b | Un único componente de pie en Inicio y Más, `textMuted` con contraste ≥4,5:1. |
| Inicio [I1] | Título «MCM App» con logo cuadrado azul + `h0`: es la identidad institucional. | c | Se queda; es el único sitio con logo. |

### 2.2 Institucional — Cantoral

| Pantalla | Hallazgo | a/b/c | Propuesta concreta (fichero) |
|---|---|---|---|
| Categorías [C1][C2] | **Emoji `🎵` como icono en cada fila** (×3) y otra vez en «Tu selección». Idéntico, no significa nada y es el patrón que `design.md` §8 rechaza. | a | `IconSymbol` (nota musical) o sin icono: la fila ya lleva nombre y contador. `app/screens/CategoriesScreen.tsx` ~315/338/370/410/450. |
| Categorías [C1] | «Tu selección» con borde azul y baldosa celeste: tarjeta de un estado vacío («Vacía · añade canciones…») que destaca más que las propias categorías. | b | Sin color de borde; subirla solo cuando haya selección. |
| Lista de canciones [C3] | Lista agrupada redondeada, título + autor en cursiva, píldora de tono (`DO`, `SOL`, `C2`) con **función real**. | c | Es la referencia de fila para el resto de la app (ya hecha en H6). |
| Canción [C4][C5] | **Barrita dorado→rojo bajo el título de la canción** (y bajo «Canción de muestra» en el onboarding): degradado decorativo fuera de Contigo/Comunica y, en la práctica, una rayita de acento. | a | Quitarla; el título se distingue por tamaño/peso. Localizar en `components/SongDisplay.tsx` / hoja de canción (no encontrado con grep rápido). |
| Canción [C4] | FAB `+` en **rosa pálido** (rojo MIC tintado) con menú contextual: ni el color ni la forma se repiten en ninguna otra pantalla. | b | FAB con el rol de acento de la zona (`cantoralHeaderTint`) o botón en la barra; si se queda, un único FAB para toda la app (`PressableScale` + `shadows.overlay`). |
| Letra y vista [C5] | Hoja con **tres tarjetas grises** y, dentro, tarjetas blancas (tarjeta dentro de tarjeta) + kicker «TAMAÑO / FUENTE / VISTA» en cada una; valor actual («Original», «Sistema») centrado a medias. | b | Una superficie por bloque: etiqueta de sección + controles directos. `components/SongFontBottomSheet.tsx` (ya sobre `sheetKit`). |
| Onboarding [O1][O2] | **«Siguiente» en azul de sistema (#007AFF)**, el botón primario por defecto de iOS: no es el azul MCM, ni el celeste de la zona, ni el dorado. Convive con tres azules más (acordes, «Saltar», selector celeste). | a | `AppPrimaryButton` con `color` de marca; acordes con el rol que ya use el cantoral. `components/song-onboarding/CantoralOnboarding.tsx`. |
| Onboarding [O1] | Selector «Toco / Canto» y «Acordes en» con **tres estilos de selección distintos** en una pantalla (tarjeta ámbar con radio, segmentado celeste, texto). | b | Un solo patrón de selección (el de tarjeta ámbar sirve). |

### 2.3 Contigo

| Pantalla | Hallazgo | a/b/c | Propuesta concreta (fichero) |
|---|---|---|---|
| Portada [T1][T2] | **La misma cifra cuatro veces**: hero «0/3 HOY · 0 días», rejilla «ÚLTIMOS 7 DÍAS», tres tiles «0 · 0' · 0» y calendario del mes «0 días activos». Con datos a cero son ceros grandes sin información. | b | Hero + una sola vista histórica. Los tiles (racha, minutos, lecturas) solo cuando haya algún valor > 0; el calendario del mes puede vivir en una hoja (ya existe `ReadingCalendarSheet`). `components/contigo/HomeWidgets.tsx`, `homeWidgetsStyles.ts`. |
| Portada [T1] | Hero marrón oscuro con anillo de puntos y degradado: es la firma de Contigo. Pero el copy en cero («¿Cuándo empezamos?», pastilla «0 días» con llama) no aporta. | b | Hero se queda (c); la pastilla de racha solo si racha ≥ 1. |
| Portada [T1] | «EVANGELIO DEL DÍA / Palabra de hoy» + botón «Leer evangelio →»: el subtítulo **repite el título**, y un botón en pastilla dentro de una tarjeta que ya es pulsable. | b | Título = fecha o primera línea del evangelio real; la tarjeta entera es el botón. |
| Portada [T1] | Tres tarjetas Evangelio / Oración / Revisión con borde y glifo de **color propio** (azul, dorado, lila). Cada color se reutiliza en la leyenda y en el calendario. | c | Se queda: el color tiene función (identifica el hábito en toda la zona). |
| Portada [T1] | Kicker «ÚLTIMOS 7 DÍAS» en 800 + «EVANGELIO DEL DÍA» en 800 + etiquetas de tile «RACHA DE ORACIÓN…» en mayúsculas: kicker en cada bloque. | b | Pasar a la receta común de etiqueta de sección (§3) y quitar los de dentro de tarjeta. |
| Oración [T3] | Emociones como **círculos pastel idénticos** con carita. | c | Función clara (selector de emoción); se queda. |
| Oración [T3] | «Guardar rato de oración»: **texto blanco sobre dorado claro** (≈1,7:1) — parece desactivado y no cumple contraste. | a (bug) | `onColor(fondo)` en el CTA o dorado más profundo. `components/contigo/oracionStyles.ts`. |
| Oración [T3] | Kicker uppercase en cada tarjeta («¿CÓMO HA IDO TU ORACIÓN?», «TIEMPO DEDICADO», «TU MES») + el mes aparece otra vez. | b | Quitar kickers de tarjeta o unificar con el estilo común. |
| Revisión [T4] | **Tres indicadores del mismo dato**: kicker «AGRADECER Y REVISAR», dos barritas y «Paso 1 de 2 · Agradecer». CTA «Continuar» en degradado violeta. | b | Dejar «Paso 1 de 2» (o las barritas), no ambos. El violeta de Revisión es el del hábito; **cuidado: es otro violeta distinto del de Comunica** (`#6c4b9e`); documentar que son dos cosas. |
| Revisión [T4] | Campos «Gracias, Jesús por…» en serif y «Añadir otro» discontinuo. | c | Identidad de lectura de Contigo. |
| Evangelio [T5] | Spinner + «Preparando la Palabra…» (sin red en el simulador; no se pudo ver el texto real). Barra de fecha con chevrons en baldosas cuadradas + pastilla «Pendiente». | c | Cabecera de fecha propia de Contigo; correcta. |

### 2.4 Fotos, Calendario, Más y Evento

| Pantalla | Hallazgo | a/b/c | Propuesta concreta (fichero) |
|---|---|---|---|
| Fotos [F1][F2] | Tarjetas de álbum con foto + degradado inferior + título blanco: es el patrón correcto (el degradado tiene función: legibilidad). | c | — |
| Fotos [F1] | En portadas **claras o con logo** («Jubileo de los jóvenes · Roma», «Jubileo · el camino») el título blanco cae sobre el sello y se lee mal. | b (bug) | Scrim más fuerte o título en pastilla/`onColor` sobre la zona. `components/AlbumCard.tsx`. |
| Fotos oscuro [D6] | Las imágenes **no habían cargado** en la captura oscura (solo marcos y degradado); no se puede juzgar el modo oscuro de las portadas. | — | Repetir con red. |
| Calendario [K1][K2] | «Hoy · Jueves 5 **De** Noviembre»: es el bug del `capitalize` ya anotado en `PLAN_DISENO.md` («capitalizeFirst»), **vivo** aquí. | a (bug) | `capitalizeFirst` de `utils`. `components/calendar/calendarioStyles.ts` (`textTransform: 'capitalize'`). |
| Calendario [K1][K2] | Mismo mes escrito de dos formas: «Noviembre 2026» (rejilla) y «Noviembre de 2026» (agenda). Y **la pantalla no tiene título**: arranca en el segmentado. | b | Un formato de mes; título de pantalla según §3. `app/screens/CalendarScreen.tsx`. |
| Calendario oscuro [D5] | Los **días de otros meses (26-31, 1-6) van a plena opacidad**; en claro [K1] están atenuados. | a (bug) | Mismo atenuado en los dos modos. |
| Calendario [K1] | Chip «● MCM Europa ✓»: punto + borde + check. El punto **sí significa** (color del calendario). | b | Dejar punto o check, no los dos. |
| Calendario [K2] | Estado vacío con icono en círculo + «Sin eventos este mes» + frase: es `EmptyState`. | c | Referencia de estado vacío; copiar a Inicio. |
| Más [M1] | Subtítulo «Atajos y secciones de la app» **repite el título** («Más»). | a | Quitarlo. `app/screens/MasHomeScreen.tsx` ~197. |
| Más [M1] | Cada fila lleva **baldosa pastel + flecha en otro círculo pastel**: dos adornos por fila, color (rosa, gris, lila) sin significado. | b | Una baldosa neutra o ninguna; sin círculo en la flecha (chevron nativo). |
| Visita Papa [E1] | **Emoji como icono** (⏰📦🍽️🚌📖👥) + **un glifo vectorial en círculo en la esquina** que dice lo mismo: icono duplicado, y rejilla genérica 2×3. «Comida de Domi…» truncado. | a | `IconSymbol` (una vez), fila o rejilla con el acento del evento. `app/screens/VisitasScreen.tsx` / `EventHomeScreen.tsx`. |
| Visita Papa [E1] | Hero con degradado amarillo→mostaza y campana en círculo. | b | El acento es del evento (c), el degradado sobra: color plano `tintColor`. |

### 2.5 Comunica (monitor)

| Pantalla | Hallazgo | a/b/c | Propuesta concreta (fichero) |
|---|---|---|---|
| Portada [Q1][D4] | Cápsulas de fecha («5 NOV») **dos veces para «HOY»** (pastilla «HOY» + cápsula con la fecha de hoy) y otra en «Te faltan». | b | Si es hoy, basta «HOY»; cápsula solo para fechas que no son hoy. `components/comunica/inicio/*`. |
| Portada [Q1][Q2] | Etiquetas de sección **con dos estilos en la misma pantalla**: «TU OTRO GRUPO» (uppercase + hairline) y «Te faltan 2 listas» (Title case, ámbar). | b | Misma receta (la decidida para Comunica) en todas. `components/comunica/comun/Section.tsx`. |
| Portada [Q2] | Grupos con punto de color: **COM I, COM II, COM III, COM = cuatro puntos verdes iguales**; el punto no discrimina. | b | Punto solo cuando distingue (MIC rojo vs COM verde → cabecera de grupo, no cada fila). |
| Portada [Q3] | 8 filas con **baldosa lavanda idéntica** y subtítulos que repiten el título («Calendario — Tus actividades, día a día.», «Pagos — Tus pagos y recibos»). | b | Quitar subtítulo cuando no añade; una baldosa o glifo directo. `components/comunica/comun/` (fila de navegación). |
| Pasar lista [Q4][Q5] | Leyenda «Pasada / Pendiente / «No hubo» = sin registro» + **nueve círculos naranja discontinuos idénticos** y «0 chavalines» en grupos vacíos. Función de estado real, pero la simetría esconde qué falta. | b | Mostrar solo lo pendiente destacado; las pasadas atenuadas. |
| Lista de un grupo [Q5] | Alturas de fila irregulares (chip «Alergia o tratamiento» repetido en cada alérgico) y **avatares grises con iniciales mezclados con avatares de color/foto**. | b | Chip → icono de maletín (ya está en la pasar-lista); avatar de una sola familia. |
| Ficha [Q6] | **Dos acciones primarias seguidas**: «WhatsApp a Sergio» (blanco) y «Llamar a Sergio (padre)» (degradado); `design.md` pide una sola acción principal. Botón degradado **inset 2 px y radio ≈8** frente a tarjetas de ≈16: no alinea con lo de arriba. | b | Una acción principal (llamar) y WhatsApp como icono de contacto (ya hay un par de botones circulares en la fila de Sergio: la tercera vía sobra). |
| Ficha [Q6] | Etiquetas **«Contacto», «Asistencia» en Title case** frente a «MONITORES», «PARTICIPANTES» en mayúsculas de la pantalla de grupo. Asistencia repite el dato 4 veces («100 %», «6 h de 6 h», «4 de 4 sesiones», «2 sábados sin lista»). Barra verde #34C759 de sistema. | b | Etiqueta común; un solo resumen de asistencia; verde de marca (COM) o token de estado. |
| Resumen [Q7] | Dos tiles «22 / 5», «0 de 7 listas 0 %» y «7 grupos sin pasarla todavía» = la misma situación en tres formatos; chip «GRUPO NUEVO DE 4.º DE ESO» en **mayúsculas dentro de un chip** (kicker aplicado a un nombre). | b | Un resumen; los chips de grupo en su forma normal. |
| Evento [Q8] | Cabecera dice **«Evento»** (genérico) y debajo el nombre gigante; kicker «INSCRIPCIONES ABIERTAS»; bloque «Sobre esta actividad» en Title case. CTA degradado a ancho completo con **radio ≈8**. | b | Nombre del evento en la cabecera; CTA con el radio del botón común. |
| Cuenta [Q9] | «Salir» en **rojo puro**, caja «Monitor/a» como tarjeta de una línea, baldosas lavanda otra vez. | b | Rojo del token de acción destructiva (`StateColors`/`SwipeColors`); caja «Monitor/a» como texto de cabecera. |
| Cabecera [Q1] | Botón de cuenta en **círculo rosa pastel** en claro y **sin círculo** en oscuro [D4]. | b | Mismo tratamiento en los dos modos. |
| Carga [Q10][Q11] | Skeletons de Eventos/Pagos con la forma de la lista. | c | `ListSkeleton`, como dice §7. |
| Oscuro [D4] | «Te faltan 2 listas»: bloque **marrón-ámbar muy saturado** sobre gris: el más ruidoso de la pantalla. | b | Tinte ámbar más bajo en oscuro (token `aviso`). |

---

## 3. Constantes compartidas propuestas

Ocho cosas que **deben ser iguales en toda la app**; cada zona solo cambia el **color** (por prop/rol).

| # | Constante | Propuesta | Hoy (evidencia) |
|---|---|---|---|
| 1 | **Título de pantalla** | *Raíz de pestaña*: título grande a la izquierda (`h1`) + acción derecha opcional. *Pantalla interna*: título nativo centrado + atrás de cristal. Excepciones declaradas: Inicio (logo + `h0`), Comunica (cabecera degradada con título centrado = firma). | Inicio `h0` con logo [I1]; Cantoral centrado nativo [C1]; Contigo izquierda con píldora [T1]; Calendario **sin título** [K1]; Más `h0` + subtítulo [M1]; Fotos centrado nativo [F1]; Visita Papa sin título [E1]. |
| 2 | **Radio de tarjeta** | `radii.lg` (16) para toda tarjeta de contenido; `radii.xl` (20) solo hero/tarjeta destacada; Contigo mantiene 20-22 como excepción **escrita**. | ≈14-16 en Comunica/Inicio, ≈20 en Más/Fotos/Calendario, 22 en Contigo; botones de Comunica con ≈8 junto a tarjetas de 16. |
| 3 | **Borde y sombra** | Hairline `separator` y `shadows.card`; el color no va en el borde. | Banners de Inicio con borde de color ≈2 px [I1]; tarjetas de Contigo con borde dorado fino (c). |
| 4 | **Etiqueta de sección** | **Una receta**: mayúsculas, tracking, peso 600 y 12-13 pt, color de texto secundario de la zona. Una por bloque, nunca una por tarjeta. Comunica añade su hairline (decidido); el resto sin. Prohibido Title case como etiqueta en Comunica. | Gris 600 en Inicio/Cantoral; marrón 800 en Contigo; hairline en Comunica; Title case en la ficha [Q6] y el evento [Q8]; ninguna en Más/Fotos/Calendario. |
| 5 | **Botón principal** | `AppPrimaryButton`: alto 52, radio `radii.md`, texto `button` 600; `color` por zona (azul MCM plano, dorado, degradado de marca). **Prohibido el azul de sistema.** Secundario: hairline + `link`, mismo alto. Una acción principal por pantalla. | Azul #007AFF [O1]; degradado ≈8 px [Q6][Q8]; dorado píldora [T3]; celeste en segmentado [K1]; píldora blanca «Evaluar» [I1]. |
| 6 | **Chip / píldora** | Una forma (`radii.xl`, 28-32 pt de alto, 13 pt 600, fondo tintado + `onColor`). Punto solo cuando es el color de una entidad (calendario, rama). Check o punto, no ambos. | «HOY», «FALTA», `DO`, «MCM Europa ✓», «Pendiente», «Alergia…» con formas y pesos distintos. |
| 7 | **Icono y baldosa** | Solo `IconSymbol`; **nunca emoji**. Una única baldosa (36 pt, `radii.sm`, tintada con `tintedGlyph`) o ninguna; sin círculo extra en la flecha. | Emoji [C1][E1]; círculos pastel [I1], baldosas [M1][Q3]; flechas en círculo [M1]. |
| 8 | **Vacío y cero** | `EmptyState` siempre; un contador en cero no se pinta («0 / 0' / 0», «0 días», «0 de 7 listas 0 %»). Un dato = un formato por pantalla. | Contigo [T1][T2], Resumen [Q7], Ficha [Q6], Inicio [I2]. |

Reglas de mantenimiento de las ocho: los ítems 1, 2, 5 y 6 caben en tokens/componentes que ya existen
(`ScreenHero`, `radii`, `AppPrimaryButton`, `AppChip`); el 4 pide **un** componente `SectionLabel` (hoy
`Section` solo existe en Comunica); el 7 y el 8 son disciplina de revisión (y, para el emoji, un test como el de
`noEdgeStripes`).

---

## 4. Lo que cada zona conserva

- **Institucional** (Inicio, Cantoral, Calendario, Fotos, Más): fondos blancos, azul MCM, el logo de Inicio, el
  tono transpuesto en píldora, la fila de canción agrupada, el estado vacío de Calendario, el tinte por pestaña.
- **Contigo**: paleta cálida/dorada, serif en lectura, radios 20-22, el hero marrón con anillo, el color por
  hábito (azul/dorado/lila) como código de toda la zona, el violeta de Revisión, los placeholders serif,
  los degradados de CTA. Lo que **no** conserva: los ceros repetidos ni los kickers dentro de cada tarjeta.
- **Comunica**: degradado de marca azul→violeta→magenta en cabecera/hero/CTA/destacada/cápsula/avatar,
  etiquetas en mayúsculas con tracking y hairline, violeta `#6c4b9e`, cabecera propia con título centrado,
  `CardSurface` + `AreaState`. Lo que **no** conserva: dos acciones primarias seguidas, Title case como etiqueta,
  botón de ≈8 px de radio junto a tarjetas de 16.
- **Eventos**: acento propio (`tintColor`: el amarillo de Visita Papa), estructura institucional, hero con logo.
  No conserva emoji ni glifo duplicado.
- **Cantoral (dentro de lo institucional)**: la barra del estribillo (notación), acordes de color, tinte
  amarillo de iconos. No conserva la barrita del título ni el FAB rosa.

---

## 5. Orden de ataque (más peso → menos)

Estimación: **S** < 1 h, **M** una tarde, **L** varias sesiones.

1. **Botón primario único** (azul de sistema del onboarding; radio/alto de los degradados de Comunica) — **S/M**. Es lo que más rompe «una sola app» y lo que más se ve.
2. **Emoji → `IconSymbol`** en Cantoral categorías y Visita Papa, + test que vigile emoji en JSX — **S/M**. Único punto prohibido por `design.md` que sigue vivo.
3. **Bugs visibles de paso** — **S** cada uno: `capitalize` «Jueves 5 De Noviembre»; días fuera de mes en Calendario oscuro; contraste de «Guardar rato de oración»; scrim de portadas claras en Fotos; «Salir» en rojo puro.
4. **Poda de ceros en Contigo** (hero, 7 días, tiles y mes → una sola vista; tiles solo con datos) y de repeticiones en Comunica (cápsula «5 NOV» + «HOY», asistencia ×4, resumen ×3) — **M**.
5. **Inicio con jerarquía**: bienvenida con relleno fuera, un único aviso arriba, «Evalúa la app» neutra, estado vacío de eventos — **M**.
6. **Etiqueta de sección única** (`SectionLabel`) y retirada de kickers dentro de tarjetas (Contigo, Letra y vista, Comunica Title case) — **M**.
7. **Títulos de pantalla**: título a Calendario, subtítulo fuera de Más, «Evento» → nombre en la cabecera de Comunica — **M**.
8. **Quitar la barrita dorado→rojo** de la canción y el onboarding; FAB rosa → rol de zona — **S**.
9. **Baldosas de icono**: una sola baldosa (o ninguna) en Inicio, Más y Comunica; flechas sin círculo — **M**.
10. **Radios de tarjeta y bordes** (≈14/20/22 → `lg`/`xl` + excepción de Contigo) — **M** (puede cruzar E5 de `PLAN_DISENO.md`; no abrirlo por separado).
11. **Hoja «Letra y vista»** sin tarjeta dentro de tarjeta; selección con un patrón — **S/M**.
12. **Modo oscuro de Comunica** (aviso ámbar saturado, botón de cuenta) — **S**.

---

## 6. Pantallas no vistas (y por qué)

- **Comunica familia** (portada, Eventos cargados, Pagos, Documentos, Mis datos): solo entré como monitor
  (`monitor@ejemplo.org`); Eventos y Pagos se vieron en **carga** [Q10][Q11], no con datos. La portada de
  familia, Documentos y Mis datos de familia no se vieron.
- **Coordinación**: no apareció para ese perfil.
- **Contigo → Guardados**: no se llegó.
- **Evangelio con texto**: se quedó en «Preparando la Palabra…» (sin red).
- **Calendario**: un evento concreto — no hay eventos de prueba en noviembre (mes y agenda vacíos).
- **Jubileo / Eventos pasados / Gestión / Ajustes / Notificaciones**: no se abrieron (límite de uso); solo se vio Visita Papa [E1] como pantalla de evento.
- **Cantoral**: «Tu selección» con canciones, buscador, ajustes de acordes completos y tono/cejilla (salió la hoja pero no se capturó entera).
- **Oscuro**: Fotos sin imágenes cargadas [D6]; **no** se capturaron en oscuro Evangelio, Oración, Revisión, onboarding ni las pantallas internas de Comunica.
- **Fuera de alcance**: Android y web (el coordinador compila Android aparte), `fontScale` grande, iPad.

---

## 7. Índice de capturas

Ruta base: `/Users/izanriro/.claude/projects/-Users-izanriro-Documents-Proyectos-mcmapp/f87f6815-73a2-414b-a5b1-b662af618ead/tool-results/`
Cada código es `mcp-Claude_Code_iOS_Simulator-blob-<id>.png` bajo esa carpeta. Ruta completa del ejemplo `[I1]`:
`/Users/izanriro/.claude/projects/-Users-izanriro-Documents-Proyectos-mcmapp/f87f6815-73a2-414b-a5b1-b662af618ead/tool-results/mcp-Claude_Code_iOS_Simulator-blob-1793876902781-i85qzs.png`

**Claro**
- [O1] onboarding paso 1 — `…blob-1793876852989-ecryqq.png`
- [O2] onboarding paso 3 — `…blob-1793876861089-jpcchv.png`
- [C1] Cantoral categorías — `…blob-1793876873241-ipl4rz.png`
- [C3] Lista «Entrada» — `…blob-1793876875459-m8gakv.png`
- [C4] Canción + menú — `…blob-1793876885624-hiamsi.png` (con FAB cerrado: `…blob-1793877750514-r3nitr.png`)
- [C5] «Letra y vista» — `…blob-1793876891439-3mb0sz.png`
- [I1] Inicio — `…blob-1793876902781-i85qzs.png`
- [I2] Inicio (scroll, hueco de eventos) — `…blob-1793876909334-6urslc.png`
- [T1] Contigo portada — `…blob-1793876931792-7hj87j.png`
- [T2] Contigo (mes, tiles) — `…blob-1793876923519-zbceyj.png`
- [T3] Oración — `…blob-1793877802248-tfv3it.png`
- [T4] Revisión — `…blob-1793876962623-l8yfd5.png`
- [T5] Evangelio (cargando) — `…blob-1793876939859-1b7yl2.png`
- [K1] Calendario mes — `…blob-1793877812837-1s5hv4.png`
- [K2] Calendario agenda (vacío) — `…blob-1793877808020-r8mdpq.png`
- [M1] Más — `…blob-1793877818026-je50cv.png`
- [F1] Fotos — `…blob-1793877824469-ovmitx.png`
- [F2] Fotos (scroll) — `…blob-1793877020107-3dv8d4.png`
- [E1] Visita Papa — `…blob-1793877038992-z4bw82.png`
- [Q1] Comunica monitor, portada — `…blob-1793877050850-vnwras.png`
- [Q2] Comunica monitor, scroll — `…blob-1793877059087-r8g461.png`
- [Q3] Comunica, menú de grupos y actividades — `…blob-1793877188146-hi96gt.png`
- [Q4] Pasar lista (todos los grupos) — `…blob-1793877084734-gs9lra.png`
- [Q5] Lista de un grupo — `…blob-1793877119472-cu6kwi.png`
- [Q6] Ficha — `…blob-1793877138948-uaoq4l.png`
- [Q7] Resumen de grupos — `…blob-1793877182533-msw5yq.png`
- [Q8] Evento (detalle) — `…blob-1793877700587-6qkv6z.png`
- [Q9] Tu cuenta — `…blob-1793877709135-5ynlvg.png`
- [Q10] Eventos (cargando) — `…blob-1793877166634-wivn9g.png`
- [Q11] Pagos (cargando) — `…blob-1793877194845-5vner4.png`
- Pasar lista de un grupo — `…blob-1793877665107-9y9x7p.png`

**Oscuro**
- [D1] Inicio — `…blob-1793894199331-hej2xu.png`
- [D2] Cantoral — `…blob-1793894210493-q8ly5f.png`
- [D3] Contigo — `…blob-1793894210938-rh8qe7.png`
- [D4] Comunica — `…blob-1793894216046-vv7zjx.png`
- [D5] Calendario — `…blob-1793894221669-jck9t6.png`
- [D6] Fotos (sin imágenes) — `…blob-1793894249596-jfvw15.png`
- Más — `…blob-1793894227534-kp94qv.png`

> Lectura rápida de las seis divergencias que más rompen la sensación de «una sola app»:
> botón primario [O1] vs [Q6] vs [T3] vs [I1]; títulos de pantalla [I1] [C1] [T1] [K1] [M1] [F1];
> etiqueta de sección [I2] [T1] [Q2] [Q6]; baldosas/emoji de icono [C1] [M1] [Q3] [E1]; radios de tarjeta
> [Q5] [M1] [T1]; ceros y repeticiones [T1] [Q7] [Q6].


## Decisiones de cierre (2026-11-05, rama `claudito/area-nativa-estilo-plugin`)

Lo que quedaba de §5 y se **decide dejar así** (no hace falta re-abrirlo):

- **Hoja «Letra y vista»:** el estado en el centro y las celdas dentro del grupo son el patrón de ajustes agrupados de iOS que documenta `components/song-sheet/sheetKit.tsx`; no es «tarjeta dentro de tarjeta» por descuido.
- **Calendario sin título:** es raíz de pestaña con el selector Mes/Agenda en la cabecera; el título lo hace el propio selector.
- **«Evento» en la cabecera de Comunica:** se queda genérico; el nombre del evento va grande justo debajo.
- **Visita Papa (hero con degradado):** el evento está archivado y su pestaña oculta; se revisa si se reactiva.
- **Radios sueltos (E5):** ver `PLAN_DISENO.md` E5.
