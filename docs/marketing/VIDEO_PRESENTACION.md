# Vídeo de presentación de MCM App — guion del Reel (~60 s)

> Noviembre de 2026. Guion de trabajo para un Reel vertical que presente la app
> entera, incluida el **área privada nativa de Comunica** y el **pañuelo
> virtual** (aún en el Laboratorio Alpha: se enseña como «muy pronto»).
> Los textos en pantalla son **borradores**: el propietario los retoca. Lo que
> está pensado aquí es el **ritmo, el orden y qué se ve en cada plano**.
>
> El vídeo se monta con el tipo de artefacto **Motion** de Claude (escrito como
> código, estilo Remotion; exporta MP4). Una sesión de Claude con este repo
> delante puede hacerlo: conoce colores, logo, piezas 3D y pantallas.

## Formato

- **9:16, 1080×1920, 60 s** (Reels / TikTok / Shorts / estados). Versión corta
  de 15–20 s sacando los bloques 1, 2, 7 y 9.
- **Texto en pantalla siempre**: la mitad de la gente lo ve sin sonido. Frases
  de 3 a 6 palabras, nunca más de dos líneas.
- **Ritmo**: planos de 1,5–2,5 s cortados a golpe de música (~120 BPM, cada
  compás ≈ 2 s). Cada bloque se abre con un cambio de color de fondo.
- **Un móvil de maqueta** en el centro con las capturas o grabaciones dentro;
  el fondo y los textos los genera Motion.
- **Color**: cada bloque toma el color de su sección en la app (es la misma
  regla de los territorios de `design.md` §2): azul MCM `#253883` (Inicio),
  color del cantoral (amarillo `#f4c11e`, `TabHeaderColors.cancionero`), dorado/beige de Contigo
  (`WARM_LIGHT`), violeta de Comunica `#6c4b9e` con su degradado azul →
  violeta → magenta, y el color de etapa en el pañuelo. Cierre otra vez en azul
  MCM. Tipografía y logo: los de la app (`assets/images/logo-m.png`, `icon.png`).

## Guion

| # | Tiempo | Bloque | Qué se ve | Texto en pantalla (borrador) |
|---|---|---|---|---|
| 1 | 0:00–0:03 | **Gancho** | La «M» del logo entra y estalla en los colores de marca (azul, rojo MIC, verde COM, amarillo COM, morado LC). | **Todo el MCM. En tu bolsillo.** |
| 2 | 0:03–0:07 | **Inicio** | El móvil sube desde abajo con Inicio. Barra de pestañas iluminándose una a una. | **Una app. Todo lo que vivimos.** |
| 3 | 0:07–0:17 | **Cantoral** (el bloque más largo: es lo que más se usa) | Buscar una canción → hoja con acordes → transportar de tono (los acordes cambian) → pantalla completa. Corte a «Cantos para el domingo» proponiendo la misa entera. Corte a «Subir a mi coro». Remate: afinador con la aguja centrándose en verde. | **Cientos de canciones con acordes** → **La misa del domingo, propuesta** → **Tu coro, sincronizado** → **Y afina la guitarra** |
| 4 | 0:17–0:26 | **Contigo** (fondo cálido, dorado) | Evangelio del día con su fiesta litúrgica → subrayar una frase con el dedo → compartirla como imagen. Oración y Revisión del día. Recordatorio que llega. Un destello de «Tu año». | **Cada día, el Evangelio** → **Subraya. Comparte.** → **Reza a tu ritmo** |
| 5 | 0:26–0:32 | **No te pierdas nada** (montaje rápido, 3 planos) | Notificación push cayendo desde arriba → Calendario con los eventos del curso → Galería de fotos. | **Avisos, fechas y fotos** |
| 6 | 0:32–0:36 | **Eventos** | Pantalla de un encuentro (Jubileo como ejemplo): horario, grupos, materiales, comida, contactos. | **Cada encuentro, con su propia guía** |
| 7 | 0:36–0:47 | **Comunica: tu área privada** (cambio a violeta con el degradado) | «Entrar en Comunica» con un toque y la entrada animada. **Monitores**: pasar lista marcando a tres chavales seguidos → «Han venido todos»; grupos y fichas. **Familias**: inscripción a una actividad → pago con tarjeta → documentos. | **Tu área de Comunica, ya en la app** → **Monitores: pasa lista en segundos** → **Familias: inscríbete y paga desde el móvil** |
| 8 | 0:47–0:56 | **El pañuelo virtual** (sello «Muy pronto») | El pañuelo en 3D girando, del color de la etapa, con chapas y pines. Se canjea un código → la pieza nueva entra girando con chispas y cae en su sitio. Se toca una medalla: sale flotando y aparece su ficha («Jubileo 2025»). Intercambio con QR entre dos móviles. | **Tu pañuelo, también aquí** → **Cada actividad, una pieza** → **Cada pieza, un recuerdo** |
| 9 | 0:56–1:00 | **Cierre** | Vuelve el azul MCM, logo, «MCM App» y las tiendas. | **MCM App · Descárgala gratis** · App Store · Google Play |

