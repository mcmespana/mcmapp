// La ficha de un inscrito para quien gestiona el evento (plan 18). Se abre
// desde el check-in: lo que hace falta en la puerta, de cualquier delegación.
//
//   identidad (con su habitación) → «No puede irse solo/a a casa.» → su
//   llegada (marcar, «No viene» o deshacer) → la nota → marcas y salud (la
//   salud, con un botón aparte y solo con conexión, nunca guardada) →
//   contacto (la persona, su familia y emergencias: llamar y WhatsApp) →
//   autorizaciones (plegadas).
//
// La llegada y la nota van a la cola, como en la lista: sin cobertura
// también. La ficha (teléfonos, familia) se guarda como la de Grupos; si aún
// no se ha abierto nunca y no hay red, se ve lo que dice la lista.

import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { PressableFeedback } from 'heroui-native';
import AppTextField from '@/components/ui/AppTextField';
import EmptyState from '@/components/ui/EmptyState';
import { IconSymbol } from '@/components/ui/IconSymbol';
import typography from '@/constants/typography';
import { radii } from '@/constants/uiStyles';
import { isComunicaApiError } from '@/services/comunica/client';
import {
  MANAGED_NOTE_MAX,
  type ManagedEventDetail,
  type ManagedPerson,
  type ManagedRegistration,
} from '@/services/comunica/contract';
import {
  useCheckin,
  useManagedEvent,
  useManagedPerson,
} from '@/hooks/comunica/managedEvents';
import { useFlushOutboxOnMount } from '@/hooks/comunica/useOutbox';
import { h } from '@/utils/haptics';
import {
  arrivedTime,
  cleanNote,
  ROLE_LABEL,
  roomHeading,
  type Effective,
} from '@/utils/comunica/checkin';
import { ageLabel } from '@/utils/comunica/people';
import { canWhatsappMinor, cleanPhone } from '@/utils/comunica/phone';
import AreaPrimaryButton from '../comun/AreaPrimaryButton';
import AreaScreen from '../comun/AreaScreen';
import AreaState from '../comun/AreaState';
import CardSurface from '../comun/CardSurface';
import PersonAvatar from '../comun/PersonAvatar';
import PersonMarks, { hasMarks } from '../comun/PersonMarks';
import SyncBadge from '../comun/SyncBadge';
import { useComunicaTheme } from '../comun/useComunicaTheme';
import { ConsentsFold, FichaSection } from '../grupos/FichaParts';
import HealthSheet from '../grupos/HealthSheet';
import { ContactRow, Hint } from '../grupos/ParticipantScreen';

interface Props {
  eventId: string;
  personId: string;
}

export default function ManagedPersonScreen({ eventId, personId }: Props) {
  const t = useComunicaTheme();
  const event = useManagedEvent(eventId);
  const q = useManagedPerson(eventId, personId);
  useFlushOutboxOnMount();
  const reg = event.data?.registrations.find((r) => r.personId === personId);
  const forbidden = isComunicaApiError(q.error) && q.error.code === 'forbidden';
  return (
    <>
      <Stack.Screen options={{ title: 'Ficha', headerLargeTitle: false }} />
      <AreaScreen onRefresh={() => Promise.all([q.refetch(), event.refetch()])}>
        {forbidden ? (
          <EmptyState
            icon="lock"
            title="Esta persona no está inscrita en el evento que gestionas."
            titleColor={t.text}
          />
        ) : event.data && reg ? (
          <Ficha
            detail={event.data}
            reg={reg}
            person={q.data}
            personQuery={q}
          />
        ) : (
          <AreaState query={event} skeleton="cards">
            {() => (
              <EmptyState
                icon="lock"
                title="Esta persona no está inscrita en el evento que gestionas."
                titleColor={t.text}
              />
            )}
          </AreaState>
        )}
      </AreaScreen>
    </>
  );
}

