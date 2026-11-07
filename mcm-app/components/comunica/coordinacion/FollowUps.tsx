// Los SEGUIMIENTOS de un monitor en su ficha (plan 06, regla 13;
// `PASAR-LISTA-SEGUIMIENTOS.md` §5 y §7 del plugin):
//
//   · Nunca se guardan en el móvil (`persist: false`): sin conexión, «Los
//     seguimientos necesitan conexión.».
//   · Sobre uno mismo el servidor no deja leer ni escribir nada: la sección
//     NO EXISTE (no una vacía con un alta que siempre falla).
//   · Segundo cierre: aunque el servidor ya filtre, aquí se vuelve a filtrar
//     con lo legible (`visibleFollowUps`).
//   · Por defecto, solo este curso; el botón suma el anterior sin pedir nada.
//   · El alta va por la cola: arriba con su `UploadStatus` hasta que sube.

import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PressableFeedback } from 'heroui-native';
import BottomSheet from '@/components/BottomSheet';
import AppTextField from '@/components/ui/AppTextField';
import typography from '@/constants/typography';
import { radii } from '@/constants/uiStyles';
import { comunicaNow } from '@/services/comunica';
import {
  FOLLOW_UP_TEXT_MAX,
  type FollowUp,
  type FollowUpType,
  type FollowUpWrite,
} from '@/services/comunica/contract';
import {
  useCoordinationWrites,
  useFollowUps,
} from '@/hooks/comunica/coordination';
import { useOutbox } from '@/hooks/comunica/useOutbox';
import { h } from '@/utils/haptics';
import { shortDayMonth } from '@/utils/comunica/dates';
import {
  ACCOMPANIMENT_WARNING,
  FOLLOW_UP_META,
  followUpsView,
  visibleFollowUps,
} from '@/utils/comunica/followUps';
import { madridDay } from '@/utils/comunica/madrid';
import AreaPrimaryButton from '../comun/AreaPrimaryButton';
import { isNetwork } from '../comun/AreaState';
import DateTimeField from '../comun/DateTimeField';
import StatusChip from '../comun/StatusChip';
import UploadStatus from '../comun/UploadStatus';
import { useComunicaTheme } from '../comun/useComunicaTheme';
import { FichaSection } from '../grupos/FichaParts';

export default function FollowUps({ monitorId }: { monitorId: string }) {
  const t = useComunicaTheme();
  const q = useFollowUps(monitorId);
  const { pending, outbox } = useOutbox();
  const [showPrevious, setShowPrevious] = useState(false);
  const [writing, setWriting] = useState(false);

  if (q.error) {
    return (
      <FichaSection title="Seguimientos">
        <Text style={[styles.body, { color: t.textSecondary }]}>
          {isNetwork(q.error)
            ? 'Los seguimientos necesitan conexión.'
            : 'No se han podido cargar los seguimientos.'}
        </Text>
      </FichaSection>
    );
  }
  if (!q.data) return null;
  const { readable, writable } = q.data;
  // Sobre uno mismo (o sin papel para verlos): la sección no existe.
  if (readable.length === 0 && writable.length === 0) return null;

  const items = visibleFollowUps(q.data.items, readable);
  const view = followUpsView(items, madridDay(comunicaNow()), showPrevious);
  const queued = pending.filter(
    (e) => e.kind === 'follow-up' && e.meta.monitorId === monitorId,
  );

  return (
    <FichaSection
      title="Seguimientos"
      right={
        writable.length > 0 ? (
          <PressableFeedback
            onPress={() => {
              h.tap();
              setWriting(true);
            }}
            accessibilityRole="button"
            style={styles.tapTarget}
          >
            <Text style={[styles.link, { color: t.accentText }]}>
              Escribir un seguimiento
            </Text>
          </PressableFeedback>
        ) : undefined
      }
    >
      <View style={[styles.card, { backgroundColor: t.card }]}>
        {queued.map((e) => {
          const body = e.payload as Omit<FollowUpWrite, 'clientId'>;
          return (
            <Item
              key={e.key}
              type={body.type}
              date={body.date}
              text={body.text}
              footer={
                <UploadStatus
                  state={e.status}
                  onRetry={() => void outbox?.retry(e.key)}
                />
              }
            />
          );
        })}
        {view.items.map((f: FollowUp) => (
          <Item
            key={f.id}
            type={f.type}
            date={f.date}
            text={f.text}
            author={f.author}
          />
        ))}
        {view.items.length === 0 && queued.length === 0 ? (
          <Text style={[styles.body, styles.pad, { color: t.textSecondary }]}>
            {view.empty}
          </Text>
        ) : null}
      </View>
      {view.toggle ? (
        <PressableFeedback
          onPress={() => {
            h.toggle();
            setShowPrevious((s) => !s);
          }}
          accessibilityRole="button"
          style={styles.tapTarget}
        >
          <Text style={[styles.link, { color: t.accentText }]}>
            {view.toggle}
          </Text>
        </PressableFeedback>
      ) : null}
      <WriteSheet
        visible={writing}
        monitorId={monitorId}
        writable={writable}
        onClose={() => setWriting(false)}
      />
    </FichaSection>
  );
}

