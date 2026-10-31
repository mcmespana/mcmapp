# Revisión A — capa no visual (24/10/2026)

Tests que reproducen 1, 3 y 4: /tmp/claude-0/-home-user/61d40735-69b8-5919-8ca5-f89127f461eb/scratchpad/review-a/__tests__/ (outboxLeak.test.ts, intentOrder.test.ts).

ALTA
1. La cola sobrevive a «Salir»/cambio de persona — ComunicaAreaProvider.tsx:189-284, outbox.ts:399, :365/:408. La cola se crea en un useMemo sin teardown; reintentos programados (setTimeout) y envíos en vuelo siguen. Tras salir, changed() reescribe @comunica/A/outbox y re-registra A en @comunica/people; si entra B, getComunicaApi() usa el token de B → la lista de A se sube como B. Arreglo: outbox.dispose() (cancela timers, flag disposed que impide envíos y escrituras), llamarlo en el cleanup del efecto; en signOut, endSession + dispose antes de clearAll.
2. Abrir un enlace de otra persona borra en silencio las listas sin subir — useComunicaLinks.ts:320-334: signOut() sin mirar la cola (plan 02 exige avisar si hay cola); además en web `confirm` se acepta solo (:273). Arreglo: si hay pendientes, intentar subir o avisar antes; no autoaceptar en web.

MEDIA
3. Un rechazo definitivo se reenvía en cada arranque — outbox.ts:404, :415-419: nextAttemptAt = Infinity se serializa a null y `null <= t` es true. Arreglo: decidir por error.auto / sanear en load().
4. Token de un enlace queda sin caducidad en el hueco del legado — +native-intent.ts:157-171 vs useComunicaLinks.ts:292: con la app abierta, setPendingNativeLink invoca el manejador en el acto, que vacía el hueco legado ANTES de que +native-intent lo rellene → `…?token=…&app=1` queda en memoria; ComunicaScreen lo recoge luego y entra como esa persona. Arreglo: rellenar legado antes que nativo (o vaciar después) + caducidad como pendingLink.ts.
5. Con el servidor falso, la sesión guardada no sobrevive a reiniciar — session.ts:9-11, index.ts:95 (refresh del falso en memoria → en frío fr-N-… desconocido → revocada → pantalla de acceso cada vez). Arreglo: el falso acepta sus tokens por forma `fr-\d+-<persona>` tras reinicio, o quitar la promesa del comentario.
6. Guardarraíl de salud que no puede fallar — persistence.test.ts:15-36 usa su propio QueryClient con meta.persist a mano; quitar persist:false de useHealth/usePersonal (useGrupos.ts:102/115) no lo rompe. ROUTES.persist solo lo leen tests. Arreglo: useAreaQuery recibe `route` y saca persist de ROUTES (o dehydrateArea excluye claves health/personal) + test con hooks reales y contenido del almacén.
7. Token de acceso a cualquier dominio de foto — client.ts:581-591, photos.ts:109: Authorization se añade a cualquier photoUrl. Arreglo: cabecera solo si la URL empieza por baseUrl; https en el contrato.
8. Toda la caché en un único JSON de AsyncStorage — storage.ts:208-218, ComunicaAreaProvider.tsx:177: prefetchMyFichas lo hincha; en Android >~2 MB por fila falla (CursorWindow) → readDrawer null → se pierde la caché offline; `void writeDrawer` deja promesas rechazadas. Arreglo: clave por consulta (o sqlite), capturar error y vigilar tamaño.
9. Enlace a una actividad abre el portal entero — useComunicaLinks.ts:300-306 vs web.tsx:21-22 (kind 'event' no aceptado en web.tsx). Arreglo: aceptarlo / LegacyWebScreen directa.
10. Guardarraíles que faltan o no pueden fallar: falta «el pase y los tokens no aparecen en ningún log» (plan 10 §7); falta el área en tabsLayoutWebSafety (plan 01 §7); «Salir borra todo» (session.test.ts:142) solo prueba clearAll (sin cola/proveedor); «el refresco no toca AsyncStorage» (session.test.ts:174) monta su propio memorySecretStore.

BAJA
- outbox: los 401 cuentan para el límite de 5 (:380-388); errores de programación clasificados como `network` (:382); mutación in situ de entradas compartidas con la instantánea (:363, :372); si changed() falla la entrada queda en `sending` para siempre.
- client.ts:461: 400/500 → crm_unavailable (se reintentan y se atascan); 400 debería ser validation.
- session.ts:165-167 vs :183-189: un refresco en vuelo durante signOut reescribe el refresh token tras endSession.
- «Subir al abrir pantalla» solo en ComunicaHome (plan: cualquier pantalla del área).
- useComunicaLinks.ts:319/:336: 'choose' in res ignorado en silencio; cualquier error de exchange sale como «El enlace ha caducado».
- Código muerto: registerNativePage (links.ts:122), todayMadrid (useGrupos.ts:178); el falso duplica destinationQuery; comentario desfasado en useAreaQuery.ts:7-9.
- Añadir una ruta toca 6 sitios (ROUTES, interfaz, cliente, withSession, falso, manejadores del proveedor); el cliente no usa ROUTES.path. La lógica de escrituras vive en un componente de UI → services/comunica/writes.ts.
