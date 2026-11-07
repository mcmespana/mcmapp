# Modo Carismochito

> Documento **vivo**: describe cómo funciona hoy. El plan que lo construyó está
> archivado en [`../planes/archivo/PLAN_CARISMOCHITO.md`](../planes/archivo/PLAN_CARISMOCHITO.md).

## El modo

> **Hoy está cerrado para todo el mundo** (ver «El interruptor» más abajo): lo
> que sigue describe cómo funciona cuando está abierto.

- **Se activa agitando el móvil 5 veces** → cuenta atrás de 3 s → la app se
  tiñe de verde, confeti, y el icono del launcher cambia (esto último, desde la
  build de tienda 2.1). Se recuerda al reabrir la app.
- La primera vez sale una **explicación** del modo; después se reabre tocando el
  aviso flotante o el **logo verde de Inicio** (con el modo puesto, el logo de
  la cabecera pasa a ser un botón).
- **Para salir**: un par de sacudidas fuertes (con 3 s de margen entre una y
  otra) → pide confirmación; o «Salir del modo» en la explicación, para quien
  no puede agitar el móvil (p. ej. con el iPad sobre el atril). Al salir, el
  icono del launcher vuelve al normal también en Android.
- Mientras está activo, **Carismochito se asoma por los bordes** de vez en
  cuando (cada 45-90 s), menos en pantallas de lectura y presentación:
  evangelio, oración, Revisión, la hoja de canción, canción a pantalla
  completa, materiales y profundiza (`hooks/useSuppressCarismochito.ts`, que va
  por foco de pantalla). En esas pantallas el acelerómetro **también se
  pausa**: agitar el móvil mientras se lee o se canta no activa ni apaga el
  modo.

Código: `contexts/CarismochitoContext.tsx` (la máquina de estados),
`components/CarismochitoOverlay.tsx` (cuenta atrás, confeti, asomadas),
`components/CarismochitoDialogs.tsx`, `components/CarismochitoMascot.tsx`.

## El interruptor (cerrado por defecto) — decisión del 2026-11-06

Carismochito **está bloqueado para todo el mundo** hasta el **25.º aniversario
(2027)**, que es cuando se quiere lanzar. No es un modo escondido: es una
función completa (modo de agitar, caza y colección) con un interruptor general
que se abre o se cierra **sin build ni OTA**.

El interruptor es `global.carismochito` en `/profileConfig`
(contrato: `docs/contratos/PANEL_PERFILES.md` §1.10; lógica pura en
`utils/carismochitoGate.ts`, hook en `hooks/useCarismochitoAvailable.ts`):

| Valor | Modo normal | Laboratorio Alpha encendido |
| --- | --- | --- |
| `"off"` | Cerrado | Cerrado |
| `"alpha"` (o ausente) | **Cerrado** | **Abierto** |
| `"all"` | Abierto | Abierto |

- **Para cerrarlo a todo el mundo ahora**: dejarlo en `"alpha"` (o ausente) —
  que es el estado normal— y no abrir nadie el Laboratorio. `"off"` lo cierra
  también para los probadores.
- **Para lanzarlo en 2027**: poner `global.carismochito = "all"` en Firebase
  (`profileConfig/data/global`). Un solo cambio, sin build. Para volver atrás,
  `"alpha"` u `"off"`.
- **Cerrado = no existe**: agitar no hace nada, el logo de Inicio no es un
  botón, no se asoma, la colección redirige a Inicio. Y **se apaga a quien lo
  tuviera activo**: al detectar el interruptor cerrado (ya con la configuración
  y el modo tester leídos; antes no se toca nada) se resetea el modo EN
  SILENCIO (sin háptica ni diálogos), se quita el tema verde y se devuelve el
  icono del launcher al normal.
- **En el canal preview**, con el modo tester encendido, todo está disponible
  con `"alpha"`: **sin toques escondidos** (se retiró el de 5 toques en el título
  del laboratorio y el interruptor propio de la caza). Dentro del Laboratorio
  Alpha, el panel «Caza de Carismochitos» sale solo y ofrece ver la colección,
  hacerlo aparecer ya y empezar de cero.

### Qué incluye (todo junto, sin partes ocultas)

- Modo de agitar 5 veces, cuenta atrás, tema verde, icono del launcher.
- La **caza**: se asoma más a menudo (20-45 s) y más rato (3 s), en **8
  variantes** sorteadas por peso — común (clásico, de campo), poco común
  (celeste, MIC, COM), raro (LC, nocturno) y legendario (dorado). **Tocarlo lo
  atrapa**: vibración, animación de salida y un toast.
- La **colección** (`app/carismochito.tsx`): anillo de progreso, contador y una
  ficha por variante (silueta mientras no la has encontrado). Redirige a Inicio
  si el interruptor está cerrado.

## Plan para 2027 (25.º aniversario)

Pendiente de definir con Izan — esto es el esqueleto para no perder el hilo:

1. **Abrir el interruptor** (`"all"`) coincidiendo con la fecha del
   aniversario. Antes, probarlo en alpha con los probadores.
2. **Dónde se enlaza la colección** para todo el mundo. Hoy solo se llega desde
   el panel del Laboratorio o, con el modo activo, desde la explicación del
   modo. Propuesta anterior: tocar el logo verde de Inicio. Falta decidirlo.
3. **Dónde vivirá a la larga**: la idea es una vista de perfil con logros,
   chapas y Carismochitos — ver `docs/planes/PLAN_PANEL_PANUELO.md`.
4. **Medallas 3D** (hoy un experimento en el Laboratorio): se dejan como están
   «por ahora», pero **hay que hacerlas** — está anotado en
   `docs/planes/BACKLOG.md`.
5. Revisar si hace falta build nativo (iconos del launcher, p. ej.) con
   antelación a la fecha: el icono alternativo solo existe desde la build 2.1.

### Datos

```
AsyncStorage  @carismochito_collection     { <variantId>: { count, firstAt } }
RTDB          users/{uid}/carismochitos/{variantId} = { count, firstAt }
```

- Sin sesión se guarda solo en el móvil (la pantalla lo avisa).
- Con sesión se fusiona con la nube por el **máximo** de cada variante (no la
  suma: abrir la app no duplica). Lo que el móvil lleve de más se sube.
- La regla de RTDB que lo cubre es la de `users/$uid` (solo el dueño).
- **Los `id` de variante son contrato** (`utils/carismochitoCollection.ts`): se
  pueden añadir variantes o cambiar pesos y nombres, pero no renombrar ni
  reutilizar un `id`.

Código: `utils/carismochitoCollection.ts` (puro: catálogo, sorteo, fusión),
`contexts/CarismochitoHuntContext.tsx`, `components/preview-channel/CarismochitoLabPanel.tsx`,
paletas en `constants/colors.ts` (`CarismochitoPalettes`).

Analítica: `carismochito_activado` y `carismochito_atrapado { rareza, nuevo }`.

## Lo que queda por decidir

- La fecha exacta de apertura en 2027 y dónde se enlaza la colección (ver «Plan
  para 2027» arriba y `docs/planes/BACKLOG.md`).
- Si el interruptor se enseña algún día en el Panel (mcmpanel) en vez de
  cambiarlo a mano en la consola de Firebase.