Música: instrumental alegre, sin letra (la letra compite con el texto). Que el
golpe fuerte caiga en el cambio al bloque 7 (Comunica) y el subidón final en la
pieza nueva del pañuelo.

## De dónde sale cada plano

| Plano | Fuente recomendada | Por qué |
|---|---|---|
| 1, 2 (logo, colores, barra) | **Generado en Motion** | Es animación pura con los recursos del repo |
| 3 Cantoral (buscar, acordes, transportar, domingo, coro) | **Captura web** (`npm run web`) o grabación del móvil | Funciona igual en web |
| 3 Afinador | **Grabación del móvil** | Usa el micrófono; en web tiene trampas (`AFINADOR.md`) |
| 4 Contigo | **Captura web** + grabación del móvil para el recordatorio | El aviso local solo existe en el móvil |
| 5 Notificación push | **Generada en Motion** (un banner de iOS dibujado) o grabación real | Más limpio dibujarla |
| 5 Calendario, fotos, 6 Eventos | **Captura web** | Igual que en móvil |
| 7 Comunica | **Grabación del móvil con el perfil de datos inventados** (`production-comunica-falso`) | Ver «Cuidado» abajo |
| 8 Pañuelo (giro, piezas) | **Generado en Motion a partir de los `.glb` reales** (`piezas-3d/`, `medallas-3d/`, servidos por jsDelivr) **+ grabación del móvil** para canje, ficha e intercambio | El giro con inclinación y el brillo del metal se ven mejor en el móvil; las piezas sueltas se pueden animar en el propio vídeo |
| 9 Cierre | **Generado en Motion** | — |

### Lista de grabaciones para el propietario (con el móvil)

Grabar con la grabación de pantalla del sistema, en vertical, modo claro,
**No molestar** activado y con poca batería escondida (o recortando la barra de
estado). 5–8 s por toma, gestos lentos y limpios:

1. Afinador: tocar una cuerda hasta que la aguja se pone verde.
2. Contigo: llega un recordatorio y se abre el evangelio.
3. Comunica (perfil falso): «Entrar en Comunica» con la animación de entrada.
4. Comunica: pasar lista marcando 3–4 personas y «Han venido todos».
5. Comunica: inscribirse en una actividad y llegar a la hoja de pago.
6. Pañuelo: girarlo con el dedo e inclinar el móvil.
7. Pañuelo: canjear un código y ver llegar la pieza.
8. Pañuelo: tocar una medalla y que salga su ficha.
9. Pañuelo: intercambio con QR (hacen falta dos móviles con sesión).

## Cuidado

- **Nada de datos reales en Comunica.** Son fichas de menores y de familias:
  solo el perfil `production-comunica-falso` (servidor falso, nombres
  inventados). Lo mismo para cualquier foto de la galería que salga con caras.
