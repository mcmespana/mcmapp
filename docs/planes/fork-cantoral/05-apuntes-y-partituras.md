# 05 · Apuntes, arreglos personales y partituras

> Parte del plan [`README.md`](README.md). Cubre: «arreglos personalizados y
> en directo, anotarte cosas y guardarlo como perfil guitarra, bajo,
> batería…», «ensayar en grupo: apuntes para todos, para ciertos instrumentos
> o para mí» y «sistema de notación: dibujar una melodía o un riff».
> **No entra para Villancicos** (salvo las notas por canción que ya traen los
> bloques); es la Fase 5.

---

## 1. Tres cosas distintas que hoy se llaman igual

| Qué | Quién lo escribe | Dónde vive | Se ve |
| --- | ---------------- | ---------- | ----- |
| **Arreglo** (`{arr: …}`) | El cantoral (admin) | Dentro del `.cho`, en `songs/data` | Para todo el mundo, en las dos apps |
| **Nota de repertorio** | Quien monta el repertorio | En el elemento del repertorio (`notes`, como los packs) | Para quien abre ese repertorio |
| **Apunte** (lo nuevo) | Cualquiera | En el dispositivo, y si se comparte, en el coro o en el repertorio | Según su capa |

El arreglo oficial no se toca: es del cantoral. Los apuntes son una **capa
encima** de la hoja, nunca cambian el ChordPro.

## 2. Capas de apuntes

| Capa | Para | Guardado | Compartido |
| ---- | ---- | -------- | ---------- |
| **Solo yo** | Lo mío («respira aquí») | Dispositivo | No |
| **Mi instrumento** | Guitarra, bajo, batería/percusión, teclado, viento, cuerda, voz (+ personalizado) | Dispositivo | Con quien tenga ese instrumento en mi coro, si lo comparto |
| **Todos** | Indicaciones del ensayo («el 2º estribillo a capela») | Dispositivo | Con el coro (o dentro del repertorio) |

- **Mi instrumento** se elige una vez (Ajustes, y al unirse a un directo). Se
  puede tener más de uno («guitarra + voz»). El Atril pinta las capas que
  elijas en ✎ (por defecto: Todos + mis instrumentos + Solo yo).
- En **directo** el maestro puede mandar un apunte de capa *Todos* o de un
  instrumento («bajo: aquí entras») y aparece al momento en esa línea.

## 3. Qué puede ser un apunte

- **Texto en una línea** (toque largo en la línea → escribir). Igual que el
  editor de arreglos de admin de hoy (`components/ArrangementInputModal.tsx`
  y el `data-line` de la hoja), pero sin tocar el ChordPro.
- **Marca**: dinámica (p, mf, f, crescendo), «a capela», «solo», «x2», ⟲.
- **Resaltado** de un trozo de letra (color de capa).
- **Acorde alternativo** («aquí yo hago Sus4») — se pinta junto al acorde.
- **Riff / melodía** en notación (§5).

## 4. Anclaje (que no se pierdan cuando cambia la canción)

Un apunte se ancla a `(categoría de casa, filename)` + **número de línea** +
**huella del texto de esa línea** (normalizado). Al abrir una canción cuyo
contenido ha cambiado:

1. Si la línea con ese número tiene la misma huella → se queda.
2. Si no, se busca la línea más parecida (distancia de edición por palabras,
   la misma idea que `buildSheet` usa para estribillos repetidos) → se mueve.
3. Si nada se parece ≥ 70 % → **huérfano**: se enseña al final de la canción
   con «¿Dónde iba esto?» para recolocarlo.

Función pura `reanchorNotes(notes, content)` con tests (es la parte frágil).

## 5. Partituras: riffs y melodías cortas

**Formato: ABC** (texto, estándar, cabe en una línea de JSON y es lo que
ChordPro 6 admite dentro de `{start_of_abc}`…`{end_of_abc}`). Ejemplo de un
riff de trompeta:

```
X:1
L:1/8
K:G
d2 dB c2 cA | B4 G4 |]
```

- **Por qué ABC y no otra cosa**: ChordPro define `abc`, `ly` (LilyPond),
  `svg` y `textblock` como entornos delegados; LilyPond necesita su programa
  (no hay pintor en JS), VexFlow es solo una API de dibujo sin formato de
  texto, y MusicXML (OpenSheetMusicDisplay) es demasiado pesado para un riff.
  Reglas de ChordPro para ABC: empieza por `X:1`, `K:` obligatorio, y
  `{transpose}` también le afecta.
- **Pintar**: `abcjs` 6.7.x (MIT) dentro del WebView de la hoja (ya es
  HTML), en SVG que sigue el tema:
  `ABCJS.renderAbc(el, src, { responsive: 'resize', visualTranspose: n })`
  — `visualTranspose` hace que el riff siga el tono de la canción.
- **ChordSheetJS 18** (la que ya usa la app) reconoce `{start_of_abc}` como
  párrafo literal y acepta `delegates: { abc: (src) => html }`. Ojo: los
  formateadores convierten saltos de línea en `<br>`, así que el delegado
  devuelve **un marcador de una línea**
  (`<div class="abc" data-abc="…codificado…">`) y abcjs lo pinta después en
  el WebView. (La hoja propia, `buildSheet`, tiene que dejar pasar ese
  párrafo: es zona espejo.)
- **Escuchar** el riff (▶ junto al pentagrama) con el sintetizador de abcjs.
  Por defecto baja los sonidos de GitHub: **empaquetar una soundfont** y
  pasar `soundFontUrl` para que funcione sin red. El audio arranca con un
  toque (norma de los navegadores).
