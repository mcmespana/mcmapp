# PLAN_DISENO.md — Unificar el diseño hacia un solo sitio

> **Estado:** 🟡 en curso. Creado el 2026-09-02 al escribir
> [`design.md`](../../design.md); dos pasadas ejecutadas el 2026-09-02/03.
>
> **Qué es:** la lista de incoherencias reales de diseño detectadas **con
> evidencia en el código**, más las mejoras que conviene meter de paso, con el
> destino elegido para cada una.
>
> **Cuándo se ejecuta:** bolsa oportunista. Es la tarea de "me sobran tokens"
> alternativa a subir cobertura (`docs/desarrollo/COBERTURA.md`) cuando el
> usuario prefiera tocar diseño.
>
> **Regla al ejecutar:** una tarea = un commit = tachar su casilla aquí. Si
> cambia una **regla**, actualiza `design.md`; si cambia un **valor**,
> `docs/desarrollo/DESIGN.md`.

---

## Lo que hay que saber antes de tocar nada

**Tres veces en este plan el token resultó ser el raro, no el código.** Es el
patrón que más se repite y conviene tenerlo delante:

1. `brand.success` y `brand.warning` se llamaban como estados, pero pintaban la
   pantalla de Reflexiones y las estrellas de valoración.
2. `constants/typography.ts` declaraba siete tamaños y los cinco más usados del
   repo no estaban. Por eso lo importaban 6 ficheros y había 666 `fontSize` a
   mano: un token que no cubre tu caso no se usa, se rodea.
3. La escala de **pesos** que yo mismo escribí (500 para acciones) aparecía en 3
   sitios; 600 y 700 sumaban 53.

**Antes de migrar 100 sitios a un token, cuenta cuántos sitios ya hacen otra
cosa.** Si la mayoría hace otra cosa, el que está mal es el token.

Y dos correcciones de diagnóstico mías, por si vuelven a aparecer:

- **No compares los dos hex de un par claro/oscuro entre sí.** Cada uno se mide
  contra SU fondo; que el oscuro sea "más oscuro" no significa nada.
- **Un color de marca como relleno está bien; como primer plano en oscuro, no.**
  Esa distinción faltaba y se coló en cinco pantallas.

---

## Norte: hacia dónde unificamos

1. **Un solo sitio para los tokens: `mcm-app/constants/*.ts`.** Las demás capas
   (`global.css`, el espejo del panel) **derivan** de ahí.
2. **Semántica antes que nombre bonito.** Un token se llama por lo que
   significa, no por dónde se usó primero ni por su tamaño relativo.
3. **StyleSheet es el motor de la app; `className` es la excepción.** No se
   migra a Tailwind: se evita que la capa CSS contradiga a la de RN.
4. **El panel mantiene su estética; solo espeja el color cuando representa a la
   app.** Detalle en `design.md` §9.
5. **Nada de "y ya que estoy".** Los archivos grandes siguen grandes (decisión
   del usuario, 2026-08-15).

---

## ✅ Hecho

Con su hallazgo, porque el hallazgo es lo que vale para la próxima vez.

| §      | Qué                   | Lo que se aprendió                                                                                  |
| ------ | --------------------- | --------------------------------------------------------------------------------------------------- |
| A1     | Marca cromática       | `accent` NO había que renombrarlo (sí se usa como acento). Los que mentían eran `success`/`warning` |
| A2     | Los dos amarillos     | `#FCD200` es marca, `#f4c11e` es cantoral. Regla escrita                                            |
| A4     | Docblock de `colors`  | Nombraba dos excepciones que no declaraba                                                           |
| A5     | Roles de color        | Los hex no eran colores sueltos: eran **pares** claro/oscuro sin token. De 1.363 hex a 865          |
| A6     | Colores sin dueño     | Eran roles: enlace, texto fuerte, secundario, destacado ámbar, verde de Carismochito                |
| B      | Dos motores de estilo | `global.css` son nombres de HeroUI, no nuestro vocabulario. Test que impide que diverjan            |
| C      | Tipografía            | Escala ampliada a lo que la app usa; pesos ajustados a la realidad. De 666 `fontSize` a 276         |
| D      | Sombras               | El nombre mentía: `lg` (0,3) era más fuerte que `xl` (0,18). Renombradas por función                |
| E      | Radios                | De nueve escalones a siete, en la rejilla de 4 px. El `10` NO es deuda: es radio anidado            |
| F1–3   | Responsive            | Había **dos** hooks; el que documentaba `DESIGN.md` tenía cero usos                                 |
| G1     | Espejo en el panel    | El selector de calendario ofrecía 20 pasteles con 3 colores de MCM enterrados                       |
| G2     | Panel oscuro-only     | Declaraba `darkMode: class` sin bloque `.dark`                                                      |
| H1     | Anillo de foco        | Puesto en `AppPrimaryButton`. **Revertido en `AppTextField`**: desplazaba el campo 1 px al escribir |
| H2     | `EmptyState`          | No cumplía su propio contrato de paleta. Ahora sí, y tiene variante `compact`                       |
| H3     | Home                  | ❌ Nada que hacer: la nota del TODO llevaba tiempo describiendo una Home que ya no existe           |
| H4     | Marca en oscuro       | **Bug real**: el azul de marca da 1,31:1 sobre el fondo oscuro. Cinco pantallas afectadas           |
| H7     | Guardarraíles         | Cinco trinquetes de test: colores, tamaños, radios, contraste y marca-en-primer-plano               |
| H11    | Pares "del revés"     | ❌ Mi diagnóstico era falso. Pero el contraste real sí estaba por debajo del mínimo, y se subió     |
| A6-bis | `onColor()`           | La misma pregunta resuelta **cinco veces con cinco umbrales a ojo**. Ahora, por contraste real      |

