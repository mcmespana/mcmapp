// La ficha de un evento (plan 13; `sticpa_event_detail_html`), sin hooks de
// datos: la monta `EventDetailScreen` y la ficha pública. Anatomía de la
// ficha de registro (`stic-record-view.php`):
//
//   cabecera (nombre, lema si hay web, fecha, chip) → cartel entero → datos
//   (duración, plazo, lugar con el mapa, dirección, horario, plazas, precio)
//   → «Toda la información» (cuerpo, galería, adjuntos, página pública) o
//   «Sobre esta actividad» (la descripción), NUNCA las dos → la nota de la
//   acción. «Inscribirme» va fuera, pegado abajo (lo pone la pantalla).
//
// En iPad y web ancha, el cartel a la izquierda y el resto a la derecha.

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PressableFeedback } from 'heroui-native';
import { IconSymbol } from '@/components/ui/IconSymbol';
import typography from '@/constants/typography';
import type {
  BodyHref,
  EventDetail,
  ImageRef,
} from '@/services/comunica/contract';
import {
  isPastEvent,
  registrationWindow,
  windowChip,
  windowFact,
  type Chip,
} from '@/utils/comunica/eventWindow';
import {
  dateLine,
  durationLabel,
  priceLabel,
} from '@/utils/comunica/recordDates';
import { h } from '@/utils/haptics';
import FactList, { type Fact } from '../comun/record/FactList';
import RecordHero from '../comun/record/RecordHero';
import RecordSection from '../comun/record/RecordSection';
import Section from '../comun/Section';
import { useComunicaTheme } from '../comun/useComunicaTheme';
import EventBody, { Gallery } from './EventBody';
import EventMedia, { type ImageResolver } from './EventMedia';

export interface EventDetailHandlers {
  resolve: ImageResolver;
  onImage: (image: ImageRef, alt: string) => void;
  onLink: (href: BodyHref) => void;
  onVideo: (url: string) => void;
  onMap: () => void;
  onAttachment: (documentId: string, title: string) => void;
  onPublicPage: (url: string) => void;
  /** El documento que se está bajando (para el progreso). */
  opening?: string | null;
}

/** El chip de la cabecera: «Ya celebrado» → el del plazo → la etiqueta del CRM. */
export function detailChip(e: EventDetail, today: string): Chip | null {
  if (isPastEvent(e, today)) return { label: 'Ya celebrado', tone: 'neutral' };
  return (
    windowChip(registrationWindow(e.window, today)) ??
    (e.statusLabel ? { label: e.statusLabel, tone: 'neutral' } : null)
  );
}

/** ¿Hay «información de la web»? (`sticpa_event_web_has_content`). */
export const hasWebInfo = (e: EventDetail) =>
  !!e.cover ||
  e.body.length > 0 ||
  e.gallery.length > 0 ||
  e.attachments.length > 0;

/** Los datos, en el orden del plugin. El primero de lugar lleva el mapa. */
export function detailFacts(
  e: EventDetail,
  today: string,
  onMap: () => void,
): Fact[] {
  const facts: Fact[] = [];
  const duration = durationLabel(e.startDate, e.endDate);
  if (duration) {
    facts.push({
      key: 'duration',
      icon: 'clock',
      label: 'Duración',
      value: duration,
    });
  }
  if (!isPastEvent(e, today)) {
    const fact = windowFact(registrationWindow(e.window, today));
    if (fact) {
      facts.push({
        key: 'window',
        icon: 'hourglass',
        label: 'Inscripción',
        value: fact,
      });
    }
  }
  // `place` es el lugar o, si no, la dirección: el lugar «de verdad» es el
  // que no coincide con la dirección.
  const place = e.place && e.place !== e.address ? e.place : null;
  let mapUsed = !e.map;
  const withMap = (f: Fact): Fact => {
    if (mapUsed) return f;
    mapUsed = true;
    return {
      ...f,
      onPress: onMap,
      accessibilityLabel: `Ver en el mapa: ${f.value}`,
    };
  };
  if (place) {
    facts.push(
      withMap({
        key: 'place',
        icon: 'building.2',
        label: 'Lugar',
        value: place,
      }),
    );
  }
  if (e.address) {
    facts.push(
      withMap({
        key: 'address',
        icon: 'mappin.and.ellipse',
        label: 'Dirección',
        value: e.address,
      }),
    );
  }
  if (e.timetable) {
    facts.push({
      key: 'timetable',
      icon: 'clock',
      label: 'Horario',
      value: e.timetable,
    });
  }
  if (e.capacity) {
    facts.push({
      key: 'capacity',
      icon: 'person.3',
      label: 'Plazas',
      value: String(e.capacity),
    });
  }
  if (e.price) {
    facts.push({
      key: 'price',
      icon: 'eurosign',
      label: 'Precio',
      value: priceLabel(e.price),
    });
  }
  return facts;
}

