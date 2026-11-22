# DIVERGENCIAS.md — MCM Cantoral frente a MCM App

> **Plantilla.** En la Fase 0 este fichero se copia a la raíz de `docs/` del
> repo del fork y se mantiene allí. Es corto a propósito: una fila por
> diferencia, entendible sin abrir el código.
>
> **Para qué sirve:** el fork tiene vida propia y specs que MCM App no tiene,
> pero **cualquier novedad se puede llevar a MCM App** cuando haya tiempo y
> tokens, sin prisa. Esta tabla dice qué hay, de dónde viene y si ya se ha
> portado.

---

## 1. Base del fork

| | |
| - | - |
| Repo de origen | `mcmespana/mcmapp` |
| Commit de origen | `<sha>` (`main`, AAAA-MM-DD) |
| Remoto para traer cambios | `git remote add upstream https://github.com/mcmespana/mcmapp` |
| Estructura | **La app está en la raíz** del fork; en MCM App está en `mcm-app/` (D-04). Un fichero `mcm-app/utils/x.ts` de MCM App es `utils/x.ts` aquí |
| Último repaso de upstream | AAAA-MM-DD hasta `<sha>` |

## 2. Zona espejo (se mantiene igual que en MCM App)

Ficheros que **no se reescriben** en el fork, para poder traer y llevar
cambios con parches (§4) o copiando el fichero. Si hay que tocarlos, el
cambio se hace pensando en las dos apps y se apunta abajo como 🟢. Rutas del
fork (en MCM App, con `mcm-app/` delante):

```
utils/songSheet.ts            utils/songSheetLayout.ts
utils/songDocument.ts         utils/songDisplayBridge.ts
utils/chordNotation.ts        utils/arrangements.ts
utils/songTags.ts             utils/chordProLint.ts
utils/songEditor.ts           utils/tuner/**
utils/playlistPdfHtml.ts      utils/offlinePlaylist.ts
utils/choirIds.ts             utils/playlistSync.ts
```

(La lista definitiva se cierra en la Fase 0 con el mapa de código.)
`scripts/upstream-diff.sh` enseña qué ficheros de la zona espejo difieren de
`upstream/main`. Un test del fork comprueba que la lista existe y que cada
fichero está.

## 3. Divergencias

Leyenda de **Tipo**: 🟢 importable a MCM App · 🔒 solo Cantoral (no tiene
sentido en MCM App) · ↩️ vino de MCM App después del fork.
**En MCM App**: ⏳ pendiente · ✅ portado (fecha) · — no aplica.

| ID | Qué | Tipo | En MCM App | Dónde (fork) | Notas |
| -- | --- | ---- | ---------- | ------------ | ----- |
| DIV-001 | Sin barra de pestañas ni FAB; una pila con barras inferiores de vidrio | 🔒 | — | `app/_layout.tsx` | MCM App necesita sus pestañas |
| DIV-002 | Identidad visual propia (sin territorios ni azul MCM) | 🔒 | — | `constants/theme.ts`, `design.md` | |
| DIV-003 | Catálogo en ficheros con semilla empaquetada, escritura atómica, comparación numérica | 🟢 | ⏳ | `services/catalog/` | Arregla «la primera vez sin red está vacío» en MCM App |
| DIV-004 | Varios repertorios (MCM App: una «Tu selección») | 🟢 | ⏳ | `services/repertorios/` | Compartir v3 ya es compatible con MCM App |
| DIV-005 | Bloques de villancicos (`songs/packs`) | 🟢 | ⏳ | | |
| DIV-006 | Modo Navidad por configuración (`songs/cantoralConfig`) | 🟢 | ⏳ | | |
| DIV-007 | Directo v2: varios maestros, avisos, reacciones, presencia (aditivo sobre `/choirSessions`) | 🟢 | ⏳ | `services/live/` | MCM App sigue a un maestro del fork sin cambios |
| DIV-008 | Directo por wifi local (TCP + Bonjour), equipo base y relevo entre maestros | 🟢 | ⏳ | `services/live/local/` | Requiere build nativo |
| DIV-009 | Pedal Bluetooth nativo (`expo-key-event`) y botones de volumen con interruptor remoto | 🟢 | ⏳ | `hooks/usePedal.ts` | Requiere build nativo |
| DIV-010 | Apuntes por capas (yo / instrumento / todos) | 🟢 | ⏳ | | |
| DIV-011 | Riffs en ABC (abcjs) | 🟢 | ⏳ | zona espejo (hoja) | También requiere el generador del cantoral |
| DIV-012 | Admin por código (Auth anónimo + función) | 🔒 | — | | MCM App ya tiene login |
| DIV-013 | Sin Contigo, Comunica, calendario, fotos, eventos, encuestas, pañuelo, notificaciones, perfiles | 🔒 | — | (borrado) | |
| DIV-014 | App en la raíz del repo, sin `mcm-app/` | 🔒 | — | (estructura) | Por eso se porta con parches (§4) |
| DIV-015 | El cantoral no se congela en directo: se aplica al momento sin mover la canción | 🟢 | ⏳ | `services/catalog/` | |
| DIV-016 | Seguir por sección, cuenta atrás de bloque, resumen al acabar | 🟢 | ⏳ | `services/live/` | |

Al añadir una fila: ID siguiente, una frase, tipo y dónde. Al portarla a MCM
App: «✅ AAAA-MM-DD» y el PR de `mcmapp`.

## 4. Cómo portar

Como la app vive en sitios distintos (raíz aquí, `mcm-app/` allí), se porta
con **parches**, no con `cherry-pick` a pelo:

```bash
# De MCM App al fork: --relative quita el prefijo mcm-app/ y deja fuera lo de fuera
git -C ../mcmapp format-patch -1 <sha> --relative=mcm-app --stdout | git am -3

# Del fork a MCM App: --directory vuelve a poner el prefijo
git -C ../mcmcantoral format-patch -1 <sha> --stdout | git -C ../mcmapp am -3 --directory=mcm-app
```

`scripts/upstream/traer.sh <sha>` y `scripts/upstream/llevar.sh <sha>` lo
hacen, y `scripts/upstream-diff.sh` compara cada fichero de la zona espejo
con su gemelo `mcm-app/<ruta>` de `upstream/main`.

**Del fork a MCM App** (una 🟢): si toca la zona espejo, parche con
`llevar.sh`; si no, se reimplementa con la UI de MCM App (su `design.md`
manda allí) reutilizando la lógica pura. Se marca la fila. **El cantoral de
MCM App solo crece** (decisión del usuario): todo lo 🟢 acaba llegando.

**De MCM App al fork**: en cada repaso, `scripts/upstream-diff.sh` +
`git log upstream/main -- mcm-app/<zona espejo>`; se traen con `traer.sh`
los commits de la zona espejo y los arreglos de cantoral que apliquen; lo
demás se ignora. Se apunta la fecha y el sha del repaso en §1.
