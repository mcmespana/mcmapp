// La tarjeta de registro del área privada (`stic-rec-*` del plugin, §6.1 de su
// `design.md`): pastilla, título, líneas, cápsula de fecha y UNA acción.
//
// Dos maneras de usarla, nunca las dos a la vez: o se toca la tarjeta entera
// (`onPress`), o lleva un botón (`action`). Un botón que repite lo que hace
// tocar la tarjeta es justo lo que no se envía.
//
// `featured` es la del atajo de la portada («Hoy · C1 · Los Peques»): un BLOQUE
// de marca (degradado con brillo, como `.pl-hero` del plugin). Cuenta para el
// tope de dos bloques por pantalla, y por eso se usa a través de
// `FeaturedRecordCard`: así el test del territorio puede contarlas. Dentro del
// bloque, chip y cápsula van `onGradient` (marca sobre marca no) y el botón es
// blanco con tinta violeta (`--on-brand` / `--brand-blue-fixed` del plugin).

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PressableFeedback } from 'heroui-native';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { radii } from '@/constants/uiStyles';
import typography from '@/constants/typography';
import { h } from '@/utils/haptics';
import BrandGradient from './BrandGradient';
import CardSurface from './CardSurface';
import DateCapsule from './DateCapsule';
import StatusChip from './StatusChip';
import type { ChipTone } from './theme';
import { useComunicaTheme } from './useComunicaTheme';

type IconName = React.ComponentProps<typeof IconSymbol>['name'];

/** Una línea de la tarjeta: texto suelto, o con un icono delante («dónde»). */
export type RecordLine = string | { icon: IconName; text: string };

interface Props {
  /** Pastilla de arriba: «Hoy», «Hace 6 días», «Pasada»… */
  kicker?: { label: string; tone?: ChipTone };
  /** El código en negrita (C1) y el nombre, si aporta (§6.2 de Pasar Lista). */
  code?: string | null;
  title: string;
  lines?: RecordLine[];
  day?: string;
  /** `neutral` para una fecha pasada (el `.is-past` del plugin). */
  capsuleTone?: 'brand' | 'neutral';
  featured?: boolean;
  onPress?: () => void;
  /**
   * Con `onPress`: lo que pasa al tocarla, en el acento y con flecha
   * («Pasar lista ›»). Dice que la tarjeta entera es el enlace sin pintar un
   * botón que lo repita.
   */
  cta?: string;
  action?: { label: string; onPress: () => void };
  accessibilityLabel?: string;
}

const lineText = (l: RecordLine) => (typeof l === 'string' ? l : l.text);

export default function RecordCard({
  kicker,
  code,
  title,
  lines = [],
  day,
  capsuleTone = 'brand',
  featured = false,
  onPress,
  cta,
  action,
  accessibilityLabel,
}: Props) {
  const t = useComunicaTheme();
  const ink = featured ? t.onGradient : t.text;
  const inkSoft = featured ? t.onGradient : t.textSecondary;
  const a11y =
    accessibilityLabel ??
    [kicker?.label, code, title, ...lines.map(lineText)]
      .filter(Boolean)
      .join(', ');

  const body = (
    <>
      <View style={styles.top}>
        <View style={styles.main}>
          {kicker ? (
            <View style={styles.kicker}>
              <StatusChip
                label={kicker.label}
                tone={kicker.tone ?? 'neutral'}
                onGradient={featured}
              />
            </View>
          ) : null}
          <Text
            style={[featured ? styles.titleBig : styles.title, { color: ink }]}
            numberOfLines={2}
          >
            {code ? <Text style={styles.code}>{code}</Text> : null}
            {code && title ? ' · ' : null}
            {title}
          </Text>
          {lines.map((l) => (
            <View key={lineText(l)} style={styles.lineRow}>
              {typeof l === 'string' ? null : (
                <IconSymbol
                  name={l.icon}
                  size={14}
                  color={featured ? t.onGradient : t.accentText}
                />
              )}
              <Text style={[styles.line, { color: inkSoft }]} numberOfLines={2}>
                {lineText(l)}
              </Text>
            </View>
          ))}
          {cta && onPress && !action ? (
            <View style={styles.cta}>
              <Text
                style={[
                  styles.ctaLabel,
                  { color: featured ? t.onGradient : t.accentText },
                ]}
              >
                {cta}
              </Text>
              <IconSymbol
                name="chevron.right"
                size={14}
                color={featured ? t.onGradient : t.accentText}
              />
            </View>
          ) : null}
        </View>
        {day ? (
          <DateCapsule day={day} tone={featured ? 'onGradient' : capsuleTone} />
        ) : null}
      </View>
      {action ? (
        <PressableFeedback
          onPress={() => {
            h.tap();
            action.onPress();
          }}
          accessibilityRole="button"
          accessibilityLabel={action.label}
          style={[
            styles.action,
            { backgroundColor: featured ? t.onGradient : t.accentFill },
          ]}
        >
          <PressableFeedback.Scale />
          <Text
            style={[
              styles.actionLabel,
              { color: featured ? t.onGradientInk : t.onAccent },
            ]}
          >
            {action.label}
          </Text>
        </PressableFeedback>
      ) : null}
    </>
  );

  // `clip`: el degradado y las esquinas se recortan al radio; en la destacada
  // el borde y el fondo son el violeta para que no asome un aro gris (y para
  // que Android tenga fondo donde pintar la `elevation`).
  const card = (
    <CardSurface
      clip
      elevated={featured}
      background={featured ? t.accentFill : undefined}
      style={featured ? { borderColor: t.accentFill } : undefined}
      accessibilityLabel={onPress || action ? undefined : a11y}
    >
      {featured ? <BrandGradient variant="block" sheen /> : null}
      <View style={styles.pad}>{body}</View>
    </CardSurface>
  );

  if (onPress && !action) {
    return (
      <PressableFeedback
        onPress={() => {
          h.tap();
          onPress();
        }}
        accessibilityRole="button"
        accessibilityLabel={a11y}
      >
        <PressableFeedback.Scale />
        {card}
      </PressableFeedback>
    );
  }
  return card;
}

/**
 * La tarjeta destacada de la portada. Es un envoltorio para que el test del
 * territorio cuente los bloques de marca (`<FeaturedRecordCard`) sin depender
 * de cómo esté escrito el JSX.
 */
export function FeaturedRecordCard(props: Omit<Props, 'featured'>) {
  return <RecordCard {...props} featured />;
}

const styles = StyleSheet.create({
  pad: { padding: 16, gap: 16 },
  top: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  main: { flex: 1, gap: 4 },
  kicker: { marginBottom: 4 },
  title: { ...typography.title, fontWeight: '700' },
  titleBig: { ...typography.h2 },
  code: { fontWeight: '800' },
  lineRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  line: { ...typography.subhead, flexShrink: 1 },
  cta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  ctaLabel: { ...typography.button },
  action: {
    minHeight: 48,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  actionLabel: { ...typography.button },
});
