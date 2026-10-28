# 17 — Varias delegaciones (la delegación de trabajo)

> **Estado:** ⬜ sin empezar · **Depende de:** 01, 04, 05, 06 · **Tamaño:** M · **Índice:** [README.md](README.md)
>
> Escrito el 28/10/2026 al revisar el plugin: el `main` del plugin lo resolvió
> el 23/10 (commit `09c3f5e`) y ningún plan del área nativa lo recogía.

## Para qué y para quién

Quien colabora con **otra delegación** además de la suya. El caso real: David
Soler y Jesús Segarra son de Castellón (su ficha) y coordinan Burriana; David
además lleva el COM 1 de Burriana. Con una sola delegación (la de la ficha)
nunca verían Burriana, y peor: coordinar Burriana les haría coordinadores de
Castellón.

## Especificación de origen

Plugin, `docs/comunica/PASAR-LISTA-COORDINACION.md` «Varias delegaciones
(23/10/2026)» y `inc/stic-pasar-lista-crm.php` (`sticpa_pl_home_delegation`,
`sticpa_pl_team_delegations`, `sticpa_pl_delegation`,
`sticpa_pl_set_active_delegation`, `sticpa_pl_rel_en_mi_delegacion`,
`sticpa_pl_follow_group_delegation`). Manda el código.

## Reglas que no se pueden perder

1. **Delegación de la ficha** (`Me.delegation`): la de siempre. Manda en lo
   PERSONAL: a qué eventos puede apuntarse, de quién es su inscripción o su
   pago (planes 11-16). El selector no la toca.
2. **Delegaciones del equipo** (`Me.teamDelegations`): la de la ficha más cada
   una donde tenga una relación **vigente** de monitor, coordinación o
   acompañamiento asignada a ella. Ser participante no cuenta.
3. **Delegación de trabajo**: la de la ficha o la elegida en el **selector**.
   Todo Pasar Lista, Grupos y fichas, Coordinación, reuniones y sesiones
   trabajan con ella: grupos, monitores, eventos y lo que se escribe.
4. El selector **solo sale a quien tiene más de una** y solo acepta una de sus
   delegaciones del equipo. Va atado a la **persona** que ha entrado (una madre
   que mira la ficha de su hija no se lo pasa) y se borra al salir.
5. **La coordinación y el acompañamiento solo valen en su delegación**: en
   Castellón cuentan las relaciones de Castellón y en Burriana las de Burriana
   (`Me.scope` y `Me.roles` son los de la delegación de trabajo). Una relación
   sin delegación cuenta solo en la de la ficha.
6. **Un enlace a un grupo de otra de sus delegaciones** (pasar lista, ficha del
   grupo) se abre en la delegación del grupo: la app cambia el selector.

## Datos: su trozo del contrato

- `Me` gana `teamDelegations: Delegation[]` (la de la ficha la primera).
  `delegation` sigue siendo la de la ficha.
- **Cabecera `X-Comunica-Delegation: <id>`** en toda petición de equipo (04-09).
  El servidor la acepta solo si es una de `teamDelegations`; si no, 403
  `wrong_delegation`. Sin cabecera, la de la ficha. Las rutas de familias
  (`/v1/profiles/:pid/…`, 11-16) la ignoran.
- `GET /v1/me?delegation=<id>` devuelve `roles` y `scope` **de esa delegación**
  (regla 5).
- Las respuestas de un grupo (`/v1/groups/:id/…`, la lista, la ficha del
  grupo) llevan `delegationId`: si no es la de trabajo, la app cambia el
  selector (regla 6). El servidor sirve cualquier grupo de las delegaciones del
  equipo, no solo de la de trabajo.

## Cómo se hace en la app

- **Estado**: la delegación de trabajo vive en `services/comunica/` (como la
  sesión), se guarda en el cajón de la persona (`storage.ts`, no es secreta) y
  se borra con «Salir». `client.ts` pone la cabecera.
- **Claves de consulta**: `areaKey` mete la delegación de trabajo en las claves
  de los bloques de equipo (`['comunica', 'd:<id>', …]`): cambiar de
  delegación no mezcla cachés ni pinta lo de la otra un instante. La caché
  guardada sirve para las dos.
- **La cola**: cada escritura de equipo guarda en su `meta` la delegación con la
  que se hizo y **sube con esa**, aunque luego se cambie el selector (una lista
  de Burriana se escribe en Burriana).
- **Selector**: un `SegmentedControl` («Castellón · Burriana») arriba de «Hoy»,
  Grupos y fichas y Coordinación, solo con más de una. Cambiar → háptico de
  selección, las consultas se piden de nuevo y la portada se recompone.
- **Servidor falso**: una persona de prueba «dos delegaciones» (Villaclara y
  otra inventada, con coordinación solo en la segunda y un grupo propio en
  ella); `wrong_delegation` si la cabecera no es suya.

## Tareas

| # | Tarea | Cómo se comprueba |
|---|---|---|
| 1 | Contrato (`teamDelegations`, `delegationId` en lo de grupo, `wrong_delegation`) y servidor falso con la persona de dos delegaciones | Tests de esquemas y del falso |
| 2 | Estado de la delegación de trabajo, cabecera en el cliente, claves con la delegación, borrado al salir | Unitarios; guardarraíl: una escritura encolada sube con su delegación aunque cambie el selector |
| 3 | Selector en «Hoy», Grupos y fichas y Coordinación | Captura 375 px claro y oscuro con la persona de dos delegaciones |
| 4 | Enlace a un grupo de otra delegación → cambia el selector | Test de `useComunicaLinks` |
| 5 | `COMUNICA_API.md` y `CHANGELOG.md` | Revisión |

## Preguntas abiertas

Ninguna: lo decidió el propietario en el plugin el 23/10/2026.
