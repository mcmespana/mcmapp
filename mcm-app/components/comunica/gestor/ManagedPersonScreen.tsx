// La ficha de un inscrito para quien gestiona el evento (plan 18). Es la ficha
// de Grupos y Pasar lista (`grupos/ParticipantScreen.tsx`) con sus mismas
// piezas —cabecera, botones al tutor, contacto, autorizaciones y datos
// personales plegados— y, ENCIMA, lo del evento, en el orden en que se mira en
// la puerta:
//
//   identidad → EN EL EVENTO (llegada, habitación con «Cambiar», nota) → A
//   TENER EN CUENTA («No puede irse solo/a a casa», marcas y la salud, con un
//   botón aparte: nunca se guarda) → botones al tutor 1 → Contacto →
//   Monitor/a (desplegado, si tiene) → Autorizaciones y Datos personales
//   (plegados; los personales, con el documento, se piden aparte y nunca se
//   guardan).
//
// Monitor/a va antes que los pliegues: lo desplegado arriba y lo plegado
// cerrando la ficha, como en Grupos.
//
// La llegada, la nota y la habitación van a la cola, como en la lista: sin
// cobertura también. La ficha (teléfonos, familia, monitor) se guarda como la
// de Grupos; si aún no se ha abierto nunca y no hay red, se ve lo que dice la
// lista.

import React, { useMemo, useState } from 'react';
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
  useManagedPersonal,
} from '@/hooks/comunica/managedEvents';
import { useFlushOutboxOnMount } from '@/hooks/comunica/useOutbox';
import { h } from '@/utils/haptics';
import {
  arrivedTime,
  cleanNote,
  ROLE_LABEL,
  type Effective,
} from '@/utils/comunica/checkin';
import { monitorSummary } from '@/utils/comunica/monitorProfile';
import { ageLabel } from '@/utils/comunica/people';
import { canWhatsappMinor, cleanPhone } from '@/utils/comunica/phone';
import {
  floorLabel,
  freeLabel,
  roomOccupancy,
  venuesOf,
  type RoomUse,
} from '@/utils/comunica/rooms';
import AreaPrimaryButton from '../comun/AreaPrimaryButton';
import AreaScreen from '../comun/AreaScreen';
import AreaState from '../comun/AreaState';
import CardSurface from '../comun/CardSurface';
import PersonAvatar from '../comun/PersonAvatar';
import PersonMarks from '../comun/PersonMarks';
import SyncBadge from '../comun/SyncBadge';
import { ROOM_CHIP } from '../comun/theme';
import { useComunicaTheme } from '../comun/useComunicaTheme';
import { ConsentsFold, FichaSection, PersonalFold } from '../grupos/FichaParts';
import HealthSheet from '../grupos/HealthSheet';
import { ContactRow, Hint, QuickButtons } from '../grupos/ParticipantScreen';
import RoomSheet, { roomNow } from './RoomSheet';
import { useRoomPicker } from './useRoomPicker';

interface Props {
  eventId: string;
  personId: string;
}

