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

/** ¿El fallo es de red (o el CRM no contesta)? Para la persona, lo mismo. */
export const isNetwork = (e: unknown) =>
  isComunicaApiError(e) &&
  (e.code === 'network' || e.code === 'crm_unavailable');

/**
 * ¿El que falla es el servidor (no contesta o tarda demasiado), no la
 * cobertura? Entonces no se dice «sin conexión»: la persona miraría su wifi y
 * le daría a «Reintentar» sin parar (caída del 6/11/2026).
 */
export const isServerTrouble = (e: unknown) =>
  isComunicaApiError(e) &&
  (e.code === 'crm_unavailable' ||
    (e.code === 'network' && e.reason === 'timeout'));

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
        {error && isNetwork(error) ? <OfflineNotice error={error} /> : null}
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

  if (isServerTrouble(error)) {
    return (
      <EmptyState
        icon="cloud-off"
        title="Comunica no responde ahora mismo"
        subtitle="No es tu conexión. Suele arreglarse solo en unos minutos: vuelve a probar en un rato."
        actionLabel="Reintentar"
        onAction={() => refetch()}
        accentColor={t.accentText}
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

/**
 * «Sin conexión: estás viendo lo guardado en el móvil». Con el `error`, si el
 * que falla es el servidor, lo dice así y no culpa a la cobertura.
 */
export function OfflineNotice({ error }: { error?: unknown } = {}) {
  const t = useComunicaTheme();
  const server = isServerTrouble(error);
  return (
    <View
      style={[styles.notice, { backgroundColor: t.card }]}
      accessibilityRole="alert"
    >
      <IconSymbol
        name={server ? 'xmark.icloud' : 'wifi.slash'}
        size={16}
        color={t.textSecondary}
      />
      <Text style={[styles.noticeText, { color: t.text }]}>
        {server
          ? 'Comunica no responde ahora mismo: estás viendo lo guardado en el móvil.'
          : 'Sin conexión: estás viendo lo guardado en el móvil.'}
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
