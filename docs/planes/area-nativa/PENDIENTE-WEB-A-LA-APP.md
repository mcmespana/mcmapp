# Lo que hace la web y la app tendrá que hacer también

> Lista viva, nacida el 01/11/2026 con el primer evento «solo 1.º y 2.º ESO de Castellón». La app **no está en producción**:
> aquí solo se apunta. Lo que se hace primero es la web (plugin `comunicaAreaPrivada`); la app lo copia después.
> Prioridad: **A** = antes de abrir la app a familias · **B** = pronto · **C** = cuando toque.

| Prio | Qué | Detalle | Dónde vive en la web |
|---|---|---|---|
| **A** | **Eventos «sí / no»** | Un evento con `ajmcm_modo_respuesta_c = si_no` no se pinta como inscripción: dos botones («Sí, vamos» / «No podemos») y una caja «Comentarios, necesidades, avisos…». Un «no» queda guardado (inscripción con estado `not_participate`), no es lo mismo que no haber contestado. | `pages/single_stic_events.php`, `pages/single_stic_registrations.php`, `inc/stic-registrations.php` |
| **A** | **Aterrizar en la lista de eventos desde el correo** | El correo lleva `…/app/acceso?token=XXX&internalpage=list_stic_events`. La web conserva el destino; la app hoy solo coge el token y entra a la portada. Tiene que pasar `internalpage`, `action`, `id` y `from` (`CONTRATO-APP-WEBVIEW.md` §5). | `inc/stic-app-links.php`, `inc/stic-magic-login.php` |
| **A** | **Familia con varios hijos: «¿A quién quieres apuntar?»** | Con un token de familia que tiene más de un hijo, hay que elegir antes de ver o apuntar, y después ir al destino. | `inc/stic-family.php` (FAM-a1) |
| **A** | **Distinguir «dijo que no» de «se dio de baja» en el contrato** | Hoy el middleware devuelve `dropped` («Baja») y `not_participate` («No participa») como `cancelled` (= no va) para no cambiar el contrato (`comunicaMiddleware: src/app/events.ts`, `NOT_GOING`). Para el evento de sí/no la app tendrá que enseñar «Has dicho que no» y dejar cambiar de idea: hace falta un valor nuevo en `NotGoingStatus` y en el estado de la inscripción (cambio de contrato en el middleware **y** en la copia `services/comunica/contract.ts`). | `comunicaMiddleware: src/contract.ts`, `src/app/reg-status.ts` |
| **B** | **Preguntas del evento** (`ajmcm_pregunta_1_c` / `_2_c` en el evento; la respuesta, en la inscripción) | Opciones obligatorias; se guarda el TEXTO de la opción. Misma pieza que el sí/no cuando el evento las lleva. | `EVENTOS.md` §10.1 |
| **B** | **Audiencia por curso** | El evento restringido por `ajmcm_filtro_edades_c` se comprueba con el perfil activo (el hijo, no la madre), y la ficha explica el motivo en vez de esconderlo. | `EVENTOS.md` §3 |
| **B** | **Token permanente en el enlace del correo** | El token (`ajmcm_pa_token_c`) da sesión de un año; el middleware ya lo canjea (`POST /v1/auth/exchange`). La app tiene que aceptar un enlace con `token` aunque no haya pasado por el flujo del código. | `comunicaMiddleware: src/app/magic.ts` |
| **C** | **Cancelar o modificar una inscripción** y ver «No participa» | Con el nuevo estado, la ficha de la inscripción tiene que saber pintarlo y qué se puede hacer con él. | `EVENTOS.md` §10.3 |

**Estados reales de una inscripción** (Studio, 01/11/2026): `uninvited`, `invited`, `confirmed`, `rejected`, `maybe`, `participates`, `not_participate`,
`dropped` y `waiting_list`. **`cancelled` no existe** en inscripciones: cancelar escribe `dropped` (la app lo hace a través del middleware, que ya está
corregido; no hay nada que cambiar en la app por esto). Los datos de pruebas de la app (`services/comunica/fake/*`) siguen usando `cancelled`; no importa
mientras el contrato no cambie.

Cada vez que la web aprenda algo nuevo de eventos o de acceso, se apunta aquí en la misma sesión.
