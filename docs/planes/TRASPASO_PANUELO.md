# Traspaso — pañuelo virtual (para Izan y su agente)

> **Para quien siga.** La primera versión está en `main` (PR #391, 2026-11-14) y en
> el canal `preview`, escondida en el Laboratorio Alpha. **Funciona, pero está
> floja para que la use todo el mundo**: nunca se ha visto en un móvil de verdad.
> Tu trabajo es pulirla. Lo de abajo es lo que hace falta saber para no empezar
> de cero. Lo que el propietario ya decidió está en §3: no se re-discute.

Lee antes, por este orden: [`../funcionalidades/PANUELO.md`](../funcionalidades/PANUELO.md)
(cómo funciona), [`../contratos/PANUELO_CONTRATO.md`](../contratos/PANUELO_CONTRATO.md)
(datos), [`PLAN_PANEL_PANUELO.md`](PLAN_PANEL_PANUELO.md) (fases y decisiones
pendientes) y [`../../design.md`](../../design.md) (antes de tocar interfaz).

## 1. Qué es, en tres líneas

El pañuelo del MCM (rojo, verde, azul o amarillo) en **3D**, al que se le cosen
piezas digitales (chapas, pines, cintas, parches, medallas, pulseras) que se
dan por ir a las actividades. Se gira, se toca una pieza para verla de cerca,
se decora, se canjean códigos. Idea del propietario (2026-11-12); referencia:
los premios de la app Fitness de Apple. Lo importante para él es **lo visual y
el diseño**.

## 2. Cómo está montado (lo mínimo)

- **El visor** es three.js dentro de un WebView (iframe en web):
  `mcm-app/panuelo-3d/src/` (`main.ts` escena y gestos, `cloth.ts` el pañuelo,
  `items.ts` las piezas en 3D, `art.ts` lo que se pinta en canvas). **No lo
  empaqueta Metro**: `npm run build:panuelo` lo deja en
  `panuelo-3d/generated/viewer.bundle.json`, que **se commitea**. Si tocas el
  visor y no lo regeneras, `__tests__/panueloViewerBundle.test.ts` se pone en rojo.
- **La app manda, el visor pinta.** Protocolo en `types/panuelo.ts`
  (`PanueloCommand` app→visor, `PanueloEvent` visor→app).
- **Las piezas salen de datos**, no de imágenes: catálogo en
  `firebase-seed/panuelo.json` (que es también el catálogo que se usa si no hay
  uno remoto). Se sanea todo lo que llega de fuera (`utils/panuelo.ts`).
- **La pantalla** es `app/panuelo.tsx`; el estado y la sincronización,
  `hooks/usePanuelo.ts`; la lógica pura, `utils/panuelo*.ts`.
- Interruptor: `global.panuelo` (`off` / `alpha` / `all`), en
  `utils/panueloGate.ts`. Hoy `alpha`.

## 3. Decidido (no se re-discute)

- Visor en WebView con three.js, **no** `expo-gl` ni Filament: sale por OTA.
- three.js va empaquetado en la app (sin red); `three` solo en `devDependencies`.
- El pañuelo **se calcula**, no hay `.glb` de pañuelo. Las medallas con `.glb`
  siguen usando el visor de `components/medallas/` para «Verla de cerca».
- Las piezas se definen con datos (colores, forma, texto).
- Código canjeado **validado en el móvil** (el catálogo guarda el hash). Es un
  juego de comunidad; la validación en servidor es futura (Integración D).
- **No es una pestaña.** Su sitio previsto: avatar en la cabecera de Inicio →
  «Tu pañuelo». Falta que el propietario lo confirme (ver el plan, decisión 1).
- Sin gradientes decorativos ni «rayitas» fuera de lo que permite `design.md`.
- Los intercambios van **cara a cara con código**; la base de reglas ya está.

## 4. Qué está flojo (por orden de importancia)

1. **Nunca se ha visto en iPhone ni en Android.** Solo en navegador (Chromium con
   WebGL por software). Antes de pulir nada: abre la OTA de `preview` en un
   móvil y mira la lista de la Fase 3 del plan (fondo transparente del WebView
   en Android, rendimiento, sentido de la inclinación, gesto de atrás de iOS,
   compartir, memoria al abrir y cerrar varias veces).
2. **Gasta batería en reposo.** El vaivén del pañuelo (`resting` / `idle` en el
   bucle de `main.ts`) marca `dirty` en cada fotograma, así que en modo ver
   quieto se pinta a 60 fps sin parar. Hay que parar el bucle cuando nada se
   mueve, o bajar la frecuencia del vaivén, o quitarlo si en el móvil no
   compensa. Es lo primero que haría.
3. **El catálogo es de mentira.** Las 18 piezas son inventadas para probar. Hay
   que decidir con el propietario cuáles son de verdad (y quién las crea).
4. **El pañuelo rojo lleva el logo del COM.** Falta el logo del MIC (el
   propietario solo pasó el del COM). Está en `panuelo-3d/assets/logo-com.png`
   (máscara blanca) y se tiñe con `PanueloColors.print`.
5. **Las dos medallas reales** (`jubileo-jovenes-2025`, `visita-papa-2026`) cargan
   su miniatura desde jsDelivr (`medallas-3d/thumbs/`): ya están en `main`, pero
   verifica en el móvil que se ven; si no, sale una medalla genérica.
6. **Aspecto de algunas piezas.** Lo más mejorable a ojo: las **pulseras** (en 3D
   son un aro plano; podrían tener más cuerpo y nudo), los **parches** (el
   bordado es una textura) y la **cinta** (poco volumen). Los pines y chapas son lo
   más logrado. Mira capturas antes de decidir qué tocar.
7. **Piezas apiladas.** Con muchas piezas se tapan entre sí y con el logo
   (`nextFreeSlot` en `utils/panueloPlacement.ts` busca hueco, pero con 18+ se
   amontona). Quizá el pañuelo necesite más superficie útil, o tamaños menores.
8. **Accesibilidad del 3D.** El canvas no es accesible; la colección de abajo
   hace de alternativa (etiquetas, «ponérmela», «quitar»). Revisar `fontScale`
   grande, lector de pantalla y área táctil, que apenas se ha mirado.
9. **Sin tests de la pantalla** (`app/panuelo.tsx`, ~660 líneas, ni el hook
   `usePanuelo`). La lógica pura sí está probada (74 tests). El visor se probó a
   mano con Playwright (§6).
10. **Sincronización incompleta para intercambios**: `syncPanueloItem` solo
    añade piezas; para intercambiar hace falta borrar `items/{id}` y escribir
    `gone/{id}` (ver §5).

## 5. Lo que falta por construir

En el orden del plan (`PLAN_PANEL_PANUELO.md`, tabla de fases):

- **Fase 3**: probar en móvil y ajustar (§4.1, §4.2).
- **Fase 4**: sacarlo del laboratorio (avatar de Inicio → «Tu pañuelo», tarjeta
  de «pieza nueva»). Antes: catálogo en Firebase y reglas desplegadas.
- **Fase 5**: **intercambios**. Las reglas están en `utils/panueloTrade.ts` (con
  tests). Falta el servicio (`panueloTrades/{code}`, patrón de
  `choirSessionService.ts`), la pantalla (código + QR para enseñar, escribirlo o
  escanearlo, elegir qué se da, animación) y las reglas de Firebase propuestas en
  `PANUELO.md` («Intercambios»). Las pulseras son lo único intercambiable por
  defecto.
- **Fase 6/7**: lado del Panel (editor de piezas, código + QR, repartir) y
  validación en servidor. Necesitan el repo `mcmpanel` y la Integración D.

**Firebase pendiente de hacer a mano**: importar `firebase-seed/panuelo.json` en
`/panuelo/data` con `/panuelo/updatedAt`, y **desplegar las reglas** (la regla de
`/panuelo` está en `database.rules.json` pero sin desplegar). Sin eso, la app usa
el catálogo de muestra y funciona igual.

## 6. Cosas que te ahorran tiempo

- **Ver el visor sin la app**: construye un HTML con
  `window.__PANUELO_INIT__ = { state, mode, still: true }`, un
  `window.ReactNativeWebView = { postMessage }` falso y el JS de
  `generated/viewer.bundle.json`. Ábrelo con Playwright y
  `--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader`. Desde ahí
  se manda cualquier orden con `window.__panuelo({ type: 'focus', id })`. Con
  `still: true` no hay vuelta de entrada ni vaivén (capturas estables).
- **Ver la pantalla entera**: `npx expo start --web` con variables
  `EXPO_PUBLIC_FIREBASE_*` falsas (con URL de forma válida,
  `https://x.firebaseio.com`); localStorage `@mcm_preview_channel_enabled=1` y
  `@user_profile` con `onboardingCompleted: true`; ruta `/panuelo`.
  `/panuelo?demo=todas` da todas las piezas; `?demo=cero` empieza de cero;
  `?codigo=PASCUA27` abre el canje con el código escrito. Si Metro se queda sin
  memoria: `NODE_OPTIONS=--max-old-space-size=8192`.
- **Códigos de prueba**: `CONSOLACION`, `PASCUA27`, `CAMINO`, `VERANO`. Para uno
  nuevo, el hash es `sha256("<id>:<CÓDIGO NORMALIZADO>")`
  (`hashPanueloCode` en `utils/panuelo.ts`; el contrato lo explica).
- **Añadir una pieza**: un objeto nuevo en `firebase-seed/panuelo.json`; el test
  `__tests__/panuelo.test.ts` comprueba que no se pierde al sanearse. Una
  **forma nueva** (pin, glifo): un trazado en `constants/panueloGlyphs.ts` y su
  nombre en `PanueloGlyph`; luego `npm run build:panuelo`.
- **Colores**: `PanueloColors` en `constants/colors.ts` (tela, tinta de la
  serigrafía, metales). Hay un trinquete de números mágicos
  (`__tests__/noNewMagicNumbers.test.ts`): el color nuevo va a `constants/`.

## 7. Trampas que ya picaron

- **`dist/` está en `.gitignore`**: el bundle vivía ahí y nunca se subió; por eso
  se llama `generated/`. No lo vuelvas a mover a una carpeta ignorada.
- **Un push a `preview` con cambios en `package.json` hace saltar el guard
  nativo del workflow** (`ota-preview.yml`). Si solo es una dependencia de build
  (como `three`) no es un problema real, pero hay que mergear de forma que el
  rango del push no incluya ese cambio, o lanzar el workflow a mano con `force`.
  Detalle en `docs/desarrollo/OTA.md`.
- **`__tests__/comunica/datosScreen.test.tsx` falló en el CI** con el «sin
  conexión» por esperar solo 3 s (pasa en local); se subió a 10 s. Si vuelve a
  ponerse rojo, no es del pañuelo y la causa de fondo no está demostrada.
- **Todo lo que escribas en el visor y en `types/panuelo.ts`,
  `constants/panueloGlyphs.ts` o `utils/panueloPlacement.ts` obliga a regenerar el
  bundle** (§2).
- Tras tocar la rama: **`main` → `preview` → OTA**; `production` solo cuando el
  propietario lo pida y por tandas (`docs/desarrollo/OTA.md`, «Norma de ritmo»).
  Documenta los cambios importantes en `mcm-app/CHANGELOG.md` (con fecha y hora).
