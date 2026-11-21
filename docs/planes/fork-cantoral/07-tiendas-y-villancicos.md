# 07 · Tiendas, calendario y Villancicos Solidarios

> Parte del plan [`README.md`](README.md). La app **sale en modo Navidad** y
> tiene que ser la herramienta de la jornada de Villancicos Solidarios:
> **sábado 19/12/2026, Cuatro Esquinas**, ~8 horas cantando en la calle,
> ~60 canciones en bloques de una hora, **3-4 maestros** pasando canciones y
> mandando avisos, **por la wifi local del router de la mesa de sonido**.
> Esto fija el calendario.

---

## 1. Lo que hay que tener el 19/12

- **App**: catálogo offline, Navidad con subcategorías, bloques del evento,
  modo Navidad, directo por wifi local (con equipo base y relevo) y por la
  nube, avisos, reacciones, pedal/volumen. Si da tiempo: seguir por sección
  y el admin.
- **Repertorio**: la categoría *N. Navidad* del repo del cantoral **hoy está
  vacía** y los bloques de 2025 sin enlazar. Lo meten ellos con los
  importadores del admin (A-04).
- **Router**: configurado según `04` §5.3 y probado en el ensayo.
- **Plan B si la tienda no llega**: ver las canciones en **MCM App**, que
  para entonces debe pintar Navidad con subcategorías (Paquete MCM App,
  documentado en `mcm-app/TODO.md`; D-01). Y la web
  del fork (`mcm-cantoral.expo.app`) para seguir el directo por la nube.

## 2. Calendario

| Semana | App (Claude) | Fuera del código (usuario, Izan) |
| ------ | ------------ | -------------------------------- |
| **S0 · 21-23 nov** | Plan mergeado en `main`. **Maqueta A/B**. **Fase 0**: spike de wifi local el primer día, poda, app a la raíz | **Fork en la cuenta de Izan** (`mcmcantoral`) y darle acceso a Claude. Empezar a importar villancicos |
| **S1 · 24-30 nov** | Fase 0 cerrada → **TestFlight + prueba interna de Play**. **Fase 1** (catálogo, bloques, modo Navidad). Maqueta A/B | Izan mira la maqueta y cierra estilo. Icono en Canva. Fichas de tienda y privacidad |
| **S2 · 1-7 dic** | **Fase 2** con el estilo de Izan. **Fase 3**: protocolo, nube, **wifi local** con equipo base y relevo, pasar el cantoral | Villancicos revisados, bloques 2026 enlazados y publicados |
| **S3 · 8-13 dic** | Fase 3: avisos, reacciones, pedal y volumen, cuenta atrás, resumen, seguir por sección. **Enviar a revisión ~9 dic** | **Ensayo con el router del evento** y 10+ móviles |
| **S4 · 14-18 dic** | Arreglos del ensayo por OTA. Publicar. Modo Navidad encendido. Admin por código si da tiempo | Todo el mundo instala, abre con wifi y prueba «Probar la conexión del coro» |
| **19 dic** | Guardia (OTA de urgencia si hace falta) | 🎄 |
| **Enero** | Fase 5: apuntes, partituras (admin del cantoral primero), analítica, ideas «luego» | — |

## 3. Tiendas

Sin dramas (el usuario: «nos aprobarán, no hay miedo»; la cuenta de Play es
de organización y con MCM App fue bien). Lo que hay que preparar:

- **App Store Connect**: app «MCM Cantoral», bundle
  `com.familiaconsolacion.mcmcantoral`, categoría Música, capturas iPhone
  6,9" e iPad 13", texto y palabras clave, edad, **etiquetas de privacidad**
  (identificador aleatorio de instalación, nombre opcional en el coro; sin
  cuentas ni rastreo; diagnósticos cuando se encienda Sentry).
- **Google Play Console**: app `com.mcmespana.mcmcantoral`, ficha,
  seguridad de los datos, clasificación, público objetivo.
- **Política de privacidad** con URL pública (la de MCM con una sección del
  cantoral).
- **Nota para la revisión de Apple** (por si acaso, cuesta nada): que es la
  herramienta de coros y músicos en directo (wifi local, avisos de los
  maestros, varios maestros, modo villancicos) y MCM App es la app de la
  comunidad. Explicar el permiso de red local («para seguir al maestro por
  la wifi del coro») y el de micrófono (afinador).
- Si hiciera falta antes de la aprobación: TestFlight con enlace público y
  prueba interna de Play para el ensayo.

## 4. Villancicos: qué tiene que estar listo

### 4.1 En la app

- [ ] Cantoral completo **offline** con semilla empaquetada (`02` §3).
- [ ] Categoría Navidad con **subcategorías** y canciones prestadas
      (`alsoIn`) (`02` §4).
- [ ] **Bloques** del evento como repertorios, con tono/cejilla/notas del día
      y pausas (`02` §6).
