// «Avisos en este móvil» (plan 08): el permiso, los tres avisos del área con
// su interruptor y los ajustes del sistema. Se llega desde «Tu cuenta».
//
//   · Sin permiso, lo primero (y la única acción principal) es activarlo; los
//     interruptores se ven apagados y explicados.
//   · Los interruptores cambian al instante; lo que manda el servidor espera
//     en la cola con su `UploadStatus` (sin conexión, «Guardado en el móvil»).
//   · En web no hay avisos: se dice con calma.

import React, { useEffect, useState } from 'react';
import { AppState, Linking, StyleSheet, Text, View } from 'react-native';
import { Skeleton } from 'heroui-native';
import EmptyState from '@/components/ui/EmptyState';
import { IconSymbol } from '@/components/ui/IconSymbol';
import typography from '@/constants/typography';
import { radii } from '@/constants/uiStyles';
import { tryRegisterPushToken } from '@/notifications/usePushNotifications';
import { nudgeDeviceSync } from '@/services/comunica/bridge';
import { DEVICE_OUTBOX, type NoticePrefs } from '@/services/comunica/devices';
import {
  localNoticesAvailable,
  readNoticePermission,
  requestNoticePermission,
  type NoticePermission,
} from '@/services/comunica/localNotices';
import { useNoticePrefs } from '@/hooks/comunica/useNoticePrefs';
import { useOutbox } from '@/hooks/comunica/useOutbox';
import AreaPrimaryButton from '../comun/AreaPrimaryButton';
import AreaScreen from '../comun/AreaScreen';
import AreaSwitch from '../comun/AreaSwitch';
import NavRow from '../comun/NavRow';
import Section from '../comun/Section';
import UploadStatus from '../comun/UploadStatus';
import { useComunicaTheme } from '../comun/useComunicaTheme';

type IconName = React.ComponentProps<typeof IconSymbol>['name'];

/** Los tres avisos, en el orden en que importan. */
const NOTICES: {
  key: keyof NoticePrefs;
  icon: IconName;
  title: string;
  body: string;
}[] = [
  {
    key: 'rollCallDue',
    icon: 'list.bullet.clipboard',
    title: '¿Has pasado lista?',
    body: 'Al acabar la sesión, si tu grupo aún no tiene lista.',
  },
  {
    key: 'outboxReminder',
    icon: 'icloud.and.arrow.up',
    title: 'Listas sin subir',
    body: 'Si cierras la app con listas guardadas solo en el móvil, una hora después.',
  },
  {
    key: 'groupChanges',
    icon: 'person.2',
    title: 'Novedades en tu grupo',
    body: 'Cuando llega un chaval nuevo o alguien se da de baja.',
  },
];

/** El permiso de la app, y otra vez al volver (p. ej. de Ajustes). */
function usePermission() {
  const [permission, setPermission] = useState<NoticePermission | null>(null);
  useEffect(() => {
    let alive = true;
    const read = () =>
      void readNoticePermission().then((next) => {
        if (alive) setPermission(next);
      });
    read();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') read();
    });
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);
  return { permission, setPermission };
}

export default function NoticesScreen() {
  // En web, el adaptador vacío (`localNotices.web.ts`) dice que no hay.
  if (!localNoticesAvailable) return <WebNotices />;
  return <NativeNotices />;
}

function WebNotices() {
  const t = useComunicaTheme();
  return (
    <AreaScreen>
      <EmptyState
        icon="notifications-off"
        title="Los avisos solo funcionan en la app del móvil"
        subtitle="Abre MCM App en tu móvil y actívalos desde «Tu cuenta»."
        titleColor={t.text}
        subtitleColor={t.textSecondary}
      />
    </AreaScreen>
  );
}

