// Piezas de la ficha del participante (plan 05, reglas 21, 23, 24 y 25):
// pliegues (Autorizaciones, Datos personales), pañuelo y anterior/siguiente.

import React, { useState } from 'react';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { PressableFeedback } from 'heroui-native';
import BottomSheet from '@/components/BottomSheet';
import { IconSymbol } from '@/components/ui/IconSymbol';
import typography from '@/constants/typography';
import { radii } from '@/constants/uiStyles';
import type {
  Consents,
  PersonalData,
  Scarf,
  SetScarf,
} from '@/services/comunica/contract';
import { useGruposWrites } from '@/hooks/comunica/useGrupos';
import { h } from '@/utils/haptics';
import {
  CONSENT_LABEL,
  CONSENT_ORDER,
  CONSENT_STATE_LABEL,
  consentState,
  consentsSummary,
} from '@/utils/comunica/consents';
import { mailtoUrl } from '@/utils/comunica/phone';
import { confirmAction } from '../comun/confirm';
import { SCARF_FILL, type ChipTone } from '../comun/theme';
import StatusChip from '../comun/StatusChip';
import UploadStatus, { type UploadState } from '../comun/UploadStatus';
import { useComunicaTheme } from '../comun/useComunicaTheme';
import { isOfflineError } from './healthCopy';

// ── Cabecera de sección ─────────────────────────────────────────────────────

export function FichaSection({
  title,
  right,
  children,
}: {
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  const t = useComunicaTheme();
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Text
          accessibilityRole="header"
          style={[styles.sectionTitle, { color: t.textSecondary }]}
        >
          {title}
        </Text>
        {right}
      </View>
      {children}
    </View>
  );
}

// ── Pliegue ─────────────────────────────────────────────────────────────────

/** Sección plegable: cerrada, al fondo, con lo que importa en la solapa. */
export function Fold({
  title,
  summary,
  children,
}: {
  title: string;
  summary?: string;
  children: React.ReactNode;
}) {
  const t = useComunicaTheme();
  const [open, setOpen] = useState(false);
  return (
    <View style={[styles.fold, { backgroundColor: t.card }]}>
      <PressableFeedback
        onPress={() => {
          h.toggle();
          setOpen((o) => !o);
        }}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={[title, summary].filter(Boolean).join(', ')}
        style={styles.foldHead}
      >
        <PressableFeedback.Highlight />
        <Text style={[styles.foldTitle, { color: t.text }]}>{title}</Text>
        {summary ? (
          <Text
            style={[styles.foldSummary, { color: t.textSecondary }]}
            numberOfLines={2}
          >
            {summary}
          </Text>
        ) : null}
        <IconSymbol
          name={open ? 'chevron.up' : 'chevron.down'}
          size={16}
          color={t.textMuted}
        />
      </PressableFeedback>
      {open ? (
        <View style={[styles.foldBody, { borderTopColor: t.separator }]}>
          {children}
        </View>
      ) : null}
    </View>
  );
}

const CONSENT_TONE: Record<ReturnType<typeof consentState>, ChipTone> = {
  yes: 'positive',
  no: 'negative',
  unanswered: 'warning',
};

export function ConsentsFold({ consents }: { consents: Consents }) {
  const t = useComunicaTheme();
  return (
    <Fold title="Autorizaciones" summary={consentsSummary(consents)}>
      {CONSENT_ORDER.map((k) => {
        const s = consentState(consents[k]);
        return (
          <View
            key={k}
            style={styles.kv}
            accessible
            accessibilityLabel={`${CONSENT_LABEL[k]}: ${CONSENT_STATE_LABEL[s]}`}
          >
            <Text style={[styles.kvLabel, { color: t.text }]}>
              {CONSENT_LABEL[k]}
            </Text>
            {/* `StatusChip` va con `alignSelf: flex-start`: se centra aquí. */}
            <View>
              <StatusChip
                label={CONSENT_STATE_LABEL[s]}
                tone={CONSENT_TONE[s]}
              />
            </View>
          </View>
        );
      })}
    </Fold>
  );
}

const MONTHS = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

/** «30 de julio de 2013». */
export function longDate(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  return `${d} de ${MONTHS[m - 1]} de ${y}`;
}

