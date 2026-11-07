# Decisiones del área privada nativa — copia de seguridad

> **La fuente de verdad es la página**: <https://claude.ai/artifact/B3ABkV5CYJLUTo2hnWW8t5>
> (colección `decisiones` de su base de datos; el id de cada tarjeta es el
> documento). Esta carpeta es una **copia** para no perderla y para que
> cualquier agente la lea sin acceso a la página. **Copia del 24/10/2026.**

- [`pagina-de-decisiones.html`](pagina-de-decisiones.html): la página tal cual
  (versión 6). Abierta en local funciona, pero guarda en el navegador, no en la
  base de datos de la página.
- [`respuestas.json`](respuestas.json): lo que había contestado el propietario,
  con su fecha y sus comentarios.
- La tabla de abajo: cada tarjeta con su respuesta.

**Regla para agentes**: antes de ejecutar un plan, lee las respuestas (la
página si puedes; si no, esta copia) y aplícalas. Si cambias de opinión una
tarjeta en la página, pide que se refresque esta copia (leer la colección
`decisiones` y regenerar `respuestas.json` y la tabla).

Cuándo se contestó: las del bloque «Lo grande» y «Cómo se construye», el
21/10 por la tarde; las de los planes de pantallas, el 21/10 a las 22:30 (no
se pasaron a los planes hasta el 24/10: por eso el código del 23-24/10 aún no
las sigue, ver [`../ESTADO.md`](../ESTADO.md)); `ipfija` y las seis de
familias, el 24/10 por la mañana. **Están todas contestadas.**

## Lo grande

| Tarjeta | Pregunta | Respuesta | Comentario del propietario |
|---|---|---|---|
| `alcance` | ¿Qué va nativo primero? | «Monitores primero» |  |
| `velocidad` | ¿De dónde sale la velocidad? | «Pasarela primero, espejo si hace falta» | Pero en la decisión BBDD espejo se dijo que bueeeno quizá no era necesario no sé que. Desarrolla más esta idea para ver qué tal. No nos gusta NEÓN? No se podría hacer el camino nativo conectado a sinergia directamente vía API con ese servidor o así y que luego sea muy fácil cambiar la conexión nativa al espejo?? Será chungo hacer el espejo pero no el cambio de conexión nativa no se puede? |
| `sinergiatic` | ¿Qué pedimos a SinergiaTIC? | «Las dos cosas» |  |
| `ipfija` | ¿Y si SinergiaTIC pide una IP fija para dejarnos leer su base de datos? | «Un servidor pequeño con IP fija» | Estoy reflexionando en conseguir un VPS de hostinger. pero por loq ue he visto sinergia no pide una IP, parece, parece.... |

## Cómo se construye

| Tarjeta | Pregunta | Respuesta | Comentario del propietario |
|---|---|---|---|
| `almacen` | ¿Dónde van el servidor y la base de datos propia? | «Vercel gratis y Neon gratis: 0 €/mes» | Antes de pagar supabase crearía otra cuenta de supabase para la ocasión jeje Neón y vercel podría seguir siendo gratuito de alguna manera? Es mucho mejor supabase? Puedes calcular precios reales? LO VAMOS A IR PENSANDO ESTO, PORQUE IGUAL MONTAMOS SUPABASE EN UN VPS O PENSAMOS ALGUNA COSA BRODER, LO QUE ME VEAS MEJOR |
| `repo` | ¿Dónde vive el código del servidor? | «Repo nuevo» |  |
| `diseno` | ¿Cómo se pasa el diseño del área privada a la app? | «Traducción pantalla a pantalla» | Pero todo full nativo bien hecho eh, osea partir de la idea existente porque las pantallas ya están pensadas y funcionan y se va cambvianxk |
| `territorio` | ¿De qué color va el área nativa dentro de la app? | «Territorio «Comunica»» | Para mí comunica es un azul morado pero me parece más morado que otra cosa en el plugin actual |
| `login` | ¿Cómo se entra en el área nativa? | «Código por correo o DNI, y sesión de meses» | Pero además, para acceder c si tienes el login de la app hecho ya, te pre relleno el correo y “solo recibir un código para acceder” recibido el código y estoy dentro |
| `dni` | Si alguien escribe un DNI que no está en el CRM, ¿se le dice? | «Contestar igual que con el correo» |  |
| `offline` | ¿Qué tiene que funcionar sin cobertura? | «Pasar lista y ver mis grupos» |  |
| `salud` | ¿Y los datos de salud sin cobertura? | «Solo la marca, como hoy» | No te ralles mucho con esto, simple |
| `extras` | ¿Qué extras nativos quieres en la primera versión? | «Avisos en el móvil», «Compartir un evento» |  |
| `tecnicas` | Lo técnico que doy por hecho | «Quiero hablar alguna» | El diseño sería un temazo… porque el diseño del área privada ha quedado guapo. Sería reflexionar cómo partir de literalmente todas las pantallas del wordpress y decir vale lo construyo en Expo y aquí tomo alguna decisión de diseño para ser coherentes en la app, pero el concepto de base el existente . En un primer momento podría ser un mix antes de hacer el espejo acceder a la info del CRM en modo lectura por la base de datos directa y más adelante se hace el espejo? Al final sería una pieza en vercel que podríamos ir mejorando |