function NativeNotices() {
  const t = useComunicaTheme();
  const { permission, setPermission } = usePermission();
  const { prefs, loaded, setPref } = useNoticePrefs();
  const { get, outbox } = useOutbox();
  const upload = get(DEVICE_OUTBOX.key);
  const granted = permission === 'granted';

  const activate = async () => {
    if (permission === 'denied') {
      await Linking.openSettings().catch(() => {});
      return;
    }
    const next = await requestNoticePermission();
    setPermission(next);
    if (next === 'granted') {
      // El token para nuestro servidor, sin esperar al siguiente arranque.
      await tryRegisterPushToken().catch(() => {});
      nudgeDeviceSync();
    }
  };

  return (
    <AreaScreen>
      {permission === null || !loaded ? (
        <LoadingRows />
      ) : (
        <>
          {granted ? (
            <View style={styles.status} accessibilityRole="summary">
              <IconSymbol name="bell.fill" size={20} color={t.accentText} />
              <Text style={[styles.statusText, { color: t.text }]}>
                Los avisos están activados en este móvil. Elige cuáles quieres.
              </Text>
            </View>
          ) : (
            // El mismo aviso ámbar que la portada («Te faltan 2 listas»):
            // título fuera, una superficie, y la única acción principal.
            <Section
              warning
              title={
                permission === 'denied'
                  ? 'Los avisos están desactivados'
                  : 'Aún no has activado los avisos'
              }
            >
              <View style={styles.blocked}>
                <Text style={[styles.body, { color: t.text }]}>
                  {permission === 'denied'
                    ? 'Primero activa los avisos de MCM App en Ajustes.'
                    : 'Te recordamos pasar lista y te avisamos si una lista no se ha subido.'}
                </Text>
                <AreaPrimaryButton
                  label={
                    permission === 'denied'
                      ? 'Abrir Ajustes'
                      : 'Activar los avisos'
                  }
                  icon="bell.fill"
                  onPress={() => void activate()}
                />
              </View>
            </Section>
          )}

          <Section title="Te avisamos de">
            {NOTICES.map((n) => (
              <SwitchRow
                key={n.key}
                icon={n.icon}
                title={n.title}
                body={n.body}
                value={granted && prefs[n.key]}
                disabled={!granted}
                onChange={(v) => setPref(n.key, v)}
              />
            ))}
          </Section>

          {upload && upload.status !== 'applied' ? (
            <View style={styles.upload}>
              <UploadStatus
                state={upload.status}
                onRetry={() => void outbox?.retry(DEVICE_OUTBOX.key)}
              />
            </View>
          ) : null}

          <Section>
            <NavRow
              icon="gearshape"
              title="Ajustes del sistema"
              subtitle="El sonido y cada tipo de aviso, en los ajustes de tu móvil"
              onPress={() => void Linking.openSettings().catch(() => {})}
            />
          </Section>

          <Text style={[styles.foot, { color: t.textSecondary }]}>
            Los avisos no llevan datos de salud ni apellidos: solo el grupo, la
            fecha y cuántos.
          </Text>
        </>
      )}
    </AreaScreen>
  );
}

function SwitchRow({
  icon,
  title,
  body,
  value,
  disabled,
  onChange,
}: {
  icon: IconName;
  title: string;
  body: string;
  value: boolean;
  disabled: boolean;
  onChange: (v: boolean) => void;
}) {
  const t = useComunicaTheme();
  return (
    <View style={styles.row}>
      <IconSymbol
        name={icon}
        size={20}
        color={disabled ? t.textMuted : t.accentText}
        style={styles.rowIcon}
      />
      <View style={styles.rowText}>
        <Text style={[styles.rowTitle, { color: t.text }]}>{title}</Text>
        <Text style={[styles.body, { color: t.textSecondary }]}>{body}</Text>
      </View>
      <AreaSwitch
        value={value}
        onChange={onChange}
        label={title}
        disabled={disabled}
      />
    </View>
  );
}

/** Mientras se lee el permiso: tres filas. */
function LoadingRows() {
  const t = useComunicaTheme();
  const tone = { backgroundColor: t.separator };
  return (
    <View
      style={[styles.loading, { backgroundColor: t.card }]}
      accessible
      accessibilityLabel="Cargando"
      accessibilityState={{ busy: true }}
    >
      {[0, 1, 2].map((i) => (
        <View key={i} style={styles.row}>
          <View style={styles.rowText}>
            <Skeleton style={[styles.lineLong, tone]} />
            <Skeleton style={[styles.lineShort, tone]} />
          </View>
          <Skeleton style={[styles.switchGhost, tone]} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 4,
  },
  statusText: { ...typography.body, flex: 1 },
  blocked: { padding: 16, gap: 16 },
  body: { ...typography.body },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 64,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  rowIcon: { alignSelf: 'flex-start', marginTop: 2 },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { ...typography.body, fontWeight: '600' },
  upload: { marginTop: -16, paddingHorizontal: 4 },
  foot: { ...typography.caption, textAlign: 'center', paddingHorizontal: 16 },
  loading: { borderRadius: radii.lg, overflow: 'hidden' },
  lineLong: { height: 14, width: '60%', borderRadius: radii.xs },
  lineShort: { height: 12, width: '85%', borderRadius: radii.xs },
  switchGhost: { width: 50, height: 30, borderRadius: radii.pillFull },
});
