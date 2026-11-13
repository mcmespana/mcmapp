# Plan — Pañuelo virtual

> **Estado (2026-11-13): la primera versión está hecha** y escondida en el
> Laboratorio Alpha. Este documento ya no es una propuesta: dice qué se
> decidió, qué está hecho y qué queda, en orden.
>
> Cómo funciona hoy: [`../funcionalidades/PANUELO.md`](../funcionalidades/PANUELO.md).
> Datos y lado del Panel: [`../contratos/PANUELO_CONTRATO.md`](../contratos/PANUELO_CONTRATO.md).

## Lo que pidió el usuario

**2026-09-29.** Un sistema de recompensas por ir a eventos, por usuario:
medallas en 3D que se colocan en el pañuelo, y al tocar una, verla de cerca.
Referencia: los premios de la app Fitness de Apple.

**2026-11-12.** La idea completa: _el pañuelo virtual_. El pañuelo identifica a
quien es del MCM — rojo (etapa infantil), verde (conocimiento), azul
(incorporación y crecimiento) y amarillo (opción responsable) —, y a la gente
le encanta decorarlo. Un modelo 3D «muy guapo» del color que tengas, al que
darle vueltas, con chapas, pines, cintas y otros decorados que se dan **en
digital** por asistir a las actividades («a todos los inscritos en este
evento, os damos…»). Tocar un pin, ver de dónde viene, darle vueltas. Por
ahora, en un menú oculto del canal preview; hay que pensar dónde ponerlo.

**2026-11-13.** Prioridad a lo visual y al diseño. Y dejar puestas las bases
para **intercambiar pulseras y chapas en persona**: le das un código a la otra
persona y hacéis el intercambio.

## Decisiones tomadas (y por qué)

| Decisión                                           | Por qué                                                                                                              |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Visor en un **WebView con three.js**, no `expo-gl` | Un solo código para iOS, Android y web; sale por **OTA**; se prueba en un navegador. Misma decisión que las medallas |
| three.js **empaquetado en la app**, no descargado  | El pañuelo abre sin red, y cada versión de la app lleva su visor                                                     |
| El pañuelo **se calcula**, no hay `.glb`           | Pesa cero, y la fórmula que lo dibuja dice dónde va cosida cada pieza. No hace falta nadie que modele                |
| Las piezas **salen de datos**, no de imágenes      | Una pieza nueva es JSON en el catálogo: sin build, sin OTA, sin diseñador. La imagen propia es opcional              |
| Canje por código **validado en el móvil**          | Trampeable por quien tenga el código, pero es un juego de comunidad. Sale ya, sin servidor                           |
| Un **hook**, no un contexto global                 | Solo lo usa su pantalla: no carga nada al arrancar la app                                                            |
| Interruptor `global.panuelo`, como Carismochito    | Se lanza (o se retira) sin build ni OTA                                                                              |
| Las piezas se **suman** entre móvil y nube         | Lo conseguido no se pierde nunca. El color y la colocación sí son del último que los tocó                            |

## Fases

| Fase | Qué                                                                                                  | Estado                | OTA | Depende de                         |
| ---- | ---------------------------------------------------------------------------------------------------- | --------------------- | --- | ---------------------------------- |
| 0    | Visor 3D: pañuelo en los cuatro colores, girar, acercar, luz, sombras                                | ✅ Hecho (2026-11-13) | ✅  | —                                  |
| 1    | Seis clases de pieza, colección, ficha, verla de cerca, decorar (mover, girar, quitar)               | ✅ Hecho (2026-11-13) | ✅  | —                                  |
| 2    | Conseguir piezas: para todos, por código, repartidas; presentación de la pieza nueva; compartir foto | ✅ Hecho (2026-11-13) | ✅  | —                                  |
| 3    | **Probar en iPhone y Android de verdad** y ajustar (rendimiento, WebView transparente, inclinación)  | ⏳ Siguiente          | ✅  | Un móvil con el canal preview      |
| 4    | **Sacarlo del laboratorio**: avatar en la cabecera de Inicio → «Tu pañuelo»; tarjeta de pieza nueva  | ⏳                    | ✅  | Decisión 1 (abajo) + Fase 3        |
| 5    | **Intercambios** en persona con código: servicio, pantalla, reglas de Firebase                       | 🟡 Base puesta        | ✅  | Sesión iniciada en los dos móviles |
| 6    | **Panel**: editor de piezas con vista previa, código + QR, repartir a una lista, cuántas se han dado | ⏳                    | —   | Repo `mcmpanel` + Integración D    |
| 7    | Canje y reparto **validados en servidor**                                                            | ⏳                    | ✅  | Integración D                      |
| 8    | El color viene de la etapa de la persona en el área privada                                          | ⏳                    | ✅  | Área privada nativa                |
| 9    | Logros calculados (rachas de oración, primera pieza, colección completa…)                            | 💡 Idea               | ✅  | —                                  |

