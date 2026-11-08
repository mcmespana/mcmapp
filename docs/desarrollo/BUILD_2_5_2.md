# Próxima build nativa — 2.5.2

> Documento **vivo**. Es la lista de lo que lleva la siguiente build de tienda
> (la que sigue a la 2.5.1). Añade aquí cualquier cambio nativo que aparezca; el
> día de la build, esta página es el checklist.

## Cómo se trabaja hasta entonces (decisión del usuario, 2026-11-08)

Un cambio nativo en `main` con `[skip-ota]` **frena el flujo `main → preview →
production`**: el `guard-native` salta la OTA de todo el push, y el siguiente
push de solo JS publicaría el bundle entero (ver «Cuándo NO empujar» en
[`OTA.md`](OTA.md)). Para poder seguir trabajando con normalidad:

- **Lo nativo NO entra en `main`.** Vive en la rama **`native/2.5.2`**, que
  cuelga de `main` y solo lleva commits nativos (todos con `[skip-ota]`).
- **Todo lo que sea JS va a `main` como siempre**, aunque nazca del mismo
  problema que el cambio nativo.
- Se considera «nativo» lo que toque `modules/`, `plugins/`, `targets/`,
  `patches/`, `app.json`, `app.config.ts`, `eas.json` o `package.json` con un
  paquete con código nativo.
- Mantener la rama al día: de vez en cuando `git fetch && git rebase origin/main`
  sobre `native/2.5.2` (o un merge de `main`), para que el día de la build no
  haya sorpresas.

## Qué lleva

| #   | Cambio                                                                                                                                                                                        | Dónde                                                                                                     | Estado                                                                                           |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| 1   | **Android: lecturas de Contigo «en blanco pero con scroll».** `HighlightMenuView.onLayout` ya no llama a `super.onLayout`: `ExpoView` es un `LinearLayout` y recolocaba el texto con altura 0 | `modules/highlight-menu/android/.../HighlightMenuView.kt` (+ nota en `docs/funcionalidades/SUBRAYADO.md`) | En `native/2.5.2`. Diagnóstico por lectura del código: **comprobar en un Android tras la build** |

**Comprobar en Android tras la build (1):** Contigo → Evangelio → desplegar
Primera lectura, Salmo y Segunda lectura (una a una y todas a la vez), cambiar
de día con ellas abiertas y cambiar el tamaño de letra. Debe verse siempre el
texto. Comprobar de paso que el ítem «Subrayar» sigue saliendo en el menú de
selección.

### Candidatos sin comprometer

No están decididos para la 2.5.2; los dejo apuntados para no perderlos. El
estado de cada uno está en [`BACKLOG.md`](../planes/BACKLOG.md) §C-bis y §C.4:

- Widgets de Contigo (WidgetKit + App Widget; es una build dedicada).
- Firebase App Check.

## Día de la build

1. Merge de `native/2.5.2` en `main`. El push lleva `[skip-ota]` (ya lo llevan
   sus commits): la OTA se salta, es lo esperado.
2. Subir `version` y `runtimeVersion` a `2.5.2` en `mcm-app/app.json` y
   actualizar «App version» / «Runtime version» en `mcm-app/CLAUDE.md`. Ojo: las
   builds 2.5.1 dejan de recibir OTAs nuevas (es el efecto de subir la
   `runtimeVersion`).
3. Build: `npm run eas:build -- --profile production` (nunca `eas-cli build`
   directo).
4. Publicar en las tiendas y esperar a que el binario esté disponible.
5. **Solo entonces** mover `production` (flujo en [`OTA.md`](OTA.md)).
6. Dejar esta página como histórico (o moverla a `docs/planes/archivo/`) y crear
   la de la siguiente build.