---

## ❌ Decidido que NO — no lo vuelvas a proponer

- **F4. Unificar las cuatro anchuras máximas.** Decisión del usuario
  (2026-09-03): _"no destruyas el layout del iPad, me gusta como está"_. La app
  limita el contenido a 640, 760, 960 o 1200 según la pantalla y **se queda
  así**.
- **H8. Capas de superficie en modo oscuro.** Iba a hacerlo y el test de
  contraste lo desaconsejó: dar color propio a las cards (`#3A3A3C`) deja el
  texto terciario encima en **3,48:1**. Arrastraría subir también el terciario,
  y entonces ya no es terciario. Lo de ahora —plano con hairline— se lee. Hay
  un test que avisa si alguien lo intenta.
- **E3. El `borderRadius: 10`.** No es deuda, es geometría: `SegmentedControl`
  lleva `padding: 2`, así que el radio interior es el exterior menos el hueco.
  Convertido en regla (`design.md` §5).

---

## 🟡 Pendiente

### Necesita un dispositivo (no se puede hacer a ciegas)

- [ ] **H9. Verificar lo que ya cambió.** Cinco pantallas, en claro y oscuro:
      cantoral (texto tenue), **Notificaciones en oscuro** (era donde los
      controles estaban invisibles), Contigo (vacíos y esquinas), playlists
      (ámbar) y Contactos/Calendario/Grupos (grises). **Es lo único que bloquea
      mover `production`.**
- [ ] **A3. Tres dorados para Contigo.** `TabHeaderColors.contigo` (`#B8860B`)
      no es el mismo que el acento de la pantalla que abre (`#C4922A`). Cambia
      un color visible en la cabecera.
- [ ] **H10 / H12. `text` y `textStrong` casi no se distinguen, y están
      invertidos en los dos modos.** En claro `text` es `#11181C` y
      `textStrong` `#1C1C1E` —el "fuerte" es más claro que el cuerpo—; en
      oscuro, `#FFFFFF` contra `#F5F5F7`, también al revés.
      En iOS no existe un nivel por encima del label primario: título y cuerpo
      se distinguen por tamaño y peso, no por color. Lo más probable es que
      `textStrong` sobre y haya que fundirlo con `text`, quedándose con lo que
      la app usa más (claro `#1C1C1E`, oscuro `#F5F5F7`).
      Cambia el color de TODO el texto de la app por un 1% de luminancia: se
      mira antes. Si se confirma, es **borrar** un token, no añadir otro.
- [ ] **A6-quater. El tinte de las cabeceras nativas.** `isDark ? '#FFFFFF' :
    '#1a1a1a'` a mano en ~8 sitios (cantoral, fotos, calendario, botones de
      volver). No es byte-idéntico a ningún rol. O se le da uno propio o se
      alinea con `textStrong` — pero son cabeceras nativas.

### Trabajo de abrir el fichero y decidir (sin regla general que aplicar)

- [ ] **A5.5. Los 865 hex que quedan.** Aquí se acabó lo mecánico: son hex cuyo
      VALOR coincide con un token pero cuyo PAPEL no (el mismo `#1C1C1E` es un
      gris de superficie en un sitio y "texto casi negro" en otro). Cambiarlo
      por un token mal nombrado es peor que dejarlo. Los que más tienen:
      `TransposeBottomSheet`, `SongFontBottomSheet`, `contigo/oracion`,
      `contigo/evangelio`, `onboarding`.
- [ ] **C6. Los 276 `fontSize`.** Tamaños fuera de escala (26, 20, 30, 9, 48…)
      o combinaciones con un peso que no es el del token.
- [ ] **E5. Los radios sueltos**: 3, 6, 5, 2, 13, 26, 30, 19.
- [ ] **F5.** Los dos `screenW >= 640` de `onboarding.tsx`.
- [ ] **G3.** Auditoría de vocabulario app ↔ panel ↔ contratos.

### Mejoras, sin prisa

- [ ] **H1-ter.** `SegmentedControl` no tiene indicador de foco. Ahí el pulsado
      y el seleccionado ya compiten por el mismo espacio visual: hay que
      pensarlo, no copiar el patrón del botón.
- [ ] **H2-bis.** `ShareQrModal` no se migró a `EmptyState` a propósito: no es
      un vacío, es un aviso con su botón al lado. Revisar si merece otro patrón.
- [ ] **H5. Un `Chip` canónico.** Mezcla de `Chip` de heroui y pills custom
      (pendiente también en `PLAN_UI_NATIVA.md` §5).
- [ ] **H6. Densidad de la lista de canciones.** Es la pantalla más usada y de
      las menos tokenizadas. Al migrarla (A5.5), revisar de paso altura de fila
      y jerarquía título/subtítulo/pill de tono.

---

## Orden sugerido si hay un hueco

1. **H9** — verificar en dispositivo. Desbloquea todo lo demás de la lista de
   arriba y es lo único que impide publicar.
2. **H10/H12** y **A3** — los otros dos de dispositivo, en la misma sesión.
3. **C6**, **A5.5**, **E5** — revisión fichero a fichero.
4. **H1-ter**, **H5**, **H6** — mejoras.

**No propongas F4 ni H8**: están decididos que no, con su motivo arriba.
