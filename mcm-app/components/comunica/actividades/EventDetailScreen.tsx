// La ficha de un evento (plan 13, `sticpa_event_detail_html`).
//
//   · Cabecera: nombre; lema (solo con información de la web); fechas; chip «Ya celebrado» → el del plazo → la etiqueta del CRM.
//   · Cartel arriba, entero (toca para verlo a pantalla completa). Datos en este orden: Duración (2 a 31 días), plazo (no en lo pasado), Lugar,
//     Dirección, Horario, Plazas, Precio. El primer dato de lugar que haya es el botón del mapa.
//   · Texto: con información de la web, «Toda la información» (cuerpo, galería, adjuntos y «Ver la página pública»); sin ella, «Sobre esta
//     actividad». Nunca las dos.
//   · La acción, por este orden (`eventSignup.ts`): pasado → con plaza → no es para ti → fuera de plazo → abierta. «Inscribirme en esta actividad»
//     es la única principal y va PEGADA abajo (FAM-a2); lo demás, en el contenido.
//   · Cambiar de hijo aquí deja en la misma ficha con el otro perfil (un evento no es de nadie, FAM-a8).
//   · «Ver mi inscripción» va directo a la inscripción (`myRegistrationId`); el plugin llevaba a la lista porque no tenía el id a mano.

