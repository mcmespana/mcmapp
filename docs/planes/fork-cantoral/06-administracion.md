# 06 · Administración sin usuarios

> Parte del plan [`README.md`](README.md). Requisito del usuario: «en
> principio sin usuarios; si hay que designar administradores, que sea porque
> ponen un código que podemos guardar en Firebase». Fase 5 (no hace falta para
> Villancicos: las canciones se corrigen ese día desde el admin del cantoral
> en el ordenador o el NAS).

---

## 1. Lo que hay hoy en MCM App

- Es admin quien **ha entrado con Google/Apple** y tiene
  `users/<uid>/isAdmin = true` (`hooks/useAdminStatus.ts`).
- El editor (`SongEditorScreen`) no escribe en Firebase ni en GitHub: manda
  la edición al **admin del cantoral en el NAS** (`POST /api/app/*`, URL en
  `songs/editor/url`) con `Authorization: Bearer <pase de Firebase>`, y el NAS
  comprueba `users/<uid>/isAdmin` antes de hacer el commit.
- El toque largo para añadir un `{arr:}` empuja a `songs/ediciones`.

El fork **no tiene inicio de sesión**, así que no hay pase de Firebase… salvo
que lo haya sin que la persona lo note.

## 2. Propuesta (recomendada): sesión anónima invisible + código

1. Al primer arranque, el fork entra con **Firebase Auth anónimo** (sin
   pantalla, sin correo, sin nada: la persona no «tiene usuario»). Eso da un
   `uid` estable por instalación.
2. En Ajustes → «Soy administrador» → escribe el **código**.
3. Una **Cloud Function** (`claimCantoralAdmin`, en `functions/`, que ya
   existe para el precacheo de calendarios) compara el código con su huella
   guardada en `/_config/cantoral/adminCodeHashes` (**no legible** por las
   apps) y, si coincide, escribe `users/<uid>/isAdmin = true`. Limita intentos
   por `uid` (p. ej. 5 por hora).
4. **El NAS no cambia**: sigue recibiendo un pase de Firebase y mirando
   `users/<uid>/isAdmin`. El editor de MCM App se hereda tal cual.
5. Revocar = borrar `users/<uid>/isAdmin` desde la consola o el Panel, o
   cambiar el código (los ya concedidos siguen hasta que se borren).

Por qué así y no «el código en Firebase y la app lo compara»: cualquier cosa
que la app pueda leer, la puede leer cualquiera, y un código corto se
adivina en segundos a partir de su huella. La comparación tiene que estar en
un servidor. Y de paso el `uid` anónimo sirve para endurecer reglas del
directo más adelante (`auth != null`).

**Coste**: activar el proveedor anónimo en Firebase Auth y desplegar una
función. Nada en el NAS.

### Alternativa (más simple, peor)

El código va al NAS en una cabecera y el NAS lo compara con su variable de
entorno. Sin función ni Auth. Pero el código viaja y se guarda en cada
móvil, solo sirve para el editor (no para reglas) y el NAS se vuelve el
único que sabe quién es admin. Decisión D-09.

## 3. «Maestro» no es «administrador»

| Rol | Qué puede | Cómo se consigue |
| --- | --------- | ---------------- |
| **Administrador** | Editar canciones (vía NAS), ver herramientas de cantoral | Código de admin (arriba) |
| **Maestro de un directo** | Pasar canciones, mandar avisos, ceder el mando | Crear el directo, o el **PIN/QR de maestro** que enseña quien lo creó (ver `04`). Sin servidor |
| **Coro** (subir/actualizar repertorios ajenos) | Lo de hoy | Contraseña del coro (`coco`, como en `COROS.md`) |

Para Villancicos no hace falta ningún administrador: los 2-3 maestros entran
con el PIN de maestro del directo del evento.

## 4. Tareas (Fase 5)

| # | Tarea | Modelo |
| - | ----- | ------ |
| 6.1 | Auth anónimo al arrancar (silencioso, tolerante a sin red) | Sonnet |
| 6.2 | `claimCantoralAdmin` + huellas en `/_config/cantoral` + límite de intentos + regla de `users/$uid/isAdmin` | Opus |
| 6.3 | «Soy administrador» en Ajustes; `useAdminStatus` sin Google/Apple | Sonnet |
| 6.4 | Probar el editor contra el NAS real con un admin anónimo | — (usuario) |
