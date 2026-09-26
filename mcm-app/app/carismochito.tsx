// Colección de Carismochitos.
//
// **Solo se llega desde el Laboratorio Alpha** (7 toques en la versión →
// "Ver mi colección"), por decisión del usuario: no hay enlace desde Inicio,
// Más ni Contigo. Si alguien entra por un enlace directo sin tener la caza
// encendida, se le devuelve a Inicio.
//
// Cuando exista la vista de perfil (docs/planes/PLAN_PANEL_PANUELO.md), esta
// rejilla es la pieza que se muda allí.

import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Redirect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import CarismochitoMascot from '@/components/CarismochitoMascot';
import AppChip from '@/components/ui/AppChip';
import PageContainer from '@/components/ui/PageContainer';
import ProgressRing from '@/components/ui/ProgressRing';
import colors, { CarismoColors, themeColors } from '@/constants/colors';
import spacing from '@/constants/spacing';
import typography from '@/constants/typography';
import { radii, shadows } from '@/constants/uiStyles';
import { useAuth } from '@/contexts/AuthContext';
import { useCarismochitoHunt } from '@/contexts/CarismochitoHuntContext';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import {
  CARISMOCHITO_VARIANTS,
  RARITY_LABEL,
  summarizeCollection,
  type CarismochitoRarity,
  type CarismochitoVariant,
} from '@/utils/carismochitoCollection';

/** El color de cada rareza. `AppChip` se encarga de que se lea. */
const RARITY_COLOR: Record<CarismochitoRarity, string> = {
  comun: CarismoColors.light,
  poco_comun: colors.info,
  raro: colors.purple,
  legendario: colors.yellow,
};

const RING_SIZE = 132;

function chunk<T>(items: readonly T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    rows.push(items.slice(i, i + size));
  }
  return rows;
}

export default function CarismochitoCollectionScreen() {
  const isDark = useColorScheme() === 'dark';
  const t = themeColors(isDark);
  const accent = isDark ? CarismoColors.dark : CarismoColors.light;
  const insets = useSafeAreaInsets();
  const { isWide } = useResponsiveLayout();
  const { user } = useAuth();
  const { ready, huntEnabled, collection } = useCarismochitoHunt();

  const summary = useMemo(() => summarizeCollection(collection), [collection]);
  const rows = useMemo(
    () => chunk(CARISMOCHITO_VARIANTS, isWide ? 4 : 2),
    [isWide],
  );

  if (!ready) return null;
  if (!huntEnabled) return <Redirect href="/" />;

  return (
    <View style={[styles.root, { backgroundColor: t.background }]}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xl }}
      >
        <PageContainer>
          <View style={styles.hero}>
            <View style={styles.ring}>
              <ProgressRing
                done={summary.found}
                total={summary.of}
                size={RING_SIZE}
                stroke={8}
                color={accent}
                trackColor={t.separator}
              />
              <View style={styles.ringMascot} pointerEvents="none">
                <CarismochitoMascot size={84} dance={1} />
              </View>
            </View>
            <Text style={[styles.heroTitle, { color: t.text }]}>
              {summary.complete ? '¡Colección completa!' : 'Tu colección'}
            </Text>
            <Text style={[styles.heroMeta, { color: t.textSecondary }]}>
              {summary.found} de {summary.of} encontrados · {summary.total}{' '}
              {summary.total === 1 ? 'captura' : 'capturas'}
            </Text>
          </View>

          <Text style={[styles.howTo, { color: t.textSecondary }]}>
            Con el modo Carismochito activo, se asoma de vez en cuando por los
            bordes. Tócalo antes de que se esconda para atraparlo.
          </Text>

          {!user ? (
            <View
              style={[
                styles.notice,
                {
                  backgroundColor: t.backgroundSunken,
                  borderColor: t.separator,
                },
              ]}
            >
              <Text style={[styles.noticeText, { color: t.text }]}>
                Sin sesión iniciada, la colección solo se guarda en este móvil.
                Inicia sesión en Más → Tu cuenta para no perderla.
              </Text>
            </View>
          ) : null}

          <View style={styles.grid}>
            {rows.map((row) => (
              <View key={row[0].id} style={styles.row}>
                {row.map((v) => (
                  <VariantCard
                    key={v.id}
                    variant={v}
                    count={collection[v.id]?.count ?? 0}
                    isDark={isDark}
                  />
                ))}
                {/* Relleno para que la última fila no estire sus tarjetas. */}
                {Array.from({ length: (isWide ? 4 : 2) - row.length }).map(
                  (_, i) => (
                    <View key={`pad-${i}`} style={styles.cell} />
                  ),
                )}
              </View>
            ))}
          </View>
        </PageContainer>
      </ScrollView>
    </View>
  );
}

function VariantCard({
  variant,
  count,
  isDark,
}: {
  variant: CarismochitoVariant;
  count: number;
  isDark: boolean;
}) {
  const t = themeColors(isDark);
  const found = count > 0;
  const rarity = RARITY_LABEL[variant.rarity];

  return (
    <View
      style={[styles.cell, styles.card, { backgroundColor: t.card }]}
      accessible
      accessibilityLabel={
        found
          ? `${variant.name}, ${rarity}, atrapado ${count} ${count === 1 ? 'vez' : 'veces'}`
          : `Carismochito ${rarity.toLowerCase()} sin encontrar`
      }
    >
      <View style={styles.cardMascot}>
        <CarismochitoMascot
          size={72}
          dance={0}
          palette={found ? variant.palette : 'silueta'}
        />
      </View>
      <Text
        style={[styles.cardName, { color: found ? t.text : t.textMuted }]}
        numberOfLines={2}
      >
        {found ? variant.name : '¿?'}
      </Text>
      <AppChip
        label={rarity}
        color={RARITY_COLOR[variant.rarity]}
        size="sm"
        style={styles.cardChip}
      />
      <Text style={[styles.cardHint, { color: t.textSecondary }]}>
        {found ? variant.hint : 'Todavía no lo has visto.'}
      </Text>
      {found ? (
        <Text style={[styles.cardCount, { color: t.text }]}>×{count}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  hero: {
    alignItems: 'center',
    paddingTop: spacing.lg,
    gap: spacing.sm,
  },
  ring: {
    width: RING_SIZE,
    height: RING_SIZE,
  },
  ringMascot: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: {
    ...typography.h1,
    marginTop: spacing.sm,
  },
  heroMeta: {
    ...typography.subhead,
  },
  howTo: {
    ...typography.body,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
    marginTop: spacing.md,
  },
  notice: {
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  noticeText: {
    ...typography.subhead,
  },
  grid: {
    paddingHorizontal: spacing.md,
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  cell: {
    flex: 1,
  },
  card: {
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radii.lg,
    gap: spacing.xs,
    ...shadows.card,
  },
  cardMascot: {
    height: 88,
    justifyContent: 'center',
  },
  cardName: {
    ...typography.title,
    textAlign: 'center',
  },
  cardChip: {
    alignSelf: 'center',
  },
  cardHint: {
    ...typography.caption,
    textAlign: 'center',
  },
  cardCount: {
    ...typography.h3,
    marginTop: spacing.xs,
  },
});
