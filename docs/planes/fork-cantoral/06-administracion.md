# 06 · Administración sin usuarios

> Parte del plan [`README.md`](README.md). Requisito del usuario: «en
> principio sin usuarios; si hay que designar administradores, que sea porque
> ponen un código que podemos guardar en Firebase». **Cuándo** (A-07: «si no
> cuesta mucho, sí antes de enero»): al **final de la Fase 4**, si da
> tiempo antes del 19/12; si no, en enero. No hace falta para Villancicos:
> las canciones se corrigen desde el admin del cantoral y, como el cantoral
> no se congela en directo (D-21), la corrección llega a todos al momento.

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

## 2. Lo elegido (D-09): «una especie de contraseña y ya»

Para quien lo usa **es una contraseña**: la escribe en Ajustes y ya es
administrador en ese móvil. Nada más que ver ni que configurar. Lo de abajo
es cómo se hace para que esa contraseña no se pueda sacar de la app.

### En sencillo

- Cada móvil con MCM Cantoral, por dentro y sin que nadie vea nada, le dice
  a Firebase «soy el móvil nº 8f3a…». No hay usuario, ni correo, ni
  pantalla de entrar: es como el número de serie de la instalación.
- Quien quiera ser administrador va a Ajustes, toca «Soy administrador» y
  escribe **el código**.
- El código **no lo comprueba la app** (cualquiera podría destripar la app y
  verlo). Lo comprueba **un programa pequeño que vive en Firebase** (una
  «función»): si el código está bien, apunta «el móvil nº 8f3a… es admin».
- El NAS del cantoral ya sabe mirar esa marca, así que el editor de
  canciones funciona igual que hoy en MCM App, sin tocar el NAS.
- Para quitarle el permiso a alguien, se borra su marca (consola o Panel), o
  se cambia el código.

Lo único que hay que hacer fuera del código: **activar el «inicio de sesión
anónimo»** en la consola de Firebase (un interruptor) y **desplegar la
función** una vez (Claude deja el comando; o un workflow con el token).

### Por dentro

1. Al primer arranque, el fork entra con **Firebase Auth anónimo** (sin
   pantalla, sin correo, sin nada: la persona no «tiene usuario»). Eso da un
   `uid` estable por instalación.
2. En Ajustes → «Soy administrador» → escribe el **código**.
3. Una **Cloud Function** (`claimCantoralAdmin`, en `functions/` del fork
   con `"codebase": "cantoral"`, para que desplegarla no toque las funciones
   de MCM App) compara el código con su huella
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

### Lo que se descartó

Mandar el código al NAS en una cabecera y que el NAS lo compare: más simple,
pero el código viaja y se guarda en cada móvil, solo sirve para el editor y
el NAS se vuelve el único que sabe quién es admin.

## 3. «Maestro» no es «administrador»

| Rol | Qué puede | Cómo se consigue |
| --- | --------- | ---------------- |
| **Administrador** | Editar canciones (vía NAS), ver herramientas de cantoral | Código de admin (arriba) |
| **Maestro de un directo** | Pasar canciones, mandar avisos, ceder el mando | Crear el directo, o el **PIN/QR de maestro** que enseña quien lo creó (ver `04`). Sin servidor |
| **Coro** (subir/actualizar repertorios ajenos) | Lo de hoy | Contraseña del coro (`coco`, como en `COROS.md`) |

Para Villancicos no hace falta ningún administrador: los 3-4 maestros entran
con el PIN de maestro del directo del evento.

## 4. Tareas (final de la Fase 4 si da tiempo; si no, enero)

| # | Tarea | Modelo |
| - | ----- | ------ |
| 6.1 | Auth anónimo al arrancar (silencioso, tolerante a sin red) | Sonnet |
| 6.2 | `claimCantoralAdmin` + huellas en `/_config/cantoral` + límite de intentos; la regla de `users/$uid/isAdmin` y de `/_config/cantoral` se añade en `mcmapp` (dueño de las reglas) | Opus |
| 6.3 | «Soy administrador» en Ajustes; `useAdminStatus` sin Google/Apple | Sonnet |
| 6.4 | Probar el editor contra el NAS real con un admin anónimo | — (usuario) |
