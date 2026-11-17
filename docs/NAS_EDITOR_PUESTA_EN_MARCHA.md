# Poner en marcha el editor de canciones (NAS) — BORRAR AL TERMINAR

> Lista de una sola vez. **Cuando esté hecho, borra este archivo** (y su línea
> en `docs/README.md` si la tiene). Lo que queda para siempre está en
> `docs/funcionalidades/EDITOR_CANCIONES.md`.

## 1. Código del cantoral en `main`

Mergea la rama `batiburrillo` de `mcmapp-cantoral` a `main` (trae `/api/app/*`).

## 2. NAS (por SSH)

```sh
# a) La base de datos de Firebase (no es un secreto). Si la línea ya existe vacía, edítala.
sudo sh -c 'echo "FIREBASE_URL=https://<TU-PROYECTO>-default-rtdb.<region>.firebasedatabase.app" >> /volume1/docker/cantoral-admin/cantoral-admin.env'

# b) Traer el código y relanzar (el .env solo se lee al crear el contenedor)
sudo docker exec cantoral-admin git -C /app pull
sh /volume1/docker/cantoral-admin/run-cantoral.sh
```

La URL es la misma que `EXPO_PUBLIC_FIREBASE_DATABASE_URL` de la app.

## 3. Firebase (consola → Realtime Database)

| Nodo | Valor |
| ---- | ----- |
| `songs/editor/url` | La URL pública del admin: `https://cantoral.<tailnet>.ts.net` (sin barra final) |
| `users/<uid>/isAdmin` | `true` para cada persona que deba editar (el `uid` sale en Authentication) |

## 4. Comprobar

1. `https://cantoral.<tailnet>.ts.net/api/app/status` en el navegador → debe
   responder `{"error": "Falta la sesión…"}` (401). Si pide usuario y
   contraseña, el NAS sigue con el código viejo.
2. En la app, con una cuenta administradora: abre una canción → menú → **Editar
   canción**, cambia algo y guarda. Debe salir «Enviado al cantoral» y, en
   GitHub, un commit `app: edita «…»` seguido del de Actions.
3. Cierra y abre la app pasados un par de minutos: el cambio está para todos.

## Si algo falla

| Síntoma | Causa |
| ------- | ----- |
| «Guardado en este móvil» siempre | Falta `songs/editor/url`, o el NAS/Funnel está caído |
| «Sesión no válida» | La cuenta no puede leer su `users/<uid>/isAdmin` (reglas) o el token caducó: cierra sesión y entra |
| «Tu cuenta no es administradora…» | Falta `isAdmin = true` en ese `uid` |
| «…no tiene FIREBASE_URL configurada» | Paso 2a sin hacer, o no se relanzó con `run-cantoral.sh` |
| No aparece «Hacer una foto» | Falta `ANTHROPIC_API_KEY` en el NAS (README del despliegue, «Revisión con IA») |