- **Dónde se escribe primero** (decisión D-16: «más importante que la IA
  es poderlo escribir en la web del admin del cantoral de forma sencilla»):
  **en el admin del cantoral** (`mcmapp-cantoral/scripts/admin`). Un bloque
  «🎺 Riff / melodía» en el editor de la canción, con el teclado de piano de
  abajo y la **vista previa con abcjs** al lado (el admin ya pinta con la hoja
  de la app, `mcm-sheet.js`). Se guarda en el `.cho` como
  `{start_of_abc: Trompeta}` … `{end_of_abc}`, y así lo ve **todo el
  mundo, en las dos apps**. Los riffs personales en la app (capa de
  apuntes) vienen después.
- **Dependencia entre apps** (igual que el marcado): el generador
  (`crear_songs_json.py`) tiene que **dejar pasar** el bloque ABC en
  `content`, y eso solo se activa (`APP_ABC = True`, como `APP_MARKUP`)
  cuando **MCM App y el fork** lo pinten; si no, MCM App enseñaría el ABC en
  crudo. El cantoral de MCM App solo crece (T-07): la hoja con ABC es zona
  espejo y va a las dos.
- **Escribir sin saber ABC** (lo normal), en el admin y luego en la app:
  1. **Teclado de piano** en una hoja: tocas notas, eliges duración
     (𝅝 𝅗𝅥 ♩ ♪), silencio, ligadura; se ve el pentagrama mientras escribes y
     se guarda ABC. Es lo más rápido para «la trompeta hace esto».
  2. **Texto ABC** para quien lo sepa.
  3. **Tararéalo o tócalo** (sin IA de por medio): el **afinador ya sigue
     el tono** nota a nota (`utils/tuner/pitchTracker.ts`); se trocea en
     notas, se cuadra al tempo del metrónomo y sale ABC para revisar. Para
     una sola voz (una trompeta, una melodía) funciona mejor que los modelos
     polifónicos y no necesita red.
  4. **IA** (fase posterior, opcional): audio → notas con *Basic Pitch*
     (Spotify, Apache-2.0; hay modelos ONNX/TFLite/CoreML) para lo que el
     paso 3 no saque; o «descríbelo» → un modelo de lenguaje propone ABC.
     Siempre se valida con el parser de abcjs y se enseña pintado para
     confirmar. Si usa un modelo de lenguaje, **va por el NAS** del
     cantoral, como ya va la lectura de fotos de canciones: la app no lleva
     claves.
- **Llegar al cantoral oficial**: un riff que todos deberían tener se puede
  proponer como edición de la canción (`{start_of_abc}` en el `.cho`). Eso
  requiere que el generador de `mcmapp-cantoral` deje pasar el bloque y que
  la hoja lo pinte en las dos apps → divergencia importable (ver
  `DIVERGENCIAS.md`).

## 6. Compartir apuntes

- **Dentro de un repertorio** (subido al coro o a `/playlistShares`): el
  repertorio lleva los apuntes de capa *Todos* y de instrumento de sus
  canciones. Es la forma más sencilla y no necesita nodos nuevos: al
  importar el repertorio, llegan los apuntes.
- **Por coro** (más adelante): `/choirs/{id}/apuntes/{songKey}` para que los
  apuntes del coro estén en cualquier repertorio. Necesita regla nueva y
  contraseña del coro para escribir (el mismo modelo `coco` de COROS.md).
  Decidido (D-11): primero dentro del repertorio; por coro, después.
- **En directo**: el maestro los manda por el canal de directo (`04`).

## 7. Datos (borrador)

```ts
type Apunte = {
  id: string;                 // uuid
  song: { category: string; filename: string };   // la de casa
  line: number; lineHash: string;
  layer: 'yo' | 'todos' | `inst:${Instrumento}`;
  kind: 'texto' | 'marca' | 'resaltado' | 'acorde' | 'abc';
  text?: string; abc?: string; range?: [number, number];
  author?: { deviceId: string; name?: string };
  updatedAt: number;
};
```

Almacén: fichero JSON por canción en el sistema de ficheros (como el
catálogo, ver `02`), índice en memoria. Exportable dentro del `.mcm`.

## 8. Tareas (Fase 5)

| # | Tarea | Modelo |
| - | ----- | ------ |
| 5.1 | Modelo `Apunte`, almacén, `reanchorNotes` + tests | Opus |
| 5.2 | Capas en el Atril (pintar dentro del WebView, por encima de la hoja) y toque largo para crear | Opus |
| 5.3 | Instrumento(s) en Ajustes y al unirse a un directo | Sonnet |
| 5.4 | Apuntes dentro del repertorio (subir/importar) | Sonnet |
| 5.5 | ABC: pintar con abcjs en la hoja (zona espejo: fork **y** MCM App) + ▶ escuchar con soundfont empaquetada | Opus |
| 5.5b | **Admin del cantoral**: bloque «Riff / melodía» con teclado de piano y vista previa abcjs; generador con `APP_ABC` | Opus (repo `mcmapp-cantoral`) |
| 5.6 | Teclado de piano → ABC en la app (riffs personales) | Opus |
| 5.7 | Apuntes en directo (maestro → capa) | Opus |
| 5.8 | Tararear/tocar → ABC con el seguidor de tono del afinador | Opus |
| 5.9 | IA (Basic Pitch y/o modelo de lenguaje vía NAS) | Opus, tras D-16 |
