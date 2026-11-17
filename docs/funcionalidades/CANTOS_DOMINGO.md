# CANTOS_DOMINGO.md — «Cantos para este domingo»

> Noviembre de 2026. El cantoral propone una misa entera para el domingo
> (entrada, salmo, aleluya, ofertorio, santo, comunión, salida) con el tiempo
> litúrgico bien puesto, sin repetir siempre las mismas; con un toque pasa a
> «Tu selección» y de ahí al coro. **Solo JS (OTA)**, sin dependencias nuevas.
> Plan y decisiones: [`planes/PLAN_CANTOS_DOMINGO.md`](../planes/PLAN_CANTOS_DOMINGO.md).

## Qué ve la persona

- **Tu selección VACÍA → tarjeta «Este domingo»**
  (`components/playlist/SundayPlanCard.tsx`). Va ahí porque lo primero al
  preparar una misa es vaciar la selección (decisión del usuario, 2026-11-17;
  antes era una fila en la home del cantoral). Enseña el domingo que toca (hoy,
  si es domingo; si no, el siguiente) con su fiesta o tiempo, un punto del color
  litúrgico y el ciclo; **Leer las lecturas** (la hoja de lecturas de ESE
  domingo, sin su lista de cantos) con la cita del evangelio, y los cantos
  propuestos momento a momento con su porqué. **Usar estos cantos** llena la
  selección en orden de misa (10 s de Deshacer); tocar un canto o **Cambiar
  alguno u otro domingo** abre la pantalla completa. Sin cantoral cacheado, solo
  sale la fecha y las lecturas.
- **Tu selección con canciones**: chip **Cantos del domingo** junto a
  «Lecturas del domingo» en la cabecera (`PlaylistDesignTools`).
- **Pantalla** `/cancionero/domingo?fecha=YYYY-MM-DD` (`SundaySongsScreen`):
  cabecera con la fecha, «XXXIV Domingo del Tiempo Ordinario · Jesucristo, Rey
  del Universo · Ciclo A» y ‹ Anterior / Siguiente › para otros domingos. Una
  sección por momento con UNA canción y la razón en pequeño («Cuaresma»).
  - **↻ Cambiar**: la siguiente del ranking (no aleatorio: cambiar y volver es
    predecible). **⋯** (o mantener pulsada la fila): Cambiar, **Elegir otra…**
    (todas las candidatas, con su razón) y **Quitar de la misa** / Volver a
    poner. Tocar la fila abre la canción; deslizar añade a Tu selección.
  - **Pasar a Tu selección**: REEMPLAZA la selección con la misa en orden de
    misa, deja 10 s de **Deshacer** (restaura también el enlace con la nube) y
    vuelve a la Tu selección de debajo (`router.dismissTo`, sin apilar otra).
  - **Subir a <mi coro>** (solo con coro elegido): pasa a Tu selección y abre
    directamente el paso de guardar de la hoja del coro (`?hoja=guardar-coro`).
  - **Volver a la propuesta**: aparece cuando se ha cambiado algo.
- Lo cambiado se recuerda **por fecha en el dispositivo**: volver el sábado
  enseña lo que se dejó el jueves.

- **Inicio, de viernes a domingo**: una tarjeta «Cantos para el domingo · <fiesta
  o tiempo>» (`components/home/SundaySongsCard.tsx`, montada en
  `(inicio)/index.tsx`) que abre la pantalla con `fromOutside` (el cantoral
  queda debajo, para volver). Sale solo si el perfil tiene el tab
  `cancionero` **y** el id `cantos-domingo` en `homeButtons`: así se apaga por
  perfil desde `/profileConfig`. La regla de cuándo sale es pura
  (`shouldShowSundayCard`). **Hay que añadir `cantos-domingo` a los
  `homeButtons` de los perfiles en Firebase** (y al espejo del catálogo del
  panel); el seed y el fallback de la app ya lo traen.

## Cómo decide (puro y determinista)

```
assets/calendario-liturgico.json ─► utils/liturgicalDay.ts ─┐
songs/data + etiquetas ───────────► utils/sundaySongs.ts ◄──┤ constants/massMoments.ts
                                          ▲                  │
                         hooks/useSundaySongs.ts (cantoral cacheado + lo elegido por fecha)
```

### El día — `utils/liturgicalDay.ts`

`liturgicalDayOf(fecha)` → tiempo, fiesta, **número de domingo**, **ciclo** y
color. Lo que el JSON no trae se calcula:

- **Domingo N**: Adviento y Cuaresma por índice; Pascua desde la fecha de
  Pascua (II-VII; Pentecostés y Ramos salen como fiesta); T. Ordinario del
  tramo 1 desde el Bautismo (el domingo siguiente es el II) y del tramo 2
  **hacia atrás desde Cristo Rey = XXXIV**.
- **Ciclo A/B/C por año litúrgico**: el año que abre el 1.er domingo de
  Adviento de Y es el de `(Y + 1) % 3` (1→A, 2→B, 0→C). El campo
  `ciclo_dominical` del JSON va por año CIVIL y está mal desde Adviento (el
  2026-11-29 ya es **B**, el JSON de 2026 dice `A`): **no se lee**.
- **Solemnidades de fecha fija** que pueden caer en domingo (San José,
  San Pedro y San Pablo, Santiago, Transfiguración, Asunción, Exaltación de la
  Cruz, Todos los Santos, Dedicación de Letrán, Inmaculada): añadidas al
  generador (`scraper-lecturas/generador-calendario-liturgico/`) y regenerados
  `calendario-liturgico-completo.json` y la ventana
  (`npm run liturgical:window`). Ejemplo: 2026-11-01 es Todos los Santos.
