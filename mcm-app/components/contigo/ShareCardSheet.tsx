/**
 * Hoja para compartir una tarjeta como imagen: la vista previa, el estilo, el
 * formato (historia o cuadrada) y un botón. La usan el evangelio del día y
 * «Tu año en Contigo»; cada uno le pasa cómo se dibuja su tarjeta.
 */
import React, { useRef, useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { PressableFeedback } from 'heroui-native';
import BottomSheet from '@/components/BottomSheet';
import ShareCardView, {
  type ShareCardHandle,
} from '@/components/contigo/ShareCardView';
import { warm } from '@/components/contigo/theme';
import AppPrimaryButton from '@/components/ui/AppPrimaryButton';
import SegmentedControl from '@/components/ui/SegmentedControl';
import { MaterialIcons } from '@/components/ui/icons';
import spacing from '@/constants/spacing';
import typography from '@/constants/typography';
import { radii, shadows } from '@/constants/uiStyles';
import { useToast } from '@/contexts/AppToastContext';
import { useColorScheme } from '@/hooks/useColorScheme';
import { h } from '@/utils/haptics';
import {
  CARD_STYLES,
  CARD_STYLE_LABELS,
  cardPalette,
  type CardFormat,
  type CardSpec,
  type CardStyle,
} from '@/utils/shareCard';
import type { HighlightColorKey } from '@/utils/highlightRanges';

interface Props {
  visible: boolean;
  onClose: () => void;
  title: string;
  fileName: string;
  /** Color del subrayado, para los estilos que lo usan. */
  color?: HighlightColorKey;
  build: (style: CardStyle, format: CardFormat) => CardSpec;
  /** Si hay varias frases entre las que elegir. */
  count?: number;
  index?: number;
  onIndex?: (index: number) => void;
}

const FORMATS = [
  { value: 'story' as const, label: 'Historia' },
  { value: 'square' as const, label: 'Cuadrada' },
];

export default function ShareCardSheet(props: Props) {
  return (
    <BottomSheet
      visible={props.visible}
      onClose={props.onClose}
      title={props.title}
    >
      {props.visible ? <Body {...props} /> : null}
    </BottomSheet>
  );
}

function Body({
  fileName,
  color,
  build,
  count = 1,
  index = 0,
  onIndex,
}: Props) {
  const isDark = useColorScheme() === 'dark';
  const w = warm(isDark);
  const { toast } = useToast();
  const { height: windowH } = useWindowDimensions();
  const [style, setStyle] = useState<CardStyle>('papel');
  const [format, setFormat] = useState<CardFormat>('story');
  const [busy, setBusy] = useState(false);
  const card = useRef<ShareCardHandle>(null);

  const spec = build(style, format);
  // La vista previa cabe en un tercio largo de la pantalla.
  const maxH = Math.min(380, windowH * 0.42);
  const previewW = Math.min(260, (maxH * spec.width) / spec.height);

  return (
    <View style={styles.root}>
      <View style={styles.previewRow}>
        {count > 1 && (
          <Arrow
            icon="chevron-left"
            label="Frase anterior"
            onPress={() => onIndex?.((index - 1 + count) % count)}
            color={w.textSec}
          />
        )}
        <View style={[styles.preview, shadows.raised]}>
          <ShareCardView ref={card} spec={spec} width={previewW} />
        </View>
        {count > 1 && (
          <Arrow
            icon="chevron-right"
            label="Frase siguiente"
            onPress={() => onIndex?.((index + 1) % count)}
            color={w.textSec}
          />
        )}
      </View>

      <View
        style={styles.styles}
        accessibilityRole="radiogroup"
        accessibilityLabel="Estilo"
      >
        {CARD_STYLES.map((s) => {
          const p = cardPalette(s, color);
          const on = s === style;
          return (
            <PressableFeedback
              key={s}
              onPress={() => {
                h.select();
                setStyle(s);
              }}
              style={styles.styleItem}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              accessibilityLabel={CARD_STYLE_LABELS[s]}
            >
              <View
                style={[
                  styles.swatch,
                  {
                    backgroundColor: p.bg,
                    borderColor: on ? w.accent : w.border,
                    borderWidth: on ? 2 : 1,
                  },
                ]}
              >
                <Text style={[styles.swatchGlyph, { color: p.text }]}>Aa</Text>
              </View>
              <Text
                style={[
                  styles.styleLabel,
                  { color: on ? w.accentText : w.textSec },
                ]}
              >
                {CARD_STYLE_LABELS[s]}
              </Text>
            </PressableFeedback>
          );
        })}
      </View>

      <View style={styles.formats}>
        <SegmentedControl
          options={FORMATS}
          value={format}
          onChange={setFormat}
          accentColor={w.accent}
          accessibilityLabel="Formato"
        />
      </View>

      <AppPrimaryButton
        label="Compartir imagen"
        icon="ios-share"
        loading={busy}
        color={w.accent}
        onPress={async () => {
          setBusy(true);
          const ok = await card.current?.share(fileName);
          setBusy(false);
          if (!ok) {
            toast.show({
              variant: 'danger',
              label: 'No se ha podido crear la imagen',
            });
          }
        }}
      />
    </View>
  );
}

function Arrow({
  icon,
  label,
  onPress,
  color,
}: {
  icon: 'chevron-left' | 'chevron-right';
  label: string;
  onPress: () => void;
  color: string;
}) {
  return (
    <PressableFeedback
      onPress={() => {
        h.select();
        onPress();
      }}
      style={styles.arrow}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <MaterialIcons name={icon} size={28} color={color} />
    </PressableFeedback>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.md, paddingBottom: spacing.md },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  preview: { borderRadius: radii.md, overflow: 'hidden' },
  arrow: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  styles: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.md,
  },
  styleItem: { alignItems: 'center', gap: spacing.xs, minWidth: 56 },
  swatch: {
    width: 48,
    height: 48,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatchGlyph: { ...typography.title, fontFamily: typography.serif.fontFamily },
  styleLabel: { ...typography.footnote, fontWeight: '600' },
  formats: { flexDirection: 'row' },
});
