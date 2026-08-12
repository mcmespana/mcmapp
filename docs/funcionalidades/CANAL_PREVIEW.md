# Modo tester: canal `preview` de EAS Update

Permite que un dispositivo concreto reciba los OTA de la rama **`preview`** en
lugar de los de **`production`**, sin instalar un binario aparte y sin tocar al
resto de usuarios. Se activa con 7 taps en el pie de la Home ("Laboratorio
Alpha").

## Cómo funciona

| Pieza                         | Fichero                                                              |
| ----------------------------- | -------------------------------------------------------------------- |
| Mecánica del cambio de canal  | `mcm-app/services/previewChannel.ts`                                 |
| Estado + flag persistido      | `mcm-app/contexts/PreviewChannelContext.tsx`                         |
| Modal "Laboratorio Alpha"     | `mcm-app/components/PreviewChannelModal.tsx`                         |
| Panel de estado / diagnóstico | `mcm-app/components/preview-channel/LabStatusPanel.tsx`              |
| Gesto de los 7 taps           | `mcm-app/components/SecretMenuTrigger.tsx` + `hooks/useSecretTap.ts` |
| Publicación de los bundles    | `.github/workflows/ota-preview.yml` (push a la rama git `preview`)   |

El canal viaja en la cabecera **`expo-channel-name`** de la petición de update.
Cambiarlo en caliente es exactamente sobreescribir esa cabecera:

```ts
Updates.setUpdateRequestHeadersOverride({ "expo-channel-name": "preview" });
// y para volver al canal con el que se construyó el binario:
Updates.setUpdateRequestHeadersOverride(null);
```

Tres propiedades importantes de esta API (expo-updates ≥ 29; aquí 57.x):

1. **No necesita `disableAntiBrickingMeasures`.** Funciona en cualquier build de
   EAS, incluida la que ya está publicada en las tiendas.
2. **Muta la configuración viva**, no solo la persistida: el
   `checkForUpdateAsync()` inmediatamente posterior ya va al canal nuevo.
3. **Se persiste en el almacenamiento nativo** (SharedPreferences en Android,
   User Defaults en iOS), así que el chequeo automático que expo-updates hace al
   arrancar —antes de que corra una sola línea de JS— también sale por `preview`.

### Dos fuentes de verdad, reconciliadas en cada arranque

- **AsyncStorage** (`@mcm_preview_channel_enabled`) guarda la _intención_ del
  usuario. Es lo que pinta la palanca y el "· alpha" del pie.
- **El almacenamiento nativo de expo-updates** guarda el override real, que es
  lo que de verdad decide de qué canal bajan los updates.

`syncChannelOverride()` las alinea en cada arranque, en las dos direcciones. Con
el flag apagado **se limpia el override explícitamente**: es la garantía de que
nadie se queda atrapado en `preview` por un override heredado.

`OTAProvider` espera a `hydrated` antes de su primera comprobación
(`useOTAUpdate({ ready })`), para que la búsqueda de updates no le gane la
carrera al override y acabe pidiéndole el bundle a `production`.

## Requisito de build

`setUpdateRequestHeadersOverride` **solo admite cabeceras que ya venían
declaradas en el binario**; si no, lanza `ERR_UPDATES_RUNTIME_OVERRIDE` (el
código lo traduce a `unsupported: 'build'` y lo enseña en pantalla).

EAS Build inyecta `expo-channel-name` a partir del `channel` de cada perfil de
`eas.json` — los cuatro perfiles lo tienen, así que **todas las builds hechas con
EAS valen**. Solo haría falta declararlo a mano (`updates.requestHeaders` en
`app.json`) si alguna vez se compilara una release fuera de EAS, p. ej. con
`npx expo run:android --variant release`.

## Por qué la primera versión nunca funcionó

Usaba `Updates.setUpdateURLAndRequestHeadersOverride()`, que:

1. **Exige `updates.disableAntiBrickingMeasures: true` en el binario.** Es config
   nativa, no se puede activar por OTA: hacía falta una build de tienda que
   nunca llegó a salir. Sin el flag la llamada lanza y el toggle no hacía nada.
2. Aunque el flag estuviera, **el override de URL no surte efecto hasta cerrar y
   reabrir la app del todo** — el `checkForUpdateAsync()` de esa sesión seguía
   yendo a `production`.
3. El `try/catch` se tragaba el error en un `logger.warn`. La palanca se movía,
   el pie ponía "· alpha", y el dispositivo seguía en `production`. Sin ninguna
   señal en pantalla, el fallo pasó meses inadvertido.

Y de propina, `disableAntiBrickingMeasures` es peligroso en producción: quita la
protección que garantiza que siempre se pueda publicar un update que arregle un
update roto. Expo desaconseja explícitamente activarlo en builds de tienda.

**Sigue puesto en `app.json`, a propósito.** Ya no hace falta y hay que quitarlo,
pero tocar `app.json` dispara el `guard-native` de `ota-production.yml`, que
obliga a poner `[skip-ota]` en el push — y eso saltaría la OTA entera, dejando
este arreglo sin llegar a los móviles ya instalados. Como quitarlo no surte
efecto hasta la siguiente build nativa, va apuntado en la bolsa nativa de
`mcm-app/TODO.md` para hacerlo junto a la build. El código de aquí funciona
igual con el flag puesto o quitado.

## Cómo comprobar que funciona

El modal enseña un bloque de diagnóstico con:

- **canal en uso ahora** — `Updates.channel`, el canal del bundle que corre en
  este momento. **No refleja el override hasta reiniciar**, y ver esa diferencia
  es justo lo que permite saber si el modo está surtiendo efecto.
- **canal tras reiniciar** — lo que se pedirá en la próxima comprobación.
- **runtime** y **bundle** — para descartar el otro motivo de que no llegue nada.

Prueba de humo, en la app instalada desde la tienda:

1. 7 taps en la versión del pie → Laboratorio Alpha.
2. Mover la palanca a ALPHA. Debe aparecer "Cambiando de canal…" y luego, o bien
   "¡Novedades descargadas!" con el botón de reiniciar, o bien "Ya estás en el
   canal alpha" si `preview` no tiene nada más nuevo.
3. Reiniciar. **canal en uso ahora** debe pasar a `preview`.
4. Publicar algo en la rama git `preview` y volver a abrir la app: debe llegar.
5. Mover la palanca a MUNDANO y reiniciar: vuelve a `production`.

## Si no llega nada estando en ALPHA

Casi siempre es la **runtime version**. Un bundle solo se entrega a binarios con
la misma `runtimeVersion` (hoy `2.1.0`, en `app.json`). Si la rama `preview`
publicó con otra, EAS no sirve nada y la app se queda con su bundle actual — sin
error, por diseño. Compara el "runtime" del panel con el del update en
[expo.dev](https://expo.dev) → EAS Update → branch `preview`.
