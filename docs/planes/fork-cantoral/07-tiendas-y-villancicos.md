# 07 · Tiendas, calendario y Villancicos Solidarios

> Parte del plan [`README.md`](README.md). La app **sale en modo Navidad** y
> tiene que ser la herramienta de la jornada de Villancicos Solidarios: ~8
> horas cantando en la calle, ~60 canciones en bloques de una hora, 1-3
> maestros pasando canciones y mandando avisos. **Esto fija el calendario.**

---

## 1. La fecha manda (y está muy cerca)

Hoy es **sábado 21/11/2026**. La edición de 2025 fue el sábado 20/12/2025
(Edificio Hucha). Si la de 2026 es el **sábado 19/12/2026** (por confirmar,
D-01), quedan **4 semanas**, y en ellas caben la app, la revisión de las
tiendas y **meter el repertorio de villancicos, que hoy no está**:

- La categoría **N. Navidad del repo del cantoral está vacía** (0 `.cho`).
- Los 11 bloques de 2025 (`packs/hucha-2025-*.json`) tienen **todas las
  canciones sin enlazar** (`"song": null`), precisamente porque no existen.
- El importador del Word (canciones nuevas 19-66) y el lector con IA del
  cantoral de 2008 (28 páginas) **ya están hechos** en el admin del cantoral
  (`mcmapp-cantoral/docs/VILLANCICOS_SOLIDARIOS.md`). Falta usarlos y revisar
  ~85 canciones.

**El repertorio es ruta crítica igual que la app.** Sin canciones, el mejor
directo del mundo no sirve.

## 2. Calendario propuesto (si el evento es el 19/12)

| Semana | App (Claude) | Contenido y tiendas (usuario, con ayuda) |
| ------ | ------------ | ---------------------------------------- |
| **S0 · 21-23 nov** | Arreglos pre-fork en MCM App (bugs + Fase 1 de Navidad, D-02). Crear repo (usuario) y **Fase 0** | Contestar decisiones. Empezar a importar villancicos en el admin |
| **S1 · 24-30 nov** | Fase 0 cerrada → **TestFlight + prueba interna de Play** con el nombre nuevo. **Fase 1** (catálogo offline, bloques, modo Navidad). Maqueta de diseño (A/B) | Fichas de las tiendas, política de privacidad, icono. Importar + revisar villancicos. Listado de bloques 2026 |
| **S2 · 1-7 dic** | **Fase 2** núcleo (Inicio, Atril, Repertorio, iPad) y **Fase 3** directo por la nube (protocolo, maestro, seguidor) | Enlazar bloques, tono/cejilla del día, `packs.py publish` |
| **S3 · 8-13 dic** | Fase 3: avisos, reacciones, presencia, pedal. **Enviar a revisión ~10 dic**. **Ensayo general** con 10+ móviles el fin de semana 12-13 dic | Ensayo con el coro de verdad, en la calle si se puede |
| **S4 · 14-18 dic** | Arreglos del ensayo por OTA. Publicar. Activar `cantoralConfig` Navidad | Todo el mundo instala y abre la app con wifi (catálogo al día) |
| **19 dic** | Guardia el día del evento | 🎄 |
| **Enero** | **Fase 5**: wifi local, apuntes, partituras, admin por código | — |

Si la fecha es otra, se corre la tabla; lo que no se mueve es el orden.

## 3. Tiendas

### 3.1 Lo que hay que preparar (no es código)

- **App Store Connect**: app nueva «MCM Cantoral» (comprobar que el nombre
  está libre), bundle `com.familiaconsolacion.mcmcantoral`, categoría
  Música, capturas iPhone 6,9" y iPad 13", texto, palabras clave, edad,
  **etiquetas de privacidad** (identificador aleatorio de dispositivo,
  nombre opcional en el coro, diagnósticos de Sentry; sin cuentas ni
  rastreo).
- **Google Play Console**: app nueva `com.mcmespana.mcmcantoral`, ficha,
  **seguridad de los datos**, clasificación de contenido, público objetivo.
- **Política de privacidad**: la de MCM adaptada (o una sección de
  cantoral), con URL pública.
- **Icono** y nombre corto (D-06).

### 3.2 Riesgos y cómo se esquivan

