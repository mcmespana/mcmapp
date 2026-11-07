// components/comunica/comun/ComponentSampler.tsx
//
// La muestra de componentes del área (plan 03 tarea 5): cada componente en
// sus estados, con datos inventados. Es la página que se captura en claro y
// en oscuro para revisar el diseño de un vistazo, y la que se abre en el móvil
// (canal preview) para tocarlo todo.

import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import typography from '@/constants/typography';
import type { Mark, PersonSummary } from '@/services/comunica/contract';
import { MARK_LABEL, nextMarkOnTap } from '@/utils/comunica/marks';
import { addDays, madridDay } from '@/utils/comunica/madrid';
import AreaPrimaryButton from './AreaPrimaryButton';
import AreaScreen from './AreaScreen';
import { AreaSkeleton, OfflineNotice } from './AreaState';
import DateCapsule from './DateCapsule';
import { MarkIcon, MarkLegend, MarkPicker } from './MarkControl';
import PersonRow from './PersonRow';
import RecordCard from './RecordCard';
import RoleChip from './RoleChip';
import Section from './Section';
import StatusChip from './StatusChip';
import SyncBadge from './SyncBadge';
import UploadStatus from './UploadStatus';
import { useComunicaTheme } from './useComunicaTheme';

const PEOPLE: PersonSummary[] = [
  {
    id: 'f-m-1',
    firstName: 'Lucía',
    lastName: 'Arenas Bosque',
    schoolLevel: '1º ESO',
    badges: { healthNote: true, noPhotos: false, notHomeAlone: false },
  },
  {
    id: 'f-m-2',
    firstName: 'Hugo',
    lastName: 'Campos Durán',
    schoolLevel: '1º ESO',
    badges: { healthNote: false, noPhotos: true, notHomeAlone: true },
  },
  {
    id: 'f-m-3',
    firstName: 'Martina',
    lastName: 'Escobar Fuentes',
    schoolLevel: '1º ESO',
    badges: { healthNote: false, noPhotos: false, notHomeAlone: false },
  },
];

export default function ComponentSampler() {
  const t = useComunicaTheme();
  const today = madridDay(new Date());
  const [marks, setMarks] = useState<Record<string, Mark>>({
    'f-m-1': 'yes',
    'f-m-2': null,
    'f-m-3': 'no_justified',
  });
  const [picked, setPicked] = useState<Mark>('partial');
  const [fiveMinAgo] = useState(() =>
    new Date(Date.now() - 5 * 60_000).toISOString(),
  );

  return (
    <AreaScreen>
      <Group title="AreaPrimaryButton (la acción principal, una por pantalla)">
        <AreaPrimaryButton label="Guardar lista" onPress={() => {}} />
        <View style={styles.wrap}>
          <StatusChip label="Acento" tone="accent" />
          <Text style={[styles.caption, { color: t.accentText }]}>
            Enlace en el acento del área
          </Text>
        </View>
      </Group>

      <Group title="RecordCard">
        <RecordCard
          featured
          kicker={{ label: 'Hoy', tone: 'accent' }}
          code="C1"
          title="Brújula"
          lines={['1º ESO · 16:30 – 18:00 · 11 chavalines']}
          day={today}
          action={{ label: 'Pasar lista', onPress: () => {} }}
        />
        <RecordCard
          kicker={{ label: 'Pasada', tone: 'positive' }}
          code="C2"
          title="Faro"
          lines={['2º ESO · 10 vinieron, 2 ausencias']}
          day={addDays(today, -7)}
          onPress={() => {}}
        />
        <RecordCard
          kicker={{ label: 'Hace 6 días', tone: 'warning' }}
          code="M1"
          title="Los Peques"
          lines={['3º Primaria · Es la sesión de hace 6 días']}
          day={addDays(today, -6)}
          action={{ label: 'Recuperar', onPress: () => {} }}
        />
      </Group>

      <Group title="DateCapsule · StatusChip · RoleChip">
        <View style={styles.wrap}>
          <DateCapsule day={today} />
          <DateCapsule day="2026-12-26" />
        </View>
        <View style={styles.wrap}>
          <StatusChip label="Pendiente" />
          <StatusChip label="Pasada" tone="positive" />
          <StatusChip label="Sin registro" tone="warning" />
          <StatusChip label="No vino" tone="negative" />
          <StatusChip label="Hoy" tone="accent" />
        </View>
        <View style={styles.wrap}>
          <RoleChip role="coordination" />
          <RoleChip role="accompaniment" />
        </View>
      </Group>

      <Group title="MarkControl">
        <MarkLegend />
        <View style={styles.wrap}>
          {(
            [null, 'yes', 'partial', 'no_justified', 'no_unjustified'] as Mark[]
          ).map((m) => (
            <MarkIcon key={String(m)} mark={m} />
          ))}
        </View>
        <MarkPicker value={picked} onChange={setPicked} />
        <Text style={[styles.caption, { color: t.textSecondary }]}>
          Elegida: {picked ? MARK_LABEL[picked] : 'sin marcar'}
        </Text>
      </Group>

      <Section title="PersonRow (toca para marcar)">
        {PEOPLE.map((p) => (
          <PersonRow
            key={p.id}
            person={p}
            subtitle={p.schoolLevel}
            stateLabel={marks[p.id] ? MARK_LABEL[marks[p.id]!] : 'Sin marcar'}
            accessibilityHint="Toca para vino o no vino"
            onPress={() =>
              setMarks((s) => ({ ...s, [p.id]: nextMarkOnTap(s[p.id]) }))
            }
            right={<MarkIcon mark={marks[p.id]} />}
          />
        ))}
      </Section>

      <Section warning title="Te faltan 2 listas">
        <Text style={[styles.pad, { color: t.text }]}>Sección en ámbar</Text>
        <Text style={[styles.pad, { color: t.text }]}>Segunda fila</Text>
      </Section>

      <Group title="UploadStatus · SyncBadge">
        <UploadStatus state="pending" />
        <UploadStatus state="sending" />
        <UploadStatus state="applied" />
        <UploadStatus state="failed" onRetry={() => {}} />
        <UploadStatus state="stuck" onRetry={() => {}} />
        <SyncBadge generatedAt={fiveMinAgo} />
      </Group>

      <Group title="AreaState">
        <OfflineNotice />
        <AreaSkeleton kind="list" />
      </Group>
    </AreaScreen>
  );
}

function Group({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const t = useComunicaTheme();
  return (
    <View style={styles.group}>
      <Text style={[styles.groupTitle, { color: t.textSecondary }]}>
        {title}
      </Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: 12 },
  groupTitle: { ...typography.subhead, fontWeight: '600' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  caption: { ...typography.caption },
  pad: { ...typography.body, padding: 16 },
});