- [ ] **Modo Navidad**: tarjeta del evento en Inicio, «Unirme al directo»
      en 1 toque, «Probar la conexión del coro» (`02` §7, `03` §4.1).
- [ ] **Directo por wifi local** con **equipo base** y **relevo** entre
      maestros, y **por la nube** en paralelo (`04` §4-§5).
- [ ] **Pasar el cantoral** desde el equipo base a quien lo tenga viejo
      (`04` §5.6).
- [ ] Maestros con **PIN de 4 cifras**, avisos (cinta y destello) con los
      predefinidos de villancicos, reacciones, presencia (`04` §4, §6, §7).
- [ ] Pedal Bluetooth y **botones de volumen** (`04` §8).
- [ ] **Cuenta atrás** al cambio de bloque y **resumen** al acabar
      (`04` §10).
- [ ] Atril legible al sol y de noche, controles de 56 pt (`03`).
- [ ] Web del fork desplegada.
- [ ] Si da tiempo: seguir por sección (`04` §10) y admin por código (`06`).

### 4.2 En el repo del cantoral (usuario, con ayuda de Claude si la quiere)

- [ ] Importar las canciones nuevas (19-66) del Word y revisarlas.
- [ ] Leer con IA las del cantoral de 2008 y revisarlas; «↪ Traer a
      Navidad» las que ya están en el cantoral normal.
- [ ] Subcategoría de cada una.
- [ ] Listado de bloques 2026 (`packs.py importar-listado`) y enlazar.
- [ ] `packs.py publish` + workflow → `songs/packs` (`02` §6).
- [ ] `config/cantoral.json` con el evento (19/12, Cuatro Esquinas, bloques,
      `liveKey`), los avisos predefinidos y `volumeButtons` →
      `songs/cantoralConfig`.
- [ ] `APP_MARKUP = True` cuando MCM App (por OTA, Paquete MCM App) y el fork pinten
      el marcado.

### 4.3 El router (resumen de `04` §5.3)

- Una sola red para todos; si hay 2-3 routers, uno con DHCP y los demás en
  **modo punto de acceso** en la misma red.
- **Sin aislamiento de clientes**; multicast/mDNS permitido.
- DHCP para ~100 dispositivos; 2,4 y 5 GHz.
- Nombre y contraseña de la wifi **impresos** junto al **QR del directo**
  (que lleva también la IP del equipo base).
- El **equipo base** enchufado al lado del router.
- Todo esto, **probado en el ensayo** con el mismo router.

### 4.4 Guion del día

**La víspera**: todo el mundo abre la app con wifi (catálogo al día) y pasa
«Probar la conexión del coro» (así el aviso de red local de iOS sale en
casa). Maestros: móviles cargados, batería externa, el PIN sabido.

**Al llegar**:

1. Encender el router; enchufar el **equipo base** y ponerlo en modo
   «Equipo base» con el directo del evento.
2. Los 3-4 maestros entran con el PIN.
3. La gente se conecta a la wifi y pulsa «Unirme» (o escanea el QR).
   El equipo base enseña cuántos están conectados.

**Durante**:

- Cada hora, un maestro carga el bloque siguiente (1 toque); la cuenta atrás
  avisa del cambio.
- Si se va la luz del equipo base o se apaga: un maestro releva solo; la
  gente sigue sin hacer nada.
- Si alguien pierde la wifi: sigue viendo la última canción y puede abrir el
  bloque a mano (está offline); si tiene datos, se va por la nube.
- Si hay que corregir un acorde: desde el admin del cantoral; llega a todos
  al momento (D-21) por la nube o desde el equipo base.

**Al acabar**: cerrar el directo → resumen (canciones y duración real de cada
bloque) → guardarlo como repertorio «Villancicos 2026».

**Si todo falla**: el admin del cantoral imprime cada bloque como cancionero
con acordes en el tono del día (🖨 Cancionero). Llevar 3-4 copias. Y MCM App
enseña las canciones.

### 4.5 Después del evento

- Retrospectiva corta en este documento: qué se usó, qué falló, qué pedir.
- `cantoralConfig` vuelve sola a `normal` en la fecha `to`.
- Fase 5 en enero.

## 5. Tareas

| # | Tarea | Quién |
| - | ----- | ----- |
| 7.1 | Fichas, capturas, privacidad, nota de revisión | Claude prepara textos y capturas; usuario sube |
| 7.2 | Icono en Canva | Claude propone, Izan y usuario cierran |
| 7.3 | Builds y envío (`npm run eas:build:* -- --profile production`, `eas submit`) | Claude + usuario |
| 7.4 | Importar y revisar villancicos; bloques 2026 | Usuario |
| 7.5 | `packs.py publish`, workflow y `config/cantoral.json` | Claude (repo del cantoral) |
| 7.6 | Configurar el router y ensayo con 10+ móviles | Usuario y coro |
| 7.7 | Guardia del día | Claude disponible para OTA de urgencia |