interface Props extends EventDetailHandlers {
  event: EventDetail;
  today: string;
  /** El hueco de la acción (la nota y su salida). */
  action?: React.ReactNode;
  wide?: boolean;
}

export default function EventDetailView({
  event: e,
  today,
  action,
  wide = false,
  ...on
}: Props) {
  const t = useComunicaTheme();
  const web = hasWebInfo(e);
  const coverAlt = `Cartel de ${e.name}`;
  const cover = e.cover ? (
    <EventMedia
      image={e.cover}
      resolve={on.resolve}
      alt={coverAlt}
      initialRatio={3 / 4}
      onPress={() => on.onImage(e.cover!, coverAlt)}
    />
  ) : null;

  const rest = (
    <View style={styles.column}>
      <FactList facts={detailFacts(e, today, on.onMap)} />
      {web ? (
        <RecordSection title="Toda la información">
          {e.body.length > 0 ? (
            <EventBody
              blocks={e.body}
              resolve={on.resolve}
              onLink={on.onLink}
              onImage={on.onImage}
              onVideo={on.onVideo}
            />
          ) : null}
          {e.gallery.length > 0 ? (
            <Gallery
              images={e.gallery}
              resolve={on.resolve}
              onImage={on.onImage}
            />
          ) : null}
          {e.attachments.length > 0 ? (
            <Section>
              {e.attachments.map((a) => (
                <PressableFeedback
                  key={a.documentId}
                  onPress={() => {
                    h.tap();
                    on.onAttachment(a.documentId, a.title);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`${a.title}, PDF`}
                  accessibilityHint="Abre el documento"
                  accessibilityState={{ busy: on.opening === a.documentId }}
                  style={styles.attachment}
                >
                  <IconSymbol name="doc.text" size={20} color={t.accentText} />
                  <Text style={[styles.attachmentTitle, { color: t.text }]}>
                    {a.title}
                  </Text>
                  <Text style={[styles.kind, { color: t.textSecondary }]}>
                    {on.opening === a.documentId ? 'Abriendo…' : 'PDF'}
                  </Text>
                  <PressableFeedback.Highlight />
                </PressableFeedback>
              ))}
            </Section>
          ) : null}
          {e.publicUrl ? (
            <PressableFeedback
              onPress={() => {
                h.tap();
                on.onPublicPage(e.publicUrl!);
              }}
              accessibilityRole="link"
              style={styles.publicLink}
            >
              <Text style={[styles.publicLabel, { color: t.accentText }]}>
                Ver la página pública de la actividad
              </Text>
              <IconSymbol
                name="arrow.up.right"
                size={14}
                color={t.accentText}
              />
            </PressableFeedback>
          ) : null}
        </RecordSection>
      ) : e.description ? (
        <RecordSection title="Sobre esta actividad">
          <Text selectable style={[styles.description, { color: t.text }]}>
            {e.description}
          </Text>
        </RecordSection>
      ) : null}
      {action}
    </View>
  );

  return (
    <View style={styles.wrap}>
      <RecordHero
        title={e.name}
        subtitle={web ? e.tagline : null}
        dateLine={dateLine(e.startDate, e.endDate)}
        chip={detailChip(e, today)}
      />
      {wide && cover ? (
        <View style={styles.wide}>
          <View style={styles.wideCover}>{cover}</View>
          <View style={styles.wideRest}>{rest}</View>
        </View>
      ) : (
        <>
          {cover}
          {rest}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 20 },
  column: { gap: 24 },
  wide: { flexDirection: 'row', gap: 24, alignItems: 'flex-start' },
  wideCover: { flex: 1 },
  wideRest: { flex: 1 },
  description: { ...typography.body },
  attachment: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  attachmentTitle: { ...typography.body, flex: 1 },
  kind: { ...typography.caption, fontWeight: '600' },
  publicLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 44,
    alignSelf: 'flex-start',
  },
  publicLabel: { ...typography.button },
});
