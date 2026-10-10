# PLAN_HOJA_CANCION — la mejor hoja de canción para músicos y cantantes

> Estado (2026-10-09): **Fase 1 hecha** en la rama
> `claude/mcm-chord-display-ux-aagafj` (sin PR todavía), pendiente de que el
> usuario la vea en un dispositivo y responda las decisiones de §3. Fases 2 y
> 3 sin empezar. Cómo funciona hoy: [`HOJA_CANCION.md`](../funcionalidades/HOJA_CANCION.md).
> Comparativa con capturas: https://claude.ai/artifact/Dxti1MFr79kxJY8oPmYHUQ

## 1. De dónde sale

El usuario (2026-10-09): unas canciones se ven muy bien y otras agobian; el
salto de línea del arreglo de octubre «me gusta pero regular»; estribillos
marcados que no se separan; numeración «a veces sí y a veces no»; y la
pregunta de fondo: ¿qué es lo mejor para un músico, que no puede subir y bajar
mientras toca? Más una idea: un botón de «canción simplificada» que quite los
estribillos repetidos para que a quien canta le quepa todo.

Diagnóstico (258 `.cho`, pintados con cada versión a 390 px):

- La monoespaciada a 20 px deja ~30 caracteres por renglón en un iPhone y el
  63 % de las líneas miden más (con acordes en español).
- `HtmlDivFormatter` parte de acorde a acorde, no por palabras.
- Los `.cho`: 104 canciones con estrofas en una línea (>70 caracteres), 97 con
  «REVISAR ACORDES» que se veía en la letra, 39 sin `{soc}`, 29 con
  «ESTRIBILLO» escrito como letra, 25 con numeración a mano.

Convención de los músicos con atril (equipos de iglesia y apps como OnSong,
SongbookPro, Planning Center): una canción es una página, cada sección con su
nombre, el estribillo una vez y luego referenciado, columnas en tablet y paso
de página con un toque o un pedal Bluetooth; el scroll automático, en el móvil.

## 2. Fase 1 — hecha (rama `claude/mcm-chord-display-ux-aagafj`)

- Hoja propia sobre el modelo de ChordSheetJS: palabras enteras, secciones,
  etiquetas, revisión fuera de la letra, `{chorus}` y «ESTRIBILLO» como
  referencias, numeración consistente, estribillos sin marcar deducidos.
- Cortes de línea por frase (programación dinámica) y acordes que vuelan.
- Vista completa (músicos, lineal) y compacta (repeticiones plegadas,
  persistente). «Cantante» = compacta + sin acordes.
- iPad: columnas si la canción cabe entera (achicando hasta un 20 %).
- Letra del sistema por defecto, con migración una vez.
- Estribillo: raya amarilla + fondo + etiqueta; sin mayúsculas ni negrita
  forzadas.
- `{arr:}` a la derecha (lo que decía `ARREGLOS.md`; un fallo del CSS los
  dejaba a la izquierda).
- Cantoral: `scripts/revisar_cho.py` (informe de limpieza) y
  `docs/CAMPOS_CANCIONES.md` §4.6 (cómo escribir un `.cho` que se lea bien).

Medido (altura media de una canción en un iPhone): completa 1.688 px (con los
«ESTRIBILLO» ya desplegados), compacta 1.496, cantante 1.115. En iPad
horizontal caben enteras 124 de 258 (completa) y 142 (compacta).

## 3. 🔒 Decisiones del usuario (Fase 1 ya las aplica; cambiar es una línea)

| Decisión                                                | Aplicado | Alternativa                    |
| ------------------------------------------------------- | -------- | ------------------------------ |
| Letra del sistema por defecto, migrando a todos una vez | Sí       | Solo para instalaciones nuevas |
| Estribillo sin mayúsculas forzadas                      | Sí       | Volver a forzarlas             |
| Columnas + letra hasta un 20 % más pequeña en iPad      | Sí       | Solo columnas, sin achicar     |
| Vista compacta global y persistente                     | Sí       | Por canción                    |
| Números de estrofa automáticos desde 2                  | Sí       | Solo los escritos a mano       |
| `{arr:}` a la derecha                                   | Sí       | A la izquierda                 |

**✅ Confirmadas por el usuario el 2026-10-10** («Tus decisiones ok»), también
la lectura de §2.G del backlog: las columnas solo existen dentro de la hoja de
la canción; el layout de iPad de la app no se toca.

## 4. Fase 2 — pendiente

1. **Modo atril** (pantalla completa): páginas en vez de scroll, con las
   columnas de la Fase 1; pasar con un toque en el borde o con un pedal
   Bluetooth (los pedales mandan flechas / AvPág). Para las canciones que no
   caben en una pantalla de iPad.
2. **Mapa de la canción** opcional arriba («1 · E · 2 · E · 3 · E×2»), que se
   saca del modelo sin tocar los `.cho`.
3. **PDF de la playlist** con la hoja nueva (hoy sigue con
   `HtmlDivFormatter`).
4. **Pantalla completa en web**: mete el HTML con `innerHTML`, que no ejecuta
   el script de maquetación ni respeta las clases del `<body>`. Pasarla a
   `iframe srcDoc` como `SongDisplay`.

## 5. Fase 3 — limpieza de los `.cho` (repo `mcmapp-cantoral`)

Guía: `docs/CAMPOS_CANCIONES.md` §4.6. Lista: `python scripts/revisar_cho.py`.
Orden: estrofas en una línea (104) → revisar acordes (97) → `{soc}` que faltan
(39) → «ESTRIBILLO» a `{chorus}` (29) → quitar numeración a mano (25) → intros
en comentario a líneas de acordes (9) → muros de texto (8). Pasar los
estribillos a minúscula depende de la decisión de §3.

