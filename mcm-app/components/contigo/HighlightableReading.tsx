import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Platform,
  StyleSheet,
  Text,
  TextInput,
  type StyleProp,
  type TextStyle,
} from 'react-native';
import {
  computeSpans,
  highlightBg,
  type HighlightRange,
} from '@/utils/highlightRanges';
import { HighlightMenuView } from '@/modules/highlight-menu';

export interface ReadingSelection {
  start: number;
  end: number;
}

interface HighlightableReadingProps {
  /** Texto CANÓNICO de la lectura (ver normalizeReadingText). */
  text: string;
  /** Rangos subrayados (offsets sobre el texto canónico). */
  ranges?: HighlightRange[];
  /** Modo subrayar: en Android cambia a TextInput para conocer los offsets. */
  penMode?: boolean;
  /**
   * Selección nativa actual (null si no hay o es vacía). Se reporta SIEMPRE que
   * el texto sea un `TextInput` (en iOS, los dos modos), no solo en modo lápiz:
   * así el botón de subrayar puede usar la selección que ya hubiera hecha.
   */
  onSelectionChange?: (sel: ReadingSelection | null) => void;
  /**
   * "Subrayar" desde el menú NATIVO de selección, sin pasar por el modo lápiz.
   * Si no se pasa, el ítem no se añade y todo funciona como antes.
   */
  onNativeHighlightRequest?: (sel: ReadingSelection) => void;
  color: string;
  fontSize: number;
  lineHeight: number;
  fontFamily?: string;
  isDark: boolean;
  style?: StyleProp<TextStyle>;
}

/**
 * Texto de lectura con subrayados pastel y selección NATIVA de verdad.
 *
 * ## Por qué un `TextInput` de solo lectura
 *
 * `<Text selectable>` de RN se apoya en un `UILabel`/`TextView` recortado: la
 * selección es tosca, y en iOS **no** ofrece el menú completo del sistema
 * (Herramientas de escritura / Apple Intelligence, Traducir, Buscar…). Un
 * `TextInput` multilínea de solo lectura es un `UITextView` real, así que se
 * comporta como el texto de Notas o Safari: asas de arrastre, lupa y menú
 * nativo completo.
 *
 * Por eso en iOS usamos SIEMPRE la misma capa (no cambiamos de componente al
 * entrar en modo subrayar): el usuario no pierde la selección ni ve saltos de
 * layout, y el texto se puede copiar igual de bien en los dos modos.
 *
 * ## Los subrayados se ven SIEMPRE
 *
 * Los spans de color se pasan como hijos `<Text>` del propio `TextInput` (RN
 * los convierte en la cadena atribuida nativa), no como un `value` plano. Así
 * los subrayados siguen visibles dentro del modo subrayar, que es cuando más
 * falta hacen: se ve lo que ya está pintado mientras se pinta lo siguiente.
 *
 * ## Por plataforma
 *
 * - **iOS**: `TextInput` de solo lectura en los dos modos. Como la capa es la
 *   misma, la selección se conoce SIEMPRE: se puede seleccionar y tocar después
 *   el botón de subrayar, sin tener que entrar antes en el modo lápiz.
 * - **Android**: `Text selectable` al leer (menú nativo de copiar sin riesgo de
 *   pegar dentro) y `TextInput` al subrayar (única forma de conocer los
 *   offsets exactos de la selección). Ahí el camino de "selecciono y luego toco
 *   el lápiz" no puede funcionar —un `Text` no reporta offsets—; el atajo bueno
 *   en Android es el ítem "Subrayar" del propio menú de selección.
 * - **Web**: `Text` seleccionable al leer (selección del navegador) y
 *   `TextInput` con `value` al subrayar — RNW no admite hijos en el textarea,
 *   así que ahí el color se ve al salir del modo subrayar.
 *
 * Nota: el ítem "Subrayar" DENTRO del menú nativo requiere código nativo
 * (`UIMenu` propio en iOS / `ActionMode` en Android) y por tanto una build de
 * tienda. Ver `docs/funcionalidades/SUBRAYADO.md`.
 */
