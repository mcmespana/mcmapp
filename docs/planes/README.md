# Planes — qué está vivo y qué está hecho

> **Lee esto antes de abrir ningún `PLAN_*.md`.** Su único trabajo es que no
> vuelvas a ejecutar algo que ya está hecho.
>
> Última actualización: 2026-09-02.

## La regla, en una línea

**Lo que está en `archivo/` está HECHO o ANULADO. No se re-ejecuta. Nunca.**
Lo que está suelto en `docs/planes/` es lo único que puede seguir vivo — y de
esos, el estado real lo manda [`BACKLOG.md`](BACKLOG.md), no la cabecera de
cada plan.

Esto no es celo burocrático: **ya pasó**. En agosto de 2026 dos sesiones
ejecutaron en paralelo los mismos 15 planes de auditoría porque el índice
seguía diciendo TODO mucho después de que todo estuviera en `main`; hubo que
tirar una rama entera ([#319](https://github.com/mcmespana/mcmapp/pull/319)).
El coste de mantener esta tabla al día es mucho menor que el de repetirlo.

---

## 🟢 Vivos — pueden ejecutarse

| Plan                                             | Estado real                                                                                                                                                                                    | Dónde manda el orden                                  |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| [`PLAN_UI_NATIVA.md`](PLAN_UI_NATIVA.md)         | 🟡 En curso — Fase 1 ✅, Fase 2 ~65-70%                                                                                                                                                        | `BACKLOG.md` §1 fila 4                                |
| [`PLAN_INTEGRACIONES.md`](PLAN_INTEGRACIONES.md) | 🟡 Solo queda **Integración D** (reglas Firebase). A, B, C, E cerrados el 2026-08-12                                                                                                           | `BACKLOG.md` §1 fila 5 — 🔒 bloqueado por decisión D2 |
| [`PLAN_CALIDAD.md`](PLAN_CALIDAD.md)             | 🟡 Parcial — Fase 0 (guardarraíles) ✅. **Fase 1 (trocear gigantes) descartada por decisión del usuario** el 2026-08-15, ver abajo                                                             | `BACKLOG.md` §2.A                                     |
| [`PLAN_CARISMOCHITO.md`](PLAN_CARISMOCHITO.md)   | ⏳ Sin empezar (§1–4)                                                                                                                                                                          | `BACKLOG.md` §1 fila 7                                |
| [`PLAN_DISENO.md`](PLAN_DISENO.md)               | 🟡 En curso — dos pasadas hechas (tokens, tipografía, radios, sombras, responsive, panel) + 3 bugs de contraste arreglados. Lo que queda necesita **dispositivo** o revisión fichero a fichero | `BACKLOG.md` §2.G                                     |

## 🔵 Futuro lejano — no se tocan hasta que el usuario lo pida

Decidido el 2026-08-15: **no hay prisa, ya se hará**. No entran en "seguimos",
no entran en la bolsa oportunista, y no hace falta preguntar por ellos.

| Plan                                               | Por qué espera                                                    |
| -------------------------------------------------- | ----------------------------------------------------------------- |
| [`PLAN_WIDGET_CONTIGO.md`](PLAN_WIDGET_CONTIGO.md) | Feature entera + build de tienda dedicada (WidgetKit + App Group) |
| [`PLAN_PANEL_PANUELO.md`](PLAN_PANEL_PANUELO.md)   | Stub: todavía no hay plan funcional que ejecutar                  |

## 🗄️ Archivados — HECHOS o ANULADOS, no re-ejecutar

| Qué                                                                 | Cuántos            | Estado                                                                                                                                                                                                 |
| ------------------------------------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [`archivo/auditoria-2026-08/`](archivo/auditoria-2026-08/README.md) | 15 planes          | ✅ Todos hechos, en `main` vía [#317](https://github.com/mcmespana/mcmapp/pull/317) y [#320](https://github.com/mcmespana/mcmapp/pull/320)                                                             |
| [`archivo/tacticos/`](archivo/tacticos/README.md)                   | 8 planes (001–008) | ✅ Hechos, salvo el **007** ❌ **ANULADO** (decisión de producto: el panel SÍ debe ver las respuestas)                                                                                                 |
| [`archivo/PLAN_TAGS.md`](archivo/PLAN_TAGS.md)                      | 1 plan             | ✅ Completo — app (2026-08-13) + generador de `mcmapp-cantoral` (2026-08-15). Doc viva: [`ETIQUETAS.md`](../funcionalidades/ETIQUETAS.md)                                                              |
| [`archivo/MEJORAS.md`](archivo/MEJORAS.md)                          | —                  | 🗄️ Foto de un análisis de mayo 2026, ya repartido en otros documentos                                                                                                                                  |
| [`archivo/ANIMACIONES.md`](archivo/ANIMACIONES.md)                  | —                  | ✅ Auditoría de animaciones contra la skill `animate-expo` (2026-08-19), aplicada. Se queda como el **por qué** el `BottomSheet` sigue con `PanResponder`; los 3 pendientes están en `mcm-app/TODO.md` |

---

## Plan ejecutado ≠ plan archivado

Cuando termines un plan, **muévelo a `archivo/`** en el mismo commit que cierra
el trabajo. Dejarlo en su sitio con una cabecera que diga "✅ hecho" no basta:
nadie lee la cabecera antes de abrir el archivo, y el siguiente agente lo ve en
la lista de planes vivos y lo ejecuta otra vez.

Al archivar, actualiza en el mismo commit:

1. Este README (mueve la fila de 🟢 a 🗄️).
2. La fila correspondiente de [`BACKLOG.md`](BACKLOG.md).
3. El índice de [`docs/README.md`](../README.md).
4. `mcm-app/CHANGELOG.md`, si hubo cambio de código real.

## Dónde vive la documentación _viva_ de una funcionalidad

Un plan describe **lo que se iba a hacer**; se archiva al terminar. Lo que la
funcionalidad **es hoy** se documenta en
[`docs/funcionalidades/`](../funcionalidades/), y eso sí se mantiene al día.
Si buscas cómo funciona algo, empieza siempre por ahí — no por un plan.