## 6. Segunda vuelta (2026-10-09, misma rama)

Respuestas del usuario: la letra del sistema, **aceptada** («pero que se vea
bien»); columnas en iPad, **sí**, y con los estribillos plegados cuando todo
está a la vista; modo atril, **sí**; numeración, **que se vea siempre igual**.

Hecho: interlineado con significado (renglón partido / línea / línea en
blanco / dos o más), unión de líneas partidas de PDF, numeración continua,
variantes del estribillo elegibles en «Letra y vista», «más aire», plegado
automático en columnas, aviso de girar, modo atril con pedal.

~~Pendiente del usuario: elegir la variante de estribillo de serie~~ →
**«Negrita» (raya + negrita)**, decidido el 2026-10-10.

## 7. Apuntado para pronto

1. ✅ **Onboarding del cantoral** — hecho (§9).
2. ✅ **Limpieza de los `.cho`** — hecha (§9).
3. ✅ **El admin del cantoral (script C) pintando igual que la app** — hecho
   (§10).
4. Probar el pedal Bluetooth en un iPad de verdad (en navegador funciona).

## 8. Fase 3 — limpieza mecánica hecha (2026-10-09)

En `mcmapp-cantoral`, rama `claude/mcm-chord-display-ux-aagafj`:
`scripts/arreglar_cho.py` (con tests) pasó por las 258 canciones y tocó 137
sin cambiar ni una palabra ni un acorde (comprobado): «ESTRIBILLO» →
`{chorus}`, fuera la numeración a mano, intros en comentario → líneas de
acordes, estrofas de PDF unidas y líneas largas partidas por frases (de 104
canciones con líneas de más de 70 caracteres a 34). «Siempre imaginé»,
reordenada a mano.

Queda para una persona (`revisar_cho.py` lo lista): revisar acordes (97),
estribillos sin marcar (38), muros de texto (8) y las mayúsculas, que
dependen del estilo de estribillo que elija el usuario.

## 9. Tercera vuelta (2026-10-10)

- **Estribillo raya + negrita** de serie (`chorusStyle: 'negrita'`, primera
  de `CHORUS_STYLES`).
- **Onboarding del cantoral** (`components/song-onboarding/`,
  `utils/cantoralOnboarding.ts`): se abre solo la primera vez y con el «?»
  del header. ¿Tocas o cantas? (+ DO RE MI / C D E), completa o compacta,
  estilo del estribillo (+ etiqueta), letra (+ números, más aire) y, si hay
  etiquetas, las que se quieren «a mano» arriba del cantoral
  (`featuredTags`). Cada opción se ve al momento sobre una canción de verdad,
  que baja sola a la parte que cambia; se cierra en cualquier paso y lo
  tocado se queda.
- **«Ocultar» etiquetas**: ya existía (rama de pulido); el 2026-10-10 se le
  añade esconder también sus canciones (§11).
- **Las 258 canciones repasadas** en `mcmapp-cantoral` (fuera mayúsculas,
  estribillos marcados, muros partidos, notas a `{c:}`, acordes a corchetes),
  verificado palabra a palabra y acorde a acorde. En iPad horizontal caben
  enteras 167 (antes 136). `revisar_cho.py` ya solo avisa de «REVISAR
  ACORDES»; lo dudoso, en `mcmapp-cantoral/docs/REVISION_OIDO.md`.

## 10. El admin pinta como la app (2026-10-10)

`mcm-sheet.js` (la hoja empaquetada con esbuild desde
`utils/songDocumentBundle.ts`) en `mcmapp-cantoral/scripts/admin/static/`:
pestaña 👁 Preview con móvil / iPad ⬌ / iPad ⬍ a tamaño real, acordes,
completa/compacta, notación, estilo del estribillo y oscuro; el móvil al lado
del editor Raw; y la misma vista al añadir canción y al importar de
doceacordes. Detalle en `HOJA_CANCION.md` («El admin del cantoral pinta
igual»).

## 11. Cuarta vuelta (2026-10-10, tarde)

- **Pantalla completa** rehecha: entra con el tono y la cejilla que tenías,
  pasa de canción sin salir (‹ ›, deslizar, flechas, pedal al acabar la
  última página), sigue al coro, botón ⛶ en la cabecera y en web un iframe
  con la maquetación de verdad. Detalle en `HOJA_CANCION.md`.
- **Etiquetas**: esconder también las canciones de las etiquetas ocultas
  (para quien no quiere las de otro carisma) y ★ «a mano», que salen
  discretas en las filas. Lo explica el onboarding. Detalle en
  `ETIQUETAS.md` §3.2.
- **Repaso de etiquetas** propuesto en un artefacto interactivo para que el
  usuario diga sí / no a cada una; lo que apruebe se escribe en los `.cho`.

Orden de lo que queda:

1. ✅ Editor visual del admin con el móvil al lado y el estribillo / intro
   como en la app (`HOJA_CANCION.md`, «El admin del cantoral pinta igual»).
2. ✅ PDF de la playlist con la hoja nueva, sin estrofas partidas entre
   páginas, con estribillos plegados y dos columnas opcionales
   (`HOJA_CANCION.md`, «PDF de la playlist»).
3. Aplicar las etiquetas aprobadas en el repaso (espera a que el usuario
   vote en el artefacto).
4. Mapa de la canción («1 · E · 2 · E · 3 · E×2»), opcional.
5. Probar el pedal Bluetooth en un iPad de verdad.