import React, { useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { PressableFeedback } from 'heroui-native';
import EmptyState from '@/components/ui/EmptyState';
import { IconSymbol } from '@/components/ui/IconSymbol';
import typography from '@/constants/typography';
import { radii, shadows } from '@/constants/uiStyles';
import { useToast } from '@/contexts/AppToastContext';
import { comunicaNow } from '@/services/comunica';
import { isComunicaApiError } from '@/services/comunica/client';
import type { EventDetail } from '@/services/comunica/contract';
import {
  eventImageSource,
  useEventDetail,
  useOpenBodyLink,
  useOpenEventFile,
} from '@/hooks/comunica/useActivities';
import { useActiveProfile } from '@/hooks/comunica/useActiveProfile';
import { isPast } from '@/utils/comunica/activityList';
import {
  windowChip,
  windowState,
  detailWindowLine,
} from '@/utils/comunica/eventWindow';
import { signupAction } from '@/utils/comunica/eventSignup';
import { capacityText, mapHref, priceText } from '@/utils/comunica/eventMap';
import { madridDay } from '@/utils/comunica/madrid';
import { dateRangeText, durationText } from '@/utils/comunica/recordDates';
import { firstNameOf } from '@/utils/comunica/profiles';
import { h } from '@/utils/haptics';
import ShareEventButton from '../eventos/ShareEventButton';
import ActiveProfileBar from '../perfiles/ActiveProfileBar';
import AreaPrimaryButton from '../comun/AreaPrimaryButton';
import AreaScreen from '../comun/AreaScreen';
import { AreaSkeleton, isNetwork } from '../comun/AreaState';
import BottomActionBar from '../comun/BottomActionBar';
import StatusChip from '../comun/StatusChip';
import SyncBadge from '../comun/SyncBadge';
import { useComunicaTheme } from '../comun/useComunicaTheme';
import { useRegistrationLinks, NEEDS_CONNECTION } from './ActivitiesScreen';
import EventBody from './EventBody';
import ImageViewer from './ImageViewer';

type IconName = React.ComponentProps<typeof IconSymbol>['name'];

export default function EventDetailScreen({ eventId }: { eventId: string }) {
  const t = useComunicaTheme();
  const router = useRouter();
  const { active, isSelf } = useActiveProfile();
  const q = useEventDetail(active?.id, eventId);
  const toList = () => router.replace('/comunica/actividades' as never);

  if (isComunicaApiError(q.error) && q.error.code === 'not_found') {
    return (
      <AreaScreen>
        <EmptyState
          icon="inbox"
          title="Esta actividad ya no está disponible"
          subtitle="Es posible que se haya retirado. Consulta el resto de actividades abiertas."
          actionLabel="Ver eventos"
          onAction={toList}
          accentColor={t.accentText}
          titleColor={t.text}
          subtitleColor={t.textSecondary}
        />
      </AreaScreen>
    );
  }
  if (!q.data) {
    return (
      <AreaScreen onRefresh={() => q.refetch()}>
        <ActiveProfileBar scope="shared" section="events" />
        {isNetwork(q.error) ? (
          <EmptyState
            icon="wifi-off"
            title="Necesitas conexión la primera vez"
            subtitle="Cuando se haya cargado una vez, podrás verlo sin cobertura."
            actionLabel="Reintentar"
            onAction={() => void q.refetch()}
            accentColor={t.accentText}
            titleColor={t.text}
            subtitleColor={t.textSecondary}
          />
        ) : q.error ? (
          <EmptyState
            icon="error-outline"
            title="No se ha podido cargar"
            subtitle="Puede ser un fallo puntual."
            actionLabel="Reintentar"
            onAction={() => void q.refetch()}
            accentColor={t.accentText}
            titleColor={t.text}
            subtitleColor={t.textSecondary}
          />
        ) : (
          <AreaSkeleton kind="cards" />
        )}
      </AreaScreen>
    );
  }
  return (
    <Detail
      pid={active!.id}
      event={q.data}
      childName={
        !isSelf && active && firstNameOf(active) ? firstNameOf(active) : null
      }
      offline={isNetwork(q.error)}
      generatedAt={q.generatedAt}
      refetch={() => q.refetch()}
    />
  );
}

function Detail({
  pid,
  event: e,
  childName,
  offline,
  generatedAt,
  refetch,
}: {
  pid: string;
  event: EventDetail;
  childName: string | null;
  offline: boolean;
  generatedAt: string | null;
  refetch: () => Promise<unknown>;
}) {
  const t = useComunicaTheme();
  const router = useRouter();
  const { toast } = useToast();
  const links = useRegistrationLinks();
  const openBody = useOpenBodyLink(pid, e.id);
  const openFile = useOpenEventFile(pid, e.id);
  const [viewing, setViewing] = useState(false);
  const today = madridDay(comunicaNow());
  const past = isPast(e, today);
  const state = windowState(e.window, today);
  const action = signupAction(e, today, childName);
  const hasWeb = e.body.length > 0;
  const dates = dateRangeText(e.startDate, e.endDate);
  const chip = past
    ? { label: 'Ya celebrado', tone: 'neutral' as const }
    : (windowChip(state) ??
      (e.statusLabel
        ? { label: e.statusLabel, tone: 'neutral' as const }
        : null));

  const href = e.map ? mapHref(e.map, Platform.OS) : null;
  const openMap = () => {
    if (!href) return;
    h.tap();
    void Linking.openURL(href).catch(() => undefined);
  };
  const toList = () => router.replace('/comunica/actividades' as never);

  // Los datos, en el orden del plugin. El primero de lugar es el botón del mapa.
  const facts: {
    icon: IconName;
    label: string;
    value: string;
    map?: boolean;
  }[] = [];
  const duration = durationText(e.startDate, e.endDate);
  if (duration)
    facts.push({ icon: 'clock', label: 'Duración', value: duration });
  const plazo = past ? null : detailWindowLine(e.window, state);
  if (plazo)
    facts.push({ icon: 'calendar', label: 'Inscripción', value: plazo });
  let mapUsed = false;
  const place = e.place;
  const addr = e.address;
  if (place) {
    facts.push({ icon: 'flag', label: 'Lugar', value: place, map: !!href });
    mapUsed = !!href;
  }
  if (addr && addr !== place)
    facts.push({
      icon: 'house',
      label: 'Dirección',
      value: addr,
      map: !!href && !mapUsed,
    });
  if (e.timetable)
    facts.push({ icon: 'clock', label: 'Horario', value: e.timetable });
  const seats = capacityText(e.capacity);
  if (seats) facts.push({ icon: 'person.2', label: 'Plazas', value: seats });
  const price = priceText(e.price);
  if (price) facts.push({ icon: 'creditcard', label: 'Precio', value: price });

  const cover = e.cover ? eventImageSource(pid, e.id, e.cover) : null;
  const shareable = e.startDate
    ? {
        id: e.id,
        name: e.name,
        startDate: e.startDate,
        endDate: e.endDate,
        place: e.place,
        registrationOpensOn: e.window.opensOn,
        registrationClosesOn: e.window.closesOn,
        share: e.share,
      }
    : null;

  const onOpen = () => {
    if (offline) {
      toast.show({ variant: 'warning', label: NEEDS_CONNECTION });
      return;
    }
    void links.signup(e.id);
  };

  return (
    <AreaScreen
      onRefresh={refetch}
      footer={
        action.kind === 'open' ? (
          <BottomActionBar>
            {action.note ? (
              <Text style={[styles.note, { color: t.textSecondary }]}>
                {action.note}
              </Text>
            ) : null}
            {offline ? (
              <Text style={[styles.note, { color: t.textSecondary }]}>
                {NEEDS_CONNECTION}
              </Text>
            ) : null}
            <AreaPrimaryButton
              label={action.label}
              onPress={onOpen}
              disabled={offline}
              haptic
            />
          </BottomActionBar>
        ) : undefined
      }
    >
      <Stack.Screen
        options={{
          title: 'Evento',
          headerRight: shareable
            ? () => <ShareEventButton event={shareable} />
            : undefined,
        }}
      />
      <ActiveProfileBar scope="shared" section="events" />

      <View style={styles.hero}>
        {chip ? <StatusChip label={chip.label} tone={chip.tone} /> : null}
        <Text
          accessibilityRole="header"
          style={[styles.name, { color: t.text }]}
        >
          {e.name}
        </Text>
        {e.tagline ? (
          <Text style={[styles.tagline, { color: t.textSecondary }]}>
            {e.tagline}
          </Text>
        ) : null}
        {dates ? (
          <Text style={[styles.dates, { color: t.textSecondary }]}>
            {dates}
          </Text>
        ) : null}
      </View>

      {cover ? (
        <PressableFeedback
          onPress={() => {
            h.tap();
            setViewing(true);
          }}
          accessibilityRole="imagebutton"
          accessibilityLabel={`Cartel de ${e.name}. Ver a pantalla completa`}
        >
          <Image
            source={cover}
            contentFit="contain"
            accessibilityLabel={`Cartel de ${e.name}`}
            style={[styles.cover, { backgroundColor: t.backgroundSunken }]}
          />
        </PressableFeedback>
      ) : null}
      <ImageViewer
        source={viewing ? cover : null}
        label={`Cartel de ${e.name}`}
        onClose={() => setViewing(false)}
      />

      {facts.length > 0 ? (
        <View style={[styles.card, shadows.card, { backgroundColor: t.card }]}>
          {facts.map((f, i) => (
            <Fact
              key={`${f.label}-${i}`}
              fact={f}
              onMap={openMap}
              first={i === 0}
            />
          ))}
        </View>
      ) : null}

      {hasWeb ? (
        <View style={styles.block}>
          <Heading>Toda la información</Heading>
          <EventBody
            blocks={e.body}
            pid={pid}
            eventId={e.id}
            onLink={(hr, title) => void openBody(hr, title)}
          />
          {e.gallery.length > 0 ? (
            <EventBody
              blocks={[{ type: 'gallery', images: e.gallery }]}
              pid={pid}
              eventId={e.id}
              onLink={(hr, title) => void openBody(hr, title)}
            />
          ) : null}
          {e.attachments.map((a) => (
            <PressableFeedback
              key={a.documentId}
              onPress={() => {
                h.tap();
                void openFile(a.documentId, a.title);
              }}
              accessibilityRole="button"
              accessibilityLabel={`${a.title}. PDF`}
              style={[styles.attachment, { backgroundColor: t.card }]}
            >
              <IconSymbol name="paperclip" size={20} color={t.accentText} />
              <Text
                style={[styles.attachmentTitle, { color: t.text }]}
                numberOfLines={2}
              >
                {a.title}
              </Text>
              <Text style={[styles.pdf, { color: t.textSecondary }]}>PDF</Text>
            </PressableFeedback>
          ))}
          {e.publicUrl ? (
            <Secondary
              label="Ver la página pública de la actividad"
              onPress={() => void WebBrowser.openBrowserAsync(e.publicUrl!)}
            />
          ) : null}
        </View>
      ) : e.description ? (
        <View style={styles.block}>
          <Heading>Sobre esta actividad</Heading>
          <Text selectable style={[styles.description, { color: t.text }]}>
            {e.description}
          </Text>
        </View>
      ) : null}

      {action.kind === 'past' ? <Notice text={action.text} /> : null}
      {action.kind === 'registered' ? (
        <View style={styles.block}>
          <Notice text={action.text} tone="ok" />
          <Secondary
            label={action.cta}
            onPress={() => void links.registration(action.registrationId)}
          />
        </View>
      ) : null}
      {action.kind === 'not_for_you' || action.kind === 'closed' ? (
        <View style={styles.block}>
          <Notice title={action.title} text={action.text} />
          <Secondary label={action.cta} onPress={toList} />
        </View>
      ) : null}

      <View style={styles.sync}>
        <SyncBadge generatedAt={generatedAt} />
      </View>
    </AreaScreen>
  );
}

function Heading({ children }: { children: string }) {
  const t = useComunicaTheme();
  return (
    <Text
      accessibilityRole="header"
      style={[styles.heading, { color: t.text }]}
    >
      {children}
    </Text>
  );
}

function Fact({
  fact,
  onMap,
  first,
}: {
  fact: { icon: IconName; label: string; value: string; map?: boolean };
  onMap: () => void;
  first: boolean;
}) {
  const t = useComunicaTheme();
  const body = (
    <>
      <IconSymbol name={fact.icon} size={20} color={t.textSecondary} />
      <View style={styles.factText}>
        <Text style={[styles.factLabel, { color: t.textSecondary }]}>
          {fact.label}
        </Text>
        <Text style={[styles.factValue, { color: t.text }]}>{fact.value}</Text>
      </View>
      {fact.map ? (
        <IconSymbol name="chevron.right" size={16} color={t.textSecondary} />
      ) : null}
    </>
  );
  const edge = first
    ? null
    : { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.separator };
  if (fact.map) {
    return (
      <PressableFeedback
        onPress={onMap}
        accessibilityRole="link"
        accessibilityLabel={`Ver en el mapa: ${fact.value}`}
        style={[styles.fact, edge]}
      >
        {body}
      </PressableFeedback>
    );
  }
  return (
    <View
      accessible
      accessibilityLabel={`${fact.label}: ${fact.value}`}
      style={[styles.fact, edge]}
    >
      {body}
    </View>
  );
}

function Notice({
  title,
  text,
  tone = 'info',
}: {
  title?: string;
  text: string;
  tone?: 'info' | 'ok';
}) {
  const t = useComunicaTheme();
  const c = t.chip(tone === 'ok' ? 'positive' : 'info');
  return (
    <View
      accessibilityRole="alert"
      style={[styles.notice, { backgroundColor: c.background }]}
    >
      {title ? (
        <Text style={[styles.noticeTitle, { color: t.text }]}>{title}</Text>
      ) : null}
      <Text style={[styles.noticeText, { color: t.text }]}>{text}</Text>
    </View>
  );
}

function Secondary({ label, onPress }: { label: string; onPress: () => void }) {
  const t = useComunicaTheme();
  return (
    <PressableFeedback
      onPress={() => {
        h.tap();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[styles.secondary, { borderColor: t.accentText }]}
    >
      <Text style={[styles.secondaryLabel, { color: t.accentText }]}>
        {label}
      </Text>
    </PressableFeedback>
  );
}

const styles = StyleSheet.create({
  hero: { gap: 8 },
  name: { ...typography.h1 },
  tagline: { ...typography.title },
  dates: { ...typography.body },
  cover: { width: '100%', aspectRatio: 3 / 4, borderRadius: radii.lg },
  card: { borderRadius: radii.lg, overflow: 'hidden' },
  fact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 56,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  factText: { flex: 1 },
  factLabel: { ...typography.caption },
  factValue: { ...typography.body },
  block: { gap: 12 },
  heading: { ...typography.title },
  description: { ...typography.body, lineHeight: 24 },
  attachment: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 56,
    paddingHorizontal: 16,
    borderRadius: radii.md,
  },
  attachmentTitle: { ...typography.body, flex: 1 },
  pdf: { ...typography.caption },
  notice: { borderRadius: radii.md, padding: 16, gap: 4 },
  noticeTitle: { ...typography.title },
  noticeText: { ...typography.body },
  secondary: {
    minHeight: 48,
    borderWidth: 1.5,
    borderRadius: radii.pillFull,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  secondaryLabel: { ...typography.button },
  note: { ...typography.caption, textAlign: 'center' },
  sync: { alignItems: 'center' },
});