### Fase 3 — qué mirar en el móvil

Solo se ha probado en navegador (el visor suelto y la pantalla entera en web).
Lista de lo que puede fallar en un móvil y no se ve en un navegador:

- **Android: el fondo del WebView.** Tiene que ser transparente
  (`androidLayerType="hardware"`). Si sale blanco, es eso.
- **Rendimiento** con 15-20 piezas en un Android modesto. Si va justo: bajar el
  mapa de sombras (1024 → 512) o el `pixelRatio` (2 → 1,5) en `main.ts`.
- **La inclinación** (`useTilt` en `Panuelo3D.tsx`): que el sentido sea el
  natural y no maree. Los signos están en un solo sitio.
- **El gesto de atrás de iOS** contra girar el pañuelo desde el borde izquierdo.
- **Compartir**: que la hoja del sistema reciba la imagen.
- **La memoria**: abrir y cerrar la pantalla varias veces.

### Fase 4 — sacarlo del laboratorio

La recomendación está razonada en `PANUELO.md` («Dónde debería vivir»):
**no es una pestaña**; es la pantalla de perfil, a la que se entra por el
avatar de la cabecera de Inicio, con una tarjeta en Inicio cuando hay pieza
nueva. La colección de Carismochitos y los Ajustes cuelgan de ahí.

Antes de abrirlo a todos (`global.panuelo = "all"`): importar el catálogo en
Firebase, desplegar las reglas, y tener al menos una pieza de verdad que dar.

### Fase 5 — intercambios

Hecho: las reglas (`utils/panueloTrade.ts`) y el registro de lo que se da
(`gone`). Lo que falta, paso a paso, y la propuesta de reglas de Firebase están
en `PANUELO.md` («Intercambios»). No hay nada a medias en la interfaz: la ficha
solo enseña el chip «Intercambiable».

## Decisiones pendientes — preguntar antes de seguir

1. **¿Dónde vive?** Recomendación: avatar en la cabecera de Inicio → pantalla
   «Tu pañuelo». ¿O una tarjeta en «Más» mientras tanto?
2. **¿Quién elige el color?** Hoy lo elige cada persona en la pantalla. Lo
   suyo es que venga de su etapa (Fase 8); mientras, ¿se deja elegir o se
   pregunta una vez?
3. **El logo del pañuelo rojo**: hace falta el archivo del logo del MIC (hoy
   los cuatro llevan el del COM).
4. **¿Qué piezas se intercambian?** Hoy, solo las pulseras salvo que el
   catálogo diga otra cosa. ¿También las chapas, como en la vida real?
5. **¿Quién crea las piezas** de cada actividad? Con el catálogo en JSON puede
   hacerlo cualquiera con el Panel; sin Panel (Fase 6), hay que pedirlas.
6. **¿Las piezas de muestra se quedan?** El catálogo de hoy es inventado para
   probar. Para el lanzamiento hay que decidir cuáles son de verdad.

## Lo que ya había y se aprovecha

- Las medallas `.glb` del Jubileo y de la visita del Papa (`medallas-3d/`) y su
  visor (`components/medallas/`): ahora son piezas del pañuelo, y su visor es
  el «Verla de cerca».
- El patrón de sincronización de la colección de Carismochitos.
- El escáner de QR y la hoja de código de las playlists, para los intercambios.