function Ficha({
  detail,
  reg,
  person,
  personQuery,
}: {
  detail: ManagedEventDetail;
  reg: ManagedRegistration;
  person: ManagedPerson | undefined;
  personQuery: ReturnType<typeof useManagedPerson>;
}) {
  const t = useComunicaTheme();
  const { effective, mark, setNote } = useCheckin(detail.event.id, detail);
  const eff: Effective = effective.get(reg.registrationId) ?? {
    status: 'pending',
    queued: false,
  };
  const [healthFor, setHealthFor] = useState<{
    id: string;
    firstName: string;
    lastName: string;
  } | null>(null);
  const sheetPerson = {
    id: reg.personId,
    firstName: reg.firstName,
    lastName: reg.lastName,
  };
  const name = `${reg.firstName} ${reg.lastName}`;
  const room = eff.roomId
    ? detail.rooms.find((r) => r.id === eff.roomId)
    : undefined;
  const manyVenues = new Set(detail.rooms.map((r) => r.venue)).size > 1;
  const identity = [
    reg.role !== 'participant' ? ROLE_LABEL[reg.role] : null,
    reg.schoolLevel?.label ?? null,
    ageLabel(person?.person.age ?? reg.age),
    reg.delegation?.name ?? null,
  ]
    .filter(Boolean)
    .join(' · ');
  const badges = person?.badges ?? reg.badges;
  const consents = person?.consents;
  const out = !!reg.registrationStatus;
  const ownPhone = cleanPhone(person?.phones.own);
  const emergency = cleanPhone(person?.phones.emergency);

  return (
    <>
      <View style={styles.identity}>
        <PersonAvatar
          person={{
            id: reg.personId,
            firstName: reg.firstName,
            lastName: reg.lastName,
            photoUrl: person?.person.photoUrl ?? reg.photoUrl,
          }}
          size={72}
          tone="brand"
        />
        <View style={styles.identityBody}>
          <Text
            style={[styles.name, { color: t.text }]}
            accessibilityRole="header"
          >
            {person?.person.fullName ?? name}
          </Text>
          {identity ? (
            <Text style={[styles.identityLine, { color: t.textSecondary }]}>
              {identity}
            </Text>
          ) : null}
          {room ? (
            <View style={styles.roomLine}>
              <IconSymbol name="bed.double" size={16} color={t.accentText} />
              <Text style={[styles.identityLine, { color: t.text }]}>
                {roomHeading(room, manyVenues)}
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      {consents?.goHomeAlone === false || badges.notHomeAlone ? (
        <View
          style={[styles.homeAlone, { backgroundColor: t.warningSoft }]}
          accessibilityRole="alert"
        >
          <IconSymbol
            name="exclamationmark.triangle.fill"
            size={18}
            color={t.warningIcon}
          />
          <Text style={[styles.homeAloneText, { color: t.warningText }]}>
            No puede irse solo/a a casa.
          </Text>
        </View>
      ) : null}

      <FichaSection title="Llegada">
        {out ? (
          <Hint text="Su inscripción está cancelada: no se le espera." />
        ) : (
          <Arrival
            eff={eff}
            firstName={reg.firstName}
            onMark={(to) => {
              if (to === 'in') h.add();
              else if (to === 'pending') h.remove();
              else h.select();
              void mark([reg.registrationId], to);
            }}
          />
        )}
      </FichaSection>

      <NoteBlock
        key={reg.registrationId}
        eff={eff}
        onSave={(note) => setNote(reg.registrationId, note)}
      />

      {hasMarks(badges) ? (
        <FichaSection title="A tener en cuenta">
          <PersonMarks
            badges={badges}
            onHealth={() => setHealthFor(sheetPerson)}
          />
        </FichaSection>
      ) : null}

      <FichaSection title="Salud">
        <PressableFeedback
          onPress={() => {
            h.tap();
            setHealthFor(sheetPerson);
          }}
          accessibilityRole="button"
          accessibilityLabel={`Ver la salud de ${reg.firstName}`}
          style={[styles.healthButton, { backgroundColor: t.card }]}
        >
          <IconSymbol name="cross.case.fill" size={18} color={t.accentText} />
          <Text style={[styles.healthLabel, { color: t.accentText }]}>
            Ver alergias, tratamientos…
          </Text>
          <View style={styles.flex} />
          <IconSymbol name="chevron.right" size={16} color={t.textMuted} />
          <PressableFeedback.Highlight />
        </PressableFeedback>
        <Text style={[styles.caption, { color: t.textSecondary }]}>
          Solo con conexión. No se guarda en el móvil.
        </Text>
      </FichaSection>

      <FichaSection title="Contacto">
        {person ? (
          <View style={[styles.list, { backgroundColor: t.card }]}>
            {ownPhone || person.email ? (
              <ContactRow
                name={reg.firstName}
                tag="Suyo"
                sub={ownPhone?.display ?? 'sin teléfono'}
                phone={ownPhone}
                whatsapp={
                  reg.role !== 'participant' ||
                  canWhatsappMinor(person.consents.whatsapp)
                }
                email={person.email}
              />
            ) : null}
            {person.guardians.map((g) => {
              const ph = cleanPhone(g.phone);
              return (
                <ContactRow
                  key={g.id}
                  name={g.fullName}
                  sub={[g.relationship, ph ? ph.display : 'sin teléfono']
                    .filter(Boolean)
                    .join(' · ')}
                  phone={ph}
                  whatsapp
                  email={g.email}
                />
              );
            })}
            {emergency ? (
              <ContactRow
                name="Emergencias"
                sub={emergency.display}
                phone={emergency}
                whatsapp={false}
              />
            ) : null}
          </View>
        ) : personQuery.error ? (
          <Hint text="Sin conexión: los teléfonos salen cuando se abra la ficha con cobertura." />
        ) : (
          <AreaState query={personQuery} skeleton="list">
            {() => null}
          </AreaState>
        )}
        {person &&
        !ownPhone &&
        !emergency &&
        !person.guardians.some((g) => cleanPhone(g.phone)) ? (
          <Hint text="En su ficha no hay ningún teléfono." />
        ) : null}
      </FichaSection>

      {consents ? (
        <View style={styles.folds}>
          <ConsentsFold consents={consents} />
        </View>
      ) : null}

      <View style={styles.foot}>
        <SyncBadge
          generatedAt={personQuery.generatedAt ?? detail.generatedAt}
        />
      </View>

      <HealthSheet
        person={healthFor}
        eventId={detail.event.id}
        onClose={() => setHealthFor(null)}
      />
    </>
  );
}

/** Su llegada: el estado en grande y lo que se puede hacer. */
function Arrival({
  eff,
  firstName,
  onMark,
}: {
  eff: Effective;
  firstName: string;
  onMark: (to: 'in' | 'absent' | 'pending') => void;
}) {
  const t = useComunicaTheme();
  const time = arrivedTime(eff.arrivedAt);
  const title =
    eff.status === 'in'
      ? time
        ? `Ha llegado a las ${time}`
        : 'Ha llegado'
      : eff.status === 'absent'
        ? 'No viene'
        : 'Aún no ha llegado';
  const by =
    eff.status === 'in' && eff.arrivedBy ? `Lo marcó ${eff.arrivedBy}` : null;
  const chip = t.chip(
    eff.status === 'in'
      ? 'positive'
      : eff.status === 'absent'
        ? 'neutral'
        : 'warning',
  );
  return (
    <CardSurface>
      <View style={styles.arrival}>
        <View
          style={[styles.arrivalState, { backgroundColor: chip.background }]}
          accessible
          accessibilityLiveRegion="polite"
          accessibilityLabel={[
            title,
            by,
            eff.queued ? 'sin subir todavía' : null,
          ]
            .filter(Boolean)
            .join('. ')}
        >
          <IconSymbol
            name={
              eff.status === 'in'
                ? 'checkmark.circle.fill'
                : eff.status === 'absent'
                  ? 'xmark.circle.fill'
                  : 'clock'
            }
            size={20}
            color={chip.text}
          />
          <View style={styles.flex}>
            <Text style={[styles.arrivalTitle, { color: chip.text }]}>
              {title}
            </Text>
            {by ? (
              <Text style={[styles.caption, { color: chip.text }]}>{by}</Text>
            ) : null}
          </View>
          {eff.queued ? (
            <IconSymbol
              name="icloud.and.arrow.up"
              size={16}
              color={t.textSecondary}
            />
          ) : null}
        </View>
        {eff.status === 'pending' ? (
          <>
            {/* La acción de la ficha: el degradado de marca. */}
            <AreaPrimaryButton
              label={`Ha llegado ${firstName}`}
              icon="checkmark"
              haptic={false}
              onPress={() => onMark('in')}
            />
            <SecondaryButton
              label="No viene"
              onPress={() => onMark('absent')}
            />
          </>
        ) : (
          <SecondaryButton
            label={
              eff.status === 'in'
                ? 'Deshacer la llegada'
                : 'Deshacer «No viene»'
            }
            icon="arrow.uturn.backward"
            onPress={() => onMark('pending')}
          />
        )}
        {eff.queued ? (
          <Text style={[styles.caption, { color: t.textSecondary }]}>
            Guardado en el móvil: se sube solo con cobertura.
          </Text>
        ) : null}
      </View>
    </CardSurface>
  );
}

function SecondaryButton({
  label,
  icon,
  onPress,
  disabled,
}: {
  label: string;
  icon?: 'arrow.uturn.backward';
  onPress: () => void;
  disabled?: boolean;
}) {
  const t = useComunicaTheme();
  return (
    <PressableFeedback
      onPress={onPress}
      isDisabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      style={[
        styles.secondary,
        { backgroundColor: t.backgroundSunken },
        disabled && styles.disabled,
      ]}
    >
      {icon ? <IconSymbol name={icon} size={18} color={t.accentText} /> : null}
      <Text style={[styles.secondaryLabel, { color: t.accentText }]}>
        {label}
      </Text>
      <PressableFeedback.Highlight />
    </PressableFeedback>
  );
}

/** La nota: se escribe aquí y se guarda en la cola (vacía, se borra). */
function NoteBlock({
  eff,
  onSave,
}: {
  eff: Effective;
  onSave: (note: string) => Promise<boolean>;
}) {
  const t = useComunicaTheme();
  const saved = eff.note ?? '';
  const [draft, setDraft] = useState(saved);
  const [editing, setEditing] = useState(false);
  // Lo que llega de otros (sondeo) se adopta mientras no se esté escribiendo.
  const [seen, setSeen] = useState(saved);
  if (seen !== saved) {
    setSeen(saved);
    if (!editing) setDraft(saved);
  }
  const dirty = cleanNote(draft) !== saved;
  const save = async (value: string) => {
    if (await onSave(value)) {
      h.formSuccess();
      setEditing(false);
    }
  };
  return (
    <FichaSection title="Nota">
      <CardSurface>
        <View style={styles.note}>
          <AppTextField
            value={draft}
            onChangeText={(v) => {
              setEditing(true);
              setDraft(v);
            }}
            placeholder="Llega más tarde, trae la autorización…"
            multiline
            maxLength={MANAGED_NOTE_MAX}
            accessibilityLabel="Nota"
            accessibilityHint="Nada de salud: eso va en su ficha del CRM"
            accentColor={t.accentText}
          />
          <Text style={[styles.caption, { color: t.textSecondary }]}>
            {eff.note && eff.noteBy && !dirty
              ? `Escrita por ${eff.noteBy}. `
              : ''}
            Se ve también en Comunica Tools. Nada de salud. {draft.length}/
            {MANAGED_NOTE_MAX}
          </Text>
          {dirty || saved ? (
            <View style={styles.noteActions}>
              {saved ? (
                <SecondaryButton
                  label="Borrar"
                  onPress={() => {
                    setDraft('');
                    void save('');
                  }}
                />
              ) : null}
              <SecondaryButton
                label="Guardar nota"
                disabled={!dirty}
                onPress={() => void save(draft)}
              />
            </View>
          ) : null}
        </View>
      </CardSurface>
    </FichaSection>
  );
}

const styles = StyleSheet.create({
  identity: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  identityBody: { flex: 1, gap: 4 },
  name: { ...typography.h2 },
  identityLine: { ...typography.subhead },
  roomLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  homeAlone: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: radii.md,
  },
  homeAloneText: { ...typography.body, fontWeight: '700', flex: 1 },
  arrival: { padding: 16, gap: 12 },
  arrivalState: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: radii.md,
  },
  arrivalTitle: { ...typography.title },
  secondary: {
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    minHeight: 48,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    overflow: 'hidden',
  },
  secondaryLabel: { ...typography.button },
  disabled: { opacity: 0.5 },
  note: { padding: 16, gap: 8 },
  noteActions: { flexDirection: 'row', gap: 12 },
  healthButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 52,
    paddingHorizontal: 16,
    borderRadius: radii.lg,
    overflow: 'hidden',
  },
  healthLabel: { ...typography.button },
  list: { borderRadius: radii.lg, overflow: 'hidden' },
  caption: { ...typography.caption },
  flex: { flex: 1 },
  folds: { gap: 12 },
  foot: { alignItems: 'center' },
});
