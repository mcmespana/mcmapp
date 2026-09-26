# Plan — "Tu pañuelo": perfil con chapas, Carismochitos y logros

> **Estado: 🔵 futuro lejano — NO ejecutar hasta que el usuario lo diga.**
> Plan funcional escrito el 2026-09-26 a petición del usuario ("prepárame un
> plan de cómo sería… hará falta una vista de perfil donde ver logros, chapas
> y carismochitos; eso lo haremos más adelante"). Sustituye al stub del
> 2026-07-22. Las decisiones que faltan están al final (§9) — sin ellas no se
> empieza.

## 1. Qué es, en una frase

Una **pantalla de perfil** —"Tu pañuelo"— donde cada persona ve lo que ha ido
juntando en el Movimiento: las **chapas** de las actividades a las que ha ido
(colocadas en un pañuelo del MCM, como las de verdad), su **colección de
Carismochitos** y unos cuantos **logros**.

## 2. Dónde vive (y dónde no)

- **No es una pestaña.** Eso ya se estudió y se descartó el 2026-09-19
  (`BACKLOG.md` §3): la barra admite 6 y los perfiles ya declaran 7; una pestaña
  "Perfil" sería siempre la primera en caerse a Más.
- **Es una pantalla del stack de Más** (`app/screens/PerfilScreen.tsx`,
  deep-linkable), que es justo la "idea buena y barata" que dejó apuntada esa
  misma investigación: sacar el contenido del `SettingsBottomSheet` a una
  pantalla propia con sitio para crecer.
- **Entrada**: el engranaje de la Home pasa a ser el **avatar/inicial** cuando hay
  sesión, y abre esta pantalla. Sin sesión, el engranaje de siempre.
- Estructura de la pantalla, de arriba abajo:
  1. Cabecera: avatar, nombre, perfil y delegación.
  2. **El pañuelo** con sus chapas (§3).
  3. **Carismochitos**: la rejilla que hoy vive en `app/carismochito.tsx` se
     muda aquí tal cual (`VariantCard` ya está pensado para eso).
  4. **Logros** (§5).
  5. Ajustes (lo que hoy es el `SettingsBottomSheet`).

## 3. Las chapas

### Cómo se consigue una

Por **estar** en la actividad, no por abrirla en la app. La forma que cuadra
con lo que ya hay:

- **Un QR (o un código corto) por actividad**, que los monitores enseñan in situ
  —en una pantalla, impreso en la acreditación, al final de la misa—. La app ya
  tiene escáner (`components/playlist/QrScannerModal.tsx`) y entrada de código
  (`CodeInputModal.tsx`) de las playlists: se reutilizan.
- El QR lleva `mcmapp://chapa/<badgeId>?c=<código>`, así que también funciona
  escaneándolo con la cámara del sistema.
- Cada chapa tiene **ventana de validez** (`validFrom`/`validTo`): fuera de las
  fechas del encuentro no se puede canjear.

Descartado para la v1: darla automáticamente por estar suscrito al evento o por
abrir su hub durante las fechas. Suscribirse no es ir.

### El problema de las trampas (y cuánto importa)

Con un código que valida el propio móvil, quien tenga una foto del QR se lleva
la chapa desde el sofá. Dos niveles:

- **v1 — validación en el cliente**: el catálogo guarda un **hash** del código,
  no el código; la app compara. Trampeable por quien tenga el QR, pero no por
  quien no lo tenga. **Para un juego de comunidad, suficiente**, y sale por OTA.
- **v2 — validación en servidor**: una función del Panel (`api/badges/claim`)
  comprueba el código y escribe la chapa con credencial de servidor, y la regla
  de RTDB impide que el cliente la escriba solo. Necesita la **Integración D**
  (auth real del Panel), que hoy está bloqueada por la decisión D2.

### Modelo de datos

```
badges                          ← catálogo, lo mantiene el Panel
  updatedAt
  data
    <badgeId>
      name          "Encuentro de Pascua 2027"
      eventId       "pascua-2027"          (opcional: enlaza con /activities)
      image         URL (PNG con fondo transparente, cuadrado)
      rarity        "normal" | "especial"
      codeHash      sha256(código + badgeId)
      validFrom     ms
      validTo       ms

users/{uid}/panuelo/{badgeId}
  at            ms, cuándo se canjeó
  slot          número de hueco en el pañuelo (null = colocada automáticamente)
```

- Sigue el patrón `{ updatedAt, data }` y se lee con `useFirebaseData`.
- La regla de `users/$uid` que ya existe cubre `panuelo` en la v1.
- Las chapas **requieren sesión**: sin ella no hay dónde guardarlas de forma
  que sobrevivan a un cambio de móvil. Sin sesión, la pantalla invita a entrar.

## 4. El pañuelo (el dibujo)

- **v1 — 2D**: el pañuelo del MCM en SVG (`react-native-svg`, ya instalado), de
  frente, con **huecos fijos** donde van las chapas en orden de canje. Se puede
  tocar una chapa para ver su ficha (evento, fecha). **OTA.**
- **v1.5 — colocar a mano**: arrastrar una chapa a otro hueco
  (`react-native-gesture-handler`, ya instalado) y guardar el `slot`. **OTA.**
- **v2 — 3D**: el pañuelo con volumen, que gira. Opciones: `expo-gl` + `three`
  o `react-native-filament`; las dos son **nativas** (build de tienda) y piden
  un modelo `.glb` del pañuelo hecho por alguien que sepa modelar. Se decide
  después de ver si la v1 engancha; el modelo de datos no cambia.

## 5. Logros

Se **calculan** a partir de datos que ya existen; no se guardan (así no hay nada
que sincronizar ni que se desincronice). Un módulo puro, `utils/achievements.ts`,
con sus tests:

| Logro                                 | Sale de                                        |
| ------------------------------------- | ---------------------------------------------- |
| Racha de oración de 7 / 30 / 100 días | `ContigoHabitsContext` (`getStreak('prayer')`) |
| Primer mes rezando                    | hábitos de Contigo                             |
| Primera chapa · 5 · 10                | `users/{uid}/panuelo`                          |
| Colección de Carismochitos completa   | `summarizeCollection(...).complete`            |
| Has visto al dorado                   | colección de Carismochitos                     |

⚠️ **Antes de enseñar nada del Wordle aquí**: sus estadísticas se identifican con
un id aleatorio de AsyncStorage (`hooks/useWordleStats.ts`), no con el uid de
Firebase. Hasta unificarlo, el Wordle no entra en los logros.

## 6. Lado del Panel (repo `mcmpanel`)

- CRUD del catálogo `badges` (nombre, imagen, evento, fechas, rareza) y
  **generación del QR** listo para imprimir o proyectar. El código se genera en
  el Panel y solo se guarda su hash.
- La previsualización de la chapa se pinta con los tokens de la app (`design.md`
  §9: lo que el admin ve se parece a lo que verá la persona).
- Estadística: cuántas chapas se han canjeado por actividad.
- Es trabajo en otro repo: hay que añadirlo a la sesión.

## 7. Fases

| Fase | Qué                                                                                                       | OTA       | Depende de                    |
| ---- | --------------------------------------------------------------------------------------------------------- | --------- | ----------------------------- |
| 0    | `PerfilScreen` en el stack de Más + avatar en la Home, con Ajustes y la colección de Carismochitos dentro | ✅        | Sacar la caza del laboratorio |
| 1    | Chapas v1: catálogo, canje por QR/código con hash, pañuelo 2D con huecos fijos                            | ✅        | Panel: CRUD + QR              |
| 2    | Logros calculados                                                                                         | ✅        | —                             |
| 3    | Colocar las chapas a mano                                                                                 | ✅        | —                             |
| 4    | Canje validado en servidor                                                                                | ✅ (app)  | Integración D                 |
| 5    | Pañuelo 3D                                                                                                | ❌ nativo | Modelo `.glb`                 |

## 8. Lo que ya está hecho y se aprovecha

- Colección de Carismochitos (`utils/carismochitoCollection.ts`,
  `CarismochitoHuntContext`, `app/carismochito.tsx`) — hoy escondida en el
  Laboratorio Alpha.
- Escáner de QR y entrada de código (playlists).
- Sincronización por usuario con fusión (`utils/authHelpers.ts`, patrón de
  Contigo y Carismochitos).
- Rachas de Contigo.

## 9. Decisiones pendientes — preguntar antes de empezar

1. **¿Validación en cliente (v1, trampeable con el QR) o esperar a la de
   servidor?** Recomendación: cliente; es un juego.
2. **¿Quién crea las chapas y sus imágenes** en cada actividad (coordinación,
   monitores, el equipo de comunicación)? Sin imágenes no hay pañuelo.
3. **¿La pantalla de perfil sustituye al `SettingsBottomSheet`** o conviven un
   tiempo?
4. **¿Cuándo sale la caza de Carismochitos del laboratorio?** La Fase 0 la
   necesita a la vista.
5. **¿Chapas "especiales"** (solo para monitores, por años de participación…)?
   Cambia el catálogo pero no la mecánica.
