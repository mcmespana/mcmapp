# OTA: de `main` a `preview` y a `production` (y cómo deshacerlo)

> Cómo llega un cambio de solo JS a los usuarios sin pasar por las tiendas, y
> qué hacer si una OTA sale mala. Los workflows son la fuente de verdad:
> [`ota-preview.yml`](../../.github/workflows/ota-preview.yml) y
> [`ota-production.yml`](../../.github/workflows/ota-production.yml). La regla
> de `[skip-ota]` para cambios nativos está en
> [`mcm-app/CLAUDE.md`](../../mcm-app/CLAUDE.md) (sección "OTA vs Build de
> tienda"); el modo tester, en
> [`CANAL_PREVIEW.md`](../funcionalidades/CANAL_PREVIEW.md).

## Qué es una OTA aquí

Una OTA (EAS Update) es **el bundle JS entero del commit publicado**, no solo
tu cambio. Lo recibe **todo binario instalado con la misma `runtimeVersion`**
(hoy `2.1.0`, en `app.json`) que mire ese canal. Dos consecuencias:

- Si el JS del commit necesita un módulo nativo que el binario de las tiendas
  no tiene, la app **crashea** al arrancar con esa OTA.
- Cambiar la `runtimeVersion` corta a propósito la cadena: los binarios viejos
  dejan de recibir OTAs nuevas.

## El flujo

Hay tres ramas git y cada una publica a su canal de EAS Update al hacer push:

| Rama git     | Workflow             | Canal EAS    | Quién lo recibe                                                    |
| ------------ | -------------------- | ------------ | ------------------------------------------------------------------ |
| `main`       | — (no publica)       | —            | Es la rama de desarrollo: aquí se mergean los PR                   |
| `preview`    | `ota-preview.yml`    | `preview`    | Solo los dispositivos con el "Laboratorio Alpha" activado (7 taps) |
| `production` | `ota-production.yml` | `production` | Todos los usuarios                                                 |

```
PR → main ──merge→ preview ──(se prueba en el iPhone del usuario)──merge→ production
```

1. **PR a `main`.** Nada se publica.
2. **A `preview`**: `git checkout preview && git merge main && git push`. En
   ~2 min hay OTA en el canal `preview`. El usuario la prueba en su iPhone
   (Laboratorio Alpha). **Quien valida es el usuario**: nadie
   promueve a `production` sin que él lo diga.
3. **A `production`**, solo cuando el usuario diga que está bien. Para que
   salga **exactamente lo que se probó**, mergea `preview` (no `main`, que
   puede haber avanzado con commits sin probar): `git checkout production &&
git merge preview && git push`. La reciben todos en el siguiente arranque
   (`checkAutomatically: ON_LOAD`) o cada ~15 min con la app abierta.

Cada publicación pasa primero por `verify.yml` (typecheck, typecheck de tests,
lint y tests): si está en rojo, **no se publica nada**. Los pushes se encolan
(`concurrency`), no se pisan.

## Cómo la aplica la app (sin preguntar)

Desde noviembre de 2026 **no hay modal de «¿te actualizas?»**: la app
comprueba, descarga en segundo plano y aplica sola (`contexts/OTAContext.tsx`,
reglas puras en `utils/otaAutoApply.ts`), enseñando la pantalla de «un
momentín» (`OTAUpdatingOverlay`, ~160 frases en `constants/updatePhrases.ts`).

- **Update listo en los primeros 45 s de abrir la app** → se aplica ya.
- **Update que llega con la app en uso** (la comprobación de cada 15 min) → NO
  interrumpe; espera a que la persona vuelva a la app desde el fondo. Mientras
  tanto sale la insignia de Home, que lo aplica con un toque.
- **Cortafuegos anti-bucle**: tras una aplicación automática, no se hace otra en
  10 min (marca `otaLastAutoApplyAt` en `AsyncStorage`). Si una OTA no llegara
  a arrancar, la app no entra en un bucle de recargas.
- La pantalla se ve como mínimo ~3 s antes de recargar (la OTA ya está bajada y
  la recarga es casi instantánea, y si no la frase no se lee).

Para quien despliega: una OTA mala llega, por tanto, **sola y deprisa** al
siguiente arranque de cada dispositivo. Revísala en `preview` y, si sale mal, el
rollback de abajo es lo primero.

## Cuándo NO empujar a `production`

- **El commit necesita un binario nuevo** (paquete nativo, cambios en
  `app.json`/`app.config.ts`/`eas.json`/`patches/`/`plugins/`/`modules/`/
  `targets/`): `production` no se mueve hasta que **las tiendas tengan ya el
  binario**, o la gente recibe un bundle que su app no puede ejecutar. El
  commit lleva `[skip-ota]` y el `guard-native` de ambos workflows hace dos
  cosas: con `[skip-ota]` en el rango del push, **salta** la OTA; sin él y con
  diff nativo, **falla en rojo** (a propósito).
- **Ojo con el rango.** El guard mira todo el push. Si en el mismo push van un
  cambio nativo con `[skip-ota]` y un arreglo de JS urgente, **ninguno de los
  dos se publica**. Y el siguiente push JS-only sí publicará el bundle entero,
  incluido el JS que necesita lo nativo. Por eso lo nativo se mantiene fuera
  de `production` hasta que el binario esté en tiendas (o se sube la
  `runtimeVersion` con ese binario).
- `workflow_dispatch` manual (pestaña Actions) con `force` salta el guard:
  solo si sabes lo que haces.

## Rollback: una OTA salió mala

Lo primero, **parar el sangrado en `production`**; el arreglo de fondo viene
después, por el flujo normal. Hay tres vías, de más a menos rápida. Los
comandos se ejecutan desde `mcm-app/` con sesión de EAS (`eas login`).

**1. `eas update:rollback` — la normal.** Republica el update anterior de la
rama (o, si no hay anterior, vuelve al bundle embebido en el binario):

```bash
eas update:list --branch production --limit 5     # localiza el group id malo
eas update:rollback <GROUP_ID_MALO> --message "Rollback de <qué>"
```

Requisitos de la CLI: el group indicado debe ser **el último** de su rama y
`runtimeVersion`. Para republicar uno concreto y no «el anterior», usa la vía 2.

**2. `eas update:republish` — volver a un update concreto.**

```bash
eas update:list --branch production --limit 10    # busca el group id bueno
eas update:republish --branch production --group <GROUP_ID_BUENO> \
  --message "Vuelta a <fecha/commit>"
```

Para probar antes en el canal tester, se puede republicar a `preview`:
`--group <id> --destination-branch preview`. Con `--rollout-percentage <1-100>`
solo llega a ese porcentaje de usuarios.

**3. Revertir en git (deja el repo coherente).** Si el commit malo ya está en
`production`:

```bash
git checkout production && git revert <sha-malo> && git push
```

Dispara `ota-production.yml` con el código anterior. Es más lento (pasa por
`verify`), pero el historial queda explicando qué pasó. Lo ideal es hacer 1 o 2
**ya** y 3 justo después, para que la rama deje de contener el commit malo.

Después del rollback: avisa al usuario, abre la causa (Sentry, si es un
crash) y no vuelvas a mergear a `production` hasta tener el arreglo probado en
`preview`. Un dispositivo se lleva la versión buena la próxima vez que
comprueba updates (al abrir la app); uno que ya no consigue arrancar depende de
las medidas anti-brick de expo-updates (volver al bundle anterior o al
embebido), así que no confíes en ellas: revierte rápido.

## Referencias

- Comandos exactos y flags: `eas update:rollback --help`,
  `eas update:republish --help`, `eas update:list --help` (comprobados con la
  `eas-cli@21.0.2` que fijan los workflows).
- Guard de cambios nativos y `[skip-ota]`: comentario de cabecera de
  `ota-production.yml`.
- Por qué el login, Sentry y Aptabase viajan en cada OTA (variables
  `EXPO_PUBLIC_*` horneadas en el bundle): comentarios de los dos workflows y
  [`BUILD_AGOSTO_2026.md`](BUILD_AGOSTO_2026.md).