- **Carismochito no sale** en la versión normal: está cerrado hasta el 25.º
  aniversario (2027), ni el modo ni su pin del pañuelo
  (`piezas-3d/carismochito.glb`). Solo asoma en la versión «guiño 2027».
- **El pañuelo, con sello «Muy pronto»**: hoy solo está en el Laboratorio
  Alpha y el reparto real de piezas está por decidir (`PANUELO.md`). No decir
  cómo se consiguen las piezas más allá de «por participar en las
  actividades».
- **Cifras**: si se pone un número de canciones, sacarlo del cantoral real en
  ese momento; no inventarlo.
- Las insignias de App Store y Google Play, solo las oficiales y sin
  deformarlas.

## Dos versiones

1. **Normal (la de siempre)**: el guion de arriba, sin Carismochito.
2. **Con guiño 2027** (decisión del propietario, 17/11/2026): la misma, y tras el
   cierre, ~3 s más. Primero un momento de calma (fondo quieto, música que se
   apaga), luego **«2027»** entra en dos golpes, y el **pin de Carismochito**
   (`piezas-3d/thumbs/carismochito.webp`) se asoma y parpadea un par de veces
   (como mucho 3 cambios por segundo: no es un flash) con un «Se viene…».
   Es la **única** excepción a «Carismochito no sale», y solo en esta versión.
   Se hace a partir de la normal, cuando esté cerrada.

## El vídeo en Motion

Montaje (versión normal, 60 s): https://claude.ai/artifact/DvdGrkjoHMtehuVoBdQvhZ

**Segunda versión (19/11/2026), tras la revisión del propietario**: nada de
pantallas dibujadas. Todas son **capturas reales** de la app (la web publicada
y, para Comunica, una exportación local con el servidor de datos inventados) y
las piezas son **renders reales de los modelos 3D** girando. Cómo se hizo, en
[`video-herramientas/`](video-herramientas/README.md). Orden y textos:

| Escena | s | Texto | Pantallas reales |
|---|---|---|---|
| Gancho | 3 | Todo el MCM. En tu bolsillo. | logo |
| Inicio | 3,5 | Una app. Todo lo que vivimos, junto. | Inicio |
| Cantoral | 6,5 | Más de 250 canciones, con sus acordes. / En tu tono, con un toque. Y con afinador. | categorías → «Sois la sal» en MI → Tono y cejilla → en SOL; tarjeta del afinador |
| Coros | 6 | Haz tu playlist y compártela con tu coro. / Tu coro, al día. | añadir a Tu selección → selección → hoja del coro → QR |
| Contigo | 7 | Cada día, el Evangelio y todas las lecturas. | Contigo → Evangelio → lecturas del día |
| Fechas y fotos | 5 | Todas las fechas y las fotos de cada encuentro. | calendario → fotos |
| Eventos | 4 | Cada encuentro, con su propia guía. | Visita del Papa León XIV 2026 |
| Comunica | 12 | Accede directamente a la Plataforma Comunica MCM. / Inscríbete a eventos en segundos. / Y paga desde la app. / Monitores: gestiona tus grupos y pasa lista. | acceso → código → portada familia → evento → inscripción → plaza confirmada → pagos → pagar → pago hecho → portada monitor → grupos → pasar lista |
| Colecciona | 9 | (Muy pronto) Colecciona insignias, chapas y mucho más. / También en la App. | 11 piezas 3D girando |
| Cierre | 4 | MCM App. Descárgala gratis. | insignias oficiales de las tiendas |

La ficha de un grupo se dejó fuera aunque sea inventada: enseña avisos de
alergias de menores. «Cantos para el domingo» y «Lecturas del domingo» no
salen (decisión del propietario: lo que luce es crear y compartir la playlist).

## Tercera vuelta (19/11/2026): capturas nativas, gancho y sonido

