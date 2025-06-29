// Fallback for using MaterialIcons on Android and web.

import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { SymbolWeight } from 'expo-symbols';
import { OpaqueColorValue, type StyleProp, type TextStyle } from 'react-native';

// Define a more specific type for our icon mapping
type IconMapping = {
  // Basic icons
  'house.fill': 'home';
  'paperplane.fill': 'send';
  'chevron.left.forwardslash.chevron.right': 'code';
  'chevron.right': 'chevron-right';
  close: 'close';
  settings: 'settings';

  // Song related icons
  'plus.circle': 'add-circle';
  'minus.circle': 'remove-circle';
  'doc.on.doc': 'content-copy';
  'square.and.arrow.up': 'share';
  'music.note.list': 'queue-music';
  trash: 'delete';
  'checkmark.circle.fill': 'check-circle';
};

type IconSymbolName = keyof IconMapping;

/**
 * Add your SF Symbols to Material Icons mappings here.
 * - see Material Icons in the [Icons Directory](https://icons.expo.fyi).
 * - see SF Symbols in the [SF Symbols](https://developer.apple.com/sf-symbols/) app.
 */
const MAPPING: IconMapping = {
  // Basic icons
  'house.fill': 'home',
  'paperplane.fill': 'send',
  'chevron.left.forwardslash.chevron.right': 'code',
  'chevron.right': 'chevron-right',
  close: 'close',
  settings: 'settings',

  // Song related icons
  'plus.circle': 'add-circle',
  'minus.circle': 'remove-circle',
  'doc.on.doc': 'content-copy',
  'square.and.arrow.up': 'share',
  'music.note.list': 'queue-music',
  trash: 'delete',
  'checkmark.circle.fill': 'check-circle',
};

/**
 * An icon component that uses native SF Symbols on iOS, and Material Icons on Android and web.
 * This ensures a consistent look across platforms, and optimal resource usage.
 * Icon `name`s are based on SF Symbols and require manual mapping to Material Icons.
 */
export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
  weight?: SymbolWeight;
}) {
  return (
    <MaterialIcons
      color={color}
      size={size}
      name={MAPPING[name]}
      style={style}
    />
  );
}
