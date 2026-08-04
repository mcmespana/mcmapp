import { requireNativeView } from 'expo';
import * as React from 'react';

import type { HighlightMenuViewProps } from './HighlightMenu.types';

const NativeView = requireNativeView<HighlightMenuViewProps>('HighlightMenu');

export default function HighlightMenuView(props: HighlightMenuViewProps) {
  return <NativeView {...props} />;
}
