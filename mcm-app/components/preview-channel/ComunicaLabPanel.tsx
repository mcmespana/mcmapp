import React, { useCallback, useSyncExternalStore } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PressableFeedback } from 'heroui-native';
import { router } from 'expo-router';

import { usePreviewChannel } from '@/contexts/PreviewChannelContext';
import { durations } from '@/constants/animations';
import spacing from '@/constants/spacing';
import typography from '@/constants/typography';
import { radii } from '@/constants/uiStyles';
import { getFakeServer, type FakeControls } from '@/services/comunica';

import {
  addDays,
  madridDay,
  madridInstant,
  weekday,
} from '@/utils/comunica/madrid';
import { h } from '@/utils/haptics';

/**
 * «Comunica nueva» en el Laboratorio Alpha (planes 00 §4 y 10 §1 de
 * `docs/planes/area-nativa/`): dice qué se está viendo, deja abrir la WebView
 * de siempre para comparar y trae los MANDOS del servidor falso — con quién se
 * entra, sin conexión, CRM caído, lento y el reloj — para ver cada estado de
 * las pantallas sin servidor de verdad.
 *
 * Solo aparece si se habla con el servidor falso (desarrollo y canal preview).
 */
export function ComunicaLabPanel() {
  const fake = getFakeServer();
  const { closeSecretMenu } = usePreviewChannel();
  const controls = useSyncExternalStore(
    (l) => fake?.subscribe(l) ?? (() => {}),
    () => fake?.controls ?? null,
  );

  const set = useCallback(
    (patch: Partial<FakeControls>) => {
      h.select();
      fake?.setControls(patch);
    },
    [fake],
  );

  const openLegacy = useCallback(() => {
    h.navigate();
    closeSecretMenu();
    setTimeout(() => router.push('/comunica/web'), durations.slow);
  }, [closeSecretMenu]);

  if (!fake || !controls) return null;

  const today = madridDay(new Date());
  const toSat = (6 - weekday(today) + 7) % 7;
  const saturday = addDays(today, toSat);
  const tuesday = addDays(today, (2 - weekday(today) + 7) % 7 || 7);
  const clocks: { label: string; value: string | null }[] = [
    { label: 'Ahora', value: null },
    { label: 'Sábado 15:00', value: madridInstant(saturday, '15:00') },
    { label: 'Sábado 17:00', value: madridInstant(saturday, '17:00') },
    { label: 'Martes', value: madridInstant(tuesday, '10:00') },
  ];

  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>área nativa · datos inventados</Text>
      <Text style={styles.title}>Comunica nueva</Text>
      <Text style={styles.body}>
        Con el laboratorio encendido, la pestaña Comunica enseña el área nativa.
        Todo lo que sale es inventado: nada llega al CRM.
      </Text>

      <Text style={styles.label}>Entrar como</Text>
      <Chips
        value={controls.persona}
        options={[
          ['monitor', 'Monitor'],
          ['coordination', 'Coordinación'],
          ['accompaniment', 'Acompañamiento'],
          ['other', 'Otra delegación'],
        ]}
        onChange={(persona) => set({ persona })}
      />

      <Text style={styles.label}>Reloj del servidor</Text>
      <Chips
        value={controls.clock ?? 'now'}
        options={clocks.map((c) => [c.value ?? 'now', c.label])}
        onChange={(v) => set({ clock: v === 'now' ? null : v })}
      />

      <Text style={styles.label}>Qué falla</Text>
      <Chips
        multi
        value={
          [
            controls.offline && 'offline',
            controls.crmDown && 'crm',
            controls.latencyMs > 1000 && 'slow',
            controls.cannotRegister && 'register',
          ].filter(Boolean) as string[]
        }
        options={[
          ['offline', 'Sin conexión'],
          ['crm', 'CRM caído al guardar'],
          ['slow', 'Lento (2 s)'],
          ['register', 'No se puede inscribir'],
        ]}
        onChange={(k) =>
          set(
            k === 'offline'
              ? { offline: !controls.offline }
              : k === 'crm'
                ? { crmDown: !controls.crmDown }
                : k === 'slow'
                  ? { latencyMs: controls.latencyMs > 1000 ? 300 : 2000 }
                  : { cannotRegister: !controls.cannotRegister },
          )
        }
      />

      <LabButton label="Abrir la WebView de siempre" onPress={openLegacy} />
      <LabButton
        label="Empezar de cero (datos y mandos)"
        subtle
        onPress={() => {
          h.remove();
          fake.reset();
        }}
      />
    </View>
  );
}

function Chips<K extends string>({
  value,
  options,
  onChange,
  multi,
}: {
  value: K | K[];
  options: [K, string][];
  onChange: (key: K) => void;
  multi?: boolean;
}) {
  return (
    <View style={styles.chips}>
      {options.map(([key, label]) => {
        const on = Array.isArray(value) ? value.includes(key) : value === key;
        return (
          <PressableFeedback
            key={key}
            onPress={() => onChange(key)}
            accessibilityRole={multi ? 'checkbox' : 'radio'}
            accessibilityState={multi ? { checked: on } : { selected: on }}
            accessibilityLabel={label}
            style={[styles.chip, on && styles.chipOn]}
          >
            <PressableFeedback.Highlight />
            <Text style={styles.chipText}>{label}</Text>
          </PressableFeedback>
        );
      })}
    </View>
  );
}

function LabButton({
  label,
  onPress,
  subtle,
}: {
  label: string;
  onPress: () => void;
  subtle?: boolean;
}) {
  return (
    <PressableFeedback
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[styles.button, subtle && styles.buttonSubtle]}
    >
      <PressableFeedback.Highlight />
      <Text style={styles.buttonText}>{label}</Text>
    </PressableFeedback>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    maxWidth: 460,
    padding: spacing.lg,
    borderRadius: radii.xl,
    backgroundColor: 'rgba(40, 10, 34, 0.82)',
    borderWidth: 1,
    borderColor: 'rgba(230, 140, 205, 0.55)',
    gap: spacing.sm,
  },
  eyebrow: {
    ...typography.overline,
    color: 'rgba(240, 170, 220, 0.95)',
    letterSpacing: 2,
  },
  title: { ...typography.h3, color: '#fff' },
  body: { ...typography.subhead, color: 'rgba(255,255,255,0.9)' },
  label: {
    ...typography.caption,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.75)',
    marginTop: spacing.sm,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    minHeight: 36,
    paddingHorizontal: 12,
    justifyContent: 'center',
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  chipOn: {
    backgroundColor: 'rgba(230, 140, 205, 0.35)',
    borderColor: 'rgba(240, 170, 220, 0.95)',
  },
  chipText: { ...typography.caption, color: '#fff', fontWeight: '600' },
  button: {
    minHeight: 44,
    marginTop: spacing.sm,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(230, 140, 205, 0.28)',
  },
  buttonSubtle: { backgroundColor: 'rgba(255,255,255,0.08)' },
  buttonText: { ...typography.button, color: '#fff' },
});