function Item({
  type,
  date,
  text,
  author,
  footer,
}: {
  type: FollowUpType;
  date: string | null;
  text: string;
  author?: string;
  footer?: React.ReactNode;
}) {
  const t = useComunicaTheme();
  const meta = FOLLOW_UP_META[type];
  return (
    <View style={[styles.item, { borderBottomColor: t.separator }]}>
      <View style={styles.itemHead}>
        <StatusChip label={meta.label} tone={meta.tone} />
        <Text style={[styles.small, { color: t.textSecondary }]}>
          {[date ? shortDayMonth(date) : 'Sin fecha', author]
            .filter(Boolean)
            .join(' · ')}
        </Text>
      </View>
      <Text style={[styles.body, { color: t.text }]}>{text}</Text>
      {footer}
    </View>
  );
}

function WriteSheet({
  visible,
  monitorId,
  writable,
  onClose,
}: {
  visible: boolean;
  monitorId: string;
  writable: FollowUpType[];
  onClose: () => void;
}) {
  const t = useComunicaTheme();
  const { createFollowUp } = useCoordinationWrites();
  const today = madridDay(comunicaNow());
  const [type, setType] = useState<FollowUpType | null>(
    writable.length === 1 ? writable[0] : null,
  );
  const [date, setDate] = useState(today);
  const [text, setText] = useState('');
  const [tried, setTried] = useState(false);
  const error = !type
    ? 'Elige el tipo.'
    : !text.trim()
      ? 'Escribe qué pasó.'
      : !/^\d{4}-\d{2}-\d{2}$/.test(date)
        ? 'Elige el día.'
        : null;

  const submit = async () => {
    setTried(true);
    if (error || !type) {
      h.error();
      return;
    }
    await createFollowUp(monitorId, { type, date, text: text.trim() });
    h.formSuccess();
    setText('');
    setDate(today);
    setTried(false);
    onClose();
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="Escribir un seguimiento"
    >
      <View style={styles.form}>
        <View accessibilityRole="radiogroup" style={styles.types}>
          {writable.map((w) => {
            const selected = type === w;
            return (
              <PressableFeedback
                key={w}
                onPress={() => {
                  h.select();
                  setType(w);
                }}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={`${FOLLOW_UP_META[w].label}. ${FOLLOW_UP_META[w].help}`}
                style={[
                  styles.type,
                  {
                    borderColor: selected ? t.accentText : t.separator,
                    backgroundColor: selected ? t.backgroundSunken : t.card,
                  },
                ]}
              >
                <Text style={[styles.typeLabel, { color: t.text }]}>
                  {FOLLOW_UP_META[w].label}
                </Text>
                <Text style={[styles.small, { color: t.textSecondary }]}>
                  {FOLLOW_UP_META[w].help}
                </Text>
              </PressableFeedback>
            );
          })}
        </View>
        <DateTimeField
          mode="date"
          label="Día"
          value={date}
          onChange={setDate}
        />
        <AppTextField
          value={text}
          onChangeText={setText}
          placeholder="En dos líneas, para acordarse."
          accessibilityLabel="Qué pasó"
          multiline
          maxLength={FOLLOW_UP_TEXT_MAX}
          accentColor={t.accentText}
          error={tried && !text.trim()}
        />
        {writable.includes('accompaniment') ? (
          <Text style={[styles.small, { color: t.textSecondary }]}>
            {ACCOMPANIMENT_WARNING}
          </Text>
        ) : null}
        {tried && error ? (
          <Text
            style={[styles.small, { color: t.dangerText }]}
            accessibilityRole="alert"
          >
            {error}
          </Text>
        ) : null}
        <AreaPrimaryButton
          label="Guardar el seguimiento"
          onPress={() => void submit()}
          haptic={false}
        />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: { ...typography.body },
  small: { ...typography.caption },
  link: { ...typography.button },
  pad: { padding: 16 },
  tapTarget: { minHeight: 44, justifyContent: 'center' },
  card: { borderRadius: radii.lg, overflow: 'hidden' },
  item: {
    padding: 16,
    gap: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  itemHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  form: { gap: 16, paddingBottom: 16 },
  types: { gap: 8 },
  type: {
    minHeight: 56,
    padding: 12,
    gap: 2,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  typeLabel: { ...typography.body, fontWeight: '600' },
});