export const NOT_REGISTERED =
  'Esta persona no está inscrita en el evento que gestionas.';

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
          <EmptyState icon="lock" title={NOT_REGISTERED} titleColor={t.text} />
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
                title={NOT_REGISTERED}
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
  const eventId = detail.event.id;
  const { effective, mark, setNote, setRoom } = useCheckin(eventId, detail);
  const picker = useRoomPicker(detail, setRoom);
  const personal = useManagedPersonal(eventId, reg.personId, true);
  const occ = useMemo(
    () => roomOccupancy(detail, effective),
    [detail, effective],
  );
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
  const homeAlone = consents?.goHomeAlone === false || badges.notHomeAlone;
  const ownPhone = cleanPhone(person?.phones.own);
  const emergency = cleanPhone(person?.phones.emergency);
  const tutor = person?.guardians.find((g) => cleanPhone(g.phone));
  const tutorPhone = tutor ? cleanPhone(tutor.phone) : null;
  const monitor = person?.monitor ? monitorSummary(person.monitor) : null;

  const openRoom = () =>
    picker.open({
      ids: [reg.registrationId],
      title: name,
      subtitle: roomNow(detail, eff.roomId),
    });

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
        </View>
      </View>

      <FichaSection title="En el evento">
        <CardSurface clip>
          {out ? (
            <View style={styles.pad}>
              <Hint text="Su inscripción está cancelada: no se le espera." />
            </View>
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
          {detail.rooms.length > 0 && !out ? (
            <RoomRow
              detail={detail}
              use={eff.roomId ? occ.get(eff.roomId) : undefined}
              queued={eff.queued}
              onChange={openRoom}
            />
          ) : null}
          <NoteRow
            key={reg.registrationId}
            eff={eff}
            onSave={(note) => setNote(reg.registrationId, note)}
          />
        </CardSurface>
      </FichaSection>

      <FichaSection title="A tener en cuenta">
        {homeAlone ? (
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
        {/* Sin repetir «No se va solo/a»: ya lo dice el aviso de arriba. */}
        <PersonMarks
          badges={{ ...badges, notHomeAlone: false }}
          onHealth={() => setHealthFor(sheetPerson)}
        />
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
          <View style={styles.flex}>
            <Text style={[styles.healthLabel, { color: t.accentText }]}>
              Salud: alergias, tratamientos…
            </Text>
            <Text style={[styles.caption, { color: t.textSecondary }]}>
              Solo con conexión. No se guarda en el móvil.
            </Text>
          </View>
          <IconSymbol name="chevron.right" size={16} color={t.textMuted} />
          <PressableFeedback.Highlight />
        </PressableFeedback>
      </FichaSection>

      {tutor && tutorPhone ? (
        <QuickButtons
          guardian={tutor}
          phone={tutorPhone}
          primary={out || eff.status !== 'pending'}
        />
      ) : null}

      <FichaSection title="Contacto">
        {person ? (
          ownPhone ||
          person.email ||
          person.guardians.length > 0 ||
          emergency ? (
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
          ) : (
            <Hint text="En su ficha no hay ningún teléfono ni correo." />
          )
        ) : personQuery.error ? (
          <Hint text="Sin conexión: los teléfonos salen cuando se abra la ficha con cobertura." />
        ) : (
          <AreaState query={personQuery} skeleton="list">
            {() => null}
          </AreaState>
        )}
        {person &&
        (ownPhone || person.guardians.length > 0) &&
        !tutor &&
        reg.role === 'participant' ? (
          <Hint text="Nadie de la familia tiene teléfono en el CRM." />
        ) : null}
      </FichaSection>

      {monitor ? (
        <FichaSection title="Monitor/a">
          {monitor.length > 0 ? (
            <CardSurface clip>
              {monitor.map((g, gi) => (
                <View
                  key={g.title}
                  style={[
                    styles.monGroup,
                    gi > 0 && {
                      borderTopWidth: StyleSheet.hairlineWidth,
                      borderTopColor: t.separator,
                    },
                  ]}
                >
                  <Text
                    accessibilityRole="header"
                    style={[styles.monTitle, { color: t.text }]}
                  >
                    {g.title}
                  </Text>
                  {g.rows.map(([label, value]) => (
                    <View
                      key={label}
                      style={styles.kv}
                      accessible
                      accessibilityLabel={`${label}: ${value}`}
                    >
                      <Text
                        style={[styles.kvLabel, { color: t.textSecondary }]}
                      >
                        {label}
                      </Text>
                      <Text style={[styles.kvValue, { color: t.text }]}>
                        {value}
                      </Text>
                    </View>
                  ))}
                </View>
              ))}
            </CardSurface>
          ) : (
            <Hint text="Tiene ficha de monitor/a, pero sin nada rellenado." />
          )}
        </FichaSection>
      ) : null}

      <View style={styles.folds}>
        {consents ? <ConsentsFold consents={consents} /> : null}
        <PersonalFold query={personal} />
      </View>

      <View style={styles.foot}>
        <SyncBadge
          generatedAt={personQuery.generatedAt ?? detail.generatedAt}
        />
      </View>

      <HealthSheet
        person={healthFor}
        eventId={eventId}
        onClose={() => setHealthFor(null)}
      />
      <RoomSheet detail={detail} effective={effective} {...picker.sheet} />
    </>
  );
}

/** Su llegada: el estado y lo que se puede hacer. */
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
    <View style={styles.arrival}>
      <View
        style={[styles.arrivalState, { backgroundColor: chip.background }]}
        accessible
        accessibilityLiveRegion="polite"
        accessibilityLabel={[title, by, eff.queued ? 'sin subir todavía' : null]
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
          <SecondaryButton label="No viene" onPress={() => onMark('absent')} />
        </>
      ) : (
        <SecondaryButton
          label={
            eff.status === 'in' ? 'Deshacer la llegada' : 'Deshacer «No viene»'
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
  );
}

/** Su habitación, con el color de cómo está y «Cambiar» de un toque. */
function RoomRow({
  detail,
  use,
  queued,
  onChange,
}: {
  detail: ManagedEventDetail;
  use: RoomUse | undefined;
  queued: boolean;
  onChange: () => void;
}) {
  const t = useComunicaTheme();
  const room = use?.room;
  const many = venuesOf(detail.rooms).length > 1;
  const chip = use ? t.chip(ROOM_CHIP[use.tone]) : null;
  const where = room
    ? [room.floor ? floorLabel(room.floor) : null, many ? room.venue : null]
        .filter(Boolean)
        .join(' · ')
    : '';
  return (
    <View
      style={[styles.row, { borderTopColor: t.separator }]}
      accessible={false}
    >
      <IconSymbol name="bed.double" size={20} color={t.accentText} />
      <View style={styles.flex}>
        <Text
          style={[styles.rowTitle, { color: room ? t.text : t.textSecondary }]}
        >
          {room ? `Habitación ${room.code}` : 'Sin habitación'}
        </Text>
        {room ? (
          <View style={styles.roomMeta}>
            {where ? (
              <Text style={[styles.caption, { color: t.textSecondary }]}>
                {where}
              </Text>
            ) : null}
            {use && chip ? (
              <View style={[styles.occ, { backgroundColor: chip.background }]}>
                <Text style={[styles.occText, { color: chip.text }]}>
                  {use.taken}/{use.capacity} · {freeLabel(use)}
                </Text>
              </View>
            ) : null}
            {queued ? (
              <IconSymbol
                name="icloud.and.arrow.up"
                size={14}
                color={t.textMuted}
              />
            ) : null}
          </View>
        ) : null}
      </View>
      <PressableFeedback
        onPress={() => {
          h.tap();
          onChange();
        }}
        accessibilityRole="button"
        accessibilityLabel={
          room
            ? `Cambiar de habitación (ahora, la ${room.code})`
            : 'Poner habitación'
        }
        style={[styles.rowAction, { backgroundColor: t.backgroundSunken }]}
      >
        <Text style={[styles.rowActionText, { color: t.accentText }]}>
          {room ? 'Cambiar' : 'Poner'}
        </Text>
        <PressableFeedback.Highlight />
      </PressableFeedback>
    </View>
  );
}

/**
 * La nota del evento: se lee de un vistazo y se edita al tocar «Editar» (o
 * «Añadir una nota»). Va a la cola; vacía, se borra.
 */
function NoteRow({
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
  if (!editing) {
    return (
      <View style={[styles.row, { borderTopColor: t.separator }]}>
        <IconSymbol name="note.text" size={20} color={t.accentText} />
        <View style={styles.flex}>
          {saved ? (
            <>
              <Text style={[styles.body, { color: t.text }]}>{saved}</Text>
              {eff.noteBy ? (
                <Text style={[styles.caption, { color: t.textSecondary }]}>
                  Escrita por {eff.noteBy}
                </Text>
              ) : null}
            </>
          ) : (
            <Text style={[styles.body, { color: t.textSecondary }]}>
              Sin nota del evento
            </Text>
          )}
        </View>
        <PressableFeedback
          onPress={() => {
            h.tap();
            setDraft(saved);
            setEditing(true);
          }}
          accessibilityRole="button"
          accessibilityLabel={saved ? 'Editar la nota' : 'Añadir una nota'}
          style={[styles.rowAction, { backgroundColor: t.backgroundSunken }]}
        >
          <Text style={[styles.rowActionText, { color: t.accentText }]}>
            {saved ? 'Editar' : 'Añadir'}
          </Text>
          <PressableFeedback.Highlight />
        </PressableFeedback>
      </View>
    );
  }
  return (
    <View style={[styles.note, { borderTopColor: t.separator }]}>
      <AppTextField
        value={draft}
        onChangeText={setDraft}
        placeholder="Llega más tarde, trae la autorización…"
        multiline
        autoFocus
        maxLength={MANAGED_NOTE_MAX}
        accessibilityLabel="Nota"
        accessibilityHint="Nada de salud: eso va en su ficha del CRM"
        accentColor={t.accentText}
      />
      <Text style={[styles.caption, { color: t.textSecondary }]}>
        Se ve también en Comunica Tools. Nada de salud. {draft.length}/
        {MANAGED_NOTE_MAX}
      </Text>
      <View style={styles.noteActions}>
        {saved ? (
          <SecondaryButton
            label="Borrar"
            onPress={() => {
              setDraft('');
              void save('');
            }}
          />
        ) : (
          <SecondaryButton
            label="Cancelar"
            onPress={() => {
              setDraft(saved);
              setEditing(false);
            }}
          />
        )}
        <SecondaryButton
          label="Guardar nota"
          disabled={!dirty}
          onPress={() => void save(draft)}
        />
      </View>
    </View>
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

const styles = StyleSheet.create({
  identity: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  identityBody: { flex: 1, gap: 4 },
  name: { ...typography.h2 },
  identityLine: { ...typography.subhead },
  pad: { padding: 16 },
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 60,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  rowTitle: { ...typography.body, fontWeight: '600' },
  roomMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 2,
  },
  occ: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: radii.xs },
  occText: { ...typography.footnote, fontWeight: '700' },
  rowAction: {
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: 14,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  rowActionText: { ...typography.button },
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
  note: {
    padding: 16,
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  noteActions: { flexDirection: 'row', gap: 12 },
  healthButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 56,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radii.lg,
    overflow: 'hidden',
  },
  healthLabel: { ...typography.button },
  list: { borderRadius: radii.lg, overflow: 'hidden' },
  monGroup: { padding: 16, gap: 8 },
  monTitle: { ...typography.body, fontWeight: '700' },
  kv: { gap: 2 },
  kvLabel: { ...typography.caption },
  kvValue: { ...typography.body },
  body: { ...typography.body },
  caption: { ...typography.caption },
  flex: { flex: 1 },
  folds: { gap: 12 },
  foot: { alignItems: 'center' },
});
