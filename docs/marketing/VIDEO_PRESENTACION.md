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

Primer montaje (versión normal, 60 s, pantallas dibujadas a partir del código
de la app): https://claude.ai/artifact/DvdGrkjoHMtehuVoBdQvhZ — las pantallas
se cambian por las tomas del iPhone del propietario cuando lleguen (en cada
escena, `W.shot(kit, '<toma>')` dentro de `W.phone`).

## Siguiente paso

1. El propietario retoca los textos de la tabla y graba las tomas de la lista.
2. Una sesión de Claude saca las capturas web de los bloques 3–6 y monta el
   Motion con este guion, las tomas y los recursos del repo.