/** Las filas con dato, en el orden del plugin. Sin sexo. */
export function personalRows(p: PersonalData): [string, string][] {
  const rows: [string, string | undefined][] = [
    ['Nacimiento', p.birthDate ? longDate(p.birthDate) : undefined],
    [p.document?.kindLabel || 'Documento', p.document?.number],
    ['Dirección', p.address],
    ['Centro educativo', p.school],
    ['Correo', p.email],
    ['Talla', p.size],
    ['Etapa', p.stageLabel],
    ['Nivel COM', p.comLevelLabel],
    ['Nº de persona', p.personNumber],
  ];
  return rows.filter((r): r is [string, string] => !!r[1]);
}

export function PersonalFold({
  query,
}: {
  query: { data?: PersonalData; error: unknown; isPending: boolean };
}) {
  const t = useComunicaTheme();
  const d = query.data;
  if (d && personalRows(d).length === 0) return null;
  return (
    <Fold title="Datos personales" summary={d?.city}>
      {d ? (
        personalRows(d).map(([label, value]) => (
          <View key={label} style={styles.kv}>
            <Text style={[styles.kvLabel, { color: t.textSecondary }]}>
              {label}
            </Text>
            {label === 'Correo' ? (
              <PressableFeedback
                onPress={() => void openUrl(mailtoUrl(value))}
                accessibilityRole="link"
                accessibilityLabel={`Escribir a ${value}`}
                hitSlop={8}
                style={styles.kvValueWrap}
              >
                <Text style={[styles.kvValue, { color: t.accentText }]}>
                  {value}
                </Text>
              </PressableFeedback>
            ) : (
              <Text
                style={[styles.kvValue, styles.kvValueWrap, { color: t.text }]}
              >
                {value}
              </Text>
            )}
          </View>
        ))
      ) : (
        <Text style={[styles.note, { color: t.textSecondary }]}>
          {query.error
            ? isOfflineError(query.error)
              ? 'Necesitas conexión para ver los datos personales.'
              : 'No se han podido cargar los datos personales.'
            : 'Cargando…'}
        </Text>
      )}
    </Fold>
  );
}

// ── Pañuelo ─────────────────────────────────────────────────────────────────

export const SCARF_LABEL: Record<Scarf, string> = {
  none: 'No',
  red: 'Rojo',
  green: 'Verde',
  blue: 'Azul',
  yellow: 'Amarillo',
  cross: 'Cruz',
  unknown: 'Desconocido',
};

const SETTABLE: SetScarf[] = [
  'none',
  'red',
  'green',
  'blue',
  'yellow',
  'cross',
];

export function ScarfBlock({
  personId,
  firstName,
  scarf,
  upload,
  onRetry,
}: {
  personId: string;
  firstName: string;
  scarf: Scarf;
  upload?: UploadState;
  onRetry?: () => void;
}) {
  const t = useComunicaTheme();
  const { setScarf } = useGruposWrites();
  const [open, setOpen] = useState(false);
  const pick = async (s: SetScarf) => {
    const ok = await confirmAction(
      `¿Cambiar el pañuelo de ${firstName} a ${SCARF_LABEL[s]}?`,
      undefined,
      'Cambiar',
    );
    if (!ok) return;
    setOpen(false);
    await setScarf(personId, s);
    h.formSuccess();
  };
  return (
    <FichaSection title="Pañuelo">
      <View style={[styles.card, { backgroundColor: t.card }]}>
        <View style={styles.scarfRow}>
          <View
            style={[styles.scarfDot, { backgroundColor: SCARF_FILL[scarf] }]}
          />
          <Text style={[styles.scarfLabel, { color: t.text }]}>
            {SCARF_LABEL[scarf]}
          </Text>
          <PressableFeedback
            onPress={() => {
              h.select();
              setOpen(true);
            }}
            accessibilityRole="button"
            accessibilityLabel={`Cambiar el pañuelo de ${firstName}`}
            hitSlop={8}
            style={styles.textButton}
          >
            <Text style={[styles.textButtonLabel, { color: t.accentText }]}>
              Cambiar
            </Text>
          </PressableFeedback>
        </View>
        {upload ? <UploadStatus state={upload} onRetry={onRetry} /> : null}
      </View>
      <BottomSheet
        visible={open}
        onClose={() => setOpen(false)}
        title="Pañuelo"
      >
        <ScrollView>
          <View style={[styles.sheetList, { backgroundColor: t.card }]}>
            {SETTABLE.filter((s) => s !== scarf).map((s, i) => (
              <PressableFeedback
                key={s}
                onPress={() => void pick(s)}
                accessibilityRole="button"
                accessibilityLabel={SCARF_LABEL[s]}
                style={[
                  styles.option,
                  i > 0 && {
                    borderTopWidth: StyleSheet.hairlineWidth,
                    borderTopColor: t.separator,
                  },
                ]}
              >
                <PressableFeedback.Highlight />
                <View
                  style={[styles.scarfDot, { backgroundColor: SCARF_FILL[s] }]}
                />
                <Text style={[styles.scarfLabel, { color: t.text }]}>
                  {SCARF_LABEL[s]}
                </Text>
              </PressableFeedback>
            ))}
          </View>
        </ScrollView>
      </BottomSheet>
    </FichaSection>
  );
}

