# Diseño del área nativa de Comunica: lo que ya sabemos

> Buenas prácticas **probadas** del área privada nativa (`app/(tabs)/comunica/`,
> `components/comunica/`). Complementa a [`design.md`](../../design.md) (la ley
> de toda la app) con lo aprendido pantalla a pantalla. Cada punto lleva de
> dónde sale: se añade uno cuando algo salió mal o se repitió, no por si acaso.
>
> El propietario, 28/10/2026: «Dale cariño al diseño, que casi me parecían
> mejor en el PHP de WordPress. Si en alguna pantalla es mejor romper el
> diseño original porque en React Native interesa de otra manera, adelante».
> O sea: **el plugin manda en QUÉ se enseña y en las palabras; el CÓMO es de
> app** (plan 03 §3), y tiene que verse al menos igual de cuidado.

## 1. Antes de pintar: busca la pieza

Ya existen, en `components/comunica/comun/` (y se usan, no se copian):

| Necesitas | Usa |
|---|---|
| Contenedor de pantalla con scroll, refresco y hueco de la barra | `AreaScreen` |
| Lista larga (más de ~40 filas) | `Animated.FlatList` + `useTabListScroll` + `ListCell` (como `GruposIndexScreen` y `EventRollList`) |
| Bloque de filas en una superficie | `Section` (corta) o `ListCell` con `cellPosition` (en `FlatList`) |
| Fila de persona | `PersonRow` (con `avatarTone="accent"` para monitores, `subtitleLead` para una pastilla) |
| Fila de marcar asistencia | `pasar-lista/RollRow` + `MarkSheet` — **no hay otra** (lo vigila un test) |
| Recuentos, aviso, «Han venido todos» | `pasar-lista/RollBits` (`Count`, `Notice`, `FillButton`) |
| Fila que lleva a otra pantalla | `NavRow` |
| Tarjeta de un registro (hoy, un evento) | `RecordCard` (con `cta` si se toca entera) |
| Filtro por chips pegado arriba | `FilterChips` en `stickyHeaderIndices` |
| Buscador dentro de la lista | `SearchField` |
| Cargando / vacío / error / sin acceso | `AreaState` (o `EmptyState` con su acción) |
| La acción principal | `AreaPrimaryButton` — **una por pantalla** (test `territorio`) |
| Guardar abajo | `BottomActionBar` (mide su alto; con `FlatList`, `onHeightChange`) |
| Estado de una subida | `UploadStatus` + `uploadText` |

Si a una pieza le falta algo para tu pantalla, **se amplía allí** (con su
prop documentada y, si toca, su test), no se hace una variante al lado. Origen:
el plan 07 iba a duplicar los chips y el buscador de Grupos y fichas; pasaron a
`comun/` y ahora los usan las dos.

## 2. Reglas que salieron de mirar capturas

1. **Si una tarjeta se toca entera, que se note.** Un «Pasar lista» en gris
   bajo el título no se lee como acción (captura del 28/10). `RecordCard` con
   `cta`: el texto en el acento con su flecha. Nunca un botón que repita lo
   que hace tocar la tarjeta.
2. **Un título tiene que entenderse solo.** Un grupo que en el CRM se llama
   «14» no puede ser el título de una sección: «Habitación 14»
   (`groupHeading`). Lo mismo con cualquier código suelto.
3. **Un control apagado dice por qué.** «El resto está (0)» apagado no dice
   nada; «Ya están todos marcados» sí. Nada de contadores a cero en un botón.
4. **Distinguir un papel de un vistazo, con contraste de verdad.** El fondo
   suave del chip de acento en el avatar de un monitor casi no se veía junto a
   los grises; el avatar en el acento lleno (`avatarTone`) sí.
5. **Iconos con `IconSymbol`, nunca un carácter** («⚠︎», «›», «✓» como texto).
   Si el icono no está en el mapa de `IconSymbol.tsx`, se añade allí.
6. **Una sola función para cada cosa repetida.** Había tres «sin acentos y en
   minúsculas» para buscar; ahora `utils/comunica/search.ts`. Antes de
   escribir un ayudante, `grep`.
7. **Listas largas: `FlatList`, chips pegados, buscador sin pegar** (como en
   el plugin). Secciones con título fuerte (`h3`) y su número; dentro, un
   subtítulo pequeño (curso) y una superficie por bloque. Pliegues con
   chevron y `accessibilityState.expanded`.

8. **Antes de inventar una tarjeta, el patrón vecino.** El aviso de «sin
   permiso» de los avisos (plan 08) nació como tarjeta ámbar propia; es
   `Section warning`, el mismo de «Te faltan 2 listas».
9. **Acción principal solo si hay algo que desbloquear.** Con los avisos
   activados, la pantalla de ajustes no tiene `AreaPrimaryButton`: los
   interruptores son el contenido. Sin permiso, la acción es activarlo.
10. **La explicación de una fila de interruptor, en `body` gris**, no en
    `caption`; el porqué de que esté apagada va UNA vez en el aviso de
    arriba, no repetido en cada fila.
11. **Mira el oscuro de cada token.** En oscuro `separator` y `card` son el
    mismo gris: un interruptor apagado sobre una tarjeta se quedaba en una
    bolita flotando (plan 08). Para pistas y bordes sobre una tarjeta oscura,
    `SystemGray.dark.gray2`.
12. **En web, «aquí no» con un `EmptyState` tranquilo** («Los avisos solo
    funcionan en la app del móvil»), sin esconder la pantalla. Decide el
    adaptador `.web.ts`; la pantalla solo pregunta.
13. **Iconos de cabecera: 44 × 44 de toque y la tinta de la cabecera**
    (`headerTint` en iOS, blanco sobre la barra en Android y web).
14. **El texto que sale de la app (compartir), como lo diría una persona:**
    fechas humanas, «hasta el 5» (el día cuenta entero), nada de barras.

## 3. Cómo se comprueba (antes de cada commit con pantallas)

- Tests: `npx tsc --noEmit && npm run lint && npm test` (en particular
  `territorio`, `noNewMagicNumbers`, `designTokens`).
- **Capturas web a 375 px, en claro y en oscuro**, recorriendo la pantalla
  con toques de verdad (Playwright sobre `npx expo export --platform web` con
  `EXPO_PUBLIC_COMUNICA_API=fake`). Navegar a golpe de URL en vez de tocar ha
  dejado pantallas en esqueleto que con toques cargan bien: toca.
- Mira la captura buscando lo de §2 y el test de entornar los ojos de
  `design.md` §10.
- **Las capturas, a la vez que la pantalla, no al final**: en el plan 08 los
  dos fallos de verdad solo salieron en la captura en oscuro.

## 4. Lo que la web no enseña bien (no lo «arregles» mirando solo la web)

- En web, una fila pulsable (`PressableFeedback` con `Highlight` y `gap`)
  queda unos 12 px más a la derecha que una fila quieta al lado. Es de la web,
  no del móvil: está apuntado en `PLAN_DISENO.md` (H10).
- La cabecera de iOS es transparente: lo que se pega arriba (chips) hay que
  verlo en un dispositivo.
