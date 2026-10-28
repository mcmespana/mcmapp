# _para-borrar — cuarentena

Ficheros que la limpieza de octubre de 2026 no pudo confirmar al 100 % como
muertos. **Nada de aquí lo usa la app, ni ningún workflow.** Están movidos con
`git mv` (el historial se conserva). Si el usuario no los echa en falta, se
borra la carpeta entera; si los quiere, se devuelven a su sitio.

| Fichero                    | Qué es                                                                                                                                                                                                                                                                | Por qué se movió y no se borró                                                                         |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `ios-light.png`            | Variante clara del icono de iOS 18 (idéntica a `mcm-app/assets/images/icon.png`). Estaba en `mcm-app/assets/images/`                                                                                                                                                  | `app.json` no declara hoy los iconos oscuro/tintado de iOS 18; podrían usarse si se quiere ese soporte |
| `ios-dark.png`             | Variante oscura del icono de iOS 18. Estaba en `mcm-app/assets/images/`                                                                                                                                                                                               | Idem                                                                                                   |
| `ios-tinted.png`           | Variante tintada del icono de iOS 18. Estaba en `mcm-app/assets/images/`                                                                                                                                                                                              | Idem                                                                                                   |
| `mcm-app-skills-lock.json` | Antiguo `mcm-app/skills-lock.json`: lockfile de 25 skills (animate-expo, heroui-native, firebase-\*, expo-\*…) que **ya no están instaladas** (`mcm-app/.agents/` no existe). El lockfile vigente es `skills-lock.json` de la raíz, que sí describe `.agents/skills/` | Por si se quiere reinstalar alguna de esas skills: la lista de orígenes y versiones está aquí          |

No hay ninguna decisión pendiente que bloquee otra cosa: es solo ruido que
conviene que el usuario decida cuándo tirar.