export function HighlightableReading({
  text,
  ranges = [],
  penMode = false,
  onSelectionChange,
  onNativeHighlightRequest,
  color,
  fontSize,
  lineHeight,
  fontFamily,
  isDark,
  style,
}: HighlightableReadingProps) {
  const spans = useMemo(() => computeSpans(text, ranges), [text, ranges]);

  // Altura del TextInput multilínea: seguimos el tamaño de su contenido para
  // que crezca como un texto normal dentro del scroll.
  const [inputHeight, setInputHeight] = useState<number | undefined>(undefined);

  // Al desmontar, la selección deja de existir. (Al SALIR del modo lápiz no se
  // toca: la selección es "pegajosa" a propósito, ver useReadingHighlights, y
  // quien la limpia de verdad es `exitHighlightMode` en la pantalla.)
  const onSelRef = useRef(onSelectionChange);
  onSelRef.current = onSelectionChange;
  useEffect(() => () => onSelRef.current?.(null), []);

  const textStyle = {
    color,
    fontSize,
    lineHeight,
    ...(fontFamily ? { fontFamily } : {}),
  } as const;

  // Hijos con los tramos subrayados. Sirven igual para `Text` que para
  // `TextInput` (RN los vuelca en la cadena atribuida nativa).
  const spanChildren = useMemo(
    () =>
      spans.map((s, i) =>
        s.color ? (
          <Text
            key={`${i}-${s.color}`}
            style={{ backgroundColor: highlightBg(s.color, isDark) }}
          >
            {s.text}
          </Text>
        ) : (
          <Text key={i}>{s.text}</Text>
        ),
      ),
    [spans, isDark],
  );

  // RNW no soporta hijos dentro del textarea: allí caemos a `value` plano.
  const isWeb = Platform.OS === 'web';
  // iOS siempre en UITextView; el resto solo cuando hace falta seleccionar.
  const asInput = Platform.OS === 'ios' || penMode;

  // El ítem del menú nativo se engancha envolviendo el texto. `withMenu` lo
  // hace opcional: sin `onNativeHighlightRequest` no se monta la vista nativa
  // y el árbol queda EXACTAMENTE como antes.
  const withMenu = (node: React.ReactElement) =>
    onNativeHighlightRequest ? (
      <HighlightMenuView
        label="Subrayar"
        onHighlightRequest={({ nativeEvent }) => {
          const { start, end } = nativeEvent;
          if (end > start) onNativeHighlightRequest({ start, end });
        }}
      >
        {node}
      </HighlightMenuView>
    ) : (
      node
    );

  if (!asInput) {
    return withMenu(
      <Text selectable style={[styles.base, textStyle, style]}>
        {spanChildren}
      </Text>,
    );
  }

  return withMenu(
    <TextInput
      style={[
        styles.base,
        styles.input,
        textStyle,
        style,
        { minHeight: lineHeight, height: inputHeight },
      ]}
      multiline
      scrollEnabled={false}
      // iOS: un UITextView de solo lectura sigue siendo seleccionable con asas
      // nativas y menú completo. Android necesita editable para poder
      // seleccionar; sin teclado no hay forma práctica de editar.
      editable={Platform.OS === 'android'}
      showSoftInputOnFocus={false}
      caretHidden
      onChangeText={() => {}}
      autoCorrect={false}
      spellCheck={false}
      textBreakStrategy="highQuality"
      onContentSizeChange={(e) =>
        setInputHeight(Math.ceil(e.nativeEvent.contentSize.height))
      }
      onSelectionChange={(e) => {
        // Se reporta SIEMPRE, también fuera del modo lápiz. Es lo que permite
        // seleccionar primero y tocar el lápiz después: si solo escucháramos
        // dentro del modo, la selección que ya había era invisible para JS y la
        // barra salía pidiendo "selecciona un texto" hasta que la movías un pelo.
        const { start, end } = e.nativeEvent.selection;
        // `end !== start`, no `end > start`: arrastrando de derecha a izquierda
        // Android reporta los offsets al revés, y con el `>` la selección se
        // descartaba como vacía (el Math.min/Math.max de al lado nunca llegaba
        // a ejecutarse).
        onSelRef.current?.(
          end !== start
            ? { start: Math.min(start, end), end: Math.max(start, end) }
            : null,
        );
      }}
      accessibilityLabel={
        penMode ? 'Selecciona el texto que quieres subrayar' : undefined
      }
      {...(isWeb ? { value: text } : { children: spanChildren })}
    />,
  );
}

const styles = StyleSheet.create({
  base: {
    fontWeight: '400',
    letterSpacing: 0,
    ...(Platform.OS === 'android'
      ? { includeFontPadding: false as const }
      : {}),
  },
  input: {
    padding: 0,
    paddingTop: 0,
    margin: 0,
    textAlignVertical: 'top',
    backgroundColor: 'transparent',
  },
});