- **Gancho nuevo (4 s)**: cuatro golpes a tiempo, uno cada medio segundo:
  «Canta.» (cantoral) · «Reza.» (Contigo) · «Apúntate.» (Comunica) ·
  «Colecciona.» (la medalla en 3D), y a los 2 s la M con «Todo el MCM. En tu
  bolsillo.». Inicio baja a 2,5 s.
- **Sonido: solo efectos.** La música va aparte, en el editor. Todos los cortes
  caen en una rejilla de 120 BPM (medio segundo): vale cualquier música a
  120 (o 60/240) que empiece en 0:00.
- **Las pantallas pasan a capturas nativas del iPhone** (las de la web quedan
  como reserva). Lista, con la numeración con la que se mandan:

| N.º | Escena | Captura (iPhone, modo claro, «No molestar») |
|---|---|---|
| 1 | Inicio | Inicio, arriba del todo |
| 2 | Cantoral | Pantalla principal del Cantoral («Tu selección» vacía + categorías) |
| 3 | Cantoral | «Sois la sal» (Comunión) en MI, sin menús |
| 4 | Cantoral | La misma con «Tono y cejilla» abierta, ya subida a SOL (+3) |
| 5 | Cantoral | La misma en SOL, con la hoja cerrada |
| 6 | Cantoral | Afinador, sin tocar nada |
| 7 | Coros | Lista de Comunión arriba del todo, sin nada añadido |
| 8 | Coros | La misma tras añadir 3 de las canciones que se ven |
| 9 | Coros | «Tu selección» con esas canciones (3 o 4) |
| 10 | Coros | La hoja del coro abierta, con el coro elegido |
| 11 | Coros | Compartir → «Código QR» |
| 12 | Contigo | Pantalla principal de Contigo |
| 13 | Contigo | Evangelio del día, arriba |
| 14 | Contigo | Más abajo: «Todas las lecturas del día» con la Primera lectura abierta |
| 15 | Fechas | Calendario con un día con evento tocado |
| 16 | Fotos | Galería, arriba |
| 17 | Evento | Visita del Papa (Más → Eventos pasados), portada |
| 18 | Evento | La misma, un poco más abajo |
| 19-31 | Comunica | **Solo con la build `production-comunica-falso`** (datos inventados; cuentas `familia@ejemplo.org` / `monitor@ejemplo.org`, código `123456`): acceso, código, portada de la familia viendo a Lucía, evento «Merienda de bienvenida», inscripción, plaza confirmada, Pagos, Pagar con tarjeta, Pago hecho, portada del monitor, Grupos y fichas, Pasar lista sin marcar, Pasar lista con 4 marcados. **Nunca con una cuenta real.** Sin esa build, se quedan las capturas de la app local. |

Una captura nativa entra a pantalla completa en el iPhone del vídeo (con su
propia barra de estado: la dibujada se esconde sola, `W.real` con la marca
`native` en la capa).

### Música: «Fresh Start» (propia, 19/11/2026)

Instrumental hecha para el vídeo (60,6 s, ~122,7 BPM). Motion no mete archivos
de audio en la animación, así que va aparte: el vídeo exportado lleva solo los
efectos y la música se pone debajo en el editor (o se mezcla con ffmpeg).
Preparación (ffmpeg): `atempo=0.977836` (122,7 → 120 BPM, para que el pulso
caiga cada 0,5 s, como los cortes), recortada desde el **4,18 s** (donde entra
el bajo), rellenada a 60 s, fundido final desde el 57 s y `loudnorm` a −14 LUFS.
Resultado: el bajo entra con «Canta.» (0 s), el pulso cae en la rejilla de los
cortes (desfase medido: −10 ms) y la canción termina justo en el cierre (56 s).

## Siguiente paso

1. El propietario retoca los textos de la tabla y graba las tomas de la lista.
2. Una sesión de Claude saca las capturas web de los bloques 3–6 y monta el
   Motion con este guion, las tomas y los recursos del repo.