## De los planes de pantallas (nuevas)

| Tarjeta | Pregunta | Respuesta | Comentario del propietario |
|---|---|---|---|
| `futuras` | ¿Se puede pasar lista de un día que aún no ha llegado? | «Como el plugin» |  |
| `desmarcar` | Si alguien quita una marca ya guardada, ¿se borra en el CRM? | «Sí: queda sin marcar también en el CRM» |  |
| `salud-no` | Si la familia dijo «no» a compartir la salud, ¿la ficha la enseña? | «Sí, en la ficha» |  |
| `alcance-coord` | ¿Qué grupos ve quien coordina o acompaña? | «La suma de sus relaciones, igual para los dos papeles» |  |
| `marcas-autobus` | En la lista del autobús, ¿salen las marcas «No se va solo», «Sin fotos» y «Alergia o tratamiento»? | «Sí, como en las del grupo» | Las de no se va solo da igual que salgan las otras ok |
| `avisos-nombres` | ¿Los avisos del móvil llevan el nombre del chaval? | «Con el nombre de pila» | Solo nombre y una letra o Luc. H. |
| `fotos-documentos` | Para subir títulos y certificados, ¿se podrá hacer una foto con el móvil? | «Sí, y su paquete entra en la 2.2» |  |

## De los planes de familias (nuevas, 24/10)

| Tarjeta | Pregunta | Respuesta | Comentario del propietario |
|---|---|---|---|
| `equipo-hijo` | Si una monitora mira la ficha de su hija, ¿sigue viendo «Pasar lista» en la portada? | «Sí, siempre» |  |
| `docs-con-plaza` | Quien ya tiene plaza en una convivencia, ¿puede abrir sus documentos aunque ya no cumpla la audiencia? | «Sí: con plaza o con audiencia» |  |
| `aviso-pagos` | Si un pago con tarjeta sale raro, ¿a quién avisamos? | «Delegación dueña, con copia a la oficina técnica» |  |
| `tope-importe` | Al pagar con tarjeta, «Pagar otra cantidad», ¿tiene tope? | «Sin tope, como hoy» | pero resuelve el drama de las comas y las cosas asi |
| `calendario-marcas` | En el calendario de las familias, ¿«Parcial» y «Justificada» salen con su color? | «Como el plugin» |  |
| `campos-crm` | Faltan campos en CAMPOS.md: ¿los miro en el CRM y los apunto? | «Sí, míralos y déjame las diferencias» | pero metelo bien en el repo y lo añades y actualizas ese documento. importante que luego se tiene que repartir en 3 repos distintos |

## Convivencia y lanzamiento

| Tarjeta | Pregunta | Respuesta | Comentario del propietario |
|---|---|---|---|
| `plugin` | ¿Qué pasa con el plugin de WordPress? | «Se queda para la web» |  |
| `congelar` | Mientras se construye, ¿lo de monitores sigue creciendo en el plugin? | «Solo arreglos desde que arranque lo nativo» |  |
| `paquetes` | ¿Metemos ya en la build 2.2 los paquetes nativos que necesitará? | «Sí, en la 2.2» |  |
| `piloto` | ¿Cómo se lanza? | «Para todos a la vez, con vuelta atrás» |  |
