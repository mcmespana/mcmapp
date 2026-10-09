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

El backlog dice que «las anchuras máximas y el layout de iPad» no se tocan
(§2.G). Se ha leído como la app en general: las columnas solo existen dentro
de la hoja de la canción. Confirmar.

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
3. **El admin del cantoral (script C) pintando igual que la app**: usar el
   mismo JavaScript de la hoja (`songSheet` + `songSheetLayout`) en su vista
   previa, para maquetar viendo lo que saldrá.
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
- **«Ocultar» etiquetas** no se ha hecho: hoy hay 4 etiquetas y esconder
  canciones de las listas confunde más de lo que ayuda. Si algún día hay
  etiquetas que molesten, es un `hiddenTags` al lado de `featuredTags`.
- **Las 258 canciones repasadas** en `mcmapp-cantoral` (fuera mayúsculas,
  estribillos marcados, muros partidos, notas a `{c:}`, acordes a corchetes),
  verificado palabra a palabra y acorde a acorde. En iPad horizontal caben
  enteras 167 (antes 136). `revisar_cho.py` ya solo avisa de «REVISAR
  ACORDES»; lo dudoso, en `mcmapp-cantoral/docs/REVISION_OIDO.md`.