| Riesgo | Mitigación |
| ------ | ---------- |
| **Apple 4.3 (apps duplicadas)**: es una segunda app del mismo desarrollador con algo que la primera ya hace (el cantoral) | Que **no sea una copia**: el directo con avisos y varios maestros, el modo villancicos, la wifi local, los apuntes… son funciones que MCM App no tiene. Nota a la revisión explicándolo («herramienta para coros y músicos en directo; MCM App es la app de la comunidad») y capturas que lo enseñen. Sin login no hay pantalla de cuentas que revisar |
| **Apple 4.2 (funcionalidad mínima)** | No aplica si el directo y el offline están; por eso no se envía la Fase 0 a revisión pública, solo a TestFlight |
| **Google: 12 probadores durante 14 días** antes de producción | Aplica a **cuentas personales creadas después del 13/11/2023**, y según guías de terceros, a **cada app nueva** de esa cuenta aunque ya tenga otras publicadas. Las cuentas de **organización** (con D-U-N-S) quedan fuera (aclaración A-02). Si aplica, hay que abrir la prueba cerrada en S1 sin falta: 14 días desde el 25/11 llegan justo al 9/12 |
| **Revisión lenta o rechazo justo antes** | **Plan B**: TestFlight con **enlace público** (necesita una revisión beta, normalmente ~1 día) y prueba interna/cerrada de Play. **Plan C**: la **web** del fork (seguir el directo desde el navegador, sin instalar) |
| **Conflicto de enlaces con MCM App** | Dominio propio; el escáner del fork entiende también los QR de MCM App (`01` §2.1) |

## 4. Villancicos: qué tiene que estar listo

### 4.1 En la app (mínimo para el evento)

- [ ] Cantoral completo **offline** con semilla empaquetada (`02` §3).
- [ ] Categoría Navidad con **subcategorías** y canciones prestadas
      (`alsoIn`) (`02` §4).
- [ ] **Bloques** del evento como repertorios, con tono/cejilla/notas del día
      y pausas (`02` §6).
- [ ] **Modo Navidad**: tarjeta del evento en Inicio, «Unirme al directo»
      en 1 toque (`02` §7, `03` §4.1).
- [ ] **Directo por la nube**: varios maestros con PIN, seguir en 0 toques,
      avisos (cinta y destello) con los predefinidos de villancicos,
      reacciones, presencia (`04` §4, §6, §7).
- [ ] Atril legible al sol y de noche, controles de 56 pt (`03`).
- [ ] Pedal Bluetooth probado si algún maestro lo va a usar (`04` §8).
- [ ] Web del fork desplegada (plan C).

**No hace falta para el evento**: wifi local, apuntes, partituras, admin por
código, editor. (Salvo que D-07 adelante la wifi local.)

### 4.2 En el repo del cantoral

- [ ] Importar las canciones nuevas (19-66) del Word y revisarlas (avisos ⚠,
      acordes en su sílaba, estribillos, cursivas = 2ª voz).
- [ ] Leer con IA las del cantoral de 2008 y revisarlas; «↪ Traer a
      Navidad» las que ya están en el cantoral normal.
- [ ] Subcategoría de cada una.
- [ ] Listado de bloques 2026 (`packs.py importar-listado`) y enlazar.
- [ ] `packs.py publish` + workflow → `songs/packs` (`02` §6).
- [ ] `config/cantoral.json` con el evento y los avisos → `songs/cantoralConfig`.
- [ ] `APP_MARKUP = True` **solo** cuando MCM App pinte el marcado en
      producción (si no, dejarlo en `False` para el evento: se pierde la
      cursiva de la 2ª voz, nada más).

### 4.3 Guion del día

**La víspera**: todo el mundo abre la app con wifi (catálogo al día) y
comprueba que ve Navidad y los bloques. Maestros: móviles cargados, batería
externa, PIN del directo apuntado, y probado el directo entre ellos.

**Durante**:

1. Un maestro abre el directo del evento (clave fija en
   `cantoralConfig.event.liveKey`); los otros entran con el PIN.
2. La gente pulsa «Unirme» en la tarjeta del evento.
3. Cada hora, el maestro carga el bloque siguiente en el directo (1 toque) y
   lo anuncia con «Cambio de bloque».
4. Si alguien pierde la conexión: sigue viendo la última canción y puede
   abrir el bloque a mano (está offline). Al volver la red se pone al día
   solo.

**Si todo falla**: el admin del cantoral ya imprime cada bloque como
cancionero con acordes en el tono del día (🖨 Cancionero). Llevar 3-4 copias
en papel.

### 4.4 Después del evento

- Mirar Sentry y lo que haya fallado; apuntarlo en el plan.
- `cantoralConfig` vuelve sola a `normal` el `to` configurado.
- Retrospectiva corta en este documento: qué se usó, qué no, qué pedir.

## 5. Tareas

| # | Tarea | Quién |
| - | ----- | ----- |
| 7.1 | Fichas, capturas, privacidad, icono | Usuario (Claude prepara textos y capturas) |
| 7.2 | Builds y envío (`npm run eas:build:* -- --profile production`, `eas submit`) | Claude + usuario |
| 7.3 | Importar y revisar villancicos | Usuario con el admin (Claude puede ayudar en el repo del cantoral) |
| 7.4 | Bloques 2026 + publicar | Usuario + Claude (script) |
| 7.5 | Ensayo general y lista de fallos | Usuario y coro |
| 7.6 | Guardia del día | Claude disponible para OTA de urgencia |
