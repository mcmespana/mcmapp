# Plan — Panel Pañuelo (concepto, sin plan funcional todavía)

> ⚠️ **Estado: idea anotada, NO ejecutar.** Falta escribir el plan funcional
> completo (mecánica, pantallas, modelo de datos, alcance del 3D). Este
> documento solo captura la idea tal como se dictó, para no perderla, hasta
> que se aborde en serio. Ver `docs/planes/BACKLOG.md` §1 — es uno de los dos
> ítems de cierre de la cola, junto con Carismochito.
>
> Fecha de anotación: 2026-07-22.

## La idea

Un espacio virtual — el **"pañuelo"** — con un **modelo 3D del pañuelo del
MCM**, donde el usuario va colocando **chapas/emblemas virtuales** que obtiene
por **participar en actividades**. Es la versión digital de la tradición
física de coleccionar chapas en el pañuelo de un encuentro/campamento.

Piezas mencionadas (sin definir aún):

- **Modelo 3D del pañuelo** — soporte visual donde se colocan las chapas.
- **Chapas/emblemas virtuales** — se obtienen participando en actividades
  (relación con el sistema de eventos/`activities` existente).
- **Colocación** — el usuario decide dónde poner cada chapa en su pañuelo
  (¿layout libre? ¿posiciones fijas?).

## Relación con Carismochito

Tiene aire de familia con el sistema de colección de Carismochito
(`docs/planes/PLAN_CARISMOCHITO.md` §4: tocar la mascota da +1 a un contador,
requiere login, se guarda en RTDB por usuario). Antes de diseñar el plan
funcional, vale la pena decidir si son sistemas de gamificación **separados**
o si el Pañuelo es una evolución/vitrina del contador de Carismochito.

## Pendiente antes de poder ejecutar

- [ ] Plan funcional completo: qué actividades dan chapas, cuántas, cómo se
      desbloquean, si hay chapas raras/limitadas por evento.
- [ ] Alcance técnico del 3D (¿WebGL en la app? ¿modelo estático con
      posiciones predefinidas y solo cambia qué chapas se muestran?).
- [ ] Decidir si es nativo (mayor fidelidad 3D) o puede hacerse con
      herramientas ya disponibles en el stack (OTA-friendly).
- [ ] Relación de datos con Firebase: ¿nuevo nodo `users/<uid>/panuelo`? ¿se
      deriva de `activities/<evento>/participantes` o de algo nuevo?

No hay nada más que ejecutar aquí todavía — cuando se quiera abordar, este
documento es el punto de partida para escribir el plan funcional real.
