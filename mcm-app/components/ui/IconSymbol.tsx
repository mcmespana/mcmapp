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
  'chevron.left': 'chevron-left';
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
  'xmark.circle.fill': 'cancel';
  'tray.and.arrow.down': 'file-download';
  'square.and.arrow.up.on.square': 'file-upload';
  // Área privada nativa de Comunica
  checkmark: 'check';
  xmark: 'close';
  minus: 'remove';
  'circle.lefthalf.filled': 'contrast';
  'cross.case.fill': 'medical-services';
  'eye.slash': 'visibility-off';
  'figure.and.child.holdinghands': 'family-restroom';
  'exclamationmark.triangle.fill': 'warning';
  clock: 'schedule';
  'arrow.clockwise': 'refresh';
  'wifi.slash': 'wifi-off';
  'icloud.and.arrow.up': 'cloud-upload';
  'checkmark.icloud': 'cloud-done';
  'xmark.icloud': 'cloud-off';
  iphone: 'smartphone';
  'person.2': 'group';
  calendar: 'event';
  'list.bullet.clipboard': 'assignment';
  'chart.bar': 'bar-chart';
  lock: 'lock';
  'person.crop.circle': 'account-circle';
  'chevron.down': 'expand-more';
  magnifyingglass: 'search';
  'phone.fill': 'phone';
  'message.fill': 'chat';
  'arrow.up.right': 'open-in-new';
  'bell.fill': 'notifications';
  'square.and.pencil': 'edit';
  'person.3': 'groups';
  'chart.pie': 'pie-chart';
  creditcard: 'credit-card';
  'doc.text': 'description';
  camera: 'photo-camera';
  house: 'home';
  ticket: 'confirmation-number';
  bus: 'directions-bus';
  graduationcap: 'school';
  'heart.text.square': 'health-and-safety';
  flag: 'flag';
  envelope: 'mail';
  plus: 'add';
  link: 'link';
  'chevron.up': 'expand-less';
  'bell.slash': 'notifications-off';
  gearshape: 'settings';
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
  'chevron.left': 'chevron-left',
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
  'xmark.circle.fill': 'cancel',
  'tray.and.arrow.down': 'file-download',
  'square.and.arrow.up.on.square': 'file-upload',
  // Área privada nativa de Comunica
  checkmark: 'check',
  xmark: 'close',
  minus: 'remove',
  'circle.lefthalf.filled': 'contrast',
  'cross.case.fill': 'medical-services',
  'eye.slash': 'visibility-off',
  'figure.and.child.holdinghands': 'family-restroom',
  'exclamationmark.triangle.fill': 'warning',
  clock: 'schedule',
  'arrow.clockwise': 'refresh',
  'wifi.slash': 'wifi-off',
  'icloud.and.arrow.up': 'cloud-upload',
  'checkmark.icloud': 'cloud-done',
  'xmark.icloud': 'cloud-off',
  iphone: 'smartphone',
  'person.2': 'group',
  calendar: 'event',
  'list.bullet.clipboard': 'assignment',
  'chart.bar': 'bar-chart',
  lock: 'lock',
  'person.crop.circle': 'account-circle',
  'chevron.down': 'expand-more',
  magnifyingglass: 'search',
  'phone.fill': 'phone',
  'message.fill': 'chat',
  'arrow.up.right': 'open-in-new',
  'bell.fill': 'notifications',
  'square.and.pencil': 'edit',
  'person.3': 'groups',
  'chart.pie': 'pie-chart',
  creditcard: 'credit-card',
  'doc.text': 'description',
  camera: 'photo-camera',
  house: 'home',
  ticket: 'confirmation-number',
  bus: 'directions-bus',
  graduationcap: 'school',
  'heart.text.square': 'health-and-safety',
  flag: 'flag',
  envelope: 'mail',
  plus: 'add',
  link: 'link',
  'chevron.up': 'expand-less',
  'bell.slash': 'notifications-off',
  gearshape: 'settings',
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
