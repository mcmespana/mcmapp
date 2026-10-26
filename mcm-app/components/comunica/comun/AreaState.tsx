// Los cinco estados de toda pantalla del área (plan 01 §5): cargando
// (esqueleto, nunca una rueda sola), vacío, error con «Reintentar», sin
// conexión con datos (aviso + datos) y sin conexión sin datos.
//
// Uso: <AreaState query={q} skeleton="cards" empty={…}>{(data) => …}</AreaState>

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Skeleton } from 'heroui-native';
import EmptyState from '@/components/ui/EmptyState';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { radii } from '@/constants/uiStyles';
import typography from '@/constants/typography';
import { isComunicaApiError } from '@/services/comunica/client';
import { useComunicaTheme } from './useComunicaTheme';

interface QueryLike<T> {
  data: T | undefined;
  error: unknown;
  isPending: boolean;
  refetch: () => unknown;
}

interface Props<T> {
  query: QueryLike<T>;
  children: (data: T) => React.ReactNode;
  skeleton?: 'cards' | 'list';
  /** Si se da y `isEmpty(data)`, se pinta el vacío. */
  empty?: { title: string; subtitle?: string; isEmpty: (data: T) => boolean };
  /** El 403 con sus palabras («Esta pantalla es de coordinación.»). */
  forbidden?: { title: string; subtitle?: string };
}

const isNetwork = (e: unknown) =>
  isComunicaApiError(e) &&
  (e.code === 'network' || e.code === 'crm_unavailable');

export default function AreaState<T>({
  query,
  children,
  skeleton = 'cards',
  empty,
  forbidden,
}: Props<T>) {
  const t = useComunicaTheme();
  const { data, error, isPending, refetch } = query;

  if (data !== undefined) {
    return (
      <>
        {error && isNetwork(error) ? <OfflineNotice /> : null}
        {empty?.isEmpty(data) ? (
          <EmptyState
            icon="inbox"
            title={empty.title}
            subtitle={empty.subtitle}
            titleColor={t.text}
            subtitleColor={t.textSecondary}
          />
        ) : (
          children(data)
        )}
      </>
    );
  }

  if (isPending && !error) return <AreaSkeleton kind={skeleton} />;

  if (isComunicaApiError(error) && error.code === 'forbidden') {
    return (
      <EmptyState
        icon="lock"
        title={forbidden?.title ?? 'No tienes acceso a esto'}
        subtitle={forbidden?.subtitle}
        titleColor={t.text}
        subtitleColor={t.textSecondary}
      />
    );
  }

  if (isNetwork(error)) {
    return (
      <EmptyState
        icon="wifi-off"
        title="Necesitas conexión la primera vez"
        subtitle="Cuando se haya cargado una vez, podrás verlo sin cobertura."
        actionLabel="Reintentar"
        onAction={() => refetch()}
        accentColor={t.accentText}
        titleColor={t.text}
        subtitleColor={t.textSecondary}
      />
    );
  }

  return (
    <EmptyState
      icon="error-outline"
      title="No se ha podido cargar"
      subtitle="Puede ser un fallo puntual."
      actionLabel="Reintentar"
      onAction={() => refetch()}
      accentColor={t.accentText}
      titleColor={t.text}
      subtitleColor={t.textSecondary}
    />
  );
}

/** «Sin conexión: estás viendo lo guardado en el móvil». */
export function OfflineNotice() {
  const t = useComunicaTheme();
  return (
    <View
      style={[styles.notice, { backgroundColor: t.card }]}
      accessibilityRole="alert"
    >
      <IconSymbol name="wifi.slash" size={16} color={t.textSecondary} />
      <Text style={[styles.noticeText, { color: t.text }]}>
        Sin conexión: estás viendo lo guardado en el móvil.
      </Text>
    </View>
  );
}

export function AreaSkeleton({ kind = 'cards' }: { kind?: 'cards' | 'list' }) {
  const t = useComunicaTheme();
  // El gris por defecto de heroui se pierde sobre el fondo hundido del área.
  const tone = { backgroundColor: t.separator };
  return (
    <View
      style={styles.skeleton}
      accessible
      accessibilityLabel="Cargando"
      accessibilityState={{ busy: true }}
    >
      {kind === 'cards' ? (
        <>
          <Skeleton style={[styles.block, styles.hero, tone]} />
          <Skeleton style={[styles.block, styles.card, tone]} />
          <Skeleton style={[styles.block, styles.card, tone]} />
        </>
      ) : (
        [0, 1, 2, 3, 4, 5].map((i) => (
          <View key={i} style={styles.listRow}>
            <Skeleton style={[styles.avatar, tone]} />
            <View style={styles.listText}>
              <Skeleton style={[styles.block, styles.lineLong, tone]} />
              <Skeleton style={[styles.block, styles.lineShort, tone]} />
            </View>
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: radii.md,
    marginBottom: 16,
  },
  noticeText: { ...typography.caption, flex: 1 },
  skeleton: { gap: 16 },
  block: { borderRadius: radii.md },
  hero: { height: 180, borderRadius: radii.lg },
  card: { height: 96, borderRadius: radii.lg },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 40, height: 40, borderRadius: radii.pillFull },
  listText: { flex: 1, gap: 6 },
  lineLong: { height: 14, width: '70%' },
  lineShort: { height: 12, width: '40%' },
});