- `getLiturgicalInfo` (nombre + color del badge de Contigo) vive aquí y
  `LiturgicalBadge.tsx` lo reexporta: Contigo y el cantoral no dicen dos cosas
  distintas del mismo día.

### La misa — `utils/sundaySongs.ts` + `constants/massMoments.ts`

`suggestMass(día, canciones, opts)` → un `MomentSuggestion` por momento. Por
cada uno:

1. **Candidatas**: las canciones de sus categorías (`salmos`, `entrada`…;
   Comunión también `adoracion`) + las de otra categoría con su etiqueta
   (`aclamacion`, `ofertorio`, `comunion`, `envio`, `mariana`).
2. **Filtros duros** (reglas litúrgicas, no puntos; cada una con su test):
   - **Cuaresma y Semana Santa: sin Aleluya.** El momento se llama
     «Aclamación» y solo admite canciones etiquetadas `aclamacion` o del
     tiempo; si no hay, sale vacío («Sin aclamación de Cuaresma en el
     cantoral»). Además, ninguna canción con «aleluya» en el título en
     ningún momento.
   - **Un tiempo fuerte distinto no entra**: una canción marcada con un
     tiempo solo se propone en él (o en su fiesta); una marcada SOLO con una
     fiesta, solo ese día. Las **neutras** (sin tiempo) valen siempre.
   - **Sin repetir** canción en dos momentos de la misma misa.
   - Las de **etiquetas ocultas** se excluyen con
     `settings.hideHiddenTagSongs`, como en las categorías.
3. **Puntos**: etiqueta de la fiesta del día +5 (la fiesta manda sobre el
   tiempo: Pentecostés > Pascua, Cristo Rey > TO), del tiempo +3, neutra 0.
4. **Lecturas del domingo** (2026-11-17): dentro de cada tramo de puntos van
   primero las canciones con **palabras en común con las lecturas** de esa
   fecha, de más a menos afinidad (`readingsAffinity` en `utils/sundayMatch.ts`:
   sin IA; palabras raras en el cantoral pesan más; evangelio ×1,5, salmo ×1,3;
   hacen falta dos palabras en común). El **salmo** se compara primero con el
   salmo del día a solas. La razón sale en la fila («Lecturas: pastor ·
   ovejas»). Las lecturas **no saltan** las reglas duras ni los tramos: una
   canción del tiempo sigue yendo antes que una neutra que encaja con el
   evangelio. Sin lecturas (sin red y sin caché), todo como en el punto 5.
5. **Variedad sin historial y sin red**: el resto del tramo, orden por hash
   estable (canción + momento) **rotado por el número de semana**. Misma fecha
   → misma propuesta **en todos los móviles**; el domingo siguiente, otra del
   mismo tramo; vuelve cuando el tramo da la vuelta.

**Tiempo litúrgico de una canción**: mandan las **etiquetas**
(`SEASON_TAGS` en `massMoments.ts`); el campo antiguo `liturgicalTime` (texto
libre) solo se lee si las etiquetas no dicen nada (sin escribirlo ni migrarlo).

**Sin etiquetas, degrada**: todo neutro, sugiere por rotación. No falla. Para
que la función brille hace falta etiquetar el cantoral (ver pendiente).

### Lo recordado — `hooks/useSundaySongs.ts`

AsyncStorage `@mcm_sunday_songs_v1` = `{ [fecha]: { [momento]: filename |
'quitado' } }`, podado a ±60 días al abrir. Se guarda el **filename** elegido
(no un índice): si cambia el cantoral o una elección previa libera una
canción, la propuesta no se desplaza sola.

## Sin red

| Pieza | Sin red |
| ----- | ------- |
| Día litúrgico, ciclo, domingo N | Siempre (JSON empaquetado) |
| Sugerencias | Sí, si el cantoral se abrió alguna vez (misma caché que las listas) |
| Orden por lecturas | Si esas lecturas se abrieron antes (caché de `useDailyReadings`); si no, solo tiempo litúrgico |
| Lo elegido por fecha | Sí (AsyncStorage) |
| Pasar a Tu selección | Sí |
| Subir a mi coro | No (Firebase; el flujo del coro ya avisa) |

## Mantener

- **Vocabulario de etiquetas**: `SEASON_TAGS` / `MASS_MOMENTS` en
  `constants/massMoments.ts`. Un slug que no esté ahí deja la canción neutra;
  añadirlo no toca la lógica. Pactarlo con el repo del cantoral
  (`mcmapp-cantoral`, editor del admin).
- **Ventana del calendario**: la vigila `__tests__/liturgicalWindow.test.ts`.
- Tests: `liturgicalDay.test.ts`, `sundaySongs.test.ts`,
  `useSundaySongs.test.tsx`, `sundaySongsScreen.test.tsx`,
  `sundayPlanCard.test.tsx`.

## Pendiente (ver el plan)

- **Fase 0**: contar qué etiquetas litúrgicas hay de verdad en `songs/data`
  (sin acceso al repo del cantoral no se ha hecho; si hay menos de ~3 por
  momento y tiempo fuerte, curar en el admin antes de esperar mucho de la
  función).
- **Fase 5**: emparejar el salmo por su estribillo exacto (hoy se compara por
  palabras con el texto del salmo del día).
- **IA (a futuro, sin decidir)**: que un modelo lea las lecturas y elija o
  explique los cantos. Encajaría como una capa más de orden dentro de los
  tramos, sin tocar las reglas duras.
- **Fase 6** (opcional): temas de las lecturas ↔ etiquetas de tema.