// ── Anterior / siguiente ────────────────────────────────────────────────────

export function Pager({
  prev,
  next,
  onGo,
}: {
  prev: { id: string; firstName: string } | null;
  next: { id: string; firstName: string } | null;
  onGo: (id: string) => void;
}) {
  const t = useComunicaTheme();
  if (!prev && !next) return null;
  const button = (
    p: { id: string; firstName: string } | null,
    dir: 'prev' | 'next',
  ) =>
    p ? (
      <PressableFeedback
        onPress={() => {
          h.navigate();
          onGo(p.id);
        }}
        accessibilityRole="button"
        accessibilityLabel={
          dir === 'prev'
            ? `Anterior: ${p.firstName}`
            : `Siguiente: ${p.firstName}`
        }
        style={[
          styles.pagerButton,
          dir === 'next' && styles.pagerNext,
          { backgroundColor: t.card },
        ]}
      >
        <PressableFeedback.Highlight />
        {dir === 'prev' ? (
          <IconSymbol name="chevron.left" size={16} color={t.accentText} />
        ) : null}
        <View style={styles.pagerText}>
          <Text style={[styles.pagerKicker, { color: t.textSecondary }]}>
            {dir === 'prev' ? 'Anterior' : 'Siguiente'}
          </Text>
          <Text style={[styles.pagerName, { color: t.text }]} numberOfLines={1}>
            {p.firstName}
          </Text>
        </View>
        {dir === 'next' ? (
          <IconSymbol name="chevron.right" size={16} color={t.accentText} />
        ) : null}
      </PressableFeedback>
    ) : (
      // El hueco del lado que falta se guarda: el otro botón no se descoloca.
      <View style={styles.pagerSlot} />
    );
  return (
    <View style={styles.pager}>
      {button(prev, 'prev')}
      {button(next, 'next')}
    </View>
  );
}

/** `Linking.openURL` sin romper si el móvil no sabe abrirlo. */
export async function openUrl(url: string) {
  try {
    await Linking.openURL(url);
  } catch {
    // Sin app para `tel:`/`mailto:` (un simulador, la web sin cliente).
  }
}

const styles = StyleSheet.create({
  section: { gap: 8 },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    gap: 8,
  },
  sectionTitle: { ...typography.subhead, fontWeight: '600' },
  card: { borderRadius: radii.lg, padding: 16, gap: 8 },
  fold: { borderRadius: radii.lg, overflow: 'hidden' },
  foldHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 52,
    paddingHorizontal: 16,
  },
  foldTitle: { ...typography.title, flexShrink: 0 },
  foldSummary: { ...typography.caption, flex: 1, textAlign: 'right' },
  foldBody: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  kv: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    minHeight: 44,
  },
  kvLabel: { ...typography.subhead, flexShrink: 1 },
  kvValueWrap: { flex: 1 },
  kvValue: { ...typography.body, textAlign: 'right' },
  note: { ...typography.subhead, paddingVertical: 8 },
  scarfRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  scarfDot: { width: 18, height: 18, borderRadius: radii.pillFull },
  scarfLabel: { ...typography.body, flex: 1 },
  textButton: { minHeight: 44, justifyContent: 'center' },
  textButtonLabel: { ...typography.button },
  sheetList: { borderRadius: radii.md, overflow: 'hidden', marginBottom: 16 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 52,
    paddingHorizontal: 16,
  },
  pager: { flexDirection: 'row', gap: 12 },
  pagerButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 56,
    paddingHorizontal: 12,
    borderRadius: radii.lg,
    overflow: 'hidden',
  },
  pagerNext: { justifyContent: 'flex-end' },
  pagerSlot: { flex: 1 },
  pagerText: { flexShrink: 1 },
  pagerKicker: { ...typography.caption },
  pagerName: { ...typography.body, fontWeight: '600' },
});
